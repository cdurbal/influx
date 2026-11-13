// Fixtures of the tests of the campaign routes (L3B commit 07: campaigns-route.test.ts and
// t14-campaigns-route.test.ts): committed advertiser and creator accounts with their member
// sessions, the server of apps/api over the pools of the local stack (member under influx_app), and
// the request helpers. The accounts are COMMITTED by the migration role (random identifiers,
// disposable local stack, like profiles-brand-route): their campaigns are removed and their
// published profiles go back to draft when the file ends (RG25 reads every published profile).
import { localRoleUrl, type LoginRole } from "@influx/test-kit/db";
import type { LightMyRequestResponse } from "fastify";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type postgres from "postgres";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import {
  ensureInForce,
  LOCAL_SEED_DRAFTS,
} from "../scripts/terms-publication.ts";
import { buildServer } from "../src/server.ts";
import { captureLogs, testApiConfig, WEB_SECRET } from "../tests/helpers.ts";
import { migrationRole, retireBrandFixtures, testDataSet } from "./support.ts";

export const URL_CAMPAIGNS = "/v1/me/campaigns";

export type Member = {
  accountId: string;
  email: string;
  session: string;
  name: string;
};

export type Method = "GET" | "PATCH" | "POST";

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

export type Server = ReturnType<typeof buildServer>;

export type CampaignRouteFixtures = {
  migration: postgres.Sql;
  /** An account with a session; an advertiser holds a profile (draft), a creator none. */
  newMember(
    role: "advertiser" | "creator",
    options?: { acceptTerms?: boolean },
  ): Promise<Member>;
  /** The profile of a brand in the state INFLUX would give it (no decision exists in these files). */
  setProfileStatus(member: Member, status: string): Promise<void>;
  /** A server with its own captured log stream. */
  server(): Server;
  call(
    server: Server,
    method: Method,
    url: string,
    session: string | null,
    body?: unknown,
  ): Promise<LightMyRequestResponse>;
  /** Values that must be found in no log stream (C-1, D60). */
  watch(...values: string[]): void;
  logStreams: (() => string)[];
  watchedValues: string[];
  /** The status and body of an error, without its request id (T14.4: the same body). */
  errorBody(response: LightMyRequestResponse): {
    status: number;
    code: string;
    message: string;
  };
  issuesOf(response: LightMyRequestResponse): { path: string; issue: string }[];
  close(): Promise<void>;
};

export async function openCampaignRouteFixtures(): Promise<CampaignRouteFixtures> {
  const migration = migrationRole();
  await testDataSet();
  for (const draft of LOCAL_SEED_DRAFTS) {
    await ensureInForce(migration, draft);
  }
  const versions = await migration<{ id: string }[]>`
    select id::text from identity.terms_versions
     where document_kind = 'terms_of_service' and locale = 'fr'
       and effective_to is null and effective_from <= now() and content is not null`;
  const termsInForce = versions[0]?.id;
  if (termsInForce === undefined) {
    throw new Error(
      "no terms of service in force in French, WITH its text (run db:publish-terms, 21 EC-62 (B))",
    );
  }
  const database: ApiDatabase = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
  const accounts: string[] = [];
  const watchedValues: string[] = [];
  const logStreams: (() => string)[] = [];

  return {
    migration,
    logStreams,
    watchedValues,
    watch: (...values) => {
      watchedValues.push(...values);
    },
    async newMember(role, options = {}) {
      const accountId = randomUUID();
      const email = `l3b-campaign-${role}-${accountId}@example.test`;
      const name = `Maison ${accountId.slice(0, 8)}`;
      await migration.begin(async (tx) => {
        await tx`
          insert into identity.accounts
            (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
             is_adult_attested, adult_attested_at, declared_status)
          values (${accountId}, ${randomUUID()}, ${email}, now(), 'FR', 'fr', true, now(),
                  ${role === "advertiser" ? "business" : "individual"}::identity.declared_status)`;
        await tx`
          insert into identity.account_roles (account_id, role)
          values (${accountId}, ${role}::identity.account_role)`;
        if (role === "advertiser") {
          await tx`
            insert into profiles.advertiser_profiles (account_id, legal_name)
            values (${accountId}, ${name})`;
        }
        await tx`
          insert into identity.consent_events (account_id, purpose, granted, source, occurred_at)
          select ${accountId}, p, true, 'signup_form', now() - interval '1 day'
            from unnest(array['marketing_email', 'commercial_prospection']::identity.consent_purpose[]) p`;
        if (options.acceptTerms ?? true) {
          await tx`
            insert into identity.terms_acceptances (account_id, terms_version_id, nature, channel, locale)
            values (${accountId}, ${termsInForce}, 'acceptance', 'signup', 'fr')`;
        }
      });
      accounts.push(accountId);
      watchedValues.push(email, name);
      const token = randomBytes(32);
      await migration`
        insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
        values (${createHash("sha256").update(token).digest()}, ${accountId}, 'member', null,
                'firefox.windows')`;
      return { accountId, email, name, session: token.toString("base64url") };
    },
    async setProfileStatus(member, status) {
      await migration`
        update profiles.advertiser_profiles set status = ${status}
         where account_id = ${member.accountId}`;
    },
    server() {
      const logs = captureLogs();
      logStreams.push(() => logs.text());
      return buildServer(testApiConfig(), {
        logDestination: logs.destination,
        database,
      });
    },
    call(server, method, url, session, body) {
      return server.inject({
        method,
        url,
        headers: {
          "x-influx-internal": WEB_SECRET,
          "x-request-id": randomUUID(),
          "sec-fetch-site": "same-origin",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(session === null
            ? {}
            : { cookie: `__Host-influx-session=${session}` }),
        },
        ...(body === undefined ? {} : { payload: JSON.stringify(body) }),
      });
    },
    errorBody(response) {
      const { error } = response.json() as {
        error: { code: string; message: string };
      };
      return {
        status: response.statusCode,
        code: error.code,
        message: error.message,
      };
    },
    issuesOf(response) {
      const { error } = response.json() as {
        error: { details?: { path: string; issue: string }[] };
      };
      return error.details ?? [];
    },
    async close() {
      await closeDatabase(database);
      if (accounts.length > 0) {
        // the campaigns of this file leave the shared stack (the register lines stay: append-only)
        await migration.begin(async (tx) => {
          for (const table of [
            "campaign_key_messages",
            "campaign_deliverables",
            "campaign_usage_territories",
            "campaign_audience_countries",
            "campaign_audience_languages",
            "campaign_audience_bands",
            "campaign_audience_age_bands",
            "campaign_topics",
            "campaign_requested_items",
          ]) {
            await tx`
              delete from campaigns.${tx(table)}
               where campaign_id in (select id from campaigns.campaigns
                                      where advertiser_account_id = any(${accounts}::uuid[]))`;
          }
          await tx`
            delete from campaigns.campaigns
             where advertiser_account_id = any(${accounts}::uuid[])`;
        });
        await retireBrandFixtures(migration, accounts);
        await migration`
          delete from leads.outbox_events
           where subject_key = any (${accounts.map((id) => `account:${id}`)}::text[])`;
      }
    },
  };
}

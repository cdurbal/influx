// Fixtures of the tests of the routes of queue 7 and of the campaign record (L3C commit 07:
// campaign-review-route.test.ts and t14-campaign-review-route.test.ts): committed agents and admins with
// their backoffice sessions, brands and campaigns SUBMITTED through the member routes of L3B (so that the
// entry of queue 7 is the one the door of 0307 writes), and the request helpers of the backoffice surface.
// The accounts are COMMITTED by the migration role (random identifiers, disposable local stack, like
// campaign-routes-kit.ts): the interventions of their campaigns are removed before the kit of the member
// routes removes the campaigns, and the internal profiles are deactivated when the file ends.
import type { LightMyRequestResponse } from "fastify";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_SECRET,
  WEB_ORIGIN,
  WEB_SECRET,
} from "../tests/helpers.ts";
import {
  campaignCalendar,
  openCampaignRouteFixtures,
  URL_CAMPAIGNS,
  type CampaignRouteFixtures,
  type Member,
  type Server,
} from "./campaign-routes-kit.ts";

export const BO_CAMPAIGNS = "/v1/bo/campaigns";
export const BO_ENTRIES = "/v1/bo/campaigns/entries";
export const NIL = "00000000-0000-4000-8000-000000000000";
export const ANY_TOKEN = "0".repeat(64);

export type Internal = { accountId: string; name: string; session: string };

export type SubmittedCampaign = {
  campaignId: string;
  entryId: string;
  brand: Member;
  title: string;
  brief: string;
};

export type SubmitOptions = {
  title?: string;
  brief?: string;
  /** A sector of `reference.sectors` (default: a sector that is not sensitive). */
  sector?: string;
  /** Tick the declaration of RG85 (needed for a sensitive sector). */
  declare?: boolean;
  summary?: string;
};

export type ReviewKit = {
  fx: CampaignRouteFixtures;
  server: Server;
  newInternal(role: "agent" | "admin", name: string): Promise<Internal>;
  /** An advertiser with a published profile; `owner` is the commercial who holds the account (D54). */
  newBrand(options?: {
    owner?: string;
    language?: "fr" | "en";
  }): Promise<Member>;
  submitCampaign(
    brand: Member,
    options?: SubmitOptions,
  ): Promise<SubmittedCampaign>;
  /** A sector whose product asks the declaration of RG85 (09 RG84). */
  sensitiveSector(): Promise<string>;
  /** A member (creator) session, presented on the backoffice surface. */
  memberSession(): Promise<string>;
  bo(
    method: "GET" | "POST",
    url: string,
    session: string | null,
    body?: object,
    options?: { surface?: "backoffice" | "web"; cookie?: string },
  ): Promise<LightMyRequestResponse>;
  /** The register lines of a subject, in order. */
  register(
    subjectId: string,
    event?: string,
  ): Promise<
    { event: string; actor: string | null; payload: Record<string, unknown> }[]
  >;
  /** The actions refused to an actor and journaled (`backoffice.action_refused`). */
  refusedActions(actor: string): Promise<string[]>;
  /** The e-mails and leads events queued for a brand: type, destination and payload. */
  outbox(accountId: string): Promise<
    {
      eventType: string;
      destination: string;
      payload: Record<string, unknown>;
    }[]
  >;
  /** The campaign as the database holds it (status and cycle), read as the migration role. */
  campaignRow(campaignId: string): Promise<{
    status: string;
    pauseOrigin: string | null;
    ownerAgentId: string | null;
    snapshotId: string | null;
  }>;
  close(): Promise<void>;
};

function sha256(bytes: Buffer): Buffer {
  return createHash("sha256").update(bytes).digest();
}

export async function openReviewKit(): Promise<ReviewKit> {
  const fx = await openCampaignRouteFixtures();
  const server = fx.server();
  const internals: string[] = [];
  const brands: string[] = [];
  let sensitive: string | undefined;

  const kit: ReviewKit = {
    fx,
    server,
    async newInternal(role, name) {
      const accountId = randomUUID();
      const token = randomBytes(32);
      await fx.migration.begin(async (tx) => {
        await tx`
          insert into identity.accounts
            (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
             display_name, is_adult_attested, adult_attested_at, declared_status)
          values (${accountId}, ${randomUUID()}, ${`l3c-review-${role}-${accountId}@example.test`},
                  now(), 'FR', 'fr', ${name}, true, now(), 'business')`;
        await tx`
          insert into identity.account_roles (account_id, role)
          values (${accountId}, ${role}::identity.account_role)`;
        await tx`
          insert into identity.agent_profiles
            (account_id, first_name, activated_at, mfa_enrolled_at, mfa_factor_id)
          values (${accountId}, ${name}, now(), now(), ${randomUUID()})`;
        await tx`
          insert into identity.sessions
            (token_hash, account_id, surface, mfa_method, user_agent_summary)
          values (${sha256(token)}, ${accountId}, 'backoffice', 'totp', 'firefox.linux')`;
      });
      internals.push(accountId);
      return { accountId, name, session: token.toString("base64url") };
    },
    async newBrand(options = {}) {
      const brand = await fx.newMember("advertiser");
      await fx.setProfileStatus(brand, "published");
      await fx.migration`
        update identity.accounts
           set owner_agent_id = ${options.owner ?? null},
               preferred_language = ${options.language ?? "fr"}
         where id = ${brand.accountId}`;
      brands.push(brand.accountId);
      return brand;
    },
    async sensitiveSector() {
      if (sensitive === undefined) {
        const [row] = await fx.migration<{ code: string }[]>`
          select code from reference.sectors where is_sensitive order by code limit 1`;
        if (row === undefined) {
          throw new Error("no sensitive sector in reference.sectors");
        }
        sensitive = row.code;
      }
      return sensitive;
    },
    async submitCampaign(brand, options = {}) {
      const title = options.title ?? `L3C titre ${randomUUID().slice(0, 8)}`;
      const brief = options.brief ?? `L3C brief ${"b".repeat(300)}`;
      const created = await fx.call(
        server,
        "POST",
        URL_CAMPAIGNS,
        brand.session,
        {
          title,
          campaignType: "product_placement",
          publicSummary: options.summary ?? `L3C summary ${"s".repeat(120)}`,
          brief,
          internalReference: "L3C-REF",
          productDescription: "A light tent for two people",
          productSector: options.sector ?? "sports_leisure",
          productIsSent: false,
          deliverables: [
            {
              networkCode: "instagram",
              formatCode: "instagram_reel",
              quantity: 2,
            },
          ],
          usageRights: "none",
          exclusivity: "none",
          contentReviewDelay: "5bd",
          audienceCountries: ["FR"],
          audienceLanguages: ["fr"],
          audienceTopics: ["sport_fitness"],
          currency: "EUR",
          remunerationKind: "cash",
          budgetBand: "500_1000",
          creatorsWanted: 3,
          totalBudgetMinor: 3_000_000,
          ...campaignCalendar(),
        },
      );
      if (created.statusCode !== 200) {
        throw new Error(`campaign not created: ${created.body}`);
      }
      const campaignId = (created.json() as { id: string }).id;
      const submitted = await fx.call(
        server,
        "POST",
        `${URL_CAMPAIGNS}/${campaignId}/submit`,
        brand.session,
        options.declare === true ? { declarationLocale: "fr" } : {},
      );
      if (submitted.statusCode !== 200) {
        throw new Error(`campaign not submitted: ${submitted.body}`);
      }
      const [entry] = await fx.migration<{ id: string }[]>`
        select id::text from campaigns.campaign_review_entries
         where campaign_id = ${campaignId} and state = 'open'`;
      if (entry === undefined) {
        throw new Error("the submission opened no entry of queue 7");
      }
      fx.watch(brief, title);
      return { campaignId, entryId: entry.id, brand, title, brief };
    },
    async memberSession() {
      const accountId = randomUUID();
      const token = randomBytes(32);
      await fx.migration.begin(async (tx) => {
        await tx`
          insert into identity.accounts
            (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
             is_adult_attested, adult_attested_at, declared_status)
          values (${accountId}, ${randomUUID()}, ${`l3c-review-member-${accountId}@example.test`},
                  now(), 'FR', 'fr', true, now(), 'individual')`;
        await tx`
          insert into identity.account_roles (account_id, role) values (${accountId}, 'creator')`;
        await tx`
          insert into identity.sessions
            (token_hash, account_id, surface, mfa_method, user_agent_summary)
          values (${sha256(token)}, ${accountId}, 'member', null, 'firefox.windows')`;
      });
      return token.toString("base64url");
    },
    bo(method, url, session, body, options = {}) {
      const cookie = options.cookie ?? "__Host-influx-ops-session";
      return server.inject({
        method,
        url,
        headers: {
          "x-influx-internal":
            options.surface === "web" ? WEB_SECRET : BACKOFFICE_SECRET,
          origin: options.surface === "web" ? WEB_ORIGIN : BACKOFFICE_ORIGIN,
          "x-request-id": randomUUID(),
          ...(session === null ? {} : { cookie: `${cookie}=${session}` }),
        },
        ...(body === undefined ? {} : { payload: body }),
      });
    },
    async register(subjectId, event) {
      return fx.migration<
        {
          event: string;
          actor: string | null;
          payload: Record<string, unknown>;
        }[]
      >`
        select event_type as event, actor_account_id::text as actor, payload
          from audit.audit_events
         where subject_id = ${subjectId}
           and (${event ?? null}::text is null or event_type = ${event ?? null})
         order by seq`;
    },
    async refusedActions(actor) {
      const rows = await fx.migration<{ payload: { action_code?: string } }[]>`
        select payload from audit.audit_events
         where event_type = 'backoffice.action_refused' and actor_account_id = ${actor}
         order by seq`;
      return rows.map((row) => row.payload.action_code ?? "");
    },
    async outbox(accountId) {
      const rows = await fx.migration<
        {
          event_type: string;
          destination: string;
          payload: Record<string, unknown>;
        }[]
      >`
        select event_type, destination::text, payload from leads.outbox_events
         where subject_key = ${`account:${accountId}`} order by id`;
      return rows.map((row) => ({
        eventType: row.event_type,
        destination: row.destination,
        payload: row.payload,
      }));
    },
    async campaignRow(campaignId) {
      const [row] = await fx.migration<
        {
          status: string;
          pause_origin: string | null;
          owner_agent_id: string | null;
          current_snapshot_id: string | null;
        }[]
      >`
        select status::text, pause_origin::text, owner_agent_id::text,
               current_snapshot_id::text
          from campaigns.campaigns where id = ${campaignId}`;
      if (row === undefined) {
        throw new Error("no such campaign");
      }
      return {
        status: row.status,
        pauseOrigin: row.pause_origin,
        ownerAgentId: row.owner_agent_id,
        snapshotId: row.current_snapshot_id,
      };
    },
    async close() {
      if (brands.length > 0) {
        // the interventions are append-only for the roles of the application: the migration role removes
        // them with their campaigns; a closed campaign leaves its state last (the kit of the member routes)
        await fx.migration`
          delete from campaigns.agent_interventions
           where advertiser_account_id = any(${brands}::uuid[])`;
        await fx.migration`
          update identity.accounts set owner_agent_id = null
           where id = any(${brands}::uuid[])`;
      }
      await fx.close();
      if (internals.length > 0) {
        await fx.migration`
          update identity.agent_profiles
             set is_active = false, deactivated_at = now(), deactivated_by_account_id = account_id
           where account_id = any(${internals}::uuid[]) and is_active`;
      }
    },
  };
  return kit;
}

/** The whole answer but its request id (18 T14.4). */
export function answer(response: LightMyRequestResponse) {
  const body = response.json<{ error?: Record<string, unknown> }>();
  const error = { ...body.error };
  delete error.requestId;
  return { status: response.statusCode, error };
}

export type Issue = { path: string; issue: string };
export function issuesOf(response: LightMyRequestResponse): Issue[] {
  return (
    response.json<{ error?: { details?: Issue[] } }>().error?.details ?? []
  );
}

// The members of the "mon compte" journeys (J7 commit 9), written straight into the local stack by
// the migration role (loopback only, @influx/test-kit/db), as apps/api's own tests write them: an
// account, its role, the consent of its sign-up, its acceptance of the terms in force (or none),
// and its open sessions. The first session is the browser's: its identifier becomes the session
// cookie (32 random bytes in base64url, only their hash in the base), set the way apps/api sets it:
// by a `Set-Cookie` answer, here one of an intercepted request (CDP refuses a `__Host-` cookie
// added directly on the loopback). No GoTrue user: these
// journeys never send a code (the change of address signs up through the screens instead).
import type { Page } from "@playwright/test";
import { connectAsMigrationRole } from "@influx/test-kit/db";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { WEB_ORIGIN } from "./servers";

/** apps/api/src/platform/auth-cookies.ts, `webSession`. */
const SESSION_COOKIE = "__Host-influx-session";

export type SeededMember = { accountId: string; email: string };

/** A path no server answers: only the interception below does. */
const SEED_PATH = "/e2e-session-seed";

export async function seedMember(
  page: Page,
  options: {
    role: "advertiser" | "creator";
    language: "fr" | "en";
    acceptTerms: boolean;
    /** The browser summaries of the sessions; the first one is this browser's. */
    sessions: readonly string[];
  },
): Promise<SeededMember> {
  const accountId = randomUUID();
  const email = `e2e-${accountId.slice(0, 8)}-account@example.test`;
  const tokens = options.sessions.map(() => randomBytes(32));
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    await sql.begin(async (tx) => {
      await tx`
        insert into identity.accounts
          (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
           is_adult_attested, adult_attested_at, declared_status)
        values (${accountId}, ${randomUUID()}, ${email}, now(), 'FR', ${options.language},
                true, now(),
                ${options.role === "advertiser" ? "business" : "individual"}::identity.declared_status)`;
      await tx`
        insert into identity.account_roles (account_id, role)
        values (${accountId}, ${options.role}::identity.account_role)`;
      if (options.role === "advertiser") {
        await tx`
          insert into profiles.advertiser_profiles (account_id, legal_name)
          values (${accountId}, 'Maison E2E')`;
      }
      // 05 RG33: one checkbox, two purposes, given at sign-up the day before
      await tx`
        insert into identity.consent_events (account_id, purpose, granted, source, occurred_at)
        select ${accountId}, p, true, 'signup_form', now() - interval '1 day'
          from unnest(array['marketing_email', 'commercial_prospection']::identity.consent_purpose[]) p`;
      if (options.acceptTerms) {
        await tx`
          insert into identity.terms_acceptances
            (account_id, terms_version_id, nature, channel, locale)
          select ${accountId}, id, 'acceptance', 'signup', locale
            from identity.terms_versions
           where document_kind = 'terms_of_service' and locale = ${options.language}
             and effective_to is null and effective_from <= now()`;
      }
      for (const [index, token] of tokens.entries()) {
        await tx`
          insert into identity.sessions
            (token_hash, account_id, surface, mfa_method, user_agent_summary)
          values (${createHash("sha256").update(token).digest()}, ${accountId}, 'member', null,
                  ${options.sessions[index] ?? "unidentified.unidentified"})`;
      }
    });
  } finally {
    await sql.end({ timeout: 1 });
  }
  const own = tokens[0];
  if (own !== undefined) {
    const url = `${WEB_ORIGIN}${SEED_PATH}`;
    await page.route(url, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/plain",
        headers: {
          "set-cookie": `${SESSION_COOKIE}=${own.toString("base64url")}; Path=/; Secure; HttpOnly; SameSite=Lax`,
        },
        body: "",
      }),
    );
    await page.goto(url);
    await page.unroute(url);
  }
  return { accountId, email };
}

/** What the journeys read back: the consent events, the terms acceptances, the account status. */
export async function accountFacts(accountId: string): Promise<{
  status: string;
  consents: { purpose: string; granted: boolean; source: string }[];
  acceptances: { channel: string }[];
  openSessions: number;
}> {
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    const [account] = await sql<{ status: string }[]>`
      select status::text as status from identity.accounts where id = ${accountId}`;
    const consents = await sql<
      { purpose: string; granted: boolean; source: string }[]
    >`
      select distinct on (purpose) purpose::text, granted, source::text
        from identity.consent_events
       where account_id = ${accountId}
       order by purpose, occurred_at desc`;
    const acceptances = await sql<{ channel: string }[]>`
      select channel::text from identity.terms_acceptances where account_id = ${accountId}`;
    const [sessions] = await sql<{ open: number }[]>`
      select count(*)::int as open from identity.sessions
       where account_id = ${accountId} and revoked_at is null`;
    return {
      status: account?.status ?? "missing",
      consents: [...consents],
      acceptances: [...acceptances],
      openSessions: sessions?.open ?? 0,
    };
  } finally {
    await sql.end({ timeout: 1 });
  }
}

// What the three verification journeys share (docs/mvp/08, 06, 17b; jalons/l2f, commit 01): the texts, the
// addresses, the rows of a line, the accessibility and wording checks, and the helpers that write into
// the local stack what an agent's door would leave (a refusal, a badge, queue 4 requests, a brand
// dossier), so that a case reaches a state by the database or by the API and never by the screens it
// does not test. Moved as they were from `e2e/verification.spec.ts`, which L2F-01 split into
// `verification-creator`, `verification-brand` and `verification-backoffice`.
import { randomInt, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  connectAsLocalSuperuser,
  connectAsMigrationRole,
} from "@influx/test-kit/db";
import type { Page } from "@playwright/test";
import enBrandProfile from "@/locales/en/brand-profile.json" with { type: "json" };
import enVerification from "@/locales/en/verification.json" with { type: "json" };
import frBrandProfile from "@/locales/fr/brand-profile.json" with { type: "json" };
import frVerification from "@/locales/fr/verification.json" with { type: "json" };
import { expectNoAxeViolation } from "./axe";
import { expect } from "./journey";
import { WEB_ORIGIN } from "./servers";

export const COPY = {
  fr: { own: frVerification, brand: frBrandProfile },
  en: { own: enVerification, brand: enBrandProfile },
} as const;
export const PROFILE = {
  fr: "/fr/compte/profil",
  en: "/en/account/profile",
} as const;
export const JOURNEY = {
  fr: "/fr/compte/profil/verification/propriete",
  en: "/en/account/profile/verification/ownership",
} as const;
export const WIDTHS = [375, 1440] as const;

/** What the badge never carries (08 RG6) and a mark that would name an identifier. */
export const NEVER_WRITTEN =
  /certifi|confiance|trust|premium|top cr[ée]ateur|top creator|recommand|★|@/i;

export type Sql = ReturnType<typeof connectAsMigrationRole>;

export async function withSql<T>(run: (sql: Sql) => Promise<T>): Promise<T> {
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    return await run(sql);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** The main Instagram line of a creator, with its handle and link, and a TikTok line with neither. */
export async function seedLines(
  accountId: string,
  withTiktok: boolean,
): Promise<void> {
  await withSql(async (sql) => {
    await sql`
      insert into profiles.creator_social_accounts
        (account_id, network_code, is_primary, handle, profile_url)
      values (${accountId}, 'instagram', true, 'camille_cuisine',
              'https://www.instagram.com/camille_cuisine')`;
    if (withTiktok) {
      await sql`
        insert into profiles.creator_social_accounts (account_id, network_code, is_primary)
        values (${accountId}, 'tiktok', false)`;
    }
  });
}

/** The requests of the creator at the account level, newest first, with the live code of the draft. */
export async function requestsOf(
  accountId: string,
): Promise<{ id: string; status: string; code: string | null }[]> {
  return withSql(
    (sql) => sql`
      select r.id::text as id, r.status::text as status,
             (select c.code from verification.ownership_codes c
               where c.request_id = r.id and c.revoked_at is null
               order by c.created_at desc limit 1) as code
        from verification.verification_requests r
       where r.account_id = ${accountId} and r.level = 'account_verified'
       order by r.created_at desc, r.id desc`,
  );
}

/**
 * What an agent's refusal leaves (08 RG56, RG60): the request is `rejected` with its reason, decided now,
 * so that the whole delay of RG60 is left; a request granted later is newer and wins on the screen.
 */
export async function refuseAsAgent(
  requestId: string,
  agentId: string,
  reason: string,
): Promise<void> {
  await withSql(
    (sql) => sql`
      update verification.verification_requests
         set status = 'rejected', decided_by_account_id = ${agentId},
             decided_at = now(), closed_at = now(),
             rejection_reason_code = ${reason}
       where id = ${requestId}`,
  );
}

/** An active « Compte vérifié » on the Instagram line, from an approved request newer than any refusal. */
export async function grantAsAgent(
  accountId: string,
  agentId: string,
): Promise<void> {
  await withSql(async (sql) => {
    const [line] = await sql<{ id: string }[]>`
      select id::text from profiles.creator_social_accounts
       where account_id = ${accountId} and network_code = 'instagram'`;
    const [request] = await sql<{ id: string }[]>`
      insert into verification.verification_requests
        (account_id, social_account_id, network_code, level, status, created_at, submitted_at,
         sla_due_at, escalate_at, decided_by_account_id, decided_at, closed_at)
      values (${accountId}, ${line?.id ?? null}, 'instagram', 'account_verified', 'approved',
              now(), now(), now(), now(), ${agentId}, now(), now())
      returning id::text`;
    await sql`
      insert into verification.badges
        (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
         granted_at, evidence_source, observed_handle_at_decision, state)
      values (${accountId}, ${line?.id ?? null}, 'instagram', ${request?.id ?? null},
              'account_verified', ${agentId}, now(), 'public_profile',
              ${`handle_${accountId.slice(0, 8)}`}, 'active')`;
  });
}

export const accountRow = (page: Page) =>
  page.locator(
    '[data-verification-line="instagram"] [data-verification-row="account_verified"]',
  );
export const audienceRow = (page: Page) =>
  page.locator(
    '[data-verification-line="instagram"] [data-verification-row="audience_verified"]',
  );

/** The sentence of a template with its placeholders cut out: the fixed words that must be on screen. */
export function fixed(template: string): string {
  return template.split("{")[0]!.trim();
}

export async function expectAxe(
  page: Page,
  screen: string,
  widths: readonly number[],
): Promise<void> {
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoAxeViolation(page, `${screen}, ${width}`, { wcag22: true });
  }
}

/** The text of a scope (the journey, or the verification block of a line) carries none of the words a badge never has. */
export async function expectNothingForbidden(
  page: Page,
  scope = "main",
): Promise<void> {
  const shown = await page.locator(scope).innerText();
  expect(shown).not.toMatch(NEVER_WRITTEN);
  expect(shown).not.toMatch(/\b(tarifs?|prix|price|rates?|fee)\b|[€$£]/i);
}

export const AUDIENCE = {
  fr: "/fr/compte/profil/verification/audience",
  en: "/en/account/profile/verification/audience",
} as const;
/** A real image of 600 x 300 px with GPS in its EXIF: what leaves the browser is these bytes, as they are. */
export const EVIDENCE_FIXTURE = fileURLToPath(
  new URL("../../../api/tests/fixtures/logo-geotagged.jpg", import.meta.url),
);
export const PDF_REPORT = {
  name: "rapport-agence.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from(
    "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n",
  ),
};

/** The audience requests of the creator, newest first, with the pieces the database holds on each. */
export async function audienceRequestsOf(
  accountId: string,
): Promise<{ id: string; status: string; active: number }[]> {
  return withSql(
    (sql) => sql`
      select r.id::text as id, r.status::text as status,
             (select count(*)::int from verification.evidence_files e
               where e.request_id = r.id and e.state = 'active') as active
        from verification.verification_requests r
       where r.account_id = ${accountId} and r.level = 'audience_verified'
       order by r.created_at desc, r.id desc`,
  );
}

/** An active « Audience vérifiée » on the Instagram line, from an approved request newer than any refusal. */
export async function grantAudienceAsAgent(
  accountId: string,
  agentId: string,
): Promise<void> {
  await withSql(async (sql) => {
    const [line] = await sql<{ id: string }[]>`
      select id::text from profiles.creator_social_accounts
       where account_id = ${accountId} and network_code = 'instagram'`;
    const [request] = await sql<{ id: string }[]>`
      insert into verification.verification_requests
        (account_id, social_account_id, network_code, level, status, created_at, submitted_at,
         sla_due_at, escalate_at, decided_by_account_id, decided_at, closed_at)
      values (${accountId}, ${line?.id ?? null}, 'instagram', 'audience_verified', 'approved',
              now(), now(), now(), now(), ${agentId}, now(), now())
      returning id::text`;
    await sql`
      insert into verification.badges
        (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
         granted_at, evidence_source, observed_followers, observed_posts_last_30_days,
         observed_avg_comments, observed_period_start, observed_period_end,
         declared_posts_at_decision, declared_comments_at_decision, observed_handle_at_decision,
         expires_at, state)
      values (${accountId}, ${line?.id ?? null}, 'instagram', ${request?.id ?? null},
              'audience_verified', ${agentId}, now(), 'native_dashboard', 47300, 12, 85,
              current_date - 30, current_date - 2, 12, 85,
              ${`handle_${accountId.slice(0, 8)}`}, now() + interval '90 days', 'active')`;
  });
}

export const BRAND_JOURNEY = {
  fr: "/fr/compte/profil/marque-verifiee",
  en: "/en/account/profile/verified-brand",
} as const;
export const brandBlock = (page: Page) =>
  page.locator('[data-section="verification"]');

/** The domain of the brand's site, as the autosave of the profile stores it (06 RG17, CA26). */
export async function setWebsiteDomain(
  accountId: string,
  domain: string,
): Promise<void> {
  await withSql(
    (sql) => sql`
      update profiles.advertiser_profiles set website_domain = ${domain}
       where account_id = ${accountId}`,
  );
}

/** The requests of the brand, newest first, with the live domain code of the draft. */
export async function brandRequestsOf(
  accountId: string,
): Promise<{ id: string; status: string; code: string | null }[]> {
  return withSql(
    (sql) => sql`
      select r.id::text as id, r.status::text as status,
             (select c.code from verification.ownership_codes c
               where c.request_id = r.id and c.revoked_at is null and c.kind = 'domain'
               order by c.created_at desc limit 1) as code
        from verification.verification_requests r
       where r.account_id = ${accountId} and r.level = 'brand_verified'
       order by r.created_at desc, r.id desc`,
  );
}

/** The internal block the brand typed, as the database holds it (06 RG46), or nothing. */
export async function internalDetailsOf(accountId: string): Promise<{
  legal_name: string;
  registration_country_code: string;
  registration_number: string;
} | null> {
  return withSql(async (sql) => {
    const [row] = await sql<
      {
        legal_name: string;
        registration_country_code: string;
        registration_number: string;
      }[]
    >`
      select legal_name, registration_country_code, registration_number
        from profiles.advertiser_internal_details where account_id = ${accountId}`;
    return row ?? null;
  });
}

/** A « Marque vérifiée » of the account, from an approved request newer than any refusal. */
export async function grantBrandAsAgent(
  accountId: string,
  agentId: string,
  state: "active" | "to_refresh",
): Promise<void> {
  await withSql(async (sql) => {
    const [request] = await sql<{ id: string }[]>`
      insert into verification.verification_requests
        (account_id, social_account_id, network_code, level, status, created_at, submitted_at,
         sla_due_at, escalate_at, decided_by_account_id, decided_at, closed_at)
      values (${accountId}, null, null, 'brand_verified', 'approved',
              now(), now(), now(), now(), ${agentId}, now(), now())
      returning id::text`;
    const [source] = await sql<{ id: string }[]>`
      select id::text from verification.registry_sources order by country_code nulls first limit 1`;
    const stale = state === "to_refresh";
    await sql`
      insert into verification.badges
        (account_id, request_id, level, granted_by_account_id, granted_at, evidence_source,
         registry_source_id, expires_at, state)
      values (${accountId}, ${request?.id ?? null}, 'brand_verified', ${agentId},
              ${stale ? sql`now() - interval '13 months'` : sql`now()`}, 'domain_and_registry',
              ${source?.id ?? null},
              ${stale ? sql`now() - interval '1 month'` : sql`now() + interval '12 months'`},
              ${state})`;
  });
}

/** Every account whose request a journey of the queue wrote, its pending requests cancelled after the run. */
export const queueAccounts: string[] = [];

export type QueueRequestOptions = {
  kind: "creator" | "brand";
  owner: string;
  /** The deadline as a gap from now, in minutes: negative, the request is past it. */
  dueInMinutes: number;
  network?: string;
  /** The colleague who holds the lock, taken ten minutes ago. */
  heldBy?: string;
  reexamine?: boolean;
  /** The trading name of a brand. */
  name?: string;
};

export type QueueAccount = { accountId: string; displayName: string };

/**
 * Creators (one network line) and brands with one pending request each, as the doors of 0222 leave them, in
 * one transaction. The deadlines are written by a trigger from now() (0221): each request goes in with the
 * triggers aside, as the T14 file of apps/api writes its fixtures, so that the journey owns its instants.
 */
export async function seedQueueRequests(
  list: readonly QueueRequestOptions[],
): Promise<QueueAccount[]> {
  const sql = connectAsLocalSuperuser({ max: 1 });
  return sql
    .begin(async (tx) => {
      const seeded: QueueAccount[] = [];
      for (const options of list) {
        const accountId = randomUUID();
        const creator = options.kind === "creator";
        const network = options.network ?? "instagram";
        await tx`set local session_replication_role = origin`;
        await tx`
        insert into identity.accounts
          (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
           is_adult_attested, adult_attested_at, declared_status, owner_agent_id)
        values (${accountId}, ${randomUUID()}, ${`e2e-vq-${accountId}@example.test`}, now(),
                ${creator ? "FR" : "BE"}, 'fr', true, now(),
                ${creator ? "individual" : "business"}, ${options.owner})`;
        await tx`
        insert into identity.account_roles (account_id, role)
        values (${accountId}, ${creator ? "creator" : "advertiser"}::identity.account_role)`;
        let name = options.name ?? "";
        let socialAccountId: string | null = null;
        if (creator) {
          const [profile] = await tx<{ alias: string }[]>`
          insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
          values (${accountId}, profiles.new_creator_alias(), 'FR')
          returning alias`;
          name = profile?.alias ?? "";
          const [line] = await tx<{ id: string }[]>`
          insert into profiles.creator_social_accounts
            (account_id, network_code, is_primary, handle)
          values (${accountId}, ${network}, true, ${`vq_${accountId.slice(0, 8)}`})
          returning id::text as id`;
          socialAccountId = line?.id ?? null;
        } else {
          await tx`
          insert into profiles.advertiser_profiles (account_id, legal_name, website_domain)
          values (${accountId}, ${name}, ${`vq-${accountId.slice(0, 8)}.example.test`})`;
        }
        await tx`set local session_replication_role = replica`;
        const [request] = await tx<{ id: string }[]>`
        insert into verification.verification_requests
          (account_id, social_account_id, network_code, level, status, created_at, submitted_at,
           sla_due_at, escalate_at)
        values (${accountId}, ${socialAccountId}, ${creator ? network : null},
                ${creator ? "account_verified" : "brand_verified"}::verification.badge_level,
                'pending',
                now() + make_interval(mins => ${options.dueInMinutes}) - interval '8 hours',
                now() + make_interval(mins => ${options.dueInMinutes}) - interval '8 hours',
                now() + make_interval(mins => ${options.dueInMinutes}),
                now() + make_interval(mins => ${options.dueInMinutes}) + interval '3 days')
        returning id::text as id`;
        if (options.heldBy !== undefined) {
          await tx`
          update verification.verification_requests
             set claimed_by_account_id = ${options.heldBy},
                 claimed_at = now() - interval '10 minutes',
                 claim_expires_at = now() + interval '20 minutes'
           where id = ${request?.id ?? ""}`;
        }
        if (options.reexamine === true) {
          await tx`
          update verification.verification_requests
             set reexamine_reason_code = 'network_unreachable', reexamined_at = now()
           where id = ${request?.id ?? ""}`;
        }
        seeded.push({ accountId, displayName: name });
        queueAccounts.push(accountId);
      }
      return seeded;
    })
    .finally(() => sql.end({ timeout: 1 }));
}

/** The requests the queue journey left pending are cancelled: the counters of the next run stay true (15 RG28). */
export async function withdrawQueueRequests(): Promise<void> {
  if (queueAccounts.length === 0) {
    return;
  }
  await withSql(
    (sql) => sql`
      update verification.verification_requests
         set status = 'cancelled', cancelled_at = now(), closed_at = now(),
             claimed_by_account_id = null, claimed_at = null, claim_expires_at = null
       where account_id = any(${queueAccounts}::uuid[]) and status = 'pending'`,
  );
}

/** The audit lines of one subject, by event type: what the register keeps of a decision (RG84, RG99). */
export async function auditLinesOf(
  subjectId: string,
  eventType: string,
): Promise<{ actor: string | null; payload: Record<string, unknown> }[]> {
  return withSql(
    (sql) => sql<{ actor: string | null; payload: Record<string, unknown> }[]>`
      select actor_account_id::text as actor, payload
        from audit.audit_events
       where subject_id = ${subjectId} and event_type = ${eventType}`,
  );
}

/** An ISO day, `daysAgo` days before today (UTC, as the database counts the freshness of a period). */
export function dayBefore(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** The internal block of the brand and the domain code of its request, as the doors of 0222 leave them. */
export async function seedBrandDossier(
  accountId: string,
): Promise<{ requestId: string; code: string; domain: string }> {
  const code = `INFLUX-${Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("")}`;
  return withSql(async (sql) => {
    const [request] = await sql<{ id: string }[]>`
      select id::text from verification.verification_requests
       where account_id = ${accountId} and level = 'brand_verified' and status = 'pending'`;
    const [profile] = await sql<{ domain: string }[]>`
      select website_domain as domain from profiles.advertiser_profiles
       where account_id = ${accountId}`;
    await sql`
      insert into profiles.advertiser_internal_details
        (account_id, legal_name, registration_country_code, registration_number)
      values (${accountId}, 'Maison E2E SRL', 'BE', '0123.456.789')`;
    await sql`
      insert into verification.ownership_codes (request_id, account_id, kind, code, expires_at)
      values (${request?.id ?? ""}, ${accountId}, 'domain', ${code}, now() + interval '7 days')`;
    return {
      requestId: request?.id ?? "",
      code,
      domain: profile?.domain ?? "",
    };
  });
}

/**
 * A creator's audience request deposited and sent through the API's own doors, as the screen's calls do
 * (the same-origin relay of the web front, the session's cookie, the raw bytes of one real image): the
 * state a case needs BEFORE the gesture it tests, reached without the three screens it does not. The
 * browser context carries the creator's session (`seedMember` set it).
 */
export async function sendAudienceRequest(page: Page): Promise<void> {
  const relay = `${WEB_ORIGIN}/api/v1/me/verification/requests`;
  // what the browser adds to a same-origin call, and the API checks (03 PP-5)
  const headers = { origin: WEB_ORIGIN, "sec-fetch-site": "same-origin" };
  const opened = await page.request.post(relay, {
    headers,
    data: { networkCode: "instagram", level: "audience_verified" },
  });
  expect(opened.ok()).toBe(true);
  const { request } = (await opened.json()) as { request: { id: string } };
  const deposit = await page.request.put(`${relay}/${request.id}/evidence`, {
    headers: { ...headers, "content-type": "application/octet-stream" },
    data: readFileSync(EVIDENCE_FIXTURE),
  });
  expect(deposit.ok()).toBe(true);
  const sent = await page.request.post(`${relay}/${request.id}/submit`, {
    headers,
  });
  expect(sent.ok()).toBe(true);
}

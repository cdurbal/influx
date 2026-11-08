// The proof of ownership of a network account by a creator (docs/mvp/08 RG1 to RG7, RG10, RG12, RG21 to
// RG24, RG28, RG29, RG56, RG57, RG60, RG93, RG96, RG97; 17 §5.3; jalons/l2e, commit 18), in French and
// in English, at 375 and 1 440 px (the widths in a loop on the two long screens), against the real API
// and the local stack, and the texts of the locale files, never copies. The journey: the state of the
// line on "mon profil" (nothing verified, the audience waiting for the account, a line with no handle
// told so), screen 1 (what the badge states and does not state, what the brands will read, written
// BEFORE anything is asked: no request exists yet), screen 2 (the code the API issued, « Copier », where
// to paste it, what INFLUX never asks and never accepts; a reload takes the draft back at its code),
// screen 3 (the request sent), then what only an agent does is written by the database as the agent's
// own door would: a refusal with its reason, what to do next and the delay left of RG60 read from the
// real `Retry-After`, then the badge with its complete date. Commit 19 adds the audience: the condition
// written before any button, what a brand reads before any deposit, the instructions as the screen, a
// real image sent as raw bytes and a PDF refused without costing the rest, the follow-up, a refusal and
// the badge with its period and its source. No agent screen is run here (commits 21 to 23), no amount,
// rate or price anywhere (D78).
import { randomInt, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  connectAsLocalSuperuser,
  connectAsMigrationRole,
} from "@influx/test-kit/db";
import type { Page } from "@playwright/test";
import enBrandProfile from "@/locales/en/brand-profile.json" with { type: "json" };
import enCreatorProfile from "@/locales/en/creator-profile.json" with { type: "json" };
import enVerification from "@/locales/en/verification.json" with { type: "json" };
import frBrandProfile from "@/locales/fr/brand-profile.json" with { type: "json" };
import frCreatorProfile from "@/locales/fr/creator-profile.json" with { type: "json" };
import frVerification from "@/locales/fr/verification.json" with { type: "json" };
import { seedMember } from "./support/account";
import { expectNoAxeViolation } from "./support/axe";
import { messages as bo } from "../../backoffice/src/messages/fr";
import {
  retireInternals,
  runTag,
  seedColleague,
  seedInternal,
} from "./support/backoffice";
import { expect, open, reload, test, title } from "./support/journey";
import { BACKOFFICE_ORIGIN, WEB_ORIGIN } from "./support/servers";

const COPY = {
  fr: { own: frVerification, brand: frBrandProfile },
  en: { own: enVerification, brand: enBrandProfile },
} as const;
const PROFILE = { fr: "/fr/compte/profil", en: "/en/account/profile" } as const;
const JOURNEY = {
  fr: "/fr/compte/profil/verification/propriete",
  en: "/en/account/profile/verification/ownership",
} as const;
const WIDTHS = [375, 1440] as const;

test.afterAll(async () => {
  await withdrawQueueRequests();
  await retireInternals();
});

/** What the badge never carries (08 RG6) and a mark that would name an identifier. */
const NEVER_WRITTEN =
  /certifi|confiance|trust|premium|top cr[ée]ateur|top creator|recommand|★|@/i;

type Sql = ReturnType<typeof connectAsMigrationRole>;

async function withSql<T>(run: (sql: Sql) => Promise<T>): Promise<T> {
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    return await run(sql);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

/** The main Instagram line of a creator, with its handle and link, and a TikTok line with neither. */
async function seedLines(
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
async function requestsOf(
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
async function refuseAsAgent(
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
async function grantAsAgent(accountId: string, agentId: string): Promise<void> {
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

const accountRow = (page: Page) =>
  page.locator(
    '[data-verification-line="instagram"] [data-verification-row="account_verified"]',
  );
const audienceRow = (page: Page) =>
  page.locator(
    '[data-verification-line="instagram"] [data-verification-row="audience_verified"]',
  );

/** The sentence of a template with its placeholders cut out: the fixed words that must be on screen. */
function fixed(template: string): string {
  return template.split("{")[0]!.trim();
}

async function expectAxe(
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
async function expectNothingForbidden(
  page: Page,
  scope = "main",
): Promise<void> {
  const shown = await page.locator(scope).innerText();
  expect(shown).not.toMatch(NEVER_WRITTEN);
  expect(shown).not.toMatch(/\b(tarifs?|prix|price|rates?|fee)\b|[€$£]/i);
}

test("a creator proves the ownership of a network account in French, from the line to the badge, at 375 then 1 440 px (08 RG1 à RG7, RG12, RG21 à RG24, RG56, RG60, RG93, RG96)", async ({
  page,
  context,
}) => {
  const copy = COPY.fr.own;
  const network = COPY.fr.brand.reference.network.instagram;
  const { accountId } = await seedMember(page, {
    role: "creator",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await seedLines(accountId, true);
  const agent = await seedColleague("agent", "Noa");
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: WEB_ORIGIN,
  });

  // The line: nothing is verified, a row per level, the audience told to wait for the account BEFORE any
  // button (RG12), a line with no handle told so; no global badge anywhere (RG13).
  await open(page, PROFILE.fr);
  await expect(accountRow(page)).toContainText(copy.line.absent.account);
  await expect(audienceRow(page)).toContainText(
    copy.line.absent.audienceNeedsAccount,
  );
  await expect(audienceRow(page).locator("a")).toHaveCount(0);
  await expect(page.getByText(copy.line.needIdentifier)).toHaveCount(1);
  await expect(page.locator("[data-badge]")).toHaveCount(0);
  // The line with no handle offers the way to the field to fill, never the button that starts a request
  // nobody could process (L2EU-3): the link takes the focus to the field.
  const tiktokRow = page.locator(
    '[data-verification-line="tiktok"] [data-verification-row="account_verified"]',
  );
  await expect(
    tiktokRow.getByRole("link", { name: new RegExp(copy.line.cta.start) }),
  ).toHaveCount(0);
  const fill = tiktokRow.getByRole("link", {
    name: new RegExp(copy.line.cta.fillIdentifier),
  });
  await expect(fill).toHaveCount(1);
  const fieldId = (await fill.getAttribute("href"))?.slice(1) ?? "";
  expect(fieldId).toMatch(/^creator-network-.+-handle$/);
  await fill.click();
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id))
    .toBe(fieldId);

  // Screen 1: what the badge states and does not state, what the brands read, and no request exists
  // yet (RG1, RG2, RG96).
  await accountRow(page)
    .getByRole("link", { name: new RegExp(copy.line.cta.start) })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`${JOURNEY.fr}\\?network=instagram$`),
  );
  await expect(title(page)).toHaveText(
    copy.ownership.title.replace("{network}", network),
  );
  await expect(page.locator("[data-step]")).toHaveText(
    copy.ownership.steps.progress
      .replace("{current}", "1")
      .replace("{total}", "3")
      .replace("{name}", copy.ownership.steps.affirm),
  );
  const main = page.getByRole("main");
  for (const text of [
    copy.ownership.affirm.intro,
    copy.ownership.affirm.items.fact,
    copy.ownership.affirm.items.evidence,
    copy.ownership.affirm.items.agent,
    copy.ownership.affirm.items.date,
    copy.ownership.affirm.not.authenticity,
    copy.ownership.affirm.not.stability,
    copy.ownership.affirm.not.performance,
    copy.ownership.affirm.not.quality,
    copy.ownership.affirm.not.commitments,
    copy.ownership.affirm.preview.never,
  ]) {
    await expect(main.getByText(text, { exact: true })).toBeVisible();
  }
  // « Compte vérifié — Instagram, le {date} », the date complete, and its short explanation beside it
  await expect(page.locator("[data-preview]")).toContainText(
    new RegExp(`Compte vérifié — ${network}, le \\d{1,2}(er)? \\S+ 20\\d\\d`),
  );
  await expect(page.locator("[data-preview]")).toContainText(
    copy.verif.badge.accountVerified.help,
  );
  await expectNothingForbidden(page);
  // the button comes after the whole of it, and nothing was asked before it
  const preview = await page.locator("[data-preview]").boundingBox();
  const proceed = page.getByRole("button", {
    name: copy.ownership.affirm.continue,
  });
  expect((await proceed.boundingBox())!.y).toBeGreaterThan(
    preview!.y + preview!.height,
  );
  expect(await requestsOf(accountId)).toEqual([]);
  await expectAxe(page, "ownership, screen 1, fr", WIDTHS);

  // Screen 2: the code the API issued (INFLUX- and eight signs of 31), « Copier », where, how long, what
  // INFLUX never asks, what it does not accept (RG21 to RG24, RG28, RG29).
  await proceed.click();
  const code = page.locator("[data-ownership-code]");
  await expect(code).toHaveText(/^INFLUX-[2-9A-HJKMNP-Z]{8}$/);
  await expect(page.locator("[data-step]")).toContainText(
    copy.ownership.steps.progress
      .replace("{current}", "2")
      .replace("{total}", "3")
      .replace("{name}", copy.ownership.steps.code),
  );
  const [draft] = await requestsOf(accountId);
  expect(draft?.status).toBe("draft");
  expect(draft?.code).toBe(await code.innerText());
  await expect(
    main.getByText(
      copy.verif.ownership.instructions.replace("{network}", network),
    ),
  ).toBeVisible();
  await expect(
    main.getByText(copy.ownership.code.where.instagram),
  ).toBeVisible();
  await expect(main.getByText(copy.verif.ownership.neverAsk)).toBeVisible();
  await expect(
    main.getByText(fixed(copy.verif.ownership.codeExpiry)),
  ).toBeVisible();
  await expect(main.getByText(copy.ownership.code.public)).toBeVisible();
  for (const alternative of [
    copy.ownership.code.notAccepted.dm,
    copy.ownership.code.notAccepted.connected,
    copy.ownership.code.notAccepted.bio,
    copy.ownership.code.notAccepted.oath,
    copy.ownership.code.notAccepted.link,
    copy.ownership.code.notAccepted.video,
    copy.ownership.code.notAccepted.credentials,
  ]) {
    await expect(main.getByText(alternative, { exact: true })).toBeVisible();
  }
  await expectNothingForbidden(page);
  await page.getByRole("button", { name: copy.ownership.code.copy }).click();
  await expect(page.getByText(copy.ownership.code.copied)).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    draft?.code,
  );
  await expectAxe(page, "ownership, screen 2, fr", WIDTHS);

  // A reload takes the draft back at its own screen, with the same code (the API's state, not memory).
  await page.reload();
  await expect(code).toHaveText(draft?.code ?? "");

  // Screen 3: the request is sent; the state stays in the line of the network.
  await page.getByRole("button", { name: copy.ownership.code.pasted }).click();
  await expect(
    page.getByRole("heading", { name: copy.ownership.confirm.title }),
  ).toBeVisible();
  await expect(main.getByText(copy.ownership.confirm.body)).toBeVisible();
  await expect(main.getByText(copy.verif.request.pending)).toBeVisible();
  await expect(main.getByText(copy.ownership.confirm.keepCode)).toBeVisible();
  expect((await requestsOf(accountId))[0]?.status).toBe("pending");
  await expectAxe(page, "ownership, screen 3, fr", [1440]);
  await page.getByRole("link", { name: copy.ownership.confirm.back }).click();
  await expect(title(page)).toHaveText(frCreatorProfile.page.title);
  await expect(accountRow(page)).toContainText(
    new RegExp(
      fixed(copy.state.requested).replace(/\s+$/, "") +
        " \\d{1,2}(er)? \\S+ 20\\d\\d",
    ),
  );
  await expect(accountRow(page).locator("a")).toHaveCount(0);

  // The agent refuses for a reason about a piece, which an ownership does not hold (`missing_evidence`
  // leaves no delay, 0222): the sentence reopens the proof, « Redemander » leads back to the first screen,
  // a new draft carries a new code and is sent at once (L2E-25, C1).
  const [first] = await requestsOf(accountId);
  await refuseAsAgent(first!.id, agent.accountId, "missing_evidence");
  await page.reload();
  await expect(
    accountRow(page).locator('[data-reason="missing_evidence"]'),
  ).toContainText(copy.refusal.next.restartOwnership);
  await accountRow(page)
    .getByRole("link", { name: new RegExp(copy.line.cta.restart) })
    .click();
  await page
    .getByRole("button", { name: copy.ownership.affirm.continue })
    .click();
  await expect(code).toHaveText(/^INFLUX-[2-9A-HJKMNP-Z]{8}$/);
  expect(await code.innerText()).not.toBe(draft?.code);
  await page.getByRole("button", { name: copy.ownership.code.pasted }).click();
  await expect(
    page.getByRole("heading", { name: copy.ownership.confirm.title }),
  ).toBeVisible();
  expect((await requestsOf(accountId))[0]?.status).toBe("pending");
  await page.getByRole("link", { name: copy.ownership.confirm.back }).click();

  // The agent refuses (the database writes what his door writes): the reason, its text, what to do next,
  // the way to ask again; asked again at once, the delay left is the real Retry-After (RG56, RG57, RG60).
  const [sent] = await requestsOf(accountId);
  await refuseAsAgent(sent!.id, agent.accountId, "ownership_not_proven");
  await page.reload();
  const refusal = accountRow(page).locator(
    '[data-reason="ownership_not_proven"]',
  );
  await expect(refusal).toContainText(copy.refusal.reason.ownership_not_proven);
  await expect(refusal).toContainText(copy.refusal.next.restartOwnership);
  await expectNothingForbidden(page, "[data-verification-line=instagram]");
  await accountRow(page)
    .getByRole("link", { name: new RegExp(copy.line.cta.restart) })
    .click();
  await expect(page.locator('[data-request="refused"]')).toContainText(
    copy.refusal.reason.ownership_not_proven,
  );
  await page
    .getByRole("button", { name: copy.ownership.affirm.continue })
    .click();
  await expect(page.locator('[data-failure="retryLater"]')).toContainText(
    /dans 24\sheures/,
  );
  expect((await requestsOf(accountId))[0]?.status).toBe("rejected");

  // The badge, granted by an agent: the complete date, the explanation beside it, and the end of the
  // journey says the code can leave the bio (RG24).
  await grantAsAgent(accountId, agent.accountId);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: copy.ownership.done.title }),
  ).toBeVisible();
  await expect(page.locator('[data-badge="account_verified"]')).toContainText(
    new RegExp(`Compte vérifié — ${network}, le \\d{1,2}(er)? \\S+ 20\\d\\d`),
  );
  await expect(main.getByText(copy.ownership.done.removeCode)).toBeVisible();
  await page.getByRole("link", { name: copy.ownership.done.back }).click();
  await expect(accountRow(page).locator("[data-badge]")).toContainText(
    copy.verif.badge.accountVerified.help,
  );
  await expect(accountRow(page).locator("a")).toHaveCount(0);
  // the audience still waits for its own journey, but no longer for the account
  await expect(audienceRow(page)).toContainText(copy.line.absent.audience);
});

test("a creator proves the ownership of a network account in English, from the line to the badge (08 RG93, RG96, RG97)", async ({
  page,
}) => {
  const copy = COPY.en.own;
  const network = COPY.en.brand.reference.network.instagram;
  const { accountId } = await seedMember(page, {
    role: "creator",
    language: "en",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await seedLines(accountId, false);
  const agent = await seedColleague("agent", "Noa");

  await open(page, PROFILE.en);
  await expect(title(page)).toHaveText(enCreatorProfile.page.title);
  await expect(accountRow(page)).toContainText(copy.line.absent.account);
  await expect(audienceRow(page)).toContainText(
    copy.line.absent.audienceNeedsAccount,
  );
  await accountRow(page)
    .getByRole("link", { name: new RegExp(copy.line.cta.start) })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`${JOURNEY.en}\\?network=instagram$`),
  );
  await expect(title(page)).toHaveText(
    copy.ownership.title.replace("{network}", network),
  );
  const main = page.getByRole("main");
  await expect(
    main.getByText(copy.ownership.affirm.not.authenticity, { exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-preview]")).toContainText(
    new RegExp(`Account verified — ${network}, on \\w+ \\d{1,2}, 20\\d\\d`),
  );
  await expectNothingForbidden(page);
  await expectAxe(page, "ownership, screen 1, en", WIDTHS);
  await page
    .getByRole("button", { name: copy.ownership.affirm.continue })
    .click();
  await expect(page.locator("[data-ownership-code]")).toHaveText(
    /^INFLUX-[2-9A-HJKMNP-Z]{8}$/,
  );
  await expect(
    main.getByText(copy.ownership.code.where.instagram),
  ).toBeVisible();
  await expect(main.getByText(copy.verif.ownership.neverAsk)).toBeVisible();
  await expectAxe(page, "ownership, screen 2, en", WIDTHS);
  await page.getByRole("button", { name: copy.ownership.code.pasted }).click();
  await expect(main.getByText(copy.ownership.confirm.body)).toBeVisible();

  expect((await requestsOf(accountId))[0]?.status).toBe("pending");

  await grantAsAgent(accountId, agent.accountId);
  await open(page, PROFILE.en);
  await expect(accountRow(page).locator("[data-badge]")).toContainText(
    new RegExp(`Account verified — ${network}, on \\w+ \\d{1,2}, 20\\d\\d`),
  );
});

// --- The audience: the deposit of the evidence (commit 19) ---------------------------------------------

const AUDIENCE = {
  fr: "/fr/compte/profil/verification/audience",
  en: "/en/account/profile/verification/audience",
} as const;
/** A real image of 600 x 300 px with GPS in its EXIF: what leaves the browser is these bytes, as they are. */
const EVIDENCE_FIXTURE = fileURLToPath(
  new URL("../../api/tests/fixtures/logo-geotagged.jpg", import.meta.url),
);
const PDF_REPORT = {
  name: "rapport-agence.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from(
    "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n",
  ),
};

/** The audience requests of the creator, newest first, with the pieces the database holds on each. */
async function audienceRequestsOf(
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
async function grantAudienceAsAgent(
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

test("a creator deposits the evidence of an audience in French, from the condition to the badge, a refused PDF costing nothing (08 RG12, RG19, RG31 à RG36, RG87, RG95, RG96)", async ({
  page,
}) => {
  const copy = COPY.fr.own;
  const network = COPY.fr.brand.reference.network.instagram;
  const { accountId } = await seedMember(page, {
    role: "creator",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await seedLines(accountId, false);
  const agent = await seedColleague("agent", "Noa");
  const main = page.getByRole("main");
  const puts: Record<string, string>[] = [];
  page.on("request", (request) => {
    if (request.method() === "PUT" && request.url().endsWith("/evidence")) {
      void request.allHeaders().then((headers) => puts.push(headers));
    }
  });

  // The condition is written before any button (RG12): no request, no deposit, a way to the account.
  await open(page, `${AUDIENCE.fr}?network=instagram`);
  await expect(title(page)).toHaveText(
    copy.audience.title.replace("{network}", network),
  );
  await expect(page.locator("[data-audience-locked]")).toHaveText(
    copy.audience.locked.body.replace("{network}", network),
  );
  await expect(
    page.getByRole("link", {
      name: copy.audience.locked.cta.replace("{network}", network),
    }),
  ).toHaveAttribute(
    "href",
    /\/fr\/compte\/profil\/verification\/propriete\?network=instagram$/,
  );
  await expect(page.locator("[data-step]")).toHaveCount(0);
  expect(await audienceRequestsOf(accountId)).toEqual([]);

  // The account verified: what the badge states and what a brand reads, before anything is asked (RG96).
  await grantAsAgent(accountId, agent.accountId);
  await page.reload();
  for (const text of [
    copy.audience.affirm.intro.replace("{network}", network),
    copy.ownership.affirm.not.authenticity,
    copy.audience.preview.public.bands,
    copy.audience.preview.internal.pieces,
    copy.audience.preview.internal.gap,
    copy.verif.evidence.freshness,
  ]) {
    await expect(main.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(page.locator("[data-preview]")).toContainText(
    new RegExp(
      `Audience vérifiée — ${network}, le \\d{1,2}(er)? \\S+ 20\\d\\d`,
    ),
  );
  await expectNothingForbidden(page);
  expect(await audienceRequestsOf(accountId)).toEqual([]);
  await expectAxe(page, "audience, screen 1, fr", [1440]);

  // The deposit: the instructions are the screen (RG87), the piece expected on Instagram (RG32).
  await page
    .getByRole("button", { name: copy.audience.affirm.continue })
    .click();
  await expect(page.locator("[data-step]")).toContainText(
    copy.ownership.steps.progress
      .replace("{current}", "2")
      .replace("{total}", "3")
      .replace("{name}", copy.audience.steps.deposit),
  );
  const instructions = copy.audience.deposit.instructions;
  for (const part of [
    instructions.see,
    instructions.hide,
    instructions.never,
  ]) {
    await expect(page.locator("[data-instructions]")).toContainText(part.title);
    await expect(page.locator("[data-instructions]")).toContainText(part.text);
  }
  await expect(page.locator('[data-expected="instagram"]')).toHaveText(
    copy.audience.deposit.expected.instagram,
  );
  await expect(
    main.getByText(copy.audience.deposit.formats.replace("{size}", "8")),
  ).toBeVisible();
  await expectNothingForbidden(page);
  expect((await audienceRequestsOf(accountId))[0]).toMatchObject({
    status: "draft",
    active: 0,
  });
  const picker = page.locator("input[type=file]");

  // A PDF is refused with its own words and costs nothing: no piece, nothing kept (RG34, RG95, CA67).
  await picker.setInputFiles(PDF_REPORT);
  await expect(
    page.locator('[data-evidence-failure="unsupported_type"]'),
  ).toHaveText(copy.audience.errors.unsupported_type);
  await expect(page.locator("[data-piece]")).toHaveCount(0);
  expect((await audienceRequestsOf(accountId))[0]?.active).toBe(0);
  await page
    .getByRole("button", { name: copy.audience.deposit.attempt.dismiss })
    .click();
  await expect(page.locator("[data-attempt]")).toHaveCount(0);

  // A real image: re-encoded by the API, the piece shown by its numbers, never by a name; the bytes leave
  // as they are, without a declared type or a name (RG35, RG85).
  await picker.setInputFiles(EVIDENCE_FIXTURE);
  await expect(page.locator("[data-piece]")).toHaveCount(1);
  await expect(page.locator("[data-piece]")).toContainText(
    /Capture 1 : \d+ × \d+ px, \d+\s?ko/i,
  );
  await expect(main.getByText(/1 capture déposée/)).toBeVisible();
  expect(puts.at(-1)?.["content-type"]).toBe("application/octet-stream");
  expect(JSON.stringify(puts)).not.toMatch(/geotagged|rapport-agence/);
  expect(await main.innerText()).not.toMatch(/geotagged|rapport-agence/);
  expect((await audienceRequestsOf(accountId))[0]).toMatchObject({
    status: "draft",
    active: 1,
  });
  await expectAxe(page, "audience, screen 2, fr", [375]);

  // The request is sent; an agent has the last word, the database writes what his door writes.
  await page
    .getByRole("button", { name: copy.audience.deposit.submit })
    .click();
  await expect(main.getByText(copy.audience.sent.body)).toBeVisible();
  await expect(main.getByText(copy.verif.request.pending)).toBeVisible();
  const [sent] = await audienceRequestsOf(accountId);
  expect(sent).toMatchObject({ status: "pending", active: 1 });

  // Refused for a piece too wide: the reason, what to do next, the way to deposit again (RG56, RG57).
  await refuseAsAgent(sent!.id, agent.accountId, "evidence_too_wide");
  await open(page, PROFILE.fr);
  const refusal = audienceRow(page).locator(
    '[data-reason="evidence_too_wide"]',
  );
  await expect(refusal).toContainText(copy.refusal.reason.evidence_too_wide);
  await expect(refusal).toContainText(copy.refusal.next.redeposit);
  await expect(
    audienceRow(page).getByRole("link", {
      name: new RegExp(copy.line.cta.audienceRestart),
    }),
  ).toBeVisible();
  await expectNothingForbidden(page, "[data-verification-line=instagram]");

  // The badge: the date, the network, the period and the source with the authenticity sentence at the
  // same place (RG4, RG5, RG10); only an agent grants it.
  await grantAudienceAsAgent(accountId, agent.accountId);
  await open(page, `${AUDIENCE.fr}?network=instagram`);
  await expect(
    page.getByRole("heading", { name: copy.audience.done.title }),
  ).toBeVisible();
  const badge = page.locator('[data-badge="audience_verified"]');
  await expect(badge).toContainText(
    new RegExp(
      `Audience vérifiée — ${network}, le \\d{1,2}(er)? \\S+ 20\\d\\d`,
    ),
  );
  await expect(badge).toContainText(`tableau de bord ${network}, période du`);
  await expect(badge).toContainText(
    "INFLUX ne se prononce pas sur l'authenticité des abonnés",
  );
  await expect(main.getByText(/Ce badge arrive à échéance le/)).toBeVisible();
});

test("a creator deposits the evidence of an audience in English: the condition lifted, one image, the request sent (08 RG87, RG93, RG96)", async ({
  page,
}) => {
  const copy = COPY.en.own;
  const network = COPY.en.brand.reference.network.instagram;
  const { accountId } = await seedMember(page, {
    role: "creator",
    language: "en",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await seedLines(accountId, false);
  const agent = await seedColleague("agent", "Noa");
  await grantAsAgent(accountId, agent.accountId);

  await open(page, PROFILE.en);
  await expect(audienceRow(page)).toContainText(copy.line.absent.audience);
  await audienceRow(page)
    .getByRole("link", { name: new RegExp(copy.line.cta.audienceStart) })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`${AUDIENCE.en}\\?network=instagram$`),
  );
  const main = page.getByRole("main");
  await expect(
    main.getByText(copy.ownership.affirm.not.authenticity, { exact: true }),
  ).toBeVisible();
  await expect(page.locator("[data-preview]")).toContainText(
    new RegExp(`Audience verified — ${network}, on \\w+ \\d{1,2}, 20\\d\\d`),
  );
  await expectNothingForbidden(page);
  await page
    .getByRole("button", { name: copy.audience.affirm.continue })
    .click();
  await expect(
    main.getByText(copy.audience.deposit.formats.replace("{size}", "8")),
  ).toBeVisible();
  await expect(page.locator("[data-instructions]")).toContainText(
    copy.audience.deposit.instructions.hide.text,
  );
  await page.locator("input[type=file]").setInputFiles(EVIDENCE_FIXTURE);
  await expect(page.locator("[data-piece]")).toContainText(
    /Screenshot 1: \d+ × \d+ px, \d+\s?kB/,
  );
  await expectAxe(page, "audience, screen 2, en", [375]);
  await page
    .getByRole("button", { name: copy.audience.deposit.submit })
    .click();
  await expect(main.getByText(copy.audience.sent.body)).toBeVisible();
  expect((await audienceRequestsOf(accountId))[0]).toMatchObject({
    status: "pending",
    active: 1,
  });
});

// --- The brand: block 4 of the profile and the request for « Marque vérifiée » (commit 20) --------------

const BRAND_JOURNEY = {
  fr: "/fr/compte/profil/marque-verifiee",
  en: "/en/account/profile/verified-brand",
} as const;
const brandBlock = (page: Page) =>
  page.locator('[data-section="verification"]');

/** The domain of the brand's site, as the autosave of the profile stores it (06 RG17, CA26). */
async function setWebsiteDomain(
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
async function brandRequestsOf(
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
async function internalDetailsOf(accountId: string): Promise<{
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
async function grantBrandAsAgent(
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

test("a brand asks for the badge « Marque vérifiée » in French, from the profile to the dated badge, a refusal written on the way (06 RG46 à RG54, RG84, CA26 à CA29)", async ({
  page,
}) => {
  const copy = COPY.fr.own;
  const brand = COPY.fr.brand;
  await page.setViewportSize({ width: 1440, height: 900 });
  const { accountId } = await seedMember(page, {
    role: "advertiser",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  const agent = await seedColleague("agent", "Noa");

  // Block 4, internal layer: nothing asked, what the badge states, and with no domain the badge told
  // impossible BEFORE any button (CA26), the publication of the profile untouched.
  await open(page, PROFILE.fr);
  const block = brandBlock(page);
  await expect(block).toContainText(copy.brandBlock.status.none);
  await expect(block).toContainText(copy.brandBlock.affirms);
  await expect(block).toContainText(copy.brandBlock.noDomain);
  await expect(block).toContainText(brand.layer.internal);
  await expect(block.locator("a")).toHaveCount(0);
  await expect(block.locator("[data-badge]")).toHaveCount(0);
  await expectNothingForbidden(page, '[data-section="verification"]');
  expect(await brandRequestsOf(accountId)).toEqual([]);

  // Screen 1: what the badge states (two things) and does not state, what is shown with it, dated; no
  // request exists yet (RG49, RG50, RG53).
  await setWebsiteDomain(accountId, "maison-e2e.example");
  await reload(page);
  await block.getByRole("link", { name: copy.brandBlock.cta.start }).click();
  await expect(page).toHaveURL(new RegExp(`${BRAND_JOURNEY.fr}$`));
  await expect(title(page)).toHaveText(copy.brand.title);
  await expect(page.locator("[data-step]")).toHaveText(
    copy.ownership.steps.progress
      .replace("{current}", "1")
      .replace("{total}", "3")
      .replace("{name}", copy.brand.steps.affirm),
  );
  const main = page.getByRole("main");
  for (const text of [
    copy.brand.affirm.intro,
    copy.brand.affirm.items.domain,
    copy.brand.affirm.items.registration,
    copy.brand.affirm.byHand,
    copy.brand.affirm.not.solvency,
    copy.brand.affirm.not.serious,
    copy.brand.affirm.not.experience,
    copy.brand.affirm.not.quality,
    copy.brand.affirm.preview.never,
    copy.brandBlock.optional,
  ]) {
    await expect(main.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(page.locator("[data-preview]")).toContainText(
    new RegExp(
      "Marque vérifiée le \\d{1,2}(er)? \\S+ 20\\d\\d — domaine et immatriculation contrôlés\\.",
    ),
  );
  await expectNothingForbidden(page);
  expect(await brandRequestsOf(accountId)).toEqual([]);

  // Screen 2: the code the API issued, the two ways to publish it, its validity, then the internal block
  // asked HERE and nowhere before (RG47), three fields in the internal layer.
  await page.getByRole("button", { name: copy.brand.affirm.continue }).click();
  const code = page.locator("[data-ownership-code]");
  await expect(code).toHaveText(/^INFLUX-[2-9A-HJKMNP-Z]{8}$/);
  const [draft] = await brandRequestsOf(accountId);
  expect(draft?.status).toBe("draft");
  expect(draft?.code).toBe(await code.innerText());
  await expect(page.locator("[data-step]")).toContainText(
    copy.brand.steps.publish,
  );
  for (const text of [
    copy.brand.publish.ways.dns.title,
    copy.brand.publish.ways.dns.text,
    copy.brand.publish.ways.page.title,
    copy.brand.publish.ways.page.text,
    copy.brand.publish.neverAsk,
    copy.brand.publish.screenshot,
  ]) {
    await expect(main.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(page.locator("[data-code-validity]")).toContainText(
    fixed(copy.verif.ownership.codeExpiry),
  );
  await expect(
    page
      .locator("[data-internal-block]")
      .getByText(brand.layer.internal, { exact: true }),
  ).toHaveCount(3);
  await expectNothingForbidden(page);
  await expectAxe(page, "brand verification, screen 2, fr", WIDTHS);

  // Nothing is sent while a field is missing: the three are named and the first one takes the focus.
  const send = page.getByRole("button", { name: copy.brand.publish.submit });
  await send.click();
  await expect(page.getByText(copy.brand.details.required)).toHaveCount(3);
  await expect(page.locator("#brand-legal-name")).toBeFocused();
  expect((await brandRequestsOf(accountId))[0]?.status).toBe("draft");
  expect(await internalDetailsOf(accountId)).toBeNull();

  // Screen 3: the block is stored, then the request goes (RG46, RG47).
  await page.locator("#brand-legal-name").fill("Maison E2E SAS");
  await page.locator("#brand-registration-country").selectOption("FR");
  await page.locator("#brand-registration-number").fill("123 456 789");
  await send.click();
  await expect(
    page.getByRole("heading", { name: copy.brand.sent.title }),
  ).toBeVisible();
  await expect(main.getByText(copy.brand.sent.body)).toBeVisible();
  await expect(main.getByText(copy.verif.request.pending)).toBeVisible();
  expect((await brandRequestsOf(accountId))[0]?.status).toBe("pending");
  expect(await internalDetailsOf(accountId)).toEqual({
    legal_name: "Maison E2E SAS",
    registration_country_code: "FR",
    registration_number: "123 456 789",
  });
  await page.getByRole("link", { name: copy.brand.sent.back }).click();
  await expect(title(page)).toHaveText(brand.page.title);
  await expect(block).toContainText(
    new RegExp(
      fixed(copy.state.requested).replace(/\s+$/, "") +
        " \\d{1,2}(er)? \\S+ 20\\d\\d",
    ),
  );
  await expect(block.locator("a")).toHaveCount(0);

  // The agent refuses (the database writes what his door writes): the reason of the closed list, its
  // text, what to do next; asked again at once, the delay left is the real Retry-After (RG56, RG60).
  const [sent] = await brandRequestsOf(accountId);
  await refuseAsAgent(sent!.id, agent.accountId, "registration_not_found");
  await reload(page);
  const refusal = block.locator('[data-reason="registration_not_found"]');
  await expect(refusal).toContainText(
    copy.brand.refusal.reason.registration_not_found,
  );
  await expect(refusal).toContainText(copy.brand.refusal.next.fixDetails);
  await expectNothingForbidden(page, '[data-section="verification"]');
  await block.getByRole("link", { name: copy.brandBlock.cta.restart }).click();
  await page.getByRole("button", { name: copy.brand.affirm.continue }).click();
  await expect(page.locator('[data-failure="retryLater"]')).toContainText(
    /dans 24\sheures/,
  );
  expect((await brandRequestsOf(accountId))[0]?.status).toBe("rejected");

  // The badge, granted by an agent: the date complete in the sentence of RG84, on the profile and at the
  // end of the journey; the badge of the account, never one per network (RG53).
  await grantBrandAsAgent(accountId, agent.accountId, "active");
  await open(page, PROFILE.fr);
  await expect(block.locator('[data-badge="brand_verified"]')).toContainText(
    new RegExp(
      "Marque vérifiée le \\d{1,2}(er)? \\S+ 20\\d\\d — domaine et immatriculation contrôlés\\.",
    ),
  );
  await expect(block).toContainText(copy.verif.badge.brandVerified.help);
  await expect(block.locator("a")).toHaveCount(0);
  await open(page, BRAND_JOURNEY.fr);
  await expect(
    page.getByRole("heading", { name: copy.brand.done.title }),
  ).toBeVisible();
  await expect(main.getByText(/Ce badge arrive à échéance le/)).toBeVisible();
});

test("a brand asks for the badge in English at 375 px: the accordion, the domain code, the request sent, then a badge to refresh (06 RG54, RG84, RG97)", async ({
  page,
}) => {
  const copy = COPY.en.own;
  const brand = COPY.en.brand;
  await page.setViewportSize({ width: 375, height: 812 });
  const { accountId } = await seedMember(page, {
    role: "advertiser",
    language: "en",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await setWebsiteDomain(accountId, "maison-e2e.example");
  const agent = await seedColleague("agent", "Noa");

  await open(page, PROFILE.en);
  await page.getByRole("button", { name: brand.section.verification }).click();
  const block = brandBlock(page);
  await expect(block).toContainText(copy.brandBlock.status.none);
  await expect(block.getByRole("link")).toHaveText(copy.brandBlock.cta.start);
  await block.getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`${BRAND_JOURNEY.en}$`));
  await expect(page.locator("[data-preview]")).toContainText(
    new RegExp(
      "Brand verified on \\w+ \\d{1,2}, 20\\d\\d — domain and company registration checked\\.",
    ),
  );
  await expectNothingForbidden(page);
  await page.getByRole("button", { name: copy.brand.affirm.continue }).click();
  await expect(page.locator("[data-ownership-code]")).toHaveText(
    /^INFLUX-[2-9A-HJKMNP-Z]{8}$/,
  );
  await expect(
    page.getByText(copy.brand.publish.ways.dns.title, { exact: true }),
  ).toBeVisible();
  await expectAxe(page, "brand verification, screen 2, en", [375]);
  await page.locator("#brand-legal-name").fill("Maison E2E Ltd");
  await page.locator("#brand-registration-country").selectOption("GB");
  await page.locator("#brand-registration-number").fill("01234567");
  await page.getByRole("button", { name: copy.brand.publish.submit }).click();
  await expect(
    page.getByRole("main").getByText(copy.brand.sent.body),
  ).toBeVisible();
  expect((await brandRequestsOf(accountId))[0]?.status).toBe("pending");

  // A badge past its validity is written as such, dated, with the way to refresh it (RG54, RG97).
  await grantBrandAsAgent(accountId, agent.accountId, "to_refresh");
  await open(page, PROFILE.en);
  await page.getByRole("button", { name: brand.section.verification }).click();
  await expect(block.locator('[data-badge="brand_verified"]')).toContainText(
    new RegExp(
      "Brand verified on \\w+ \\d{1,2}, 20\\d\\d — verification needs refreshing\\.",
    ),
  );
  await block.getByRole("link", { name: copy.brandBlock.cta.refresh }).click();
  await expect(
    page.getByRole("main").getByText(copy.brand.affirm.refresh),
  ).toBeVisible();
});

// L2E-21 (08 RG61 à RG66, RG98, CA42 à CA44; 17b §3.7): the two views of queue 4 in the backoffice, one
// case, in French only (the backoffice has no English before D36). Requests owned by a colleague, so that
// the journey reads them alone by `?owner=`; they are cancelled afterwards, as no journey decides one.

/** Every account whose request a journey of the queue wrote, its pending requests cancelled after the run. */
const queueAccounts: string[] = [];

type QueueRequestOptions = {
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

type QueueAccount = { accountId: string; displayName: string };

/**
 * Creators (one network line) and brands with one pending request each, as the doors of 0222 leave them, in
 * one transaction. The deadlines are written by a trigger from now() (0221): each request goes in with the
 * triggers aside, as the T14 file of apps/api writes its fixtures, so that the journey owns its instants.
 */
async function seedQueueRequests(
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
async function withdrawQueueRequests(): Promise<void> {
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

test("an agent reads queue 4 as two lists, creators then brands: the overdue ones apart, the lock named, the states told (08 RG61 à RG66, RG98, CA42 à CA44)", async ({
  page,
}) => {
  const tag = runTag("vq");
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedInternal(page, "agent", "Lou");
  const owner = await seedColleague("agent", "Noa");
  const holder = await seedColleague("agent", "Marie");
  const [late, held] = await seedQueueRequests([
    { kind: "creator", owner: owner.accountId, dueInMinutes: -300 },
    {
      kind: "creator",
      owner: owner.accountId,
      dueInMinutes: 200,
      network: "tiktok",
      heldBy: holder.accountId,
      reexamine: true,
    },
    {
      kind: "brand",
      owner: owner.accountId,
      dueInMinutes: 90,
      name: `Maison ${tag}`,
    },
  ]);
  if (late === undefined || held === undefined) {
    throw new Error("the requests were not seeded");
  }
  const T = bo.verificationQueue;
  const list = (address: string) =>
    `${BACKOFFICE_ORIGIN}${address}?owner=${owner.accountId}`;

  // the creators: their own screen and heading, the overdue ones in a list of their own, still openable
  await page.goto(list("/files/verifications-createurs"));
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: bo.queue.verification_creators,
    }),
  ).toBeVisible();
  const overdue = page.getByRole("region", {
    name: T.creators.overdueTableLabel,
  });
  await expect(
    page.getByRole("heading", { level: 2, name: T.overdueTitle }),
  ).toBeVisible();
  await expect(overdue.locator("tbody tr")).toHaveCount(1);
  await expect(overdue).toContainText(late.displayName);
  await expect(overdue).toContainText(/HORS DÉLAI depuis 5 h/);
  await expect(overdue).toContainText(bo.queueList.state.overdue);
  await expect(overdue).toContainText(T.levels.account_verified);
  await expect(overdue).toContainText("Instagram");
  await expect(overdue.getByRole("link")).toHaveAttribute(
    "href",
    /^\/files\/verifications-createurs\/[0-9a-f-]{36}$/,
  );
  // in time: the lock names its holder (RG64), « à réexaminer » and its reason are written under the line
  const inTime = page.getByRole("region", {
    name: T.creators.tableLabel,
    exact: true,
  });
  await expect(
    page.getByRole("heading", { level: 2, name: T.otherTitle }),
  ).toBeVisible();
  await expect(inTime).toContainText(held.displayName);
  await expect(inTime).toContainText("En cours — Marie");
  await expect(inTime).toContainText("TikTok");
  await expect(inTime).toContainText(
    /À réexaminer : réseau injoignable, depuis /,
  );
  await expect(page.locator("main")).not.toContainText(`Maison ${tag}`);
  // the counters and the delay of the queue, in clear; the sort is said (RG62, RG63)
  await expect(
    page.getByText(
      /\d+ entrées? en attente · plus ancienne : .+ · hors délai : \d+ · sans preneur : \d+/,
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      /2 demandes · triée par ancienneté, la plus ancienne d’abord/,
    ),
  ).toBeVisible();
  await expect(page.locator("th[aria-sort=ascending]").first()).toContainText(
    T.columns.submitted,
  );
  // a sort chosen: carried by the address, the column it follows marked
  await page
    .getByLabel(T.filters.sort, { exact: true })
    .selectOption("network");
  await expect(page).toHaveURL(/sort=network/);
  await expect(page.locator("th[aria-sort=ascending]").first()).toContainText(
    T.columns.network,
  );
  // no handle, no figure, no code in a list (RG47)
  const shown = (await page.locator("main").innerText()).toLowerCase();
  expect(shown).not.toMatch(/@|vq_[0-9a-f]{8}|influx-[2-9a-z]{8}/);
  await expectNoAxeViolation(page, "verification queue, creators", {
    wcag22: true,
  });

  // the brands: another screen, another table, nothing of the creators in it, nor their columns
  await page.goto(list("/files/verifications-marques"));
  await expect(
    page.getByRole("heading", { level: 1, name: bo.queue.verification_brands }),
  ).toBeVisible();
  const brands = page.getByRole("region", {
    name: T.brands.tableLabel,
    exact: true,
  });
  await expect(brands).toContainText(`Maison ${tag}`);
  await expect(brands).toContainText("Belgique");
  await expect(
    brands.getByRole("columnheader", { name: T.columns.network }),
  ).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText(late.displayName);
  await expect(
    page.getByRole("heading", { level: 2, name: T.overdueTitle }),
  ).toHaveCount(0);
  await expectNoAxeViolation(page, "verification queue, brands", {
    wcag22: true,
  });

  // a queue in error says so, and an empty one tells when the last request was handled: two states (CA44);
  // « Réessayer » asks again, and the second answer is an empty queue
  const search = "**/api/v1/bo/queues/verification-brands/entries/search";
  await page.route(search, (route) =>
    route.fulfill({ status: 500, contentType: "application/json", body: "{}" }),
  );
  await page.goto(`${BACKOFFICE_ORIGIN}/files/verifications-marques`);
  await expect(page.getByText(bo.queueList.error)).toBeVisible();
  await expect(page.getByText(/^Aucune demande en attente/)).toHaveCount(0);
  await page.unroute(search);
  await page.route(search, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        asOf: new Date().toISOString(),
        items: [],
        nextCursor: null,
      }),
    }),
  );
  await page.getByRole("button", { name: bo.common.retry }).click();
  await expect(page.getByText(/^Aucune demande en attente/)).toBeVisible();
  await expect(page.getByText(bo.queueList.error)).toHaveCount(0);
});

/** The audit lines of one subject, by event type: what the register keeps of a decision (RG84, RG99). */
async function auditLinesOf(
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
function dayBefore(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

test("an agent decides an audience request, from the creator's deposit to the dated badge: the piece opened and logged, nothing pre-filled, the gap only after the typing, a Storage that fails blocks the grant (08 RG43 à RG55, RG83, RG84, CA25, CA27, modele -19)", async ({
  page,
}) => {
  const T = bo.verificationReview;
  const copy = COPY.fr.own;
  const network = COPY.fr.brand.reference.network.instagram;
  const { accountId } = await seedMember(page, {
    role: "creator",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await seedLines(accountId, false);
  const colleague = await seedColleague("agent", "Noa");
  await grantAsAgent(accountId, colleague.accountId);
  await withSql(
    (sql) => sql`
      update profiles.creator_social_accounts
         set followers_count = 86000, posts_last_30_days = 14, avg_comments_per_post = 137
       where account_id = ${accountId} and network_code = 'instagram'`,
  );

  // The creator deposits a real image and sends the request, as commit 19 proved it screen by screen.
  await open(page, `${AUDIENCE.fr}?network=instagram`);
  await page
    .getByRole("button", { name: copy.audience.affirm.continue })
    .click();
  await page.locator("input[type=file]").setInputFiles(EVIDENCE_FIXTURE);
  await expect(page.locator("[data-piece]")).toHaveCount(1);
  await page
    .getByRole("button", { name: copy.audience.deposit.submit })
    .click();
  await expect(
    page.getByRole("main").getByText(copy.audience.sent.body),
  ).toBeVisible();
  const [sent] = await audienceRequestsOf(accountId);
  expect(sent).toMatchObject({ status: "pending", active: 1 });

  // The agent opens it, which takes it in charge: the request, to find the account and never to copy.
  await page.setViewportSize({ width: 1440, height: 900 });
  const agent = await seedInternal(page, "agent", "Lou");
  await page.goto(
    `${BACKOFFICE_ORIGIN}/files/verifications-createurs/${sent!.id}`,
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: new RegExp(`^Vérification ${network} — Audience vérifiée`),
    }),
  ).toBeVisible();
  const main = page.getByRole("main");
  await expect(main).toContainText("camille_cuisine");
  const link = main.getByRole("link", { name: T.profileLink });
  await expect(link).toHaveAttribute(
    "href",
    "https://www.instagram.com/camille_cuisine",
  );
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", /noreferrer/);
  await expect(main.getByText(T.procedure.audience[0]!)).toBeVisible();
  // nothing the creator declared before the typing, nothing of a code, every field empty (CA25)
  const before = await main.innerText();
  expect(before).not.toMatch(/86[\s  ]?000|\b137\b|INFLUX-[2-9A-Z]{8}/);
  expect(
    await main
      .locator('[id^="verification-record-"]')
      .evaluateAll((fields) =>
        fields.map((field) => (field as HTMLInputElement).value),
      ),
  ).toEqual(Array.from({ length: 7 }, () => ""));
  await expect(main.locator("[data-comparison]")).toHaveCount(0);

  // A Storage that does not answer: the cause is written and the grant waits (17b l. 1235, D82 (5)).
  const piece =
    "**/api/v1/bo/queues/verification-creators/entries/*/evidence/*";
  await page.route(piece, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "service_unavailable",
          message: "unavailable",
          details: [{ path: "evidence", issue: "decision_blocked" }],
        },
      }),
    }),
  );
  await page.getByRole("button", { name: T.evidence.open(1, 1) }).click();
  await expect(main.getByText(T.evidence.blocked)).toBeVisible();
  await page.getByRole("button", { name: T.decision.grantAudience }).click();
  await expect(main.getByText(T.evidence.blockedGrant)).toBeVisible();
  await page.unroute(piece);

  // The piece, opened on request: drawn from a blob, one line of the register, never a link nor a download.
  await page.getByRole("button", { name: T.evidence.open(1, 1) }).click();
  const image = main.getByRole("img", { name: T.evidence.alt(1, 1) });
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", /^blob:/);
  // the CSP of the backoffice lets a blob: image through (`img-src 'self' blob:`): the pixels are there
  await expect
    .poll(() =>
      image.evaluate((element) => (element as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(main.getByText(T.evidence.openedLine(1, 1))).toBeVisible();
  await expect(main.locator("a[download], a[href^='blob:']")).toHaveCount(0);
  const viewed = await auditLinesOf(sent!.id, "verification.evidence_viewed");
  expect(viewed).toHaveLength(1);
  expect(viewed[0]?.actor).toBe(agent.accountId);
  await expectNoAxeViolation(page, "verification decision, audience", {
    wcag22: true,
  });

  // What the agent reads, he types; the declared figures and the gap come after, on his request (modele -19).
  await page.getByLabel(T.record.handleAudience).fill("camille_cuisine");
  await page.getByLabel(T.record.followers).fill("47 300");
  await page.getByLabel(T.record.posts).fill("12");
  await page.getByLabel(T.record.comments).fill("85");
  await page
    .getByLabel(T.record.periodStart, { exact: true })
    .fill(dayBefore(30));
  await page.getByLabel(T.record.periodEnd, { exact: true }).fill(dayBefore(2));
  await page.getByRole("button", { name: T.comparison.button }).click();
  const table = main.getByRole("region", { name: T.comparison.tableLabel });
  await expect(table).toContainText(/86[\s  ]000/);
  await expect(table).toContainText(/47[\s  ]300/);
  await expect(table).toContainText(/−\s?38[\s  ]700/);
  await expect(main.getByText(T.comparison.alert(30))).toBeVisible();
  await page.getByLabel(T.record.followers).fill("47 301");
  await expect(main.getByText(T.comparison.stale)).toBeVisible();
  await page.getByLabel(T.record.followers).fill("47 300");

  // Giving the request back with work typed opens a panel, by the button and by «l»: « Garder la demande »
  // and «Échap» close it and nothing typed is lost; the request is still held (L2EU-7).
  const release = main.getByRole("heading", { name: T.release.title });
  await page.getByRole("button", { name: T.decision.release }).click();
  await expect(release).toBeVisible();
  await page.getByRole("button", { name: T.release.keep }).click();
  await expect(release).toHaveCount(0);
  await expect(page.getByLabel(T.record.followers)).toHaveValue("47 300");
  await page.keyboard.press("l");
  await expect(release).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(release).toHaveCount(0);
  await expect(page.getByLabel(T.record.handleAudience)).toHaveValue(
    "camille_cuisine",
  );

  // The grant comes by its recap and never by a key alone; the expiry is announced, and what the badge does not state.
  await expect(main.getByText(T.decision.expiryAudience)).toBeVisible();
  await expect(main.getByText(T.decision.notAffirm)).toBeVisible();
  // a key is never taken from someone typing (RG114): the focus leaves the field first
  await page.getByLabel(T.record.followers).blur();
  await page.keyboard.press("v");
  await expect(
    main.getByRole("heading", { name: T.decision.grantTitle }),
  ).toBeVisible();
  await expect(main).toContainText(/47[\s  ]300 abonnés, 12 publications/);
  expect(await auditLinesOf(sent!.id, "verification.granted")).toHaveLength(0);
  await page.getByRole("button", { name: T.decision.grantConfirm }).click();
  await expect(
    page.getByText(T.decision.grantedNotice("Audience vérifiée", "Instagram")),
  ).toBeVisible();
  const [granted] = await audienceRequestsOf(accountId);
  expect(granted).toMatchObject({ id: sent!.id, status: "approved" });
  const badges = await withSql(
    (sql) => sql<
      { followers: string; handle: string; state: string; by: string }[]
    >`
      select observed_followers::text as followers, observed_handle_at_decision as handle,
             state::text as state, granted_by_account_id::text as by
        from verification.badges
       where account_id = ${accountId} and level = 'audience_verified'`,
  );
  expect(badges).toEqual([
    {
      followers: "47300",
      handle: "camille_cuisine",
      state: "active",
      by: agent.accountId,
    },
  ]);

  // At the creator's: the badge, dated, with its period and its source (RG4, RG5, RG10).
  await open(page, `${AUDIENCE.fr}?network=instagram`);
  const badge = page.locator('[data-badge="audience_verified"]');
  await expect(badge).toContainText(
    new RegExp(
      `Audience vérifiée — ${network}, le \\d{1,2}(er)? \\S+ 20\\d\\d`,
    ),
  );
  await expect(badge).toContainText(`tableau de bord ${network}, période du`);
});

// L2E-23 (06 RG46 à RG52, RG61, RG101, CA28, CA29; 08 RG43; 17b §3.7, §3.11): the decision of a brand's request
// and the registry sources, one case, in French only (the backoffice has no English before D36). The agent
// reads the dossier with no piece, nothing pre-filled, the register to open apart; a code that is not the
// request's is refused by the database, the right one grants « Marque vérifiée ». He reads the sources with
// no button to write; an administrator activates a source « à confirmer » after seeing the former and the new
// value, and the register of the database keeps both.

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** The internal block of the brand and the domain code of its request, as the doors of 0222 leave them. */
async function seedBrandDossier(
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

test("an agent decides a brand's request, then reads the registry sources an administrator keeps: the code compared by the database, the register chosen and never typed, the change shown before it is saved (06 RG46 à RG52, RG101, CA28, CA29)", async ({
  page,
}) => {
  const T = bo.verificationReview;
  const B = T.brand;
  const S = bo.registrySources;
  const tag = runTag("vb");
  await page.setViewportSize({ width: 1440, height: 900 });
  const agent = await seedInternal(page, "agent", "Lou");
  const owner = await seedColleague("agent", "Noa");
  const [seeded] = await seedQueueRequests([
    {
      kind: "brand",
      owner: owner.accountId,
      dueInMinutes: 120,
      name: `Maison ${tag}`,
    },
  ]);
  const { requestId, code, domain } = await seedBrandDossier(seeded!.accountId);

  // The dossier: the trading name, the internal block and the register to open; no piece, no figure, no code.
  await page.goto(
    `${BACKOFFICE_ORIGIN}/files/verifications-marques/${requestId}`,
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: T.titleBrand(`Maison ${tag}`),
    }),
  ).toBeVisible();
  const main = page.getByRole("main");
  await expect(main).toContainText("Maison E2E SRL");
  await expect(main).toContainText("0123.456.789");
  await expect(main).toContainText(domain);
  await expect(main.getByText(B.procedure.never)).toBeVisible();
  await expect(
    main.getByRole("heading", { level: 2, name: T.sections.evidence }),
  ).toHaveCount(0);
  const open = main.getByRole("link", {
    name: B.source.open("e-Justice Portal, Find a company (BRIS)"),
  });
  await expect(open).toHaveAttribute(
    "href",
    /^https:\/\/e-justice\.europa\.eu\//,
  );
  await expect(open).toHaveAttribute("target", "_blank");
  await expect(open).toHaveAttribute("rel", /noreferrer/);
  expect(await main.innerText()).not.toContain(code);
  expect(
    await main
      .locator('input[type="text"]')
      .evaluateAll((fields) =>
        fields.map((field) => (field as HTMLInputElement).value),
      ),
  ).toEqual(["", ""]);
  await expectNoAxeViolation(page, "verification decision, brand", {
    wcag22: true,
  });

  // What he reads, he types. A code that is not the request's is refused by the database (CA28).
  await page.getByLabel(B.record.domain).fill(domain);
  await page.getByLabel(B.record.channels.dns_txt).check();
  await page.getByLabel(B.record.code).fill("INFLUX-AAAAAAAA");
  await page
    .getByLabel(/^e-Justice Portal, Find a company \(BRIS\) — portail/)
    .check();
  await page.getByRole("button", { name: B.decision.grant }).click();
  await page.getByRole("button", { name: T.decision.grantConfirm }).click();
  await expect(main.getByText(B.problems.codeMismatch).first()).toBeVisible();
  expect(await auditLinesOf(requestId, "verification.granted")).toHaveLength(0);

  // The right code: the badge is dated, granted by this agent, from the domain and the register.
  await page.getByLabel(B.record.code).fill(code);
  await page.getByRole("button", { name: T.decision.grantConfirm }).click();
  await expect(
    page.getByText(B.decision.grantedNotice(`Maison ${tag}`)),
  ).toBeVisible();
  const badges = await withSql(
    (sql) => sql<{ state: string; by: string; source: string | null }[]>`
      select b.state::text as state, b.granted_by_account_id::text as by,
             b.evidence_source::text as source
        from verification.badges b
       where b.account_id = ${seeded!.accountId} and b.level = 'brand_verified'`,
  );
  expect(badges).toEqual([
    { state: "active", by: agent.accountId, source: "domain_and_registry" },
  ]);

  // The sources, read by the agent: the ones that wait apart, no button to write (RG101).
  const [gb] = await withSql(
    (sql) => sql<{ id: string; name: string }[]>`
      select id::text, name from verification.registry_sources
       where country_code = 'GB' and source_type = 'national'`,
  );
  await page.goto(`${BACKOFFICE_ORIGIN}/reglages/sources-registre`);
  await expect(
    page.getByRole("heading", { level: 1, name: S.title }),
  ).toBeVisible();
  await expect(main.getByText(S.leadAgent)).toBeVisible();
  const waiting = page.getByRole("region", {
    name: S.tableLabel(S.inactiveTitle),
  });
  await expect(waiting.locator(`[data-source="${gb!.id}"]`)).toContainText(
    S.state.inactive,
  );
  await expect(page.getByRole("button", { name: /^Modifier / })).toHaveCount(0);
  await expectNoAxeViolation(page, "registry sources, agent", { wcag22: true });

  // An administrator activates it after the check by hand: the former and the new value first, then saved.
  try {
    await seedInternal(page, "admin", "Léa");
    await page.goto(`${BACKOFFICE_ORIGIN}/reglages/sources-registre`);
    await expect(main.getByText(S.leadAdmin)).toBeVisible();
    await page.getByRole("button", { name: S.edit(gb!.name) }).click();
    await page.getByLabel(S.fields.active).check();
    await page.getByRole("button", { name: S.review }).click();
    const change = main.locator("[data-change=isActive]");
    await expect(change).toContainText(S.activeWords.no);
    await expect(change).toContainText(S.activeWords.yes);
    // the register keeps what the confirmation writes (lines of earlier runs are not ours: counted before)
    const activations = (lines: { payload: Record<string, unknown> }[]) =>
      lines.filter(
        (line) => (line.payload.after as { is_active: boolean }).is_active,
      ).length;
    const before = await auditLinesOf(
      gb!.id,
      "verification.registry_source_changed",
    );
    await expectNoAxeViolation(page, "registry sources, change to confirm", {
      wcag22: true,
    });
    await page.getByRole("button", { name: S.confirm }).click();
    await expect(page.getByText(S.saved(gb!.name))).toBeVisible();
    const after = await auditLinesOf(
      gb!.id,
      "verification.registry_source_changed",
    );
    expect(after).toHaveLength(before.length + 1);
    expect(activations(after)).toBe(activations(before) + 1);
    await expect(
      page
        .getByRole("region", { name: S.tableLabel(S.activeTitle) })
        .locator(`[data-source="${gb!.id}"]`),
    ).toContainText(S.state.active);
  } finally {
    await withSql(
      (sql) => sql`
        update verification.registry_sources set is_active = false
         where id = ${gb!.id}`,
    );
  }
});

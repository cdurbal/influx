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
// real `Retry-After`, then the badge with its complete date. No agent screen is run here (commits 21 to
// 23), no amount, rate or price anywhere (D78).
import { connectAsMigrationRole } from "@influx/test-kit/db";
import type { Page } from "@playwright/test";
import enBrandProfile from "@/locales/en/brand-profile.json" with { type: "json" };
import enCreatorProfile from "@/locales/en/creator-profile.json" with { type: "json" };
import enVerification from "@/locales/en/verification.json" with { type: "json" };
import frBrandProfile from "@/locales/fr/brand-profile.json" with { type: "json" };
import frCreatorProfile from "@/locales/fr/creator-profile.json" with { type: "json" };
import frVerification from "@/locales/fr/verification.json" with { type: "json" };
import { seedMember } from "./support/account";
import { expectNoAxeViolation } from "./support/axe";
import { retireInternals, seedColleague } from "./support/backoffice";
import { expect, open, test, title } from "./support/journey";
import { WEB_ORIGIN } from "./support/servers";

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

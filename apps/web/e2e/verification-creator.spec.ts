// The proof of ownership and the deposit of an audience's evidence by a creator (docs/mvp/08 RG1 to RG7,
// RG10, RG12, RG19, RG21 to RG24, RG28, RG29, RG31 to RG36, RG56, RG57, RG60, RG85, RG87, RG93, RG95 to
// RG97; 17 §5.3; jalons/l2e, commits 18 and 19; split off `verification.spec.ts` by jalons/l2f, commit 01),
// in French and in English, at 375 and 1 440 px (the widths in a loop on the long screens), against the
// real API and the local stack, and the texts of the locale files, never copies. The journey: the state of
// the line on "mon profil", screen 1 (what the badge states and does not state, BEFORE anything is asked),
// screen 2 (the code the API issued, « Copier »), screen 3 (the request sent), then what only an agent
// does, written by the database as the agent's own door would: a refusal with its reason and the delay
// left, then the badge with its complete date; the audience: the condition written before any button, the
// instructions, a real image sent as raw bytes and a PDF refused without costing the rest, the follow-up,
// a refusal and the badge with its period and its source. No agent screen is run here, no amount, rate or
// price anywhere (D78).
import { seedMember } from "./support/account";
import { retireInternals, seedColleague } from "./support/backoffice";
import { expect, open, reload, test, title } from "./support/journey";
import { WEB_ORIGIN } from "./support/servers";
import {
  disputesOf,
  seedNetworkLine,
  seedRevokedBadge,
  upholdDispute,
  withSql,
} from "./support/verification-cycle";
import {
  accountRow,
  audienceRequestsOf,
  audienceRow,
  AUDIENCE,
  COPY,
  EVIDENCE_FIXTURE,
  expectAxe,
  expectNothingForbidden,
  fixed,
  grantAsAgent,
  grantAudienceAsAgent,
  JOURNEY,
  PDF_REPORT,
  PROFILE,
  refuseAsAgent,
  requestsOf,
  seedLines,
  WIDTHS,
} from "./support/verification";
import enCreatorProfile from "@/locales/en/creator-profile.json" with { type: "json" };
import frCreatorProfile from "@/locales/fr/creator-profile.json" with { type: "json" };

test.afterAll(async () => {
  await retireInternals();
});

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
  await reload(page);
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
  // the code still lives: the one link leads back to it (L2FU-1), never a second request
  await expect(accountRow(page).locator("a")).toHaveCount(1);
  await expect(accountRow(page).locator("a")).toContainText(copy.line.cta.see);

  // The agent refuses for a reason about a piece, which an ownership does not hold (`missing_evidence`
  // leaves no delay, 0222): the sentence reopens the proof, « Redemander » leads back to the first screen,
  // a new draft carries a new code and is sent at once (L2E-25, C1).
  const [first] = await requestsOf(accountId);
  await refuseAsAgent(first!.id, agent.accountId, "missing_evidence");
  await reload(page);
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
  // the target page is on screen before the database is written and the page reloaded (L2FT-1)
  await expect(title(page)).toHaveText(frCreatorProfile.page.title);

  // The agent refuses (the database writes what his door writes): the reason, its text, what to do next,
  // the way to ask again; asked again at once, the delay left is the real Retry-After (RG56, RG57, RG60).
  const [sent] = await requestsOf(accountId);
  await refuseAsAgent(sent!.id, agent.accountId, "ownership_not_proven");
  await reload(page);
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
  await reload(page);
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

test("a creator proves the ownership of a network account in English, from the line to the badge, then appeals a badge withdrawn by INFLUX's own error (08 RG73, RG77, RG93, RG96, RG97, CA52)", async ({
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
  // Another line whose badge INFLUX withdrew by its own error, read at the end of the case (RG73, RG77).
  const badgeId = await withSql(async (sql) => {
    await seedNetworkLine(sql, accountId, "tiktok", "camille_tt");
    return seedRevokedBadge(sql, accountId, agent.accountId, {
      networkCode: "tiktok",
      reason: "influx_error",
      memberMessage: null,
    });
  });

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

  // The withdrawn badge of the other line: its reason with the apologies and no accusation (RG73), the
  // window written, then the contest and its outcome with a motive (RG77, CA52, CA53).
  const withdrawn = page.locator(
    '[data-verification-line="tiktok"] [data-contestable="revocation"]',
  );
  await expect(withdrawn).toContainText(
    copy.verif.revoked.notice.replace(
      "{reason}",
      copy.revocation.reason.influx_error,
    ),
  );
  await expect(withdrawn.locator("[data-appeal-window]")).toHaveText(
    copy.verif.dispute.open,
  );
  await expect(withdrawn).not.toContainText(
    copy.revocation.reason.terms_breach,
  );
  await withdrawn.getByRole("link", { name: copy.appeal.cta }).click();
  await expect(page).toHaveURL(
    new RegExp(`/en/account/profile/verification/appeal\\?badge=${badgeId}$`),
  );
  await expect(title(page)).toHaveText(copy.appeal.title);
  await expect(main.locator('[data-about="revocation"]')).toContainText(
    copy.appeal.about.revocation
      .replace("{badge}", copy.appeal.badgeName.account_verified)
      .replace("{network}", COPY.en.brand.reference.network.tiktok)
      .split("{date}")[0] ?? "",
  );
  await expectAxe(page, "appeal, en", [375]);

  // « Another reason » asks for his own words: nothing is sent without, and the focus goes to the field.
  await main.getByRole("radio", { name: copy.appeal.reason.other }).check();
  await main.getByRole("button", { name: copy.appeal.form.submit }).click();
  await expect(main.getByText(copy.appeal.problem.text)).toBeVisible();
  await expect(page.locator("#appeal-text")).toBeFocused();
  expect(await disputesOf(accountId)).toEqual([]);
  await page
    .locator("#appeal-text")
    .fill("The badge was withdrawn by mistake.");
  await main.getByRole("button", { name: copy.appeal.form.submit }).click();
  await expect(
    page.getByRole("heading", { name: copy.appeal.sent.title }),
  ).toBeVisible();
  expect(await disputesOf(accountId)).toEqual([
    {
      state: "open",
      reason: "other",
      text: "The badge was withdrawn by mistake.",
      kind: "revocation",
    },
  ]);
  await upholdDispute(accountId, agent.accountId);
  await main.getByRole("link", { name: copy.ownership.done.back }).click();
  await expect(
    page.locator(
      '[data-verification-line="tiktok"] [data-outcome="new_request_needed"]',
    ),
  ).toHaveText(copy.appeal.outcome.new_request_needed);
  await expect(page.locator("[data-contestable]")).toHaveCount(0);
});

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
  await reload(page);
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

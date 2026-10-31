// The backoffice v0 in a real browser (J8 commit 10; docs/mvp/05 CA56 to CA63; 03 §1.3 PD1 to
// PD7; 15 RG107; 05 RG116 to RG120; 17b §3.11 to §3.13): the list of the day, the cause in clear,
// the unit and batch replays, the absence of replay for a normal case, two agents on one line,
// the alert of a refused key, the refusals of an agent, the degraded dual control of a single admin
// (its target named, J8S-2, and its line in the weekly review of the home, J8S-1), the invitation
// that makes its author the responsible salesperson, and the exact search and the period filters
// (J8T-7), the term never in the address bar (J8S-7). The rules are apps/api's and the database's
// (T14 files, t8-dual-control-service); here, what only the screens show. J8T-4 (J9 commit 10):
// axe-core, WCAG 2.1 AA, on the list, the record, the Apollo settings with excluded countries
// (0141), the dual control (peer and degraded), the invitations and the "Santé technique" screen.
// CA59 at 250 lines is beyond one page (50 rows at most, 15 RG34): the cap of 200 is t14-backoffice-
// actions-route's; here the batch replay of a selection and its counted report.
// The people are seeded with a session proven by TOTP now (support/backoffice.ts): R holds, no
// password is typed. Serial: the degraded dual control deactivates the other admins for a while, so
// this file never runs beside another that needs an admin (J8T-8; playwright.config.ts).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Browser, Locator, Page } from "@playwright/test";
import { effectiveTokens } from "@influx/test-kit/guards";
import { messages } from "../../backoffice/src/messages/fr";
import { expectNoAxeViolation } from "./support/axe";
import {
  apolloSetting,
  attributionOf,
  closedLine,
  dualControlFacts,
  linesOf,
  onlyAdmin,
  pastTheDelay,
  refusedKeyLines,
  registerLinesBy,
  removeQueueLines,
  restoreAdmins,
  restoreApolloSetting,
  retireInternals,
  runTag,
  seededAddress,
  seedInternal,
  seedSignup,
} from "./support/backoffice";
import {
  AUTH_LABELS,
  expect,
  mailboxAddress,
  open,
  signUpAsCreator,
  test,
} from "./support/journey";
import { focusedElement } from "./support/focus";
import {
  brandGreen,
  computed,
  displayFamily,
  drawnRatio,
  expectGreenGlow,
  expectHeadingTracking,
  expectKeoTypefaces,
  expectNoGlow,
  expectSoftGlow,
  expectStill,
  expectWholeGlow,
  expectZoomAndPress,
  firstFamily,
  glowFacts,
  glowProbe,
  hovered,
  luminance,
  rgbaOf,
  sameColor,
  settled,
  sidewaysFacts,
  tokenColor,
  visibleShadows,
} from "./support/rendering";
import { BACKOFFICE_ORIGIN } from "./support/servers";

const m = messages;

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });

test.afterAll(async () => {
  await restoreAdmins();
  await removeQueueLines();
  await retireInternals();
});

const regionNames = new Intl.DisplayNames(["fr-FR"], { type: "region" });

function country(code: string): string {
  return regionNames.of(code) ?? code;
}

function bo(path: string): string {
  return `${BACKOFFICE_ORIGIN}${path}`;
}

/** A second person on the backoffice: their own browser context, their own session. */
async function otherBrowser(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  return context.newPage();
}

function accountRows(page: Page) {
  return page
    .getByRole("table", { name: m.accounts.title })
    .locator("tbody")
    .getByRole("row");
}

/** Types a term in the search of the list and submits it (RG98; J8S-7: never in the URL). */
async function searchList(page: Page, term: string): Promise<void> {
  await page.getByLabel(m.accounts.search, { exact: true }).fill(term);
  await page.getByRole("button", { name: m.accounts.searchSubmit }).click();
}

/** The list filtered by a partial search on the tag of the seeded addresses (RG98). */
async function openList(page: Page, tag: string): Promise<void> {
  await page.goto(bo("/inscrits"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    m.accounts.title,
  );
  await searchList(page, tag);
  await expect(page.getByText(m.accounts.searchJournaled)).toBeVisible();
  expect(page.url()).not.toContain(tag);
}

/** A local calendar day "YYYY-MM-DD", `daysAgo` days before today (the browser's zone is ours). */
function localDay(daysAgo: number): string {
  const day = new Date();
  day.setDate(day.getDate() - daysAgo);
  const month = String(day.getMonth() + 1).padStart(2, "0");
  return `${day.getFullYear()}-${month}-${String(day.getDate()).padStart(2, "0")}`;
}

test("CA56: ten sign-ups of the day, each with role, country, language, status, consent, Brevo and Apollo", async ({
  page,
}) => {
  const tag = runTag("ca56");
  const seeded: {
    role: "advertiser" | "creator";
    countryCode: string;
    language: "fr" | "en";
    consent: boolean;
  }[] = [];
  for (let index = 0; index < 10; index += 1) {
    const spec = {
      role: index % 2 === 0 ? ("creator" as const) : ("advertiser" as const),
      countryCode: ["FR", "BE", "DE", "ES", "IT"][index % 5] ?? "FR",
      language: index % 3 === 0 ? ("en" as const) : ("fr" as const),
      consent: index % 4 !== 0,
    };
    seeded.push(spec);
    await seedSignup({ tag, ...spec });
  }
  await seedInternal(page, "agent", "Camille");

  await openList(page, tag);
  const rows = accountRows(page);
  await expect(rows).toHaveCount(10);
  // RG97: no address in the list, not even the tag of the seeded ones.
  await expect(
    page.getByRole("table", { name: m.accounts.title }),
  ).not.toContainText("@");
  // Newest first: the last seeded is the first row.
  for (const [index, spec] of [...seeded].reverse().entries()) {
    const cells = rows.nth(index).getByRole("cell");
    await expect(cells.nth(2)).toContainText(m.roles[spec.role]);
    await expect(cells.nth(3)).toHaveText(country(spec.countryCode));
    await expect(cells.nth(4)).toHaveText(m.languages[spec.language]);
    await expect(cells.nth(5)).toHaveText(
      m.declaredStatus[spec.role === "advertiser" ? "business" : "individual"],
    );
    await expect(cells.nth(6)).toHaveText(
      spec.consent ? m.accounts.consentGranted : m.accounts.consentWithdrawn,
    );
    for (const column of [8, 9]) {
      await expect(cells.nth(column)).toContainText(m.syncState.not_attempted);
      await expect(cells.nth(column)).toContainText(m.syncCause.not_attempted);
    }
  }
  // RG106: no export, said on the screen, no gesture for it.
  await expect(page.getByText(m.accounts.noExport)).toBeVisible();
  await expect(page.getByRole("button", { name: /export/i })).toHaveCount(0);
});

test("CA57 to CA60: the cause in clear, a unit replay, a batch replay, and no replay for a normal case", async ({
  page,
}) => {
  const tag = runTag("lot");
  const unit = await seedSignup({
    tag,
    role: "creator",
    countryCode: "FR",
    language: "fr",
    consent: true,
  });
  await closedLine(unit, "brevo_contact", {
    status: "failed",
    errorCode: "brevo.unavailable",
  });
  const first = await seedSignup({
    tag,
    role: "advertiser",
    countryCode: "BE",
    language: "fr",
    consent: true,
  });
  await closedLine(first, "brevo_contact", {
    status: "failed",
    errorCode: "brevo.rejected",
  });
  await closedLine(first, "apollo_contact", {
    status: "failed",
    errorCode: "apollo.rate_limited",
  });
  const second = await seedSignup({
    tag,
    role: "advertiser",
    countryCode: "DE",
    language: "en",
    consent: true,
  });
  await closedLine(second, "apollo_contact", {
    status: "failed",
    errorCode: "apollo.unreachable",
  });
  const normal = await seedSignup({
    tag,
    role: "creator",
    countryCode: "ES",
    language: "fr",
    consent: false,
  });
  await closedLine(normal, "brevo_contact", {
    status: "skipped",
    skipReason: "no_consent",
  });
  const agent = await seedInternal(page, "agent", "Sacha");

  // CA57: the cause in French, never the raw code.
  await openList(page, tag);
  const rows = accountRows(page);
  await expect(rows).toHaveCount(4);
  const unitRow = rows.filter({ hasText: country("FR") });
  await expect(unitRow).toContainText(m.syncState.failed);
  await expect(unitRow).toContainText(m.syncCause.service_unavailable);
  await expect(page.locator("main")).not.toContainText("brevo.");
  await expect(page.locator("main")).not.toContainText("unavailable");

  // CA60: the normal case has no box; its record says why, with no replay.
  const normalRow = rows.filter({ hasText: country("ES") });
  await expect(normalRow).toContainText(m.syncCause.no_consent);
  await expect(normalRow.getByRole("checkbox")).toHaveCount(0);

  // CA59: a selection replayed in one batch, summed up before, counted after.
  await rows
    .filter({ hasText: country("BE") })
    .getByRole("checkbox")
    .check();
  await rows
    .filter({ hasText: country("DE") })
    .getByRole("checkbox")
    .check();
  await expect(page.getByText(m.replay.selection(3, 200))).toBeVisible();
  await page.getByRole("button", { name: m.replay.open(3) }).click();
  const panel = page.getByRole("region", { name: m.replay.title });
  await expect(panel).toContainText(m.replay.preview(3, 2));
  await panel
    .getByLabel(m.common.reason)
    .selectOption({ label: m.replay.reasons.provider_recovered });
  await panel.getByRole("button", { name: m.replay.confirm }).click();
  await expect(panel.getByRole("status")).toHaveText(
    m.replay.report(3, 3, 0, 0),
  );
  await panel.getByRole("button", { name: m.replay.close }).click();

  // CA60 on the record.
  await normalRow.getByRole("link", { name: m.accounts.openRecord }).click();
  await expect(page.getByText(m.account.journaled)).toBeVisible();
  const normalSync = page.getByRole("region", { name: m.account.sync });
  await expect(normalSync).toContainText(m.account.noReplay);
  await expect(normalSync.getByRole("button", { name: /Rejouer/ })).toHaveCount(
    0,
  );

  // CA57, CA58: the unit replay from the record, journaled with the agent, no duplicate.
  const [before] = await linesOf(unit);
  await page.goto(bo(`/inscrits/${unit}`));
  const sync = page.getByRole("region", { name: m.account.sync });
  await expect(sync).toContainText(m.syncCause.service_unavailable);
  await sync
    .getByRole("button", { name: m.replay.unit(m.destinations.brevo) })
    .click();
  const unitPanel = page.getByRole("region", { name: m.replay.title });
  await unitPanel
    .getByLabel(m.common.reason)
    .selectOption({ label: m.replay.reasons.transient_failure });
  await unitPanel.getByRole("button", { name: m.replay.confirm }).click();
  await expect(unitPanel.getByRole("status")).toHaveText(
    m.replay.report(1, 1, 0, 0),
  );
  const after = await linesOf(unit);
  expect(after).toHaveLength(1);
  expect(after[0]).toMatchObject({
    status: "pending",
    attempts: 0,
    idempotencyKey: before?.idempotencyKey,
  });
  const journal = await registerLinesBy(
    "leads.replay_requested",
    agent.accountId,
  );
  expect(journal).toHaveLength(2);
  expect(journal.at(-1)?.payload).toMatchObject({
    reason_code: "transient_failure",
    requeued: 1,
  });
});

test("CA61: two agents replay the same line at once; one requeues it, the other is told it is in progress", async ({
  page,
  browser,
}) => {
  const tag = runTag("ca61");
  const member = await seedSignup({
    tag,
    role: "creator",
    countryCode: "FR",
    language: "fr",
    consent: true,
  });
  await closedLine(member, "brevo_contact", {
    status: "failed",
    errorCode: "brevo.unavailable",
  });
  const other = await otherBrowser(browser);
  await seedInternal(page, "agent", "Alex");
  await seedInternal(other, "agent", "Noa");

  const panels = [];
  for (const screen of [page, other]) {
    await screen.goto(bo(`/inscrits/${member}`));
    await screen
      .getByRole("region", { name: m.account.sync })
      .getByRole("button", { name: m.replay.unit(m.destinations.brevo) })
      .click();
    const panel = screen.getByRole("region", { name: m.replay.title });
    await panel
      .getByLabel(m.common.reason)
      .selectOption({ label: m.replay.reasons.provider_recovered });
    panels.push(panel);
  }
  await Promise.all(
    panels.map((panel) =>
      panel.getByRole("button", { name: m.replay.confirm }).click(),
    ),
  );
  const reports = await Promise.all(
    panels.map(async (panel) => {
      await expect(panel.getByRole("status")).toBeVisible();
      return (await panel.getByRole("listitem").textContent()) ?? "";
    }),
  );
  const line = (outcome: string) =>
    m.replay.outcomeLine(m.destinations.brevo, outcome);
  expect(reports.sort()).toEqual(
    [
      line(m.replay.outcome.requeued),
      line(m.replay.outcome.already_in_progress),
    ].sort(),
  );
  expect(await linesOf(member)).toHaveLength(1);
  await other.context().close();
});

test("CA62: a refused Apollo key raises a visible alert for the admin, with the lines waiting", async ({
  page,
}) => {
  const member = await seedSignup({
    tag: runTag("ca62"),
    role: "advertiser",
    countryCode: "FR",
    language: "fr",
    consent: true,
  });
  await refusedKeyLines(member, "apollo_contact", 3, 20);
  await seedInternal(page, "admin", "Lou");

  await page.goto(bo("/accueil"));
  const alerts = page.getByRole("region", { name: m.home.alertsTitle });
  const alert = alerts.getByRole("listitem").filter({
    hasText: "Alerte AL25 — La clé d’accès Apollo est refusée.",
  });
  await expect(alert).toHaveCount(1);
  const waiting = Number(
    /(\d+) envois? en attente/.exec((await alert.textContent()) ?? "")?.[1],
  );
  expect(waiting).toBeGreaterThanOrEqual(3);
});

test("CA63: an agent sees no Apollo setting, is refused on its address, and the attempt is journaled", async ({
  page,
}) => {
  const agent = await seedInternal(page, "agent", "Eden");
  await page.goto(bo("/accueil"));
  const nav = page.getByRole("navigation", { name: m.nav.label });
  await expect(nav.getByRole("link", { name: m.nav.accounts })).toBeVisible();
  for (const adminOnly of [
    m.nav.apollo,
    m.nav.dualControl,
    m.nav.internalAccounts,
  ]) {
    await expect(nav.getByRole("link", { name: adminOnly })).toHaveCount(0);
  }

  await page.goto(bo("/reglages/apollo"));
  await expect(
    page.getByRole("alert").filter({ hasText: m.failure.forbidden }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: m.apollo.change })).toHaveCount(
    0,
  );
  await expect
    .poll(async () =>
      (await registerLinesBy("backoffice.action_refused", agent.accountId)).map(
        (line) => line.payload.action_code,
      ),
    )
    .toContain("leads.read_apollo_settings");
});

test("J8T-4: the screens of an admin pass axe (WCAG 2.1 AA), Apollo with its excluded countries", async ({
  page,
}) => {
  const tag = runTag("axe");
  const member = await seedSignup({
    tag,
    role: "advertiser",
    countryCode: "BE",
    language: "fr",
    consent: true,
  });
  await closedLine(member, "apollo_contact", {
    status: "failed",
    errorCode: "apollo.unavailable",
  });
  await seedInternal(page, "admin", "Maé");
  const excludedBefore = await apolloSetting("apollo_excluded_countries");
  try {
    await openList(page, tag);
    await expect(accountRows(page)).toHaveCount(1);
    await expectNoAxeViolation(page, "liste des inscrits");

    await page.goto(bo(`/inscrits/${member}`));
    await expect(page.getByText(m.account.journaled)).toBeVisible();
    await expectNoAxeViolation(page, "fiche d’inscrit");

    // 0141: a block-list, here with two countries, named in words.
    await restoreApolloSetting("apollo_excluded_countries", ["DE", "IT"]);
    await page.goto(bo("/reglages/apollo"));
    const exclusions = page.getByRole("form", { name: m.apollo.countries });
    await expect(exclusions).toContainText(
      m.apollo.settingLine(
        m.apollo.countries,
        `${country("DE")}, ${country("IT")}`,
      ),
    );
    await expect(exclusions.getByLabel(m.apollo.countries)).toHaveValue(
      "DE IT",
    );
    await expectNoAxeViolation(page, "réglages Apollo");

    // The dual control of a change of the list: its own screen (PD2), then abandoned.
    await exclusions.getByLabel(m.apollo.countries).fill("DE IT ES");
    await exclusions
      .getByLabel(m.common.reason)
      .selectOption({ label: m.apollo.reasons.legal_restriction });
    await exclusions.getByRole("button", { name: m.apollo.change }).click();
    await expect(page).toHaveURL(/\/double-validation\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      m.dualControl.requestTitle,
    );
    await expectNoAxeViolation(page, "double validation");
    await page.getByRole("button", { name: m.dualControl.refuse }).click();
    await expect(
      page.getByRole("status").filter({ hasText: m.dualControl.cancelled }),
    ).toBeVisible();

    await page.goto(bo("/invitations"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      m.invitations.memberTitle,
    );
    // An invitation of its own, so that the table shows on any base (D76: the journeys no longer
    // run after the database tests, whose invitations this check used to rely on).
    const invite = page.getByRole("form", { name: m.invitations.create });
    await invite
      .getByLabel(m.invitations.email)
      .fill(`${tag}-invited@example.test`);
    await invite
      .getByLabel(m.invitations.proposedRole)
      .selectOption({ label: m.roles.advertiser });
    await invite
      .getByLabel(m.invitations.language)
      .selectOption({ label: m.languages.fr });
    await invite.getByRole("button", { name: m.invitations.create }).click();
    await expect(invite.getByText(m.invitations.linkOnce)).toBeVisible();
    await expect(
      page.getByRole("table", { name: m.invitations.listTitle }),
    ).toBeVisible();
    await expectNoAxeViolation(page, "invitations de membres");

    // J9S-7: a browser error group whose text is a member's free text (a link, markup): shown as
    // "source navigateur, texte non vérifié", inert text, never a link. The answer is stubbed
    // (no member's browser writes into the database of the run).
    const hostile =
      'Click <a href="https://evil.example/x">here</a> https://evil.example/y';
    const hostileGroup = {
      id: "6f1c1c6e-2d57-4a43-9d0e-5b9f6a7d3c11",
      source: "browser",
      service: "web",
      errorType: "TypeError",
      message: hostile,
      route: null,
      status: "new",
      occurrenceCount: 1,
      regressionCount: 0,
      firstSeenAt: "2026-10-31T10:00:00.000Z",
      lastSeenAt: "2026-10-31T10:00:00.000Z",
      lastRegressedAt: null,
      firstVersion: "1.0.0",
      lastVersion: "1.0.0",
      regression: false,
    };
    await page.route("**/api/v1/bo/ops/errors/*", (route) =>
      route.fulfill({
        json: {
          group: hostileGroup,
          occurrences: [
            {
              occurredAt: "2026-10-31T10:00:00.000Z",
              service: "web",
              version: "1.0.0",
              route: null,
              requestId: null,
              accountId: null,
              message: hostile,
              stack: null,
              userAgentSummary: null,
            },
          ],
        },
      }),
    );
    await page.route(/\/api\/v1\/bo\/ops\/errors\?/, (route) =>
      route.fulfill({
        json: {
          state: "open",
          source: null,
          counts: {
            new: 1,
            acknowledged: 0,
            fixed: 0,
            ignored: 0,
            regression: 0,
          },
          groups: [hostileGroup],
          truncated: false,
        },
      }),
    );

    await page.goto(bo("/sante-technique"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      m.health.title,
    );
    await expect(page.getByText(m.health.loading)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: m.health.availability.title }),
    ).toBeVisible();
    const errorRow = page.getByRole("row", { name: /TypeError/ });
    await expect(errorRow).toContainText(m.health.errors.unverified);
    await expect(errorRow).toContainText(hostile);
    await errorRow.getByRole("button", { name: m.health.errors.show }).click();
    const occurrences = page
      .getByRole("region", {
        name: m.health.errors.detailTitle("TypeError"),
      })
      .first();
    await expect(occurrences).toContainText(m.health.errors.unverified);
    await expect(occurrences).toContainText(hostile);
    await expect(
      page.locator("main a[href*='evil.example'], main a:has-text('here')"),
    ).toHaveCount(0);
    await expectNoAxeViolation(page, "santé technique");
  } finally {
    await restoreApolloSetting("apollo_excluded_countries", excludedBefore);
  }
});

test("PD1 to PD7: a single admin confirms alone, after 60 s and in writing, under the weakened-control banner", async ({
  page,
}) => {
  const creator = await seedSignup({
    tag: runTag("pd"),
    role: "creator",
    countryCode: "FR",
    language: "fr",
    consent: true,
  });
  const admin = await seedInternal(page, "admin", "Ilan");
  try {
    await onlyAdmin(admin.accountId);

    // RG107: the permanent banner while there is no second admin.
    await page.goto(bo(`/inscrits/${creator}`));
    await expect(
      page.getByRole("status").filter({ hasText: m.peerControlBanner }),
    ).toBeVisible();
    const form = page.getByRole("form", { name: m.account.roleChange });
    await form.getByLabel(m.account.legalName).fill("Atelier Ilan");
    await form
      .getByLabel(m.common.reason)
      .selectOption({ label: m.account.roleChangeReasons.member_request });
    await form
      .getByRole("button", { name: m.account.requestDualControl })
      .click();

    // PD2: the distinct screen, the word "affaibli", the countdown, the button held.
    await expect(page).toHaveURL(/\/double-validation\/[0-9a-f-]{36}$/);
    const requestId = page.url().split("/").at(-1) ?? "";
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      m.dualControl.requestTitle,
    );
    await expect(
      page.getByRole("status").filter({ hasText: m.dualControl.degraded }),
    ).toBeVisible();
    await expect(
      page.getByText(/Confirmation possible dans \d+ s\./),
    ).toBeVisible();
    const confirm = page.getByRole("button", { name: m.dualControl.confirm });
    await expect(confirm).toHaveAttribute("aria-disabled", "true");
    await expectNoAxeViolation(page, "double validation en mode différé");
    await expect(page.getByText("Atelier Ilan")).toBeVisible();
    // J8S-2 (PD1): the account is named by role, country and sign-up, never by an identifier.
    await expect(
      page.getByText(
        m.dualControl.target.member(
          m.roles.creator,
          country("FR"),
          new Intl.DateTimeFormat("fr-FR", { dateStyle: "short" }).format(
            new Date(),
          ),
        ),
      ),
    ).toBeVisible();
    await expect(page.locator("main")).not.toContainText(creator);

    // Past the 60 s (moved back in the base, the database counts): a justification is required.
    await pastTheDelay(requestId);
    // The page opened after the delay (a count of 0 from apps/api) lets the admin confirm.
    await page.reload();
    await expect(page.getByText(m.dualControl.countdown(0))).toBeVisible();
    await page.getByRole("button", { name: m.dualControl.confirm }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: m.dualControl.justificationInvalid(20) }),
    ).toBeVisible();
    await page
      .getByLabel(/^Justification écrite/)
      .fill("Seul administrateur au lancement, demande du membre vérifiée.");
    await page.getByRole("button", { name: m.dualControl.confirm }).click();
    await expect(
      page.getByRole("status").filter({ hasText: m.dualControl.done(true) }),
    ).toBeVisible();
    expect(await dualControlFacts(requestId)).toEqual({
      state: "degraded",
      degraded: true,
      justified: true,
    });

    // The member is now a brand.
    await page.goto(bo(`/inscrits/${creator}`));
    await expect(
      page.getByRole("region", { name: m.account.identity }),
    ).toContainText(m.roles.advertiser);

    // J8S-1 (PD6): the confirmation made alone is in the weekly review of the home.
    await page.goto(bo("/accueil"));
    const review = page.getByRole("region", {
      name: m.home.degraded.title,
    });
    const line = review.getByRole("listitem").filter({
      has: page.locator(`a[href="/double-validation/${requestId}"]`),
    });
    await expect(line).toContainText(
      m.dualControl.actions["identity.change_member_role"] ?? "",
    );
    await expect(line).toContainText("demandée par Ilan");
  } finally {
    await restoreAdmins();
  }
});

test("J8T-7: the exact search finds one address, the period filters narrow the list; no term in the address bar", async ({
  page,
}) => {
  const tag = runTag("j8t7");
  await seedSignup({
    tag,
    role: "creator",
    countryCode: "FR",
    language: "fr",
    consent: true,
  });
  const older = await seedSignup({
    tag,
    role: "advertiser",
    countryCode: "BE",
    language: "fr",
    consent: true,
    daysAgo: 3,
  });
  await seedInternal(page, "agent", "Noa");
  await page.goto(bo("/inscrits"));

  // RG98: a whole address is the exact search, free and said so; the address stays out of the URL.
  const address = seededAddress(tag, older);
  await searchList(page, address.toUpperCase());
  await expect(page.getByText(m.accounts.searchExact)).toBeVisible();
  const rows = accountRows(page);
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByRole("cell").nth(3)).toHaveText(country("BE"));
  expect(page.url()).not.toContain("@");
  expect(page.url()).not.toContain(tag);

  // The partial search of the tag, then the period (RG97), the term kept in the screen only.
  await searchList(page, tag);
  await expect(page.getByText(m.accounts.searchJournaled)).toBeVisible();
  await expect(rows).toHaveCount(2);
  await page
    .getByLabel(m.accounts.periodFrom, { exact: true })
    .fill(localDay(1));
  await expect(page).toHaveURL(new RegExp(`from=${localDay(1)}`));
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByRole("cell").nth(3)).toHaveText(country("FR"));
  await page.getByLabel(m.accounts.periodFrom, { exact: true }).fill("");
  await page.getByLabel(m.accounts.periodTo, { exact: true }).fill(localDay(2));
  await expect(rows).toHaveCount(1);
  await expect(rows.first().getByRole("cell").nth(3)).toHaveText(country("BE"));
  // A period that ends before it starts is said, never sent.
  await page
    .getByLabel(m.accounts.periodFrom, { exact: true })
    .fill(localDay(0));
  await expect(
    page.getByRole("alert").filter({ hasText: m.accounts.periodInvalid }),
  ).toBeVisible();
  expect(page.url()).not.toContain(tag);
});

test("D54, RG119: the invitation of an agent makes them the responsible salesperson of the account created", async ({
  page,
  browser,
}) => {
  const address = mailboxAddress("bo-invited-member");
  const backoffice = await otherBrowser(browser);
  const agent = await seedInternal(backoffice, "agent", "Morgane");

  await backoffice.goto(bo("/invitations"));
  await expect(backoffice.getByRole("heading", { level: 1 })).toHaveText(
    m.invitations.memberTitle,
  );
  const form = backoffice.getByRole("form", { name: m.invitations.create });
  await form.getByLabel(m.invitations.email).fill(address);
  await form
    .getByLabel(m.invitations.proposedRole)
    .selectOption({ label: m.roles.creator });
  await form
    .getByLabel(m.invitations.language)
    .selectOption({ label: m.languages.fr });
  await form.getByRole("button", { name: m.invitations.create }).click();
  await expect(form.getByText(m.invitations.linkOnce)).toBeVisible();
  const link =
    (await form.getByText(/#invitation=/).textContent())?.trim() ?? "";
  expect(link).toMatch(/\/fr\/inscription\/createur#invitation=[\w-]+$/);

  // The person opens the link and signs up through the screens.
  await open(page, link);
  await signUpAsCreator(page, AUTH_LABELS.fr, address);

  const attribution = await attributionOf(address);
  expect(attribution).toMatchObject({
    ownerAgentId: agent.accountId,
    invitationRedeemed: true,
  });
  expect(
    attribution?.assignments.map((assignment) => assignment.agentAccountId),
  ).toEqual([agent.accountId]);

  // The backoffice says it: the invitation used, the source and the responsible salesperson.
  await backoffice.reload();
  await expect(
    backoffice
      .getByRole("table", { name: m.invitations.listTitle })
      .getByRole("row")
      .filter({ hasText: address }),
  ).toContainText(m.invitations.memberStates.redeemed);
  await openList(backoffice, address.split("@")[0] ?? "");
  const row = accountRows(backoffice);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(m.accounts.sourceInvitation);
  await expect(row).toContainText("Morgane");
  await backoffice.context().close();
});

// DS-10 (D73; 18 §12.1 TD6.1 to TD6.4; 17b §1.4, §1.7; 02 §21.5 point 8): the shell of the backoffice,
// mounted once by (app)/layout.tsx. The breakpoints are read in the tokens (18 §12.5 point 5): md and
// lg in tokens.css (packages/ui), the height of the window too small in the bo-small variant of
// tokens-backoffice.css.
const BACKOFFICE_STYLES = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "backoffice",
  "src",
  "styles",
);
const BREAKPOINTS = effectiveTokens(
  readFileSync(
    path.join(
      BACKOFFICE_STYLES,
      "..",
      "..",
      "..",
      "..",
      "packages",
      "ui",
      "src",
      "styles",
      "tokens.css",
    ),
    "utf8",
  ),
  "keo",
);
const MD = parseInt(BREAKPOINTS.get("--breakpoint-md") ?? "", 10);
const LG = parseInt(BREAKPOINTS.get("--breakpoint-lg") ?? "", 10);
const MIN_HEIGHT = parseInt(
  /\(height < (\d+)px\)/.exec(
    readFileSync(path.join(BACKOFFICE_STYLES, "tokens-backoffice.css"), "utf8"),
  )?.[1] ?? "",
  10,
);

/** The environment word of the band, whichever the run is (16 RG118). */
const ENVIRONMENT_WORD = new RegExp(
  Object.values(m.shell.environment).join("|"),
);

function mainNavigation(page: Page) {
  return page.getByRole("navigation", { name: m.nav.label });
}

/** Whether the page scrolls sideways (never: a wide table scrolls in its own region). */
function pageScrollsSideways(page: Page): Promise<boolean> {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
}

test("TD6.1: one main navigation, no admin entry for an agent, the skip link first, the focus on the h1 after a navigation", async ({
  page,
}) => {
  expect([MD, LG, MIN_HEIGHT].every(Number.isFinite)).toBe(true);
  await seedInternal(page, "agent", "Elio");
  await page.goto(bo("/accueil"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    m.home.title,
  );
  await expect(page.getByRole("navigation")).toHaveCount(1);
  const nav = mainNavigation(page);
  await expect(nav.getByRole("link")).toHaveText([
    m.nav.dashboard,
    m.nav.accounts,
  ]);
  await expect(nav.getByRole("link", { name: m.nav.admin })).toHaveCount(0);
  await expect(nav.locator("[aria-current=page]")).toHaveText(m.nav.dashboard);

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: m.nav.skip })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();

  // A client navigation: the rail stays, the focus goes to the h1 of the new page.
  await nav.getByRole("link", { name: m.nav.accounts }).click();
  await expect(page).toHaveURL(bo("/inscrits"));
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(m.accounts.title);
  await expect(heading).toBeFocused();
  // The screens of the entry, as its sub-entries in the same <nav> (D74): the screen is current.
  await expect(page.getByRole("navigation")).toHaveCount(1);
  await expect(nav.locator("[aria-current=page]")).toHaveText(m.nav.signups);
  await expect(nav.getByRole("link")).toHaveText([
    m.nav.dashboard,
    m.nav.accounts,
    m.nav.signups,
    m.nav.memberInvitations,
  ]);
});

test("TD6.2: the rail from lg, the compact list from md, the workstation screen below md or below 500 px high", async ({
  page,
}) => {
  await seedInternal(page, "admin", "Rémi");
  await page.goto(bo("/inscrits"));
  const table = page.getByRole("table", { name: m.accounts.title });
  await expect(table).toBeVisible();
  const nav = mainNavigation(page);
  const workstation = page.getByRole("heading", {
    level: 1,
    name: m.shell.workstationOnly.title,
  });

  // From lg: the rail at the left edge, from the top of the window.
  for (const width of [LG, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(nav.getByRole("link")).toHaveText([
      m.nav.dashboard,
      m.nav.accounts,
      m.nav.signups,
      m.nav.memberInvitations,
      m.nav.admin,
    ]);
    const box = await nav.boundingBox();
    const main = await page.locator("#main").boundingBox();
    expect(box?.x ?? Infinity).toBeLessThan(main?.x ?? 0);
    await expect(workstation).toHaveCount(0);
  }

  // From md to lg: the same single <nav>, a horizontal list under the band, every link reachable.
  for (const width of [MD, LG - 1]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(mainNavigation(page)).toHaveCount(1);
    // The entries and the sub-entries of Comptes, every one in the window (its lines: TN7).
    const links = nav.getByRole("link");
    await expect(links).toHaveCount(5);
    for (const link of await links.all()) {
      await expect(link).toBeInViewport();
    }
    const band = await page.locator("header").first().boundingBox();
    const box = await nav.boundingBox();
    expect(box?.y ?? 0).toBeGreaterThanOrEqual(
      (band?.y ?? 0) + (band?.height ?? 0) - 1,
    );
    await expect(table).toBeVisible();
    await expect(workstation).toHaveCount(0);
    expect(await pageScrollsSideways(page)).toBe(false);
  }

  // Below md wide, or below 500 px high (a phone held sideways): no business content at all.
  for (const [width, height] of [
    [MD - 1, 900],
    [375, 812],
    [LG, MIN_HEIGHT - 1],
    [844, 390],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect(workstation).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("table")).toHaveCount(0);
    await expect(
      page.getByRole("heading", { level: 1, name: m.accounts.title }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: m.shell.signOut }),
    ).toBeVisible();
    await expect(page.locator("body")).toContainText(ENVIRONMENT_WORD);
    expect(await pageScrollsSideways(page)).toBe(false);
  }

  // Exactly 500 px high: the whole backoffice.
  await page.setViewportSize({ width: LG, height: MIN_HEIGHT });
  await expect(workstation).toHaveCount(0);
  await expect(table).toBeVisible();
});

/** The links of the sub-menu nested in the <li> of `entry` (D74). */
function subEntriesIn(page: Page, entry: string) {
  return mainNavigation(page)
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name: entry, exact: true }) })
    .getByRole("list")
    .getByRole("link");
}

/** The widths of the matrix of sn-fiche (critère de fin, ligne 7). */
const SN_WIDTHS = [320, 375, 768, 1024, 1440] as const;

test("TN7: the screens of the active entry as sub-entries of the rail, a second line at 900 px, one landmark and one aria-current (D74)", async ({
  page,
}) => {
  await seedInternal(page, "admin", "Noé");
  const record = await seedSignup({
    tag: runTag("tn7"),
    role: "creator",
    countryCode: "FR",
    language: "fr",
    consent: true,
  });
  const nav = mainNavigation(page);
  const current = page.locator("[aria-current]");

  // 1 440 px: Comptes on its list and on a record, Inscrits current; then Administration.
  for (const address of ["/inscrits", `/inscrits/${record}`]) {
    await page.goto(bo(address));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(1);
    await expect(subEntriesIn(page, m.nav.accounts)).toHaveText([
      m.nav.signups,
      m.nav.memberInvitations,
    ]);
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText(m.nav.signups);
    await expect(
      nav.getByRole("link", { name: m.nav.accounts, exact: true }),
    ).not.toHaveAttribute("aria-current");
  }
  await page.goto(bo("/reglages/apollo"));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(subEntriesIn(page, m.nav.admin)).toHaveText([
    m.nav.dualControl,
    m.nav.internalAccounts,
    m.nav.apollo,
    m.nav.health,
  ]);
  await expect(nav.getByRole("link", { name: m.nav.signups })).toHaveCount(0);
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText(m.nav.apollo);

  // 900 px: Comptes and its sub-entries on a line of their own, at their place, never scrolling.
  await page.goto(bo("/inscrits"));
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(
    page.getByRole("table", { name: m.accounts.title }),
  ).toBeVisible();
  const topOf = async (name: string): Promise<number> =>
    (await nav.getByRole("link", { name, exact: true }).boundingBox())?.y ??
    NaN;
  const dashboardTop = await topOf(m.nav.dashboard);
  const accountsTop = await topOf(m.nav.accounts);
  expect(accountsTop).toBeGreaterThan(dashboardTop);
  expect(await topOf(m.nav.signups)).toBeGreaterThanOrEqual(accountsTop - 1);
  expect(await topOf(m.nav.admin)).toBeGreaterThan(accountsTop);
  for (const link of await nav.getByRole("link").all()) {
    await expect(link).toBeInViewport();
  }
  expect(await pageScrollsSideways(page)).toBe(false);
  await expect(current).toHaveCount(1);

  // One landmark from md, none on the "poste de travail" screen (F7, unchanged).
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole("navigation")).toHaveCount(width < MD ? 0 : 1);
    await expect(page.locator("[aria-current]:visible")).toHaveCount(
      width < MD ? 0 : 1,
    );
  }
});

test("TN8: two screens with a sub-menu pass axe (WCAG 2.1 and 2.2 AA) at the five widths of the matrix", async ({
  page,
}) => {
  await seedInternal(page, "admin", "Lou");
  for (const [address, screen] of [
    ["/inscrits", "inscrits"],
    ["/double-validation", "doubles validations"],
  ] as const) {
    await page.goto(bo(address));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    for (const width of SN_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await pageScrollsSideways(page)).toBe(false);
      await expectNoAxeViolation(page, `${screen} à ${String(width)} px`, {
        wcag22: true,
      });
    }
  }
});

test("TD6.3: the banners are read again at each client navigation; the environment is always written", async ({
  page,
  browser,
}) => {
  const other = await otherBrowser(browser);
  await seedInternal(other, "admin", "Yaël");
  const admin = await seedInternal(page, "admin", "Sami");
  try {
    await page.goto(bo("/accueil"));
    const band = page.locator("header").first();
    await expect(band).toContainText(ENVIRONMENT_WORD);
    await expect(
      page.getByRole("status").filter({ hasText: m.peerControlBanner }),
    ).toHaveCount(0);

    // The other admins leave; the next click shows the banner, without a reload.
    await onlyAdmin(admin.accountId);
    await page.evaluate(() => {
      (window as unknown as { stayed: boolean }).stayed = true;
    });
    await mainNavigation(page)
      .getByRole("link", { name: m.nav.accounts })
      .click();
    await expect(page).toHaveURL(bo("/inscrits"));
    await expect(
      page.getByRole("status").filter({ hasText: m.peerControlBanner }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as unknown as { stayed?: boolean }).stayed,
      ),
    ).toBe(true);
    await expect(band).toContainText(ENVIRONMENT_WORD);
  } finally {
    await restoreAdmins();
    await other.context().close();
  }
});

test("TD6.4: without a session a click goes to sign-in; after sign-out, the signed-out screen, its h1 focused, no navigation", async ({
  page,
}) => {
  await seedInternal(page, "agent", "Jade");
  await page.goto(bo("/accueil"));
  await expect(mainNavigation(page)).toBeVisible();
  await page.context().clearCookies();
  await mainNavigation(page)
    .getByRole("link", { name: m.nav.accounts })
    .click();
  await expect(page).toHaveURL(bo("/"));

  await seedInternal(page, "agent", "Jade");
  await page.goto(bo("/accueil"));
  await page.getByRole("button", { name: m.shell.signOut }).click();
  const done = page.getByRole("heading", { level: 1, name: m.logout.done });
  await expect(done).toBeVisible();
  await expect(done).toBeFocused();
  await expect(page.getByRole("navigation")).toHaveCount(0);
});

test("DS-10: the home of an admin passes axe (WCAG 2.2 AA) at 1024 and 1440 px", async ({
  page,
}) => {
  await seedInternal(page, "admin", "Inès");
  await page.goto(bo("/accueil"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    m.home.title,
  );
  for (const width of [LG, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(mainNavigation(page)).toBeVisible();
    await expectNoAxeViolation(page, `accueil à ${String(width)} px`, {
      wcag22: true,
    });
  }
});

test("DS-12b: the dual control, the Apollo settings, the internal accounts and the technical health pass axe (WCAG 2.2 AA) at 1024 and 1440 px", async ({
  page,
}) => {
  const admin = await seedInternal(page, "admin", "Zoé");
  const excludedBefore = await apolloSetting("apollo_excluded_countries");
  const axeAt = async (screen: string): Promise<void> => {
    for (const width of [LG, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        ),
      ).toBeLessThanOrEqual(0);
      await expectNoAxeViolation(page, `${screen} à ${String(width)} px`, {
        wcag22: true,
      });
    }
  };
  try {
    await onlyAdmin(admin.accountId);

    // A pending request (the weakened form, the one that holds a countdown) and its list.
    await restoreApolloSetting("apollo_excluded_countries", ["DE"]);
    await page.goto(bo("/reglages/apollo"));
    const exclusions = page.getByRole("form", { name: m.apollo.countries });
    await expect(exclusions.getByLabel(m.apollo.countries)).toHaveValue("DE");
    await axeAt("réglages Apollo");
    await exclusions.getByLabel(m.apollo.countries).fill("DE IT");
    await exclusions
      .getByLabel(m.common.reason)
      .selectOption({ label: m.apollo.reasons.legal_restriction });
    await exclusions.getByRole("button", { name: m.apollo.change }).click();
    await expect(page).toHaveURL(/\/double-validation\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("status").filter({ hasText: m.dualControl.degraded }),
    ).toBeVisible();
    await axeAt("double validation en mode différé");

    await page.goto(bo("/double-validation"));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await axeAt("liste des doubles validations");

    await page.goto(bo("/comptes-internes"));
    await expect(
      page.getByRole("heading", { level: 1, name: m.internalAccounts.title }),
    ).toBeVisible();
    await expect(page.getByText(m.common.loading)).toHaveCount(0);
    await axeAt("comptes internes");

    await page.goto(bo("/sante-technique"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      m.health.title,
    );
    await expect(page.getByText(m.health.loading)).toHaveCount(0);
    await axeAt("santé technique");
  } finally {
    await restoreApolloSetting("apollo_excluded_countries", excludedBefore);
    await restoreAdmins();
  }
});

// The RK milestone (D75; 18 §12.6, TK1 to TK6; jalons/rk-fiche.md R1 to R4): the rendered state of
// the KEO charter on the backoffice, read on the real element in the state it concerns (helpers of
// support/rendering.ts, shared with charter-rendering.spec.ts). A case that the code before the
// milestone fails is a test.fail() named after the commit that frees it (RK-n), which turns it into
// a plain test; an absence is a case of its own (R2).

/** The small buttons of the screens (RK-4: sober, neither glow nor zoom); one not found fails. */
const SMALL_BUTTONS = [
  { path: "/inscrits", name: m.accounts.searchSubmit },
  { path: "/inscrits", name: m.accounts.reset },
] as const;

function signInButton(page: Page) {
  return page.getByRole("button", { name: m.login.submit });
}

/** The sign-in page, its h1 focused on arrival (DS-11): the standalone screen of the backoffice. */
async function openSignIn(page: Page): Promise<void> {
  await page.goto(bo("/"));
  await expect(
    page.getByRole("heading", { level: 1, name: m.login.title }),
  ).toBeFocused();
}

/** Two sign-ups of one tag, their list on screen: the rows of the dense table (TK6). */
async function twoRows(page: Page, name: string) {
  const tag = runTag(name);
  for (const role of ["creator", "advertiser"] as const) {
    await seedSignup({
      tag,
      role,
      countryCode: "BE",
      language: "fr",
      consent: true,
    });
  }
  await seedInternal(page, "agent", "Lina");
  await openList(page, tag);
  const rows = accountRows(page);
  await expect(rows).toHaveCount(2);
  await page.mouse.move(1, 1);
  return {
    rows,
    firstCell: (index: number) => rows.nth(index).locator("td").first(),
  };
}

/** The layers of an inset shadow of 2 px on the left, in the brand green (TK6.2). */
async function rowIndicators(page: Page, cell: Locator) {
  const green = await brandGreen(page);
  return visibleShadows(await computed(cell, "box-shadow")).filter(
    (layer) =>
      layer.inset && layer.x === 2 && layer.y === 0 && sameColor(layer, green),
  );
}

test("TK1.1 (backoffice): the sign-in button glows in the brand green at rest, wider on hover", async ({
  page,
}) => {
  await openSignIn(page);
  await expectGreenGlow(page, signInButton(page));
});

test("TK1.1 (backoffice): no glow on a disabled or unavailable button, at rest nor on hover", async ({
  page,
}) => {
  await openSignIn(page);
  const button = signInButton(page);
  for (const state of ["disabled", "aria-disabled"] as const) {
    await button.evaluate((element, attribute) => {
      element.setAttribute(attribute, "true");
    }, state);
    await expectNoGlow(button, { force: true });
    await page.mouse.move(1, 1);
    await button.evaluate((element, attribute) => {
      element.removeAttribute(attribute);
    }, state);
  }
});

test("TK1.2 (backoffice): the sign-in button grows to 1.03 on hover and shrinks to 0.98 while pressed", async ({
  page,
}) => {
  await openSignIn(page);
  await expectZoomAndPress(page, signInButton(page));
});

test("TK1.2 (backoffice): neither zoom nor press under reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openSignIn(page);
  await expectStill(page, signInButton(page));
});

test("TK1.2 (backoffice): neither zoom nor press on a disabled button", async ({
  page,
}) => {
  await openSignIn(page);
  const button = signInButton(page);
  await button.evaluate((element) => element.setAttribute("disabled", ""));
  await expectStill(page, button, { force: true });
});

test("EC-RK-REC-1 (backoffice): a live button shows the hand, a disabled one the not-allowed cursor", async ({
  page,
}) => {
  await openSignIn(page);
  const button = signInButton(page);
  expect(await computed(button, "cursor"), "live").toBe("pointer");
  await button.evaluate((element) => element.setAttribute("disabled", ""));
  expect(await computed(button, "cursor"), "disabled").toBe("not-allowed");
});

test("UX-1 (backoffice): the sign-in screen drawn in the KEO typefaces, Manrope loaded", async ({
  page,
}) => {
  await openSignIn(page);
  await expectKeoTypefaces(
    page,
    page.getByRole("heading", { level: 1 }),
    signInButton(page),
  );
});

test("UX-1 (backoffice): a screen of the space drawn in the KEO typefaces, Manrope loaded", async ({
  page,
}) => {
  await seedInternal(page, "agent", "Noa");
  await page.goto(bo("/accueil"));
  await expectKeoTypefaces(
    page,
    page.getByRole("heading", { level: 1 }),
    page.getByRole("button", { name: m.shell.signOut }),
  );
});

test("TK1.3 (backoffice): the primary button in 700", async ({ page }) => {
  await openSignIn(page);
  expect(await computed(signInButton(page), "font-weight")).toBe("700");
});

test("TK1.3 (backoffice): the secondary button and the text button in 600", async ({
  page,
}) => {
  await openSignIn(page);
  const text = page.getByRole("button", { name: m.login.useRecoveryCode });
  expect(await computed(text, "font-weight"), "text button").toBe("600");
  await page.goto(bo("/introuvable-rk"));
  const secondary = page.getByRole("link", { name: m.errorPages.home });
  expect(await computed(secondary, "font-weight"), "secondary").toBe("600");
});

test("TK1.4: the small buttons of the screens stay sober: neither glow nor zoom, at rest, on hover, pressed", async ({
  page,
}) => {
  await seedInternal(page, "agent", "Sacha");
  for (const { path: screen, name } of SMALL_BUTTONS) {
    await page.goto(bo(screen));
    const button = page.getByRole("button", { name, exact: true });
    await expect(button, `${screen}: ${name}`).toBeVisible();
    await expectNoGlow(button);
    await expectStill(page, button);
  }
});

/**
 * The five button classes of the backoffice, each on a real button of a screen (UX-2; 20 §11.8,
 * state D). The secondary button is reachable as a link only (the not-found page: its buttons sit
 * on the recovery-codes step, behind an activation that no seed gives), and a link takes no
 * `disabled`: it is read with `aria-disabled` alone (EC-RK-UX4-1).
 */
const DISABLED_LOOKS = [
  {
    name: "small primary",
    filled: true,
    attributes: ["aria-disabled", "disabled"],
    open: async (page: Page) => {
      await seedInternal(page, "agent", "Ugo");
      await page.goto(bo("/inscrits"));
      return page.getByRole("button", {
        name: m.accounts.searchSubmit,
        exact: true,
      });
    },
  },
  {
    name: "small secondary",
    filled: true,
    attributes: ["aria-disabled", "disabled"],
    open: async (page: Page) => {
      await seedInternal(page, "agent", "Ugo");
      await page.goto(bo("/inscrits"));
      return page.getByRole("button", { name: m.accounts.reset, exact: true });
    },
  },
  {
    name: "sign-in primary",
    filled: true,
    attributes: ["aria-disabled", "disabled"],
    open: async (page: Page) => {
      await openSignIn(page);
      return signInButton(page);
    },
  },
  {
    name: "secondary (link)",
    filled: true,
    attributes: ["aria-disabled"],
    open: async (page: Page) => {
      await page.goto(bo("/introuvable-rk"));
      return page.getByRole("link", { name: m.errorPages.home });
    },
  },
  {
    name: "text",
    filled: false,
    attributes: ["aria-disabled", "disabled"],
    open: async (page: Page) => {
      await openSignIn(page);
      return page.getByRole("button", { name: m.login.useRecoveryCode });
    },
  },
] as const;

for (const look of DISABLED_LOOKS) {
  test(`UX-2 (backoffice): the ${look.name} button looks disabled with ${look.attributes.join(" and ")}, at rest and on hover`, async ({
    page,
  }) => {
    const button = await look.open(page);
    await expect(button).toBeVisible();
    const disabledGround = await tokenColor(page, "--color-action-disabled-bg");
    const disabledText = await tokenColor(page, "--color-text-disabled");
    if (disabledGround === null || disabledText === null) {
      throw new Error("a disabled token is not declared");
    }
    for (const attribute of look.attributes) {
      await button.evaluate((element, name) => {
        element.setAttribute(name, name === "disabled" ? "" : "true");
      }, attribute);
      for (const state of ["at rest", "on hover"]) {
        if (state === "on hover") await button.hover({ force: true });
        await settled(button);
        const where = `${look.name} ${attribute} ${state}`;
        const ground = rgbaOf(await computed(button, "background-color"));
        const text = rgbaOf(await computed(button, "color"));
        const border = rgbaOf(await computed(button, "border-top-color"));
        if (ground === null || text === null || border === null) {
          throw new Error(`${where}: an unread color`);
        }
        if (look.filled) {
          expect(sameColor(ground, disabledGround), `${where}: ground`).toBe(
            true,
          );
          expect(ground.a, `${where}: ground opaque`).toBe(1);
        } else {
          expect(ground.a, `${where}: no ground`).toBe(0);
        }
        expect(sameColor(text, disabledText), `${where}: text`).toBe(true);
        if (look.name.includes("secondary")) {
          expect(border.a, `${where}: border transparent`).toBe(0);
        }
        expect(
          visibleShadows(await computed(button, "box-shadow")),
          `${where}: no shadow`,
        ).toEqual([]);
        expect(await drawnRatio(button), `${where}: ratio`).toBeCloseTo(1, 3);
      }
      await expectStill(page, button, { force: true });
      await page.mouse.move(1, 1);
      await button.evaluate((element, name) => {
        element.removeAttribute(name);
      }, attribute);
    }
  });
}

test("TK1.5 (backoffice): a card is rounded at 16 px", async ({ page }) => {
  await openSignIn(page);
  const card = page.locator("form").first();
  for (const corner of [
    "top-left",
    "top-right",
    "bottom-right",
    "bottom-left",
  ]) {
    expect(await computed(card, `border-${corner}-radius`), corner).toBe(
      "16px",
    );
  }
});

test("TK2.1 (backoffice), the screen container carries the glow, whole, the only one of the page", async ({
  page,
}) => {
  await openSignIn(page);
  expectWholeGlow("sign-in", await glowFacts(page));
});

test("TK2.2 (backoffice), the glow without an edge, 16 to 25/255 over the page under the centre", async ({
  page,
}) => {
  await openSignIn(page);
  expectSoftGlow("sign-in at 1440 px", await glowProbe(page));
});

test("TK2.3 (backoffice): no sideways scroll at 375 and 768 px, the glow drawn", async ({
  page,
}) => {
  await openSignIn(page);
  for (const width of [375, 768]) {
    await page.setViewportSize({ width, height: 800 });
    const facts = await sidewaysFacts(page);
    expect(facts.glows, `${width} px: the glow drawn`).toBeGreaterThan(0);
    expect(facts.overflow, `${width} px`).toBeLessThanOrEqual(0);
  }
});

/** A work page of the backoffice, an agent seeded: the dashboard, whose h1 sits straight in <main>. */
async function openWorkPage(page: Page) {
  await seedInternal(page, "agent", "Eden");
  await page.goto(bo("/accueil"));
  await expect(
    page.getByRole("heading", { level: 1, name: m.home.title }),
  ).toBeVisible();
}

test("TK2.1 (backoffice), the container of a work page carries the glow, whole, the only one", async ({
  page,
}) => {
  await openWorkPage(page);
  const facts = await glowFacts(page);
  expectWholeGlow("home", facts);
  // Whatever its content (loading included), the container is as high as the glow.
  expect(
    parseFloat(await computed(page.locator("main"), "min-height")),
    "home: min-height of the container",
  ).toBeGreaterThanOrEqual(facts?.glowHeight ?? Infinity);
});

test("TK2.2 (backoffice), the glow of a work page without an edge, 16 to 25/255 over the page", async ({
  page,
}) => {
  await openWorkPage(page);
  expectSoftGlow("home at 1440 px", await glowProbe(page));
});

test("TK2.3 (backoffice), a work page: no sideways scroll at 375 and 768 px, the glow drawn at 768 only", async ({
  page,
}) => {
  await openWorkPage(page);
  await page.setViewportSize({ width: 768, height: 800 });
  const work = await sidewaysFacts(page);
  expect(work.drawn, "768 px: the glow drawn").toBe(1);
  expect(work.overflow, "768 px").toBeLessThanOrEqual(0);
  await page.setViewportSize({ width: 375, height: 800 });
  const small = await sidewaysFacts(page);
  expect(small.drawn, "375 px: the workstation screen has no glow").toBe(0);
  expect(small.overflow, "375 px").toBeLessThanOrEqual(0);
});

test("TK3.3 (backoffice): the h1 tightened by --tracking-heading, a negative token", async ({
  page,
}) => {
  await openSignIn(page);
  await expectHeadingTracking(page, page.getByRole("heading", { level: 1 }));
});

test("TK3.3 (backoffice), a section title (h2) tightened by --tracking-heading, a negative token", async ({
  page,
}) => {
  await seedInternal(page, "agent", "Eden");
  await page.goto(bo("/accueil"));
  await expectHeadingTracking(
    page,
    page.getByRole("heading", { level: 2 }).first(),
  );
});

test("TK3.3 (backoffice), a block title (h3) in Manrope 700", async ({
  page,
}) => {
  await seedInternal(page, "admin", "Ilian");
  await page.goto(bo("/sante-technique"));
  await expect(page.getByText(m.health.loading)).toHaveCount(0);
  const heading = page.getByRole("heading", { level: 3 }).first();
  await expect(heading).toBeVisible();
  expect(firstFamily(await computed(heading, "font-family"))).toBe(
    await displayFamily(page),
  );
  expect(await computed(heading, "font-weight")).toBe("700");
});

test("TK3.4 (backoffice), the html smoothed (antialiased)", async ({
  page,
}) => {
  await openSignIn(page);
  expect(await computed(page.locator("html"), "-webkit-font-smoothing")).toBe(
    "antialiased",
  );
});

test("TK5.1 (backoffice), on arrival, the h1 focused without a ring", async ({
  page,
}) => {
  await openSignIn(page);
  expect((await focusedElement(page))?.outlineStyle).toBe("none");
});

/** The dashboard of a seeded agent, drawn (its h1 written) before any key is pressed. */
async function openDashboard(page: Page): Promise<void> {
  await seedInternal(page, "agent", "Mila");
  await page.goto(bo("/accueil"));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    m.home.title,
  );
}

test("TK5.1 (backoffice): after a click in the rail, the h1 focused without a ring", async ({
  page,
}) => {
  await openDashboard(page);
  await mainNavigation(page)
    .getByRole("link", { name: m.nav.accounts })
    .click();
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(m.accounts.title);
  await expect(heading).toBeFocused();
  expect((await focusedElement(page))?.outlineStyle).toBe("none");
});

test("TK5.1 (backoffice), after Enter on a link of the rail, the h1 focused without a ring", async ({
  page,
}) => {
  await openDashboard(page);
  await mainNavigation(page)
    .getByRole("link", { name: m.nav.accounts })
    .focus();
  await page.keyboard.press("Enter");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText(m.accounts.title);
  await expect(heading).toBeFocused();
  expect((await focusedElement(page))?.outlineStyle).toBe("none");
});

test("TK5.1 (backoffice), after the skip link, main focused without a ring", async ({
  page,
}) => {
  await openDashboard(page);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: m.nav.skip })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
  expect((await focusedElement(page))?.outlineStyle).toBe("none");
});

test("TK5.2 (backoffice): at Tab, a link, a button, a field and the region of a table keep a ring of 2 px, never covered", async ({
  page,
}) => {
  const { rows } = await twoRows(page, "tk52");
  await expect(rows.first()).toBeVisible();
  const seen = new Set<string>();
  for (let press = 0; press < 60 && seen.size < 4; press += 1) {
    await page.keyboard.press("Tab");
    // The centre of the element's first fragment: « Ouvrir la fiche » wraps on two lines in its
    // cell, and the centre of its whole box falls between them, on the cell itself.
    const focus = await page.evaluate(() => {
      const element = document.activeElement;
      if (element === null) return null;
      const style = getComputedStyle(element);
      const box =
        element.getClientRects()[0] ?? element.getBoundingClientRect();
      const top = document.elementFromPoint(
        box.x + box.width / 2,
        box.y + box.height / 2,
      );
      return {
        kind:
          element.getAttribute("role") === "region"
            ? "region"
            : element.tagName.toLowerCase(),
        outlineStyle: style.outlineStyle,
        outlineWidth: parseFloat(style.outlineWidth),
        covered: top === null || !(top === element || element.contains(top)),
      };
    });
    if (
      focus === null ||
      !["a", "button", "input", "region"].includes(focus.kind) ||
      seen.has(focus.kind)
    ) {
      continue;
    }
    seen.add(focus.kind);
    expect(focus.outlineStyle, focus.kind).not.toBe("none");
    expect(focus.outlineWidth, focus.kind).toBeGreaterThanOrEqual(2);
    expect(focus.covered, `${focus.kind} is covered`).toBe(false);
  }
  expect([...seen].sort()).toEqual(["a", "button", "input", "region"]);
});

test("TK6.1: the head of the dense table lighter than its rows, in Manrope 700", async ({
  page,
}) => {
  const { rows } = await twoRows(page, "tk61");
  const head = page
    .getByRole("table", { name: m.accounts.title })
    .locator("thead th")
    .first();
  const ground = async (cell: Locator) =>
    cell.evaluate((element) => {
      for (
        let node: Element | null = element;
        node !== null;
        node = node.parentElement
      ) {
        const color = getComputedStyle(node).backgroundColor;
        if (!/^rgba\(.*,\s*0\)$|^transparent$/.test(color)) return color;
      }
      return getComputedStyle(document.body).backgroundColor;
    });
  const headGround = rgbaOf(await ground(head));
  const rowGround = rgbaOf(await ground(rows.first().locator("td").first()));
  if (headGround === null || rowGround === null) {
    throw new Error("unread grounds");
  }
  expect(luminance(headGround), "the head lighter").toBeGreaterThan(
    luminance(rowGround),
  );
  expect(firstFamily(await computed(head, "font-family"))).toBe(
    await displayFamily(page),
  );
  expect(await computed(head, "font-weight")).toBe("700");
});

test("TK6.2: a hovered row marked by 2 px of the brand green on its first cell", async ({
  page,
}) => {
  const { rows, firstCell } = await twoRows(page, "tk62-hover");
  await hovered(rows.first());
  await expect
    .poll(async () => (await rowIndicators(page, firstCell(0))).length)
    .toBe(1);
});

test("TK6.2: a row whose link has the keyboard focus marked by 2 px of the brand green", async ({
  page,
}) => {
  const { rows, firstCell } = await twoRows(page, "tk62-focus");
  await rows.first().getByRole("link", { name: m.accounts.openRecord }).focus();
  expect(await rowIndicators(page, firstCell(0))).toHaveLength(1);
});

test("TK6.2: no row marked at rest, nor the neighbour of the hovered one", async ({
  page,
}) => {
  const { rows, firstCell } = await twoRows(page, "tk62-none");
  expect(await rowIndicators(page, firstCell(0)), "at rest").toEqual([]);
  expect(await rowIndicators(page, firstCell(1)), "at rest").toEqual([]);
  await hovered(rows.first());
  expect(
    await rowIndicators(page, firstCell(1)),
    "the neighbour of the hovered row",
  ).toEqual([]);
});

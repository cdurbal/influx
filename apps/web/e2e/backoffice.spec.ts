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
import type { Browser, Page } from "@playwright/test";
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
    await expect(
      page.getByRole("table", { name: m.invitations.listTitle }),
    ).toBeVisible();
    await expectNoAxeViolation(page, "invitations de membres");

    await page.goto(bo("/sante-technique"));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      m.health.title,
    );
    await expect(page.getByText(m.health.loading)).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: m.health.availability.title }),
    ).toBeVisible();
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

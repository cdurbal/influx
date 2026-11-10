// What an agent does with the verification requests in the backoffice (docs/mvp/08 RG43 to RG55, RG61 to
// RG66, RG83, RG84, RG98, RG101; 06 RG46 to RG52, CA28, CA29; 17b §3.7, §3.11; jalons/l2e, commits 21 to
// 23; split off `verification.spec.ts` by jalons/l2f, commit 01), in French only (the backoffice has no
// English before D36): queue 4 as two lists, the decision of an audience request, the decision of a
// brand's request and the registry sources. The state before the gesture tested (a creator's request
// sent, an agent, a colleague) is written by the database or by the API's own doors, never by the
// screens of the member's journey.
import { seedMember } from "./support/account";
import { messages as bo } from "../../backoffice/src/messages/fr";
import { expectNoAxeViolation } from "./support/axe";
import {
  retireInternals,
  runTag,
  seedColleague,
  seedInternal,
} from "./support/backoffice";
import { expect, open, test } from "./support/journey";
import { BACKOFFICE_ORIGIN } from "./support/servers";
import {
  AUDIENCE,
  audienceRequestsOf,
  auditLinesOf,
  COPY,
  dayBefore,
  grantAsAgent,
  seedBrandDossier,
  seedLines,
  seedQueueRequests,
  sendAudienceRequest,
  withdrawQueueRequests,
  withSql,
} from "./support/verification";

test.afterAll(async () => {
  await withdrawQueueRequests();
  await retireInternals();
});

// L2E-21 (08 RG61 à RG66, RG98, CA42 à CA44; 17b §3.7): the two views of queue 4 in the backoffice, one
// case, in French only (the backoffice has no English before D36). Requests owned by a colleague, so that
// the journey reads them alone by `?owner=`; they are cancelled afterwards, as no journey decides one.

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

test("an agent decides an audience request, from the creator's deposit to the dated badge: the piece opened and logged, nothing pre-filled, the gap only after the typing, a Storage that fails blocks the grant (08 RG43 à RG55, RG83, RG84, CA25, CA27, modele -19)", async ({
  page,
}) => {
  const T = bo.verificationReview;
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

  // The creator's request, deposited with a real image and sent through the API's own doors (commit 19
  // proved the screens one by one, in verification-creator.spec.ts): the state before the agent's gesture.
  await sendAudienceRequest(page);
  await open(page, `${AUDIENCE.fr}?network=instagram`);
  await expect(
    page.getByRole("main").getByText(COPY.fr.own.audience.sent.body),
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
  const stateName = `California register ${tag}`;
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

    // L2F-21: the register of a State is added beside the one of its country; the value to be journaled
    // is shown first (inactive: it never shares the one active source of the country), then saved
    await page.getByRole("button", { name: S.add.open }).click();
    await page.getByLabel(S.add.country).selectOption("US");
    await page.getByLabel(S.add.subdivision).fill("ca");
    await page.getByLabel(S.fields.name).fill(stateName);
    await page
      .getByLabel(S.fields.url)
      .fill("https://bizfileonline.sos.ca.gov/search/business");
    await page.getByLabel(S.fields.checkedOn).fill("2026-11-01");
    await page.getByRole("button", { name: S.add.review }).click();
    await expect(main.locator("[data-add-line=subdivision]")).toContainText(
      "US-CA",
    );
    await expectNoAxeViolation(page, "registry sources, source to add", {
      wcag22: true,
    });
    await page.getByRole("button", { name: S.add.confirm }).click();
    await expect(
      page.getByText(S.add.added(stateName, "États-Unis, US-CA")),
    ).toBeVisible();
    const [stateRow] = await withSql(
      (sql) => sql<{ id: string }[]>`
        select id::text from verification.registry_sources where name = ${stateName}`,
    );
    const addedStateSource = stateRow!.id;
    await expect(
      page
        .getByRole("region", { name: S.tableLabel(S.inactiveTitle) })
        .locator(`[data-source="${addedStateSource}"]`),
    ).toContainText("US-CA");
    expect(
      (
        await auditLinesOf(
          addedStateSource,
          "verification.registry_source_changed",
        )
      ).map((line) => line.payload.before),
    ).toEqual([null]);
  } finally {
    // the source added is the test's own, whatever the point where it stopped
    await withSql(
      (sql) => sql`
        delete from verification.registry_sources where name = ${stateName}`,
    );
    await withSql(
      (sql) => sql`
        update verification.registry_sources set is_active = false
         where id = ${gb!.id}`,
    );
  }
});

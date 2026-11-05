// L2C-16 (docs/mvp/15 RG27 C2 C5 C8, RG28, RG32, RG33, RG119, RG121; 17b §2.2, §2.3, §2.8; jalons/
// l2c/file.md A10): the list of queue 1, "Profils marque à valider", in the browser, on the real
// API and the local database. The list in words (states written, deadline, lock named, alerts under
// the row, no coordinate), the sort by deadline, the filters carried by the address, the keyboard,
// axe, and the states of the list (refused, error then retry, empty). The same file is completed by
// the decision screen (L2C-17) and the record of the account (L2C-18).
// Only agents are seeded here: an admin belongs to backoffice.spec.ts, whose degraded dual control
// deactivates every other admin for a while (playwright.config.ts). The brands of a journey belong
// to a colleague, so that the journey reads them alone, by `?owner=`, whatever other journeys left
// in the queue; their entries are withdrawn afterwards.
import type { Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { messages } from "../../backoffice/src/messages/fr";
import { expectNoAxeViolation } from "./support/axe";
import {
  retireInternals,
  runTag,
  seedColleague,
  seedInternal,
} from "./support/backoffice";
import { expect, test } from "./support/journey";
import {
  changePresentation,
  reviewEntryFacts,
  seedReviewEntry,
  withdrawReviewEntries,
} from "./support/review-queue";
import { BACKOFFICE_ORIGIN } from "./support/servers";

const m = messages;
const t = m.queueList;
const LIST = "/files/profils-marque";

test.use({ viewport: { width: 1440, height: 900 } });

test.afterAll(async () => {
  await withdrawReviewEntries();
  await retireInternals();
});

function bo(path: string): string {
  return `${BACKOFFICE_ORIGIN}${path}`;
}

/** The lines of the table that carry an entry (the alerts are a line of their own under it). */
function entryRows(page: Page) {
  return page
    .getByRole("table", { name: t.tableLabel })
    .locator("tbody tr")
    .filter({ has: page.locator("a[data-entry-link]") });
}

/** Three brands of a colleague: one overdue with an alert, one held by another, one revised. */
async function threeBrands(tag: string) {
  const owner = await seedColleague("agent", "Noa");
  const holder = await seedColleague("agent", "Marie");
  const base = { ownerAgentId: owner.accountId };
  await seedReviewEntry({
    ...base,
    name: `Maison ${tag}A`,
    dueInMinutes: -300,
    escalated: true,
    presentation:
      "Write to us at hello@brand-e2e.example.com for any request, we answer within the day.",
  });
  await seedReviewEntry({
    ...base,
    name: `Maison ${tag}B`,
    countryCode: "BE",
    dueInMinutes: 125,
    heldByAgentId: holder.accountId,
  });
  await seedReviewEntry({
    ...base,
    name: `Maison ${tag}C`,
    dueInMinutes: 400,
    kind: "revision",
  });
  return { owner, holder, address: `${LIST}?owner=${owner.accountId}` };
}

test("L2C-16: the list says each entry in words, overdue first, with no coordinate, and the dashboard counts the queue", async ({
  page,
}) => {
  const tag = runTag("q1");
  await seedInternal(page, "agent", "Lou");
  const { address } = await threeBrands(tag);
  await page.goto(bo(address));
  await expect(
    page.getByRole("heading", { level: 1, name: m.queue.profiles_advertiser }),
  ).toBeVisible();
  const rows = entryRows(page);
  await expect(rows).toHaveCount(3);

  // sorted by deadline, the overdue entry first; the sort is said, not only drawn (15 C5)
  await expect(rows.nth(0)).toContainText(`Maison ${tag}A`);
  await expect(rows.nth(1)).toContainText(`Maison ${tag}B`);
  await expect(rows.nth(2)).toContainText(`Maison ${tag}C`);
  await expect(page.locator("th[aria-sort=ascending]")).toContainText(
    t.columns.due,
  );

  // overdue: written, with its duration; the state is a label, never a colour alone (RG119)
  await expect(rows.nth(0)).toContainText(t.state.overdue);
  await expect(rows.nth(0)).toContainText(/HORS DÉLAI depuis 5 h/);
  await expect(rows.nth(0)).toContainText(t.kinds.submission);
  await expect(rows.nth(0)).toContainText("Noa");
  await expect(rows.nth(0)).toContainText(t.escalated);
  // the alert is written under the row, never in a tooltip
  await expect(
    page.getByText(t.alertLine(t.alerts.direct_contact)),
  ).toBeVisible();

  // a lock names its holder (15 C2); a free entry says so
  await expect(rows.nth(1)).toContainText(t.state.held);
  await expect(rows.nth(1)).toContainText(/dans 2 h 0\d/);
  await expect(rows.nth(1)).toContainText(/Marie depuis \d{2}:\d{2}/);
  await expect(rows.nth(1)).toContainText("Belgique");
  await expect(rows.nth(2)).toContainText(t.state.free);
  await expect(rows.nth(2)).toContainText(t.kinds.revision);
  await expect(rows.nth(2)).toContainText(t.fields["advertiser.presentation"]);
  await expect(rows.nth(2)).toContainText(t.lockFree);

  // the counters of the head banner and the delay, in clear (RG28)
  await expect(
    page.getByText(
      /\d+ entrées? en attente · plus ancienne : .+ · hors délai : \d+ · sans preneur : \d+/,
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/^Délai de décision : .+ (ouvrées|en continu)/),
  ).toBeVisible();

  // D45, D46: no coordinate of the contact person, nowhere in the list
  const text = (await page.locator("main").innerText()).toLowerCase();
  for (const forbidden of [
    "hello@brand",
    "contact-",
    "+33612345678",
    "brand.example.test",
  ]) {
    expect(text).not.toContain(forbidden);
  }

  // the dashboard counts the same queue (RG28, 06 RG72) and says the entries past the threshold (RG7)
  await page.goto(bo("/accueil"));
  const summary = page.getByRole("region", { name: m.queueSummary.title });
  await expect(summary).toContainText(
    /Profils marque à valider : \d+ en attente · plus ancienne : .+ · hors délai : \d+ · sans preneur : \d+/,
  );
  await expect(summary).toContainText(/dépassé le seuil d’alerte d’ancienneté/);
  await expect(
    summary.getByRole("link", { name: m.queueSummary.open }),
  ).toHaveAttribute("href", LIST);
});

test("L2C-16: the filters, the origin and the country are in the address, and a link restores them (RG121)", async ({
  page,
}) => {
  const tag = runTag("q1f");
  await seedInternal(page, "agent", "Lou");
  const { owner, address } = await threeBrands(tag);
  await page.goto(bo(address));
  const rows = entryRows(page);
  await expect(rows).toHaveCount(3);

  // "Verrou : libre": two of the three, the address says it, the chip too
  await page.getByLabel(t.holder, { exact: true }).selectOption("free");
  await expect(page).toHaveURL(/holder=free/);
  await expect(page).toHaveURL(new RegExp(`owner=${owner.accountId}`));
  await expect(rows).toHaveCount(2);
  await expect(
    page.getByRole("button", {
      name: t.chipRemove(t.chip(t.holder, t.holderOptions.free)),
    }),
  ).toBeVisible();

  // "Hors délai seuls": the overdue one alone; removing its chip brings the other back
  await page.getByLabel(t.overdueOnly).click();
  await expect(page).toHaveURL(/overdue=true/);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(`Maison ${tag}A`);
  await page.getByRole("button", { name: t.chipRemove(t.overdueOnly) }).click();
  await expect(page).not.toHaveURL(/overdue=true/);
  await expect(rows).toHaveCount(2);

  // the origin of the queue: a revision alone; a reload keeps it, the address is the state
  await page.getByLabel(t.kind, { exact: true }).selectOption("revision");
  await expect(page).toHaveURL(/kind=revision/);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(`Maison ${tag}C`);
  await page.reload();
  await expect(rows).toHaveCount(1);
  await expect(page.getByLabel(t.kind, { exact: true })).toHaveValue(
    "revision",
  );

  // no entry matches: said as such, and "Réinitialiser" restores the bare address
  await page
    .getByLabel(t.country, { exact: true })
    .selectOption({ label: "Japon" });
  await expect(page).toHaveURL(/country=JP/);
  await expect(page.getByText(t.noMatch)).toBeVisible();
  await page.getByRole("button", { name: t.reset, exact: true }).click();
  await expect(page).toHaveURL(bo(LIST));
  await expect(page.getByRole("table", { name: t.tableLabel })).toBeVisible();
});

test("L2C-16: ‹j›, ‹k› and ‹?› drive the list from the keyboard, and the list passes axe at 1 280 and 1 440 px", async ({
  page,
}) => {
  await seedInternal(page, "agent", "Lou");
  const { address } = await threeBrands(runTag("q1k"));
  await page.goto(bo(address));
  await expect(entryRows(page)).toHaveCount(3);

  const links = page.locator("a[data-entry-link]");
  await page.keyboard.press("j");
  await expect(links.nth(0)).toBeFocused();
  await page.keyboard.press("j");
  await expect(links.nth(1)).toBeFocused();
  await page.keyboard.press("k");
  await expect(links.nth(0)).toBeFocused();

  // a key typed in a field is the field's own
  await page.getByLabel(t.holder, { exact: true }).focus();
  await page.keyboard.press("j");
  await expect(links.nth(0)).not.toBeFocused();

  // ‹?› shows and hides the reminder, ‹Entrée› is the link's own
  await page.locator("main").click({ position: { x: 4, y: 4 } });
  await page.keyboard.press("?");
  const reminder = page.getByRole("region", { name: t.shortcutsTitle });
  await expect(reminder).toBeVisible();
  await expect(reminder).toContainText(t.shortcuts.open);
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoAxeViolation(
      page,
      `file profils marque à ${String(width)} px`,
      {
        wcag22: true,
      },
    );
  }
  await page.keyboard.press("?");
  await expect(reminder).toHaveCount(0);
});

test("L2C-16: a refused read, a failed read then its retry, and an empty queue each have their own state (17b §2.8, RG32)", async ({
  page,
}) => {
  await seedInternal(page, "agent", "Lou");
  const nobody = randomUUID();
  const entries = "**/api/v1/bo/queues/profiles-advertiser/entries**";
  const counters = "**/api/v1/bo/queues/counters";
  const envelope = (code: string) => ({
    error: { code, message: "refused", requestId: randomUUID(), details: [] },
  });

  // refused: the sentence names the role, and there is no retry to offer
  await page.route(entries, (route) =>
    route.fulfill({ status: 403, json: envelope("forbidden") }),
  );
  await page.goto(bo(`${LIST}?owner=${nobody}`));
  await expect(
    page.getByRole("alert").filter({ hasText: t.forbidden }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: m.common.retry })).toHaveCount(
    0,
  );
  await page.unroute(entries);

  // failed: a sentence in words, never a trace; the retry reads again (a real answer, no entry)
  let reads = 0;
  await page.route(entries, (route) => {
    reads += 1;
    return reads === 1
      ? route.fulfill({ status: 500, json: envelope("internal_error") })
      : route.continue();
  });
  await page.goto(bo(`${LIST}?owner=${nobody}`));
  await expect(
    page.getByRole("alert").filter({ hasText: t.error }),
  ).toBeVisible();
  await page.getByRole("button", { name: m.common.retry }).click();
  await expect(page.getByText(t.noMatch)).toBeVisible();
  await page.unroute(entries);

  // empty: normal, with how long ago the last entry was handled (15 RG32)
  const now = Date.now();
  await page.route(entries, (route) =>
    route.fulfill({
      json: { asOf: new Date(now).toISOString(), items: [], nextCursor: null },
    }),
  );
  await page.route(counters, (route) =>
    route.fulfill({
      json: {
        asOf: new Date(now).toISOString(),
        queues: [
          {
            queue: "profiles_advertiser",
            pending: 0,
            oldestCreatedAt: null,
            overdue: 0,
            unclaimed: 0,
            lastDecidedAt: new Date(now - 12 * 60_000).toISOString(),
            policy: {
              decisionMinutes: 480,
              claimTargetMinutes: 240,
              escalateAfterMinutes: 960,
              businessHours: true,
            },
          },
        ],
      },
    }),
  );
  await page.goto(bo(LIST));
  await expect(
    page.getByRole("status").filter({ hasText: t.emptySince("12 min") }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});

// --- L2C-17: the decision screen --------------------------------------------------------------
// The entries a decision journey wants first are due long before any other of the shared stack, so
// that "the next entry" of the chain (17b §2.6) is the one the journey seeded.
const EARLY = -100_000;
const r = m.queueReview;

function entryPage(entryId: string): string {
  return bo(`${LIST}/${entryId}`);
}

// L2C-18b: the image of a logo is read on demand, through the relay, by the id the view served. The
// journey answers that read with a one-pixel WebP (the route and its register line are T14's): what
// it proves is the screen, its `blob:` source under the CSP, its text, and one read per logo.
const PIXEL = "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

async function serveLogo(page: Page): Promise<{ reads: () => number }> {
  let reads = 0;
  await page.route(
    "**/api/v1/bo/queues/profiles-advertiser/entries/*/logo**",
    (route) => {
      reads += 1;
      return route.fulfill({
        json: {
          state: "active",
          logo: {
            contentType: "image/webp",
            width: 1,
            height: 1,
            byteSize: Buffer.from(PIXEL, "base64").length,
            data: PIXEL,
            updatedAt: new Date().toISOString(),
          },
        },
      });
    },
  );
  return { reads: () => reads };
}

/** The image is drawn: visible, from a `blob:` source, decoded (a broken image has no width). */
async function expectLogoDrawn(page: Page, brandName: string): Promise<void> {
  const image = page.getByRole("img", {
    name: r.logo.alt(r.logo.active, brandName),
  });
  await expect(image).toBeVisible();
  await expect(image).toHaveAttribute("src", /^blob:/);
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
}

test("L2C-17: opening takes the entry, publishing needs the recap, and the next entry opens with its confirmation", async ({
  page,
}) => {
  const tag = runTag("q1p");
  const lou = await seedInternal(page, "agent", "Lou");
  await withdrawReviewEntries();
  const owner = await seedColleague("agent", "Noa");
  const first = await seedReviewEntry({
    ownerAgentId: owner.accountId,
    name: `Maison ${tag}A`,
    dueInMinutes: EARLY,
    logo: "active",
  });
  const second = await seedReviewEntry({
    ownerAgentId: owner.accountId,
    name: `Maison ${tag}B`,
    dueInMinutes: EARLY + 1000,
  });
  const logoRead = await serveLogo(page);

  // from the list: the link opens the entry, which takes it in charge and says so
  await page.goto(bo(`${LIST}?owner=${owner.accountId}`));
  await page
    .getByRole("link", { name: t.openEntryOf(`Maison ${tag}A`) })
    .click();
  await expect(page).toHaveURL(entryPage(first.entryId));
  await expect(
    page.getByRole("heading", { level: 1, name: new RegExp(`Maison ${tag}A`) }),
  ).toBeVisible();
  await expect(
    page.getByText(/^Vous avez pris cette entrée en charge à /),
  ).toBeVisible();
  await expect(
    page.getByText(/^Consultation enregistrée : Lou, /),
  ).toBeVisible();
  expect((await reviewEntryFacts(first.entryId)).claimedBy).toBe(lou.accountId);
  // everything needed to decide is on the screen: the brand, the alerts, the contact behind the marker
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: r.sections.brand,
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText(r.written.submission)).toBeVisible();
  await expect(page.getByText(r.alerts.none)).toBeVisible();
  await expect(
    page.getByText(/^contact-.+@brand\.example\.test$/),
  ).toBeVisible();
  // the logo is drawn, read once, and the old sentence "characteristics only" is gone
  await expectLogoDrawn(page, `Maison ${tag}A`);
  expect(logoRead.reads()).toBe(1);

  // ‹v› opens the recap and publishes nothing; ‹Échap› closes it; the button opens it again
  await page.locator("main").click({ position: { x: 4, y: 4 } });
  await page.keyboard.press("v");
  await expect(
    page.getByRole("heading", { name: r.decision.publishTitle }),
  ).toBeVisible();
  expect((await reviewEntryFacts(first.entryId)).state).toBe("open");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("heading", { name: r.decision.publishTitle }),
  ).toHaveCount(0);
  await page.getByLabel(r.decision.comment).fill("Vu, rien à signaler.");
  await page
    .getByRole("button", { name: new RegExp(`^${r.decision.publish}`) })
    .click();
  await page.getByRole("button", { name: r.decision.publishConfirm }).click();

  // the next entry opens, taken in charge, under the confirmation
  await expect(page).toHaveURL(entryPage(second.entryId));
  await expect(
    page.getByText(r.decision.publishedNotice(`Maison ${tag}A`)),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: new RegExp(`Maison ${tag}B`) }),
  ).toBeVisible();
  expect(await reviewEntryFacts(first.entryId)).toMatchObject({
    state: "published",
    decidedBy: lou.accountId,
    internalComment: "Vu, rien à signaler.",
  });
  expect((await reviewEntryFacts(second.entryId)).claimedBy).toBe(
    lou.accountId,
  );

  // cancelling the chain gives the entry just taken back and shows the list
  await page.getByRole("button", { name: r.chain.cancel }).click();
  await expect(page).toHaveURL(bo(LIST));
  await expect
    .poll(async () => (await reviewEntryFacts(second.entryId)).claimedBy)
    .toBeNull();
});

test("L2C-17, L2C-18: a refusal names a closed reason, shows the message the brand will read, keeps what was typed, and the record of the account then shows the contact person, the profile and the decision", async ({
  page,
}) => {
  const tag = runTag("q1r");
  const lou = await seedInternal(page, "agent", "Lou");
  await withdrawReviewEntries();
  const owner = await seedColleague("agent", "Noa");
  const only = await seedReviewEntry({
    ownerAgentId: owner.accountId,
    name: `Maison ${tag}C`,
    dueInMinutes: EARLY,
  });
  await page.goto(entryPage(only.entryId));
  await expect(
    page.getByText(/^Vous avez pris cette entrée en charge à /),
  ).toBeVisible();

  // ‹r› opens the picker and never refuses; the eight reasons are seen as radio buttons
  await page.locator("main").click({ position: { x: 4, y: 4 } });
  await page.keyboard.press("r");
  const picker = page.getByRole("group", { name: r.decision.reasonLegend });
  await expect(picker.getByRole("radio")).toHaveCount(8);
  expect((await reviewEntryFacts(only.entryId)).state).toBe("open");
  await page
    .getByRole("button", { name: r.decision.reasonConfirm, exact: true })
    .click();
  await expect(page.getByText(r.decision.reasonRequired)).toBeVisible();

  // the sentence the brand receives is written under the reason picked, before the decision
  await picker
    .getByRole("radio", {
      name: r.decision.reasonLabels.presentation_insufficient,
    })
    .check();
  await expect(page.getByText(r.decision.messageToBrand)).toBeVisible();
  await expect(
    page.getByText(/ne permet pas à un créateur de comprendre votre activité/),
  ).toBeVisible();

  // « Autre »: the agent's own text, which the server refuses if it carries a contact; nothing is lost
  await picker
    .getByRole("radio", { name: r.decision.reasonLabels.other })
    .check();
  await page.getByLabel(r.decision.comment).fill("Appelé, sans réponse.");
  const message = page.getByLabel(r.decision.otherMessage);
  await message.fill("Trop court");
  await page
    .getByRole("button", { name: r.decision.reasonConfirm, exact: true })
    .click();
  await expect(page.getByText(r.decision.otherTooShort)).toBeVisible();
  const contact = "Merci de nous écrire à marque@exemple.com pour la suite.";
  await message.fill(contact);
  await page
    .getByRole("button", { name: r.decision.reasonConfirm, exact: true })
    .click();
  await expect(page.getByText(r.decision.otherDirectContact)).toBeVisible();
  await expect(message).toHaveValue(contact);
  await expect(page.getByLabel(r.decision.comment)).toHaveValue(
    "Appelé, sans réponse.",
  );
  expect((await reviewEntryFacts(only.entryId)).state).toBe("open");

  const clean = "Décrivez ce que vend votre marque dans la présentation.";
  await message.fill(clean);
  await page
    .getByRole("button", { name: r.decision.reasonConfirm, exact: true })
    .click();
  // nothing else waits for this journey: it ends on the empty state, with the decision said
  await expect(
    page.getByText(
      r.decision.rejectedNotice(
        `Maison ${tag}C`,
        r.decision.reasonLabels.other.toLowerCase(),
      ),
    ),
  ).toBeVisible();
  expect(await reviewEntryFacts(only.entryId)).toMatchObject({
    state: "rejected",
    decidedBy: lou.accountId,
    reasonCode: "other",
    memberMessage: clean,
    internalComment: "Appelé, sans réponse.",
  });

  // L2C-18: the record of the account reads what the decision left (blocks 2 and 3, no correction);
  // the entry was seeded far overdue, so the decision is marked late
  const b = m.accountBrand;
  await page.goto(bo(`/inscrits/${only.accountId}`));
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: new RegExp(`^${b.contactTitle}`),
    }),
  ).toBeVisible();
  await expect(page.getByText(b.contactLead)).toBeVisible();
  await expect(page.getByText(/^contact-.+@brand.example.test$/)).toBeVisible();
  await expect(page.getByText("+33612345678", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: b.profileTitle }),
  ).toBeVisible();
  await expect(
    page.getByText(r.statuses.rejected, { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("80 %", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      new RegExp(
        `^Refusé le .+ par Lou — motif : ${r.decision.reasonLabels.other} \\(décision après l’échéance\\)$`,
      ),
    ),
  ).toBeVisible();
  // RG123: said, and the message the brand received is not repeated there
  await expect(page.getByText(b.masked)).toBeVisible();
  await expect(page.getByText(clean)).toHaveCount(0);
  await expect(page.getByText("Appelé, sans réponse.")).toHaveCount(0);
});

test("L2C-17: a colleague's entry is read, not decided, in a sentence and without an error screen; the screen passes axe", async ({
  page,
}) => {
  const tag = runTag("q1o");
  await seedInternal(page, "agent", "Lou");
  const owner = await seedColleague("agent", "Noa");
  const holder = await seedColleague("agent", "Marie");
  const held = await seedReviewEntry({
    ownerAgentId: owner.accountId,
    name: `Maison ${tag}D`,
    dueInMinutes: -200,
    heldByAgentId: holder.accountId,
    logo: "active",
  });
  await serveLogo(page);
  await page.goto(entryPage(held.entryId));
  await expect(page.getByText(/^En cours — Marie, depuis /)).toBeVisible();
  // a colleague's entry shows the image too (15 C2)
  await expectLogoDrawn(page, `Maison ${tag}D`);
  await expect(page.getByText(r.banner.readOnly)).toBeVisible();
  await expect(page.getByText(/^Hors délai depuis /)).toBeVisible();
  await expect(
    page.getByRole("button", { name: new RegExp(`^${r.decision.publish}`) }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: r.force.button })).toHaveCount(
    0,
  );
  await expect(page.getByRole("alert").filter({ hasText: /[^ ]/ })).toHaveCount(
    0,
  );
  // the reader did not take it
  expect((await reviewEntryFacts(held.entryId)).claimedBy).toBe(
    holder.accountId,
  );
  for (const width of [1280, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expectNoAxeViolation(
      page,
      `décision profil marque à ${String(width)} px`,
      { wcag22: true },
    );
  }
});

test("L2C-17: a profile that changed after the reading refuses the decision, rereads the entry and keeps the typed text; the claim can be extended", async ({
  page,
}) => {
  const tag = runTag("q1s");
  const lou = await seedInternal(page, "agent", "Lou");
  const owner = await seedColleague("agent", "Noa");
  const mine = await seedReviewEntry({
    ownerAgentId: owner.accountId,
    name: `Maison ${tag}E`,
    dueInMinutes: 300,
    heldByAgentId: lou.accountId,
    claimExpiresInMinutes: 2,
  });
  await page.goto(entryPage(mine.entryId));

  // three minutes before the claim falls, the reminder is there, and extending says so
  await expect(
    page.getByText(/^Votre prise en charge expire dans [12] min\.$/),
  ).toBeVisible();
  await page.getByRole("button", { name: r.banner.extend }).click();
  await expect(
    page.getByText(/^Prise en charge prolongée jusqu’à /),
  ).toBeVisible();
  await expect(
    page.getByText(/^Votre prise en charge expire dans/),
  ).toHaveCount(0);

  await page
    .getByLabel(r.decision.comment)
    .fill("À relire avec le responsable.");
  await changePresentation(
    mine.accountId,
    "A completely different presentation of the brand, rewritten after the agent started reading it.",
  );
  await page
    .getByRole("button", { name: new RegExp(`^${r.decision.publish}`) })
    .click();
  await page.getByRole("button", { name: r.decision.publishConfirm }).click();

  // refused, read again, said; the draft and the claim stay, the entry is still open
  await expect(page.getByText(r.notices.stale)).toBeVisible();
  await expect(
    page.getByText(r.modifiedAfterLine(r.facts.presentation)),
  ).toBeVisible();
  await expect(
    page.getByText(/rewritten after the agent started reading it\./),
  ).toBeVisible();
  await expect(page.getByLabel(r.decision.comment)).toHaveValue(
    "À relire avec le responsable.",
  );
  expect(await reviewEntryFacts(mine.entryId)).toMatchObject({
    state: "open",
    claimedBy: lou.accountId,
  });
});

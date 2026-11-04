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
import { seedReviewEntry, withdrawReviewEntries } from "./support/review-queue";
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

// Queue 9 in the backoffice (docs/mvp/10 RG2, RG61, RG84; 15 RG26 to RG28, C1 to
// C3, AL23; 03 PD1 to PD7; 17b §2, §3.13.c, I13; jalons/l3g, commit 13, L3G-E2), in French only (the backoffice has no
// English before D36): an agent reads the requests of the brands for a selection by the team, opens one (which takes it
// in charge), reads its criteria and its message as plain text (a hidden bidirectional control is gone, the frame is
// `dir="auto"`), then closes it with a reason of the closed list, the note asked for « Autre » alone. The brand and its
// request are written by the base (the brand's screens are not under test); the screens' words are the locale files',
// never copies. The administrator's half of L3G-E2 (the thresholds of the critical mass, asked by an administrator and
// confirmed by an OTHER one on the screen of the dual control) lives in e2e/backoffice.spec.ts: that serial file is the
// one that seeds admins, whose peers its degraded dual control deactivates (playwright.config.ts). No amount, tariff or creator.
import { randomUUID } from "node:crypto";
import { messages as bo } from "../../backoffice/src/messages/fr";
import { expectNoAxeViolation } from "./support/axe";
import {
  retireInternals,
  runTag,
  seedColleague,
  seedInternal,
  seedSignup,
} from "./support/backoffice";
import { expect, test } from "./support/journey";
import { BACKOFFICE_ORIGIN } from "./support/servers";
import { withSql } from "./support/verification-cycle";

const Q = bo.teamSelectionQueue;
const R = bo.teamSelectionReview;

const brands: string[] = [];

test.afterAll(async () => {
  await withSql(async (sql) => {
    if (brands.length > 0) {
      await sql`
        delete from search.selection_requests
         where advertiser_account_id = any(${brands}::uuid[])`;
    }
  });
  await retireInternals();
});

test("L3G-E2: an agent opens a request of a brand, reads its criteria and its message as plain text, then closes it with a reason of the closed list, the note for « Autre » alone (10 RG61; 15 C1; 17b I13)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const tag = runTag("tq");
  const brandId = await seedSignup({
    tag,
    role: "advertiser",
    countryCode: "FR",
    language: "fr",
    consent: true,
  });
  brands.push(brandId);
  const owner = await seedColleague("agent", "Alice");
  const requestId = randomUUID();
  await withSql(async (sql) => {
    await sql`
      update identity.accounts set owner_agent_id = ${owner.accountId}
       where id = ${brandId}`;
    // a bidirectional control hidden in the text of the brand: the screen must not carry it
    await sql`
      insert into search.selection_requests
        (id, advertiser_account_id, filters, language, message, sla_due_at)
      values (${requestId}, ${brandId}, '{"F1": "beauty"}'::jsonb, 'fr',
              ${"Des créateurs soins du visage.\n‮egarotsni‬ Merci."},
              now() + interval '1 day')`;
  });
  const brandName = await withSql(async (sql) => {
    const [row] = await sql<{ name: string }[]>`
      select legal_name as name from profiles.advertiser_profiles where account_id = ${brandId}`;
    return row?.name ?? "";
  });
  await seedInternal(page, "agent", "Lou");

  // The list: the request among the others, its brand and its lock written; no message, no criterion.
  await page.goto(`${BACKOFFICE_ORIGIN}/files/selections-equipe`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    bo.queue.team_selection,
  );
  const link = page.getByRole("link", { name: Q.openEntryOf(brandName) });
  await expect(link).toBeVisible();
  await expect(page.locator("main")).not.toContainText("soins du visage");

  // Opening is claiming: the criteria and the message, the message as plain text in a frame `dir="auto"`.
  await link.click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    R.title(brandName),
  );
  await expect(
    page.getByText(/Vous avez pris cette entrée en charge à \d{2}:\d{2}\./),
  ).toBeVisible();
  const message = page.locator("[data-selection-message]");
  await expect(message).toHaveAttribute("dir", "auto");
  await expect(message).toContainText("Des créateurs soins du visage.");
  expect(await message.innerText()).not.toContain("‮");
  await expect(page.locator("[data-selection-criteria] li")).toHaveCount(1);
  const shown = await page.locator("main").innerText();
  for (const forbidden of [
    "€",
    "EUR",
    "Tarif",
    "tarif",
    "commission",
    "Exporter",
  ]) {
    expect(shown, forbidden).not.toContain(forbidden);
  }
  await expectNoAxeViolation(page, "team selection request, 1 440", {
    wcag22: true,
  });

  // The closure: no reason, no closure; « Autre » asks its note; another reason sends none.
  await page.getByRole("button", { name: R.decision.open }).click();
  const panel = page.getByRole("form", { name: R.decision.panelTitle });
  await panel.getByRole("button", { name: R.decision.confirm }).click();
  await expect(panel).toContainText(R.decision.reasonRequired);
  await panel.getByLabel(R.decision.reasons.other ?? "").check();
  await panel.getByRole("button", { name: R.decision.confirm }).click();
  await expect(panel).toContainText(R.decision.noteRequired(10, 500));
  await panel.getByLabel(R.decision.reasons.duplicate ?? "").check();
  await panel.getByRole("button", { name: R.decision.confirm }).click();

  // Closed: the base holds the reason and the agent, no note; nothing was sent to the brand.
  await expect
    .poll(async () =>
      withSql(async (sql) => {
        const [row] = await sql<
          { state: string; reason: string | null; note: string | null }[]
        >`
          select state::text as state, close_reason_code as reason, close_note as note
            from search.selection_requests where id = ${requestId}`;
        return JSON.stringify(row);
      }),
    )
    .toBe(JSON.stringify({ state: "closed", reason: "duplicate", note: null }));
});

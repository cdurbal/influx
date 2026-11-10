// Queues 5 and 6 in the backoffice (docs/mvp/08 RG77, RG78, RG98, CA52, CA54; 15 RG27 C1 to C8; 17b §2.7;
// jalons/l2f, commit 19), in French only (the backoffice has no English before D36): an agent reads the
// contests of badge decisions and decides one, then reads the identifiers changed after a verification and
// states that it is the same account. The states before the gesture (a refusal contested by its creator, a
// badge held whose handle was then changed) are written by the database, never by the screens of the
// member's journey. The texts are those of the locale files, never copies. Neither list shows a handle or a
// text of the creator; the decision screen does, to its holder. No figure, amount, rate or price anywhere.
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
import {
  seedBadge,
  seedNetworkLine,
  seedRefusal,
  withSql,
} from "./support/verification-cycle";

test.afterAll(async () => {
  await retireInternals();
});

/** A creator of a colleague's portfolio, so that the journey reads its own entries alone by `?owner=`. */
async function seedCreator(
  tag: string,
  owner: string,
  handle: string,
): Promise<string> {
  const accountId = await seedSignup({
    tag: runTag(tag),
    role: "creator",
    countryCode: "FR",
    language: "fr",
    consent: true,
  });
  await withSql(async (sql) => {
    await sql`update identity.accounts set owner_agent_id = ${owner} where id = ${accountId}`;
    await sql`
      insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
      values (${accountId}, profiles.new_creator_alias(), 'FR')`;
    await seedNetworkLine(sql, accountId, "tiktok", handle);
  });
  return accountId;
}

const D = bo.disputeReview;
const I = bo.identifierReview;

test("an agent reads the contests of badge decisions and confirms one: the creator's text only on the decision screen, the motive of the closed list, the state written (08 RG77, CA52, RG98; 15 C1 à C8)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const decider = await seedColleague("agent", "Noa");
  const accountId = await seedCreator("qd", decider.accountId, "noa_tiktok");
  const text = "Mon compte est bien le mien, le code est visible.";
  await withSql(async (sql) => {
    const requestId = await seedRefusal(
      sql,
      accountId,
      decider.accountId,
      "tiktok",
      "ownership_not_proven",
    );
    await sql`
      insert into verification.disputes
        (account_id, request_id, level, network_code, reason_code, text, original_decider_ids)
      values (${accountId}, ${requestId}, 'account_verified', 'tiktok', 'misread', ${text},
              ${[decider.accountId]}::uuid[])`;
  });
  await seedInternal(page, "agent", "Lou");

  // The list: what is contested and by whom, the state written; no handle, no text of the creator.
  await page.goto(
    `${BACKOFFICE_ORIGIN}/files/contestations?owner=${decider.accountId}`,
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: bo.queue.verification_disputes,
    }),
  ).toBeVisible();
  const table = page.getByRole("region", {
    name: bo.disputeQueue.tableLabel,
    exact: true,
  });
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table).toContainText(bo.disputeQueue.kinds.refusal);
  await expect(table).toContainText("TikTok");
  await expect(table).toContainText(bo.disputeQueue.reasons.misread ?? "");
  expect(await page.locator("main").innerText()).not.toMatch(
    /noa_tiktok|code est visible/,
  );
  await expect(
    page.getByLabel(bo.queueList.alert, { exact: true }),
  ).toHaveCount(0);
  await table.getByRole("link").click();

  // The decision screen: opening takes it in charge; the text of the creator and what is contested are there.
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    D.title(bo.disputeQueue.kinds.refusal, "TikTok", "Compte vérifié"),
  );
  await expect(page.getByText(text)).toBeVisible();
  await expect(page.getByText("noa_tiktok")).toBeVisible();
  await expect(page.getByText(D.mode.independent)).toBeVisible();
  await expect(
    page.getByText(/Vous avez pris cette entrée en charge à \d{2}:\d{2}\./),
  ).toBeVisible();

  // ‹r› opens the panel of the confirmation and never decides; the motive is asked, the sentence the creator
  // reads is shown, and the state is written when it is done.
  await page.keyboard.press("r");
  const panel = page.getByRole("form", { name: D.decision.upholdTitle });
  await expect(panel).toBeVisible();
  await expectNoAxeViolation(page, "contestation, confirmation", {
    wcag22: true,
  });
  await panel.getByRole("button", { name: D.decision.upholdConfirm }).click();
  await expect(panel.getByText(D.decision.upholdRequired)).toBeVisible();
  await panel
    .getByLabel(D.decision.outcomeLabels.decision_confirmed ?? "")
    .check();
  await expect(panel.locator("[data-member-sentence]")).toBeVisible();
  await panel.getByRole("button", { name: D.decision.upholdConfirm }).click();
  await expect(
    page.getByRole("status").filter({
      hasText: D.notices.upheld(bo.disputeQueue.kinds.refusal, "TikTok"),
    }),
  ).toBeVisible();
  const [row] = await withSql(
    (sql) => sql<{ state: string; reason: string; mode: string }[]>`
      select state::text as state, outcome_reason_code as reason, review_mode as mode
        from verification.disputes where account_id = ${accountId}`,
  );
  expect(row).toEqual({
    state: "upheld",
    reason: "decision_confirmed",
    mode: "independent",
  });
});

test("an agent reads the identifiers changed after a verification and states that it is the same account: the identifiers only on the decision screen, the handle typed and compared, the badge kept (08 RG78, CA54, RG98; 15 C1 à C8)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const colleague = await seedColleague("agent", "Noa");
  const accountId = await seedCreator("qi", colleague.accountId, "noa_tiktok");
  const handle = "noa_tiktok_new";
  await withSql(async (sql) => {
    await seedBadge(sql, accountId, colleague.accountId, {
      networkCode: "tiktok",
      level: "account_verified",
      state: "active",
    });
    // the creator changes his handle after the verification. The trigger of 0233 opens the entry for the
    // creator's own session only (its policy reads the caller), so the entry it would have opened is written
    // as it leaves it: the former handle is the badge's, the deadlines are set by the database.
    await sql`
      update profiles.creator_social_accounts set handle = ${handle}
       where account_id = ${accountId} and network_code = 'tiktok'`;
    await sql`
      insert into verification.identifier_change_reviews
        (account_id, social_account_id, network_code, badge_id, previous_handle, new_handle,
         sla_due_at, escalate_at)
      select b.account_id, b.social_account_id, b.network_code, b.id, b.observed_handle_at_decision,
             ${handle}, now(), now()
        from verification.badges b
       where b.account_id = ${accountId} and b.level = 'account_verified'`;
  });
  await seedInternal(page, "agent", "Lou");

  await page.goto(
    `${BACKOFFICE_ORIGIN}/files/identifiants-modifies?owner=${colleague.accountId}`,
  );
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: bo.queue.identity_change_review,
    }),
  ).toBeVisible();
  const table = page.getByRole("region", {
    name: bo.identifierQueue.tableLabel,
    exact: true,
  });
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table).toContainText("TikTok");
  await expect(table).toContainText(bo.identifierQueue.changes(1));
  expect(await page.locator("main").innerText()).not.toMatch(
    /noa_tiktok|handle_/,
  );
  await table.getByRole("link").click();

  // The decision screen: the former and the new identifier, said internal, and the badge held.
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    I.title("TikTok"),
  );
  await expect(page.getByText(handle, { exact: true })).toBeVisible();
  await expect(page.getByText(/^handle_[0-9a-f]{8}$/)).toBeVisible();
  await expect(page.getByText(I.internalOnly)).toBeVisible();
  await expect(
    page.getByText(/« Compte vérifié » : .+, accordé le /),
  ).toBeVisible();

  // ‹v› opens the statement; a handle that is not the declared one is refused and said, then the right one.
  await page.keyboard.press("v");
  const panel = page.getByRole("form", { name: I.decision.confirmTitle });
  await expect(panel).toBeVisible();
  await panel.getByLabel(I.decision.handle).fill("quelquun_dautre");
  await panel.getByRole("button", { name: I.decision.confirmConfirm }).click();
  await expect(
    panel.getByText(bo.claimedReview.refusals.handleMismatch),
  ).toBeVisible();
  await panel.getByLabel(I.decision.handle).fill(handle);
  await panel.getByRole("button", { name: I.decision.confirmConfirm }).click();
  await expect(
    page.getByRole("status").filter({ hasText: I.notices.confirmed("TikTok") }),
  ).toBeVisible();
  const [row] = await withSql(
    (sql) => sql<{ review: string; badge: string }[]>`
      select r.state::text as review, b.state::text as badge
        from verification.identifier_change_reviews r
        join verification.badges b on b.account_id = r.account_id and b.level = 'account_verified'
       where r.account_id = ${accountId}`,
  );
  expect(row).toEqual({ review: "confirmed", badge: "active" });
});

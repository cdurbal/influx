// The withdrawal of a badge in the backoffice (docs/mvp/08 RG70, RG73 to RG76, CA49 to CA51; 06 RG55; 03
// PD1 to PD7; 15 RG75; 17b §3.6, §3.13.c; jalons/l2f, commit 18), in French only (the backoffice has no
// English before D36): an agent reads the badges of a creator's account, asks for the withdrawal of a
// « Compte vérifié » with a reason and the message the reason asks for, then an administrator confirms it on
// the screen of the double validation, and the badge goes. The states a badge is in before the gesture (two
// badges that stand, one already withdrawn) are written by the database, never by the screens of the
// member's journey or by the 2V of the case (support/verification-cycle.ts). The texts are those of the
// locale files, never copies. No figure, no handle, no amount, rate or price anywhere.
// L2F-20 (D83 A) extends it: the administrator then opens the verification of the other line himself.
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
  seedRevokedBadge,
  withSql,
} from "./support/verification-cycle";

test.afterAll(async () => {
  await retireInternals();
});

const T = bo.accountBadges;

test("an agent asks for the withdrawal of a « Compte vérifié » and an administrator confirms it: the badge and its audience leave the account's page, with the reason (08 RG73 to RG76, CA49 to CA51; 06 RG55; 03 PD1)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const accountId = await seedSignup({
    tag: runTag("rv"),
    role: "creator",
    countryCode: "FR",
    language: "fr",
    consent: true,
  });
  const colleague = await seedColleague("agent", "Noa");
  await withSql(async (sql) => {
    // the storefront, as the sign-up writes it (0216): the public row the withdrawal recomputes
    await sql`
      insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
      values (${accountId}, profiles.new_creator_alias(), 'FR')`;
    await seedNetworkLine(sql, accountId, "tiktok", "noa_tiktok");
    await seedNetworkLine(sql, accountId, "youtube", "noa_youtube");
    for (const level of ["account_verified", "audience_verified"] as const) {
      await seedBadge(sql, accountId, colleague.accountId, {
        networkCode: "tiktok",
        level,
        state: "active",
      });
    }
    await seedRevokedBadge(sql, accountId, colleague.accountId, {
      networkCode: "youtube",
      reason: "influx_error",
      memberMessage: null,
    });
  });
  const badgeName = "Compte vérifié · TikTok";
  const address = `${BACKOFFICE_ORIGIN}/inscrits/${accountId}`;

  // The agent reads the block: every badge written, the history after those that stand, no figure and
  // no handle of a network (the dossier of the queue holds them, and its reading is journaled).
  await seedInternal(page, "agent", "Lou");
  await page.goto(address);
  const block = page.getByRole("region", { name: T.tableLabel });
  await expect(block.locator("[data-badge-row=active]")).toHaveCount(2);
  await expect(block.locator("[data-badge-row=revoked]")).toContainText(
    `${T.state.revoked}motif : ${bo.dualControl.reasons.influx_error}`,
  );
  await expect(block).toContainText(T.date.neverExpires);
  await expect(block).toContainText(/expire le \d{2}\/\d{2}\/\d{4}/);
  const section = page.getByRole("region", { name: T.title });
  const shown = await section.innerText();
  expect(shown).not.toMatch(/noa_|handle_|47\s?300/);

  // The ask: a reason of the level, the message the reason requires, the recap said before the gesture.
  await block
    .getByRole("button", { name: T.requestWithdrawalOf(badgeName) })
    .click();
  const form = page.getByRole("form", { name: T.formTitle(badgeName) });
  await expect(form.getByLabel(T.reason)).toBeFocused();
  await expect(
    form.getByRole("option", {
      name: bo.dualControl.reasons.company_dissolved,
    }),
  ).toHaveCount(0);
  await form
    .getByLabel(T.reason)
    .selectOption({ label: bo.dualControl.reasons.terms_breach });
  await expect(form.getByText(T.escalated)).toBeVisible();
  await expect(form.locator("[data-member-sentence]")).toContainText(
    "Votre profil ne respecte pas les conditions d",
  );
  for (const line of [
    T.recap.withdrawn,
    T.recap.cascade,
    T.recap.irreversible,
  ]) {
    await expect(form.getByText(line)).toBeVisible();
  }
  await expectNoAxeViolation(page, "fiche de compte, demande de retrait", {
    wcag22: true,
  });
  await form.getByRole("button", { name: T.submit }).click();
  await expect(
    form.getByRole("alert").filter({
      hasText: T.memberMessageInvalid(20, 500),
    }),
  ).toBeVisible();
  await form
    .getByLabel(/^Message au membre/)
    .fill("Votre profil enfreint les conditions d’utilisation d’INFLUX.");
  await form.getByRole("button", { name: T.submit }).click();

  // Nothing is withdrawn by the ask: the badge stands, the 2V waits, and the ask is no longer offered.
  await expect(
    page.getByRole("status").filter({ hasText: T.sentAgent }),
  ).toBeVisible();
  const asked = block.locator("[data-badge-row=active]", {
    hasText: badgeName,
  });
  await expect(asked).toContainText(T.pending.pending ?? "");
  await expect(
    block.getByRole("button", { name: T.requestWithdrawalOf(badgeName) }),
  ).toHaveCount(0);
  const requestId = await withSql(async (sql) => {
    const rows = await sql<{ id: string; state: string }[]>`
      select r.dual_control_request_id::text as id, b.state
        from verification.badge_revocation_requests r
        join verification.badges b on b.id = r.badge_id
       where r.account_id = ${accountId} and r.executed_at is null`;
    expect(rows.map((row) => row.state)).toEqual(["active"]);
    return rows[0]?.id ?? "";
  });

  // An administrator, distinct from the agent, confirms on the screen of the double validation (PD2): the
  // badge named by its level, its network and its state, the message, what the withdrawal does.
  await seedInternal(page, "admin", "Ilan");
  await page.goto(`${BACKOFFICE_ORIGIN}/double-validation/${requestId}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    bo.dualControl.requestTitle,
  );
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: bo.dualControl.actions["verification.revoke_badge"],
    }),
  ).toBeVisible();
  await expect(
    page.getByText(
      bo.dualControl.target.badgeLine(
        "Compte vérifié",
        "TikTok",
        T.state.active ?? "",
      ),
    ),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Votre profil enfreint les conditions d’utilisation d’INFLUX.",
    ),
  ).toBeVisible();
  await expect(page.getByText(bo.dualControl.scope(2))).toBeVisible();
  for (const code of [
    "badge_withdrawn",
    "audience_badge_withdrawn",
    "public_row_recomputed",
    "member_notified",
    "member_may_appeal",
  ] as const) {
    await expect(
      page.getByRole("listitem").filter({
        hasText: bo.dualControl.consequences[code],
      }),
    ).toBeVisible();
  }
  await expect(page.getByText(bo.dualControl.reversible(false))).toBeVisible();
  await expect(page.locator("main")).not.toContainText(accountId);
  await page.getByRole("button", { name: bo.dualControl.confirm }).click();
  await expect(
    page.getByRole("status").filter({ hasText: bo.dualControl.done(false) }),
  ).toBeVisible();

  // The badge and the audience it carries are gone from those that stand, and written as withdrawn with
  // the reason; the withdrawal of the database is whole (08 RG76).
  await page.goto(address);
  await expect(block.locator("[data-badge-row=revoked]")).toHaveCount(3);
  await expect(block.locator("[data-badge-row=active]")).toHaveCount(0);
  await expect(
    block.locator("[data-badge-row=revoked]", { hasText: badgeName }),
  ).toContainText(`motif : ${bo.dualControl.reasons.terms_breach}`);
  await expect(
    block.getByRole("button", { name: T.requestWithdrawal }),
  ).toHaveCount(0);
  const states = await withSql(
    (sql) => sql<{ level: string; state: string; reason: string | null }[]>`
      select level::text as level, state, revocation_reason_code as reason
        from verification.badges
       where account_id = ${accountId} and network_code = 'tiktok'
       order by level`,
  );
  expect(states).toEqual([
    { level: "account_verified", state: "revoked", reason: "terms_breach" },
    { level: "audience_verified", state: "revoked", reason: "terms_breach" },
  ]);

  // L2F-20 (D83 A): the administrator, who knows the member, opens the verification of the other line
  // himself: a reason of the closed list, an internal comment, what the member will receive. The request
  // waits in queue 4 with its origin; the comment is read in the dossier only, never on the page of the
  // account, never by the member.
  const open = bo.accountOpening;
  const line = "Compte vérifié · YouTube";
  const offered = page.getByRole("region", { name: open.tableLabel });
  await expect(offered.locator("[data-opening-row]")).toHaveCount(2);
  await offered.getByRole("button", { name: open.launchOf(line) }).click();
  const launch = page.getByRole("form", { name: open.formTitle(line) });
  await expect(launch.getByLabel(open.reason)).toBeFocused();
  await expect(launch.getByText(open.recapCreator("YouTube"))).toBeVisible();
  await launch.getByRole("button", { name: open.submit }).click();
  await expect(
    launch.getByRole("alert").filter({ hasText: bo.common.reasonPlaceholder }),
  ).toBeVisible();
  await launch
    .getByLabel(open.reason)
    .selectOption({ label: open.reasons.other ?? "" });
  await launch.getByRole("button", { name: open.submit }).click();
  await expect(
    launch.getByRole("alert").filter({ hasText: open.commentMissing }),
  ).toBeVisible();
  await launch.getByLabel(open.commentRequired).fill("Met at the Lyon fair.");
  await launch.getByRole("button", { name: open.submit }).click();
  await expect(
    page.getByRole("status").filter({ hasText: open.created(line) }),
  ).toBeVisible();
  await expect(
    offered.locator("[data-opening-row]", { hasText: line }),
  ).toContainText(open.request.agent?.pending ?? "");
  await expect(page.getByRole("main")).not.toContainText("Lyon fair");
  const opened = await withSql(async (sql) => {
    const rows = await sql<{ opened_by: string; status: string }[]>`
      select opened_by, status::text as status
        from verification.verification_requests
       where account_id = ${accountId} and level = 'account_verified'
         and status = 'pending'`;
    return rows;
  });
  expect(opened).toEqual([{ opened_by: "agent", status: "pending" }]);

  // the dossier says who opened the request and why, to the agents only (the comment is internal)
  await offered
    .locator("[data-opening-row]", { hasText: line })
    .getByRole("link", { name: open.openRequest })
    .click();
  const origin = page.locator("[data-opening-origin=agent]");
  await expect(origin).toContainText(bo.verificationReview.opening.agent);
  await expect(origin).toContainText(open.reasons.other ?? "");
  await expect(origin).toContainText("Met at the Lyon fair.");
});

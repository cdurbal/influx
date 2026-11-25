// The states of a campaign and the passages of a brand (docs/mvp/09 RG3, RG8, RG9, RG10, RG90, RG109, CA59, CA74;
// 17 §4.9; jalons/l3c, commit 10, L3C-E3): the six states written in the list with the reason of a refusal and the
// step that follows (French, 375 px, axe); a published campaign paused, resumed, then closed behind a confirmation
// that says it is final (English, 1 440 px, axe); a pause of INFLUX the brand cannot lift, and a refused campaign
// that stays editable (French). The brand and its campaigns are written by the API's routes and the base (the
// decisions are not under test); the texts are the locale files', never copies. No amount anywhere. Budget 5 s.
import enCampaign from "@/locales/en/campaign.json" with { type: "json" };
import frCampaign from "@/locales/fr/campaign.json" with { type: "json" };
import { seedMember } from "./support/account";
import { expectNoAxeViolation } from "./support/axe";
import { retireInternals, seedColleague } from "./support/backoffice";
import { ownBrand, removeOwnCampaigns } from "./support/campaign-cleanup";
import {
  campaignStateOf,
  seedCampaignInState,
  withdrawOpenEntries,
} from "./support/campaign-states";
import { expect, open, test, title } from "./support/journey";
import { computed, contrast, rgbaOf, tokenColor } from "./support/rendering";
import { withSql } from "./support/verification-cycle";

test.afterAll(async () => {
  await removeOwnCampaigns();
  await retireInternals();
});

/** The colleague who decides the campaigns of the journeys, seeded once (the e2e budget counts every insert). */
let deciderOnce: ReturnType<typeof seedColleague> | null = null;
function decider(): ReturnType<typeof seedColleague> {
  deciderOnce ??= seedColleague("agent", "Alice");
  return deciderOnce;
}

/** A brand with a published profile (the decision of its queue is L2C's), signed in on this page. */
async function signedInBrand(
  page: Parameters<typeof seedMember>[0],
  language: "fr" | "en",
) {
  const member = await seedMember(page, {
    role: "advertiser",
    language,
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  ownBrand(member.accountId);
  await withSql(async (sql) => {
    await sql`
      update profiles.advertiser_profiles
         set status = 'published', submitted_at = now(), first_published_at = now()
       where account_id = ${member.accountId}`;
  });
  return member;
}

test("L3C-E3 L3D-T1: my campaigns tell their six states in words, with the reason of a refusal and the step that follows (RG10, RG90, CA59, CA74), in French at 375 px", async ({
  page,
}) => {
  const copy = frCampaign;
  await page.setViewportSize({ width: 375, height: 800 });
  const colleague = await decider();
  await signedInBrand(page, "fr");
  const states = [
    "draft",
    "pending_review",
    "published",
    "paused",
    "closed",
    "rejected",
  ] as const;
  const ids = await Promise.all(
    states.map((state) =>
      seedCampaignInState(page, {
        title: `Campagne ${state}`,
        state,
        decider: colleague.accountId,
        refusal: { reasonCode: "contact_in_text" },
      }),
    ),
  );

  await open(page, "/fr/campagnes");
  await expect(title(page)).toHaveText(copy.list.title);
  const main = page.locator("main");
  for (const state of states) {
    const row = main.locator("li", { hasText: `Campagne ${state}` });
    await expect(
      row.getByText(copy.status.label[state], { exact: true }),
    ).toBeVisible();
  }
  // the refusal: its reason in words, then what to do; the generic sentence is not told instead
  const refused = main.locator("li", { hasText: "Campagne rejected" });
  await expect(refused).toContainText(
    copy.status.rejected.replace("{reason}", copy.rejection.contact_in_text),
  );
  await expect(refused).toContainText(copy.refusal.fix);
  await expect(main.getByText(copy.status.rejectedNoReason)).toHaveCount(0);
  await expect(main.getByText(copy.status.paused)).toBeVisible();
  const screen = await main.innerText();
  for (const forbidden of ["€", "EUR", "commission"]) {
    expect(screen, forbidden).not.toContain(forbidden);
  }
  await expectNoAxeViolation(page, "my campaigns states, fr, 375", {
    wcag22: true,
  });
  await withdrawOpenEntries(ids);
});

test("L3C-E3 L3D-T1: a brand pauses, resumes and closes its published campaign, the closing confirmed as final (RG8, RG9, 17 §4.9), in English at 1 440 px", async ({
  page,
}) => {
  const copy = enCampaign;
  await page.setViewportSize({ width: 1440, height: 900 });
  const colleague = await decider();
  await signedInBrand(page, "en");
  const id = await seedCampaignInState(page, {
    title: "Live campaign",
    state: "published",
    decider: colleague.accountId,
  });

  await open(page, `/en/campaigns/${id}`);
  await expect(
    page.getByText(copy.status.label.published, { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: copy.lifecycle.pause }).click();
  await expect(page.getByText(copy.lifecycle.done.pause)).toBeVisible();
  await expect(
    page.getByText(copy.status.label.paused, { exact: true }),
  ).toBeVisible();
  expect(await campaignStateOf(id)).toBe("paused");

  await page.getByRole("button", { name: copy.lifecycle.resume }).click();
  await expect(page.getByText(copy.lifecycle.done.resume)).toBeVisible();
  await expect(
    page.getByText(copy.status.label.published, { exact: true }),
  ).toBeVisible();

  // closing says it is final BEFORE it is done; cancelling changes nothing
  await page.getByRole("button", { name: copy.lifecycle.close }).click();
  await expect(page.getByText(copy.lifecycle.closeWarning)).toBeVisible();
  await expectNoAxeViolation(page, "campaign closing confirmation, en, 1 440", {
    wcag22: true,
  });
  await page.getByRole("button", { name: copy.lifecycle.cancel }).click();
  await expect(page.getByText(copy.lifecycle.closeWarning)).toHaveCount(0);
  expect(await campaignStateOf(id)).toBe("published");

  await page.getByRole("button", { name: copy.lifecycle.close }).click();
  await page.getByRole("button", { name: copy.lifecycle.closeConfirm }).click();
  await expect(page.getByText(copy.lifecycle.done.close)).toBeVisible();
  await expect(
    page.getByText(copy.status.label.closed, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: copy.lifecycle.pause }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: copy.lifecycle.close }),
  ).toHaveCount(0);
  expect(await campaignStateOf(id)).toBe("closed");
});

test("L3C-E3 L3D-T1: a pause of INFLUX is not the brand's to lift, and a refused campaign states its reason and stays editable (RG8, RG10, CA59), in French", async ({
  page,
}) => {
  const copy = frCampaign;
  await page.setViewportSize({ width: 1440, height: 900 });
  const colleague = await decider();
  await signedInBrand(page, "fr");
  const message = "Merci de retirer le numéro de téléphone du résumé.";
  const [paused, refused] = await Promise.all([
    seedCampaignInState(page, {
      title: "Campagne mise en pause",
      state: "paused",
      decider: colleague.accountId,
    }),
    seedCampaignInState(page, {
      title: "Campagne refusée",
      state: "rejected",
      decider: colleague.accountId,
      refusal: { reasonCode: "other", memberMessage: message },
    }),
  ]);

  await open(page, `/fr/campagnes/${paused}`);
  await page.getByRole("button", { name: copy.lifecycle.resume }).click();
  await expect(
    page.getByText(copy.lifecycle.failed.pausedByInflux),
  ).toBeVisible();
  await expect(
    page.getByText(copy.status.label.paused, { exact: true }),
  ).toBeVisible();
  expect(await campaignStateOf(paused)).toBe("paused");

  // X3: the locked form (step 1) still shows what is chosen: a checked radio is a drawn shape that reads on the
  // card and differs from an unchecked one (never the browser's grey), and a locked value stays readable
  const card = await tokenColor(page, "--color-surface-card");
  const raised = await tokenColor(page, "--color-surface-raised");
  if (card === null || raised === null) {
    throw new Error("a surface token is not declared");
  }
  const checked = page.locator('input[name="productIsSent"]:checked');
  const unchecked = page.locator('input[name="productIsSent"]:not(:checked)');
  await expect(checked).toBeDisabled();
  expect(await computed(checked, "appearance")).toBe("none");
  const mark = rgbaOf(await computed(checked, "background-color"));
  const ring = rgbaOf(await computed(checked, "border-top-color"));
  const emptyRing = rgbaOf(await computed(unchecked, "border-top-color"));
  const emptyGround = rgbaOf(await computed(unchecked, "background-color"));
  if (
    mark === null ||
    ring === null ||
    emptyRing === null ||
    emptyGround === null
  ) {
    throw new Error("a radio color is unread");
  }
  expect(contrast(mark, card)).toBeGreaterThanOrEqual(3);
  expect(contrast(ring, card)).toBeGreaterThanOrEqual(3);
  expect(contrast(emptyRing, card)).toBeGreaterThanOrEqual(3);
  expect(emptyGround.a).toBe(0);
  expect(mark.a).toBe(1);
  const currency = rgbaOf(
    await computed(page.locator('select[name="currency"]'), "color"),
  );
  if (currency === null) throw new Error("the currency color is unread");
  expect(contrast(currency, raised)).toBeGreaterThanOrEqual(4.5);

  await open(page, `/fr/campagnes/${refused}`);
  await expect(
    page.getByText(copy.status.label.rejected, { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      copy.status.rejected.replace("{reason}", copy.rejection.other),
    ),
  ).toBeVisible();
  await expect(page.getByText(message)).toBeVisible();
  await expect(page.getByText(copy.refusal.contact)).toBeVisible();
  // still written by the brand, and no passage is offered on a refused campaign
  await expect(page.locator("fieldset[disabled]")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: copy.lifecycle.close }),
  ).toHaveCount(0);
});

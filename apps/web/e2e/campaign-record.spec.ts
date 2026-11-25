// The record of a campaign in the backoffice (docs/mvp/09 RG1, RG8, RG9, RG83, RG93, RG94, CA60, CA61; 15 RG36; 17b
// §3.5 block 4, §3.8; jalons/l3c, commit 09, L3C-E2), in French only (the backoffice has no English before D36):
// an agent opens a draft for a brand from its account record (a title and a type, nothing else: the brand
// completes and submits it) then corrects ONE field of it (the value now, the new value, a typed reason that is
// compulsory, the brand told); and, on a published campaign, pauses it, resumes it and closes it for good (a reason
// each time, a comment for « Autre », the closing confirmed). The brands and their campaigns are written by the
// API's own routes (the brand's screens are not under test); the acts are the screens'. The texts are the locale
// files', never copies. No amount, rate or price anywhere: the budget is a band by its label, the total is
// « non communiqué » (D78, D48).
import { messages as bo } from "../../backoffice/src/messages/fr";
import { expectNoAxeViolation } from "./support/axe";
import {
  retireInternals,
  runTag,
  seedColleague,
  seedInternal,
} from "./support/backoffice";
import { ownBrand, removeOwnCampaigns } from "./support/campaign-cleanup";
import {
  brandAccount,
  campaignActsOf,
  publishAsAgent,
  submittedCampaign,
} from "./support/campaign-review";
import { expect, test } from "./support/journey";
import { BACKOFFICE_ORIGIN } from "./support/servers";

test.afterAll(async () => {
  await removeOwnCampaigns();
  await retireInternals();
});

const C = bo.campaignRecord;
const R = bo.campaignReview;

/** The colleague who owns the brands of the journeys: an agent acts on a campaign of an account he does not hold. */
let commercialOnce: ReturnType<typeof seedColleague> | null = null;
function commercial(): ReturnType<typeof seedColleague> {
  commercialOnce ??= seedColleague("agent", "Alice");
  return commercialOnce;
}

test("an agent opens a draft for a brand (a title and a type), then corrects its title: the value now shown, a typed reason compulsory, every act kept, the brand told (09 RG1, RG94, CA60, CA61)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const owner = await commercial();
  const tag = runTag("D");
  const title = `Brouillon ${tag}`;
  const corrected = `Brouillon corrigé ${tag}`;
  const brand = await brandAccount(page, {
    name: tag,
    ownerAgentId: owner.accountId,
  });
  ownBrand(brand.accountId);
  const agent = await seedInternal(page, "agent", "Lou");

  // The account record: a title and a type, nothing else; the type is compulsory.
  await page.goto(`${BACKOFFICE_ORIGIN}/inscrits/${brand.accountId}`);
  const block = page.getByRole("region", { name: C.create.title });
  await expect(block).toContainText(C.create.lead);
  await block.getByLabel(C.create.titleLabel).fill(title);
  await block.getByRole("button", { name: C.create.confirm }).click();
  await expect(page.getByText(C.create.typeRequired)).toBeVisible();
  await block.getByLabel(C.create.typeLabel).selectOption("contest");
  await block.getByRole("button", { name: C.create.confirm }).click();
  await expect(page.getByText(C.create.done(title))).toBeVisible();
  await page.getByRole("link", { name: C.create.open }).click();

  // The record of the draft: the brand, the state, the act in the history, the internal block with no figure.
  await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
  await expect(
    page.getByText(/Consultation enregistrée à votre nom, le /),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: R.sections.brand }),
  ).toContainText(brand.brandName);
  await expect(
    page.getByRole("region", { name: C.sections.cycle }),
  ).toContainText("brouillon");
  await expect(
    page.getByRole("region", { name: C.sections.history }),
  ).toContainText("Créée pour la marque");
  await expect(
    page.getByRole("region", { name: R.sections.campaign }),
  ).toContainText("Concours ou jeu concours");
  await expect(
    page.getByRole("region", { name: C.sections.internal }),
  ).toContainText(C.internal.totalBudgetValue);
  const screen = await page.locator("main").innerText();
  for (const forbidden of ["€", "EUR", "commission", "net créateur"]) {
    expect(screen, forbidden).not.toContain(forbidden);
  }
  await expectNoAxeViolation(page, "campaign record, 1 440", { wcag22: true });
  const campaignId = page.url().split("/").pop() ?? "";

  // The correction: the field, its value now, the new value; no reason, no correction.
  await page.getByRole("button", { name: C.actions.correct }).click();
  const panel = page.getByRole("form", { name: C.correct.title });
  await expect(panel).toContainText(C.correct.scope);
  await panel.getByLabel(C.correct.field).selectOption("title");
  await expect(panel.locator("[data-current-value]")).toHaveText(title);
  await panel.getByLabel(C.correct.newValue).fill(corrected);
  await panel.getByRole("button", { name: C.correct.confirm }).click();
  await expect(page.getByText(C.actions.reasonRequired)).toBeVisible();
  expect(
    (await campaignActsOf(campaignId)).interventions.map(({ kind }) => kind),
  ).toEqual(["created"]);

  await panel.getByLabel(C.actions.reasons.entry_error).check();
  await expect(panel).toContainText(C.actions.informed("français"));
  await panel.getByRole("button", { name: C.correct.confirm }).click();
  await expect(page.getByText(C.correct.done)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    corrected,
  );
  const history = page.getByRole("region", { name: C.sections.history });
  await expect(history).toContainText("Champ corrigé");
  await expect(history).toContainText(`Ancienne valeur : ${title}.`);
  await expect(history).toContainText(`Nouvelle valeur : ${corrected}.`);

  const acts = await campaignActsOf(campaignId);
  expect(acts.title).toBe(corrected);
  expect(acts.status).toBe("draft");
  expect(acts.interventions).toEqual([
    {
      kind: "created",
      fieldCode: null,
      oldValue: null,
      newValue: { title, campaignType: "contest" },
      reasonCode: "brand_request",
      internalComment: null,
      agentAccountId: agent.accountId,
    },
    {
      kind: "corrected",
      fieldCode: "title",
      oldValue: title,
      newValue: corrected,
      reasonCode: "entry_error",
      internalComment: null,
      agentAccountId: agent.accountId,
    },
  ]);
});

test("a published campaign is paused, resumed and closed by an agent: a reason each time, a comment for « Autre », the closing final (09 RG8, RG9, RG93)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const owner = await commercial();
  const tag = runTag("P");
  const campaign = await submittedCampaign(page, {
    title: `Gamme ${tag}`,
    ownerAgentId: owner.accountId,
  });
  ownBrand(campaign.accountId);
  const agent = await seedInternal(page, "agent", "Lou");

  // Published (by the API's own routes): frozen for the correction, offered the pause and the closing.
  await publishAsAgent(page, campaign.entryId, agent.accountId);
  await page.goto(
    `${BACKOFFICE_ORIGIN}/inscrits/campagnes/${campaign.campaignId}`,
  );
  const cycle = page.getByRole("region", { name: C.sections.cycle });
  await expect(cycle).toContainText("publiée");
  await expect(cycle).toContainText("version 1");
  await expect(page.getByText(C.actions.frozen)).toBeVisible();
  await expect(
    page.getByRole("button", { name: C.actions.correct }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: C.actions.pause }).click();
  const pause = page.getByRole("form", { name: C.passage.pause.title });
  await pause.getByRole("button", { name: C.passage.pause.confirm }).click();
  await expect(page.getByText(C.actions.reasonRequired)).toBeVisible();
  await pause.getByLabel(C.actions.reasons.brand_request).check();
  await pause.getByRole("button", { name: C.passage.pause.confirm }).click();
  await expect(page.getByText(C.passage.pause.done)).toBeVisible();
  await expect(cycle).toContainText("en pause");
  await expect(cycle).toContainText("INFLUX");

  await page.getByRole("button", { name: C.actions.resume }).click();
  const resume = page.getByRole("form", { name: C.passage.resume.title });
  await resume.getByLabel(C.actions.reasons.entry_error).check();
  await resume.getByRole("button", { name: C.passage.resume.confirm }).click();
  await expect(page.getByText(C.passage.resume.done)).toBeVisible();
  await expect(cycle).toContainText("publiée");

  // The closing is confirmed, « Autre » asks for its comment, and nothing is offered afterwards.
  await page.getByRole("button", { name: C.actions.close }).click();
  const close = page.getByRole("form", { name: C.passage.close.title });
  await expect(close).toContainText(C.passage.close.lead);
  await close.getByLabel(C.actions.reasons.other).check();
  await close.getByRole("button", { name: C.passage.close.confirm }).click();
  await expect(page.getByText(C.actions.commentRequired)).toBeVisible();
  await close.getByLabel(C.actions.comment).fill("Doublon constaté à l’appel.");
  await close.getByRole("button", { name: C.passage.close.confirm }).click();
  await expect(page.getByText(C.passage.close.done)).toBeVisible();
  await expect(cycle).toContainText("close");
  await expect(page.getByText(C.actions.closedNote)).toBeVisible();
  await expect(page.getByRole("button", { name: C.actions.close })).toHaveCount(
    0,
  );

  const acts = await campaignActsOf(campaign.campaignId);
  expect(acts.status).toBe("closed");
  expect(acts.closedAt).not.toBeNull();
  expect(
    acts.interventions.map(({ kind, reasonCode, internalComment }) => ({
      kind,
      reasonCode,
      internalComment,
    })),
  ).toEqual([
    { kind: "paused", reasonCode: "brand_request", internalComment: null },
    { kind: "resumed", reasonCode: "entry_error", internalComment: null },
    {
      kind: "closed",
      reasonCode: "other",
      internalComment: "Doublon constaté à l’appel.",
    },
  ]);
  expect(
    acts.interventions.every((act) => act.agentAccountId === agent.accountId),
  ).toBe(true);
});

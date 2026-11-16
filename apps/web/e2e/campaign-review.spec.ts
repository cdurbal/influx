// Queue 7, « Campagnes à valider », in the backoffice (docs/mvp/09 RG5, RG6, RG21 to RG23, RG85, RG87 to RG95;
// 15 RG27 C1 to C8, CA58; 17b §3.8; jalons/l3c, commit 08, L3C-E1), in French only (the backoffice has no English
// before D36): an agent reads the list (the brand, the title, the category, the examination, the alert in a line
// of its own; no brief, no band), opens the entry (which takes it in charge), reads the campaign and its brief
// whole, publishes it with a responsible, the recap first; a colleague reads a held entry without deciding; a
// refusal names a reason of the closed list and shows the sentence the brand will read; an enhanced review
// (sensitive sector) is decided by one person, published alone by the first journey; a second opinion is
// facultative (D84), given back to the queue and read by the next holder with the note of its requester; a brand
// suspended in the meantime blocks the publication and leaves the refusal. The campaigns waiting are written by
// the API's own routes (the brand's screens are not under test); the decisions are the screens'. The texts are
// the locale files', never copies. No amount, rate or price anywhere: the budget is a band by its label (D78, D48).
import { messages as bo } from "../../backoffice/src/messages/fr";
import { expectNoAxeViolation } from "./support/axe";
import {
  retireInternals,
  runTag,
  seedColleague,
  seedInternal,
} from "./support/backoffice";
import {
  campaignDecisionOf,
  holdEntry,
  submittedCampaign,
  suspendBrand,
} from "./support/campaign-review";
import { expect, test } from "./support/journey";
import { BACKOFFICE_ORIGIN } from "./support/servers";

test.afterAll(async () => {
  await retireInternals();
});

const L = bo.campaignQueue;
const R = bo.campaignReview;
const CONTACT = "ecrire@exemple-e2e.test";
const BRIEF_WITH_CONTACT = [
  "Notre gamme de soins du visage sort en janvier. Nous voulons des vidéos courtes où le créateur essaie les produits pendant une semaine, raconte ce qu'il observe, montre sa routine du matin et du soir, et donne un avis honnête.",
  "Le ton est chaleureux, sans promesse excessive : le créateur choisit son décor et son angle, tant que les gestes d'application sont visibles.",
  `Pour toute question avant de postuler, écrivez à ${CONTACT}.`,
].join("\n");
const TAKEN = /Vous avez pris cette entrée en charge à \d{2}:\d{2}\./;

/**
 * The colleague who owns the brands of the journeys (15 RG36: a journey reads its own entries alone, by
 * `?owner=`): one for the file, made once, retired with the others after the last journey.
 */
let commercialOnce: ReturnType<typeof seedColleague> | null = null;
function commercial(): ReturnType<typeof seedColleague> {
  commercialOnce ??= seedColleague("agent", "Alice");
  return commercialOnce;
}

function entryAddress(entryId: string): string {
  return `${BACKOFFICE_ORIGIN}/files/campagnes/${entryId}`;
}

test("an agent reads the campaigns to validate, opens one, reads the brief whole and its alert, demands a responsible, then publishes it, the recap first (09 RG5, RG6, RG21 à RG23, RG87; 15 C1 à C8)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const owner = await commercial();
  const tag = runTag("A");
  const campaign = await submittedCampaign(page, {
    title: `Gamme ${tag}`,
    ownerAgentId: owner.accountId,
    brief: BRIEF_WITH_CONTACT,
    sensitive: true,
  });
  await seedInternal(page, "agent", "Lou");

  // The list: what a line says in words, the alert in a line of its own; no brief, no band, no contact.
  await page.goto(
    `${BACKOFFICE_ORIGIN}/files/campagnes?owner=${owner.accountId}`,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: bo.queue.campaigns }),
  ).toBeVisible();
  const table = page.getByRole("region", { name: L.tableLabel, exact: true });
  const line = table.locator("tbody tr").first();
  await expect(line).toContainText(campaign.brandName);
  await expect(line).toContainText(campaign.title);
  await expect(line).toContainText("Product review");
  await expect(line).toContainText(L.review.enhanced);
  await expect(table).toContainText(bo.queueList.alertLine(L.alerts.contact));
  const listText = await page.locator("main").innerText();
  for (const secret of [CONTACT, "soins du visage", "1 000"]) {
    expect(listText, secret).not.toContain(secret);
  }
  await table.getByRole("link").click();

  // The decision screen: taken in charge, the brand, the campaign with its budget by the label of its band, the
  // brief whole, the alert in words (the field and the nature, never the text).
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    campaign.title,
  );
  await expect(page.getByText(TAKEN)).toBeVisible();
  // a sensitive sector (D84): one person decides, « Publier » is the main button, a second opinion is
  // facultative and secondary, and nobody is told that two people are required
  await expect(page.getByText(R.enhanced.singleYou)).toBeVisible();
  await expect(
    page.getByRole("button", { name: R.decision.askOpinion }),
  ).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/deux personnes/i);
  const brand = page.getByRole("region", { name: R.sections.brand });
  await expect(brand).toContainText(campaign.brandName);
  await expect(brand).toContainText("France");
  const fields = page.getByRole("region", { name: R.sections.campaign });
  await expect(fields).toContainText("1 000 à 2 500");
  await expect(fields).toContainText("2 × Instagram, Instagram reel");
  await expect(page.locator("[data-campaign-brief]")).toHaveText(
    BRIEF_WITH_CONTACT,
  );
  await expect(
    page.getByText(/Coordonnée possible dans « Brief » \(adresse e-mail/),
  ).toBeVisible();
  const screen = await page.locator("main").innerText();
  for (const forbidden of ["€", "EUR", "commission", "net créateur"]) {
    expect(screen, forbidden).not.toContain(forbidden);
  }
  await expectNoAxeViolation(page, "campaign review entry, 1 440", {
    wcag22: true,
  });

  // The responsible is compulsory: ‹v› opens the recap and never publishes; the confirmation without one says so.
  const owners = page.getByLabel(R.decision.ownerLabel, { exact: true });
  await owners.selectOption("");
  await page.keyboard.press("v");
  const publish = page.getByRole("form", { name: R.decision.publishTitle });
  await expect(publish).toBeVisible();
  await publish
    .getByRole("button", { name: R.decision.publishConfirm })
    .click();
  await expect(page.getByText(R.decision.ownerRequired)).toBeVisible();

  await owners.selectOption(owner.accountId);
  await expect(publish).toContainText("Alice");
  await publish
    .getByRole("button", { name: R.decision.publishConfirm })
    .click();
  await expect(
    page.getByText(R.decision.publishedNotice(campaign.title)),
  ).toBeVisible();
  const decided = await campaignDecisionOf(campaign.campaignId);
  expect(decided.status).toBe("published");
  expect(decided.ownerAgentId).toBe(owner.accountId);
  expect(decided.entries).toMatchObject([
    {
      state: "published",
      firstReviewedBy: null,
      decidedBy: expect.any(String),
    },
  ]);
});

test("an entry held by a colleague is read, never decided: « En cours — Lou », no button of decision, the same brief (09 RG89; 15 C2, CA58)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const owner = await commercial();
  const holder = await seedColleague("agent", "Lou");
  const campaign = await submittedCampaign(page, {
    title: `Soins ${runTag("B")}`,
    ownerAgentId: owner.accountId,
  });
  await holdEntry(campaign.entryId, holder.accountId);
  await seedInternal(page, "agent", "Marie");

  await page.goto(entryAddress(campaign.entryId));
  await expect(page.getByText(/En cours — Lou/)).toBeVisible();
  await expect(page.getByText(bo.queueReview.banner.readOnly)).toBeVisible();
  await expect(page.getByText(bo.claimedReview.readOnly)).toBeVisible();
  await expect(
    page.getByRole("region", { name: R.sections.campaign }),
  ).toContainText("1 000 à 2 500");
  await expect(
    page.getByRole("button", { name: R.decision.reject }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: R.decision.publish, exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(TAKEN)).toHaveCount(0);
  // nothing was decided, nothing was taken from the holder
  const kept = await campaignDecisionOf(campaign.campaignId);
  expect(kept.status).toBe("pending_review");
  expect(kept.entries.map((entry) => entry.state)).toEqual(["open"]);
});

test("a second opinion on a sensitive campaign is facultative: asked, the entry is given back, readable by all, and a colleague publishes it (09 RG85, CA56; D84; 17b §3.8)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const owner = await commercial();
  const asked = await submittedCampaign(page, {
    title: `Chai ${runTag("C")}`,
    ownerAgentId: owner.accountId,
    sensitive: true,
  });
  const lou = await seedInternal(page, "agent", "Lou");

  // The facultative second opinion, with its note (the length is the unit tests'): the entry is given back.
  await page.goto(entryAddress(asked.entryId));
  await expect(page.getByText(TAKEN)).toBeVisible();
  await page.getByRole("button", { name: R.decision.askOpinion }).click();
  const request = page.getByRole("form", { name: R.decision.askOpinionTitle });
  await expect(request).toBeVisible();
  const field = request.getByLabel(R.decision.opinionLabel, { exact: true });
  const opinion =
    "Les autorisations du secteur sont déclarées, un regard de plus est bienvenu.";
  await field.fill(opinion);
  await request
    .getByRole("button", { name: R.decision.askOpinionConfirm })
    .click();
  await expect(
    page.getByText(R.decision.askedNotice(asked.title)),
  ).toBeVisible();
  const requested = await campaignDecisionOf(asked.campaignId);
  expect(requested.status).toBe("pending_review");
  expect(requested.entries).toMatchObject([
    { state: "open", firstOpinion: opinion, firstReviewedBy: lou.accountId },
  ]);

  // A colleague reads « Second avis demandé par Lou » and the note, and publishes (the same browser, signed in
  // again as another person; the request gave the claim back).
  const marie = await seedInternal(page, "agent", "Marie");
  await page.goto(entryAddress(asked.entryId));
  await expect(page.getByText(TAKEN)).toBeVisible();
  await expect(page.getByText(/Second avis demandé par Lou/)).toBeVisible();
  await expect(page.getByText(R.enhanced.askedOfYou)).toBeVisible();
  await expect(page.locator("[data-first-opinion]")).toHaveText(opinion);
  await page.keyboard.press("v");
  await page
    .getByRole("form", { name: R.decision.publishTitle })
    .getByRole("button", { name: R.decision.publishConfirm })
    .click();
  await expect(
    page.getByText(R.decision.publishedNotice(asked.title)),
  ).toBeVisible();
  const published = await campaignDecisionOf(asked.campaignId);
  expect(published.status).toBe("published");
  expect(published.ownerAgentId).toBe(marie.accountId);
  expect(published.entries).toMatchObject([
    {
      state: "published",
      firstReviewedBy: lou.accountId,
      decidedBy: marie.accountId,
    },
  ]);
});

test("a brand suspended while its campaign waits blocks the publication with its banner and leaves the refusal: a reason of the closed list, the sentence the brand will read (09 RG89 à RG92; 17b §3.8)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const owner = await commercial();
  const campaign = await submittedCampaign(page, {
    title: `Marque ${runTag("D")}`,
    ownerAgentId: owner.accountId,
  });
  await seedInternal(page, "agent", "Lou");
  await page.goto(entryAddress(campaign.entryId));
  await expect(page.getByText(TAKEN)).toBeVisible();
  await suspendBrand(campaign.accountId);

  await page.keyboard.press("v");
  await page
    .getByRole("form", { name: R.decision.publishTitle })
    .getByRole("button", { name: R.decision.publishConfirm })
    .click();
  await expect(page.getByText(R.suspended.text)).toBeVisible();
  await expect(
    page.getByRole("button", { name: R.decision.publish, exact: true }),
  ).toHaveAttribute("aria-disabled", "true");

  // ‹r› opens the picker and never refuses; a reason is demanded, then the words of « Autre » (20 characters).
  await page.keyboard.press("r");
  const reject = page.getByRole("form", { name: R.decision.rejectTitle });
  await expect(reject).toBeVisible();
  await reject.getByRole("button", { name: R.decision.reasonConfirm }).click();
  await expect(page.getByText(R.decision.reasonRequired)).toBeVisible();
  await reject
    .getByRole("radio", { name: R.decision.reasonLabels.other })
    .check();
  await reject.getByRole("button", { name: R.decision.reasonConfirm }).click();
  await expect(page.getByText(R.decision.otherTooShort)).toBeVisible();
  await reject
    .getByRole("radio", { name: R.decision.reasonLabels.calendar_invalid })
    .check();
  await expect(reject.getByText(R.decision.messageToBrand)).toBeVisible();
  await expect(reject.getByText(R.decision.nextStep)).toBeVisible();
  await reject
    .getByLabel(bo.claimedReview.comment, { exact: true })
    .fill("INTERNAL-NOTE-L3C-08");
  await reject.getByRole("button", { name: R.decision.reasonConfirm }).click();
  await expect(
    page.getByText(
      R.decision.rejectedNotice(
        campaign.title,
        R.decision.reasonLabels.calendar_invalid?.toLowerCase() ?? "",
      ),
    ),
  ).toBeVisible();
  const decided = await campaignDecisionOf(campaign.campaignId);
  expect(decided.status).toBe("rejected");
  expect(decided.entries).toMatchObject([
    { state: "rejected", reasonCode: "calendar_invalid" },
  ]);
});

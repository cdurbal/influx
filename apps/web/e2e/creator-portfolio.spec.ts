// Block 6 of "mon profil" of a creator, the portfolio, and « Publier mon profil » (docs/mvp/07 RG4 to
// RG10, RG77 to RG84, RG90, RG96, RG111; 17 §5.2; jalons/l2g, commit 13): the notice of anonymity ABOVE
// the zone of deposit, the deposit of a real image through the real API (re-encoded, listed with its
// state written), the caption with the box of RG83, the order, the button never disabled that names what
// is missing and leads to it, the profile submitted and frozen; then what only an agent does, written by
// the database as the agent's own door would leave it (a refusal with its reason and its step, a
// publication, a change waiting for its review while the published version stays) and the switch of RG8.
// In French at 375 px, then the same creator in English at 1 440 px (one width per language, one member
// and one seed for both, to keep the added time short: the budget of the line is 6 s, F0), the texts of
// the locale files, never copies, no amount, rate or price anywhere (D78). The decisions of the
// backoffice are the next commits': only their outcome is seeded.
import { seedMember } from "./support/account";
import { retireInternals, seedColleague } from "./support/backoffice";
import { expectNoAxeViolation } from "./support/axe";
import {
  changeHeadline,
  depositVisuals,
  profileFacts,
  publishProfileAsAgent,
  refuseProfileAsAgent,
  seedCreatorWithoutPortfolio,
  visualsOf,
} from "./support/creator-portfolio";
import { expect, open, reload, test } from "./support/journey";
import { EVIDENCE_FIXTURE } from "./support/verification";
import enCreatorProfile from "@/locales/en/creator-profile.json" with { type: "json" };
import frCreatorProfile from "@/locales/fr/creator-profile.json" with { type: "json" };

const COPY = { fr: frCreatorProfile, en: enCreatorProfile } as const;
const PATHS = { fr: "/fr/compte/profil", en: "/en/account/profile" } as const;
/** "3 visuels déposés sur 8" · "3 of 8 visuals uploaded": the plural of the translation, told as the screen reads it. */
const COUNT = {
  fr: (count: number) =>
    `${count} ${count < 2 ? "visuel déposé" : "visuels déposés"} sur 8`,
  en: (count: number) =>
    `${count} of 8 ${count === 1 ? "visual" : "visuals"} uploaded`,
} as const;

test.afterAll(async () => {
  await retireInternals();
});

test("a creator deposits visuals and submits the profile in French at 375 px, then reads its refusal, its publication and its switch in English at 1 440 px (07 RG4, RG8, RG9, RG10, RG77 à RG84, RG90, RG96, RG111)", async ({
  page,
}) => {
  const fr = COPY.fr;
  const en = COPY.en;
  const agent = await seedColleague("agent", "Alice");
  const { accountId } = await seedMember(page, {
    role: "creator",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await seedCreatorWithoutPortfolio(page, accountId, agent.accountId);
  // Two visuals are already there, through the door of the API as the screen's deposit calls it: the
  // screen deposits the third (the count of RG77 is three, so that the list of what is missing names it).
  await depositVisuals(page, 2);
  await page.setViewportSize({ width: 375, height: 900 });
  await open(page, PATHS.fr);

  const block = page.locator("[data-section=portfolio]");
  const items = block.locator("[data-portfolio-item]");
  const publish = page.getByRole("button", { name: fr.publish.action });

  // 17 §5.2: the notice is ABOVE the zone of deposit, where anonymity is lost; the face notice and the
  // formats come with the zone; the draft is told as the founder chose (L2DU-15).
  const notice = await block.getByText(fr.portfolio.notice).boundingBox();
  const zone = await block.locator("[data-portfolio-drop]").boundingBox();
  expect(notice!.y + notice!.height).toBeLessThanOrEqual(zone!.y);
  await expect(block.getByText(fr.portfolio.faceNotice)).toBeVisible();
  await expect(block.getByText(fr.portfolio.help)).toBeVisible();
  await expect(
    page.getByText(fr.home.state.replace("{state}", fr.state.draft)),
  ).toBeVisible();
  // The summary names the seven sections; the last two have their anchors (the home links to them).
  for (const id of ["portfolio", "trust"] as const) {
    await expect(
      page.getByRole("link", { name: new RegExp(fr.sections[id]) }),
    ).toBeVisible();
    await expect(page.locator(`#creator-section-${id}`)).toHaveCount(1);
  }
  await expect(items).toHaveCount(2);
  await expect(block.getByText(COUNT.fr(2), { exact: true })).toBeVisible();

  // RG90: the button is never disabled; a click names what is missing and leads to it.
  await expect(publish).not.toHaveAttribute("aria-disabled", "true");
  await publish.click();
  const missing = page.locator("[data-publish-missing]");
  await expect(missing).toContainText(fr.required.portfolio);
  await expect(
    missing.getByRole("link", { name: fr.required.portfolio }),
  ).toHaveAttribute("href", "#creator-section-portfolio");
  await expect(page).toHaveURL(/#creator-section-portfolio$/);
  expect((await profileFacts(accountId)).status).toBe("draft");

  // The deposit by the screen: the third visual, listed with its state written (RG78), drawn from what
  // the API stored and never from an address (T9.2); the list of what is missing loses the portfolio.
  await block.locator("input[type=file]").setInputFiles(EVIDENCE_FIXTURE);
  await expect(items).toHaveCount(3);
  await expect(block.getByText(COUNT.fr(3), { exact: true })).toBeVisible();
  await expect(
    block
      .locator("[data-item-state]")
      .filter({ hasText: fr.portfolio.pending }),
  ).toHaveCount(3);
  await expect(block.locator("img").first()).toHaveAttribute(
    "src",
    /^data:image\/webp;base64,/,
  );
  await expect(missing).toHaveCount(0);
  // RG82, RG83: the box of authorisation appears with a caption and is never pre-ticked; saved
  // together, the declaration is kept.
  const first = items.first();
  const consent = first.getByRole("checkbox", {
    name: fr.portfolio.brandConsent,
  });
  await expect(consent).toHaveCount(0);
  await first
    .getByLabel(new RegExp(`^${fr.portfolio.caption.split(" (")[0]}`))
    .fill("Mon plat du jour");
  await expect(consent).not.toBeChecked();
  await consent.check();
  await first.getByRole("button", { name: fr.portfolio.saveCaption }).click();
  await expect(
    block.getByText(fr.portfolio.status.captionApplied),
  ).toBeVisible();
  // RG84: the order is the creator's, moved one place at a time.
  const idsOf = () =>
    items.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-portfolio-item")),
    );
  const before = await idsOf();
  await first
    .getByRole("button", {
      name: fr.portfolio.moveDown.replace("{position}", "1"),
    })
    .click();
  await expect(block.getByText(fr.portfolio.status.ordered)).toBeVisible();
  const after = await idsOf();
  expect(after).toEqual([before[1], before[0], before[2]]);
  // What the database holds: the three visuals pending, re-encoded without metadata (T9.10), in the order
  // the creator gave, the caption of the first one kept with its declaration (RG83).
  const stored = await visualsOf(accountId);
  expect(stored.map((visual) => visual.id)).toEqual(after);
  expect(stored.map((visual) => [visual.state, visual.exifStripped])).toEqual(
    Array.from({ length: 3 }, () => ["pending", true]),
  );
  expect(stored.find((visual) => visual.id === before[0])).toMatchObject({
    caption: "Mon plat du jour",
    declarations: 1,
    order: 2,
  });
  await expectNoAxeViolation(page, "my creator profile, portfolio, fr, 375", {
    wcag22: true,
  });

  // The submission: nothing is missing any more, the profile waits for its answer and is frozen (RG10).
  await publish.click();
  await expect(page.getByText(fr.publish.submitted)).toBeVisible();
  await expect(publish).toHaveCount(0);
  await expect(
    page.getByLabel(new RegExp(`^${fr.fields.headline.label}`)),
  ).toBeDisabled();
  expect(await profileFacts(accountId)).toMatchObject({
    status: "pending_review",
    entries: [{ kind: "submission", state: "open" }],
  });

  // The same creator in English at 1 440 px. The refusal: its reason from the closed list and the step
  // that follows, never the agent nor the comment; the profile is editable again (RG10, RG96, CA51).
  await refuseProfileAsAgent(accountId, agent.accountId, "bio_insufficient");
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, PATHS.en);
  await expect(block.getByText(en.portfolio.notice)).toBeVisible();
  await expect(block.getByText(COUNT.en(3), { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      en.status.rejected.replace("{reason}", en.rejection.bio_insufficient),
    ),
  ).toBeVisible();
  await expect(page.getByText(en.refusal.fix)).toBeVisible();
  await expect(page.getByText(/Alice|INTERNAL-NOTE-L2G-13/)).toHaveCount(0);
  await expect(
    page.getByLabel(new RegExp(`^${en.fields.headline.label}`)),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: en.publish.action }),
  ).toBeVisible();

  // The publication, then a change of a moderated field: the version validated stays, the change
  // waits and is named (RG9, CA48); the switch of RG8 answers with its consequence written.
  await publishProfileAsAgent(accountId, agent.accountId);
  await changeHeadline(page);
  await reload(page);
  await expect(page.getByText(en.status.published)).toBeVisible();
  await expect(page.getByText(en.status.pendingWithPublished)).toBeVisible();
  await expect(
    page.getByText(
      en.status.pendingFields.replace("{fields}", en.revisionField.headline),
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: en.publish.action }),
  ).toHaveCount(0);
  await expect(page.locator("[data-trust-verified=true]")).toContainText(
    en.trust.verified,
  );
  const switcher = page.getByRole("switch", { name: en.visibility.label });
  await expect(switcher).toBeChecked();
  await expect(page.getByText(en.visibility.on)).toBeVisible();
  await switcher.uncheck();
  await expect(page.getByText(en.visibility.off)).toBeVisible();
  await expect
    .poll(async () => (await profileFacts(accountId)).searchable)
    .toBe(false);
});

// "Ce que voit une marque" (docs/mvp/07 RG49, RG84, RG102, RG104, RG113; 17 §5.2, §7.1; jalons/l2g,
// commit 14): a published creator with two approved visuals reaches the page from the summary of "mon
// profil", reads the card as the platform serves it in French at 375 px (the tab before: the visuals
// drawn from what the API stored, the title, the badge, the bands, never the handle, the address nor an
// exact figure), then in English at 1 440 px (the tab after: the handle, the address and the exact
// figure the API serves, the tabs moved by the keyboard). One creator, one seed and one test for both
// languages, to keep the added time short (the budget of the line is 2 s, F0). The texts are the locale
// files', never copies; no amount, rate or price anywhere (D48, D78).
import { seedMember } from "./support/account";
import { retireInternals, seedColleague } from "./support/backoffice";
import { expectNoAxeViolation } from "./support/axe";
import {
  approveVisualsAsAgent,
  BIO,
  depositVisuals,
  HEADLINE,
  publishProfileAsAgent,
  seedCreatorWithoutPortfolio,
  seededHandle,
} from "./support/creator-portfolio";
import { expect, open, test } from "./support/journey";
import enCreatorProfile from "@/locales/en/creator-profile.json" with { type: "json" };
import frCreatorProfile from "@/locales/fr/creator-profile.json" with { type: "json" };

const PATHS = {
  fr: { profile: "/fr/compte/profil", preview: "/fr/compte/profil/apercu" },
  en: {
    profile: "/en/account/profile",
    preview: "/en/account/profile/preview",
  },
} as const;
const CAPTION = "Mon plat du jour";

test.afterAll(async () => {
  await retireInternals();
});

test("a creator reads his card as a brand sees it, before an introduction in French at 375 px, then after it in English at 1 440 px (07 RG84, RG102, RG104, RG113)", async ({
  page,
}) => {
  const fr = frCreatorProfile;
  const en = enCreatorProfile;
  const agent = await seedColleague("agent", "Alice");
  const { accountId } = await seedMember(page, {
    role: "creator",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await seedCreatorWithoutPortfolio(page, accountId, agent.accountId);
  await depositVisuals(page, 2);
  await approveVisualsAsAgent(accountId, agent.accountId, CAPTION);
  await publishProfileAsAgent(accountId, agent.accountId);
  const handle = seededHandle(accountId);

  // The way in (the link of the summary of "mon profil") is proved by creator-portfolio.spec.ts, which
  // already opens that page: no second visit of it here, for the budget of the line.
  await page.setViewportSize({ width: 375, height: 900 });
  await open(page, PATHS.fr.preview);
  await expect(
    page.getByRole("heading", { level: 1, name: fr.preview.title }),
  ).toBeVisible();
  await expect(page.getByText(fr.preview.explain)).toBeVisible();

  // The tab before, layer A: the title and the bio as written, the three approved visuals drawn from
  // what the API stored (never an address), the caption beside the first one, the badge dated, the
  // bands of the three priority metrics, the source and the date of the figures (RG49).
  const before = page.getByRole("tab", { name: fr.preview.before });
  await expect(before).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(fr.preview.beforeIntro)).toBeVisible();
  const card = page.locator("[data-preview-card]");
  await expect(
    card.getByRole("heading", { level: 2, name: /^Profil \S+$/ }),
  ).toBeVisible();
  await expect(card.getByText(HEADLINE)).toBeVisible();
  await expect(card.getByText(BIO)).toBeVisible();
  await expect(card.locator("[data-visual] img")).toHaveCount(2);
  await expect(card.locator("[data-visual] img").first()).toHaveAttribute(
    "src",
    /^data:image\/webp;base64,/,
  );
  await expect(card.locator("[data-visual]").first()).toContainText(CAPTION);
  await expect(card.locator("[data-preview-no-visual]")).toHaveCount(0);
  const line = card.locator("[data-network=instagram]");
  await expect(line.locator("[data-badge=account_verified]")).toBeVisible();
  await expect(
    line
      .locator("[data-field=audienceBand]")
      .getByText(fr.reference.audience_band.micro),
  ).toBeVisible();
  await expect(line).toContainText(fr.preview.source.declared);
  // RG102: before an introduction, no handle, no address, no exact figure, no tab "after" content.
  const text = (await page.locator("main").innerText()).replace(/\s/g, "");
  for (const secret of [handle, "instagram.com", "48000", "48123"]) {
    expect(text, secret).not.toContain(secret);
  }
  await expect(card.locator("[data-field=followersCount]")).toHaveCount(0);
  await expect(card.getByText(fr.layer.revealed)).toHaveCount(0);
  await expectNoAxeViolation(page, "what a brand sees, before, fr, 375", {
    wcag22: true,
  });

  // The same creator in English at 1 440 px, the tab after: the handle, the address and the exact
  // figure the API serves beside the band; the tabs answer the arrows.
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, PATHS.en.preview);
  await expect(
    page.getByRole("heading", { level: 1, name: en.preview.title }),
  ).toBeVisible();
  await page.getByRole("tab", { name: en.preview.after }).click();
  await expect(page.getByText(en.preview.afterIntro)).toBeVisible();
  const after = page.locator("[data-network=instagram]");
  await expect(after).toContainText(handle);
  await expect(after).toContainText(`instagram.com/${handle}`);
  await expect(after.locator("[data-field=audienceBand]")).toContainText(
    en.preview.exact.replace("{value}", "48,000"),
  );
  // What an introduction reveals is marked as such, in words beside the lock (L2G recette, RG85).
  await expect(
    after.locator("[data-revealed=identity]").getByText(en.layer.revealed),
  ).toBeVisible();
  await expect(
    after.locator("[data-field=audienceBand]").getByText(en.layer.revealed),
  ).toBeVisible();
  await expect(page.locator("[data-preview-after-empty]")).toHaveCount(0);
  await expect(
    page.locator("[data-preview-card] [data-visual] img"),
  ).toHaveCount(2);
  await page.getByRole("tab", { name: en.preview.after }).press("ArrowLeft");
  await expect(
    page.getByRole("tab", { name: en.preview.before }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-preview-panel=before]")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(handle);
});

// Queue 2, « Profils créateur à valider », in the backoffice (docs/mvp/07 RG4 to RG10, RG93 to RG98; 15 RG27 C1
// to C8; 17b §2.4 to §2.7; jalons/l2g, commit 15), in French only (the backoffice has no English before D36):
// an agent reads the list (the alias, the country, the networks, the badge, the alert in a line of its own, no
// handle, no text), opens the entry (which takes it in charge), reads the profile and the exact figures of the
// marked block, asks for one visual and gets it, refuses with a reason of the closed list and sees the sentence
// the creator will read; the creator hands the profile in again and the agent publishes it, the recap first. One
// creator, one seed and one test, to keep the added time short (the budget of the line is 5 s, F0). The states
// before the gestures are the API's own doors (the deposits, the submission); the decisions are the screens'.
// The texts are the locale files', never copies. No amount, rate or price anywhere (D48, D78).
import { messages as bo } from "../../backoffice/src/messages/fr";
import { seedMember } from "./support/account";
import { expectNoAxeViolation } from "./support/axe";
import {
  retireInternals,
  seedColleague,
  seedInternal,
} from "./support/backoffice";
import {
  depositVisuals,
  ownCreatorWithContactInBio,
  reviewEntriesOf,
  seedCreatorWithoutPortfolio,
  seededHandle,
  submitProfile,
} from "./support/creator-portfolio";
import { expect, test } from "./support/journey";
import { BACKOFFICE_ORIGIN } from "./support/servers";
import { withSql } from "./support/verification-cycle";

test.afterAll(async () => {
  await retireInternals();
});

const L = bo.creatorQueue;
const R = bo.creatorReview;
const CONTACT = "moi@exemple-e2e.test";

test("an agent reads the creator profiles to validate, opens one, reads the exact figures of the marked block and one visual, refuses with a reason of the closed list, then publishes the profile handed in again, the recap first (07 RG5, RG10, RG93 to RG98; 15 C1 à C8)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const owner = await seedColleague("agent", "Alice");
  const { accountId } = await seedMember(page, {
    role: "creator",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await seedCreatorWithoutPortfolio(page, accountId, owner.accountId);
  await depositVisuals(page, 3);
  await ownCreatorWithContactInBio(accountId, owner.accountId, CONTACT);
  await submitProfile(page);
  const handle = seededHandle(accountId);
  const alias = await aliasOf(accountId);
  await seedInternal(page, "agent", "Lou");

  // The list: what a line says in words, the alert in a line of its own; no handle, no text, no contact.
  await page.goto(
    `${BACKOFFICE_ORIGIN}/files/profils-createur?owner=${owner.accountId}`,
  );
  await expect(
    page.getByRole("heading", { level: 1, name: bo.queue.profiles_creator }),
  ).toBeVisible();
  const table = page.getByRole("region", { name: L.tableLabel, exact: true });
  await expect(table.locator("tbody tr").first()).toContainText("Instagram");
  await expect(table).toContainText("France");
  await expect(table).toContainText(
    bo.verificationQueue.levels.account_verified,
  );
  await expect(table).toContainText(L.wholeProfile);
  await expect(table).toContainText(
    bo.queueList.alertLine(L.alerts.direct_contact),
  );
  await expect(
    page.getByRole("region", { name: bo.queueList.countersTitle }),
  ).toContainText(/en attente/);
  const listText = await page.locator("main").innerText();
  for (const secret of [handle, CONTACT, "Créatrice de tutoriels"]) {
    expect(listText, secret).not.toContain(secret);
  }
  await table.getByRole("link").click();

  // The decision screen: taken in charge, the profile as validated, the marked block of the lines with the
  // exact figures and the handle, the alert in words, three visuals read on demand.
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    /Profil créateur — /,
  );
  await expect(
    page.getByText(/Vous avez pris cette entrée en charge à \d{2}:\d{2}\./),
  ).toBeVisible();
  await expect(page.getByText(R.written.submission)).toBeVisible();
  const lines = page.getByRole("region", {
    name: new RegExp(R.sections.lines),
  });
  await expect(lines).toContainText(handle);
  await expect(lines).toContainText(`instagram.com/${handle}`);
  await expect(lines).toContainText(/48\s000/);
  await expect(
    page.getByText(
      R.alerts.direct_contact(
        R.alerts.fields.bio ?? "",
        R.alerts.signals.email ?? "",
      ),
    ),
  ).toBeVisible();
  const visuals = page.locator("[data-visual]");
  await expect(visuals).toHaveCount(3);
  await expect(page.locator("[data-visual] img")).toHaveCount(0);
  await visuals.first().getByRole("button", { name: R.visuals.show }).click();
  await expect(visuals.first().locator("img")).toHaveAttribute("src", /^blob:/);
  await expect(page.locator("[data-visual] img")).toHaveCount(1);
  await expectNoAxeViolation(page, "creator review entry, 1 440", {
    wcag22: true,
  });

  // ‹r› opens the picker and never refuses; the reason picked shows the very sentence the creator will read.
  await page.keyboard.press("r");
  const reject = page.getByRole("form", { name: R.decision.rejectTitle });
  await expect(reject).toBeVisible();
  await reject.getByRole("button", { name: R.decision.reasonConfirm }).click();
  await expect(page.getByText(R.decision.reasonRequired)).toBeVisible();
  await reject
    .getByRole("radio", { name: R.decision.reasonLabels.bio_insufficient })
    .check();
  await expect(reject.getByText(R.decision.messageToCreator)).toBeVisible();
  await expect(reject.getByText(/ne permet pas à une marque/)).toBeVisible();
  await reject
    .getByLabel(bo.claimedReview.comment, { exact: true })
    .fill("INTERNAL-NOTE-L2G-15");
  await reject.getByRole("button", { name: R.decision.reasonConfirm }).click();
  await expect(
    page.getByText(
      R.decision.rejectedNotice(
        alias,
        R.decision.reasonLabels.bio_insufficient?.toLowerCase() ?? "",
      ),
    ),
  ).toBeVisible();
  const [refused] = await reviewEntriesOf(accountId);
  expect(refused).toMatchObject({
    state: "rejected",
    reasonCode: "bio_insufficient",
    internalComment: "INTERNAL-NOTE-L2G-15",
  });
  expect(refused?.decidedBy).not.toBeNull();

  // The creator hands the profile in again, with no delay (07 RG10); the agent publishes it: ‹v› opens the
  // recap and never publishes, the confirmation does.
  await submitProfile(page);
  const second = (await reviewEntriesOf(accountId)).find(
    (entry) => entry.state === "open",
  );
  expect(second).toBeDefined();
  await page.goto(
    `${BACKOFFICE_ORIGIN}/files/profils-createur/${second?.id ?? ""}`,
  );
  await expect(
    page.getByText(/Vous avez pris cette entrée en charge à \d{2}:\d{2}\./),
  ).toBeVisible();
  await page.keyboard.press("v");
  const publish = page.getByRole("form", { name: R.decision.publishTitle });
  await expect(publish).toBeVisible();
  await expect(publish).toContainText(R.decision.publishFirst);
  expect((await reviewEntriesOf(accountId)).at(-1)?.state).toBe("open");
  await publish
    .getByRole("button", { name: R.decision.publishConfirm })
    .click();
  await expect(page.getByText(R.decision.publishedNotice(alias))).toBeVisible();
  const entries = await reviewEntriesOf(accountId);
  expect(entries.map((entry) => entry.state)).toEqual([
    "rejected",
    "published",
  ]);
  expect(entries.at(-1)?.decidedBy).toBe(refused?.decidedBy);
  await expectProfileStatus(accountId, "published");
});

/** The public alias the database gave the creator (07 RG23): the title of the line and of the screen. */
async function aliasOf(accountId: string): Promise<string> {
  return withSql(async (sql) => {
    const [row] = await sql<{ alias: string }[]>`
      select alias from profiles.creator_public_profiles where account_id = ${accountId}`;
    return row?.alias ?? "";
  });
}

async function expectProfileStatus(
  accountId: string,
  status: string,
): Promise<void> {
  const row = await withSql(async (sql) => {
    const [found] = await sql<{ status: string }[]>`
      select status::text as status from profiles.creator_public_profiles
       where account_id = ${accountId}`;
    return found;
  });
  expect(row?.status).toBe(status);
}

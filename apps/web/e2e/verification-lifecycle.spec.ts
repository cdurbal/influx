// The life of a creator's badge and the contest of a decision (docs/mvp/08 RG10, RG70, RG73, RG77, RG78,
// RG93, CA46, CA48, CA52; 17 §5.3; jalons/l2f, commit 17), in French, against the real API and
// the local stack, and the texts of the locale files, never copies. The states a badge is in after the
// worker's task or the 2V of a colleague (« à rafraîchir », « à reconfirmer », withdrawn), a refusal and a
// decided contest are written by the database as those doors would (support/verification-cycle.ts): what is
// proven here is what the creator reads and does, never the doors. A line with a badge to refresh (the end
// of its grace written, a redeposit offered WITHOUT the proof of ownership), a line to reconfirm, a refusal
// contested (the confirmation, then the follow-up on the line). The withdrawn badge, its apologies and its
// contest, in English, extend the English case of verification-creator.spec.ts. No agent, no decider, no
// amount, rate or price anywhere (D78).
import { seedMember } from "./support/account";
import { retireInternals, seedColleague } from "./support/backoffice";
import { expect, open, test, title } from "./support/journey";
import {
  accountRow,
  audienceRow,
  AUDIENCE,
  COPY,
  expectNothingForbidden,
  fixed,
  PROFILE,
  seedLines,
} from "./support/verification";
import {
  disputesOf,
  graceEndOf,
  seedBadge,
  seedNetworkLine,
  seedRefusal,
  withSql,
} from "./support/verification-cycle";

test.afterAll(async () => {
  await retireInternals();
});

const lineRow = (
  page: Parameters<typeof accountRow>[0],
  networkCode: string,
  level: "account_verified" | "audience_verified" = "account_verified",
) =>
  page.locator(
    `[data-verification-line="${networkCode}"] [data-verification-row="${level}"]`,
  );

test("a creator redeposits a badge to refresh without proving ownership again, sees a line to reconfirm, then contests a refusal, in French (08 RG10, RG70, RG77, RG78, RG93, CA46, CA48, CA52)", async ({
  page,
}) => {
  const copy = COPY.fr.own;
  const network = COPY.fr.brand.reference.network;
  const { accountId } = await seedMember(page, {
    role: "creator",
    language: "fr",
    acceptTerms: true,
    sessions: ["chrome.windows"],
  });
  await seedLines(accountId, false);
  const agent = await seedColleague("agent", "Noa");
  const { requestId, graceEndAt } = await withSql(async (sql) => {
    await seedNetworkLine(sql, accountId, "tiktok", "camille_tt");
    await seedNetworkLine(sql, accountId, "youtube", "camille_yt");
    await seedBadge(sql, accountId, agent.accountId, {
      networkCode: "instagram",
      level: "account_verified",
      state: "active",
    });
    await seedBadge(sql, accountId, agent.accountId, {
      networkCode: "instagram",
      level: "audience_verified",
      state: "to_refresh",
    });
    await seedBadge(sql, accountId, agent.accountId, {
      networkCode: "youtube",
      level: "account_verified",
      state: "to_reconfirm",
    });
    return {
      requestId: await seedRefusal(
        sql,
        accountId,
        agent.accountId,
        "tiktok",
        "ownership_not_proven",
      ),
      graceEndAt: (await graceEndOf(sql, accountId)).toISOString(),
    };
  });

  // The audience past its 90 days: written « à rafraîchir » with its date, until when it stays shown (the
  // end of its grace), and the ownership of the account untouched (RG70, RG71, RG93, CA46).
  await open(page, PROFILE.fr);
  const audience = audienceRow(page).locator(
    '[data-badge="audience_verified"]',
  );
  await expect(audience).toContainText(
    new RegExp(
      "Audience vérifiée le \\d{1,2}(er)? \\S+ 20\\d\\d — vérification à rafraîchir\\.",
    ),
  );
  const graceEnd = await page.evaluate(
    ([instant]) =>
      new Intl.DateTimeFormat("fr", { dateStyle: "long" }).format(
        new Date(instant ?? ""),
      ),
    [graceEndAt],
  );
  await expect(
    audience.locator('[data-badge-notice="verif.expiry.toRefresh"]'),
  ).toHaveText(copy.verif.expiry.toRefresh.replace("{date}", graceEnd));
  await expect(
    accountRow(page).locator('[data-badge="account_verified"]'),
  ).toContainText(`Compte vérifié — ${network.instagram}, le `);
  await expect(accountRow(page).locator("[data-badge-notice]")).toHaveCount(0);

  // Another line: the account to reconfirm after a changed handle, written with what to do (RG78).
  const reconfirm = lineRow(page, "youtube");
  await expect(
    reconfirm.locator('[data-badge-state="to_reconfirm"]'),
  ).toContainText("à reconfirmer après un changement d'identifiant");
  await expect(
    reconfirm.locator('[data-badge-notice="verif.reconfirm.notice"]'),
  ).toHaveText(
    copy.verif.reconfirm.notice.replace("{network}", network.youtube),
  );
  await expect(
    reconfirm.getByRole("link", { name: new RegExp(copy.line.cta.reconfirm) }),
  ).toHaveCount(1);

  // A refusal, the window to contest it written in days from the setting, and the way there (RG77, CA52).
  const refused = lineRow(page, "tiktok");
  await expect(refused.locator('[data-request="refused"]')).toContainText(
    copy.refusal.reason.ownership_not_proven,
  );
  await expect(refused.locator("[data-appeal-window]")).toHaveText(
    copy.verif.dispute.open,
  );
  await expectNothingForbidden(page, '[data-verification-line="instagram"]');

  // The contest of the refusal: the decision, the window and its closing day, the four reasons, no attachment.
  await lineRow(page, "tiktok")
    .getByRole("link", { name: new RegExp(copy.appeal.cta) })
    .click();
  await expect(page).toHaveURL(
    new RegExp(
      `/fr/compte/profil/verification/contestation\\?request=${requestId}$`,
    ),
  );
  await expect(title(page)).toHaveText(copy.appeal.title);
  const main = page.getByRole("main");
  await expect(main.locator("[data-about]")).toContainText(
    copy.appeal.about.refusal
      .replace("{badge}", copy.appeal.badgeName.account_verified)
      .replace("{network}", network.tiktok)
      .split("{date}")[0] ?? "",
  );
  await expect(
    main.getByText(copy.refusal.reason.ownership_not_proven),
  ).toBeVisible();
  await expect(main.locator("[data-appeal-window]")).toHaveText(
    copy.verif.dispute.open,
  );
  await expect(main.getByText(fixed(copy.appeal.until))).toBeVisible();
  for (const reason of Object.values(copy.appeal.reason)) {
    await expect(main.getByRole("radio", { name: reason })).toBeVisible();
  }
  await expect(main.getByText(copy.appeal.form.noAttachment)).toBeVisible();
  await expect(main.locator('input[type="file"]')).toHaveCount(0);

  await main.getByRole("radio", { name: copy.appeal.reason.misread }).check();
  // The contest: the confirmation is the follow-up read back from the API, and it stays on the line.
  await page
    .locator("#appeal-text")
    .fill("Le code figurait bien dans ma biographie.");
  await main.getByRole("button", { name: copy.appeal.form.submit }).click();
  await expect(
    page.getByRole("heading", { name: copy.appeal.sent.title }),
  ).toBeVisible();
  await expect(
    main.getByText(
      copy.appeal.sent.received.replace(
        "{badge}",
        copy.appeal.badgeName.account_verified,
      ),
    ),
  ).toBeVisible();
  await expect(main.locator('[data-dispute="open"]')).toContainText(
    fixed(copy.appeal.state.open),
  );
  expect(await disputesOf(accountId)).toEqual([
    {
      state: "open",
      reason: "misread",
      text: "Le code figurait bien dans ma biographie.",
      kind: "refusal",
    },
  ]);
  await main.getByRole("link", { name: copy.ownership.done.back }).click();
  await expect(
    lineRow(page, "tiktok").locator('[data-dispute="open"]'),
  ).toContainText(fixed(copy.appeal.state.open));
  await expect(page.locator("[data-contestable]")).toHaveCount(0);

  // The redeposit, from the same profile: no proof of ownership asked again while the identifier is
  // unchanged (CA48).
  await audienceRow(page)
    .getByRole("link", { name: new RegExp(copy.line.cta.audienceRefresh) })
    .click();
  await expect(page).toHaveURL(
    new RegExp(`${AUDIENCE.fr}\\?network=instagram$`),
  );
  await expect(page.locator("[data-audience-locked]")).toHaveCount(0);
  await expect(
    page.getByRole("main").getByText(copy.audience.affirm.refresh),
  ).toBeVisible();
  await page
    .getByRole("button", { name: copy.audience.affirm.continueRefresh })
    .click();
  await expect(page.locator("[data-step]")).toHaveAttribute(
    "data-step",
    "deposit",
  );
  await expect(page).not.toHaveURL(/propriete/);
});

// Blocks 2 to 4 of the record of a creator in words (docs/mvp/07 RG71, RG4, RG88; 17b §3.6; jalons/l2g/modele.md
// §1 point 13; L2G-17): pure functions of src/components/account-creator-view.ts, without a browser. The server
// says what the lines hold and how many visuals count; these only word them, exact figures first, never a band.
import {
  accountCreatorSchema,
  type AccountCreator,
} from "@influx/contracts/backoffice-accounts";
import { describe, expect, it } from "vitest";
import {
  networkRows,
  portfolioWords,
} from "../src/components/account-creator-view";
import { profileFilterHref } from "../src/components/portfolio-queue-view";
import { formatDate } from "../src/components/view-model";
import { messages } from "../src/messages/fr";

const t = messages.accountCreator;

const CREATOR: AccountCreator = {
  networks: [
    {
      id: "6f1d6c1e-0000-4000-8000-000000000001",
      networkCode: "instagram",
      isPrimary: true,
      awaitingValidation: false,
      followers: 84210,
      postsLast30Days: 14,
      avgComments: 137,
      engagementRateBp: 420,
      measuredAt: "2026-08-21T09:00:00.000Z",
      source: "agent_observed",
    },
    {
      id: "6f1d6c1e-0000-4000-8000-000000000002",
      networkCode: "tiktok",
      isPrimary: false,
      awaitingValidation: true,
      followers: null,
      postsLast30Days: 0,
      avgComments: null,
      engagementRateBp: null,
      measuredAt: null,
      source: "declared",
    },
  ],
  portfolio: { deposited: 12, pending: 2 },
};

describe("networkRows (block 2)", () => {
  it("writes the exact figures, the date and the source of a line, the main one marked in words", () => {
    const [first] = networkRows(CREATOR.networks);
    expect(first).toMatchObject({
      network: "Instagram",
      notes: [t.primary],
      followers: new Intl.NumberFormat("fr-FR").format(84210),
      posts: "14",
      comments: "137",
      engagement: "4,2 %",
      measuredAt: formatDate("2026-08-21T09:00:00.000Z"),
      source: t.sources.agent_observed,
    });
  });

  it("says not set for a figure never given, keeps a true zero, and words the line that waits for a decision", () => {
    const [, second] = networkRows(CREATOR.networks);
    expect(second).toMatchObject({
      network: "TikTok",
      notes: [t.unlisted],
      followers: messages.queueReview.unset,
      posts: "0",
      comments: messages.queueReview.unset,
      engagement: messages.queueReview.unset,
      measuredAt: messages.queueReview.unset,
      source: t.sources.declared,
    });
  });

  it("gives each line its own key", () => {
    const keys = networkRows(CREATOR.networks).map((row) => row.id);
    expect(new Set(keys).size).toBe(2);
  });
});

describe("portfolioWords (block 4)", () => {
  it("counts the visuals deposited and those waiting, in one line", () => {
    expect(portfolioWords(CREATOR.portfolio)).toBe(
      "12 visuels déposés · 2 en attente de modération",
    );
    expect(portfolioWords({ deposited: 1, pending: 0 })).toBe(
      "1 visuel déposé · aucun en attente de modération",
    );
  });

  it("says that nothing was deposited", () => {
    expect(portfolioWords({ deposited: 0, pending: 0 })).toBe(t.portfolioNone);
  });

  it("leads to the queue narrowed to the profile by the filter of the queue", () => {
    expect(profileFilterHref("abc")).toBe("/files/visuels?account=abc");
  });
});

describe("the texts of the blocks", () => {
  it("name no rate, no amount and no price: block 3 says none was entered and where costs are settled (D78, D48)", () => {
    expect(t.rates).toBe(
      "Aucun tarif saisi : les coûts se négocient avec le commercial.",
    );
    expect(JSON.stringify(t)).not.toMatch(/€|\$|£|\d+ ?%\s*(de|commission)/);
  });
});

describe("the contract of the creator blocks", () => {
  it("refuses a field outside the list: no handle, no band, no caption, no file name", () => {
    expect(accountCreatorSchema.safeParse(CREATOR).success).toBe(true);
    const line = CREATOR.networks[0];
    for (const extra of [
      { handle: "@someone" },
      { followersBand: "50k_100k" },
      { caption: "A caption" },
    ]) {
      expect(
        accountCreatorSchema.safeParse({
          ...CREATOR,
          networks: [{ ...line, ...extra }],
        }).success,
        JSON.stringify(extra),
      ).toBe(false);
    }
    expect(
      accountCreatorSchema.safeParse({
        ...CREATOR,
        portfolio: { ...CREATOR.portfolio, fileName: "a.jpg" },
      }).success,
    ).toBe(false);
  });

  it("refuses a figure that is not a whole number, a rate over 100 %, an unknown source", () => {
    const line = CREATOR.networks[0];
    for (const bad of [
      { followers: -1 },
      { followers: 1.5 },
      { engagementRateBp: 10001 },
      { source: "estimated" },
    ]) {
      expect(
        accountCreatorSchema.safeParse({
          ...CREATOR,
          networks: [{ ...line, ...bad }],
        }).success,
        JSON.stringify(bad),
      ).toBe(false);
    }
  });
});

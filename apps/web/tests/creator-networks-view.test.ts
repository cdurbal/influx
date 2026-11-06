// The rules of block 3 of "mon profil" (creator) that are not apps/api's (docs/mvp/07 RG41 to RG50,
// RG113 to RG116, CA10 to CA12, CA18; jalons/l2d, commit 13): the typed counts and the percentage read
// by their digits, the shape of a link, the draft and the patch of a line, "Confirmer mes chiffres"
// with its three metrics, the reasons of a refusal, the 90 days of RG50, the networks to add and the
// translations of the block. Pure functions, no browser.
import type { CreatorNetworkLine } from "@influx/contracts/creator-profile";
import { describe, expect, it } from "vitest";
import {
  FIGURES_STALE_AFTER_DAYS,
  LINE_FIELD_KEYS,
  PRIORITY_FIELD_KEYS,
  SECONDARY_FIELD_KEYS,
  afterLineSave,
  areFiguresStale,
  countOf,
  engagementBasisPointsOf,
  engagementTextOf,
  formatFiguresDate,
  holdsPriorityFigure,
  isProfileUrlShape,
  lineControlIdOf,
  lineDraftOf,
  lineErrorsOf,
  networkCodesOf,
  planConfirmation,
  planLinePatch,
  singleLinePatch,
} from "@/components/creator-profile/creator-networks-view";
import enCreatorProfile from "@/locales/en/creator-profile.json";
import frCreatorProfile from "@/locales/fr/creator-profile.json";

const LINE: CreatorNetworkLine = {
  id: "0b6f6d0e-6f3e-4a47-9d3f-2d1d6f7e8a90",
  networkCode: "instagram",
  isPrimary: true,
  handle: "camille_cuisine",
  pseudonym: null,
  profileUrl: "https://www.instagram.com/camille_cuisine",
  followersCount: 47312,
  postsLast30Days: 12,
  avgCommentsPerPost: 85,
  avgReachPerPost: null,
  engagementRateBp: 350,
  figuresSource: "declared",
  figuresMeasuredAt: "2026-08-01T10:00:00.000Z",
  audience: { mainCountry: null, otherCountries: [], ages: [], genders: [] },
  remainders: { countries: 100, ages: 100, genders: 100 },
  bands: null,
};

describe("L2D-13: the typed counts (07 RG46, RG116)", () => {
  it("reads a whole number from zero, a blank as not declared, anything else as no count", () => {
    expect(countOf("0")).toBe(0);
    expect(countOf(" 47312 ")).toBe(47312);
    expect(countOf("")).toBeNull();
    expect(countOf("   ")).toBeNull();
    for (const typed of ["-3", "12.5", "12,5", "1e3", "abc", "1 000"]) {
      expect(countOf(typed), typed).toBeUndefined();
    }
  });
});

describe("L2D-13: the engagement read by its digits, in basis points (EC-L2D-8)", () => {
  it("joins the whole digits to two decimal ones, point or comma", () => {
    expect(engagementBasisPointsOf("3.5")).toBe(350);
    expect(engagementBasisPointsOf("3,50")).toBe(350);
    expect(engagementBasisPointsOf("12")).toBe(1200);
    expect(engagementBasisPointsOf("0.05")).toBe(5);
    expect(engagementBasisPointsOf("100")).toBe(10000);
    expect(engagementBasisPointsOf("")).toBeNull();
  });

  it("refuses a third decimal, a sign, a value above 100 and a text", () => {
    for (const typed of [
      "3.555",
      "-1",
      "100.01",
      "101",
      "3%",
      "abc",
      "1.2.3",
    ]) {
      expect(engagementBasisPointsOf(typed), typed).toBeUndefined();
    }
  });

  it("writes basis points back to what was typed, and nothing for a value out of bounds", () => {
    expect(engagementTextOf(350)).toBe("3.5");
    expect(engagementTextOf(1200)).toBe("12");
    expect(engagementTextOf(5)).toBe("0.05");
    expect(engagementTextOf(10000)).toBe("100");
    expect(engagementTextOf(0)).toBe("0");
    expect(engagementTextOf(null)).toBe("");
    expect(engagementTextOf(10001)).toBe("");
    for (const typed of ["0", "0.05", "3.5", "12.34", "100"]) {
      expect(engagementTextOf(engagementBasisPointsOf(typed) ?? null)).toBe(
        typed,
      );
    }
  });
});

describe("L2D-13: the shape of a profile link (07 RG43, CA12)", () => {
  it("accepts https with a host, and refuses what the browser can tell is wrong", () => {
    expect(isProfileUrlShape("https://www.instagram.com/camille")).toBe(true);
    expect(isProfileUrlShape("  https://tiktok.com/@camille  ")).toBe(true);
    for (const typed of [
      "http://instagram.com/camille",
      "instagram.com/camille",
      "https://",
      "https://exa mple.com",
      "https://user:secret@instagram.com/camille",
      `https://instagram.com/${"a".repeat(500)}`,
    ]) {
      expect(isProfileUrlShape(typed), typed).toBe(false);
    }
  });
});

describe("L2D-13: the draft of a line", () => {
  it("shows what the line holds as typed text, a value not declared as an empty field", () => {
    expect(lineDraftOf(LINE)).toEqual({
      handle: "camille_cuisine",
      pseudonym: "",
      profileUrl: "https://www.instagram.com/camille_cuisine",
      followers: "47312",
      posts: "12",
      comments: "85",
      reach: "",
      engagement: "3.5",
    });
    expect(
      lineDraftOf({ ...LINE, followersCount: 0, postsLast30Days: 0 }).followers,
    ).toBe("0");
  });

  it("puts the three priority metrics first and in order, the two indicators after them (RG113)", () => {
    expect(PRIORITY_FIELD_KEYS).toEqual(["followers", "posts", "comments"]);
    expect(SECONDARY_FIELD_KEYS).toEqual(["reach", "engagement"]);
    expect(LINE_FIELD_KEYS.slice(-5)).toEqual([
      "followers",
      "posts",
      "comments",
      "reach",
      "engagement",
    ]);
  });
});

describe("L2D-13: the patch of the autosave of a line (07 RG111, RG14)", () => {
  const saved = lineDraftOf(LINE);

  it("sends nothing when nothing changed, and only what changed otherwise", () => {
    expect(planLinePatch(saved, saved).body).toBeNull();
    const plan = planLinePatch({ ...saved, followers: "50000" }, saved);
    expect(plan.body).toEqual({ followersCount: 50000 });
    expect(plan.keys).toEqual(["followers"]);
    expect(plan.refused).toEqual({});
  });

  it("empties a value with null, and reads the engagement in basis points", () => {
    const plan = planLinePatch(
      { ...saved, handle: "  ", reach: "", engagement: "4,25", posts: "0" },
      { ...saved, reach: "900" },
    );
    expect(plan.body).toEqual({
      handle: null,
      avgReachPerPost: null,
      engagementRateBp: 425,
      postsLast30Days: 0,
    });
  });

  it("refuses a field the schema or the shape refuses, and still sends the others", () => {
    const plan = planLinePatch(
      {
        ...saved,
        followers: "-3",
        comments: "12.5",
        engagement: "101",
        profileUrl: "instagram.com/camille",
        handle: "camille_bis",
      },
      saved,
    );
    expect(plan.refused).toEqual({
      followers: "count",
      comments: "count",
      engagement: "percentage",
      profileUrl: "url_shape",
    });
    expect(plan.body).toEqual({ handle: "camille_bis" });
    expect(plan.keys).toEqual(["handle"]);
  });

  it("leaves alone a field already refused until the member changes it (no loop)", () => {
    const plan = planLinePatch({ ...saved, followers: "-3" }, saved, {
      followers: "count",
    });
    expect(plan.body).toBeNull();
    expect(plan.refused).toEqual({});
  });

  it("splits a body into one field at a time, to name the wrong one", () => {
    const typed = { ...saved, followers: "50000", engagement: "abc" };
    expect(singleLinePatch("followers", typed)).toEqual({
      followersCount: 50000,
    });
    expect(singleLinePatch("engagement", typed)).toBeNull();
    expect(singleLinePatch("handle", { ...typed, handle: "" })).toEqual({
      handle: null,
    });
  });

  it("makes the fields sent the new reference of the next patch, the others untouched", () => {
    const typed = { ...saved, followers: "50000", handle: "autre" };
    const next = afterLineSave(saved, typed, ["followers"]);
    expect(next.followers).toBe("50000");
    expect(next.handle).toBe(saved.handle);
  });
});

describe('L2D-13: "Confirmer mes chiffres" carries the three metrics together (07 RG116, EC-L2D-6)', () => {
  const draft = lineDraftOf(LINE);

  it("sends the three, a blank one meaning not declared, and no secondary indicator", () => {
    expect(planConfirmation(draft)).toEqual({
      body: {
        followersCount: 47312,
        postsLast30Days: 12,
        avgCommentsPerPost: 85,
      },
      refused: null,
    });
    expect(planConfirmation({ ...draft, comments: "" }).body).toEqual({
      followersCount: 47312,
      postsLast30Days: 12,
      avgCommentsPerPost: null,
    });
  });

  it("names the metric that is not a count and sends nothing", () => {
    const plan = planConfirmation({ ...draft, posts: "-3", comments: "12,5" });
    expect(plan.body).toBeNull();
    expect(plan.refused).toEqual({ posts: "count", comments: "count" });
  });
});

describe("L2D-13: why the API refused a patch", () => {
  const refused = (issues: string[]) =>
    ({ kind: "failed", code: "validation_failed", issues }) as const;

  it("gives a link to another network and a handle already declared their own message (CA12, RG42)", () => {
    expect(
      lineErrorsOf(refused(["wrong_network"]), ["profileUrl", "handle"]),
    ).toEqual({ profileUrl: "wrong_network" });
    expect(lineErrorsOf(refused(["duplicate"]), ["handle"])).toEqual({
      handle: "duplicate",
    });
  });

  it("blames the field alone when only one was sent, and none of several for an unknown reason", () => {
    expect(lineErrorsOf(refused(["invalid"]), ["followers"])).toEqual({
      followers: "invalid",
    });
    expect(lineErrorsOf(refused(["invalid"]), ["followers", "posts"])).toEqual(
      {},
    );
    expect(lineErrorsOf({ kind: "failed" }, ["handle"])).toEqual({
      handle: "invalid",
    });
  });
});

describe("L2D-13: the date of the figures (07 RG49, RG50)", () => {
  const measured = "2026-08-01T10:00:00.000Z";
  const days = (count: number) =>
    new Date(Date.parse(measured) + count * 86_400_000);

  it("says the figures are to be refreshed after 90 days, not before, and never without a date", () => {
    expect(FIGURES_STALE_AFTER_DAYS).toBe(90);
    expect(areFiguresStale(measured, days(90))).toBe(false);
    expect(areFiguresStale(measured, days(91))).toBe(true);
    expect(areFiguresStale(null, days(400))).toBe(false);
  });

  it("writes the date in the language of the page", () => {
    expect(formatFiguresDate(measured, "fr")).toBe("1 août 2026");
    expect(formatFiguresDate(measured, "en")).toBe("August 1, 2026");
  });

  it("holds a priority figure when any of the three is entered, zero included", () => {
    expect(holdsPriorityFigure(LINE)).toBe(true);
    expect(
      holdsPriorityFigure({
        ...LINE,
        followersCount: null,
        postsLast30Days: 0,
        avgCommentsPerPost: null,
      }),
    ).toBe(true);
    expect(
      holdsPriorityFigure({
        ...LINE,
        followersCount: null,
        postsLast30Days: null,
        avgCommentsPerPost: null,
        avgReachPerPost: 900,
      }),
    ).toBe(false);
  });
});

describe("L2D-13: the networks to add and the controls", () => {
  it("lists each network of the formats once, in the order of the reference, UGC apart", () => {
    expect(
      networkCodesOf([
        { networkCode: "instagram" },
        { networkCode: "instagram" },
        { networkCode: "tiktok" },
        { networkCode: null },
        { networkCode: "x" },
      ]),
    ).toEqual(["instagram", "tiktok", "x"]);
    expect(networkCodesOf([])).toEqual([]);
  });

  it("gives each field of each line a control id of its own", () => {
    expect(lineControlIdOf("abc", "handle")).toBe("creator-network-abc-handle");
    expect(lineControlIdOf("abc", "handle")).not.toBe(
      lineControlIdOf("abd", "handle"),
    );
  });
});

describe("L2D-13: the translations of the block (T16-L2D, 07 RG112, RG113)", () => {
  const AUDIENCE = ["nano", "micro", "mid", "macro", "mega"];
  const RHYTHM = [
    "daily",
    "several_per_week",
    "weekly",
    "biweekly",
    "monthly_or_less",
  ];
  const COMMENTS = ["0_9", "10_49", "50_199", "200_999", "1000_plus"];

  it("labels every band of the reference lists, in both languages", () => {
    for (const messages of [frCreatorProfile, enCreatorProfile]) {
      expect(Object.keys(messages.reference.audience_band)).toEqual(AUDIENCE);
      expect(Object.keys(messages.reference.publication_frequency)).toEqual(
        RHYTHM,
      );
      expect(Object.keys(messages.reference.comment_band)).toEqual(COMMENTS);
    }
  });

  it("explains the three metrics and says the engagement is not shown, in both languages", () => {
    for (const messages of [frCreatorProfile, enCreatorProfile]) {
      expect(messages.priorityMetrics.explain).not.toBe("");
      expect(messages.posts30d.hint).not.toBe("");
      expect(messages.comments.hint).not.toBe("");
      expect(messages.engagement.unverified).not.toBe("");
      expect(messages.figures.stale).toContain("{date}");
      expect(messages.figures.stale).toContain("90");
      expect(messages.figures.confirm).not.toBe("");
    }
  });

  it("names the source and the date of the figures, and the three issues of a typed figure", () => {
    for (const messages of [frCreatorProfile, enCreatorProfile]) {
      expect(messages.figures.dated).toContain("{source}");
      expect(messages.figures.dated).toContain("{date}");
      expect(messages.figures.undated).toContain("{source}");
      expect(Object.keys(messages.figures.source).sort()).toEqual([
        "agent_observed",
        "declared",
      ]);
      for (const issue of ["count", "percentage", "url_shape"]) {
        expect(Object.keys(messages.issues), issue).toContain(issue);
      }
    }
  });

  it("asks for no badge, screenshot or tariff in the block", () => {
    for (const messages of [frCreatorProfile, enCreatorProfile]) {
      expect(JSON.stringify(messages.networks)).not.toMatch(
        /badge|capture|screenshot|tarif|price|€|\$/i,
      );
    }
  });
});

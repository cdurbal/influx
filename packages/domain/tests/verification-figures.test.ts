import { describe, expect, it } from "vitest";
import {
  checkObservedFigures,
  figureGap,
  POSTS_LAST_30_DAYS_MAX,
} from "../src/verification/index.ts";

const FIGURES = { followers: 47300, postsLast30Days: 12, avgComments: 40 };

describe("L2E-U1 the typed figures (08 RG38, RG38bis, cas limite 2, EC-L2E-12)", () => {
  it("accepts the three required figures, zero included, with or without an engagement", () => {
    expect(checkObservedFigures(FIGURES)).toEqual({ ok: true });
    expect(
      checkObservedFigures({
        followers: 0,
        postsLast30Days: 0,
        avgComments: 0,
        engagementBp: 0,
      }),
    ).toEqual({ ok: true });
    expect(checkObservedFigures({ ...FIGURES, engagementBp: null })).toEqual({
      ok: true,
    });
    expect(checkObservedFigures({ ...FIGURES, engagementBp: 10000 })).toEqual({
      ok: true,
    });
  });

  it("names the first missing, negative or fractional figure, the database's DETAIL", () => {
    const field = (input: object) => {
      const result = checkObservedFigures({ ...FIGURES, ...input });
      return result.ok ? null : result.field;
    };
    expect(field({ followers: null })).toBe("followers");
    expect(field({ followers: -1 })).toBe("followers");
    expect(field({ followers: 1.5 })).toBe("followers");
    expect(field({ followers: Number.NaN })).toBe("followers");
    expect(field({ postsLast30Days: undefined })).toBe("posts_last_30_days");
    expect(field({ postsLast30Days: -3 })).toBe("posts_last_30_days");
    expect(field({ postsLast30Days: POSTS_LAST_30_DAYS_MAX + 1 })).toBe(
      "posts_last_30_days",
    );
    expect(field({ avgComments: null })).toBe("avg_comments");
    expect(field({ avgComments: -1 })).toBe("avg_comments");
    expect(field({ followers: -1, avgComments: -1 })).toBe("followers");
  });

  it("refuses an engagement outside 0 to 100 % (350 % is refused), never an absent one", () => {
    const field = (engagementBp: number) => {
      const result = checkObservedFigures({ ...FIGURES, engagementBp });
      return result.ok ? null : result.field;
    };
    expect(field(35000)).toBe("engagement_bp");
    expect(field(10001)).toBe("engagement_bp");
    expect(field(-1)).toBe("engagement_bp");
    expect(field(3.5)).toBe("engagement_bp");
    expect(field(350)).toBeNull();
  });
});

describe("L2E-U3 the gap between declared and observed (08 RG41, RG42, CA28)", () => {
  const gap = (declared: number | null, observed: number, threshold = 30) =>
    figureGap({ declared, observed, thresholdPercent: threshold });

  it("is a subtraction, signed, with its distance", () => {
    expect(gap(120000, 38000)).toMatchObject({
      difference: -82000,
      distance: 82000,
    });
    expect(gap(1000, 1100)).toMatchObject({ difference: 100, distance: 100 });
    expect(gap(500, 500)).toEqual({ difference: 0, distance: 0, alert: false });
  });

  it("alerts above the threshold that comes in, never at it: 30 % of 1 000 is 300", () => {
    expect(gap(1000, 700)?.alert).toBe(false);
    expect(gap(1000, 1300)?.alert).toBe(false);
    expect(gap(1000, 699)?.alert).toBe(true);
    expect(gap(1000, 1301)?.alert).toBe(true);
    expect(gap(120000, 38000)?.alert).toBe(true);
    expect(gap(1000, 1300, 20)?.alert).toBe(true);
  });

  it("alerts for a 400 % gap and carries no refusal, and a declared zero alerts at the first follower", () => {
    expect(gap(1000, 5000)).toMatchObject({ alert: true, distance: 4000 });
    expect(gap(0, 0)?.alert).toBe(false);
    expect(gap(0, 1)?.alert).toBe(true);
    expect(Object.keys(gap(1000, 5000) ?? {}).sort()).toEqual([
      "alert",
      "difference",
      "distance",
    ]);
  });

  it("compares nothing when the creator declared nothing", () => {
    expect(gap(null, 4000)).toBeNull();
  });
});

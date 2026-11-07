// The figures an agent observes and types (docs/mvp/08 RG20, RG38, RG38bis, RG40 to RG42, cas limite
// 2; jalons/l2e/modele.md -12, -19; 0224 `verification.check_observed_figures`). Followers, posts of
// the last 30 days and average comments are required, whole, zero accepted, never negative; the
// engagement is optional and, when typed, from 0 to 100 % in basis points. A figure that cannot be
// read is not typed: it is never estimated, deduced or taken from the declared (RG38).
// The gap between declared and observed is a subtraction (RG41), computed at the read and never
// stored nor published; the alert threshold comes IN (`figures_gap_alert_percent`, RG42): the
// number is a setting of the table, and a gap never refuses anything.
import {
  OBSERVED_ENGAGEMENT_BP_MAX,
  POSTS_LAST_30_DAYS_MAX,
} from "./limits.ts";

/** The field a refusal names: the DETAIL of the database's `figures_invalid`. */
export type FiguresRefusal =
  "followers" | "posts_last_30_days" | "avg_comments" | "engagement_bp";

export type FiguresCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly field: FiguresRefusal };

export type ObservedFiguresInput = {
  readonly followers: number | null | undefined;
  readonly postsLast30Days: number | null | undefined;
  readonly avgComments: number | null | undefined;
  /** `null` or absent: the engagement was not readable, and stays empty (EC-L2E-12). */
  readonly engagementBp?: number | null | undefined;
};

function isCount(value: number | null | undefined, max: number): boolean {
  return (
    value !== null &&
    value !== undefined &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= max
  );
}

/** The figures of a constat; first refusal in the order of the database: followers, posts, comments, engagement. */
export function checkObservedFigures(
  input: ObservedFiguresInput,
): FiguresCheck {
  if (!isCount(input.followers, Number.MAX_SAFE_INTEGER)) {
    return { ok: false, field: "followers" };
  }
  if (!isCount(input.postsLast30Days, POSTS_LAST_30_DAYS_MAX)) {
    return { ok: false, field: "posts_last_30_days" };
  }
  if (!isCount(input.avgComments, Number.MAX_SAFE_INTEGER)) {
    return { ok: false, field: "avg_comments" };
  }
  const engagement = input.engagementBp;
  if (
    engagement !== null &&
    engagement !== undefined &&
    !isCount(engagement, OBSERVED_ENGAGEMENT_BP_MAX)
  ) {
    return { ok: false, field: "engagement_bp" };
  }
  return { ok: true };
}

export type FigureGap = {
  /** Observed minus declared: negative when the creator declared more than INFLUX saw. */
  readonly difference: number;
  /** The distance between the two, whatever its sign. */
  readonly distance: number;
  /** Whether the distance is above the threshold the caller passed: an internal alert, nothing else. */
  readonly alert: boolean;
};

/**
 * The gap of one figure (RG41, RG42). Without a declared value there is nothing to compare: `null`.
 * The distance is set against the threshold by comparing whole numbers, a declared value of zero
 * alerting as soon as anything was observed. Never a refusal, never published (RG42).
 */
export function figureGap(input: {
  readonly declared: number | null | undefined;
  readonly observed: number;
  /** The alert threshold of the table, in whole percent. */
  readonly thresholdPercent: number;
}): FigureGap | null {
  const { declared, observed, thresholdPercent } = input;
  if (declared === null || declared === undefined) return null;
  const difference = observed - declared;
  const distance = Math.abs(difference);
  const alert = distance * 100 > declared * thresholdPercent;
  return { difference, distance, alert };
}

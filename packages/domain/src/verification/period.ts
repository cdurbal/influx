// The period an agent reads on a dashboard evidence (docs/mvp/08 RG36, RG37, CA18, CA27, cas limite
// 2; jalons/l2e/modele.md §4; 0224 `verification.check_observed_period`). Required, in order, never
// in the future, and ended less than `freshnessDays` ago (the parameter `evidence_freshness_days`,
// 30 at the start): the number comes IN, it is a setting of the table and never a constant here
// (RG100). Dates are calendar days "YYYY-MM-DD" on the UTC date, as the database holds them.

export type PeriodRefusal =
  /** A date is absent or is not a calendar day (the database never sees the second case). */
  "period_missing" | "period_order" | "period_future" | "period_too_old";

export type PeriodCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: PeriodRefusal };

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/u;
const MILLISECONDS_IN_A_DAY = 86_400_000;

/**
 * The number of the day since 1970-01-01 (UTC) of a calendar day, or `null` when it is not one
 * ("2026-02-30" is not). Two numbers of days subtract; no clock, no time zone.
 */
export function dayNumberOf(day: string | null | undefined): number | null {
  if (day === null || day === undefined) return null;
  const parts = CALENDAR_DAY.exec(day);
  if (parts === null) return null;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const date = Number(parts[3]);
  const instant = new Date(Date.UTC(year, month - 1, date));
  // `Date.UTC` maps 0 to 99 onto 1900 to 1999 and rolls an impossible day over: both are refused.
  if (
    year < 100 ||
    instant.getUTCFullYear() !== year ||
    instant.getUTCMonth() !== month - 1 ||
    instant.getUTCDate() !== date
  ) {
    return null;
  }
  return Math.round(instant.getTime() / MILLISECONDS_IN_A_DAY);
}

/** The UTC calendar day of an instant, "YYYY-MM-DD": the `today` the database reads. */
export function utcDayOf(instant: Date): string {
  return instant.toISOString().slice(0, 10);
}

/**
 * The period of a constat (RG37). Order of the refusals, the database's: missing, order, future, too
 * old. `today` and `freshnessDays` are inputs: the caller reads the clock and the table.
 */
export function checkObservedPeriod(input: {
  readonly start: string | null | undefined;
  readonly end: string | null | undefined;
  readonly today: string;
  readonly freshnessDays: number;
}): PeriodCheck {
  const start = dayNumberOf(input.start);
  const end = dayNumberOf(input.end);
  const today = dayNumberOf(input.today);
  if (start === null || end === null || today === null) {
    return { ok: false, reason: "period_missing" };
  }
  if (start > end) return { ok: false, reason: "period_order" };
  if (end > today) return { ok: false, reason: "period_future" };
  if (today - end >= input.freshnessDays) {
    return { ok: false, reason: "period_too_old" };
  }
  return { ok: true };
}

/**
 * Whether a period that ended on `end` is still fresh on `today` (CA18): ended less than
 * `freshnessDays` ago and not in the future. The boundary day, `freshnessDays` ago, is too old.
 */
export function isPeriodFresh(input: {
  readonly end: string;
  readonly today: string;
  readonly freshnessDays: number;
}): boolean {
  const end = dayNumberOf(input.end);
  const today = dayNumberOf(input.today);
  if (end === null || today === null) return false;
  return end <= today && today - end < input.freshnessDays;
}

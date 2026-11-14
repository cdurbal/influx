// The calendar of a valid campaign in the campaign tests, derived from the UTC day of the run
// (L3C-01, L3BT-9): a fixed date goes stale once the rule of dates in the past applies (RG71, CA48).
// Re-exported by campaign-routes-kit.ts; kept apart so that the files without a server import it light.

/** The civil date (YYYY-MM-DD) `days` days after the UTC day of `today`. */
export function civilDateIn(days: number, today: Date = new Date()): string {
  const day = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate() + days,
  );
  return new Date(day).toISOString().slice(0, 10);
}

export type CampaignCalendar = {
  applicationsCloseOn: string;
  contentDueOn: string;
  startsOn: string;
  endsOn: string;
};

/**
 * Four dates of a valid campaign: the deadline 10 days from today (at least tomorrow), then the
 * delivery, the start and the end in the order of RG70, a 28-day period (at most 12 months, RG74).
 */
export function campaignCalendar(today: Date = new Date()): CampaignCalendar {
  return {
    applicationsCloseOn: civilDateIn(10, today),
    contentDueOn: civilDateIn(25, today),
    startsOn: civilDateIn(32, today),
    endsOn: civilDateIn(60, today),
  };
}

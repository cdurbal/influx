// The calendar of a campaign (docs/mvp/09 RG69, RG70, RG74): four civil dates, written YYYY-MM-DD,
// in order, and a publication period of 12 months at most. Pure and without a clock: nothing here
// reads the current date. The database holds the same two rules as table checks (0303
// campaigns_dates_ordered, written pair by pair, and campaigns_publication_window_max_12m).

/** The four dates, in the order RG70 imposes. */
export const CAMPAIGN_DATE_FIELDS = [
  "applicationsCloseOn",
  "contentDueOn",
  "startsOn",
  "endsOn",
] as const;

export type CampaignDateField = (typeof CAMPAIGN_DATE_FIELDS)[number];

export type CampaignDates = {
  readonly [field in CampaignDateField]?: string | null;
};

/** Two dates that break the order of RG70: the message names both. */
export type CampaignDateConflict = {
  /** The date that should come first. */
  readonly earlier: CampaignDateField;
  /** The date that should come after it, and comes before. */
  readonly later: CampaignDateField;
};

const CIVIL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u;

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The parts of a date that exists on the calendar, null for anything else. */
function parts(
  value: string | null | undefined,
): readonly [year: number, month: number, day: number] | null {
  if (value === null || value === undefined) return null;
  const match = CIVIL_DATE.exec(value);
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return [year, month, day];
}

/** Whether a value is a civil date that exists (2026-02-30 is not). */
export function isCivilDate(value: string | null | undefined): boolean {
  return parts(value) !== null;
}

/** The pairs of RG70, in the order of the calendar: every earlier date against every later one. */
const ORDERED_PAIRS: readonly (readonly [
  CampaignDateField,
  CampaignDateField,
])[] = CAMPAIGN_DATE_FIELDS.flatMap((earlier, index) =>
  CAMPAIGN_DATE_FIELDS.slice(index + 1).map(
    (later) => [earlier, later] as const,
  ),
);

/**
 * The pairs of dates that are out of order (RG70: application deadline <= delivery <= start <= end).
 * A pair counts when both dates are entered and exist; a date that is missing or malformed conflicts
 * with nothing (it is missing, which is another message). Compared pair by pair, as the database does.
 */
export function campaignDateConflicts(
  dates: CampaignDates,
): CampaignDateConflict[] {
  const conflicts: CampaignDateConflict[] = [];
  for (const [earlier, later] of ORDERED_PAIRS) {
    const from = dates[earlier];
    const to = dates[later];
    if (
      from !== null &&
      from !== undefined &&
      to !== null &&
      to !== undefined &&
      isCivilDate(from) &&
      isCivilDate(to) &&
      from > to // dates that exist and are written alike compare as text
    ) {
      conflicts.push({ earlier, later });
    }
  }
  return conflicts;
}

/**
 * Whether the publication period is longer than 12 months (RG74): the end falls after the start plus
 * 12 months, a 29 February start ending the 28th of the next February, as the database counts.
 * Nothing is said while one of the two dates is missing or malformed.
 */
export function isPublicationWindowTooLong(
  startsOn: string | null | undefined,
  endsOn: string | null | undefined,
): boolean {
  const start = parts(startsOn);
  const end = parts(endsOn);
  if (start === null || end === null) return false;
  const [year, month, day] = start;
  const limit = [
    year + 1,
    month,
    Math.min(day, daysInMonth(year + 1, month)),
  ] as const;
  for (let index = 0; index < 3; index += 1) {
    const actual = end[index] as number;
    const allowed = limit[index] as number;
    if (actual !== allowed) return actual > allowed;
  }
  return false;
}

/** What is wrong with the calendar: the conflicts of RG70 and the period of RG74, nothing when sound. */
export type CampaignDateIssues = {
  readonly conflicts: readonly CampaignDateConflict[];
  readonly windowTooLong: boolean;
};

export function campaignDateIssues(dates: CampaignDates): CampaignDateIssues {
  return {
    conflicts: campaignDateConflicts(dates),
    windowTooLong: isPublicationWindowTooLong(dates.startsOn, dates.endsOn),
  };
}

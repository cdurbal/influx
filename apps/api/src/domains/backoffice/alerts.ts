// The state alerts of the leads (docs/mvp/05 RG104, CA62; 15 §F RG63 to RG66, AL21, AL24 to AL27), derived
// at each read from the queue, the delays and the last reconciliation: an alert of state rises and
// falls by itself, it is never stored nor classified (RG64). Thresholds are data (0130, 0134), read
// with the facts; this module only decides, from plain values, which alerts are up. Recipients
// (0130 recipient_roles): AL24 the responsible agent and the admins, AL21 (0321) and AL25 to AL27 the
// admins. No
// alert leaves for Brevo or Apollo (RG70), none sanctions anything (RG65).
import type { Alert } from "@influx/contracts/backoffice-actions";
import type {
  SyncDestination,
  SyncSetting,
} from "@influx/contracts/backoffice-accounts";
import type {
  ConfigurationFailureRow,
  CreatorSearchVolumeRow,
  DestinationHealthRow,
  FailuresPastDelayRow,
  QueueDelayRow,
  ReconciliationRow,
} from "./alerts/repository.ts";
import type { CriticalMassAlertRow } from "./search-settings/repository.ts";
import type { ContactDestination } from "./sync-replay/repository.ts";

const DESTINATION: Readonly<Record<ContactDestination, SyncDestination>> = {
  brevo_contact: "brevo",
  apollo_contact: "apollo",
};

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** 0129 business_hours: ISO week days (1 = Monday), opening and closing times. */
export type BusinessHours = {
  timeZone: string;
  days: readonly number[];
  opens: string;
  closes: string;
};

/** The shape of 0129, read as data; null for calendar time or an unreadable value. */
export function businessHoursOf(
  value: Record<string, unknown> | null,
): BusinessHours | null {
  if (value === null) {
    return null;
  }
  const { time_zone: timeZone, days, opens, closes } = value;
  if (
    typeof timeZone !== "string" ||
    !Array.isArray(days) ||
    !days.every((day) => Number.isInteger(day) && day >= 1 && day <= 7) ||
    typeof opens !== "string" ||
    typeof closes !== "string" ||
    !/^\d{2}:\d{2}$/.test(opens) ||
    !/^\d{2}:\d{2}$/.test(closes)
  ) {
    return null;
  }
  return { timeZone, days: days as number[], opens, closes };
}

function minutesOfDay(time: string): number {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/**
 * The instant before which an entry has waited more than `minutes` of the queue's time: business
 * minutes within the opening hours of each open day, or calendar minutes. EC-J8-7: the business
 * hours of J8 are UTC; another time zone is read as calendar time (alerts earlier, never later).
 */
export function businessCutoff(
  now: Date,
  minutes: number,
  hours: BusinessHours | null,
): Date {
  if (hours === null || hours.timeZone !== "UTC") {
    return new Date(now.getTime() - minutes * MINUTE_MS);
  }
  const opens = minutesOfDay(hours.opens) * MINUTE_MS;
  const closes = minutesOfDay(hours.closes) * MINUTE_MS;
  if (closes <= opens || hours.days.length === 0) {
    return new Date(now.getTime() - minutes * MINUTE_MS);
  }
  let remaining = minutes * MINUTE_MS;
  let dayStart = Math.floor(now.getTime() / DAY_MS) * DAY_MS;
  // a year of days at most: 525 600 minutes, the bound of 0129, never needs more
  for (let day = 0; day < 400; day += 1) {
    const isoWeekday = ((new Date(dayStart).getUTCDay() + 6) % 7) + 1;
    if (hours.days.includes(isoWeekday)) {
      const start = dayStart + opens;
      const end = Math.min(dayStart + closes, now.getTime());
      if (end > start) {
        const available = end - start;
        if (available >= remaining) {
          return new Date(end - remaining);
        }
        remaining -= available;
      }
    }
    dayStart -= DAY_MS;
  }
  return new Date(dayStart);
}

/** AL24: failed lines waiting past the delay of the queue lead_sync_failures. */
export function failureAlerts(rows: readonly FailuresPastDelayRow[]): Alert[] {
  return rows
    .filter((row) => row.count > 0)
    .map((row) => ({
      code: "AL24",
      cause: "failures_past_delay",
      destination: DESTINATION[row.destination],
      setting: null,
      count: row.count,
      since: row.oldestAt,
    }));
}

/**
 * AL25 (CA62): a refused key, at once; otherwise a destination is down when lines still wait after
 * a failure for longer than the window and nothing of it succeeded within the window. The count is
 * the lines waiting for that destination. A quota error among them names the cause.
 */
export function destinationAlerts(
  rows: readonly DestinationHealthRow[],
): Alert[] {
  const alerts: Alert[] = [];
  for (const row of rows) {
    if (row.keyRefused > 0) {
      alerts.push({
        code: "AL25",
        cause: "access_key_refused",
        destination: DESTINATION[row.destination],
        setting: null,
        count: row.waiting,
        since: row.oldestKeyRefusedAt,
      });
      continue;
    }
    if (row.retryingOld > 0 && !row.recentSuccess) {
      alerts.push({
        code: "AL25",
        cause: row.quotaErrors > 0 ? "quota_exceeded" : "destination_down",
        destination: DESTINATION[row.destination],
        setting: null,
        count: row.waiting,
        since: row.oldestRetryingAt,
      });
    }
  }
  return alerts;
}

/**
 * AL25 for a configuration failure (05 RG160 point 3, CA82): from the first failed line, one alert
 * per setting at fault, named, never its value. It falls by itself once RG161 re-queued the lines.
 */
export function configurationAlerts(
  rows: readonly ConfigurationFailureRow[],
): Alert[] {
  return rows
    .filter((row) => row.count > 0)
    .map((row) => ({
      code: "AL25",
      cause: "configuration_missing",
      destination: DESTINATION[row.destination],
      setting: row.setting satisfies SyncSetting,
      count: row.count,
      since: row.oldestAt,
    }));
}

/** AL26 (RG79): the share of lines in time over one sliding day, below the minimum share. */
export function delayAlerts(
  rows: readonly QueueDelayRow[],
  minShareBasisPoints: number,
): Alert[] {
  return rows
    .filter(
      (row) =>
        row.eligible > 0 &&
        row.inTime * 10_000 < minShareBasisPoints * row.eligible,
    )
    .map((row) => ({
      code: "AL26",
      cause: "queue_late",
      destination: DESTINATION[row.destination],
      setting: null,
      count: row.eligible - row.inTime,
      since: row.oldestLateAt,
    }));
}

/**
 * AL27 (RG90, RG91): the last reconciliation failed, or found more withdrawals than the webhook
 * brought; up until the next run says otherwise. No run yet: nothing to say.
 */
export function reconciliationAlerts(
  run: ReconciliationRow | null,
  maxGap: number,
): Alert[] {
  if (run === null) {
    return [];
  }
  if (run.outcome === "failed") {
    return [
      {
        code: "AL27",
        cause: "reconciliation_failed",
        destination: null,
        setting: null,
        count: 0,
        since: run.finishedAt,
      },
    ];
  }
  return run.gap > maxGap
    ? [
        {
          code: "AL27",
          cause: "unsubscribe_gap",
          destination: null,
          setting: null,
          count: run.gap,
          since: run.finishedAt,
        },
      ]
    : [];
}

/**
 * AL21 (I-9; 10 RG68, CA44): an account whose creators served, searches or refusals are abnormal.
 * The account, the cause and a count: never a filter nor a creator. It falls by itself (RG64).
 */
export function creatorSearchVolumeAlerts(
  rows: readonly CreatorSearchVolumeRow[],
): Alert[] {
  return rows.map((row) => ({
    code: "AL21",
    cause: row.cause,
    destination: null,
    setting: null,
    accountId: row.accountId,
    count: row.count,
    since: row.since,
  }));
}

/**
 * AL65 (CA60; 10 RG2; l3g/modele.md §6) and AL22 (15 AL22), for the admins: the critical mass reached or lost
 * with the search in the other state, the counters stale, the searches of the brand view blocked by k. The base
 * computes them (search.critical_mass_alerts(), 0331) from its own thresholds; they PROPOSE, nothing here opens
 * the search (RG2). A count and a date: never an account, a filter nor a creator. It falls by itself (RG64).
 */
export function criticalMassAlerts(
  rows: readonly CriticalMassAlertRow[],
): Alert[] {
  return rows.map((row) => ({
    code: row.code,
    cause: row.cause,
    destination: null,
    setting: null,
    count: row.observed ?? 0,
    since: row.since,
  }));
}

/**
 * AL23 (15 §F; l3g/modele.md §5): requests of queue 9 left open past the deadline frozen at their deposit, for
 * the agents and the admins. The count is the requests past it, the date the oldest deadline; the requests of a
 * brand the caller holds are not counted (15 RG36). It falls by itself once they are taken and closed (RG64).
 */
export function teamSelectionDeadlineAlerts(overdue: {
  count: number;
  since: string | null;
}): Alert[] {
  return overdue.count > 0
    ? [
        {
          code: "AL23",
          cause: "selection_past_deadline",
          destination: null,
          setting: null,
          count: overdue.count,
          since: overdue.since,
        },
      ]
    : [];
}

/** A number of a threshold, or the starting value of its document when absent. */
export function thresholdNumber(
  threshold: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
): number {
  const value = threshold?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** A list of codes of a threshold, or the starting value of its document when absent. */
export function thresholdCodes(
  threshold: Record<string, unknown> | undefined,
  key: string,
  fallback: readonly string[],
): readonly string[] {
  const value = threshold?.[key];
  return Array.isArray(value) &&
    value.every((item): item is string => typeof item === "string")
    ? value
    : fallback;
}

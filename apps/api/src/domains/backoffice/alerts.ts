// The state alerts of the leads (docs/mvp/05 RG104, CA62; 15 §F RG63 to RG66, AL24 to AL27), derived
// at each read from the queue, the delays and the last reconciliation: an alert of state rises and
// falls by itself, it is never stored nor classified (RG64). Thresholds are data (0130, 0134), read
// with the facts; this module only decides, from plain values, which alerts are up. Recipients
// (0130 recipient_roles): AL24 the responsible agent and the admins, AL25 to AL27 the admins. No
// alert leaves for Brevo or Apollo (RG70), none sanctions anything (RG65).
import type { Alert } from "@influx/contracts/backoffice-actions";
import type { SyncDestination } from "@influx/contracts/backoffice-accounts";
import type {
  ContactDestination,
  DestinationHealthRow,
  FailuresPastDelayRow,
  QueueDelayRow,
  ReconciliationRow,
} from "./repository.ts";

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
        count: row.waiting,
        since: row.oldestRetryingAt,
      });
    }
  }
  return alerts;
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
          count: run.gap,
          since: run.finishedAt,
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

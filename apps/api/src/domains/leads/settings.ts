// The worker keys of leads.sync_settings that the loop and the connectors read (EC-8), at every
// consumption by leads.begin_outbox_attempt() (05 RG81), never cached at start. Their shape is
// already checked by the database (0103); a value that does not parse here is a misconfiguration,
// logged by its key only. Since D67 (05 RG160), a setting a line needs and that is missing is an
// incident, never a normal case: the line fails, named by a closed list of paths (RG164).
import { z } from "zod";
import type { OutboxDestination } from "./repository.ts";

/**
 * 05 RG164: the settings a mapping may lack, by a closed list of paths (never a value), and the
 * code of the configuration failure each gives (RG160). D69: no Brevo template is read any more.
 */
export const MISSING_SETTING_CODES = {
  "brevo_list_ids.advertisers": "list_not_configured",
  "brevo_list_ids.creators": "list_not_configured",
} as const;
export type MissingSetting = keyof typeof MISSING_SETTING_CODES;

/** The code of the configuration failure of a line that lacks these settings; null: none lacks. */
export function configurationFailureCode(
  missing: readonly MissingSetting[],
): string | null {
  const first = missing[0];
  return first === undefined ? null : MISSING_SETTING_CODES[first];
}

/** The Brevo list of a member role (brevo_list_ids, 0103): a positive integer, or null. */
export function brevoListIdOf(
  settings: Readonly<Record<string, unknown>>,
  role: "advertiser" | "creator",
): number | null {
  const ids = settings.brevo_list_ids;
  if (typeof ids !== "object" || ids === null) {
    return null;
  }
  const value = (ids as Record<string, unknown>)[
    role === "advertiser" ? "advertisers" : "creators"
  ];
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

/** The path of the Brevo list of a member role, as RG164 names it. */
export function brevoListPathOf(
  role: "advertiser" | "creator",
): MissingSetting {
  return role === "advertiser"
    ? "brevo_list_ids.advertisers"
    : "brevo_list_ids.creators";
}

/** The bound of a delay accepted by leads.complete_outbox_attempt() (0111): 48 hours. */
export const MAX_RETRY_DELAY_SECONDS = 172_800;

/**
 * The starting values of 05 RG79 (EC-9), the same as the seed of 0103: used only when the
 * setting cannot be read, so that a waiting line still gets a delay.
 */
export const RG79_STARTING_SCHEDULE: readonly number[] = [
  0, 60, 300, 900, 3600, 10800, 21600, 43200, 86400, 86400,
];

const retryScheduleSchema = z
  .array(z.int().min(0).max(MAX_RETRY_DELAY_SECONDS))
  .min(1)
  .max(10);

const rateLimitsSchema = z.record(z.string(), z.int().positive());

/** retry_schedule: the delays in seconds before attempts 1 to 10; null when unreadable. */
export function retryScheduleOf(
  settings: Readonly<Record<string, unknown>>,
): readonly number[] | null {
  const parsed = retryScheduleSchema.safeParse(settings.retry_schedule);
  return parsed.success ? parsed.data : null;
}

/** rate_limits: the calls a minute of one category (lead-pipeline T5); null when absent. */
export function ratePerMinuteOf(
  settings: Readonly<Record<string, unknown>>,
  category: OutboxDestination,
): number | null {
  const parsed = rateLimitsSchema.safeParse(settings.rate_limits);
  return parsed.success
    ? (parsed.data[`${category}_per_minute`] ?? null)
    : null;
}

/**
 * The wait after a failed attempt (05 RG79): the provider's Retry-After when it gave one, else the
 * delay before the next attempt, retry_schedule[attempt] (the last value past the end), always
 * within 0 and 48 hours.
 */
export function retryDelaySeconds(
  schedule: readonly number[],
  attempt: number,
  retryAfterSeconds?: number,
): number {
  const delay =
    retryAfterSeconds ??
    schedule[Math.min(attempt, schedule.length - 1)] ??
    MAX_RETRY_DELAY_SECONDS;
  return Math.min(Math.max(Math.ceil(delay), 0), MAX_RETRY_DELAY_SECONDS);
}

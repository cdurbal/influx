// The two worker keys of leads.sync_settings that the loop itself uses (EC-8), read at every
// consumption by leads.begin_outbox_attempt() (05 RG81), never cached at start. Their shape is
// already checked by the database (0103); a value that does not parse here is a misconfiguration,
// logged by its key only.
import { z } from "zod";
import type { OutboxDestination } from "./repository.ts";

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

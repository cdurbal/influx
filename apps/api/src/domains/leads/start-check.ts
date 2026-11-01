// 05 RG162 (D67, amended by D69): the settings every sign-up needs, checked by the worker at start,
// after the Brevo list ids of its environment (D68), on the values its start step has just read
// from the database (never cached, RG81). A deployed environment refuses to start without them; in
// development the worker starts and names them (leads.settings.missing_at_start). The same verdict
// is drawn by `staging:check` (runbook staging §0). Names only, never a value (18 T17.9).
//
// Deliberately outside the refusal (RG162): the transactional templates (D69: none is read any
// more) and an Apollo key while countries are open; those are RG160 and RG161 at consumption.
import { unreadableApolloKeys } from "./connectors/apollo/qualification.ts";
import type { OutboxDestination } from "./repository.ts";
import {
  brevoListIdOf,
  brevoListPathOf,
  ratePerMinuteOf,
  retryScheduleOf,
} from "./settings.ts";

/** The destinations in the order of the names of a verdict. */
const DESTINATIONS: readonly OutboxDestination[] = [
  "brevo_contact",
  "brevo_transactional",
  "apollo_contact",
];

/**
 * The settings at fault, by name: the two Brevo lists (brevo_list_ids.advertisers, .creators), a
 * readable retry_schedule, a rate limit for each destination with a key
 * (rate_limits.<destination>_per_minute), and the three Apollo keys when the worker holds an Apollo
 * key (an empty list of excluded countries is valid, RG84). Empty: the worker may start.
 */
export function startSettingsIssues(
  settings: Readonly<Record<string, unknown>>,
  destinationsWithKey: readonly OutboxDestination[],
): string[] {
  const issues: string[] = [];
  for (const role of ["advertiser", "creator"] as const) {
    if (brevoListIdOf(settings, role) === null) {
      issues.push(brevoListPathOf(role));
    }
  }
  if (retryScheduleOf(settings) === null) {
    issues.push("retry_schedule");
  }
  const withKey = new Set(destinationsWithKey);
  for (const destination of DESTINATIONS) {
    if (
      withKey.has(destination) &&
      ratePerMinuteOf(settings, destination) === null
    ) {
      issues.push(`rate_limits.${destination}_per_minute`);
    }
  }
  if (withKey.has("apollo_contact")) {
    issues.push(...unreadableApolloKeys(settings));
  }
  return issues;
}

export type StartCheckLogger = {
  fatal(object: object, message: string): void;
  error(object: object, message: string): void;
};

/**
 * The verdict of RG162 at start, logged by names only. `required` (a deployed environment, D70):
 * a setting at fault refuses the start, the caller exits non-zero before its first turn (CA85).
 * Otherwise (development) the line leads.settings.missing_at_start names them, and RG160 and RG164
 * apply at consumption. Returns whether the worker may go on.
 */
export function checkSettingsAtStart(
  settings: Readonly<Record<string, unknown>>,
  destinationsWithKey: readonly OutboxDestination[],
  required: boolean,
  logger: StartCheckLogger,
): boolean {
  const issues = startSettingsIssues(settings, destinationsWithKey);
  if (issues.length === 0) {
    return true;
  }
  if (required) {
    logger.fatal(
      { settings: issues, rule: "05 RG162" },
      `missing settings, refusing to start (05 RG162): ${issues.join(", ")}`,
    );
    return false;
  }
  logger.error({ settings: issues }, "leads.settings.missing_at_start");
  return true;
}

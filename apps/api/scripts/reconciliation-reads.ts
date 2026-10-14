// The `reconciliation` mode of the manual trial (J7 commit 10; 16 §M1 operations 9 and 10; D62):
// the two Brevo reads of the daily reconciliation, called ONCE each through the client of E-4
// (src/domains/maintenance/brevo-reads.ts), a page of 10 at most, on the last 24 hours. The
// recorder of the trial sits around the fetch it is given. No database here: the mode reads Brevo
// and writes nothing (its unit test proves no client of `postgres` is ever built).
import {
  BrevoReadError,
  createBrevoReads,
} from "../src/domains/maintenance/brevo-reads.ts";

/** The trial reads one small page: enough for a fixture, never the whole test account. */
export const TRIAL_PAGE_SIZE = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

/** What each read gave: a count, or the closed code of its failure (never Brevo's text). */
export type ReconciliationReadsOutcome = {
  contacts: number | string;
  smtpSpamEvents: number | string;
};

async function outcomeOf(
  read: () => Promise<unknown[]>,
): Promise<number | string> {
  try {
    return (await read()).length;
  } catch (error) {
    // A full page of 10 ends `brevo.too_many_pages` (one page only): the exchange is recorded.
    if (error instanceof BrevoReadError) {
      return error.code;
    }
    throw error;
  }
}

export async function readReconciliationOnce(settings: {
  apiKey: string;
  baseUrl: string;
  fetch: typeof fetch;
  now: Date;
}): Promise<ReconciliationReadsOutcome> {
  const reads = createBrevoReads(
    { apiKey: settings.apiKey, baseUrl: settings.baseUrl },
    { fetch: settings.fetch, pageSize: TRIAL_PAGE_SIZE, maxPages: 1 },
  );
  const since = new Date(settings.now.getTime() - DAY_MS);
  return {
    contacts: await outcomeOf(() => reads.contactsModifiedSince(since)),
    smtpSpamEvents: await outcomeOf(() =>
      reads.smtpSpamEvents(
        since.toISOString().slice(0, 10),
        settings.now.toISOString().slice(0, 10),
      ),
    ),
  };
}

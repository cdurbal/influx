// The daily reconciliation of the last 48 hours (05 RG91, 16 RG113, CA53; decision 3 of the J7
// start): what Brevo knows of the withdrawals and complaints, read back, is written as raw lines
// (origin `reconciliation`) and processed by the SAME path as a webhook (E-3, inbound/processing
// .ts). Nothing is applied here; no external call is made inside a transaction (02 §18.4 G4).
//   operation 9   the contacts modified within 48 h: each one blacklisted is an unsubscription,
//                 attached by its INFLUX_ACCOUNT_ID (`account_ref`), else by its exact address
//   operation 10  the transactional complaints of the days J-2 to J, within 48 h: each one a
//                 `spam` line with its message-id (the channel is read from transactional_sends)
// The instant is cut to the second, as the webhook's `ts_event`: an event the webhook already
// brought has the same dedup key and is not written again (RG146-5). The GAP (counts.gap) is the
// number of new raw lines: what the webhook missed, at most (a contact modified for another reason
// after its unsubscription is written again, and processed without effect, `no_change`).
// A complaint on a marketing e-mail is read back as an unsubscription (operation 9 does not say
// which): the consent is withdrawn, the suppression of RG93 waits for the webhook or an admin.
import type { BrevoReads } from "./brevo-reads.ts";
import {
  checkNotStopped,
  type PeriodicStore,
  type PeriodicTaskRunner,
  type ReconciliationFinding,
} from "./periodic.ts";

/** 05 RG91: the window read back. */
export const RECONCILIATION_WINDOW_MS = 48 * 3_600_000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ISO 8601 cut to the second, as the webhook's `ts_event`. */
function secondOf(instant: number): string {
  return new Date(Math.floor(instant / 1000) * 1000).toISOString();
}

function accountRefOf(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value)
    ? value.toLowerCase()
    : null;
}

export function createBrevoReconciliation(dependencies: {
  reads: BrevoReads;
  store: PeriodicStore;
  now: () => number;
}): PeriodicTaskRunner {
  const { reads, store, now } = dependencies;
  return async (run, counts, signal) => {
    const at = now();
    const since = at - RECONCILIATION_WINDOW_MS;
    const findings: ReconciliationFinding[] = [];

    const contacts = await reads.contactsModifiedSince(new Date(since));
    counts.contacts_listed = contacts.length;
    for (const contact of contacts) {
      if (contact.emailBlacklisted && contact.modifiedAt >= since) {
        findings.push({
          event: "unsubscribed",
          occurredAt: secondOf(contact.modifiedAt),
          messageId: null,
          email: contact.email,
          accountRef: accountRefOf(contact.influxAccountId),
        });
      }
    }
    counts.unsubscribed_found = findings.length;
    checkNotStopped(signal);

    const startDay = new Date(since).toISOString().slice(0, 10);
    const endDay = new Date(at).toISOString().slice(0, 10);
    const complaints = await reads.smtpSpamEvents(startDay, endDay);
    let spam = 0;
    for (const complaint of complaints) {
      if (complaint.occurredAt >= since) {
        spam += 1;
        findings.push({
          event: "spam",
          occurredAt: secondOf(complaint.occurredAt),
          messageId: complaint.messageId,
          email: complaint.email,
          accountRef: null,
        });
      }
    }
    counts.spam_found = spam;
    checkNotStopped(signal);

    const { recorded, refused } = await store.recordFindings(run, findings);
    counts.gap = recorded;
    counts.refused = refused;
  };
}

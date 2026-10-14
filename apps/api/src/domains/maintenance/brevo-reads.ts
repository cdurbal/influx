// The two Brevo reads of the daily reconciliation (05 RG91, 16 RG113; decision 3 of the J7 start),
// operations 9 and 10 of 16 §M1. Official reference read on 2026-10-13 (RG150):
//   9   GET /v3/contacts?limit&offset&modifiedSince&sort
//       https://developers.brevo.com/reference/get-contacts — limit 1 to 1000 (default 50);
//       modifiedSince a UTC date-time `YYYY-MM-DDTHH:mm:ss.SSSZ`; answer `{contacts, count}`, each
//       contact `id`, `email`, `emailBlacklisted`, `modifiedAt` (UTC), `attributes`. NO filter on
//       the blacklist: the blacklisted contacts are kept here.
//   10  GET /v3/smtp/statistics/events?event=spam&startDate&endDate&limit&offset&sort
//       https://developers.brevo.com/reference/get-email-event-report — dates `YYYY-MM-DD`, both
//       or none, 90 days at most; answer `{events}`, each `email`, `date` (UTC), `messageId`,
//       `event`; no maximum stated for limit (default 2500).
// Each call bounded in time (02 §18.4 G1: 3 s), pages capped. Worker only (brevo-guard.test.ts).
// Nothing of Brevo's answer reaches a log line: a failure is a closed code (D60).
import { BREVO_CALL_TIMEOUT_MS } from "../leads/connectors/brevo/client.ts";

/** Operation 9: page size (the maximum of the reference). */
export const CONTACTS_PAGE_SIZE = 1_000;
/** Operation 10: page size. */
export const SMTP_EVENTS_PAGE_SIZE = 1_000;
/** Pages read at most per operation and per run; beyond, the run fails (`brevo.too_many_pages`). */
export const MAX_PAGES = 20;

export type BrevoReadFailureCode =
  | "brevo.unreachable"
  | "brevo.rate_limited"
  | "brevo.unauthorized"
  | "brevo.unavailable"
  | "brevo.rejected"
  | "brevo.malformed"
  | "brevo.too_many_pages";

/** A read that failed: the run stops and is closed `failed`, with this code only. */
export class BrevoReadError extends Error {
  readonly code: BrevoReadFailureCode;

  constructor(code: BrevoReadFailureCode) {
    super(code);
    this.name = "BrevoReadError";
    this.code = code;
  }
}

/** A Brevo contact as the reconciliation reads it. */
export type BrevoListedContact = {
  email: string;
  emailBlacklisted: boolean;
  /** Epoch ms. */
  modifiedAt: number;
  /** The INFLUX_ACCOUNT_ID attribute, as Brevo holds it (unchecked). */
  influxAccountId: unknown;
};

/** A transactional event as the reconciliation reads it. */
export type BrevoListedSmtpEvent = {
  email: string;
  /** Epoch ms. */
  occurredAt: number;
  messageId: string;
};

export type BrevoReads = {
  /** Operation 9: every contact modified since `since`, page after page. */
  contactsModifiedSince(since: Date): Promise<BrevoListedContact[]>;
  /** Operation 10: the transactional complaints of the days `startDay` to `endDay` (YYYY-MM-DD). */
  smtpSpamEvents(
    startDay: string,
    endDay: string,
  ): Promise<BrevoListedSmtpEvent[]>;
};

export type BrevoReadsSettings = {
  apiKey: string;
  baseUrl: string;
};

function objectOf(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function instantOf(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const instant = Date.parse(value);
  return Number.isNaN(instant) ? null : instant;
}

export function createBrevoReads(
  settings: BrevoReadsSettings,
  dependencies: { fetch?: typeof fetch; timeoutMs?: number } = {},
): BrevoReads {
  const doFetch = dependencies.fetch ?? fetch;
  const timeoutMs = dependencies.timeoutMs ?? BREVO_CALL_TIMEOUT_MS;

  async function get(
    path: string,
    query: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const search = new URLSearchParams(query).toString();
    let response: Response;
    let text: string;
    try {
      response = await doFetch(`${settings.baseUrl}${path}?${search}`, {
        method: "GET",
        headers: { "api-key": settings.apiKey, accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      text = await response.text();
    } catch {
      // Time-out or network: the error may quote the URL, never kept.
      throw new BrevoReadError("brevo.unreachable");
    }
    if (response.status === 429) {
      throw new BrevoReadError("brevo.rate_limited");
    }
    if (response.status === 401 || response.status === 403) {
      throw new BrevoReadError("brevo.unauthorized");
    }
    if (response.status >= 500) {
      throw new BrevoReadError("brevo.unavailable");
    }
    if (response.status !== 200) {
      throw new BrevoReadError("brevo.rejected");
    }
    let body: unknown;
    try {
      body = text.length > 0 ? JSON.parse(text) : {};
    } catch {
      throw new BrevoReadError("brevo.malformed");
    }
    const object = objectOf(body);
    if (object === null) {
      throw new BrevoReadError("brevo.malformed");
    }
    return object;
  }

  return {
    async contactsModifiedSince(since) {
      const listed: BrevoListedContact[] = [];
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const body = await get("/contacts", {
          limit: String(CONTACTS_PAGE_SIZE),
          offset: String(page * CONTACTS_PAGE_SIZE),
          modifiedSince: since.toISOString(),
          sort: "asc",
        });
        const contacts = body.contacts ?? [];
        if (!Array.isArray(contacts)) {
          throw new BrevoReadError("brevo.malformed");
        }
        for (const item of contacts) {
          const contact = objectOf(item);
          const modifiedAt = instantOf(contact?.modifiedAt);
          if (
            contact === null ||
            modifiedAt === null ||
            typeof contact.emailBlacklisted !== "boolean"
          ) {
            throw new BrevoReadError("brevo.malformed");
          }
          // A contact without an address (an SMS-only contact) concerns no e-mail consent.
          if (typeof contact.email !== "string" || contact.email === "") {
            continue;
          }
          listed.push({
            email: contact.email,
            emailBlacklisted: contact.emailBlacklisted,
            modifiedAt,
            influxAccountId: objectOf(contact.attributes)?.INFLUX_ACCOUNT_ID,
          });
        }
        if (contacts.length < CONTACTS_PAGE_SIZE) {
          return listed;
        }
      }
      throw new BrevoReadError("brevo.too_many_pages");
    },

    async smtpSpamEvents(startDay, endDay) {
      const listed: BrevoListedSmtpEvent[] = [];
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const body = await get("/smtp/statistics/events", {
          event: "spam",
          startDate: startDay,
          endDate: endDay,
          limit: String(SMTP_EVENTS_PAGE_SIZE),
          offset: String(page * SMTP_EVENTS_PAGE_SIZE),
          sort: "asc",
        });
        // `events` is optional in the reference: absent when there is none.
        const events = body.events ?? [];
        if (!Array.isArray(events)) {
          throw new BrevoReadError("brevo.malformed");
        }
        for (const item of events) {
          const event = objectOf(item);
          const occurredAt = instantOf(event?.date);
          if (
            event === null ||
            occurredAt === null ||
            typeof event.email !== "string" ||
            typeof event.messageId !== "string" ||
            event.event !== "spam"
          ) {
            throw new BrevoReadError("brevo.malformed");
          }
          listed.push({
            email: event.email,
            occurredAt,
            messageId: event.messageId,
          });
        }
        if (events.length < SMTP_EVENTS_PAGE_SIZE) {
          return listed;
        }
      }
      throw new BrevoReadError("brevo.too_many_pages");
    },
  };
}

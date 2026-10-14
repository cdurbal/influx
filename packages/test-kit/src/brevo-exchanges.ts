// The exchanges the Brevo double answers from (docs/mvp/16 RG148): one request and its answer per
// operation of 16 §M1 used by INFLUX, by Brevo API v3. Their shape is that of Brevo's reference as
// read on 2026-09-19 (16 §M1, RG150), checked against the redacted recordings of the manual trial
// (D62, J6 commit 7, 2026-10-12): contact created 201 `{ id }` (an empty date attribute accepted),
// updated 204, blacklisted 204 (twice), unknown contact 404, refused key 401, e-mail sent 201. NOT
// recorded: the list operations (no suppression list in the test account), 429 and 503, still drafted.
// Drafted too, from the reference read on 2026-10-09 and 2026-10-13 (J7 decision 5; developers.brevo
// .com transactional-webhooks and marketing-webhooks), until the trial of J7 commit 10: the address
// change by contact id, and the bodies Brevo posts to the webhook (INBOUND_EXEMPLARS). Drafted from
// the reference read on 2026-10-13 (16 §M1 operations 9 and 10, J7 commit 5): the two reads of the
// daily reconciliation, CONTACTS_LISTED and SMTP_EVENTS_LISTED, to be recorded at commit 10.
// Nothing here is a real identifier, a real address or a key.
//
// A recording is the contract of the double: a test that passes against the double passes against
// these answers, and only against them. A new answer of Brevo is a new exchange here, never a
// literal inside a test.

export type RecordedExchange = {
  /** What INFLUX sends, as recorded (addresses replaced by a placeholder of example.test). */
  request: {
    method: "GET" | "POST" | "PUT";
    path: string;
    body?: unknown;
  };
  response: {
    status: number;
    headers?: Record<string, string>;
    body?: unknown;
  };
};

/** Operation 1: a contact created (`updateEnabled`, the address unknown to Brevo). */
export const CONTACT_CREATED: RecordedExchange = {
  request: {
    method: "POST",
    path: "/v3/contacts",
    body: {
      email: "recorded-contact@example.test",
      attributes: { INFLUX_ACCOUNT_ID: "00000000-0000-4000-8000-000000000001" },
      listIds: [2],
      updateEnabled: true,
    },
  },
  response: { status: 201, body: { id: 21 } },
};

/** Operation 1: the same contact updated (`updateEnabled`, the address known): no body. */
export const CONTACT_UPDATED: RecordedExchange = {
  request: CONTACT_CREATED.request,
  response: { status: 204 },
};

/** Operation 2: unsubscription of a known contact (`emailBlacklisted`). */
export const CONTACT_BLACKLISTED: RecordedExchange = {
  request: {
    method: "PUT",
    path: "/v3/contacts/recorded-contact%40example.test",
    body: { emailBlacklisted: true },
  },
  response: { status: 204 },
};

/** Operation 2 on an address Brevo does not know. */
export const CONTACT_NOT_FOUND: RecordedExchange = {
  request: CONTACT_BLACKLISTED.request,
  response: {
    status: 404,
    body: { code: "document_not_found", message: "Contact does not exist" },
  },
};

/** Operation 7: the address added to the marketing exclusion list. */
export const LIST_CONTACT_ADDED: RecordedExchange = {
  request: {
    method: "POST",
    path: "/v3/contacts/lists/7/contacts/add",
    body: { emails: ["recorded-contact@example.test"] },
  },
  response: {
    status: 201,
    body: {
      contacts: { success: ["recorded-contact@example.test"], failure: [] },
    },
  },
};

/** Operation 7, the address already in the list: Brevo refuses, nothing changes. */
export const LIST_CONTACT_ALREADY_IN: RecordedExchange = {
  request: LIST_CONTACT_ADDED.request,
  response: {
    status: 400,
    body: {
      code: "invalid_parameter",
      message: "Contact already in list and/or does not exist",
    },
  },
};

/** Operation 6: a unitary transactional send accepted. */
export const SMTP_EMAIL_SENT: RecordedExchange = {
  request: {
    method: "POST",
    path: "/v3/smtp/email",
    body: {
      sender: { name: "INFLUX", email: "no-reply@tx.example.test" },
      to: [{ email: "recorded-contact@example.test" }],
      templateId: 3,
      params: { LANGUAGE: "fr" },
      tags: ["account.welcome_creator"],
    },
  },
  response: {
    status: 201,
    body: { messageId: "<202609191200.00000000001@smtp-relay.mailin.fr>" },
  },
};

/** Any path: the key refused (16 §M5, authentication class). */
export const UNAUTHORIZED: RecordedExchange = {
  request: CONTACT_CREATED.request,
  response: {
    status: 401,
    body: { code: "unauthorized", message: "Key not found" },
  },
};

/** Any path: the rate limit reached, with the delay before the next window (16 RG139). */
export const TOO_MANY_REQUESTS: RecordedExchange = {
  request: CONTACT_CREATED.request,
  response: {
    status: 429,
    headers: {
      "retry-after": "17",
      "x-sib-ratelimit-limit": "10",
      "x-sib-ratelimit-remaining": "0",
      "x-sib-ratelimit-reset": "17",
    },
    body: { code: "too_many_requests", message: "Too many requests" },
  },
};

/** Any path: the provider unavailable (16 §M5, transient class). */
export const UNAVAILABLE: RecordedExchange = {
  request: CONTACT_CREATED.request,
  response: {
    status: 503,
    body: { code: "internal_error", message: "Service unavailable" },
  },
};

/** Any path: a parameter refused (16 §M5, permanent class). */
export const INVALID_PARAMETER: RecordedExchange = {
  request: CONTACT_CREATED.request,
  response: {
    status: 400,
    body: { code: "invalid_parameter", message: "email is not valid" },
  },
};

/** J7 decision 5: the address of a known contact changed by its Brevo id: no body. */
export const CONTACT_EMAIL_CHANGED: RecordedExchange = {
  request: {
    method: "PUT",
    path: "/v3/contacts/21?identifierType=contact_id",
    body: { attributes: { EMAIL: "recorded-new@example.test" } },
  },
  response: { status: 204 },
};

/** J7 decision 5: the new address already held by another contact of the account. */
export const CONTACT_EMAIL_TAKEN: RecordedExchange = {
  request: CONTACT_EMAIL_CHANGED.request,
  response: {
    status: 400,
    body: {
      code: "duplicate_parameter",
      message:
        "Unable to update contact, email is already associated with another contact",
    },
  },
};

/**
 * What Brevo posts to the webhook (16 §I RG105, RG106), one event per request (batches disabled,
 * decision 1 of J7). The address, the instant and the identifiers are set by the double
 * (`webhookEvent`); every other field is Brevo's, kept so that the route proves it drops them.
 */
export type InboundEventKind =
  | "unsubscribed"
  | "spam"
  | "hard_bounce"
  | "transactional_spam"
  | "opened"
  | "unknown";

const MARKETING_EVENT = {
  id: 4417,
  camp_id: 54,
  email: "recorded-contact@example.test",
  "campaign name": "Recorded newsletter",
  date_sent: "2026-10-13 10:00:00",
  date_event: "2026-10-13 10:05:00",
  tag: "",
  ts_sent: 1792231200,
  ts_event: 1792231500,
  ts: 1792231500,
  list_id: [3],
  sending_ip: "185.41.28.109",
};

const TRANSACTIONAL_EVENT = {
  id: 4418,
  email: "recorded-contact@example.test",
  date: "2026-10-13 10:05:00",
  ts: 1792231500,
  "message-id": "<202609191200.00000000001@smtp-relay.mailin.fr>",
  ts_event: 1792231500,
  subject: "Recorded subject",
  tag: "",
  sending_ip: "185.41.28.109",
  ts_epoch: 1792231500000,
  template_id: 3,
};

export const INBOUND_EXEMPLARS: Readonly<
  Record<InboundEventKind, Readonly<Record<string, unknown>>>
> = {
  /** A marketing e-mail's unsubscribe link (05 RG90: Brevo is right). */
  unsubscribed: { ...MARKETING_EVENT, event: "unsubscribed" },
  /** A marketing e-mail marked as spam (05 RG93). */
  spam: { ...MARKETING_EVENT, event: "spam" },
  /** A transactional e-mail refused for good by the receiving server (04 §5.1, D37). */
  hard_bounce: {
    ...TRANSACTIONAL_EVENT,
    event: "hard_bounce",
    reason: "550 5.1.1 user unknown",
  },
  /** A transactional e-mail marked as spam. */
  transactional_spam: { ...TRANSACTIONAL_EVENT, event: "spam" },
  /** An event that informs (RG106): never nominative (RG107). */
  opened: { ...MARKETING_EVENT, event: "opened" },
  /** A name Brevo may add one day: recorded, journaled and ignored (RG105). */
  unknown: { ...TRANSACTIONAL_EVENT, event: "contact_merged" },
};

/**
 * Operation 9 (J7 decision 3): the contacts modified since an instant, one page. developers.brevo
 * .com/reference/get-contacts, read on 2026-10-13: `{contacts, count}`; the double computes both.
 */
export const CONTACTS_LISTED: RecordedExchange = {
  request: {
    method: "GET",
    path: "/v3/contacts?limit=1000&offset=0&modifiedSince=2026-10-11T03%3A00%3A00.000Z&sort=asc",
  },
  response: {
    status: 200,
    body: {
      contacts: [
        {
          email: "recorded-contact@example.test",
          id: 21,
          emailBlacklisted: true,
          smsBlacklisted: false,
          whatsappBlacklisted: false,
          createdAt: "2026-10-01T09:00:00.000+02:00",
          modifiedAt: "2026-10-12T10:05:00.000+02:00",
          attributes: {
            INFLUX_ACCOUNT_ID: "00000000-0000-4000-8000-000000000001",
          },
          listIds: [2],
        },
      ],
      count: 1,
    },
  },
};

/**
 * Operation 10 (J7 decision 3): the transactional complaints of a range of days, one page.
 * developers.brevo.com/reference/get-email-event-report, read on 2026-10-13: `{events}`, `events`
 * absent when there is none; the double computes it.
 */
export const SMTP_EVENTS_LISTED: RecordedExchange = {
  request: {
    method: "GET",
    path: "/v3/smtp/statistics/events?event=spam&startDate=2026-10-11&endDate=2026-10-13&limit=1000&offset=0&sort=asc",
  },
  response: {
    status: 200,
    body: {
      events: [
        {
          email: "recorded-contact@example.test",
          date: "2026-10-12T10:05:00.000+02:00",
          messageId: "<202609191200.00000000001@smtp-relay.mailin.fr>",
          event: "spam",
          subject: "Recorded subject",
          tag: "",
          from: "no-reply@tx.influx.example",
          templateId: 3,
        },
      ],
    },
  },
};

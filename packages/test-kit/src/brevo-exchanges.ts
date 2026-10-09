// The exchanges the Brevo double answers from (docs/mvp/16 RG148): one request and its answer per
// operation of 16 §M1 used by INFLUX, by Brevo API v3. Their shape is that of Brevo's reference as
// read on 2026-09-19 (16 §M1, RG150); the redacted recordings of the manual trial (D62, J6 commit 7)
// replace the bodies below, field for field, without changing the double. Nothing here is a real
// identifier, a real address or a key.
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

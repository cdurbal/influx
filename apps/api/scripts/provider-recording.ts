// The recorder of the manual trial (docs/mvp/16 RG115, RG148; D62; J6 commit 7). Around the real
// fetch, each exchange with Brevo or Apollo is kept as the double's fixtures describe it
// (packages/test-kit/src/*-exchanges.ts): method, path, bodies, status and the rate headers. A
// request header is NEVER kept (the keys travel there). The raw recording holds the test
// account's addresses and identifiers: it stays in the ignored folder of the workstation, and only
// its redacted form is read to write the fixtures. J7 commit 10: the redaction is closed by
// default, and refuses to write anything that still looks like an address, a URL, an IP address
// or a raw string (expert-cybersecurite, blocking).
import { readFileSync, writeFileSync } from "node:fs";
import { CONSENT_SOURCES } from "@influx/contracts/account";
import { WITHDRAWING_EVENTS } from "@influx/contracts/brevo-webhook";
import { DECLARED_STATUSES } from "@influx/contracts/signup";
import type { InboundRecord } from "./inbound-recording.ts";

export type ProviderRecord = {
  provider: "brevo" | "apollo";
  method: string;
  path: string;
  requestBody: unknown;
  status: number;
  headers: Record<string, string>;
  responseBody: unknown;
};

const PROVIDER_HOSTS: Record<string, ProviderRecord["provider"]> = {
  "api.brevo.com": "brevo",
  "api.apollo.io": "apollo",
};

/** The answer headers a fixture may need: the type and the rate or quota ones. */
const KEPT_HEADER =
  /^(content-type|retry-after|x-sib-ratelimit-.+|x-(rate-?limit|minute|hourly|24-hour)-.+)$/;

function jsonOf(text: string | null | undefined): unknown {
  if (text === null || text === undefined || text.length === 0) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return "<not json>";
  }
}

/** The fetch of the trial: `inner` answers, Brevo and Apollo exchanges go to `sink`. */
export function recordingFetch(
  inner: typeof fetch,
  sink: (record: ProviderRecord) => void,
): typeof fetch {
  return async (input, init) => {
    const response = await inner(input, init);
    const url = new URL(input instanceof Request ? input.url : String(input));
    const provider = PROVIDER_HOSTS[url.hostname];
    if (provider === undefined) {
      return response;
    }
    const headers: Record<string, string> = {};
    response.headers.forEach((value, name) => {
      if (KEPT_HEADER.test(name)) {
        headers[name] = value;
      }
    });
    sink({
      provider,
      method: init?.method ?? "GET",
      path: url.pathname,
      requestBody: jsonOf(typeof init?.body === "string" ? init.body : null),
      status: response.status,
      headers,
      responseBody: jsonOf(await response.clone().text()),
    });
    return response;
  };
}

/** A line of raw.jsonl: an exchange with a provider, or a body Brevo posted (`inbound` mode). */
export type TrialRecord = ProviderRecord | InboundRecord;

/** The redaction is closed by default (J7 commit 10, expert-cybersecurite): what each kind keeps. */
type RecordKind = "inbound" | "contacts" | "smtpEvents" | "exchange";
/** `enum`: kept if one of ALLOWED_VALUES; `date`: a date of the same shape; `country`: ISO 3166. */
type Kept = "enum" | "date" | "country";

const BREVO_DATES = {
  date: "date",
  date_sent: "date",
  date_event: "date",
} as const;
/** The attributes INFLUX writes to a Brevo contact (connectors/brevo/mapping.ts) that name no one. */
const CONTACT_ATTRIBUTES = {
  PROFILE_TYPE: "enum",
  DECLARED_STATUS: "enum",
  LANGUAGE: "enum",
  COUNTRY: "country",
  SIGNED_UP_AT: "date",
  SIGNUP_SOURCE: "enum",
  FUNNEL_STAGE: "enum",
  VERIFIED_LEVEL: "enum",
  CONSENT_AT: "date",
  CONSENT_SOURCE: "enum",
  LAST_MARKETING_SENT_AT: "date",
} as const;

/** Per kind, the keys whose string may survive; every other string leaf becomes a placeholder. */
const KEPT_KEYS: Record<RecordKind, Readonly<Record<string, Kept>>> = {
  // The webhook bodies (16 §M6): the event name and its dates; never subject, link, IP, reason.
  inbound: { event: "enum", ...BREVO_DATES },
  // Operation 9: the contact's dates and INFLUX's attributes.
  contacts: { createdAt: "date", modifiedAt: "date", ...CONTACT_ATTRIBUTES },
  // Operation 10: the event name and its date; never subject, tag nor sender.
  smtpEvents: { event: "enum", date: "date" },
  // The exchanges of `worker` and `probes`: the provider's code, INFLUX's attributes and labels.
  exchange: {
    code: "enum",
    label_names: "enum",
    email_status: "enum",
    ...CONTACT_ATTRIBUTES,
  },
};

/** The only values of 6 characters or more a redacted record may share with the raw one. */
export const ALLOWED_VALUES: ReadonlySet<string> = new Set<string>([
  "fr",
  "en",
  "creator",
  "advertiser",
  "direct",
  "registered",
  "none",
  ...DECLARED_STATUSES,
  ...CONSENT_SOURCES,
  // Event names: the webhook bodies (16 RG105, RG106) and the event report (operation 10).
  ...WITHDRAWING_EVENTS,
  "soft_bounce",
  "deferred",
  "delivered",
  "request",
  "opened",
  "unique_opened",
  "click",
  "proxy_open",
  "error",
  "hardBounces",
  "softBounces",
  "requests",
  "clicks",
  "invalid",
  "loadedByProxy",
  // Brevo's error codes (developers.brevo.com, "Error codes").
  "invalid_parameter",
  "missing_parameter",
  "out_of_range",
  "document_not_found",
  "duplicate_parameter",
  "duplicate_request",
  "not_enough_credits",
  "permission_denied",
  "unauthorized",
  "method_not_allowed",
  "not_acceptable",
  "account_under_validation",
  "unprocessable_entity",
  "bad_request",
  // Apollo: INFLUX's labels (connectors/apollo/mapping.ts) and the e-mail statuses.
  "influx",
  "influx_profile_creator",
  "influx_profile_advertiser",
  "verified",
  "unverified",
  "likely_to_engage",
  "unavailable",
]);

/** The words of the providers' routes (the Brevo and Apollo clients, brevo-reads.ts). */
const PATH_WORDS: ReadonlySet<string> = new Set([
  "v1",
  "v3",
  "api",
  "contacts",
  "lists",
  "add",
  "remove",
  "smtp",
  "email",
  "statistics",
  "events",
]);

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_ID = /^[0-9a-f]{24}$/i;
const MESSAGE_ID = /^<[^\s<>@]+@[^\s<>@]+>$/;
const DATE =
  /^\d{4}-\d{2}-\d{2}(?:([T ])\d{2}:\d{2}(?::(\d{2})(\.\d+)?)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const COUNTRY = /^[A-Z]{2}$/;
const REDACTED = "redacted";

/** The same instant for every date, in the recorded shape (separator, seconds, fraction, zone). */
function datePlaceholder(value: string): string | null {
  const parts = DATE.exec(value);
  if (parts === null) {
    return null;
  }
  const [, separator, seconds, fraction, zone] = parts;
  let placeholder = "2000-01-01";
  if (separator !== undefined) {
    placeholder += `${separator}00:00`;
    if (seconds !== undefined) {
      placeholder += ":00";
    }
    if (fraction !== undefined) {
      placeholder += `.${"0".repeat(fraction.length - 1)}`;
    }
  }
  if (zone !== undefined) {
    placeholder += zone === "Z" ? "Z" : zone.includes(":") ? "+00:00" : "+0000";
  }
  return placeholder;
}

function mediaTypeOf(contentType: string): string {
  return (contentType.split(";", 1)[0] ?? "").trim().toLowerCase();
}

function kindOf(record: TrialRecord): RecordKind {
  if ("kind" in record) {
    return "inbound";
  }
  if (record.method === "GET" && record.path.endsWith("/v3/contacts")) {
    return "contacts";
  }
  if (
    record.method === "GET" &&
    record.path.endsWith("/v3/smtp/statistics/events")
  ) {
    return "smtpEvents";
  }
  return "exchange";
}

/**
 * The records with every address, identifier and text replaced, closed by default: a string
 * survives only as an allowed value under an allowed key of its kind, or as a date of the same
 * shape. The same real address or identifier always gets the same placeholder, so that a fixture
 * keeps its links (the id created, then updated; the message sent, then reported). Field names,
 * numbers, booleans and empty strings stay.
 */
export function redactRecords(records: readonly TrialRecord[]): TrialRecord[] {
  const placeholders = new Map<string, string>();
  const counters = { email: 0, uuid: 0, hex: 0, message: 0 };
  const placeholder = (
    real: string,
    kind: keyof typeof counters,
    make: (n: number) => string,
  ): string => {
    const key = `${kind}:${real.toLowerCase()}`;
    let value = placeholders.get(key);
    if (value === undefined) {
      counters[kind] += 1;
      value = make(counters[kind]);
      placeholders.set(key, value);
    }
    return value;
  };

  /** An address or an identifier, whatever its key; null for anything else. */
  const identifier = (text: string): string | null => {
    if (MESSAGE_ID.test(text)) {
      return placeholder(
        text,
        "message",
        (n) => `<000000000000.${String(n).padStart(11, "0")}@example.test>`,
      );
    }
    if (EMAIL.test(text)) {
      return placeholder(
        text,
        "email",
        (n) => `recorded-contact-${n}@example.test`,
      );
    }
    if (UUID.test(text)) {
      return placeholder(
        text,
        "uuid",
        (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      );
    }
    if (HEX_ID.test(text)) {
      return placeholder(
        text,
        "hex",
        (n) => `65f0c0ffee0000000000a${n.toString(16).padStart(3, "0")}`,
      );
    }
    return null;
  };

  const redactString = (text: string, kept: Kept | undefined): string => {
    if (text === "") {
      return text;
    }
    const replaced = identifier(text);
    if (replaced !== null) {
      return replaced;
    }
    if (kept === "enum" && ALLOWED_VALUES.has(text)) {
      return text;
    }
    if (kept === "country" && COUNTRY.test(text)) {
      return text;
    }
    if (kept === "date") {
      return datePlaceholder(text) ?? REDACTED;
    }
    return REDACTED;
  };

  const redactValue = (
    value: unknown,
    key: string | null,
    kind: RecordKind,
  ): unknown => {
    if (typeof value === "string") {
      return redactString(
        value,
        key === null ? undefined : KEPT_KEYS[kind][key],
      );
    }
    if (Array.isArray(value)) {
      return value.map((item) => redactValue(item, key, kind));
    }
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([name, item]) => [
          name,
          redactValue(item, name, kind),
        ]),
      );
    }
    // Numbers, booleans, null: kept as they are.
    return value;
  };

  const redactPath = (path: string): string =>
    path
      .split("/")
      .map((segment) => {
        const text = decodeURIComponent(segment);
        if (text === "" || PATH_WORDS.has(text) || /^\d+$/.test(text)) {
          return segment;
        }
        return encodeURIComponent(identifier(text) ?? REDACTED);
      })
      .join("/");

  return records.map((record): TrialRecord => {
    const kind = kindOf(record);
    if ("kind" in record) {
      return {
        kind: "inbound",
        receivedAt: datePlaceholder(record.receivedAt) ?? REDACTED,
        // The media type only: a parameter is the sender's text.
        contentType: mediaTypeOf(record.contentType),
        body: redactValue(record.body, null, kind),
      };
    }
    return {
      provider: record.provider,
      method: record.method,
      path: redactPath(record.path),
      requestBody: redactValue(record.requestBody, null, kind),
      status: record.status,
      headers: record.headers,
      responseBody: redactValue(record.responseBody, null, kind),
    };
  });
}

/** Every string of a value, the keys of its objects included. */
function stringsOf(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") {
    into.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) {
      stringsOf(item, into);
    }
  } else if (typeof value === "object" && value !== null) {
    for (const [name, item] of Object.entries(value)) {
      into.push(name);
      stringsOf(item, into);
    }
  }
  return into;
}

const FOREIGN_ADDRESS = /@(?!example\.test(?![A-Za-z0-9.-]))/i;
const URL_SCHEME = /https?:\/\//i;
const IPV4 = /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/;
/** Eight groups, or a `::` compression (a time like 10:05:00 is neither). */
const IPV6 =
  /(?<![0-9a-f:])(?:[0-9a-f]{1,4}:){7}[0-9a-f]{1,4}(?![0-9a-f:])|::/i;
/** A raw string this long or longer must never reappear (J7 commit 10, expert-cybersecurite). */
const RAW_STRING_MIN_LENGTH = 6;

/** The raw values that may carry someone: the bodies and the route's segments, not the enums. */
function rawValuesOf(record: TrialRecord): string[] {
  const values =
    "kind" in record
      ? [record.receivedAt, ...stringsOf(record.body)]
      : [
          ...record.path
            .split("/")
            .map((segment) => decodeURIComponent(segment)),
          ...stringsOf(record.requestBody),
          ...stringsOf(record.responseBody),
        ];
  return values.filter(
    (text) =>
      text.length >= RAW_STRING_MIN_LENGTH &&
      !ALLOWED_VALUES.has(text) &&
      !PATH_WORDS.has(text),
  );
}

/**
 * Why the redacted records must not be written, one closed reason per finding and never the value
 * found: an address outside example.test, a URL, an IP address, or a raw string of 6 characters
 * or more that is not an allowed value. Empty: nothing found.
 */
export function findLeaks(
  raw: readonly TrialRecord[],
  redacted: readonly TrialRecord[],
): string[] {
  const rawValues = new Set(raw.flatMap(rawValuesOf));
  // Field names are kept by design: a raw key is never a raw value to look for.
  for (const record of raw) {
    const keys =
      "kind" in record
        ? keysOf(record.body)
        : [...keysOf(record.requestBody), ...keysOf(record.responseBody)];
    for (const key of keys) {
      rawValues.delete(key);
    }
  }
  const leaks: string[] = [];
  redacted.forEach((record, index) => {
    const found = new Set<string>();
    for (const text of stringsOf(record)) {
      if (FOREIGN_ADDRESS.test(text)) {
        found.add("an address outside example.test");
      }
      if (URL_SCHEME.test(text)) {
        found.add("a URL");
      }
      if (IPV4.test(text)) {
        found.add("an IPv4 address");
      }
      if (IPV6.test(text)) {
        found.add("an IPv6 address");
      }
      for (const real of rawValues) {
        if (text.includes(real) || text.includes(encodeURIComponent(real))) {
          found.add("a raw string that is not an allowed value");
        }
      }
    }
    for (const reason of found) {
      leaks.push(`record ${index}: ${reason}`);
    }
  });
  return leaks;
}

/** The keys of every object of a value. */
function keysOf(value: unknown, into: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      keysOf(item, into);
    }
  } else if (typeof value === "object" && value !== null) {
    for (const [name, item] of Object.entries(value)) {
      into.push(name);
      keysOf(item, into);
    }
  }
  return into;
}

/**
 * The `redact` mode: raw.jsonl read, redacted, checked, and only then written. A single finding
 * refuses the whole file: nothing is written.
 */
export function redactFile(
  rawPath: string,
  redactedPath: string,
  redact: (records: readonly TrialRecord[]) => TrialRecord[] = redactRecords,
): number {
  const records = readFileSync(rawPath, "utf8")
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as TrialRecord);
  const redacted = redact(records);
  const leaks = findLeaks(records, redacted);
  if (leaks.length > 0) {
    throw new Error(
      `redacted.json NOT written, the redaction let through: ${leaks.join("; ")}`,
    );
  }
  writeFileSync(redactedPath, `${JSON.stringify(redacted, null, 2)}\n`);
  return records.length;
}

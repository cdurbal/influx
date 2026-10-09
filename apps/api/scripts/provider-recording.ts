// The recorder of the manual trial (docs/mvp/16 RG115, RG148; D62; J6 commit 7). Around the real
// fetch, each exchange with Brevo or Apollo is kept as the double's fixtures describe it
// (packages/test-kit/src/*-exchanges.ts): method, path, bodies, status and the rate headers. A
// request header is NEVER kept (the keys travel there). The raw recording holds the test
// account's addresses and identifiers: it stays in the ignored folder of the workstation, and only
// its redacted form is read to write the fixtures.

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

const EMAIL =
  /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const HEX_ID = /\b[0-9a-f]{24}\b/g;
const MESSAGE_ID = /^<\d+\.\d+@([A-Za-z0-9.-]+)>$/;
/** A provider's own text, kept once its addresses and identifiers are replaced. */
const PROVIDER_TEXT_KEYS = new Set(["code", "message", "error"]);
/** A value that says a kind, not a person: a language, a status, a label, a template code. */
const TOKEN = /^[a-z0-9_.:-]{1,40}$/;
const REDACTED = "redacted";

/**
 * The records with every address, account id, provider id and free text replaced: the same real
 * value always gets the same placeholder, so that a fixture keeps its links (the id created, then
 * updated). Names of fields, provider codes, short tokens, empty strings and numbers stay.
 */
export function redactRecords(
  records: readonly ProviderRecord[],
): ProviderRecord[] {
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
  const domains = new Set<string>();

  const scrub = (text: string): string => {
    const messageId = MESSAGE_ID.exec(text);
    if (messageId !== null) {
      return placeholder(
        text,
        "message",
        (n) =>
          `<000000000000.${String(n).padStart(11, "0")}@${messageId[1] ?? ""}>`,
      );
    }
    let scrubbed = text
      .replace(EMAIL, (email, domain: string) => {
        domains.add(domain.toLowerCase());
        return placeholder(
          email,
          "email",
          (n) => `recorded-contact-${n}@example.test`,
        );
      })
      .replace(UUID, (uuid) =>
        placeholder(
          uuid,
          "uuid",
          (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
        ),
      )
      .replace(HEX_ID, (id) =>
        placeholder(
          id,
          "hex",
          (n) => `65f0c0ffee0000000000a${n.toString(16).padStart(3, "0")}`,
        ),
      );
    for (const domain of domains) {
      scrubbed = scrubbed.split(domain).join("example.test");
    }
    return scrubbed;
  };

  const isPlaceholder = (text: string): boolean =>
    [...placeholders.values()].includes(text);

  const redactValue = (value: unknown, key: string | null): unknown => {
    if (typeof value === "string") {
      const scrubbed = scrub(value);
      if (
        scrubbed === "" ||
        (key !== null && PROVIDER_TEXT_KEYS.has(key)) ||
        isPlaceholder(scrubbed) ||
        (scrubbed === value && TOKEN.test(value))
      ) {
        return scrubbed;
      }
      return REDACTED;
    }
    if (Array.isArray(value)) {
      return value.map((item) => redactValue(item, key));
    }
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value).map(([name, item]) => [
          name,
          redactValue(item, name),
        ]),
      );
    }
    return value;
  };

  const redactPath = (path: string): string =>
    path
      .split("/")
      .map((segment) => encodeURIComponent(scrub(decodeURIComponent(segment))))
      .join("/");

  return records.map((record) => ({
    provider: record.provider,
    method: record.method,
    path: redactPath(record.path),
    requestBody: redactValue(record.requestBody, null),
    status: record.status,
    headers: record.headers,
    responseBody: redactValue(record.responseBody, null),
  }));
}

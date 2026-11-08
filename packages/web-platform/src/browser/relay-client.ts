// The ONLY browser module of the fronts allowed to call the network (docs/mvp/02 §9.3, §13.2;
// 21 §4, J3 commit 12). It reaches the relay of the same origin, `/api/v1/…`, and nothing else:
// - the path is a constant of the caller, checked against the pattern of the relay (03 PP-2);
// - query parameters (J5, 21 EC-62) are names and values of plain characters only: nothing is
//   ever percent-encoded, so the relay and apps/api read them in one way only;
// - same origin only: relative URL, `credentials: "same-origin"`, no redirect followed, no cache;
// - the answer is read through a schema of packages/contracts: an unexpected shape is a failure.
// The session is an httpOnly cookie: this module never sees it (D37). Lives once, in
// packages/web-platform (PL-09), SHA-256 pinned in @influx/test-kit, like the relay files.

/** Mount point of the relay route, /api/v1/… (src/server/relay.ts). */
const RELAY_PREFIX = "/api";

/** 03 PP-2, as the relay applies it. */
const API_PATH_PATTERN = /^\/v1\/[A-Za-z0-9/_-]{0,200}$/;

/** One name or one value of a query parameter: never needs percent-encoding. */
const QUERY_PART_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** "" or "?name=value&…", every part checked against QUERY_PART_PATTERN. */
function searchOf(query: Readonly<Record<string, string>> | undefined): string {
  if (query === undefined) {
    return "";
  }
  const parts = Object.entries(query).map(([name, value]) => {
    if (!QUERY_PART_PATTERN.test(name) || !QUERY_PART_PATTERN.test(value)) {
      throw new Error("relay query outside the plain characters");
    }
    return `${name}=${value}`;
  });
  return parts.length === 0 ? "" : `?${parts.join("&")}`;
}

/** A schema of packages/contracts, reduced to what is used here. */
export type ResponseSchema<Value> = {
  safeParse(
    value: unknown,
  ): { success: true; data: Value } | { success: false };
};

/**
 * `ok`: a 200 answer of the expected shape. `unauthenticated`: no valid session (401).
 * `failed`: anything else — network, time-out, error envelope, unexpected shape. The screen
 * shows its service message; nothing is retried here. When the answer was an error envelope
 * (02 §9.2), `code` is its code and `issues` the rules its details name (never a value): the
 * screen picks its message from them, as a translation key, never by showing them. A refusal that
 * says how long to wait (a request asked again too soon, L2E 18) carries it in `retryAfterSeconds`.
 */
export type RelayResult<Value> =
  | { kind: "ok"; data: Value }
  | { kind: "unauthenticated" }
  | {
      kind: "failed";
      code?: string;
      issues?: readonly string[];
      /** The delay the API asked to wait (`Retry-After`, whole seconds), when it named one. */
      retryAfterSeconds?: number;
    };

/** The methods of the relay (03 PP-3); GET and DELETE carry no body. */
export type RelayMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** A code or an issue of the error envelope: snake_case words only, else ignored. */
const ERROR_WORD_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

/** `Retry-After` as apps/api writes it: whole seconds, never a date; anything else is no delay. */
const RETRY_AFTER_PATTERN = /^\d{1,9}$/;

function retryAfterOf(response: Response): { retryAfterSeconds?: number } {
  const header = response.headers.get("retry-after")?.trim();
  if (header === undefined || !RETRY_AFTER_PATTERN.test(header)) {
    return {};
  }
  return { retryAfterSeconds: Number(header) };
}

/** The code and the issues of an error envelope; nothing when the body is not one. */
function errorOf(payload: unknown): { code?: string; issues?: string[] } {
  if (typeof payload !== "object" || payload === null) {
    return {};
  }
  const error: unknown = (payload as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) {
    return {};
  }
  const { code, details } = error as { code?: unknown; details?: unknown };
  if (typeof code !== "string" || !ERROR_WORD_PATTERN.test(code)) {
    return {};
  }
  const issues = Array.isArray(details)
    ? details.flatMap((detail: unknown) => {
        const issue: unknown =
          typeof detail === "object" && detail !== null
            ? (detail as { issue?: unknown }).issue
            : undefined;
        return typeof issue === "string" && ERROR_WORD_PATTERN.test(issue)
          ? [issue]
          : [];
      })
    : [];
  return { code, issues };
}

/**
 * The body of a call: a JSON object (sent as `application/json`) or a `Blob`, the raw bytes of a
 * file (the logo, D80), sent as is as `application/octet-stream`: neither the declared type nor
 * the name of the file ever leaves the browser.
 */
export type RelayBody = Record<string, unknown> | Blob;

/** Bound of one call, as the relay bounds its own (03 PP-9). */
const CALL_TIMEOUT_MS = 15_000;

export async function callRelay<Value>(
  method: RelayMethod,
  path: string,
  schema: ResponseSchema<Value>,
  body?: RelayBody,
  query?: Readonly<Record<string, string>>,
): Promise<RelayResult<Value>> {
  if (!API_PATH_PATTERN.test(path)) {
    throw new Error("relay path outside /v1/");
  }
  if (body !== undefined && (method === "GET" || method === "DELETE")) {
    throw new Error("relay body on a method without one");
  }
  const search = searchOf(query);
  const raw = body instanceof Blob;
  let response: Response;
  try {
    response = await fetch(`${RELAY_PREFIX}${path}${search}`, {
      method,
      headers:
        body === undefined
          ? undefined
          : {
              "content-type": raw
                ? "application/octet-stream"
                : "application/json",
            },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
    });
  } catch {
    // Network failure or time-out: the screen says the service is unavailable.
    return { kind: "failed" };
  }
  if (response.status === 401) {
    return { kind: "unauthenticated" };
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { kind: "failed" };
  }
  if (response.status !== 200) {
    return { kind: "failed", ...errorOf(payload), ...retryAfterOf(response) };
  }
  const parsed = schema.safeParse(payload);
  return parsed.success
    ? { kind: "ok", data: parsed.data }
    : { kind: "failed" };
}

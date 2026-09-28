// The relay: the only path from a browser to apps/api (docs/mvp/02-architecture-3-espaces.md
// §9.3, docs/mvp/03-matrice-des-droits-et-rls.md §6.4 PP-1 to PP-12, docs/mvp/21 §4 J1-G).
// NO LOGIC: it checks the shape of the request, forwards it, and relays the answer. It never
// reads or interprets a body, never makes or changes a cookie, holds no business rule.
// Imported by src/app/api/[...path]/route.ts only. Byte-for-byte identical in apps/web and
// apps/backoffice, SHA-256 pinned in @influx/test-kit (PP-12): any change is a conscious gesture.
import type { ErrorEnvelope } from "@influx/contracts/errors";
import { callApi, ServerConfigError } from "./api-client";

/** Mount point of the route file: /api/v1/… reaches apps/api as /v1/…. */
export const RELAY_PREFIX = "/api";

/** 03 PP-3. */
export const ALLOWED_METHODS: readonly string[] = [
  "GET",
  "POST",
  "PATCH",
  "PUT",
  "DELETE",
];

/**
 * Methods whose request content has no meaning here (RFC 9110 §9.3.1 and §9.3.5): their body is
 * neither read nor forwarded, so that a GET sent with a body is not a relay failure (21 J1-J R2).
 */
export const BODYLESS_METHODS: readonly string[] = ["GET", "DELETE"];

/**
 * 03 PP-2, applied to the RAW path, never decoded (21 J1-J R1). Excludes ".", "%", "\", ":" and
 * "@" by construction: the allowed characters never need percent-encoding.
 */
export const API_PATH_PATTERN = /^\/v1\/[A-Za-z0-9/_-]{0,200}$/;

/** 03 PP-9. */
export const MAX_BODY_BYTES = 1_048_576;

/**
 * 03 PP-5: the only request headers forwarded. Every other one is dropped, x-* included.
 * `origin` and `sec-fetch-site` cannot be forged by a page's script: apps/api checks the origin
 * of writes with them (03 §6.4 A4).
 */
export const FORWARDED_REQUEST_HEADERS: readonly string[] = [
  "cookie",
  "content-type",
  "accept",
  "accept-language",
  "idempotency-key",
  "origin",
  "sec-fetch-site",
];

/** The only response headers relayed, besides Set-Cookie (PP-10). */
export const RELAYED_RESPONSE_HEADERS: readonly string[] = [
  "content-type",
  "retry-after",
  "location",
];

/** 03 PP-6: the client address header, written by Railway's edge. */
export const CLIENT_ADDRESS_HEADER = "x-real-ip";

/** 03 PP-6: an IPv4 or IPv6 address, and nothing else (no list, no port, no space). */
const CLIENT_ADDRESS_PATTERN = /^[0-9A-Fa-f:.]{2,45}$/;

/** 03 PP-10: a relayed cookie must be a __Host- cookie, or the whole answer is refused. */
const COOKIE_NAME_PREFIX = "__Host-";

/** A client request identifier is kept apart, and only when it is short and plain (PP-7). */
const CLIENT_REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * 03 PP-5 (05 Q14): the browser's user-agent is forwarded under this name, never under its own:
 * the user-agent received by apps/api is that of this server's fetch.
 */
export const CLIENT_USER_AGENT_HEADER = "client-user-agent";

/** 03 PP-5: visible ASCII and space, 512 characters at most; shape only, never truncated. */
const CLIENT_USER_AGENT_PATTERN = /^[\x20-\x7E]{1,512}$/;

const BODYLESS_STATUSES = new Set([204, 205, 304]);

type RefusalCode = "not_found" | "payload_too_large" | "service_unavailable";

const REFUSALS: Readonly<
  Record<RefusalCode, { status: number; message: string }>
> = {
  not_found: { status: 404, message: "Not found" },
  payload_too_large: { status: 413, message: "Payload too large" },
  service_unavailable: { status: 502, message: "Service unavailable" },
};

/** Headers set on EVERY answer of the relay (PP-11; noindex on the backoffice, 03 §7). */
function baseResponseHeaders(): Headers {
  return new Headers({
    "cache-control": "no-store",
    "x-robots-tag": "noindex, nofollow, noarchive",
  });
}

function refuse(code: RefusalCode, requestId: string): Response {
  const envelope: ErrorEnvelope = {
    error: { code, message: REFUSALS[code].message, requestId },
  };
  const headers = baseResponseHeaders();
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(envelope), {
    status: REFUSALS[code].status,
    headers,
  });
}

/**
 * One JSON line on the server output: no URL, no header, no body (02 §20.8). The message of a
 * configuration error is kept: it names variables and rules, never a value (21 J1-J R3).
 */
function logRelayError(requestId: string, error: unknown): void {
  const name = error instanceof Error ? error.name : "UnknownError";
  const message =
    error instanceof ServerConfigError ? error.message : undefined;
  const cause =
    error instanceof Error &&
    typeof error.cause === "object" &&
    error.cause !== null &&
    "code" in error.cause &&
    typeof error.cause.code === "string"
      ? error.cause.code
      : undefined;
  console.error(
    JSON.stringify({
      level: "error",
      msg: "relay: apps/api call failed",
      requestId,
      error: name,
      message,
      cause,
    }),
  );
}

/**
 * 03 PP-2: the API path, checked on its raw form, or null when refused. Any "%" is refused, and
 * nothing is ever decoded: the relay and apps/api can never read one path in two ways (R1).
 */
export function apiPathOf(pathname: string): string | null {
  if (!pathname.startsWith(`${RELAY_PREFIX}/`)) {
    return null;
  }
  const path = pathname.slice(RELAY_PREFIX.length);
  const hasForbiddenSequence =
    path.includes("%") ||
    path.includes("..") ||
    path.includes("//") ||
    path.includes("\\") ||
    path.includes(":") ||
    path.includes("@");
  if (hasForbiddenSequence || !API_PATH_PATTERN.test(path)) {
    return null;
  }
  return path;
}

/**
 * 03 PP-6: the client address has a single source, x-real-ip as written by Railway's edge, kept
 * only when it has the shape of an address. x-forwarded-for is never read.
 */
export function clientAddress(request: Request): string | null {
  const value = request.headers.get(CLIENT_ADDRESS_HEADER);
  return value !== null && CLIENT_ADDRESS_PATTERN.test(value) ? value : null;
}

type BodyResult =
  { kind: "ok"; body: Uint8Array<ArrayBuffer> | null } | { kind: "too_large" };

/** 03 PP-9: the body is counted while it streams in, whatever Content-Length claims. */
async function readBody(request: Request): Promise<BodyResult> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return { kind: "too_large" };
  }
  if (request.body === null) {
    return { kind: "ok", body: null };
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return { kind: "too_large" };
    }
    chunks.push(value);
  }
  if (total === 0) {
    return { kind: "ok", body: null };
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { kind: "ok", body };
}

/** 03 PP-5, PP-6 and PP-7. */
function forwardedHeaders(request: Request, requestId: string): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) {
      headers.set(name, value);
    }
  }
  // PP-6: x-forwarded-for is never forwarded (not in the list above); the address goes under
  // x-real-ip, and only when it has the shape of an address.
  const address = clientAddress(request);
  if (address !== null) {
    headers.set(CLIENT_ADDRESS_HEADER, address);
  }
  // PP-5 (05 Q14): the browser's agent, under client-user-agent, only when it has the admitted
  // shape; a client-user-agent sent by the browser is never forwarded (not in the list above).
  const userAgent = request.headers.get("user-agent");
  if (userAgent !== null && CLIENT_USER_AGENT_PATTERN.test(userAgent)) {
    headers.set(CLIENT_USER_AGENT_HEADER, userAgent);
  }
  // PP-7: our identifier is the audit one; the client's is only kept for reference.
  headers.set("x-request-id", requestId);
  const clientRequestId = request.headers.get("x-request-id");
  if (
    clientRequestId !== null &&
    CLIENT_REQUEST_ID_PATTERN.test(clientRequestId)
  ) {
    headers.set("client-request-id", clientRequestId);
  }
  return headers;
}

/** Relays the answer of apps/api, with the allowed headers only (PP-4, PP-10, PP-11). */
async function relayResponse(
  apiResponse: Response,
  requestId: string,
): Promise<Response> {
  const setCookies = apiResponse.headers.getSetCookie();
  if (setCookies.some((cookie) => !cookie.startsWith(COOKIE_NAME_PREFIX))) {
    await apiResponse.body?.cancel();
    logRelayError(requestId, new Error("Set-Cookie without __Host- prefix"));
    return refuse("service_unavailable", requestId);
  }
  const headers = baseResponseHeaders();
  for (const name of RELAYED_RESPONSE_HEADERS) {
    const value = apiResponse.headers.get(name);
    if (value !== null) {
      headers.set(name, value);
    }
  }
  for (const cookie of setCookies) {
    headers.append("set-cookie", cookie); // Verbatim: never parsed, never rebuilt.
  }
  const body = BODYLESS_STATUSES.has(apiResponse.status)
    ? null
    : apiResponse.body;
  return new Response(body, { status: apiResponse.status, headers });
}

export async function relay(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  if (!ALLOWED_METHODS.includes(request.method)) {
    return refuse("not_found", requestId);
  }
  const url = new URL(request.url);
  const path = apiPathOf(url.pathname);
  if (path === null) {
    return refuse("not_found", requestId);
  }
  const bodyResult: BodyResult = BODYLESS_METHODS.includes(request.method)
    ? { kind: "ok", body: null }
    : await readBody(request);
  if (bodyResult.kind === "too_large") {
    return refuse("payload_too_large", requestId);
  }
  let apiResponse: Response;
  try {
    apiResponse = await callApi({
      method: request.method,
      path,
      search: url.search,
      headers: forwardedHeaders(request, requestId),
      body: bodyResult.body,
    });
  } catch (error) {
    logRelayError(requestId, error);
    return refuse("service_unavailable", requestId);
  }
  return relayResponse(apiResponse, requestId);
}

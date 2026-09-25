// The relay: the only path from a browser to apps/api (docs/mvp/02-architecture-3-espaces.md
// §9.3, docs/mvp/03-matrice-des-droits-et-rls.md §6.4 PP-1 to PP-12, docs/mvp/21 §4 J1-G).
// NO LOGIC: it checks the shape of the request, forwards it, and relays the answer. It never
// reads or interprets a body, never makes or changes a cookie, holds no business rule.
// Imported by src/app/api/[...path]/route.ts only. Byte-for-byte identical in apps/web and
// apps/backoffice, SHA-256 pinned in @influx/test-kit (PP-12): any change is a conscious gesture.
import type { ErrorEnvelope } from "@influx/contracts/errors";
import { callApi } from "./api-client";

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

/** 03 PP-2, applied AFTER decoding. Excludes ".", "%", "\", ":" and "@" by construction. */
export const API_PATH_PATTERN = /^\/v1\/[A-Za-z0-9/_-]{0,200}$/;

/** 03 PP-9. */
export const MAX_BODY_BYTES = 1_048_576;

/** 03 PP-5: the only request headers forwarded. Every other one is dropped, x-* included. */
export const FORWARDED_REQUEST_HEADERS: readonly string[] = [
  "cookie",
  "content-type",
  "accept",
  "accept-language",
  "idempotency-key",
];

/** The only response headers relayed, besides Set-Cookie (PP-10). */
export const RELAYED_RESPONSE_HEADERS: readonly string[] = [
  "content-type",
  "retry-after",
  "location",
];

/** 03 PP-10: a relayed cookie must be a __Host- cookie, or the whole answer is refused. */
const COOKIE_NAME_PREFIX = "__Host-";

/** A client request identifier is kept apart, and only when it is short and plain (PP-7). */
const CLIENT_REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

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

/** One JSON line on the server output: no URL, no header, no body (02 §20.8). */
function logRelayError(requestId: string, error: unknown): void {
  const name = error instanceof Error ? error.name : "UnknownError";
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
      cause,
    }),
  );
}

/** 03 PP-2: the API path, decoded then checked, or null when refused. */
export function apiPathOf(pathname: string): string | null {
  if (!pathname.startsWith(`${RELAY_PREFIX}/`)) {
    return null;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname.slice(RELAY_PREFIX.length));
  } catch {
    return null; // Malformed percent-encoding.
  }
  const hasForbiddenSequence =
    decoded.includes("..") ||
    decoded.includes("//") ||
    decoded.includes("\\") ||
    decoded.includes(":") ||
    decoded.includes("@");
  if (hasForbiddenSequence || !API_PATH_PATTERN.test(decoded)) {
    return null;
  }
  return decoded;
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

/** 03 PP-5 and PP-7. */
function forwardedHeaders(request: Request, requestId: string): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) {
      headers.set(name, value);
    }
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
  // PP-6: x-forwarded-for and x-real-ip are never taken from the client (not in the list
  // above). The client address is not forwarded yet: its source on Railway is EC-21 (J3, J4).
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
  const bodyResult = await readBody(request);
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

// The ONLY module of this front allowed to call the network (docs/mvp/02-architecture-3-espaces.md
// §15 rule 3, docs/mvp/21 §4 J1-C). Imported by src/server/relay.ts only. Byte-for-byte identical
// in apps/web and apps/backoffice, SHA-256 pinned (03 PP-12).
import { readServerConfig } from "../config/server";

export const INTERNAL_SECRET_HEADER = "x-influx-internal";

/** 03 PP-9: the relay never waits for apps/api longer than this. */
export const API_TIMEOUT_MS = 10_000;

export type ApiRequest = {
  method: string;
  /** Validated API path, starting with /v1/. */
  path: string;
  /** Query string, empty or starting with "?". */
  search: string;
  headers: Headers;
  body: Uint8Array<ArrayBuffer> | null;
};

/** The target is outside the configured apps/api origin. Never expected: defence in depth. */
export class ApiTargetError extends Error {
  constructor() {
    super("The relay target left the configured apps/api origin");
    this.name = "ApiTargetError";
  }
}

export async function callApi(apiRequest: ApiRequest): Promise<Response> {
  const config = readServerConfig();
  // 03 PP-1: the target is built on the configured base, never on a request header.
  const target = new URL(
    apiRequest.path + apiRequest.search,
    config.apiBaseUrl,
  );
  if (target.origin !== config.apiBaseUrl.origin) {
    throw new ApiTargetError();
  }
  const headers = new Headers(apiRequest.headers);
  headers.set(INTERNAL_SECRET_HEADER, config.internalSecret); // 03 PP-8
  return fetch(target, {
    method: apiRequest.method,
    headers,
    body: apiRequest.body,
    redirect: "manual", // 03 PP-4: a redirect is relayed, never followed
    cache: "no-store", // 03 PP-11
    signal: AbortSignal.timeout(API_TIMEOUT_MS), // 03 PP-9
  });
}

// Authentication cookies (docs/mvp/21 §4, J3-C rule 8, with the security arbitration of the J3:
// `SameSite=Strict` for the login and sign-up cookies). The ONLY module that reads or writes a
// cookie in apps/api (ESLint).
// - Four names, closed list; each belongs to one surface. apps/api reads the cookies of the
//   surface the internal secret identified (BO-2) and ignores every other name: a GoTrue cookie
//   (`sb-*`) or the other surface's session is never read.
// - Every cookie: `__Host-` prefix, `Secure`, `HttpOnly`, `Path=/`, no `Domain`.
// - The Cookie header is parsed on demand, after the internal secret (the plugin's automatic
//   parsing is off, server.ts): nothing of the request is read before.
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Surface } from "./internal-auth.ts";

export const AUTH_COOKIES = {
  /** Member session identifier: 32 random bytes in base64url, only its hash in the database. */
  webSession: "__Host-influx-session",
  /** Backoffice session identifier, same form. */
  backofficeSession: "__Host-influx-ops-session",
  /** Signed login journey token (auth-tokens.ts), 15 min. */
  login: "__Host-influx-login",
  /** Signed sign-up token (auth-tokens.ts), 30 min. */
  signup: "__Host-influx-signup",
} as const;

export type AuthCookie = keyof typeof AUTH_COOKIES;

type SameSite = "lax" | "strict";

const COOKIE_RULES: Readonly<
  Record<AuthCookie, { surface: Surface; sameSite: SameSite }>
> = {
  webSession: { surface: "web", sameSite: "lax" },
  backofficeSession: { surface: "backoffice", sameSite: "strict" },
  login: { surface: "web", sameSite: "strict" },
  signup: { surface: "web", sameSite: "strict" },
};

/** Cookie values are never longer than this; a longer one is ignored. */
const MAX_COOKIE_VALUE_LENGTH = 4_096;

/** Whether a cookie may be read or written for a request of this surface. */
export function belongsTo(
  cookie: AuthCookie,
  surface: Surface | null,
): boolean {
  return surface !== null && COOKIE_RULES[cookie].surface === surface;
}

/**
 * The value of one of our cookies, for a request of its own surface; null when absent, when the
 * surface is another (or unknown), or when the value is too long. Duplicated names keep the first
 * value (the `__Host-` prefix forbids a cookie set for another path or a parent domain).
 */
export function readAuthCookie(
  request: FastifyRequest,
  cookie: AuthCookie,
): string | null {
  if (!belongsTo(cookie, request.surface)) {
    return null;
  }
  const header = request.headers.cookie;
  if (typeof header !== "string" || header === "") {
    return null;
  }
  const value = request.server.parseCookie(header)[AUTH_COOKIES[cookie]];
  if (
    value === undefined ||
    value === "" ||
    value.length > MAX_COOKIE_VALUE_LENGTH
  ) {
    return null;
  }
  return value;
}

/** Attributes of every cookie of ours (J3-C rule 8). */
function attributesOf(cookie: AuthCookie, maxAgeSeconds: number) {
  return {
    path: "/",
    secure: true,
    httpOnly: true,
    sameSite: COOKIE_RULES[cookie].sameSite,
    maxAge: maxAgeSeconds,
  } as const;
}

/** Sets one of our cookies on a reply to its own surface; refuses any other combination. */
export function setAuthCookie(
  reply: FastifyReply,
  cookie: AuthCookie,
  value: string,
  maxAgeSeconds: number,
): void {
  if (!belongsTo(cookie, reply.request.surface)) {
    throw new Error(
      `cookie ${cookie} does not belong to the surface of the request`,
    );
  }
  if (!Number.isInteger(maxAgeSeconds) || maxAgeSeconds <= 0) {
    throw new Error("a cookie's Max-Age is a positive number of seconds");
  }
  reply.setCookie(
    AUTH_COOKIES[cookie],
    value,
    attributesOf(cookie, maxAgeSeconds),
  );
}

/** Clears one of our cookies (logout, consumed token), with the attributes it was set with. */
export function clearAuthCookie(reply: FastifyReply, cookie: AuthCookie): void {
  if (!belongsTo(cookie, reply.request.surface)) {
    throw new Error(
      `cookie ${cookie} does not belong to the surface of the request`,
    );
  }
  reply.clearCookie(AUTH_COOKIES[cookie], attributesOf(cookie, 0));
}

declare module "fastify" {
  interface FastifyRequest {
    /** Surface identified by the internal secret (server.ts); null before, or when refused. */
    surface: Surface | null;
  }
}

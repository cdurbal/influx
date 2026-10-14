// The member session of a request (docs/mvp/03 §6.1 A-9, §6.2; 05 RG54; 21 §4, J3-C rule 12,
// EC-29). The cookie carries an opaque identifier (32 random bytes, base64url), never a JWT; the
// database holds its SHA-256 only. Every member route runs through withMemberSession():
// - the session is resolved in ONE indexed read (withUserTransaction), which refuses a revoked
//   or expired session and an account that is not active: a suspension takes effect at the
//   next request (RG69, T8.7);
// - only a member role is accepted on the web surface: a backoffice session is never one;
// - the sliding renewal is lazy and computed in the database (identity.touch_session: at most
//   one write per hour); when it wrote, the cookie is set again with the new expiry;
// - the re-acceptance of the terms of service is blocking (05 RG28, CA70; 17 §6.7): while the
//   version in force is not accepted, a route answers 403 terms_acceptance_required, unless it is
//   one of the named exemptions (`terms: "exempt"`): reading and rectifying the account (PATCH
//   /v1/me, GDPR art. 16), accepting, the consent (RG34: at any time), the sessions (RG56: the
//   only way to take one's account back), the browser error reports, and "mes données" with the
//   fresh code it needs (export and deletion: a right of the person, not a use of the service;
//   J7 commit 8, A3, validated by expert-conformite-rgpd on 2026-10-14). Only the terms of service
//   gate (identity.own_terms_to_accept): the privacy policy is read, never accepted. Refusing is
//   signing out (logout).
import type { FastifyReply, FastifyRequest } from "fastify";
import { createHash } from "node:crypto";
import {
  SessionNotFoundError,
  SessionRoleRefusedError,
  withUserTransaction,
  type ApiDatabase,
  type Transaction,
  type UserContext,
} from "../../db/index.ts";
import {
  clearAuthCookie,
  readAuthCookie,
  setAuthCookie,
} from "../../platform/auth-cookies.ts";
import { ApiError } from "../../platform/errors.ts";
import {
  idleExpiryOf,
  ownTermsToAccept,
  touchSession,
  type TermsToAcceptRow,
} from "./repository.ts";

/** 32 random bytes in base64url, without padding: 43 characters. */
const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type MemberContext = UserContext & {
  role: "advertiser" | "creator";
  /** The terms of service in force not accepted yet (05 RG28); null when nothing is pending. */
  termsToAccept: TermsToAcceptRow | null;
};

export type MemberSessionOptions = {
  /** "required" (the default): 403 terms_acceptance_required while termsToAccept is set. */
  terms?: "required" | "exempt";
};

/** The SHA-256 of a cookie value, or null when the value is not a session identifier. */
export function sessionTokenHashOf(value: string | null): Buffer | null {
  if (value === null || !SESSION_TOKEN_PATTERN.test(value)) {
    return null;
  }
  const bytes = Buffer.from(value, "base64url");
  return bytes.length === 32
    ? createHash("sha256").update(bytes).digest()
    : null;
}

function isMember(
  context: UserContext,
): context is UserContext & { role: MemberContext["role"] } {
  return context.role === "advertiser" || context.role === "creator";
}

/** Sets the member session cookie; Max-Age = the sliding expiry (J3-C rule 8). */
export function setMemberSessionCookie(
  reply: FastifyReply,
  token: string,
  maxAgeSeconds: number,
): void {
  setAuthCookie(
    reply,
    "webSession",
    token,
    Math.max(1, Math.floor(maxAgeSeconds)),
  );
}

export async function withMemberSession<T>(
  database: ApiDatabase,
  request: FastifyRequest,
  reply: FastifyReply,
  now: () => Date,
  fn: (tx: Transaction, context: MemberContext) => Promise<T>,
  options: MemberSessionOptions = {},
): Promise<T> {
  const token = readAuthCookie(request, "webSession");
  const tokenHash = sessionTokenHashOf(token);
  if (token === null || tokenHash === null) {
    if (token !== null) {
      clearAuthCookie(reply, "webSession");
    }
    throw new ApiError("unauthenticated");
  }
  let result: { value: T; renewedUntil: Date | null };
  try {
    result = await withUserTransaction(
      database,
      { sessionTokenHash: tokenHash, requestId: request.id },
      async (tx, context) => {
        if (!isMember(context)) {
          // A backoffice session presented on the web surface.
          throw new SessionNotFoundError();
        }
        const termsToAccept = await ownTermsToAccept(tx);
        if (termsToAccept !== null && options.terms !== "exempt") {
          throw new ApiError("terms_acceptance_required");
        }
        const renewed = await touchSession(tx, context.sessionId);
        const renewedUntil = renewed
          ? await idleExpiryOf(tx, context.sessionId)
          : null;
        return {
          value: await fn(tx, { ...context, termsToAccept }),
          renewedUntil,
        };
      },
    );
  } catch (error) {
    if (
      error instanceof SessionNotFoundError ||
      error instanceof SessionRoleRefusedError
    ) {
      clearAuthCookie(reply, "webSession");
      throw new ApiError("unauthenticated");
    }
    throw error;
  }
  if (result.renewedUntil !== null) {
    setMemberSessionCookie(
      reply,
      token,
      (result.renewedUntil.getTime() - now().getTime()) / 1000,
    );
  }
  return result.value;
}

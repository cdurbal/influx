// The backoffice session of a request (docs/mvp/03 §6.1 B-7, §6.2; 18 T8.8; 21 §4, J3-C rules 8
// and 12, EC-40). Same opaque identifier as a member session, cookie `__Host-influx-ops-session`
// (SameSite=Strict, Max-Age = the 8-hour bound, set once).
// - 03 §6.2: apps/api opens NO business transaction for a backoffice session without aal2. Every
//   `/v1/bo/…` route outside BACKOFFICE_SESSIONLESS_ROUTES passes the guard of server.ts first
//   (requireBackofficeSession), then reads its data through withBackofficeSession(); the policies
//   in aal2 are the third barrier.
// - No session: 401 (cookie cleared). A session that resolves, but not as an internal account in
//   aal2: 403 — it can only come from our own mistake, since the database refuses a backoffice
//   session below aal2 (EC-40 point 1).
// - Renewal: lazy, computed in the database (identity.touch_session: at most once a minute,
//   30 minutes of inactivity, never beyond the absolute bound). The cookie is not set again.
// - B-5 (J3S-4): a sensitive action runs through withSensitiveAction(), which hands its database
//   function the session of the request; R is checked there, in the action's transaction.
import type { FastifyReply, FastifyRequest } from "fastify";
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
import { hasFreshReauthentication } from "./backoffice-sign-in.ts";
import { sessionTokenHashOf } from "./member-session.ts";
import { touchSession } from "./repository.ts";
import { BACKOFFICE_SESSION_ABSOLUTE_SECONDS } from "./settings.ts";

export type BackofficeContext = UserContext & {
  role: "agent" | "admin";
  aal: "aal2";
};

/**
 * 03 §6.2, T8.8: the context of a backoffice route is an internal account in aal2. A member
 * session is no session at all here (401); an internal session below aal2 is refused (403).
 */
export function assertBackofficeContext(
  context: UserContext,
): asserts context is BackofficeContext {
  if (context.role !== "agent" && context.role !== "admin") {
    throw new SessionNotFoundError();
  }
  if (context.aal !== "aal2") {
    throw new ApiError("forbidden");
  }
}

/** Sets the backoffice session cookie, once, until the absolute bound (J3-C rule 8). */
export function setBackofficeSessionCookie(
  reply: FastifyReply,
  token: string,
): void {
  setAuthCookie(
    reply,
    "backofficeSession",
    token,
    BACKOFFICE_SESSION_ABSOLUTE_SECONDS,
  );
}

/** The SHA-256 of the backoffice cookie, or null (no cookie, or not a session identifier). */
export function backofficeTokenHashOf(request: FastifyRequest): Buffer | null {
  return sessionTokenHashOf(readAuthCookie(request, "backofficeSession"));
}

export async function withBackofficeSession<T>(
  database: ApiDatabase,
  request: FastifyRequest,
  reply: FastifyReply,
  fn: (tx: Transaction, context: BackofficeContext) => Promise<T>,
): Promise<T> {
  const present = readAuthCookie(request, "backofficeSession") !== null;
  const tokenHash = backofficeTokenHashOf(request);
  if (tokenHash === null) {
    if (present) {
      clearAuthCookie(reply, "backofficeSession");
    }
    throw new ApiError("unauthenticated");
  }
  try {
    return await withUserTransaction(
      database,
      { sessionTokenHash: tokenHash, requestId: request.id },
      async (tx, context) => {
        assertBackofficeContext(context);
        await touchSession(tx, context.sessionId);
        return fn(tx, context);
      },
    );
  } catch (error) {
    if (
      error instanceof SessionNotFoundError ||
      error instanceof SessionRoleRefusedError
    ) {
      clearAuthCookie(reply, "backofficeSession");
      throw new ApiError("unauthenticated");
    }
    throw error;
  }
}

/** The guard of server.ts, and the session R works on: resolves, checks, renews, returns. */
export function requireBackofficeSession(
  database: ApiDatabase,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<BackofficeContext> {
  return withBackofficeSession(
    database,
    request,
    reply,
    async (_tx, context) => context,
  );
}

// ---------------------------------------------------------------------------------------------
// B-5: the sensitive actions (03 §6.1 B-5, §1.3 PD3; 21 J3S-4)
// ---------------------------------------------------------------------------------------------

/** A transaction of the backoffice session of the request (withBackofficeSession, or a test's). */
export type BackofficeTransaction = <T>(
  fn: (tx: Transaction, context: BackofficeContext) => Promise<T>,
) => Promise<T>;

/**
 * The deliberate refusal of the database functions of the backoffice (0130 to 0132): 42501 with
 * the message `forbidden`, one answer whatever the cause (no oracle). A missing grant is 42501
 * too, with another message: a fault of ours, left to the 500.
 */
function isDeliberateRefusal(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const { code, message } = current as Error & { code?: unknown };
    if (code === "42501") {
      return message === "forbidden";
    }
    current = current.cause;
  }
  return false;
}

/**
 * J3S-4: runs a B-5 action in the transaction of the session of THIS request. The action's
 * database function checks R itself, in that transaction (identity.assert_fresh_second_factor(),
 * 0130), on `context.sessionId` — never a session id of the body. Its refusal is told apart only
 * after the rollback, for the screen (17b §3.14.d): no fresh R on this session ⇒ 403
 * reauthentication_required, any other refusal ⇒ 403 forbidden. The reading decides nothing: the
 * database has already refused.
 */
export async function runSensitiveAction<T>(
  database: ApiDatabase,
  requestId: string,
  inSession: BackofficeTransaction,
  fn: (tx: Transaction, context: BackofficeContext) => Promise<T>,
): Promise<T> {
  const seen: { sessionId: string | null } = { sessionId: null };
  try {
    return await inSession((tx, context) => {
      seen.sessionId = context.sessionId;
      return fn(tx, context);
    });
  } catch (error) {
    if (seen.sessionId === null || !isDeliberateRefusal(error)) {
      throw error;
    }
    if (
      !(await hasFreshReauthentication(database, requestId, seen.sessionId))
    ) {
      throw new ApiError("reauthentication_required");
    }
    throw new ApiError("forbidden");
  }
}

/** runSensitiveAction() on the backoffice session of a route (cookie, renewal, 401 of the guard). */
export function withSensitiveAction<T>(
  database: ApiDatabase,
  request: FastifyRequest,
  reply: FastifyReply,
  fn: (tx: Transaction, context: BackofficeContext) => Promise<T>,
): Promise<T> {
  return runSensitiveAction(
    database,
    request.id,
    (body) => withBackofficeSession(database, request, reply, body),
    fn,
  );
}

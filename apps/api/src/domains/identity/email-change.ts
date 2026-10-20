// Change of address of a member (docs/mvp/05 RG58; 03 A-11; 16 §H, RG74; 17 §6.1; J7 decision 5).
// Behind a fresh code for `email_change` (RG57, reauthentication.ts), two six-digit codes, one to
// each address, typed in the member space within 24 hours; the sign-in address stays the old one
// until both are (CA34). The steps, never a transaction open across a call (G4):
//
//   start     (E-1) the code of the new address counted on RG44, the IP then the address, like a
//             sign-in code to it (A2): over a ceiling, 429 rate_limited, the marker untouched;
//             (member) identity.request_email_change() consumes the marker and records the two
//             HMAC digests (0118); (E-1 identity.member_email_change) the two P1 journal lines
//             (0123); both sends, synchronous, Idempotency-Key = request + side; (E-1) their
//             outcomes. A code that did not leave closes the request (not_sent, 0124): 503
//             email_change_unavailable, never a silent skip (the texts live in the repository,
//             RG67: nothing to configure). The two codes are P1: the emergency switch at
//             all_paused holds them (16 RG121), so the request answers 503 before anything is
//             consumed or written, the fresh code staying usable.
//   confirm   (member) identity.confirm_email_change() for one side (5 attempts per side). Both
//             sides done: GoTrue takes the new address (admin.updateUserById, confirmed), THEN
//             (member) identity.complete_email_change(): the address, the other sessions revoked,
//             email.changed to Brevo and Apollo, the two notices, in one transaction.
//   failures  GoTrue unavailable: 503, the request stays open, the same code may be typed again.
//             GoTrue refusing the address as taken by a user no account references (an orphan,
//             left by a code asked for that address): deleted, then the move tried once more
//             (C5.c, 0144 identity.email_change_holder_is_orphan()).
//             GoTrue refusing the address as taken, or the database refusing it at completion:
//             address_unavailable, one answer for both (whoever holds it), known only once both
//             codes are typed (decision 5 as revised on 2026-10-14, C5.a); the request closes, the
//             account keeps its address. Whenever the database did not complete, GoTrue is set
//             back to the address in force of the account; the hourly pass of E-4 does it again
//             if that failed (0125, C5.b).
//
// Nothing here logs an address, a code or a request id (D60, C-1); a queue payload carries ids only
// (RG74, written by the database).
import type {
  ConfirmEmailChangeResponse,
  EmailChangeRequest,
  EmailChangeResponse,
  EmailChangeSide,
} from "@influx/contracts/account";
import { uiLocaleSchema } from "@influx/contracts/auth";
import { randomInt, randomUUID } from "node:crypto";
import {
  withElevatedTransaction,
  type ApiDatabase,
  type Transaction,
} from "../../db/index.ts";
import type {
  SendOutcome,
  TransactionalSender,
} from "../../platform/brevo-transactional.ts";
import {
  EMAIL_SWITCH_NOT_STORED,
  holdsTransactionalSend,
  type EmailSwitch,
  type SendPriority,
} from "../../platform/email-switch.ts";
import type { ClientAddress } from "../../platform/client-address.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import type {
  GoTrueFailure,
  GoTrueIdentity,
  GoTrueOutcome,
  SupabaseAuth,
} from "../../platform/supabase.ts";
import { renderEmailChangeEmail } from "./email-change-email.ts";
import { FAILURE_OF, reserveCodeRequest } from "./login-code.ts";
import { DEFAULT_EMAIL_TIME_ZONE } from "./login-code-email.ts";
import type { MemberContext } from "./member-session.ts";
import { requireFreshCode } from "./reauthentication.ts";
import {
  closeP0Send,
  closeUnsentEmailChange,
  completeEmailChange,
  confirmEmailChange,
  emailChangeHolderIsOrphan,
  insertEmailChangeCodeSend,
  ownEmailChange,
  ownProfile,
  refuseEmailChangeAddress,
  requestEmailChange,
  sqlStateOf,
  cancelEmailChange,
  type OwnEmailChangeRow,
} from "./repository.ts";
import { CODE_ATTEMPTS } from "./settings.ts";
import { emailChangeCodeDigest } from "./throttle-keys.ts";

/** Version of the two code templates, COPIED on the journal lines (04 R7). */
export const EMAIL_CHANGE_TEMPLATE_VERSION = 1;

/** The class of the two code sends, written on their journal lines and read by the switch. */
export const EMAIL_CHANGE_CODE_PRIORITY: SendPriority = "p1";

const SIDES: readonly EmailChangeSide[] = ["old", "new"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EmailChangeDependencies = {
  database: ApiDatabase;
  /** generateEmailCode and deleteUser: the orphan holding the new address (C5.c) only. */
  supabaseAuth: Pick<
    SupabaseAuth,
    "updateUserEmail" | "generateEmailCode" | "deleteUser"
  >;
  sender: TransactionalSender;
  /** AUTH_THROTTLE_PEPPER: the key of the code digests (label email-change-code:). */
  pepper: string;
  now: () => Date;
  /** 16 RG121; EMAIL_SWITCH_NOT_STORED until Lot 5, or a test's. */
  emailSwitch?: EmailSwitch;
};

/** One transaction of the member session of the request (withMemberSession, terms required). */
export type InMemberTransaction = <T>(
  fn: (tx: Transaction, context: MemberContext) => Promise<T>,
) => Promise<T>;

export type EmailChangeLogger = {
  info(object: object, message: string): void;
  warn(object: object, message: string): void;
  error(object: object, message: string): void;
};

export type EmailChangeCall = {
  /** The request id of the HTTP request (the register's and the logs'). */
  requestId: string;
  inMember: InMemberTransaction;
  /** The client address (03 A5): the IP counter of RG44 for the code of the new address (A2). */
  clientAddress: ClientAddress;
  logger: EmailChangeLogger;
};

/** Six digits, uniformly drawn (05 RG39). */
function drawCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function stateOf(row: OwnEmailChangeRow): EmailChangeRequest {
  return {
    id: row.id,
    newEmail: row.newEmail,
    expiresAt: row.expiresAt,
    oldConfirmed: row.oldConfirmed,
    newConfirmed: row.newConfirmed,
  };
}

/** GET /v1/me/email-change: the open request of the member, or none. */
export async function openEmailChange(
  tx: Transaction,
): Promise<EmailChangeRequest | null> {
  const row = await ownEmailChange(tx);
  return row === null ? null : stateOf(row);
}

/** POST /v1/me/email-change. */
export async function startEmailChange(
  dependencies: EmailChangeDependencies,
  call: EmailChangeCall,
  newEmail: string,
): Promise<EmailChangeResponse> {
  const requestedAt = dependencies.now();
  const changeId = randomUUID();
  const codes: Readonly<Record<EmailChangeSide, string>> = {
    old: drawCode(),
    new: drawCode(),
  };
  const digest = (side: EmailChangeSide) =>
    emailChangeCodeDigest(dependencies.pepper, changeId, side, codes[side]);

  // A2: the code of the new address counts on RG44 like a sign-in code to it (the IP, then the
  // address), whichever account asks; over a ceiling, 429 before the fresh code is consumed.
  const allowed = await withElevatedTransaction(
    dependencies.database,
    "identity.member_email_change",
    call.requestId,
    async (tx) => ({
      value: await reserveCodeRequest(tx, dependencies.pepper, {
        clientAddress: call.clientAddress,
        email: newEmail,
      }),
      auditSubject: null,
    }),
  );
  if (!allowed) {
    throw new ApiError("rate_limited");
  }

  // The request (member): the fresh code is consumed here; the previous open request closes.
  const started = await call.inMember(async (tx, context) => {
    const profile = await ownProfile(tx);
    if (profile === null) {
      throw new ApiError("unauthenticated");
    }
    const switchLevel = await (
      dependencies.emailSwitch ?? EMAIL_SWITCH_NOT_STORED
    ).level();
    if (holdsTransactionalSend(switchLevel, EMAIL_CHANGE_CODE_PRIORITY)) {
      throw new ApiError("email_change_unavailable");
    }
    try {
      await requireFreshCode(() =>
        requestEmailChange(tx, {
          sessionId: context.sessionId,
          requestId: changeId,
          newEmail,
          oldCodeHash: digest("old"),
          newCodeHash: digest("new"),
        }),
      );
    } catch (error) {
      // 22023: the current address itself (checked before the marker, which stays unused)
      if (sqlStateOf(error) === "22023") {
        throw new RequestValidationError([
          { path: "newEmail", issue: "same_as_current" },
        ]);
      }
      throw error;
    }
    const row = await ownEmailChange(tx, changeId);
    if (row === null) {
      throw new Error("the address change request was not recorded");
    }
    return {
      accountId: context.accountId,
      locale: uiLocaleSchema.parse(profile.preferredLanguage),
      oldEmail: profile.email,
      state: stateOf(row),
    };
  });

  // The two P1 journal lines (E-1), the account being the subject of the register line.
  const references = await withElevatedTransaction(
    dependencies.database,
    "identity.member_email_change",
    call.requestId,
    async (tx) => {
      const lines: Record<EmailChangeSide, string> = {
        old: await insertEmailChangeCodeSend(tx, {
          side: "old",
          accountId: started.accountId,
          newEmail,
          locale: started.locale,
          templateVersion: EMAIL_CHANGE_TEMPLATE_VERSION,
          priority: EMAIL_CHANGE_CODE_PRIORITY,
        }),
        new: await insertEmailChangeCodeSend(tx, {
          side: "new",
          accountId: started.accountId,
          newEmail,
          locale: started.locale,
          templateVersion: EMAIL_CHANGE_TEMPLATE_VERSION,
          priority: EMAIL_CHANGE_CODE_PRIORITY,
        }),
      };
      return { value: lines, auditSubject: started.accountId };
    },
  );

  // One attempt per side, together (G2); no transaction open.
  const recipients: Readonly<Record<EmailChangeSide, string>> = {
    old: started.oldEmail,
    new: newEmail,
  };
  const settled = await Promise.allSettled(
    SIDES.map((side) =>
      dependencies.sender.send({
        template: `auth.email_change_confirm_${side}` as const,
        to: recipients[side],
        idempotencyKey: `auth.email_change_confirm_${side}:${changeId}`,
        ...renderEmailChangeEmail({
          side,
          locale: started.locale,
          code: codes[side],
          requestedAt,
          timeZone: DEFAULT_EMAIL_TIME_ZONE,
        }),
      }),
    ),
  );
  const outcomes = settled.map((result): SendOutcome =>
    result.status === "fulfilled" ? result.value : { status: "unavailable" },
  );

  // The outcomes (E-1, no audit line, EC-52 (3)).
  await withElevatedTransaction(
    dependencies.database,
    "identity.member_email_change",
    call.requestId,
    async (tx) => {
      for (const [index, side] of SIDES.entries()) {
        const outcome = outcomes[index] ?? { status: "unavailable" };
        await closeP0Send(
          tx,
          references[side],
          outcome.status === "sent"
            ? { status: "sent", messageId: outcome.messageId }
            : { status: "failed", failureCode: FAILURE_OF[outcome.status] },
        );
      }
      return { value: undefined, auditSubject: null };
    },
  );

  if (outcomes.every((outcome) => outcome.status === "sent")) {
    return { outcome: "pending", request: started.state };
  }
  // A code that did not leave: the request closes (no code may lie in a mailbox for it).
  call.logger.warn(
    {
      old: outcomes[0]?.status ?? "unavailable",
      new: outcomes[1]?.status ?? "unavailable",
    },
    "email change: codes not sent, request closed",
  );
  await call.inMember((tx) => closeUnsentEmailChange(tx, changeId));
  if (outcomes[1]?.status === "undeliverable") {
    throw new RequestValidationError([
      { path: "newEmail", issue: "undeliverable" },
    ]);
  }
  throw new ApiError("email_change_unavailable");
}

/**
 * GoTrue set back to the address the account holds now, unless it is the new one (a completion
 * that won a race). Returns that address, or null when it could not be read. Never throws.
 */
async function alignGoTrue(
  dependencies: EmailChangeDependencies,
  call: EmailChangeCall,
  authUserId: string,
  newEmail: string,
): Promise<string | null> {
  let current: string;
  try {
    const profile = await call.inMember((tx) => ownProfile(tx));
    if (profile === null) {
      return null;
    }
    current = profile.email;
  } catch {
    call.logger.error(
      {},
      "email change: address in force unreadable, GoTrue not set back",
    );
    return null;
  }
  if (current === newEmail) {
    return current;
  }
  const restored = await dependencies.supabaseAuth.updateUserEmail(
    authUserId,
    current,
  );
  if (!restored.ok) {
    call.logger.error(
      {
        reason: restored.reason,
        errorCode: restored.errorCode,
        status: restored.status,
      },
      "email change: GoTrue could not be set back to the address in force",
    );
  }
  return current;
}

/** POST /v1/me/email-change/confirm. */
export async function confirmEmailChangeCode(
  dependencies: EmailChangeDependencies,
  call: EmailChangeCall,
  input: { changeId: string; side: EmailChangeSide; code: string },
): Promise<ConfirmEmailChangeResponse> {
  const { changeId, side } = input;
  const checked = await call.inMember(async (tx) => {
    const result = await confirmEmailChange(
      tx,
      changeId,
      side,
      emailChangeCodeDigest(dependencies.pepper, changeId, side, input.code),
    );
    return { result, row: await ownEmailChange(tx, changeId) };
  });
  const { result, row } = checked;
  switch (result.outcome) {
    case "not_found":
      throw new ApiError("not_found");
    case "expired":
      return { outcome: "expired" };
    case "attempts_exhausted":
      return { outcome: "too_many_attempts" };
    case "invalid_code": {
      const attempts =
        row === null
          ? CODE_ATTEMPTS - 1
          : side === "old"
            ? row.oldAttempts
            : row.newAttempts;
      return {
        outcome: "invalid",
        attemptsLeft: Math.min(4, Math.max(1, CODE_ATTEMPTS - attempts)),
      };
    }
    default:
      break;
  }
  if (row === null) {
    throw new ApiError("not_found");
  }
  if (!result.ready) {
    return { outcome: "confirmed", request: stateOf(row) };
  }
  if (result.authUserId === null) {
    throw new Error("a ready address change without its GoTrue user");
  }
  return finishEmailChange(dependencies, call, {
    changeId,
    authUserId: result.authUserId,
    newEmail: row.newEmail,
  });
}

type ReadyChange = { changeId: string; authUserId: string; newEmail: string };

function isAddressTaken(outcome: GoTrueOutcome<GoTrueIdentity>): boolean {
  return (
    !outcome.ok &&
    outcome.reason === "rejected" &&
    outcome.errorCode === "email_exists"
  );
}

/**
 * C5.c: GoTrue refused the new address as taken. Its holder is looked up (generateLink: nothing is
 * sent, the code it makes is dropped unread); when no account references it (on its id: a code
 * asked for that address, often by the member himself), it is deleted and the move tried once
 * more, as the hourly pass of C5.b does. Returns that second outcome, or null when the holder is
 * not an orphan. GoTrue unavailable on the way: 503, the request stays open (A1: the codes again).
 */
async function releaseOrphanHolder(
  dependencies: EmailChangeDependencies,
  call: EmailChangeCall,
  change: ReadyChange,
): Promise<GoTrueOutcome<GoTrueIdentity> | null> {
  const unavailable = (failure: GoTrueFailure, message: string): never => {
    call.logger.warn(
      {
        reason: failure.reason,
        errorCode: failure.errorCode,
        status: failure.status,
      },
      message,
    );
    throw new ApiError("email_change_unavailable");
  };
  const holder = await dependencies.supabaseAuth.generateEmailCode(
    change.newEmail,
  );
  if (!holder.ok) {
    return holder.reason === "unavailable"
      ? unavailable(holder, "email change: holder of the new address unread")
      : null;
  }
  const holderId = holder.value.userId;
  if (
    holder.value.email !== change.newEmail ||
    holderId === change.authUserId ||
    !UUID.test(holderId) ||
    !(await call.inMember((tx) =>
      emailChangeHolderIsOrphan(tx, change.changeId, holderId),
    ))
  ) {
    return null;
  }
  const deleted = await dependencies.supabaseAuth.deleteUser(holderId);
  if (!deleted.ok && deleted.status !== 404) {
    return deleted.reason === "unavailable"
      ? unavailable(deleted, "email change: orphan holder not deleted")
      : null;
  }
  call.logger.info(
    {},
    "email change: orphan GoTrue holder of the new address deleted",
  );
  return dependencies.supabaseAuth.updateUserEmail(
    change.authUserId,
    change.newEmail,
  );
}

/** Both sides confirmed: GoTrue first, then the database; GoTrue follows the database. */
async function finishEmailChange(
  dependencies: EmailChangeDependencies,
  call: EmailChangeCall,
  change: ReadyChange,
): Promise<ConfirmEmailChangeResponse> {
  let moved = await dependencies.supabaseAuth.updateUserEmail(
    change.authUserId,
    change.newEmail,
  );
  if (isAddressTaken(moved)) {
    moved = (await releaseOrphanHolder(dependencies, call, change)) ?? moved;
  }
  if (!moved.ok) {
    if (isAddressTaken(moved)) {
      // Another GoTrue user holds the address: the request closes (C5.a).
      await call.inMember((tx) =>
        refuseEmailChangeAddress(tx, change.changeId),
      );
      call.logger.info(
        {},
        "email change: new address unavailable, request closed",
      );
      return { outcome: "address_unavailable" };
    }
    call.logger.warn(
      {
        reason: moved.reason,
        errorCode: moved.errorCode,
        status: moved.status,
      },
      "email change: GoTrue did not take the new address",
    );
    if (moved.reason === "unavailable") {
      // An answer lost after GoTrue took it: the address in force is set again.
      await alignGoTrue(dependencies, call, change.authUserId, change.newEmail);
    }
    throw new ApiError("email_change_unavailable");
  }

  let completion: Awaited<ReturnType<typeof completeEmailChange>>;
  try {
    completion = await call.inMember((tx, context) =>
      completeEmailChange(tx, change.changeId, context.sessionId),
    );
  } catch (error) {
    await alignGoTrue(dependencies, call, change.authUserId, change.newEmail);
    throw error;
  }
  if (completion === "completed") {
    return { outcome: "completed" };
  }

  const inForce = await alignGoTrue(
    dependencies,
    call,
    change.authUserId,
    change.newEmail,
  );
  switch (completion) {
    case "address_unavailable":
      // C5.a: the same answer as GoTrue's refusal; the account keeps its address.
      call.logger.info(
        {},
        "email change: new address unavailable, request closed",
      );
      return { outcome: "address_unavailable" };
    case "expired":
      return { outcome: "expired" };
    case "not_found":
      // Completed by a concurrent confirmation: the account already holds the new address.
      if (inForce === change.newEmail) {
        return { outcome: "completed" };
      }
      throw new ApiError("not_found");
    default:
      // not_ready, superseded (the address of the account changed meanwhile)
      throw new ApiError("conflict");
  }
}

/** DELETE /v1/me/email-change/:id: the holder's own open request; 404 otherwise (T14). */
export async function cancelOwnEmailChange(
  tx: Transaction,
  changeId: string,
): Promise<void> {
  if (!(await cancelEmailChange(tx, changeId))) {
    throw new ApiError("not_found");
  }
}

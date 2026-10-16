// The dual control (2V) of the backoffice and its degraded form (docs/mvp/03 §1.3 PD1 to PD7, §3.1;
// 15 RG9, RG31, RG103; 17b §3.13.c, §4.5; 21 §J8 commit 4). The rules are the database's (0130 to
// 0132): who requests, confirms, cancels, the 60 seconds, R, the two instants, the mark, the
// switch. This service chains them for a route, and says what the screen shows:
//   PD1  dualControlRecap(): scope, consequences, reversibility of an action, shown BEFORE the
//        request (the first gesture) and again on the confirmation screen.
//   PD2  `confirmableAt` and `secondsLeft`, by the database clock: the one artificial delay of the
//        backoffice, counted on the screen; the database refuses a confirmation before it.
//   PD3  confirmAndExecute() runs in ONE transaction, which must be runSensitiveAction's (B-5): the
//        confirmation and the action both check R on the session of the request.
//   PD4, PD5  written by the database (two instants, `dual_control` of the register line); the
//        result carries the mode.
//   PD6  degradedConfirmationsByWeek(): the weekly list of the dashboard (AL37).
//   PD7  no flag, no setting, no code path of its own: dualControlView() reads "another admin can
//        confirm" at every call, and the database re-reads it at every confirmation.
// Codes only: the labels of the screen are the backoffice's (17b, D36).
import type { ApolloSetting } from "@influx/contracts/backoffice-actions";
import type { BusinessRole, Transaction } from "../../db/index.ts";
import { ApiError } from "../../platform/errors.ts";
import type { BackofficeContext } from "../identity/backoffice-session.ts";
import { apolloSettingOf, storedApolloSetting } from "./apollo-settings.ts";
import {
  approveAdminInvitation,
  approveDataRequestExecution,
  cancelDualControl as cancelRequest,
  changeApolloSetting,
  changeMemberRole,
  confirmDualControl as confirmRequest,
  degradedConfirmations,
  dualControlRequestOf,
  grantRole,
  isBreakGlassAccount,
  peerAdminExists,
  requestDualControl as insertRequest,
  type DualControlActionCode,
  type DualControlMode,
  type DualControlPayload,
  type DualControlState,
} from "./repository.ts";

export type { DualControlActionCode, DualControlMode } from "./repository.ts";

/** 03 PD2: the requester confirms alone this long after the request at the earliest (0130). */
export const DEGRADED_CONFIRMATION_DELAY_SECONDS = 60;

/** 0130: the written justification of a degraded confirmation, in characters. */
export const DEGRADED_JUSTIFICATION_MIN = 20;
export const DEGRADED_JUSTIFICATION_MAX = 1_000;

/** PD6: how many ISO weeks the weekly list goes back, at most. */
export const DEGRADED_REVIEW_MAX_WEEKS = 53;

/** An action of the closed list, with its object. */
export type DualControlAction =
  | { code: "identity.grant_role"; accountId: string; role: BusinessRole }
  | {
      code: "identity.change_member_role";
      accountId: string;
      role: "advertiser";
      /** EC-J8-23 (0134): the name of the new brand, inside the confirmed payload. */
      legalName: string;
    }
  | { code: "identity.invite_admin"; invitationId: string }
  | { code: "leads.change_apollo_setting"; setting: ApolloSetting }
  | {
      /** J8 commit 8 (15 RG75 step 6): an admin approves; the worker executes (E-5). */
      code: "privacy.approve_data_request";
      requestId: string;
      requestType: "access" | "erasure";
    };

/** PD1: what the action does, said before the first gesture. Codes, for the screen to word. */
export type DualControlRecap = {
  /** How many objects the action touches. */
  scope: {
    kind: "account" | "internal_invitation" | "setting" | "data_request";
    count: number;
  };
  consequences: readonly string[];
  reversible: boolean;
};

/**
 * PD1, by action. `reversible` says whether the backoffice can undo it: a granted role is not
 * withdrawn before Lot 5, a creator never becomes one again (EC-J8-17), an admin invitation can be
 * revoked until it is accepted (0131), an Apollo key is set back by another change (RG81; what left
 * for Apollo meanwhile stays there).
 */
const RECAPS: Readonly<
  Record<
    Exclude<DualControlActionCode, "privacy.approve_data_request">,
    DualControlRecap
  >
> = {
  "identity.grant_role": {
    scope: { kind: "account", count: 1 },
    consequences: ["role_granted"],
    reversible: false,
  },
  "identity.change_member_role": {
    scope: { kind: "account", count: 1 },
    consequences: [
      "role_replaced",
      "advertiser_profile_created",
      "sessions_revoked",
      "declared_status_business",
      "lead_updated",
    ],
    reversible: false,
  },
  "identity.invite_admin": {
    scope: { kind: "internal_invitation", count: 1 },
    consequences: ["admin_invitation_usable"],
    reversible: true,
  },
  "leads.change_apollo_setting": {
    scope: { kind: "setting", count: 1 },
    consequences: ["setting_changed", "skipped_accounts_reevaluated"],
    reversible: true,
  },
};

/**
 * PD1 of a "mes données" request, by type (04 §9.2; 15 RG79, RG80; runbook demandes-rgpd §4, §5):
 * an erasure is never undone (no physical deletion, but the anonymisation is final); an export is
 * a copy the member downloads, erased after 7 days or 3 downloads.
 */
const DATA_REQUEST_RECAPS: Readonly<
  Record<"access" | "erasure", DualControlRecap>
> = {
  access: {
    scope: { kind: "data_request", count: 1 },
    consequences: [
      "export_published",
      "member_notified",
      "request_closed_after_brevo",
    ],
    reversible: false,
  },
  erasure: {
    scope: { kind: "data_request", count: 1 },
    consequences: [
      "account_anonymized",
      "sessions_closed",
      "brevo_contact_deleted",
      "auth_user_deleted",
      "request_closed_after_brevo",
    ],
    reversible: false,
  },
};

export function dualControlRecap(action: DualControlAction): DualControlRecap {
  return action.code === "privacy.approve_data_request"
    ? DATA_REQUEST_RECAPS[action.requestType]
    : RECAPS[action.code];
}

function payloadOf(action: DualControlAction): DualControlPayload {
  switch (action.code) {
    case "identity.invite_admin":
      return { invitation_id: action.invitationId };
    case "identity.change_member_role":
      return {
        account_id: action.accountId,
        role: action.role,
        legal_name: action.legalName,
      };
    case "leads.change_apollo_setting":
      return storedApolloSetting(action.setting);
    case "identity.grant_role":
      return { account_id: action.accountId, role: action.role };
    case "privacy.approve_data_request":
      return { request_id: action.requestId, request_type: action.requestType };
  }
}

/** The action of a stored request; null for a shape this service does not know (never trusted). */
function actionOf(
  code: string,
  payload: Record<string, unknown>,
): DualControlAction | null {
  const {
    account_id: accountId,
    role,
    invitation_id: invitationId,
    legal_name: legalName,
    request_id: requestId,
    request_type: requestType,
  } = payload;
  switch (code) {
    case "identity.grant_role":
      return typeof accountId === "string" &&
        (role === "advertiser" ||
          role === "creator" ||
          role === "agent" ||
          role === "admin")
        ? { code, accountId, role }
        : null;
    case "identity.change_member_role":
      return typeof accountId === "string" &&
        role === "advertiser" &&
        typeof legalName === "string"
        ? { code, accountId, role, legalName }
        : null;
    case "identity.invite_admin":
      return typeof invitationId === "string" ? { code, invitationId } : null;
    case "leads.change_apollo_setting": {
      const setting = apolloSettingOf(payload.key, payload.value);
      return setting === null ? null : { code, setting };
    }
    case "privacy.approve_data_request":
      return typeof requestId === "string" &&
        (requestType === "access" || requestType === "erasure")
        ? { code, requestId, requestType }
        : null;
    default:
      return null;
  }
}

/**
 * The account an action targets, if any: never one's own (C(3), 15 RG36). A "mes données" request
 * is a member's: the database refuses an internal requester and the caller's own account (0136).
 */
function targetAccountOf(action: DualControlAction): string | null {
  return action.code === "identity.invite_admin" ||
    action.code === "leads.change_apollo_setting" ||
    action.code === "privacy.approve_data_request"
    ? null
    : action.accountId;
}

// ---------------------------------------------------------------------------------------------
// Request (PD1, PD4): no R, the database checks the caller, the list and the payload
// ---------------------------------------------------------------------------------------------

export type DualControlRequestInput = {
  action: DualControlAction;
  /** PD4: typed, `^[a-z][a-z0-9_]{1,62}$`; the action function is called with the same one. */
  reasonCode: string;
  /** PD4: optional, never copied to the register. */
  reasonNote: string | null;
};

export function requestDualControl(
  tx: Transaction,
  input: DualControlRequestInput,
): Promise<string> {
  return insertRequest(tx, {
    actionCode: input.action.code,
    payload: payloadOf(input.action),
    reasonCode: input.reasonCode,
    reasonNote: input.reasonNote,
  });
}

// ---------------------------------------------------------------------------------------------
// View (PD1, PD2, PD7): what THIS admin sees and may do now
// ---------------------------------------------------------------------------------------------

/** What the viewer can do now (17b §3.13.c: two screens, chosen by PD7). */
export type DualControlNextStep =
  /** Another admin than the requester: the target form, a fresh second factor. */
  | { kind: "confirm_as_peer" }
  /** The requester while no other admin can confirm: the degraded form, after the countdown. */
  | { kind: "confirm_degraded"; confirmableAt: string; secondsLeft: number }
  /** The requester while another admin can confirm: waits for that admin. */
  | { kind: "await_peer" }
  /** Nothing: closed, expired, consumed, the viewer's own account, or the break-glass account. */
  | { kind: "none" };

export type DualControlView = {
  id: string;
  action: DualControlAction;
  recap: DualControlRecap;
  reasonCode: string;
  reasonNote: string | null;
  requestedBy: string;
  requestedAt: string;
  expiresAt: string;
  /** `expired` as soon as a pending request is past its expiry (no writer before Lot 5, 0130). */
  state: DualControlState;
  /** 15 edge case 4: "already confirmed at ⟨time⟩ by ⟨name⟩". */
  confirmation: {
    mode: DualControlMode;
    by: string;
    at: string;
  } | null;
  executed: boolean;
  next: DualControlNextStep;
};

function secondsBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / 1000;
}

/** Null when the request does not exist (or its shape is unknown: never shown half-read). */
export async function dualControlView(
  tx: Transaction,
  context: BackofficeContext,
  requestId: string,
): Promise<DualControlView | null> {
  const row = await dualControlRequestOf(tx, requestId);
  if (row === null) {
    return null;
  }
  const action = actionOf(row.actionCode, row.payload);
  if (action === null) {
    return null;
  }
  const state: DualControlState =
    row.state === "pending" && Date.parse(row.expiresAt) <= Date.parse(row.now)
      ? "expired"
      : row.state;
  const confirmation =
    row.state === "confirmed" &&
    row.confirmedBy !== null &&
    row.confirmedAt !== null
      ? { mode: "peer" as const, by: row.confirmedBy, at: row.confirmedAt }
      : row.state === "degraded" && row.degradedConfirmedAt !== null
        ? {
            mode: "degraded_single_operator" as const,
            by: row.requestedBy,
            at: row.degradedConfirmedAt,
          }
        : null;

  let next: DualControlNextStep = { kind: "none" };
  if (
    state === "pending" &&
    context.role === "admin" &&
    targetAccountOf(action) !== context.accountId
  ) {
    if (row.requestedBy !== context.accountId) {
      if (!(await isBreakGlassAccount(tx, context.accountId))) {
        next = { kind: "confirm_as_peer" };
      }
    } else if (await peerAdminExists(tx, context.accountId)) {
      next = { kind: "await_peer" };
    } else {
      const confirmableAt = new Date(
        Date.parse(row.requestedAt) +
          DEGRADED_CONFIRMATION_DELAY_SECONDS * 1000,
      ).toISOString();
      next = {
        kind: "confirm_degraded",
        confirmableAt,
        secondsLeft: Math.max(
          0,
          Math.ceil(secondsBetween(row.now, confirmableAt)),
        ),
      };
    }
  }

  return {
    id: row.id,
    action,
    recap: dualControlRecap(action),
    reasonCode: row.reasonCode,
    reasonNote: row.reasonNote,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt,
    expiresAt: row.expiresAt,
    state,
    confirmation,
    executed: row.consumedAt !== null,
    next,
  };
}

// ---------------------------------------------------------------------------------------------
// Confirmation and execution (PD2, PD3, PD5, PD7), in ONE transaction under runSensitiveAction
// ---------------------------------------------------------------------------------------------

/** The stored request, handed to the executor: the same action, payload and reason (0130). */
export type ConfirmedDualControl = {
  id: string;
  action: DualControlAction;
  reasonCode: string;
  mode: DualControlMode;
};

/**
 * Executes the confirmed action: the database function of the action, called with the session of
 * the request and `request.id`; it checks R again and consumes the request once.
 */
export type DualControlExecutor<Result> = (
  tx: Transaction,
  context: BackofficeContext,
  request: ConfirmedDualControl,
) => Promise<Result>;

/**
 * The executor of the closed list: the database function of the request's action, with the
 * session of the request (R in that transaction) and the request id. Every parameter of the action
 * comes from the confirmed payload, the legal name of a role change included (EC-J8-23, 0134).
 * Returns the accounts re-evaluated by an Apollo key (RG81), null for the other actions. The
 * execution of a "mes données" request is only APPROVED here: the worker runs it (E-5, 0136).
 */
export function dualControlExecutor(): DualControlExecutor<number | null> {
  return async (tx, context, request) => {
    const { action } = request;
    switch (action.code) {
      case "identity.grant_role":
        await grantRole(tx, context.sessionId, request.id, {
          accountId: action.accountId,
          role: action.role,
          reasonCode: request.reasonCode,
        });
        return null;
      case "identity.invite_admin":
        await approveAdminInvitation(tx, context.sessionId, request.id, {
          invitationId: action.invitationId,
          reasonCode: request.reasonCode,
        });
        return null;
      case "identity.change_member_role":
        await changeMemberRole(tx, context.sessionId, request.id, {
          accountId: action.accountId,
          reasonCode: request.reasonCode,
          legalName: action.legalName,
        });
        return null;
      case "leads.change_apollo_setting":
        return changeApolloSetting(tx, context.sessionId, request.id, {
          setting: storedApolloSetting(action.setting),
          reasonCode: request.reasonCode,
        });
      case "privacy.approve_data_request":
        await approveDataRequestExecution(tx, context.sessionId, request.id, {
          dataRequestId: action.requestId,
          requestType: action.requestType,
          reasonCode: request.reasonCode,
        });
        return null;
    }
  };
}

/**
 * 17b §3.13.c "Confirmer l'action": the confirmation, then the action, by the confirmer, in the
 * transaction of `runSensitiveAction` (B-5: without a fresh R, 403 reauthentication_required). The
 * database chooses the mode (PD7) and refuses the requester alone while another admin can confirm,
 * before 60 seconds (PD2) or without a justification of 20 to 1000 characters. A request no longer
 * pending is a conflict (15 edge case 4: the screen reads it again).
 */
export async function confirmAndExecute<Result>(
  tx: Transaction,
  context: BackofficeContext,
  input: { requestId: string; degradedJustification: string | null },
  execute: DualControlExecutor<Result>,
): Promise<{ mode: DualControlMode; result: Result }> {
  const view = await dualControlView(tx, context, input.requestId);
  if (view === null) {
    throw new ApiError("not_found");
  }
  if (view.state !== "pending") {
    throw new ApiError("conflict");
  }
  const mode = await confirmRequest(
    tx,
    context.sessionId,
    input.requestId,
    input.degradedJustification,
  );
  const result = await execute(tx, context, {
    id: view.id,
    action: view.action,
    reasonCode: view.reasonCode,
    mode,
  });
  return { mode, result };
}

/** 17b §3.13.c: abandoned by the requester, or refused by another admin; nothing is executed. */
export async function cancelDualControl(
  tx: Transaction,
  context: BackofficeContext,
  requestId: string,
): Promise<void> {
  const view = await dualControlView(tx, context, requestId);
  if (view === null) {
    throw new ApiError("not_found");
  }
  if (view.state !== "pending") {
    throw new ApiError("conflict");
  }
  await cancelRequest(tx, requestId);
}

// ---------------------------------------------------------------------------------------------
// PD6: the weekly review of the confirmations made alone
// ---------------------------------------------------------------------------------------------

export type DegradedWeek = {
  /** ISO week, UTC: `2026-W42`. */
  week: string;
  confirmations: {
    id: string;
    actionCode: string;
    reasonCode: string;
    requestedBy: string;
    requestedAt: string;
    confirmedAt: string;
    executed: boolean;
  }[];
};

/** PD6: week by week, the most recent first; a week without any confirmation is absent. */
export async function degradedConfirmationsByWeek(
  tx: Transaction,
  weeks: number,
): Promise<DegradedWeek[]> {
  if (
    !Number.isInteger(weeks) ||
    weeks < 1 ||
    weeks > DEGRADED_REVIEW_MAX_WEEKS
  ) {
    throw new RangeError(
      `weeks must be an integer from 1 to ${DEGRADED_REVIEW_MAX_WEEKS}`,
    );
  }
  const byWeek = new Map<string, DegradedWeek>();
  for (const row of await degradedConfirmations(tx, weeks)) {
    let entry = byWeek.get(row.week);
    if (entry === undefined) {
      entry = { week: row.week, confirmations: [] };
      byWeek.set(row.week, entry);
    }
    entry.confirmations.push({
      id: row.id,
      actionCode: row.actionCode,
      reasonCode: row.reasonCode,
      requestedBy: row.requestedBy,
      requestedAt: row.requestedAt,
      confirmedAt: row.degradedConfirmedAt,
      executed: row.consumedAt !== null,
    });
  }
  return [...byWeek.values()];
}

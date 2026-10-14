// The rules of the "mon compte" screens that are not apps/api's (docs/mvp/17 §6.1 to §6.4, §6.7):
// what a member typed that changed, which message an answer calls for, how a date or a browser
// is written. Pure functions, unit-tested (tests/account-view.test.ts); the components only
// display what they return. Nothing here carries an amount, a rate or a commission (05 RG9).
import type {
  ConfirmEmailChangeResponse,
  ConsentSource,
  DataRequest,
  EmailChangeRequest,
  MeResponse,
  ReauthRequestCodeResponse,
  ReauthVerifyCodeResponse,
  UpdateMeBody,
} from "@influx/contracts/account";
import type { UiLocale } from "@influx/contracts/auth";
import {
  UNIDENTIFIED_USER_AGENT,
  type UserAgentFamily,
  type UserAgentSummary,
  type UserAgentSystem,
} from "@influx/contracts/user-agent";
import type { RelayResult } from "@/browser/relay-client";

// --- Dates --------------------------------------------------------------------------------------

/**
 * A date as the language writes it (CLAUDE.md §4: formats follow the language), in the zone of
 * the browser, which is the one the member reads in.
 */
export function formatDate(iso: string, locale: UiLocale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
    new Date(iso),
  );
}

/** A date and an hour, for the sessions (RG143: the dates tell two alike browsers apart). */
export function formatDateTime(iso: string, locale: UiLocale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(iso));
}

// --- Mes informations (17 §6.1) -----------------------------------------------------------------

/** What the form of "mes informations" holds; the address is a journey of its own (RG58). */
export type DetailsDraft = {
  countryCode: string;
  preferredLanguage: UiLocale;
  declaredStatus: MeResponse["declaredStatus"];
  companyName: string;
};

export function draftOf(me: MeResponse): DetailsDraft {
  return {
    countryCode: me.countryCode,
    preferredLanguage: me.preferredLanguage,
    declaredStatus: me.declaredStatus,
    companyName: me.companyName ?? "",
  };
}

/**
 * The body of PATCH /v1/me: the changed fields only, those of the member's role only (RG22: the
 * status of an advertiser is not his to change, a creator has no company). Null: nothing changed.
 */
export function changedFieldsOf(
  me: MeResponse,
  draft: DetailsDraft,
): UpdateMeBody | null {
  const body: {
    countryCode?: string;
    preferredLanguage?: UiLocale;
    declaredStatus?: MeResponse["declaredStatus"];
    companyName?: string;
  } = {};
  if (draft.countryCode !== me.countryCode) {
    body.countryCode = draft.countryCode;
  }
  if (draft.preferredLanguage !== me.preferredLanguage) {
    body.preferredLanguage = draft.preferredLanguage;
  }
  if (me.role === "creator" && draft.declaredStatus !== me.declaredStatus) {
    body.declaredStatus = draft.declaredStatus;
  }
  if (
    me.role === "advertiser" &&
    draft.companyName.trim() !== (me.companyName ?? "")
  ) {
    body.companyName = draft.companyName.trim();
  }
  return Object.keys(body).length === 0 ? null : (body as UpdateMeBody);
}

export type DetailsMessage =
  | "saved"
  | "companyRequired"
  | "companyInvalid"
  | "countryUnavailable"
  | "unavailable";

/** A form check before sending: an advertiser keeps a company name. */
export function detailsFormMessage(
  me: MeResponse,
  draft: DetailsDraft,
): DetailsMessage | null {
  return me.role === "advertiser" && draft.companyName.trim() === ""
    ? "companyRequired"
    : null;
}

/** The message of a refused PATCH /v1/me, from the issues of its 400 (never their values). */
export function detailsRefusalOf(result: RelayResult<unknown>): DetailsMessage {
  if (result.kind !== "failed" || result.code !== "validation_failed") {
    return "unavailable";
  }
  const issues = result.issues ?? [];
  if (issues.includes("unavailable")) {
    return "countryUnavailable";
  }
  if (issues.includes("invalid") || issues.includes("too_long")) {
    return "companyInvalid";
  }
  return "unavailable";
}

// --- The fresh code (05 RG57; J7 decision 4) -----------------------------------------------------

export type FreshCodeMessage =
  | "required"
  | "format"
  | "invalid"
  | "expired"
  | "tooManyAttempts"
  | "sessionLost"
  | "tooManyRequests"
  | "verifyUnavailable"
  | "undeliverable"
  | "rateLimited"
  | "sendUnavailable";

/** The message of a code request that sent nothing; null when the code left. */
export function freshCodeRequestMessage(
  result: RelayResult<ReauthRequestCodeResponse>,
): FreshCodeMessage | null {
  if (result.kind !== "ok") {
    return "sendUnavailable";
  }
  switch (result.data.outcome) {
    case "sent":
      return result.data.reauthToken === undefined ? "sendUnavailable" : null;
    case "undeliverable":
      return "undeliverable";
    case "rate_limited":
      return "rateLimited";
    default:
      return "sendUnavailable";
  }
}

/**
 * Where a verification leads. `closed`: the code field goes, only a new code helps (RG137), and
 * the journey token is forgotten (C4.c of the J7 commit 7: it lives in memory only).
 */
export type FreshCodeStep =
  | { kind: "verified" }
  | {
      kind: "error";
      message: FreshCodeMessage;
      remaining?: number;
      closed: boolean;
    };

export function freshCodeStepOf(
  result: RelayResult<ReauthVerifyCodeResponse>,
): FreshCodeStep {
  if (result.kind !== "ok") {
    return { kind: "error", message: "verifyUnavailable", closed: false };
  }
  const response = result.data;
  switch (response.outcome) {
    case "reauthenticated":
      return { kind: "verified" };
    case "invalid":
      return {
        kind: "error",
        message: "invalid",
        remaining: response.attemptsLeft,
        closed: false,
      };
    case "too_many_attempts":
      return { kind: "error", message: "tooManyAttempts", closed: true };
    case "expired":
      return { kind: "error", message: "expired", closed: true };
    case "session_lost":
      return { kind: "error", message: "sessionLost", closed: true };
    case "too_many_requests":
      return { kind: "error", message: "tooManyRequests", closed: false };
    default:
      return { kind: "error", message: "verifyUnavailable", closed: false };
  }
}

// --- The change of address (05 RG58; J7 decision 5) -------------------------------------------------

/** "En attente de confirmation : {confirmed} sur 2" (17 §6.1). */
export function confirmedSidesOf(request: EmailChangeRequest): number {
  return (request.oldConfirmed ? 1 : 0) + (request.newConfirmed ? 1 : 0);
}

export type EmailChangeMessage =
  "sameAsCurrent" | "undeliverable" | "unavailable" | "freshCodeRequired";

/**
 * The message of a refused POST /v1/me/email-change. Each one sends the member back to the fresh
 * code (C4.c): the proof of the fresh code was spent by the attempt.
 */
export function emailChangeRefusalOf(
  result: RelayResult<unknown>,
): EmailChangeMessage {
  if (result.kind !== "failed") {
    return "unavailable";
  }
  if (result.code === "reauthentication_required") {
    return "freshCodeRequired";
  }
  if (result.code === "validation_failed") {
    const issues = result.issues ?? [];
    if (issues.includes("same_as_current")) {
      return "sameAsCurrent";
    }
    if (issues.includes("undeliverable")) {
      return "undeliverable";
    }
  }
  return "unavailable";
}

/** Where a typed confirmation code leads. `ended`: the request is closed, it starts over. */
export type ConfirmStep =
  | { kind: "pending"; request: EmailChangeRequest }
  | { kind: "completed" }
  | {
      kind: "ended";
      message: "addressUnavailable" | "tooManyAttempts" | "expired" | "gone";
    }
  | {
      kind: "codeError";
      message: "invalid" | "unavailable";
      remaining?: number;
    };

export function confirmStepOf(
  result: RelayResult<ConfirmEmailChangeResponse>,
): ConfirmStep {
  if (result.kind !== "ok") {
    return result.kind === "failed" && result.code === "not_found"
      ? { kind: "ended", message: "gone" }
      : { kind: "codeError", message: "unavailable" };
  }
  const response = result.data;
  switch (response.outcome) {
    case "confirmed":
      return { kind: "pending", request: response.request };
    case "completed":
      return { kind: "completed" };
    case "address_unavailable":
      return { kind: "ended", message: "addressUnavailable" };
    case "too_many_attempts":
      return { kind: "ended", message: "tooManyAttempts" };
    case "expired":
      return { kind: "ended", message: "expired" };
    case "invalid":
      return {
        kind: "codeError",
        message: "invalid",
        remaining: response.attemptsLeft,
      };
  }
}

// --- Mes préférences (17 §6.2; 05 RG95) ------------------------------------------------------------

/** The origin of a consent value, written in full (RG95): one text per source. */
export type ConsentOrigin =
  | "signupForm"
  | "accountSettings"
  | "unsubscribeLink"
  | "prospectionOptOut"
  | "influx"
  | "dataRequest";

export function consentOriginOf(source: ConsentSource): ConsentOrigin {
  switch (source) {
    case "signup_form":
      return "signupForm";
    case "account_settings":
      return "accountSettings";
    case "brevo_webhook":
      // RG96: an unsubscription that came back from Brevo is never shown as an error.
      return "unsubscribeLink";
    case "apollo_optout":
      return "prospectionOptOut";
    case "backoffice":
      return "influx";
    case "data_request":
      return "dataRequest";
  }
}

// --- Mes sessions (17 §6.4; 05 RG143) ---------------------------------------------------------------

/** A browser by its family and its system; null for the unidentified summary. */
export function browserOf(
  summary: UserAgentSummary,
): { family: UserAgentFamily; system: UserAgentSystem } | null {
  if (summary === UNIDENTIFIED_USER_AGENT) {
    return null;
  }
  const [family, system] = summary.split(".") as [
    UserAgentFamily,
    UserAgentSystem,
  ];
  return { family, system };
}

// --- Mes données (17 §6.3; EC-14) ---------------------------------------------------------------------

/** The word to type before a deletion request (17 §6.3: a word, not a reflex click). */
export function isConfirmationWordTyped(typed: string, word: string): boolean {
  return typed.trim() === word;
}

/** The open request of a type, if any: the screen shows it rather than a second one. */
export function openRequestOf(
  requests: readonly DataRequest[],
  type: DataRequest["type"],
): DataRequest | null {
  return (
    requests.find(
      (request) => request.type === type && request.status !== "closed",
    ) ?? null
  );
}

// Calls of the "mon compte" screens (docs/mvp/17 §6.1 to §6.4, §6.7; 21 §5.2, J7 commits 6 to 9).
// Each one goes through the same-origin relay (@influx/web-platform/relay-client) and reads the answer
// with the schema of packages/contracts. No rule lives here: apps/api decides, the screen
// displays. The account is always the session's: no call names an account.
import type { UiLocale } from "@influx/contracts/auth";
import {
  acceptTermsResponseSchema,
  cancelEmailChangeResponseSchema,
  confirmEmailChangeResponseSchema,
  consentResponseSchema,
  dataExportDownloadResponseSchema,
  dataExportStateResponseSchema,
  dataRequestResponseSchema,
  dataRequestsResponseSchema,
  emailChangeResponseSchema,
  emailChangeStateResponseSchema,
  meResponseSchema,
  reauthRequestCodeResponseSchema,
  reauthVerifyCodeResponseSchema,
  revokeAllSessionsResponseSchema,
  revokeSessionResponseSchema,
  sessionsResponseSchema,
  updateConsentResponseSchema,
  type AcceptTermsResponse,
  type CancelEmailChangeResponse,
  type ConfirmEmailChangeResponse,
  type ConsentResponse,
  type DataExportDownloadResponse,
  type DataExportStateResponse,
  type DataRequestResponse,
  type DataRequestsResponse,
  type DataRequestType,
  type EmailChangeResponse,
  type EmailChangeSide,
  type EmailChangeStateResponse,
  type MeResponse,
  type ReauthPurpose,
  type ReauthRequestCodeResponse,
  type ReauthVerifyCodeResponse,
  type RevokeAllSessionsResponse,
  type RevokeSessionResponse,
  type SessionsResponse,
  type UpdateConsentResponse,
  type UpdateMeBody,
} from "@influx/contracts/account";
import {
  currentTermsResponseSchema,
  type CurrentTermsResponse,
} from "@influx/contracts/terms";
import { callRelay, type RelayResult } from "@influx/web-platform/relay-client";

/** A session id or a request id: the only values a path carries (03 PP-2). */
const ID_PATTERN = /^[0-9a-f-]{36}$/;

function idSegment(id: string): string {
  if (!ID_PATTERN.test(id)) {
    throw new Error("not an identifier");
  }
  return id;
}

export function updateMe(body: UpdateMeBody): Promise<RelayResult<MeResponse>> {
  return callRelay("PATCH", "/v1/me", meResponseSchema, body);
}

export function readConsent(): Promise<RelayResult<ConsentResponse>> {
  return callRelay("GET", "/v1/me/consent", consentResponseSchema);
}

export function updateConsent(
  granted: boolean,
): Promise<RelayResult<UpdateConsentResponse>> {
  return callRelay("PUT", "/v1/me/consent", updateConsentResponseSchema, {
    granted,
  });
}

export function readSessions(): Promise<RelayResult<SessionsResponse>> {
  return callRelay("GET", "/v1/me/sessions", sessionsResponseSchema);
}

export function revokeSession(
  id: string,
): Promise<RelayResult<RevokeSessionResponse>> {
  return callRelay(
    "DELETE",
    `/v1/me/sessions/${idSegment(id)}`,
    revokeSessionResponseSchema,
  );
}

export function revokeAllSessions(): Promise<
  RelayResult<RevokeAllSessionsResponse>
> {
  return callRelay(
    "DELETE",
    "/v1/me/sessions",
    revokeAllSessionsResponseSchema,
  );
}

/** The text of the version to accept, in the language of `termsToAccept` (05 RG25). */
export function readTermsToAccept(
  locale: UiLocale,
): Promise<RelayResult<CurrentTermsResponse>> {
  return callRelay(
    "GET",
    "/v1/terms/current",
    currentTermsResponseSchema,
    undefined,
    { document: "terms_of_service", locale },
  );
}

export function acceptTerms(
  termsVersionId: string,
): Promise<RelayResult<AcceptTermsResponse>> {
  return callRelay("POST", "/v1/me/terms/accept", acceptTermsResponseSchema, {
    termsVersionId,
  });
}

export function requestFreshCode(
  purpose: ReauthPurpose,
): Promise<RelayResult<ReauthRequestCodeResponse>> {
  return callRelay(
    "POST",
    "/v1/me/reauthenticate/request-code",
    reauthRequestCodeResponseSchema,
    { purpose },
  );
}

export function verifyFreshCode(
  purpose: ReauthPurpose,
  code: string,
  reauthToken: string,
): Promise<RelayResult<ReauthVerifyCodeResponse>> {
  return callRelay(
    "POST",
    "/v1/me/reauthenticate/verify-code",
    reauthVerifyCodeResponseSchema,
    { purpose, code, reauthToken },
  );
}

export function readEmailChange(): Promise<
  RelayResult<EmailChangeStateResponse>
> {
  return callRelay(
    "GET",
    "/v1/me/email-change",
    emailChangeStateResponseSchema,
  );
}

export function startEmailChange(
  newEmail: string,
): Promise<RelayResult<EmailChangeResponse>> {
  return callRelay("POST", "/v1/me/email-change", emailChangeResponseSchema, {
    newEmail,
  });
}

export function confirmEmailChange(
  requestId: string,
  side: EmailChangeSide,
  code: string,
): Promise<RelayResult<ConfirmEmailChangeResponse>> {
  return callRelay(
    "POST",
    "/v1/me/email-change/confirm",
    confirmEmailChangeResponseSchema,
    { requestId, side, code },
  );
}

export function cancelEmailChange(
  requestId: string,
): Promise<RelayResult<CancelEmailChangeResponse>> {
  return callRelay(
    "DELETE",
    `/v1/me/email-change/${idSegment(requestId)}`,
    cancelEmailChangeResponseSchema,
  );
}

export function readDataRequests(): Promise<RelayResult<DataRequestsResponse>> {
  return callRelay("GET", "/v1/me/data-requests", dataRequestsResponseSchema);
}

export function submitDataRequest(
  type: DataRequestType,
): Promise<RelayResult<DataRequestResponse>> {
  return callRelay("POST", "/v1/me/data-requests", dataRequestResponseSchema, {
    type,
  });
}

export function readDataExport(): Promise<
  RelayResult<DataExportStateResponse>
> {
  return callRelay("GET", "/v1/me/data-export", dataExportStateResponseSchema);
}

/** One download: a fresh code for data_export is consumed by it (403 without one, 410 once gone). */
export function downloadDataExport(
  id: string,
): Promise<RelayResult<DataExportDownloadResponse>> {
  return callRelay(
    "POST",
    `/v1/me/data-export/${idSegment(id)}/download`,
    dataExportDownloadResponseSchema,
  );
}

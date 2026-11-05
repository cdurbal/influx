// Calls of the backoffice v0 screens (docs/mvp/17b §2, §3.11 to §3.13; 05 §K; 21 §J8 commit 9),
// through the same-origin relay and read with the schemas of packages/contracts. No rule lives here:
// apps/api and the database decide (roles, R, 2V, caps), the screens display what they answer.
import {
  accountCountersResponseSchema,
  accountDetailResponseSchema,
  accountsResponseSchema,
  type AccountCountersResponse,
  type AccountDetailResponse,
  type AccountsResponse,
  type AccountsSearchBody,
} from "@influx/contracts/backoffice-accounts";
import {
  alertsResponseSchema,
  apolloSettingsResponseSchema,
  correctionResponseSchema,
  degradedReviewResponseSchema,
  dualControlCancelResponseSchema,
  dualControlConfirmResponseSchema,
  dualControlListResponseSchema,
  dualControlViewSchema,
  replayResponseSchema,
  suppressionLiftResponseSchema,
  type AlertsResponse,
  type ApolloSettingsResponse,
  type CorrectionRequest,
  type CorrectionResponse,
  type DegradedReviewResponse,
  type DualControlConfirmResponse,
  type DualControlListResponse,
  type DualControlRequestBody,
  type DualControlViewBody,
  type ReplayRequest,
  type ReplayResponse,
  type SuppressionLiftRequest,
  type SuppressionLiftResponse,
} from "@influx/contracts/backoffice-actions";
import {
  backofficeReauthenticateResponseSchema,
  type BackofficeReauthenticateResponse,
} from "@influx/contracts/backoffice-auth";
import {
  internalAccountsResponseSchema,
  internalInvitationCreatedSchema,
  internalInvitationsResponseSchema,
  invitationRevokeResponseSchema,
  memberInvitationCreatedSchema,
  memberInvitationsResponseSchema,
  type InternalAccountsResponse,
  type InternalInvitationCreated,
  type InternalInvitationRequest,
  type InternalInvitationsResponse,
  type MemberInvitationCreated,
  type MemberInvitationRequest,
  type MemberInvitationsResponse,
} from "@influx/contracts/backoffice-invitations";
import {
  opsErrorDetailResponseSchema,
  opsErrorsResponseSchema,
  opsProcessesResponseSchema,
  opsStatusResponseSchema,
  opsTrafficResponseSchema,
  type OpsErrorDetailResponse,
  type OpsErrorFilter,
  type OpsErrorsResponse,
  type OpsProcessesResponse,
  type OpsStatusResponse,
  type OpsTrafficResponse,
  type OpsTrafficWindow,
} from "@influx/contracts/backoffice-ops";
import {
  entriesResponseSchema,
  entryLogoResponseSchema,
  extendEntryResponseSchema,
  forceReleaseResponseSchema,
  openEntryResponseSchema,
  publishEntryResponseSchema,
  queueCountersResponseSchema,
  rejectEntryResponseSchema,
  releaseEntryResponseSchema,
  type EntriesResponse,
  type EntryLogoResponse,
  type ExtendEntryResponse,
  type ForceReleaseRequest,
  type ForceReleaseResponse,
  type OpenEntryResponse,
  type PublishEntryRequest,
  type PublishEntryResponse,
  type QueueCountersResponse,
  type RejectEntryRequest,
  type RejectEntryResponse,
  type ReleaseEntryResponse,
} from "@influx/contracts/backoffice-queues";
import { callRelay, type RelayResult } from "@influx/web-platform/relay-client";

/** A path segment from a server-issued id: a UUID, or nothing is called. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idSegment(id: string): string {
  if (!UUID.test(id)) {
    throw new Error("identifier outside the UUID shape");
  }
  return id.toLowerCase();
}

// --- Accounts (05 RG97 to RG100, RG105) ------------------------------------------------------

/**
 * J8S-7 (05 RG97, RG98): the list, its filters, its period and its search term travel in the BODY,
 * never in a URL (logs, history; EC-62: an instant is no plain query character).
 */
export function searchAccounts(
  body: AccountsSearchBody,
): Promise<RelayResult<AccountsResponse>> {
  return callRelay(
    "POST",
    "/v1/bo/accounts/search",
    accountsResponseSchema,
    body,
  );
}

export function readAccount(
  id: string,
  historyBefore: number | null,
): Promise<RelayResult<AccountDetailResponse>> {
  return callRelay(
    "GET",
    `/v1/bo/accounts/${idSegment(id)}`,
    accountDetailResponseSchema,
    undefined,
    historyBefore === null
      ? undefined
      : { historyBefore: String(historyBefore) },
  );
}

export function readCounters(): Promise<RelayResult<AccountCountersResponse>> {
  return callRelay(
    "GET",
    "/v1/bo/accounts/counters",
    accountCountersResponseSchema,
  );
}

export function readAlerts(): Promise<RelayResult<AlertsResponse>> {
  return callRelay("GET", "/v1/bo/alerts", alertsResponseSchema);
}

// --- Actions (05 RG81, RG93, RG101 to RG103, RG108) -------------------------------------------

export function replay(
  body: ReplayRequest,
): Promise<RelayResult<ReplayResponse>> {
  return callRelay("POST", "/v1/bo/leads/replays", replayResponseSchema, body);
}

export function correctAccount(
  id: string,
  body: CorrectionRequest,
): Promise<RelayResult<CorrectionResponse>> {
  return callRelay(
    "POST",
    `/v1/bo/accounts/${idSegment(id)}/corrections`,
    correctionResponseSchema,
    body,
  );
}

export function liftSuppression(
  id: string,
  body: SuppressionLiftRequest,
): Promise<RelayResult<SuppressionLiftResponse>> {
  return callRelay(
    "POST",
    `/v1/bo/accounts/${idSegment(id)}/brevo-suppression/lift`,
    suppressionLiftResponseSchema,
    body,
  );
}

export function readApolloSettings(): Promise<
  RelayResult<ApolloSettingsResponse>
> {
  return callRelay(
    "GET",
    "/v1/bo/settings/apollo",
    apolloSettingsResponseSchema,
  );
}

// --- Dual control (03 PD1 to PD7; 17b §3.13.c) -----------------------------------------------

export function requestDualControl(
  body: DualControlRequestBody,
): Promise<RelayResult<DualControlViewBody>> {
  return callRelay("POST", "/v1/bo/dual-control", dualControlViewSchema, body);
}

export function readDualControls(): Promise<
  RelayResult<DualControlListResponse>
> {
  return callRelay("GET", "/v1/bo/dual-control", dualControlListResponseSchema);
}

/** PD6 (J8S-1): the weekly review of the confirmations made alone, the default weeks. */
export function readDegradedReview(): Promise<
  RelayResult<DegradedReviewResponse>
> {
  return callRelay(
    "GET",
    "/v1/bo/dual-control/degraded",
    degradedReviewResponseSchema,
  );
}

export function readDualControl(
  id: string,
): Promise<RelayResult<DualControlViewBody>> {
  return callRelay(
    "GET",
    `/v1/bo/dual-control/${idSegment(id)}`,
    dualControlViewSchema,
  );
}

export function confirmDualControl(
  id: string,
  degradedJustification: string | null,
): Promise<RelayResult<DualControlConfirmResponse>> {
  return callRelay(
    "POST",
    `/v1/bo/dual-control/${idSegment(id)}/confirm`,
    dualControlConfirmResponseSchema,
    { degradedJustification },
  );
}

export function cancelDualControl(
  id: string,
): Promise<RelayResult<{ cancelled: true }>> {
  return callRelay(
    "POST",
    `/v1/bo/dual-control/${idSegment(id)}/cancel`,
    dualControlCancelResponseSchema,
  );
}

// --- R (B-5; 17b §3.14.d) ----------------------------------------------------------------------

export function reauthenticate(
  password: string,
  code: string,
): Promise<RelayResult<BackofficeReauthenticateResponse>> {
  return callRelay(
    "POST",
    "/v1/bo/auth/reauthenticate",
    backofficeReauthenticateResponseSchema,
    { password, code },
  );
}

// --- Team and invitations (15 RG99; 05 RG116 to RG119) ----------------------------------------

export function readInternalAccounts(): Promise<
  RelayResult<InternalAccountsResponse>
> {
  return callRelay(
    "GET",
    "/v1/bo/internal-accounts",
    internalAccountsResponseSchema,
  );
}

export function readInternalInvitations(): Promise<
  RelayResult<InternalInvitationsResponse>
> {
  return callRelay(
    "GET",
    "/v1/bo/internal-invitations",
    internalInvitationsResponseSchema,
  );
}

export function createInternalInvitation(
  body: InternalInvitationRequest,
): Promise<RelayResult<InternalInvitationCreated>> {
  return callRelay(
    "POST",
    "/v1/bo/internal-invitations",
    internalInvitationCreatedSchema,
    body,
  );
}

export function readMemberInvitations(): Promise<
  RelayResult<MemberInvitationsResponse>
> {
  return callRelay(
    "GET",
    "/v1/bo/member-invitations",
    memberInvitationsResponseSchema,
  );
}

export function createMemberInvitation(
  body: MemberInvitationRequest,
): Promise<RelayResult<MemberInvitationCreated>> {
  return callRelay(
    "POST",
    "/v1/bo/member-invitations",
    memberInvitationCreatedSchema,
    body,
  );
}

export function revokeInvitation(
  kind: "internal" | "member",
  id: string,
  reasonCode: string,
): Promise<RelayResult<{ revoked: true }>> {
  return callRelay(
    "POST",
    `/v1/bo/${kind === "internal" ? "internal" : "member"}-invitations/${idSegment(id)}/revoke`,
    invitationRevokeResponseSchema,
    { reasonCode },
  );
}

// --- "Santé technique" (02 §20.5; 15 RG165; read only, admins only) ------------------------------

export function readOpsStatus(): Promise<RelayResult<OpsStatusResponse>> {
  return callRelay("GET", "/v1/bo/ops/status", opsStatusResponseSchema);
}

export function readOpsErrors(
  state: OpsErrorFilter,
  source: "server" | "browser" | null,
): Promise<RelayResult<OpsErrorsResponse>> {
  return callRelay(
    "GET",
    "/v1/bo/ops/errors",
    opsErrorsResponseSchema,
    undefined,
    source === null ? { state } : { state, source },
  );
}

export function readOpsError(
  id: string,
): Promise<RelayResult<OpsErrorDetailResponse>> {
  return callRelay(
    "GET",
    `/v1/bo/ops/errors/${idSegment(id)}`,
    opsErrorDetailResponseSchema,
  );
}

export function readOpsTraffic(
  window: OpsTrafficWindow,
): Promise<RelayResult<OpsTrafficResponse>> {
  return callRelay(
    "GET",
    "/v1/bo/ops/traffic",
    opsTrafficResponseSchema,
    undefined,
    { window },
  );
}

export function readOpsProcesses(): Promise<RelayResult<OpsProcessesResponse>> {
  return callRelay("GET", "/v1/bo/ops/processes", opsProcessesResponseSchema);
}

// --- Queues (15 RG26 to RG28, RG33, RG34; 17b §2.2; L2C-16) -------------------------------------

/** The counters of every queue (15 RG28), as the caller may see them (RG36). */
export function readQueueCounters(): Promise<
  RelayResult<QueueCountersResponse>
> {
  return callRelay(
    "GET",
    "/v1/bo/queues/counters",
    queueCountersResponseSchema,
  );
}

/**
 * The entries of queue 1, first page. The query holds codes of the plain characters the relay
 * carries: neither the period nor the cursor of the next page can cross it yet (EC-L2C-16-1).
 */
export function readBrandReviewEntries(
  query: Readonly<Record<string, string>>,
): Promise<RelayResult<EntriesResponse>> {
  return callRelay(
    "GET",
    "/v1/bo/queues/profiles-advertiser/entries",
    entriesResponseSchema,
    undefined,
    query,
  );
}

// --- Queue 1, one entry (06 RG6, RG65; 15 C1 to C4, C6; L2C-17) -----------------------------------

const ENTRIES = "/v1/bo/queues/profiles-advertiser/entries";

/** Opening is claiming (15 C1): the decision view, its version token, and the register line. */
export function openBrandReviewEntry(
  id: string,
): Promise<RelayResult<OpenEntryResponse>> {
  return callRelay(
    "POST",
    `${ENTRIES}/${idSegment(id)}/open`,
    openEntryResponseSchema,
  );
}

export function publishBrandReviewEntry(
  id: string,
  body: PublishEntryRequest,
): Promise<RelayResult<PublishEntryResponse>> {
  return callRelay(
    "POST",
    `${ENTRIES}/${idSegment(id)}/publish`,
    publishEntryResponseSchema,
    body,
  );
}

export function rejectBrandReviewEntry(
  id: string,
  body: RejectEntryRequest,
): Promise<RelayResult<RejectEntryResponse>> {
  return callRelay(
    "POST",
    `${ENTRIES}/${idSegment(id)}/reject`,
    rejectEntryResponseSchema,
    body,
  );
}

/** 15 C3, "je rends la main". */
export function releaseBrandReviewEntry(
  id: string,
): Promise<RelayResult<ReleaseEntryResponse>> {
  return callRelay(
    "POST",
    `${ENTRIES}/${idSegment(id)}/release`,
    releaseEntryResponseSchema,
  );
}

/** File.md A9: the claim of the caller takes its delay again. */
export function extendBrandReviewClaim(
  id: string,
): Promise<RelayResult<ExtendEntryResponse>> {
  return callRelay(
    "POST",
    `${ENTRIES}/${idSegment(id)}/extend`,
    extendEntryResponseSchema,
  );
}

/** 15 C4: an administrator lifts a live claim, with a typed reason. */
export function forceReleaseBrandReviewClaim(
  id: string,
  body: ForceReleaseRequest,
): Promise<RelayResult<ForceReleaseResponse>> {
  return callRelay(
    "POST",
    `${ENTRIES}/${idSegment(id)}/force-release`,
    forceReleaseResponseSchema,
    body,
  );
}

/**
 * The image of a logo of an entry, by the id the decision view served (0213, stockage.md §4). Each
 * call is one line of the register, nominative: the screen asks once per logo, when it is shown.
 */
export function readBrandReviewLogo(
  id: string,
  logoId: string,
): Promise<RelayResult<EntryLogoResponse>> {
  return callRelay(
    "GET",
    `${ENTRIES}/${idSegment(id)}/logo`,
    entryLogoResponseSchema,
    undefined,
    { logo: idSegment(logoId) },
  );
}

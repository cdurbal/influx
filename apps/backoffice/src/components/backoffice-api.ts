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
  type EntriesSearchBody,
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
import {
  accountBadgesResponseSchema,
  compareFiguresResponseSchema,
  confirmIdentifierChangeResponseSchema,
  decideDisputeResponseSchema,
  disputeEntriesResponseSchema,
  disputeOpenResponseSchema,
  identifierChangeEntriesResponseSchema,
  identifierChangeOpenResponseSchema,
  requestBadgeRevocationResponseSchema,
  requireIdentifierProofResponseSchema,
  grantVerificationResponseSchema,
  reexamineVerificationResponseSchema,
  rejectVerificationResponseSchema,
  updateVerificationRegistrySourceResponseSchema,
  verificationEntriesResponseSchema,
  verificationEvidenceReadResponseSchema,
  verificationOpenResponseSchema,
  verificationRegistrySourcesResponseSchema,
  type AccountBadgesResponse,
  type CompareFiguresRequest,
  type CompareFiguresResponse,
  type ConfirmIdentifierChangeRequest,
  type ConfirmIdentifierChangeResponse,
  type DecideDisputeResponse,
  type DisputeEntriesResponse,
  type DisputeEntriesSearchBody,
  type DisputeOpenResponse,
  type IdentifierChangeEntriesResponse,
  type IdentifierChangeEntriesSearchBody,
  type IdentifierChangeOpenResponse,
  type OverturnDisputeRequest,
  type RequireIdentifierProofRequest,
  type RequireIdentifierProofResponse,
  type UpholdDisputeRequest,
  type GrantAccountRequest,
  type GrantAudienceRequest,
  type GrantBrandRequest,
  type GrantVerificationResponse,
  type ReexamineVerificationRequest,
  type RequestBadgeRevocationBody,
  type RequestBadgeRevocationResponse,
  type ReexamineVerificationResponse,
  type RejectVerificationRequest,
  type RejectVerificationResponse,
  type UpdateVerificationRegistrySourceBody,
  type UpdateVerificationRegistrySourceResponse,
  type VerificationEntriesResponse,
  type VerificationEntriesSearchBody,
  type VerificationEvidenceReadResponse,
  type VerificationOpenResponse,
  type VerificationQueueView,
  type VerificationRegistrySourcesResponse,
} from "@influx/contracts/verification";
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

// --- Badges of an account and the ask for a withdrawal (08 RG73 to RG76; L2F-18) ----------------

export function readAccountBadges(
  id: string,
): Promise<RelayResult<AccountBadgesResponse>> {
  return callRelay(
    "GET",
    `/v1/bo/accounts/${idSegment(id)}/badges`,
    accountBadgesResponseSchema,
  );
}

/** Opens the 2V of the withdrawal: nothing is withdrawn here, an administrator confirms elsewhere. */
export function requestBadgeRevocation(
  accountId: string,
  badgeId: string,
  body: RequestBadgeRevocationBody,
): Promise<RelayResult<RequestBadgeRevocationResponse>> {
  return callRelay(
    "POST",
    `/v1/bo/accounts/${idSegment(accountId)}/badges/${idSegment(badgeId)}/revocation`,
    requestBadgeRevocationResponseSchema,
    body,
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

const ENTRIES = "/v1/bo/queues/profiles-advertiser/entries";

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
 * One page of the entries of queue 1 (L2C 18c, EC-L2C-16-1): the filters, the period and the cursor
 * travel in the BODY of a POST that writes nothing, because the relay carries query values of 64
 * plain characters only, which an instant and a cursor are not.
 */
export function searchBrandReviewEntries(
  body: EntriesSearchBody,
): Promise<RelayResult<EntriesResponse>> {
  return callRelay("POST", `${ENTRIES}/search`, entriesResponseSchema, body);
}

/**
 * The entries of queue 1, first page, from a query of plain characters: the dashboard only asks for
 * the overdue ones.
 */
export function readBrandReviewEntries(
  query: Readonly<Record<string, string>>,
): Promise<RelayResult<EntriesResponse>> {
  return callRelay("GET", ENTRIES, entriesResponseSchema, undefined, query);
}

// --- Queue 4, two views of one table (08 RG61 to RG67; l2e/modele.md §6; L2E-21) ---------------------

const VERIFICATION_ENTRIES = {
  creators: "/v1/bo/queues/verification-creators/entries",
  brands: "/v1/bo/queues/verification-brands/entries",
} as const satisfies Record<VerificationQueueView, string>;

/** One page of a view, filters, period, sort and cursor in the BODY, as queue 1 (the relay refuses an instant in a query). */
export function searchVerificationCreators(
  body: VerificationEntriesSearchBody,
): Promise<RelayResult<VerificationEntriesResponse>> {
  return callRelay(
    "POST",
    `${VERIFICATION_ENTRIES.creators}/search`,
    verificationEntriesResponseSchema,
    body,
  );
}

export function searchVerificationBrands(
  body: VerificationEntriesSearchBody,
): Promise<RelayResult<VerificationEntriesResponse>> {
  return callRelay(
    "POST",
    `${VERIFICATION_ENTRIES.brands}/search`,
    verificationEntriesResponseSchema,
    body,
  );
}

/** The first page of a view from a query of plain characters: the dashboard only asks for the overdue ones. */
export function readVerificationEntries(
  view: VerificationQueueView,
  query: Readonly<Record<string, string>>,
): Promise<RelayResult<VerificationEntriesResponse>> {
  return callRelay(
    "GET",
    VERIFICATION_ENTRIES[view],
    verificationEntriesResponseSchema,
    undefined,
    query,
  );
}

// --- Queue 1, one entry (06 RG6, RG65; 15 C1 to C4, C6; L2C-17) -----------------------------------

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

// --- Queue 4, one request of either view (08 RG43 to RG55; l2e/modele.md §4, §6; L2E-22, L2E-23) ----------

const CREATOR_ENTRIES = VERIFICATION_ENTRIES.creators;

function entryPath(view: VerificationQueueView, id: string): string {
  return `${VERIFICATION_ENTRIES[view]}/${idSegment(id)}`;
}

/** Opening is claiming (08 RG43): the dossier of RG55, the version token, the closed reasons and what the member reads. */
export function openVerificationEntry(
  view: VerificationQueueView,
  id: string,
): Promise<RelayResult<VerificationOpenResponse>> {
  return callRelay(
    "POST",
    `${entryPath(view, id)}/open`,
    verificationOpenResponseSchema,
  );
}

/** Modele -19: the figures typed first, then the declared ones and the verdict of the gap come back. */
export function compareVerificationFigures(
  id: string,
  body: CompareFiguresRequest,
): Promise<RelayResult<CompareFiguresResponse>> {
  return callRelay(
    "POST",
    `${CREATOR_ENTRIES}/${idSegment(id)}/compare`,
    compareFiguresResponseSchema,
    body,
  );
}

export function grantVerificationAccount(
  id: string,
  body: GrantAccountRequest,
): Promise<RelayResult<GrantVerificationResponse>> {
  return callRelay(
    "POST",
    `${CREATOR_ENTRIES}/${idSegment(id)}/grant-account`,
    grantVerificationResponseSchema,
    body,
  );
}

export function grantVerificationAudience(
  id: string,
  body: GrantAudienceRequest,
): Promise<RelayResult<GrantVerificationResponse>> {
  return callRelay(
    "POST",
    `${CREATOR_ENTRIES}/${idSegment(id)}/grant-audience`,
    grantVerificationResponseSchema,
    body,
  );
}

/** 06 RG49 to RG52: « Marque vérifiée », the code found at the domain and the register consulted. */
export function grantVerificationBrand(
  id: string,
  body: GrantBrandRequest,
): Promise<RelayResult<GrantVerificationResponse>> {
  return callRelay(
    "POST",
    `${entryPath("brands", id)}/grant`,
    grantVerificationResponseSchema,
    body,
  );
}

export function rejectVerificationEntry(
  view: VerificationQueueView,
  id: string,
  body: RejectVerificationRequest,
): Promise<RelayResult<RejectVerificationResponse>> {
  return callRelay(
    "POST",
    `${entryPath(view, id)}/reject`,
    rejectVerificationResponseSchema,
    body,
  );
}

/** « À réexaminer » (RG50): an internal reason, the request stays in the queue. */
export function reexamineVerificationEntry(
  view: VerificationQueueView,
  id: string,
  body: ReexamineVerificationRequest,
): Promise<RelayResult<ReexamineVerificationResponse>> {
  return callRelay(
    "POST",
    `${entryPath(view, id)}/reexamine`,
    reexamineVerificationResponseSchema,
    body,
  );
}

export function releaseVerificationEntry(
  view: VerificationQueueView,
  id: string,
): Promise<RelayResult<ReleaseEntryResponse>> {
  return callRelay(
    "POST",
    `${entryPath(view, id)}/release`,
    releaseEntryResponseSchema,
  );
}

export function extendVerificationEntryClaim(
  view: VerificationQueueView,
  id: string,
): Promise<RelayResult<ExtendEntryResponse>> {
  return callRelay(
    "POST",
    `${entryPath(view, id)}/extend`,
    extendEntryResponseSchema,
  );
}

export function forceReleaseVerificationEntryClaim(
  view: VerificationQueueView,
  id: string,
  body: ForceReleaseRequest,
): Promise<RelayResult<ForceReleaseResponse>> {
  return callRelay(
    "POST",
    `${entryPath(view, id)}/force-release`,
    forceReleaseResponseSchema,
    body,
  );
}

/**
 * One piece of a request, by the id the dossier served (D82 (5), RG46, RG84): JSON (base64) drawn from a
 * `blob:` URL. Each call is one nominative line of the register: the screen asks once per opening.
 */
export function readVerificationEvidence(
  id: string,
  evidenceId: string,
): Promise<RelayResult<VerificationEvidenceReadResponse>> {
  return callRelay(
    "GET",
    `${CREATOR_ENTRIES}/${idSegment(id)}/evidence/${idSegment(evidenceId)}`,
    verificationEvidenceReadResponseSchema,
  );
}

// --- The registry sources of the brand's registration (06 RG52, RG101; D79 (12); L2E-23) -----------------

const REGISTRY_SOURCES = "/v1/bo/verification/registry-sources";

/** Every source, the inactive ones too: read by an agent and by an administrator. */
export function readRegistrySources(): Promise<
  RelayResult<VerificationRegistrySourcesResponse>
> {
  return callRelay(
    "GET",
    REGISTRY_SOURCES,
    verificationRegistrySourcesResponseSchema,
  );
}

/** An administrator's change (RG101): the former and the new value are journaled by the database. */
export function saveRegistrySource(
  id: string,
  body: UpdateVerificationRegistrySourceBody,
): Promise<RelayResult<UpdateVerificationRegistrySourceResponse>> {
  return callRelay(
    "PUT",
    `${REGISTRY_SOURCES}/${idSegment(id)}`,
    updateVerificationRegistrySourceResponseSchema,
    body,
  );
}

// --- Queue 5, the contests of a badge decision (08 RG77; 15 RG27 C1 to C8; l2f/modele.md §5; L2F-19) ----

const DISPUTE_ENTRIES = "/v1/bo/queues/verification-disputes/entries";

/** One page, filters, period, sort and cursor in the BODY (the relay refuses an instant in a query). */
export function searchDisputeEntries(
  body: DisputeEntriesSearchBody,
): Promise<RelayResult<DisputeEntriesResponse>> {
  return callRelay(
    "POST",
    `${DISPUTE_ENTRIES}/search`,
    disputeEntriesResponseSchema,
    body,
  );
}

/** The first page from a query of plain characters: the dashboard only asks for the overdue ones. */
export function readDisputeEntries(
  query: Readonly<Record<string, string>>,
): Promise<RelayResult<DisputeEntriesResponse>> {
  return callRelay(
    "GET",
    DISPUTE_ENTRIES,
    disputeEntriesResponseSchema,
    undefined,
    query,
  );
}

/** Opening is claiming (15 C1): the dossier, the version token and the motives of the outcome. */
export function openDisputeEntry(
  id: string,
): Promise<RelayResult<DisputeOpenResponse>> {
  return callRelay(
    "POST",
    `${DISPUTE_ENTRIES}/${idSegment(id)}/open`,
    disputeOpenResponseSchema,
  );
}

export function releaseDisputeEntry(
  id: string,
): Promise<RelayResult<ReleaseEntryResponse>> {
  return callRelay(
    "POST",
    `${DISPUTE_ENTRIES}/${idSegment(id)}/release`,
    releaseEntryResponseSchema,
  );
}

export function extendDisputeEntryClaim(
  id: string,
): Promise<RelayResult<ExtendEntryResponse>> {
  return callRelay(
    "POST",
    `${DISPUTE_ENTRIES}/${idSegment(id)}/extend`,
    extendEntryResponseSchema,
  );
}

export function forceReleaseDisputeEntryClaim(
  id: string,
  body: ForceReleaseRequest,
): Promise<RelayResult<ForceReleaseResponse>> {
  return callRelay(
    "POST",
    `${DISPUTE_ENTRIES}/${idSegment(id)}/force-release`,
    forceReleaseResponseSchema,
    body,
  );
}

/** « Confirmer la décision » (CA52): a motive of the upheld ones, the team's own text for `other`. */
export function upholdDisputeEntry(
  id: string,
  body: UpholdDisputeRequest,
): Promise<RelayResult<DecideDisputeResponse>> {
  return callRelay(
    "POST",
    `${DISPUTE_ENTRIES}/${idSegment(id)}/uphold`,
    decideDisputeResponseSchema,
    body,
  );
}

/** « Infirmer » (CA53): by what was contested, with the identifier and the figures typed again. */
export function overturnDisputeEntry(
  id: string,
  body: OverturnDisputeRequest,
): Promise<RelayResult<DecideDisputeResponse>> {
  return callRelay(
    "POST",
    `${DISPUTE_ENTRIES}/${idSegment(id)}/overturn`,
    decideDisputeResponseSchema,
    body,
  );
}

/** One piece of the dossier of a refusal, by the id the dossier served: a nominative line of the register. */
export function readDisputeEvidence(
  id: string,
  evidenceId: string,
): Promise<RelayResult<VerificationEvidenceReadResponse>> {
  return callRelay(
    "GET",
    `${DISPUTE_ENTRIES}/${idSegment(id)}/evidence/${idSegment(evidenceId)}`,
    verificationEvidenceReadResponseSchema,
  );
}

// --- Queue 6, the identifiers changed after a verification (08 RG78; 15 RG29; L2F-19) -----------------

const IDENTIFIER_ENTRIES = "/v1/bo/queues/identifier-changes/entries";

export function searchIdentifierChangeEntries(
  body: IdentifierChangeEntriesSearchBody,
): Promise<RelayResult<IdentifierChangeEntriesResponse>> {
  return callRelay(
    "POST",
    `${IDENTIFIER_ENTRIES}/search`,
    identifierChangeEntriesResponseSchema,
    body,
  );
}

export function readIdentifierChangeEntries(
  query: Readonly<Record<string, string>>,
): Promise<RelayResult<IdentifierChangeEntriesResponse>> {
  return callRelay(
    "GET",
    IDENTIFIER_ENTRIES,
    identifierChangeEntriesResponseSchema,
    undefined,
    query,
  );
}

/** Opening is claiming: the former and the new identifier come to the holder of the live claim only. */
export function openIdentifierChangeEntry(
  id: string,
): Promise<RelayResult<IdentifierChangeOpenResponse>> {
  return callRelay(
    "POST",
    `${IDENTIFIER_ENTRIES}/${idSegment(id)}/open`,
    identifierChangeOpenResponseSchema,
  );
}

export function releaseIdentifierChangeEntry(
  id: string,
): Promise<RelayResult<ReleaseEntryResponse>> {
  return callRelay(
    "POST",
    `${IDENTIFIER_ENTRIES}/${idSegment(id)}/release`,
    releaseEntryResponseSchema,
  );
}

export function extendIdentifierChangeClaim(
  id: string,
): Promise<RelayResult<ExtendEntryResponse>> {
  return callRelay(
    "POST",
    `${IDENTIFIER_ENTRIES}/${idSegment(id)}/extend`,
    extendEntryResponseSchema,
  );
}

export function forceReleaseIdentifierChangeClaim(
  id: string,
  body: ForceReleaseRequest,
): Promise<RelayResult<ForceReleaseResponse>> {
  return callRelay(
    "POST",
    `${IDENTIFIER_ENTRIES}/${idSegment(id)}/force-release`,
    forceReleaseResponseSchema,
    body,
  );
}

/** « Même compte »: the handle typed must be the one declared; the badge is never rewritten. */
export function confirmIdentifierChangeEntry(
  id: string,
  body: ConfirmIdentifierChangeRequest,
): Promise<RelayResult<ConfirmIdentifierChangeResponse>> {
  return callRelay(
    "POST",
    `${IDENTIFIER_ENTRIES}/${idSegment(id)}/confirm`,
    confirmIdentifierChangeResponseSchema,
    body,
  );
}

/** « Exiger une nouvelle preuve »: the badge goes to « à reconfirmer », the proof is asked in the member's space. */
export function requireIdentifierProofEntry(
  id: string,
  body: RequireIdentifierProofRequest,
): Promise<RelayResult<RequireIdentifierProofResponse>> {
  return callRelay(
    "POST",
    `${IDENTIFIER_ENTRIES}/${idSegment(id)}/require-proof`,
    requireIdentifierProofResponseSchema,
    body,
  );
}

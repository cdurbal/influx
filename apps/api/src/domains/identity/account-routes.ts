// Routes of the member's own account, "mon compte" (1) (docs/mvp/21 §5.2, J7 commit 6; 05 RG15,
// RG28, RG34, RG35, RG56, RG71, RG73, RG92 to RG95, RG143; 17 §6.1, §6.2, §6.4, §6.7). Web surface
// only, member session required (withMemberSession). The account is always the session's: no
// route takes an account id, and a session id that is not one of the member's own open sessions
// gets the 404 of an unknown one (18 T14).
// Writes go through the named functions of the database only, each with its queue facts in the
// same transaction (05 RG73): identity.update_own_account() (0122), identity.set_marketing_consent()
// (0119), identity.revoke_own_session() (0012); the re-acceptance is the member's own insert
// (0005 §5.2).
// Behind a fresh code (RG57, J7 commit 7): the re-authentication (reauthentication.ts, decision 4)
// and the change of address (email-change.ts, decision 5; RG58, A-11); "mes données" (J7 commit 8,
// decision 6, EC-14): export and deletion are REQUESTS (backoffice.submit_data_subject_request(),
// 0120). The export is acknowledged by e-mail and instructed by an admin (docs/mvp/runbooks/
// demandes-rgpd.md); the deletion is authorised by the member's own fresh code
// (identity.submit_member_erasure(), 0150, D72) and executed by the worker, without an admin. Both,
// and the fresh code they need, are exempt from the terms gate (A3): a right of the person
// survives a refused version.
import {
  acceptTermsBodySchema,
  acceptTermsResponseSchema,
  cancelEmailChangeResponseSchema,
  confirmEmailChangeBodySchema,
  confirmEmailChangeResponseSchema,
  consentResponseSchema,
  consentSourceSchema,
  dataRequestBodySchema,
  dataRequestResponseSchema,
  dataRequestSchema,
  dataRequestsResponseSchema,
  emailChangeBodySchema,
  emailChangeParamsSchema,
  emailChangeResponseSchema,
  emailChangeStateResponseSchema,
  meResponseSchema,
  reauthRequestCodeBodySchema,
  reauthRequestCodeResponseSchema,
  reauthVerifyCodeBodySchema,
  reauthVerifyCodeResponseSchema,
  revokeAllSessionsResponseSchema,
  revokeSessionResponseSchema,
  sessionParamsSchema,
  sessionsResponseSchema,
  updateConsentBodySchema,
  updateConsentResponseSchema,
  updateMeBodySchema,
  type AcceptTermsBody,
  type AcceptTermsResponse,
  type CancelEmailChangeResponse,
  type ConfirmEmailChangeBody,
  type ConfirmEmailChangeResponse,
  type ConsentResponse,
  type DataRequest,
  type DataRequestBody,
  type DataRequestResponse,
  type DataRequestsResponse,
  type EmailChangeBody,
  type EmailChangeParams,
  type EmailChangeResponse,
  type EmailChangeStateResponse,
  type MeResponse,
  type ReauthRequestCodeBody,
  type ReauthRequestCodeResponse,
  type ReauthVerifyCodeBody,
  type ReauthVerifyCodeResponse,
  type RevokeAllSessionsResponse,
  type RevokeSessionResponse,
  type SessionParams,
  type SessionsResponse,
  type TermsToAccept,
  type UpdateConsentBody,
  type UpdateConsentResponse,
  type UpdateMeBody,
} from "@influx/contracts/account";
import { RESEND_DELAY_SECONDS, uiLocaleSchema } from "@influx/contracts/auth";
import {
  countryCodeSchema,
  declaredStatusSchema,
} from "@influx/contracts/signup";
import {
  UNIDENTIFIED_USER_AGENT,
  userAgentSummarySchema,
} from "@influx/contracts/user-agent";
import type { ValidationIssue } from "@influx/contracts/errors";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Transaction } from "../../db/index.ts";
import { clearAuthCookie } from "../../platform/auth-cookies.ts";
import { clientAddressOf } from "../../platform/client-address.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import { userAgentSummaryOf } from "../../platform/user-agent.ts";
import {
  cancelOwnEmailChange,
  confirmEmailChangeCode,
  openEmailChange,
  startEmailChange,
  type EmailChangeCall,
} from "./email-change.ts";
import { withMemberSession, type MemberContext } from "./member-session.ts";
import {
  requestReauthenticationCode,
  requireFreshCode,
  verifyReauthenticationCode,
  type ReauthenticatingMember,
} from "./reauthentication.ts";
import {
  CONSENT_PURPOSES,
  constraintNameOf,
  insertReacceptance,
  ownConsentStates,
  ownDataRequests,
  ownOpenSessions,
  ownProfile,
  revokeOwnSession,
  setMarketingConsent,
  sqlStateOf,
  submitDataRequest,
  submitMemberErasure,
  updateOwnAccount,
  type ConsentState,
  type OwnDataRequestRow,
  type TermsToAcceptRow,
} from "./repository.ts";
import type { IdentityApp, IdentityDependencies } from "./routes.ts";

/** The evidence of a change made from the space (0119: codes only, never an address). */
const CONSENT_EVIDENCE = { form: "account_preferences" } as const;

/** The fresh codes outside the terms gate (A3): "mes données" only, every other purpose gated. */
const TERMS_EXEMPT_PURPOSES: ReadonlySet<ReauthRequestCodeBody["purpose"]> =
  new Set(["data_export", "account_deletion"]);

/**
 * The one value shown for two purposes (05 RG33, RG95): granted only when both are; otherwise the
 * latest withdrawal gives the date and the origin. An account without any event shows nothing.
 */
export function consentView(states: readonly ConsentState[]): ConsentResponse {
  const latest = (candidates: readonly ConsentState[]) =>
    candidates.reduce<ConsentState | null>(
      (found, state) =>
        found === null || state.occurredAt > found.occurredAt ? state : found,
      null,
    );
  const granted = CONSENT_PURPOSES.every((purpose) =>
    states.some((state) => state.purpose === purpose && state.granted),
  );
  const shown = granted
    ? latest(states)
    : latest(states.filter((state) => !state.granted));
  const source = consentSourceSchema.safeParse(shown?.source);
  return {
    granted,
    occurredAt: shown?.occurredAt ?? null,
    source: shown === null || !source.success ? null : source.data,
  };
}

/** A row of backoffice.data_subject_requests as the member reads it; the schema checks it again. */
function dataRequestOf(row: OwnDataRequestRow): DataRequest {
  return dataRequestSchema.parse({
    id: row.id,
    type: row.requestType,
    receivedAt: row.receivedAt,
    dueAt: row.dueAt,
    status: row.status,
    completedAt: row.completedAt,
    outcome: row.outcomeCode,
  });
}

function termsToAcceptOf(row: TermsToAcceptRow | null): TermsToAccept | null {
  if (row === null) {
    return null;
  }
  return {
    versionId: row.versionId,
    versionLabel: row.versionLabel,
    locale: uiLocaleSchema.parse(row.locale),
    effectiveFrom: row.effectiveFrom,
  };
}

async function meOf(
  tx: Transaction,
  context: MemberContext,
): Promise<MeResponse> {
  const profile = await ownProfile(tx, context.role);
  if (profile === null) {
    throw new ApiError("unauthenticated");
  }
  return {
    email: profile.email,
    role: context.role,
    preferredLanguage: uiLocaleSchema.parse(profile.preferredLanguage),
    countryCode: countryCodeSchema.parse(profile.countryCode),
    declaredStatus: declaredStatusSchema.parse(profile.declaredStatus),
    companyName: profile.companyName,
    // a published brand's new name waits for review: the validated one stays above (06 RG9)
    ...(profile.companyNamePending === null
      ? {}
      : { companyNamePending: profile.companyNamePending }),
    termsToAccept: termsToAcceptOf(context.termsToAccept),
  };
}

/** The fields of the other door, refused one by one before the database does (17 §6.1, RG22). */
function otherDoorIssues(
  role: MemberContext["role"],
  body: UpdateMeBody,
): ValidationIssue[] {
  if (role === "creator" && body.companyName !== undefined) {
    return [{ path: "companyName", issue: "not_allowed" }];
  }
  if (
    role === "advertiser" &&
    body.declaredStatus !== undefined &&
    body.declaredStatus !== "business"
  ) {
    return [{ path: "declaredStatus", issue: "not_allowed" }];
  }
  return [];
}

/** A refusal of identity.update_own_account() as the field it concerns (0122). */
function updateRefusalOf(error: unknown): ValidationIssue | null {
  switch (sqlStateOf(error)) {
    case "23514":
      return (constraintNameOf(error) ?? "").startsWith(
        "advertiser_profiles_legal_name",
      )
        ? { path: "companyName", issue: "invalid" }
        : { path: "countryCode", issue: "unavailable" };
    case "23503":
      return { path: "countryCode", issue: "unknown" };
    case "22023":
      return { path: "", issue: "not_allowed" };
    default:
      return null;
  }
}

export function registerAccountRoutes(
  app: IdentityApp,
  dependencies: IdentityDependencies,
): void {
  const { database, now } = dependencies;

  // GET /v1/me: "mes informations" (RG71), and the terms of service to accept first (RG28): the
  // front shows the blocking screen while termsToAccept is set. Exempt from the gate, which it
  // describes.
  app.get(
    "/v1/me",
    { schema: { response: { 200: meResponseSchema } } },
    async (request, reply): Promise<MeResponse> =>
      withMemberSession(database, request, reply, now, meOf, {
        terms: "exempt",
      }),
  );

  // PATCH /v1/me (RG15, RG73): country, language, declared status (creator), company name
  // (advertiser); one lead.updated per change, in the transaction of the change. Exempt from the
  // gate: rectification is a right of the person (GDPR art. 16), these fields bind nothing at Lot 1
  // and the language is the one the new terms are read in (expert-conformite-rgpd, 2026-10-14).
  app.patch(
    "/v1/me",
    {
      schema: {
        body: updateMeBodySchema,
        response: { 200: meResponseSchema },
      },
    },
    async (request, reply): Promise<MeResponse> => {
      const body = request.body as UpdateMeBody;
      return withMemberSession(
        database,
        request,
        reply,
        now,
        async (tx, context) => {
          const refused = otherDoorIssues(context.role, body);
          if (refused.length > 0) {
            throw new RequestValidationError(refused);
          }
          try {
            await updateOwnAccount(tx, body);
          } catch (error) {
            if (sqlStateOf(error) === "55000") {
              // the guard of 0209: the name of a suspended brand is frozen (file.md A4)
              throw new ApiError("conflict");
            }
            const issue = updateRefusalOf(error);
            if (issue === null) {
              throw error;
            }
            throw new RequestValidationError([issue]);
          }
          return meOf(tx, context);
        },
        { terms: "exempt" },
      );
    },
  );

  // GET /v1/me/consent (RG95): the value, its date and its origin. Exempt from the gate: the
  // consent is withdrawn at any time (RG34).
  app.get(
    "/v1/me/consent",
    { schema: { response: { 200: consentResponseSchema } } },
    async (request, reply): Promise<ConsentResponse> =>
      withMemberSession(
        database,
        request,
        reply,
        now,
        async (tx) => consentView(await ownConsentStates(tx)),
        { terms: "exempt" },
      ),
  );

  // PUT /v1/me/consent (RG34, RG92, RG94): one gesture for both purposes (RG33). Effective in
  // INFLUX when this transaction commits, whatever becomes of the propagation: consent.revoked
  // leaves at priority 0 (RG78) to Brevo and Apollo, by the worker.
  app.put(
    "/v1/me/consent",
    {
      schema: {
        body: updateConsentBodySchema,
        response: { 200: updateConsentResponseSchema },
      },
    },
    async (request, reply): Promise<UpdateConsentResponse> => {
      const { granted } = request.body as UpdateConsentBody;
      return withMemberSession(
        database,
        request,
        reply,
        now,
        async (tx) => {
          let changed = false;
          for (const purpose of CONSENT_PURPOSES) {
            if (
              await setMarketingConsent(tx, purpose, granted, CONSENT_EVIDENCE)
            ) {
              changed = true;
            }
          }
          return { ...consentView(await ownConsentStates(tx)), changed };
        },
        { terms: "exempt" },
      );
    },
  );

  // GET /v1/me/sessions (RG56, RG143): the open sessions, "cet appareil" marked. Exempt from the
  // gate, like both revocations: the only way to take one's account back (17 §6.4).
  app.get(
    "/v1/me/sessions",
    { schema: { response: { 200: sessionsResponseSchema } } },
    async (request, reply): Promise<SessionsResponse> =>
      withMemberSession(
        database,
        request,
        reply,
        now,
        async (tx, context) => ({
          sessions: (await ownOpenSessions(tx)).map((row) => {
            const browser = userAgentSummarySchema.safeParse(
              row.userAgentSummary,
            );
            return {
              id: row.id,
              createdAt: row.createdAt,
              lastActivityAt: row.lastActivityAt,
              browser: browser.success ? browser.data : UNIDENTIFIED_USER_AGENT,
              current: row.id === context.sessionId,
            };
          }),
        }),
        { terms: "exempt" },
      ),
  );

  // DELETE /v1/me/sessions/:id: one session closed by its holder (revoked_by_holder). Unknown,
  // already closed or another member's: the same 404 (T14.3, T14.4).
  app.delete(
    "/v1/me/sessions/:id",
    {
      schema: {
        params: sessionParamsSchema,
        response: { 200: revokeSessionResponseSchema },
      },
    },
    async (request, reply): Promise<RevokeSessionResponse> => {
      const sessionId = (request.params as SessionParams).id.toLowerCase();
      const signedOut = await withMemberSession(
        database,
        request,
        reply,
        now,
        async (tx, context) => {
          if (!(await revokeOwnSession(tx, sessionId, "revoked_by_holder"))) {
            throw new ApiError("not_found");
          }
          return sessionId === context.sessionId;
        },
        { terms: "exempt" },
      );
      if (signedOut) {
        clearAuthCookie(reply, "webSession");
      }
      return { outcome: "revoked", signedOut };
    },
  );

  // DELETE /v1/me/sessions: "fermer toutes les sessions" (CA33), this one included, which the
  // screen says before (17 §6.4).
  app.delete(
    "/v1/me/sessions",
    { schema: { response: { 200: revokeAllSessionsResponseSchema } } },
    async (request, reply): Promise<RevokeAllSessionsResponse> => {
      const revokedCount = await withMemberSession(
        database,
        request,
        reply,
        now,
        async (tx, context) => {
          const ids = new Set(
            (await ownOpenSessions(tx)).map((session) => session.id),
          );
          ids.add(context.sessionId);
          let count = 0;
          for (const id of ids) {
            if (await revokeOwnSession(tx, id, "revoked_by_holder")) {
              count += 1;
            }
          }
          return count;
        },
        { terms: "exempt" },
      );
      clearAuthCookie(reply, "webSession");
      return { outcome: "revoked", revokedCount, signedOut: true };
    },
  );

  // POST /v1/me/terms/accept (RG28, CA70): the re-acceptance of the version shown, which must
  // still be the one to accept (409 otherwise, the front reads GET /v1/me again). Nothing pending:
  // accepted already (a second click). Refusing is POST /v1/auth/logout.
  app.post(
    "/v1/me/terms/accept",
    {
      schema: {
        body: acceptTermsBodySchema,
        response: { 200: acceptTermsResponseSchema },
      },
    },
    async (request, reply): Promise<AcceptTermsResponse> => {
      const { termsVersionId } = request.body as AcceptTermsBody;
      return withMemberSession(
        database,
        request,
        reply,
        now,
        async (tx, context) => {
          const pending = context.termsToAccept;
          if (pending === null) {
            return { outcome: "accepted" };
          }
          if (pending.versionId !== termsVersionId.toLowerCase()) {
            throw new ApiError("conflict");
          }
          try {
            await insertReacceptance(tx, pending);
          } catch (error) {
            // 23505: accepted meanwhile by a second tab; 23503: no longer in force.
            const state = sqlStateOf(error);
            if (state === "23505" || state === "23503") {
              throw new ApiError("conflict");
            }
            throw error;
          }
          return { outcome: "accepted" };
        },
        { terms: "exempt" },
      );
    },
  );

  // --- Behind a fresh code (RG57; J7 decisions 4 and 5, commit 7) -------------------------------

  /**
   * The member asking, read in its own transaction and committed before any call (G4). The fresh
   * code of "mes données" is exempt from the terms gate, like the requests it opens (A3); an allow
   * list, so that a purpose added later is gated by default (expert-cybersecurite, 2026-10-14).
   */
  const memberOf = (
    request: FastifyRequest,
    reply: FastifyReply,
    purpose: ReauthRequestCodeBody["purpose"],
  ) =>
    withMemberSession(
      database,
      request,
      reply,
      now,
      async (tx, context): Promise<ReauthenticatingMember> => {
        const profile = await ownProfile(tx);
        if (profile === null) {
          throw new ApiError("unauthenticated");
        }
        return {
          sessionId: context.sessionId,
          accountId: context.accountId,
          email: profile.email,
          locale: uiLocaleSchema.parse(profile.preferredLanguage),
        };
      },
      { terms: TERMS_EXEMPT_PURPOSES.has(purpose) ? "exempt" : "required" },
    );

  const emailChangeCallOf = (
    request: FastifyRequest,
    reply: FastifyReply,
  ): EmailChangeCall => ({
    requestId: request.id,
    inMember: (fn) => withMemberSession(database, request, reply, now, fn),
    clientAddress: clientAddressOf(request),
    logger: request.log,
  });

  // POST /v1/me/reauthenticate/request-code (RG57, RG44): a sign-in code to the session's address.
  app.post(
    "/v1/me/reauthenticate/request-code",
    {
      schema: {
        body: reauthRequestCodeBodySchema,
        response: { 200: reauthRequestCodeResponseSchema },
      },
    },
    async (request, reply): Promise<ReauthRequestCodeResponse> => {
      const { purpose } = request.body as ReauthRequestCodeBody;
      // C4.b: the answer carries the signed journey and the phrase: never stored by a cache.
      reply.header("cache-control", "no-store");
      const member = await memberOf(request, reply, purpose);
      const result = await requestReauthenticationCode(dependencies, {
        requestId: request.id,
        member,
        purpose,
        clientAddress: clientAddressOf(request),
        browser: userAgentSummaryOf(request),
        logger: request.log,
      });
      return result.journey === null
        ? { outcome: result.outcome, retryAfterSeconds: RESEND_DELAY_SECONDS }
        : {
            outcome: result.outcome,
            retryAfterSeconds: RESEND_DELAY_SECONDS,
            matchingPhrase: result.journey.phrase,
            reauthToken: result.journey.token,
          };
    },
  );

  // POST /v1/me/reauthenticate/verify-code: the marker of `purpose` on this session (0118).
  app.post(
    "/v1/me/reauthenticate/verify-code",
    {
      schema: {
        body: reauthVerifyCodeBodySchema,
        response: { 200: reauthVerifyCodeResponseSchema },
      },
    },
    async (request, reply): Promise<ReauthVerifyCodeResponse> => {
      const body = request.body as ReauthVerifyCodeBody;
      reply.header("cache-control", "no-store");
      const member = await memberOf(request, reply, body.purpose);
      return verifyReauthenticationCode(dependencies, {
        requestId: request.id,
        member,
        purpose: body.purpose,
        code: body.code,
        token: body.reauthToken,
        clientAddress: clientAddressOf(request),
        logger: request.log,
      });
    },
  );

  // GET /v1/me/email-change (17 §6.1): the open request, "1 sur 2 · expire le {date}".
  app.get(
    "/v1/me/email-change",
    { schema: { response: { 200: emailChangeStateResponseSchema } } },
    async (request, reply): Promise<EmailChangeStateResponse> => ({
      request: await withMemberSession(database, request, reply, now, (tx) =>
        openEmailChange(tx),
      ),
    }),
  );

  // POST /v1/me/email-change (RG58, A-11): after a fresh code for email_change; both codes leave.
  app.post(
    "/v1/me/email-change",
    {
      schema: {
        body: emailChangeBodySchema,
        response: { 200: emailChangeResponseSchema },
      },
    },
    async (request, reply): Promise<EmailChangeResponse> =>
      startEmailChange(
        dependencies,
        emailChangeCallOf(request, reply),
        (request.body as EmailChangeBody).newEmail,
      ),
  );

  // POST /v1/me/email-change/confirm: one code of one side; the second completes the change.
  app.post(
    "/v1/me/email-change/confirm",
    {
      schema: {
        body: confirmEmailChangeBodySchema,
        response: { 200: confirmEmailChangeResponseSchema },
      },
    },
    async (request, reply): Promise<ConfirmEmailChangeResponse> => {
      const body = request.body as ConfirmEmailChangeBody;
      return confirmEmailChangeCode(
        dependencies,
        emailChangeCallOf(request, reply),
        {
          changeId: body.requestId.toLowerCase(),
          side: body.side,
          code: body.code,
        },
      );
    },
  );

  // DELETE /v1/me/email-change/:id: the holder cancels; unknown, closed or another's: 404 (T14).
  app.delete(
    "/v1/me/email-change/:id",
    {
      schema: {
        params: emailChangeParamsSchema,
        response: { 200: cancelEmailChangeResponseSchema },
      },
    },
    async (request, reply): Promise<CancelEmailChangeResponse> => {
      const changeId = (request.params as EmailChangeParams).id.toLowerCase();
      await withMemberSession(database, request, reply, now, (tx) =>
        cancelOwnEmailChange(tx, changeId),
      );
      return { outcome: "cancelled" };
    },
  );

  // --- "Mes données" (EC-14; RG57; 17 §6.3; J7 decision 6, commit 8) --------------------------------

  // GET /v1/me/data-requests: the member's own requests, their state and their deadline.
  app.get(
    "/v1/me/data-requests",
    { schema: { response: { 200: dataRequestsResponseSchema } } },
    async (request, reply): Promise<DataRequestsResponse> =>
      withMemberSession(
        database,
        request,
        reply,
        now,
        async (tx) => ({
          requests: (await ownDataRequests(tx)).map(dataRequestOf),
        }),
        { terms: "exempt" },
      ),
  );

  // POST /v1/me/data-requests (RG57): after a fresh code for data_export (access) or
  // account_deletion (erasure), consumed by the deposit in its transaction.
  // access: the acknowledgement privacy.request_received is queued with it (P1); a request of this
  //   type still open is returned as it is; nothing is exported here: an admin instructs it (EC-14).
  // erasure (D72): identity.submit_member_erasure() authorises it in the same transaction, without
  //   an admin, closes every session of the account and no acknowledgement leaves; the cookie is
  //   cleared as "fermer toutes les sessions" does, the worker erases the account at its next turn
  //   and the answer is the e-mail privacy.erasure_completed.
  app.post(
    "/v1/me/data-requests",
    {
      schema: {
        body: dataRequestBodySchema,
        response: { 200: dataRequestResponseSchema },
      },
    },
    async (request, reply): Promise<DataRequestResponse> => {
      const { type } = request.body as DataRequestBody;
      if (type === "erasure") {
        const authorised = await withMemberSession(
          database,
          request,
          reply,
          now,
          (tx) => requireFreshCode(() => submitMemberErasure(tx)),
          { terms: "exempt" },
        );
        clearAuthCookie(reply, "webSession");
        return {
          outcome: "erasure_authorised",
          requestId: authorised.requestId,
          status: dataRequestSchema.shape.status.parse(authorised.status),
        };
      }
      return withMemberSession(
        database,
        request,
        reply,
        now,
        async (tx, context) => {
          const deposited = await requireFreshCode(() =>
            submitDataRequest(tx, context.sessionId, type),
          );
          const row = (await ownDataRequests(tx)).find(
            (candidate) => candidate.id === deposited.requestId,
          );
          if (row === undefined) {
            throw new Error("deposited request not readable by its member");
          }
          return {
            outcome: deposited.created ? "received" : "already_open",
            request: dataRequestOf(row),
          };
        },
        { terms: "exempt" },
      );
    },
  );
}

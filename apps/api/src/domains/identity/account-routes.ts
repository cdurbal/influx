// Routes of the member's own account, "mon compte" (1) (docs/mvp/21 §5.2, J7 commit 6; 05 RG15,
// RG28, RG34, RG35, RG56, RG71, RG73, RG92 to RG95, RG143; 17 §6.1, §6.2, §6.4, §6.7). Web surface
// only, member session required (withMemberSession). The account is always the session's: no
// route takes an account id, and a session id that is not one of the member's own open sessions
// gets the 404 of an unknown one (18 T14).
// Writes go through the named functions of the database only, each with its queue facts in the
// same transaction (05 RG73): identity.update_own_account() (0122), identity.set_marketing_consent()
// (0119), identity.revoke_own_session() (0012); the re-acceptance is the member's own insert
// (0005 §5.2).
import {
  acceptTermsBodySchema,
  acceptTermsResponseSchema,
  consentResponseSchema,
  consentSourceSchema,
  meResponseSchema,
  revokeAllSessionsResponseSchema,
  revokeSessionResponseSchema,
  sessionParamsSchema,
  sessionsResponseSchema,
  updateConsentBodySchema,
  updateConsentResponseSchema,
  updateMeBodySchema,
  type AcceptTermsBody,
  type AcceptTermsResponse,
  type ConsentResponse,
  type MeResponse,
  type RevokeAllSessionsResponse,
  type RevokeSessionResponse,
  type SessionParams,
  type SessionsResponse,
  type TermsToAccept,
  type UpdateConsentBody,
  type UpdateConsentResponse,
  type UpdateMeBody,
} from "@influx/contracts/account";
import { uiLocaleSchema } from "@influx/contracts/auth";
import {
  countryCodeSchema,
  declaredStatusSchema,
} from "@influx/contracts/signup";
import {
  UNIDENTIFIED_USER_AGENT,
  userAgentSummarySchema,
} from "@influx/contracts/user-agent";
import type { ValidationIssue } from "@influx/contracts/errors";
import type { Transaction } from "../../db/index.ts";
import { clearAuthCookie } from "../../platform/auth-cookies.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import { withMemberSession, type MemberContext } from "./member-session.ts";
import {
  CONSENT_PURPOSES,
  constraintNameOf,
  insertReacceptance,
  ownConsentStates,
  ownOpenSessions,
  ownProfile,
  revokeOwnSession,
  setMarketingConsent,
  sqlStateOf,
  updateOwnAccount,
  type ConsentState,
  type TermsToAcceptRow,
} from "./repository.ts";
import type { IdentityApp, IdentityDependencies } from "./routes.ts";

/** The evidence of a change made from the space (0119: codes only, never an address). */
const CONSENT_EVIDENCE = { form: "account_preferences" } as const;

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
  // (advertiser); one lead.updated per change, in the transaction of the change.
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
            const issue = updateRefusalOf(error);
            if (issue === null) {
              throw error;
            }
            throw new RequestValidationError([issue]);
          }
          return meOf(tx, context);
        },
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
}

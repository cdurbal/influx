// Contract of the member's own account, "mon compte" (docs/mvp/05 RG15, RG28, RG34, RG35, RG56,
// RG71, RG92 to RG95, RG143; 17 §6.1, §6.2, §6.4, §6.7; 21 §5.2, J7 commit 6). Shared by apps/api
// and apps/web. The account is always the one of the session: no route takes an account id, and a
// session id is only ever one of the member's own (18 T14).
// Nothing here carries an amount, a rate or a commission (05 RG9).
import * as z from "zod";
import { signupDoorSchema, uiLocaleSchema } from "./auth.ts";
import {
  companyNameSchema,
  countryCodeSchema,
  declaredStatusSchema,
} from "./signup.ts";
import { userAgentSummarySchema } from "./user-agent.ts";

/**
 * The terms of service in force that the member has not accepted yet (05 RG28, CA70): while it is
 * set, every member route outside the exempted ones answers 403 terms_acceptance_required, and
 * the space shows the blocking re-acceptance screen (17 §6.7). The text is read from
 * GET /v1/terms/current in `locale`.
 */
export const termsToAcceptSchema = z.strictObject({
  versionId: z.uuid(),
  versionLabel: z.string().min(1).max(40),
  locale: uiLocaleSchema,
  effectiveFrom: z.iso.datetime(),
});
export type TermsToAccept = z.infer<typeof termsToAcceptSchema>;

/**
 * GET /v1/me and the answer of PATCH /v1/me: "mes informations" (17 §6.1). `declaredStatus` is
 * always `business` for an advertiser (RG22); `companyName` is null for a creator.
 */
export const meResponseSchema = z.strictObject({
  email: z.email(),
  role: signupDoorSchema,
  preferredLanguage: uiLocaleSchema,
  countryCode: countryCodeSchema,
  declaredStatus: declaredStatusSchema,
  companyName: z.string().nullable(),
  termsToAccept: termsToAcceptSchema.nullable(),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

/**
 * PATCH /v1/me (05 RG15, RG73; 17 §6.1): the fields to change, at least one. A creator sends no
 * company name; an advertiser sends no declared status (RG22): refused field by field (400). The
 * address is a separate journey (RG58, POST /v1/me/email-change, commit 7).
 */
export const updateMeBodySchema = z
  .strictObject({
    countryCode: countryCodeSchema.optional(),
    preferredLanguage: uiLocaleSchema.optional(),
    declaredStatus: declaredStatusSchema.optional(),
    companyName: companyNameSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "empty" });
export type UpdateMeBody = z.infer<typeof updateMeBodySchema>;

/** Where a consent value comes from (identity.consent_source, 0005); shown in clear (RG95). */
export const CONSENT_SOURCES = [
  "signup_form",
  "account_settings",
  "brevo_webhook",
  "apollo_optout",
  "backoffice",
  "data_request",
] as const;
export const consentSourceSchema = z.enum(CONSENT_SOURCES);
export type ConsentSource = z.infer<typeof consentSourceSchema>;

/**
 * GET /v1/me/consent (05 RG95; 17 §6.2): one checkbox at sign-up, two purposes (RG33), one value
 * shown: granted only when both purposes are; otherwise withdrawn, with the date and the origin of
 * the latest withdrawal. `occurredAt` and `source` are null only for an account without any event.
 */
export const consentResponseSchema = z.strictObject({
  granted: z.boolean(),
  occurredAt: z.iso.datetime().nullable(),
  source: consentSourceSchema.nullable(),
});
export type ConsentResponse = z.infer<typeof consentResponseSchema>;

/**
 * PUT /v1/me/consent (05 RG34, RG92, RG94): one gesture, no justification; effective at once in
 * INFLUX, propagated after (consent.revoked, priority 0). Never touches the account, a session nor
 * the transactional e-mails (RG35, CA36).
 */
export const updateConsentBodySchema = z.strictObject({
  granted: z.boolean(),
});
export type UpdateConsentBody = z.infer<typeof updateConsentBodySchema>;

/** The value now in force, and whether this request changed it (false: already the asked one). */
export const updateConsentResponseSchema = consentResponseSchema.extend({
  changed: z.boolean(),
});
export type UpdateConsentResponse = z.infer<typeof updateConsentResponseSchema>;

/**
 * One open session of the member (05 RG56, RG143): no country column, the browser by its summary
 * only (EC-43); `current` marks "cet appareil".
 */
export const memberSessionSchema = z.strictObject({
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  lastActivityAt: z.iso.datetime(),
  browser: userAgentSummarySchema,
  current: z.boolean(),
});
export type MemberSession = z.infer<typeof memberSessionSchema>;

/** GET /v1/me/sessions: the open sessions, the most recent activity first. */
export const sessionsResponseSchema = z.strictObject({
  sessions: z.array(memberSessionSchema),
});
export type SessionsResponse = z.infer<typeof sessionsResponseSchema>;

/** DELETE /v1/me/sessions/:id. Unknown, closed or another member's: the same 404 (18 T14). */
export const sessionParamsSchema = z.strictObject({
  id: z.uuid(),
});
export type SessionParams = z.infer<typeof sessionParamsSchema>;

/** `signedOut`: the session closed was the one of this request; its cookie is cleared. */
export const revokeSessionResponseSchema = z.strictObject({
  outcome: z.literal("revoked"),
  signedOut: z.boolean(),
});
export type RevokeSessionResponse = z.infer<typeof revokeSessionResponseSchema>;

/** DELETE /v1/me/sessions: "fermer toutes les sessions", this one included (17 §6.4, CA33). */
export const revokeAllSessionsResponseSchema = z.strictObject({
  outcome: z.literal("revoked"),
  revokedCount: z.number().int().min(1),
  signedOut: z.literal(true),
});
export type RevokeAllSessionsResponse = z.infer<
  typeof revokeAllSessionsResponseSchema
>;

/**
 * POST /v1/me/terms/accept (05 RG28): the version shown, which must still be the one to accept
 * (409 conflict otherwise: the front reads GET /v1/me again). Refusing is signing out
 * (POST /v1/auth/logout): the account and its data stay.
 */
export const acceptTermsBodySchema = z.strictObject({
  termsVersionId: z.uuid(),
});
export type AcceptTermsBody = z.infer<typeof acceptTermsBodySchema>;

export const acceptTermsResponseSchema = z.strictObject({
  outcome: z.literal("accepted"),
});
export type AcceptTermsResponse = z.infer<typeof acceptTermsResponseSchema>;

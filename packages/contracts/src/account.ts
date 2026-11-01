// Contract of the member's own account, "mon compte" (docs/mvp/05 RG15, RG28, RG34, RG35, RG56,
// RG71, RG92 to RG95, RG143; 17 §6.1, §6.2, §6.4, §6.7; 21 §5.2, J7 commit 6), and the actions
// behind a fresh code: re-authentication and change of address (RG57, RG58; J7 commit 7), "mes
// données" (EC-14; 17 §6.3; J7 decision 6, commit 8). Shared by
// apps/api and apps/web. The account is always the one of the session: no route takes an account
// id, and a session id is only ever one of the member's own (18 T14).
// Nothing here carries an amount, a rate or a commission (05 RG9).
import { z } from "./zod.ts";
import {
  LOGIN_CODE_PATTERN,
  MAX_EMAIL_LENGTH,
  normalizeEmail,
  REQUEST_CODE_OUTCOMES,
  RESEND_DELAY_SECONDS,
  signupDoorSchema,
  uiLocaleSchema,
} from "./auth.ts";
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

// --- Re-authentication by a fresh code (05 RG57; 03 A-10; J7 decision 4, commit 7) -----------------

/** The three actions that need a fresh code (05 RG57); a proof serves one of them, once. */
export const REAUTH_PURPOSES = [
  "email_change",
  "data_export",
  "account_deletion",
] as const;
export const reauthPurposeSchema = z.enum(REAUTH_PURPOSES);
export type ReauthPurpose = z.infer<typeof reauthPurposeSchema>;

/** A signed journey token is never longer than this (auth-tokens.ts). */
const REAUTH_TOKEN_MAX_LENGTH = 2_048;

/**
 * POST /v1/me/reauthenticate/request-code: a sign-in code sent to the address of the session (never
 * one from the body), under the ceilings of the sign-in code (RG44).
 */
export const reauthRequestCodeBodySchema = z.strictObject({
  purpose: reauthPurposeSchema,
});
export type ReauthRequestCodeBody = z.infer<typeof reauthRequestCodeBodySchema>;

/**
 * The outcomes of the sign-in code (RG60). When `sent`: the matching phrase (RG128) and the signed
 * journey of this code (RG47), which the verification sends back; held by the page only, so that
 * the code dies with the tab. Never the code itself.
 */
export const reauthRequestCodeResponseSchema = z.strictObject({
  outcome: z.enum(REQUEST_CODE_OUTCOMES),
  retryAfterSeconds: z.literal(RESEND_DELAY_SECONDS),
  matchingPhrase: z.string().min(1).max(64).optional(),
  reauthToken: z.string().min(1).max(REAUTH_TOKEN_MAX_LENGTH).optional(),
});
export type ReauthRequestCodeResponse = z.infer<
  typeof reauthRequestCodeResponseSchema
>;

/** POST /v1/me/reauthenticate/verify-code: the code, for the purpose it was asked for. */
export const reauthVerifyCodeBodySchema = z.strictObject({
  purpose: reauthPurposeSchema,
  code: z.string().regex(LOGIN_CODE_PATTERN),
  reauthToken: z.string().min(1).max(REAUTH_TOKEN_MAX_LENGTH),
});
export type ReauthVerifyCodeBody = z.infer<typeof reauthVerifyCodeBodySchema>;

/**
 * `reauthenticated`: this session may do `purpose` once within `validForSeconds`. The failures are
 * those of the sign-in code (RG136, RG137); `session_lost` is a journey token missing, expired, of
 * another session or of another purpose.
 */
export const reauthVerifyCodeResponseSchema = z.discriminatedUnion("outcome", [
  z.strictObject({
    outcome: z.literal("reauthenticated"),
    purpose: reauthPurposeSchema,
    validForSeconds: z.number().int().positive(),
  }),
  z.strictObject({
    outcome: z.literal("invalid"),
    attemptsLeft: z.number().int().min(1).max(4),
  }),
  z.strictObject({ outcome: z.literal("too_many_attempts") }),
  z.strictObject({ outcome: z.literal("expired") }),
  z.strictObject({ outcome: z.literal("session_lost") }),
  z.strictObject({ outcome: z.literal("too_many_requests") }),
  z.strictObject({ outcome: z.literal("verify_unavailable") }),
]);
export type ReauthVerifyCodeResponse = z.infer<
  typeof reauthVerifyCodeResponseSchema
>;

// --- Change of address (05 RG58; 03 A-11; 17 §6.1; J7 decision 5, commit 7) -----------------------

/** POST /v1/me/email-change, after a fresh code for `email_change` (403 reauthentication_required). */
export const emailChangeBodySchema = z.strictObject({
  newEmail: z
    .string()
    .max(MAX_EMAIL_LENGTH * 2)
    .transform(normalizeEmail)
    .pipe(z.email().max(MAX_EMAIL_LENGTH)),
});
export type EmailChangeBody = z.infer<typeof emailChangeBodySchema>;

/**
 * The open request of the member (17 §6.1: "En attente de confirmation : 1 sur 2 · expire le
 * {date}"). Until both sides are confirmed, the sign-in address stays the old one (CA34).
 */
export const emailChangeRequestSchema = z.strictObject({
  id: z.uuid(),
  newEmail: z.email(),
  expiresAt: z.iso.datetime(),
  oldConfirmed: z.boolean(),
  newConfirmed: z.boolean(),
});
export type EmailChangeRequest = z.infer<typeof emailChangeRequestSchema>;

/** GET /v1/me/email-change: the open request, or none. */
export const emailChangeStateResponseSchema = z.strictObject({
  request: emailChangeRequestSchema.nullable(),
});
export type EmailChangeStateResponse = z.infer<
  typeof emailChangeStateResponseSchema
>;

/** POST /v1/me/email-change: both codes left; the previous open request, if any, is closed. */
export const emailChangeResponseSchema = z.strictObject({
  outcome: z.literal("pending"),
  request: emailChangeRequestSchema,
});
export type EmailChangeResponse = z.infer<typeof emailChangeResponseSchema>;

/** `old`: the code sent to the current address; `new`: the one sent to the requested address. */
export const EMAIL_CHANGE_SIDES = ["old", "new"] as const;
export const emailChangeSideSchema = z.enum(EMAIL_CHANGE_SIDES);
export type EmailChangeSide = z.infer<typeof emailChangeSideSchema>;

/** POST /v1/me/email-change/confirm: one code of one side of the open request. */
export const confirmEmailChangeBodySchema = z.strictObject({
  requestId: z.uuid(),
  side: emailChangeSideSchema,
  code: z.string().regex(LOGIN_CODE_PATTERN),
});
export type ConfirmEmailChangeBody = z.infer<
  typeof confirmEmailChangeBodySchema
>;

/**
 * `confirmed`: this side is done, the other is awaited. `completed`: both sides are done, the
 * address changed. `address_unavailable`: both sides are done but the new address is held (by
 * another account or a GoTrue user, never said which); the request is closed and the old address
 * stays (J7 decision 5 as revised on 2026-10-14: told only once the code of the new address was
 * typed, never at the request). `too_many_attempts` (fifth wrong code of a side) and `expired`
 * (24 hours) close the request. Unknown, closed or another member's: 404.
 */
export const confirmEmailChangeResponseSchema = z.discriminatedUnion(
  "outcome",
  [
    z.strictObject({
      outcome: z.literal("confirmed"),
      request: emailChangeRequestSchema,
    }),
    z.strictObject({ outcome: z.literal("completed") }),
    z.strictObject({ outcome: z.literal("address_unavailable") }),
    z.strictObject({
      outcome: z.literal("invalid"),
      attemptsLeft: z.number().int().min(1).max(4),
    }),
    z.strictObject({ outcome: z.literal("too_many_attempts") }),
    z.strictObject({ outcome: z.literal("expired") }),
  ],
);
export type ConfirmEmailChangeResponse = z.infer<
  typeof confirmEmailChangeResponseSchema
>;

/** DELETE /v1/me/email-change/:id: the holder cancels his open request (same 404 otherwise). */
export const emailChangeParamsSchema = z.strictObject({
  id: z.uuid(),
});
export type EmailChangeParams = z.infer<typeof emailChangeParamsSchema>;

export const cancelEmailChangeResponseSchema = z.strictObject({
  outcome: z.literal("cancelled"),
});
export type CancelEmailChangeResponse = z.infer<
  typeof cancelEmailChangeResponseSchema
>;

// --- "Mes données": export and deletion as REQUESTS (EC-14; 05 RG57; 17 §6.3; J7 decision 6) -------

/**
 * The two rights a member deposits from the space at J7: `access` (export, after a fresh code for
 * `data_export`) and `erasure` (deletion, after a fresh code for `account_deletion`). Nothing is
 * executed automatically: an admin instructs the request by a written procedure (EC-14).
 */
export const DATA_REQUEST_TYPES = ["access", "erasure"] as const;
export const dataRequestTypeSchema = z.enum(DATA_REQUEST_TYPES);
export type DataRequestType = z.infer<typeof dataRequestTypeSchema>;

export const DATA_REQUEST_STATUSES = [
  "received",
  "in_progress",
  "closed",
] as const;

/** The closed list of outcomes of a closed request (15 RG77). */
export const DATA_REQUEST_OUTCOMES = [
  "satisfaite",
  "satisfaite_partiellement",
  "refusee",
  "sans_objet",
  "retiree_par_le_demandeur",
] as const;

export const dataRequestSchema = z.strictObject({
  id: z.uuid(),
  type: dataRequestTypeSchema,
  receivedAt: z.iso.datetime(),
  /** The legal deadline: one month, written as 30 days. */
  dueAt: z.iso.datetime(),
  status: z.enum(DATA_REQUEST_STATUSES),
  completedAt: z.iso.datetime().nullable(),
  outcome: z.enum(DATA_REQUEST_OUTCOMES).nullable(),
});
export type DataRequest = z.infer<typeof dataRequestSchema>;

/** GET /v1/me/data-requests: the member's own requests, the most recent first. */
export const dataRequestsResponseSchema = z.strictObject({
  requests: z.array(dataRequestSchema),
});
export type DataRequestsResponse = z.infer<typeof dataRequestsResponseSchema>;

/** POST /v1/me/data-requests (403 reauthentication_required without the fresh code). */
export const dataRequestBodySchema = z.strictObject({
  type: dataRequestTypeSchema,
});
export type DataRequestBody = z.infer<typeof dataRequestBodySchema>;

/**
 * `received`: deposited now, the acknowledgement leaves by e-mail. `already_open`: a request of
 * this type is still open; it is returned, nothing else is written or sent (the fresh code is
 * consumed all the same). `erasure_authorised` (D72): an erasure the member has just authorised
 * with the fresh code, or still open; every session is closed, the front treats it as a sign-out
 * and the account is erased at the next turn of the worker. It carries the request's id and
 * status only.
 */
export const dataRequestResponseSchema = z.discriminatedUnion("outcome", [
  z.strictObject({
    outcome: z.enum(["received", "already_open"]),
    request: dataRequestSchema,
  }),
  z.strictObject({
    outcome: z.literal("erasure_authorised"),
    requestId: z.uuid(),
    status: z.enum(DATA_REQUEST_STATUSES),
  }),
]);
export type DataRequestResponse = z.infer<typeof dataRequestResponseSchema>;

// --- "Mes données": the export, downloaded in the space (J8 commit 8; runbook demandes-rgpd §4) ----

/** Runbook §4 (expert-cybersecurite, 2026-10-14): 3 downloads at most, for 7 days at most. */
export const DATA_EXPORT_MAX_DOWNLOADS = 3;
export const DATA_EXPORT_VALIDITY_DAYS = 7;

export const dataExportIdParamsSchema = z.strictObject({ id: z.uuid() });
export type DataExportIdParams = z.infer<typeof dataExportIdParamsSchema>;

/**
 * GET /v1/me/data-export: the member's latest export, published by an admin (15 RG75 step 6), or
 * null. `available` is false once expired, purged or downloaded three times.
 */
export const dataExportStateResponseSchema = z.strictObject({
  export: z
    .strictObject({
      id: z.uuid(),
      requestId: z.uuid(),
      publishedAt: z.iso.datetime(),
      expiresAt: z.iso.datetime(),
      downloadsLeft: z.number().int().min(0).max(DATA_EXPORT_MAX_DOWNLOADS),
      available: z.boolean(),
    })
    .nullable(),
});
export type DataExportStateResponse = z.infer<
  typeof dataExportStateResponseSchema
>;

/**
 * POST /v1/me/data-export/:id/download, after a fresh code for `data_export` consumed by THIS
 * download (403 reauthentication_required without it; 410 export_unavailable once expired, purged
 * or downloaded three times). `content` is the file exactly as the database produced it (JSON,
 * UTF-8): the screen saves these characters as they are, and `sha256` is the digest the register
 * holds for them.
 */
export const dataExportDownloadResponseSchema = z.strictObject({
  export: z.strictObject({
    id: z.uuid(),
    fileName: z.string().regex(/^influx-data-export-\d{4}-\d{2}-\d{2}\.json$/),
    content: z.string().min(2),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    sizeBytes: z.number().int().positive(),
    downloadsLeft: z.number().int().min(0).max(DATA_EXPORT_MAX_DOWNLOADS),
  }),
});
export type DataExportDownloadResponse = z.infer<
  typeof dataExportDownloadResponseSchema
>;

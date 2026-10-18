// Contracts of the backoffice authentication routes (docs/mvp/03 §6.1 B-1 to B-8, §6.9 MFA-1 to
// MFA-10; 17b §3.14; 21 §4, J3 commit 10, EC-40, EC-47, EC-56, EC-57, G-1). Shared by apps/api and
// apps/backoffice.
//
// One failure answer whatever the step at fault — address, password, code, ceiling, account not
// activated or a member account (17b §3.14 rule 2). `unavailable` only when no identifier was
// verified yet (rule 5). The password is never kept between two requests (rule 3).
import * as z from "zod";
import { MAX_EMAIL_LENGTH, normalizeEmail, uiLocaleSchema } from "./auth.ts";
import { countryCodeSchema } from "./signup.ts";

/** Longest password text accepted by the schemas; the 72-byte bound is checked by apps/api (EC-57). */
export const MAX_PASSWORD_INPUT_LENGTH = 1_024;

/** Six digits of an authenticator application. */
export const TOTP_CODE_PATTERN = /^\d{6}$/;

const emailSchema = z
  .string()
  .max(MAX_EMAIL_LENGTH * 2)
  .transform(normalizeEmail)
  .pipe(z.email().max(MAX_EMAIL_LENGTH));

const passwordSchema = z.string().min(1).max(MAX_PASSWORD_INPUT_LENGTH);

const totpCodeSchema = z.string().regex(TOTP_CODE_PATTERN);

/** A recovery code as typed: 16 characters, with spaces or dashes allowed (17b §3.14.a). */
const recoveryCodeInputSchema = z.string().min(1).max(64);

/** The enrollment token of the invitation (G-1 point 2): 32 random bytes in base64url. */
const enrollmentTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const INTERNAL_ROLES = ["agent", "admin"] as const;
export const internalRoleSchema = z.enum(INTERNAL_ROLES);
export type InternalRole = z.infer<typeof internalRoleSchema>;

// ---------------------------------------------------------------------------------------------
// POST /v1/bo/auth/login — one request: address, password, and a TOTP code or a recovery code
// ---------------------------------------------------------------------------------------------

export const backofficeLoginBodySchema = z.union([
  z.strictObject({
    email: emailSchema,
    password: passwordSchema,
    totpCode: totpCodeSchema,
  }),
  z.strictObject({
    email: emailSchema,
    password: passwordSchema,
    recoveryCode: recoveryCodeInputSchema,
  }),
]);
export type BackofficeLoginBody = z.infer<typeof backofficeLoginBodySchema>;

const refusedSchema = z.strictObject({ outcome: z.literal("refused") });
const unavailableSchema = z.strictObject({ outcome: z.literal("unavailable") });

// A plain union: two answers share the outcome `signed_in`, told apart by `mfaMethod`.
export const backofficeLoginResponseSchema = z.union([
  z.strictObject({
    outcome: z.literal("signed_in"),
    role: internalRoleSchema,
    mfaMethod: z.literal("totp"),
  }),
  // A session opened by a recovery code: the banner of 17b §3.14.a, with the codes left.
  z.strictObject({
    outcome: z.literal("signed_in"),
    role: internalRoleSchema,
    mfaMethod: z.literal("recovery_code"),
    recoveryCodesLeft: z.number().int().min(0).max(9),
  }),
  refusedSchema,
  unavailableSchema,
]);
export type BackofficeLoginResponse = z.infer<
  typeof backofficeLoginResponseSchema
>;

// ---------------------------------------------------------------------------------------------
// POST /v1/bo/auth/enroll — first request: the factor is created, no session (EC-40, EC-56)
// ---------------------------------------------------------------------------------------------

export const backofficeEnrollBodySchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  enrollmentToken: enrollmentTokenSchema,
});
export type BackofficeEnrollBody = z.infer<typeof backofficeEnrollBodySchema>;

/** The enrollment token is unknown, used or expired: its own message, nothing about credentials. */
const invitationInvalidSchema = z.strictObject({
  outcome: z.literal("invitation_invalid"),
});

export const backofficeEnrollResponseSchema = z.discriminatedUnion("outcome", [
  z.strictObject({
    outcome: z.literal("factor_created"),
    /**
     * The SVG text of the QR code, shown through a blob: URL (J3-C rule 5). GoTrue draws one path
     * per module: about 280 KB observed on the local stack, hence a bound of 512 KiB, under the
     * 1 MiB of the relay (03 PP-9).
     */
    qrCodeSvg: z.string().min(1).max(524_288),
    /** The base32 secret, for a manual entry. */
    secret: z.string().regex(/^[A-Z2-7]+=*$/),
    /** The otpauth:// URI. */
    uri: z.string().startsWith("otpauth://totp/"),
  }),
  invitationInvalidSchema,
  refusedSchema,
  unavailableSchema,
]);
export type BackofficeEnrollResponse = z.infer<
  typeof backofficeEnrollResponseSchema
>;

// ---------------------------------------------------------------------------------------------
// POST /v1/bo/auth/invitation/accept — the activation link of an internal invitation (15 RG99,
// B-8; 17b §3.14.b; J8 commit 7): the person chooses a password (B-1, HIBP), the account is created
// with the INVITED address, then the factor is created as by /enroll, in the same request; the
// second step is /enroll/confirm with the same token. A link whose account already exists goes
// straight to the factor (a retry after a failure of the factor).
// ---------------------------------------------------------------------------------------------

export const backofficeInvitationAcceptBodySchema = z.strictObject({
  invitationToken: enrollmentTokenSchema,
  email: emailSchema,
  password: passwordSchema,
  /** The first name shown to colleagues (agent profile, 0131: 1 to 80 printable characters). */
  firstName: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[^\p{Cc}]*$/u),
  countryCode: countryCodeSchema,
  preferredLanguage: uiLocaleSchema,
});
export type BackofficeInvitationAcceptBody = z.infer<
  typeof backofficeInvitationAcceptBodySchema
>;

/** 17b §3.14.d: one message per refusal of a chosen password. */
export const NEW_PASSWORD_REFUSALS = [
  "too_short",
  "too_long",
  "context",
  "compromised",
  "check_unavailable",
] as const;

export const backofficeInvitationAcceptResponseSchema = z.discriminatedUnion(
  "outcome",
  [
    ...backofficeEnrollResponseSchema.options,
    z.strictObject({
      outcome: z.literal("password_refused"),
      reason: z.enum(NEW_PASSWORD_REFUSALS),
    }),
  ],
);
export type BackofficeInvitationAcceptResponse = z.infer<
  typeof backofficeInvitationAcceptResponseSchema
>;

// ---------------------------------------------------------------------------------------------
// POST /v1/bo/auth/enroll/confirm — second request: password typed again, the first code, the
// session in aal2 and the ten recovery codes shown once (EC-17, MFA-3)
// ---------------------------------------------------------------------------------------------

export const backofficeEnrollConfirmBodySchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  enrollmentToken: enrollmentTokenSchema,
  code: totpCodeSchema,
});
export type BackofficeEnrollConfirmBody = z.infer<
  typeof backofficeEnrollConfirmBodySchema
>;

/** XXXX-XXXX-XXXX-XXXX, Crockford base32 (J3-C rule 9). */
export const RECOVERY_CODE_DISPLAY_PATTERN =
  /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

export const backofficeEnrollConfirmResponseSchema = z.discriminatedUnion(
  "outcome",
  [
    z.strictObject({
      outcome: z.literal("signed_in"),
      role: internalRoleSchema,
      recoveryCodes: z
        .array(z.string().regex(RECOVERY_CODE_DISPLAY_PATTERN))
        .length(10),
    }),
    invitationInvalidSchema,
    refusedSchema,
    unavailableSchema,
  ],
);
export type BackofficeEnrollConfirmResponse = z.infer<
  typeof backofficeEnrollConfirmResponseSchema
>;

// ---------------------------------------------------------------------------------------------
// POST /v1/bo/auth/reauthenticate — R: password and TOTP code, never a recovery code (B-5, EC-40)
// ---------------------------------------------------------------------------------------------

export const backofficeReauthenticateBodySchema = z.strictObject({
  password: passwordSchema,
  code: totpCodeSchema,
});
export type BackofficeReauthenticateBody = z.infer<
  typeof backofficeReauthenticateBodySchema
>;

export const backofficeReauthenticateResponseSchema = z.discriminatedUnion(
  "outcome",
  [
    z.strictObject({ outcome: z.literal("confirmed") }),
    // The session was opened by a recovery code: R is never available in it (EC-17 point 4).
    z.strictObject({ outcome: z.literal("recovery_session") }),
    // Fifth failure in 15 minutes: the session is revoked (EC-40 point 5).
    z.strictObject({ outcome: z.literal("session_revoked") }),
    refusedSchema,
    unavailableSchema,
  ],
);
export type BackofficeReauthenticateResponse = z.infer<
  typeof backofficeReauthenticateResponseSchema
>;

// ---------------------------------------------------------------------------------------------
// POST /v1/bo/auth/logout and GET /v1/bo/me
// ---------------------------------------------------------------------------------------------

export const backofficeLogoutResponseSchema = z.strictObject({
  outcome: z.literal("signed_out"),
});

/**
 * J3S-6: the second factor that opened THIS session, read from the database at every call (the
 * banner of 17b §3.14.a never trusts the address bar).
 */
export const backofficeSecondFactorSchema = z.discriminatedUnion("method", [
  z.strictObject({ method: z.literal("totp") }),
  z.strictObject({
    method: z.literal("recovery_code"),
    recoveryCodesLeft: z.number().int().min(0).max(9),
  }),
]);
export type BackofficeSecondFactor = z.infer<
  typeof backofficeSecondFactorSchema
>;

/**
 * 16 RG118 (D70): the environment of the backoffice and its sending mode, for the permanent banner
 * of every non-production backoffice, written in words, never a color alone.
 */
export const backofficeEnvironmentSchema = z.strictObject({
  name: z.enum(["development", "staging", "production"]),
  brevoMode: z.enum(["disabled", "redirect", "live"]),
});
export type BackofficeEnvironment = z.infer<typeof backofficeEnvironmentSchema>;

export const backofficeMeResponseSchema = z.strictObject({
  email: z.email(),
  role: internalRoleSchema,
  secondFactor: backofficeSecondFactorSchema,
  /**
   * 15 RG107, CA71: false while there are not two distinct active admins (account and profile
   * active, a pinned factor, not the break-glass account): the permanent banner of the degraded
   * dual control. Read at every call (03 PD7: no flag, no setting).
   */
  peerControlAvailable: z.boolean(),
  environment: backofficeEnvironmentSchema,
});
export type BackofficeMeResponse = z.infer<typeof backofficeMeResponseSchema>;

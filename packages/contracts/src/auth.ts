// Contracts of the member authentication routes (docs/mvp/02 §18.10; 05 RG39 to RG69, RG128 to
// RG140; 21 §4, J3). Shared by apps/api and apps/web.
//
// What never appears in a response: the code, the provider's message id, the journal line, the
// existence, role, state or history of an account BEFORE a successful verification (02 §18.10,
// 05 RG46, RG138).
import * as z from "zod";

/** Languages of the pages, and of the matching phrase (05 RG129). */
export const UI_LOCALES = ["fr", "en"] as const;
export const uiLocaleSchema = z.enum(UI_LOCALES);
export type UiLocale = z.infer<typeof uiLocaleSchema>;

/** Door through which the person came (05 RG3): a default for screen 3, never a role. */
export const SIGNUP_DOORS = ["advertiser", "creator"] as const;
export const signupDoorSchema = z.enum(SIGNUP_DOORS);
export type SignupDoor = z.infer<typeof signupDoorSchema>;

/** Longest address accepted: 254 characters (RFC 5321 path limit), same bound as the tokens. */
export const MAX_EMAIL_LENGTH = 254;

/**
 * 02 §18.10 step 2: lower case and surrounding spaces removed, nothing else (removing dots or
 * sub-addresses would merge distinct addresses).
 */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export const requestCodeBodySchema = z.strictObject({
  email: z
    .string()
    .max(MAX_EMAIL_LENGTH * 2)
    .transform(normalizeEmail)
    .pipe(z.email().max(MAX_EMAIL_LENGTH)),
  /** Language of the page where the request is made (05 RG49, RG129). */
  locale: uiLocaleSchema,
});
export type RequestCodeBody = z.infer<typeof requestCodeBodySchema>;

/** 05 RG60: success, or one of the three causes, and nothing else. */
export const REQUEST_CODE_OUTCOMES = [
  "sent",
  "undeliverable",
  "provider_unavailable",
  "rate_limited",
] as const;
export type RequestCodeOutcome = (typeof REQUEST_CODE_OUTCOMES)[number];

/** Seconds before a new code may be asked for (05 RG50). */
export const RESEND_DELAY_SECONDS = 60;

export const requestCodeResponseSchema = z.strictObject({
  outcome: z.enum(REQUEST_CODE_OUTCOMES),
  retryAfterSeconds: z.literal(RESEND_DELAY_SECONDS),
  /** Only when `sent` (02 §18.10). */
  matchingPhrase: z.string().min(1).max(64).optional(),
});
export type RequestCodeResponse = z.infer<typeof requestCodeResponseSchema>;

/** Six digits, nothing else (05 RG39). */
export const LOGIN_CODE_PATTERN = /^\d{6}$/;

export const verifyCodeBodySchema = z.strictObject({
  code: z.string().regex(LOGIN_CODE_PATTERN),
  door: signupDoorSchema,
});
export type VerifyCodeBody = z.infer<typeof verifyCodeBodySchema>;

/**
 * Outcomes of a verification (05 RG136 to RG140). Before a successful verification, the outcome
 * depends on the code, the journey and the network, never on the account (RG138).
 */
export const verifyCodeResponseSchema = z.discriminatedUnion("outcome", [
  // A member session is open (RG66, RG67): the front routes to the space of the real role.
  z.strictObject({
    outcome: z.literal("signed_in"),
    role: signupDoorSchema,
    /** The account's role differs from the door (RG67): a message explains it. */
    roleMismatch: z.boolean(),
  }),
  // No account for this address: the sign-up token is set (EC-4); at J3, RG139.
  z.strictObject({ outcome: z.literal("signup_required") }),
  // An internal account: no member session (RG68, RG140).
  z.strictObject({ outcome: z.literal("internal_account") }),
  // A suspended (or closed) account: no session (RG69).
  z.strictObject({ outcome: z.literal("account_unavailable") }),
  // Wrong code: failures 1 to 4 (RG137).
  z.strictObject({
    outcome: z.literal("invalid"),
    attemptsLeft: z.number().int().min(1).max(4),
  }),
  // Fifth failure: the code is invalidated (RG42, RG137).
  z.strictObject({ outcome: z.literal("too_many_attempts") }),
  // Ten minutes after the request, whatever the code (RG136).
  z.strictObject({ outcome: z.literal("expired") }),
  // No journey in this browser, or a journey older than fifteen minutes (RG47, RG136).
  z.strictObject({ outcome: z.literal("session_lost") }),
  // Ceiling of the network (RG44, EC-3 point 5).
  z.strictObject({ outcome: z.literal("too_many_requests") }),
  // GoTrue did not answer (auth.code.errors.verifyUnavailable).
  z.strictObject({ outcome: z.literal("verify_unavailable") }),
]);
export type VerifyCodeResponse = z.infer<typeof verifyCodeResponseSchema>;

export const logoutResponseSchema = z.strictObject({
  outcome: z.literal("signed_out"),
});

/** GET /v1/me, minimal at J3: who is signed in, in which language. */
export const meResponseSchema = z.strictObject({
  email: z.email(),
  role: signupDoorSchema,
  preferredLanguage: z.string().length(2),
});
export type MeResponse = z.infer<typeof meResponseSchema>;

/**
 * GET /v1/auth/journey (D66; 05 RG111): where a reloaded journey resumes, read from the signed
 * httpOnly journey cookies only. `code`: a code was sent (login token); `details`: the address is
 * verified and has no account (sign-up token). The door is never returned: it comes from the URL.
 */
export const journeyResponseSchema = z.discriminatedUnion("step", [
  z.strictObject({ step: z.literal("none") }),
  z.strictObject({
    step: z.literal("code"),
    email: z.email().max(MAX_EMAIL_LENGTH),
    matchingPhrase: z.string().min(1).max(64),
    /** Seconds left before a new code may be asked for (05 RG50); 0 when it may be now. */
    retryAfterSeconds: z.number().int().min(0).max(RESEND_DELAY_SECONDS),
  }),
  z.strictObject({
    step: z.literal("details"),
    email: z.email().max(MAX_EMAIL_LENGTH),
  }),
]);
export type JourneyResponse = z.infer<typeof journeyResponseSchema>;

/** POST /v1/auth/journey/reset (D66): both journey cookies cleared ("change address"). */
export const journeyResetResponseSchema = z.strictObject({
  outcome: z.literal("reset"),
});
export type JourneyResetResponse = z.infer<typeof journeyResetResponseSchema>;

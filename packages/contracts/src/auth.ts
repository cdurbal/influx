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

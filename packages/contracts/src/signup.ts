// Contract of POST /v1/signup, screen 3 of the sign-up (docs/mvp/05 §A to §E, RG120, D63, D55;
// 17 §3; 21 §5.2, J5 commit 4). Shared by apps/api and apps/web: the server validates with exactly
// the rules of the browser (05 RG10).
//
// - Two variants, discriminated by `role`, never merged (05 RG1): an advertiser sends a company
//   name and no declared status nor adult attestation (RG22); a creator sends a declared status and
//   the adult attestation (RG18, RG19), no company name. Any other field is refused (strict).
// - The address and the identity of the person are NEVER in the body: they come from the signed
//   sign-up token, issued after the verification of the code (21 EC-4).
// - Nothing here carries an amount, a rate or a commission (05 RG9).
import * as z from "zod";
import { signupDoorSchema, uiLocaleSchema } from "./auth.ts";
import { ISO_COUNTRY_CODES } from "./countries.ts";

/** 05 RG17, RG18: `particulier` or `professionnel`, none preselected. */
export const DECLARED_STATUSES = ["individual", "business"] as const;
export const declaredStatusSchema = z.enum(DECLARED_STATUSES);
export type DeclaredStatus = z.infer<typeof declaredStatusSchema>;

/** 05 RG120: the closed list of "How did you hear about INFLUX?" (identity.heard_from, 0104). */
export const HEARD_FROM_ANSWERS = [
  "online_search",
  "social_media",
  "word_of_mouth",
  "influx_salesperson",
  "event",
  "other",
] as const;
export const heardFromSchema = z.enum(HEARD_FROM_ANSWERS);
export type HeardFrom = z.infer<typeof heardFromSchema>;

/**
 * Translation key of the consent wording, one per door (05 RG31; RG4: an agreement given under
 * one wording is not valid under another). The front shows the text of this key and sends back
 * the exact text it showed (RG32).
 */
export const CONSENT_WORDING_KEYS = {
  advertiser: "signup.consent.advertiser.label",
  creator: "signup.consent.creator.label",
} as const;

/** 05 RG11: company name, 120 characters at most, at least 2 outside spaces. */
export const COMPANY_NAME_MAX_LENGTH = 120;
export const COMPANY_NAME_MIN_LENGTH = 2;

/** Bound of the consent wording stored as proof (identity.provision_account, 0106). */
export const CONSENT_WORDING_MAX_LENGTH = 1_500;

/** Format of a stored UTM value (identity.accounts, accounts_signup_utm_format, 0104). */
export const UTM_VALUE_PATTERN = /^[a-z0-9][a-z0-9._~+-]{0,99}$/;

/** Host name only, IDN in punycode (accounts_signup_referrer_domain_format, 0104). */
export const REFERRER_DOMAIN_PATTERN =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
const REFERRER_DOMAIN_MAX_LENGTH = 253;

/** Raw bounds of the acquisition values, before normalisation: beyond, the request is refused. */
const UTM_RAW_MAX_LENGTH = 256;
const REFERRER_RAW_MAX_LENGTH = 300;

/** Control characters (C0, DEL, C1): refused in every stored text, as the database does. */
const CONTROL_CHARACTER = /\p{Cc}/u;

/** Number of characters as Postgres counts them (code points), not UTF-16 units. */
function characterCount(value: string): number {
  return [...value].length;
}

/**
 * EC-11, 05 RG120: a UTM value is lower-cased, trimmed, its inner spaces replaced by `-`. A value
 * that still does not fit the stored format is DROPPED (null), never a reason to refuse a sign-up:
 * it comes from a link, not from the person, and no free text may reach Brevo (RG122).
 */
export function normalizeUtmValue(raw: string): string | null {
  const value = raw.trim().toLowerCase().replace(/\s+/g, "-");
  return UTM_VALUE_PATTERN.test(value) ? value : null;
}

/**
 * 05 RG120: the domain of the site of origin, never the full address. Lower-cased, trailing dot
 * removed; anything that is not a bare host name (a URL, a path, an IP literal) is dropped.
 */
export function normalizeReferrerDomain(raw: string): string | null {
  const value = raw.trim().toLowerCase().replace(/\.$/, "");
  return value.length <= REFERRER_DOMAIN_MAX_LENGTH &&
    REFERRER_DOMAIN_PATTERN.test(value)
    ? value
    : null;
}

/** Source of acquisition (05 RG120, D55): every field optional, recorded once, never changed. */
export const acquisitionSchema = z.strictObject({
  utmSource: z
    .string()
    .max(UTM_RAW_MAX_LENGTH)
    .transform(normalizeUtmValue)
    .optional(),
  utmMedium: z
    .string()
    .max(UTM_RAW_MAX_LENGTH)
    .transform(normalizeUtmValue)
    .optional(),
  utmCampaign: z
    .string()
    .max(UTM_RAW_MAX_LENGTH)
    .transform(normalizeUtmValue)
    .optional(),
  referrerDomain: z
    .string()
    .max(REFERRER_RAW_MAX_LENGTH)
    .transform(normalizeReferrerDomain)
    .optional(),
  /** The answer of the optional question of screen 3. */
  heardFrom: heardFromSchema.optional(),
});
export type Acquisition = z.infer<typeof acquisitionSchema>;

export const countryCodeSchema = z.enum(ISO_COUNTRY_CODES);

/** 05 RG11, RG13: kept as typed (case and spaces included), checked like the database does. */
export const companyNameSchema = z
  .string()
  .max(COMPANY_NAME_MAX_LENGTH * 4)
  .refine((value) => characterCount(value) <= COMPANY_NAME_MAX_LENGTH, {
    message: "too_long",
  })
  .refine((value) => value.trim().length >= COMPANY_NAME_MIN_LENGTH, {
    message: "required",
  })
  .refine((value) => !CONTROL_CHARACTER.test(value), {
    message: "control_character",
  });

/** The exact consent wording presented (05 RG32), copied as proof: one line, bounded. */
const consentWordingSchema = z
  .string()
  .min(1)
  .max(CONSENT_WORDING_MAX_LENGTH)
  .refine((value) => !CONTROL_CHARACTER.test(value), {
    message: "control_character",
  });

/** The fields of both doors, in the order of screen 3 where they are shown (05 RG11, RG17). */
const commonFields = {
  /** Country of the company (advertiser) or of residence (creator), ISO 3166-1 (05 RG8, RG14). */
  countryCode: countryCodeSchema,
  /** Language of the e-mails and of the interface after sign-in (05 RG15). */
  preferredLanguage: uiLocaleSchema,
  /** The `id` of GET /v1/terms/current?document=terms_of_service (05 RG24, RG25). */
  termsVersionId: z.uuid(),
  /** The checkbox of the terms, never pre-checked, never merged with the consent (RG23). */
  termsAccepted: z.literal(true),
  /**
   * The consent checkbox (D63, RG124): required unless the setting `signup_consent_required` says
   * otherwise, which only the database knows. A boolean here, refused in the database when false.
   */
  marketingConsent: z.boolean(),
  consentWording: consentWordingSchema,
  /** Language of the page where the wording was shown (05 RG32). */
  displayLocale: uiLocaleSchema,
  acquisition: acquisitionSchema.optional(),
};

export const advertiserSignupBodySchema = z.strictObject({
  role: z.literal("advertiser"),
  companyName: companyNameSchema,
  ...commonFields,
  consentWordingKey: z.literal(CONSENT_WORDING_KEYS.advertiser),
});

export const creatorSignupBodySchema = z.strictObject({
  role: z.literal("creator"),
  ...commonFields,
  declaredStatus: declaredStatusSchema,
  /** Of legal age in the declared country of residence (05 RG19, D15): checked, never implied. */
  adultAttested: z.literal(true),
  consentWordingKey: z.literal(CONSENT_WORDING_KEYS.creator),
});

export const signupBodySchema = z.discriminatedUnion("role", [
  advertiserSignupBodySchema,
  creatorSignupBodySchema,
]);
export type SignupBody = z.infer<typeof signupBodySchema>;
export type SignupBodyInput = z.input<typeof signupBodySchema>;

/**
 * Outcomes of POST /v1/signup, all answered with 200 so that the front can tell them apart (its
 * relay client reads 200 and 401 only). A missing, forged or expired sign-up token is a 401
 * `unauthenticated` (the journey starts again from the address); a body outside this contract is a
 * 400 `validation_failed`.
 */
export const signupResponseSchema = z.discriminatedUnion("outcome", [
  // The account exists (created now, or by a first submission, RG110) and a member session is
  // open: the front routes to the home of `role`, the account's real role (05 RG66, RG71).
  z.strictObject({ outcome: z.literal("signed_up"), role: signupDoorSchema }),
  // 05 RG8, CA67: neutral message `signup.errors.countryBlocked`, no account, journalled.
  z.strictObject({ outcome: z.literal("country_blocked") }),
  // The terms version sent is not the one in force any more (or never was): the front reloads
  // the terms panel and asks for the acceptance again (05 RG25, RG29). Nothing is created.
  z.strictObject({ outcome: z.literal("terms_outdated") }),
  // No terms of service in force, in the page language nor in English: nobody can sign up
  // (05 RG29). The front shows `signup.errors.unavailable`.
  z.strictObject({ outcome: z.literal("terms_not_published") }),
  // The address of the token is held by another account (05 RG69 wording, `auth.suspended.notice`),
  // or the account of a first submission is not usable. No session.
  z.strictObject({ outcome: z.literal("account_unavailable") }),
]);
export type SignupResponse = z.infer<typeof signupResponseSchema>;

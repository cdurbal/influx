// Contract of the brand profile, "mon profil" (docs/mvp/06 RG2, RG5, RG14, RG15, RG17, RG27, RG35,
// RG57 to RG61, CA1 to CA7; jalons/l2b, commit 07): read, autosave, submit. Shared by apps/api and
// apps/web. The account is always the one of the session: no route takes an account id (18 T14).
// The request schemas are the ones the browser validates with (RG14); the API validates the same
// ones, then the database arbitrates (closed lists by foreign key, caps by constraint, 0202).
// The response lists its fields one by one: nothing of another account, no creator-facing field,
// no amount, rate, net or price (CLAUDE.md §2, D48, D78). The e-mail, phone and contact page of the
// contact person are returned to their OWNER only (internal layer, RG35, D46).
import { z } from "./zod.ts";
import { uiLocaleSchema } from "./auth.ts";
import { companyNameSchema, countryCodeSchema } from "./signup.ts";

/** The five states of a brand profile (06 RG3, 0203). The member writes none of them but by submitting. */
export const BRAND_PROFILE_STATUSES = [
  "draft",
  "pending_review",
  "published",
  "rejected",
  "suspended",
] as const;
export const brandProfileStatusSchema = z.enum(BRAND_PROFILE_STATUSES);
export type BrandProfileStatus = z.infer<typeof brandProfileStatusSchema>;

/** Bands of company size, never a headcount (06 RG15, RG22, CA5; 0202). */
export const COMPANY_SIZE_BANDS = [
  "1_10",
  "11_50",
  "51_250",
  "251_1000",
  "1001_plus",
] as const;
export const companySizeBandSchema = z.enum(COMPANY_SIZE_BANDS);

/** Exclusivity usually asked (06 RG27; 0202). */
export const EXCLUSIVITY_BANDS = [
  "none",
  "le_1m",
  "le_3m",
  "negotiable",
] as const;
export const exclusivityBandSchema = z.enum(EXCLUSIVITY_BANDS);

/** Rhythm of collaboration (06 RG27; 0202). */
export const COLLABORATION_RHYTHMS = [
  "one_off",
  "recurring",
  "ambassador",
] as const;
export const collaborationRhythmSchema = z.enum(COLLABORATION_RHYTHMS);

/** Role of the contact person, the only public part of the block (06 RG35, RG36; 0202). */
export const CONTACT_ROLES = [
  "executive",
  "marketing",
  "partnerships_influence",
  "communication",
  "ecommerce",
  "procurement",
  "mandated_agency",
] as const;
export const contactRoleSchema = z.enum(CONTACT_ROLES);

/** Working languages: French and English at the MVP (06 RG15; 0202). */
export const WORKING_LANGUAGES = ["fr", "en"] as const;
export const workingLanguageSchema = z.enum(WORKING_LANGUAGES);

/** Longest first name of the contact person (06 RG35). */
export const CONTACT_FIRST_NAME_MAX_LENGTH = 40;
/** Longest contact page (0202 `advertiser_contact_details_url_length`). */
export const CONTACT_URL_MAX_LENGTH = 500;
/** Longest address (0202). */
export const CONTACT_EMAIL_MAX_LENGTH = 320;
/** Longest raw website typed, before the reduction to a domain (06 RG17); the domain keeps 100. */
export const WEBSITE_INPUT_MAX_LENGTH = 300;
/** Presentation bounds (06 RG15). The minimum is a submission rule, not a saving rule (RG5). */
export const PRESENTATION_MAX_LENGTH = 1000;

/** Caps of the lists (06 RG15, RG27; 0202). */
export const BRAND_PROFILE_LIST_LIMITS = {
  secondarySectors: 2,
  targetMarkets: 5,
  workingLanguages: 2,
  topics: 3,
  audienceCountries: 5,
  // no cap in the database for these three: the closed reference lists bound them
  networks: 50,
  formats: 100,
  usageRights: 20,
} as const;

/** A code of a `reference.*` table: snake_case, at most 63 characters (0201). */
const referenceCodeSchema = z
  .string()
  .max(63)
  .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/);

function codeCount(value: string): number {
  return [...value].length;
}

/** A list of distinct choices, at most `max` (the caps are the database's too). */
function choiceList<T extends z.ZodType<string>>(item: T, max: number) {
  return z
    .array(item)
    .max(max)
    .refine((values) => new Set(values).size === values.length, {
      message: "duplicate",
    });
}

/** Line breaks and tabs kept, any other control character refused (0202 presentation_printable). */
function hasForbiddenControl(value: string): boolean {
  return [...value].some(
    (character) =>
      /\p{Cc}/u.test(character) && !["\t", "\n", "\r"].includes(character),
  );
}

const presentationSchema = z
  .string()
  .max(PRESENTATION_MAX_LENGTH * 4)
  .refine((value) => codeCount(value) <= PRESENTATION_MAX_LENGTH, {
    message: "too_long",
  })
  .refine((value) => !hasForbiddenControl(value), {
    message: "control_character",
  });

const firstNameSchema = z
  .string()
  .max(CONTACT_FIRST_NAME_MAX_LENGTH * 4)
  .refine((value) => codeCount(value) <= CONTACT_FIRST_NAME_MAX_LENGTH, {
    message: "too_long",
  })
  .refine((value) => !/\p{Cc}/u.test(value), {
    message: "control_character",
  });

/** An address, lower case as every address of the base (0004, 0202). */
const contactEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(CONTACT_EMAIL_MAX_LENGTH)
  .regex(/^[^@\s\p{Cc}]+@[^@\s\p{Cc}]+\.[^@\s\p{Cc}]+$/u);

/** E.164: + then 7 to 15 digits, no rule per country (06 RG35; 0202). */
const contactPhoneSchema = z
  .string()
  .trim()
  .max(16)
  .regex(/^\+[0-9]{7,15}$/);

/** An https page with a host and no credentials (06 RG35; 0202). */
const contactUrlSchema = z
  .string()
  .trim()
  .max(CONTACT_URL_MAX_LENGTH)
  .regex(
    /^https:\/\/[^/?#@\s\p{Cc}]+\.[^/?#@\s\p{Cc}]+(?:[/?#][^\s\p{Cc}]*)?$/u,
  );

/**
 * The contact person (06 RG35): any subset of the four fields; `null` empties one. Creators never
 * see any of it (D46); the first name only after the reveal of Lot 4.
 */
export const brandContactBodySchema = z
  .strictObject({
    firstName: firstNameSchema.nullable().optional(),
    email: contactEmailSchema.nullable().optional(),
    phone: contactPhoneSchema.nullable().optional(),
    url: contactUrlSchema.nullable().optional(),
  })
  .refine((contact) => Object.keys(contact).length > 0, { message: "empty" });
export type BrandContactBody = z.infer<typeof brandContactBodySchema>;

/**
 * PATCH /v1/me/brand-profile: the fields to change, at least one (autosave sends what changed).
 * A list is replaced as a whole; `null` empties a single value. Budget, logo and badge are not
 * here (D48, D78: suspended; the logo has its own route). Country and language are the account's
 * and are never asked again (CA2); the trading name is the account's too and is written through
 * the one door that also emits the `lead.updated` (CA3).
 */
export const updateBrandProfileBodySchema = z
  .strictObject({
    companyName: companyNameSchema.optional(),
    primarySector: referenceCodeSchema.nullable().optional(),
    secondarySectors: choiceList(
      referenceCodeSchema,
      BRAND_PROFILE_LIST_LIMITS.secondarySectors,
    ).optional(),
    companySize: companySizeBandSchema.nullable().optional(),
    targetMarkets: choiceList(
      countryCodeSchema,
      BRAND_PROFILE_LIST_LIMITS.targetMarkets,
    ).optional(),
    workingLanguages: choiceList(
      workingLanguageSchema,
      BRAND_PROFILE_LIST_LIMITS.workingLanguages,
    ).optional(),
    /** As typed: the API reduces it to a domain (RG17, CA4) and says so in the answer. */
    website: z.string().max(WEBSITE_INPUT_MAX_LENGTH).nullable().optional(),
    presentation: presentationSchema.nullable().optional(),
    topics: choiceList(
      referenceCodeSchema,
      BRAND_PROFILE_LIST_LIMITS.topics,
    ).optional(),
    networks: choiceList(
      referenceCodeSchema,
      BRAND_PROFILE_LIST_LIMITS.networks,
    ).optional(),
    formats: choiceList(
      referenceCodeSchema,
      BRAND_PROFILE_LIST_LIMITS.formats,
    ).optional(),
    audienceCountries: choiceList(
      countryCodeSchema,
      BRAND_PROFILE_LIST_LIMITS.audienceCountries,
    ).optional(),
    /** `none` is no right and is not ticked among others (L2-amend); no right asked is an empty list. */
    usageRights: choiceList(
      referenceCodeSchema.refine((code) => code !== "none", {
        message: "none_is_no_right",
      }),
      BRAND_PROFILE_LIST_LIMITS.usageRights,
    ).optional(),
    exclusivityBand: exclusivityBandSchema.nullable().optional(),
    collaborationRhythm: collaborationRhythmSchema.nullable().optional(),
    offersNonMonetary: z.boolean().nullable().optional(),
    contactRole: contactRoleSchema.nullable().optional(),
    contact: brandContactBodySchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "empty" });
export type UpdateBrandProfileBody = z.infer<
  typeof updateBrandProfileBodySchema
>;

/** Required fields (06 RG5, RG61) in the order of the form; the twin of packages/domain, held equal by a test. */
export const BRAND_PROFILE_REQUIRED_FIELD_CODES = [
  "legalName",
  "primarySector",
  "companySize",
  "country",
  "targetMarkets",
  "workingLanguages",
  "presentation",
  "topics",
  "networks",
  "formats",
  "audienceCountries",
  "contactRole",
] as const;
export const brandProfileRequiredFieldSchema = z.enum(
  BRAND_PROFILE_REQUIRED_FIELD_CODES,
);

/** The criteria of the completeness score (06 RG58), twin of packages/domain, held equal by a test. */
export const COMPLETENESS_CRITERION_CODES = [
  "legalName",
  "primarySector",
  "companySize",
  "country",
  "presentation",
  "logo",
  "targetMarkets",
  "workingLanguages",
  "topics",
  "networks",
  "formats",
  "budgetBand",
  "audienceCountries",
  "usageRights",
  "websiteDomain",
  "badgeRequested",
  "contactRole",
  "contactPhone",
  "contactEmail",
] as const;
export const COMPLETENESS_BLOCK_IDS = [
  "identity",
  "expectations",
  "trust",
  "contact",
] as const;

export const completenessCriterionSchema = z.strictObject({
  code: z.enum(COMPLETENESS_CRITERION_CODES),
  points: z.number().int().min(0).max(100),
  /** False: the brand cannot earn it today (budget D78, badge L2E); left out of the reachable points. */
  offered: z.boolean(),
  earned: z.boolean(),
});

export const completenessBlockSchema = z.strictObject({
  id: z.enum(COMPLETENESS_BLOCK_IDS),
  earnedPoints: z.number().int().min(0).max(100),
  attainablePoints: z.number().int().min(0).max(100),
  criteria: z.array(completenessCriterionSchema),
});

/** Score of 0 to 100 (RG57), shown with its detail block by block (CA35). It opens no right (RG60). */
export const brandProfileCompletenessSchema = z.strictObject({
  score: z.number().int().min(0).max(100),
  earnedPoints: z.number().int().min(0).max(100),
  attainablePoints: z.number().int().min(0).max(100),
  blocks: z.array(completenessBlockSchema),
});
export type BrandProfileCompletenessView = z.infer<
  typeof brandProfileCompletenessSchema
>;

/** The contact person as stored, for its owner only. Every field is null until entered. */
export const brandContactSchema = z.strictObject({
  firstName: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  url: z.string().nullable(),
});

/** Codes still active in each reference list the form draws from (labels are the front's). */
export const brandProfileReferencesSchema = z.strictObject({
  sectors: z.array(z.string()),
  topics: z.array(z.string()),
  networks: z.array(z.string()),
  formats: z.array(z.string()),
  usageRights: z.array(z.string()),
  countries: z.array(z.string()),
  languages: z.array(z.string()),
});
export type BrandProfileReferences = z.infer<
  typeof brandProfileReferencesSchema
>;

/**
 * GET /v1/me/brand-profile: the profile of the session's own account. `country` and
 * `preferredLanguage` are read from the account (CA2), `companyName` is the account's trading name
 * (RG2); `signInEmail` is the default of the professional address (RG35), shown to its owner only.
 */
export const brandProfileResponseSchema = z.strictObject({
  status: brandProfileStatusSchema,
  submittedAt: z.iso.datetime().nullable(),
  companyName: z.string(),
  country: countryCodeSchema,
  preferredLanguage: uiLocaleSchema,
  primarySector: z.string().nullable(),
  secondarySectors: z.array(z.string()),
  companySize: companySizeBandSchema.nullable(),
  targetMarkets: z.array(countryCodeSchema),
  workingLanguages: z.array(workingLanguageSchema),
  /** The domain kept (RG17), never a path or a protocol. */
  website: z.string().nullable(),
  presentation: z.string().nullable(),
  topics: z.array(z.string()),
  networks: z.array(z.string()),
  formats: z.array(z.string()),
  audienceCountries: z.array(countryCodeSchema),
  usageRights: z.array(z.string()),
  exclusivityBand: exclusivityBandSchema.nullable(),
  collaborationRhythm: collaborationRhythmSchema.nullable(),
  offersNonMonetary: z.boolean().nullable(),
  contactRole: contactRoleSchema.nullable(),
  contact: brandContactSchema,
  signInEmail: z.string(),
  completeness: brandProfileCompletenessSchema,
  /** Required fields still missing, in the order of the form (RG5, RG61); empty: may be submitted. */
  missingRequired: z.array(brandProfileRequiredFieldSchema),
  references: brandProfileReferencesSchema,
});
export type BrandProfileResponse = z.infer<typeof brandProfileResponseSchema>;

/**
 * The answer of PATCH: the profile as saved, and whether the website typed was reduced to its domain
 * (CA4: the screen explains where a contact page goes, `brandProfile.website.normalized`).
 */
export const updateBrandProfileResponseSchema =
  brandProfileResponseSchema.extend({
    websiteNormalized: z.boolean(),
  });
export type UpdateBrandProfileResponse = z.infer<
  typeof updateBrandProfileResponseSchema
>;

/**
 * The answer of POST .../submit: the profile now `pending_review`. `changed` is false when it
 * already was (a second click, a second tab: nothing written, nothing journalised, RG5 edge case 3).
 */
export const submitBrandProfileResponseSchema =
  brandProfileResponseSchema.extend({
    changed: z.boolean(),
  });
export type SubmitBrandProfileResponse = z.infer<
  typeof submitBrandProfileResponseSchema
>;

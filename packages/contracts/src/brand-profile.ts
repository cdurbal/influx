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

/** `profiles.advertiser_rejection_reasons` (0207, 06 RG66, file.md A6): the closed list of refusal reasons. */
export const REJECTION_REASON_CODES = [
  "contact_in_public_field",
  "presentation_insufficient",
  "logo_non_compliant",
  "misleading_brand_name",
  "sector_inconsistent",
  "illicit_content",
  "duplicate_brand",
  "other",
] as const;
export const rejectionReasonCodeSchema = z.enum(REJECTION_REASON_CODES);
export type RejectionReasonCode = z.infer<typeof rejectionReasonCodeSchema>;

/** `profiles.moderated_fields` (0207, file.md A4): what a change re-validates. */
export const MODERATED_FIELD_CODES = [
  "advertiser.brand_name",
  "advertiser.logo",
  "advertiser.presentation",
  "advertiser.website_domain",
  "advertiser.contact_role",
  "advertiser.primary_sector",
] as const;
export const moderatedFieldCodeSchema = z.enum(MODERATED_FIELD_CODES);
export type ModeratedFieldCode = z.infer<typeof moderatedFieldCodeSchema>;

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
 * The fields of a PUBLISHED profile whose change waits for the review of INFLUX (06 RG9, file.md
 * A4): the contract names them as the form does; the live value stays the validated one.
 */
export const PENDING_CHANGE_FIELDS = [
  "companyName",
  "logo",
  "presentation",
  "website",
  "contactRole",
  "primarySector",
] as const;
export const pendingChangeFieldSchema = z.enum(PENDING_CHANGE_FIELDS);
export type PendingChangeField = z.infer<typeof pendingChangeFieldSchema>;

/**
 * A change of a published profile waiting for review, for its owner only (06 RG9, CA15). `clear`:
 * the value is to be emptied (the logo: removed). `value` is the proposed text; null for `clear`
 * and for the logo (its object is read by GET .../logo, never named here).
 */
export const pendingChangeSchema = z.strictObject({
  field: pendingChangeFieldSchema,
  change: z.enum(["set", "clear"]),
  value: z.string().nullable(),
  submittedAt: z.iso.datetime(),
});
export type PendingChange = z.infer<typeof pendingChangeSchema>;

/**
 * The last refusal by INFLUX, until the next submission or revision (06 RG10, RG66, CA20): its
 * typed reason, the message of the reason in the account's language, and the text the agent wrote
 * for `other` only. `kind` `revision`: the validated profile stays in place; `fields` names what was
 * refused. The internal comment of the agent is never part of it (D46).
 */
export const brandRefusalSchema = z.strictObject({
  kind: z.enum(["submission", "revision"]),
  reasonCode: rejectionReasonCodeSchema,
  message: z.string(),
  memberMessage: z.string().nullable(),
  fields: z.array(pendingChangeFieldSchema),
  decidedAt: z.iso.datetime(),
});
export type BrandRefusal = z.infer<typeof brandRefusalSchema>;

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
  /**
   * Published profile: every field above is the VALIDATED value; what waits for review is here, one
   * per field (06 RG9). Empty outside a revision: `status` stays `published` meanwhile (file.md A2).
   */
  pendingChanges: z.array(pendingChangeSchema),
  /** The last refusal, null when there is none or a newer request is under examination. */
  refusal: brandRefusalSchema.nullable(),
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

// The logo (06 RG15, RG18; 18 T9; D80, jalons/l2b/stockage.md §1, §3, §4; commit 09). Deposited by
// PUT /v1/me/brand-profile/logo, the raw bytes of the file as `application/octet-stream` through
// the relay (2 MiB): neither its declared type nor its name is ever sent. apps/api reads its type
// from its first bytes, re-encodes it into a WebP square without any metadata and keeps that output
// only. Read back by GET as JSON (the bytes in base64): no URL, no host of Supabase, no token.

/** What the relay carries for one upload (03 PP-9 amended by D80; EC-L2B-08-2). */
export const BRAND_LOGO_MAX_UPLOAD_BYTES = 2_097_152;
/** The longest side of the image received must reach it (06 RG15; EC-L2B-02-2). */
export const BRAND_LOGO_MIN_SIDE = 256;
/** The stored square (stockage.md §1). */
export const BRAND_LOGO_SIDE = 512;
/** The stored WebP, at most (the limit of the bucket brand-logo, 0204). */
export const BRAND_LOGO_MAX_STORED_BYTES = 1_048_576;

/**
 * The reasons of an `image_rejected` (path `logo`): no bytes, a type other than PNG, JPEG or WebP
 * (PDF and SVG included, T9.4), bytes that do not decode, more than 4 096² pixels, a longest side
 * under 256 px, an output over the limit of the bucket.
 */
export const BRAND_LOGO_REJECTIONS = [
  "empty",
  "unsupported_type",
  "undecodable",
  "too_many_pixels",
  "too_small",
  "output_too_large",
] as const;
export type BrandLogoRejection = (typeof BRAND_LOGO_REJECTIONS)[number];

/** Base64 of the largest stored WebP. */
const BRAND_LOGO_MAX_BASE64_LENGTH =
  Math.ceil(BRAND_LOGO_MAX_STORED_BYTES / 3) * 4;

/** The stored logo, for its owner: always a WebP square, its bytes in base64. */
export const brandLogoSchema = z.strictObject({
  contentType: z.literal("image/webp"),
  width: z.number().int().min(1).max(BRAND_LOGO_SIDE),
  height: z.number().int().min(1).max(BRAND_LOGO_SIDE),
  byteSize: z.number().int().min(1).max(BRAND_LOGO_MAX_STORED_BYTES),
  data: z.base64().max(BRAND_LOGO_MAX_BASE64_LENGTH),
  updatedAt: z.iso.datetime(),
});
export type BrandLogo = z.infer<typeof brandLogoSchema>;

/**
 * GET /v1/me/brand-profile/logo: the logo in force, or null when the brand has none. On a published
 * profile a replacement waits for review (file.md A4): it is `pendingLogo`, absent otherwise, while
 * `logo` stays the validated one.
 */
export const brandLogoResponseSchema = z.strictObject({
  logo: brandLogoSchema.nullable(),
  pendingLogo: brandLogoSchema.optional(),
});
export type BrandLogoResponse = z.infer<typeof brandLogoResponseSchema>;

/**
 * PUT /v1/me/brand-profile/logo: the logo deposited and the completeness (RG58). `state` `active`:
 * it is the logo in force; `in_review`: the profile is published, the previous logo stays served until
 * the decision (file.md A4) and the completeness is that of the validated profile.
 */
export const brandLogoUploadResponseSchema = z.strictObject({
  logo: brandLogoSchema,
  state: z.enum(["active", "in_review"]),
  completeness: brandProfileCompletenessSchema,
});
export type BrandLogoUploadResponse = z.infer<
  typeof brandLogoUploadResponseSchema
>;

/**
 * DELETE /v1/me/brand-profile/logo: whether a logo was removed now, and the completeness after.
 * `inReview`: on a published profile the removal waits for review, the logo stays served (A4).
 */
export const brandLogoRemovalResponseSchema = z.strictObject({
  removed: z.boolean(),
  inReview: z.boolean(),
  completeness: brandProfileCompletenessSchema,
});
export type BrandLogoRemovalResponse = z.infer<
  typeof brandLogoRemovalResponseSchema
>;

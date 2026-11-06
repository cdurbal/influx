// Contract of the creator profile, "mon profil" (docs/mvp/07 RG1, RG2, RG14, RG16, RG25 to RG40,
// RG56, RG64 to RG76, RG86 to RG91; jalons/l2d/modele.md; commit 08): read and autosave of blocks 1,
// 2 and 5. Shared by apps/api and apps/web. The account is always the session's: no route takes an
// account id, and no path carries an object identifier (18 T14).
// The request schemas are the ones the browser validates with (RG14); the API validates the same
// ones, then the database arbitrates (closed lists by foreign key, caps by constraint, 0216, 0217).
// The response lists its fields one by one: nothing of another account, no `public_ref`, no
// `account_id`, no status field INFLUX alone writes. Three layers meet in it (07 RG16): the public
// storefront (A), and the identifying fields of the creator (N), returned to their OWNER only.
// No price, rate, net or currency exists in it (CLAUDE.md §2, D48, D78: no tariff at the pilot).
// Networks (block 3) and audience (block 4) have their own routes (commit 09).
import { z } from "./zod.ts";
import { uiLocaleSchema } from "./auth.ts";
import { countryCodeSchema } from "./signup.ts";

/** The five states of a creator profile (04 §5.2, 0216). No member writes any: `draft` all of L2D. */
export const CREATOR_PROFILE_STATUSES = [
  "draft",
  "pending_review",
  "published",
  "rejected",
  "suspended",
] as const;
export const creatorProfileStatusSchema = z.enum(CREATOR_PROFILE_STATUSES);
export type CreatorProfileStatus = z.infer<typeof creatorProfileStatusSchema>;

/** Short title (07 RG25): the database caps it at 120; the minimum of 20 is a requirement, not a saving rule. */
export const CREATOR_HEADLINE_MAX_LENGTH = 120;
/** Bio (07 RG26): the database caps it at 800; the minimum of 150 is a requirement, not a saving rule. */
export const CREATOR_BIO_MAX_LENGTH = 800;
/** Longest legal name, city (0217). */
export const CREATOR_IDENTITY_NAME_MAX_LENGTH = 100;
/** Longest postal address line (0217). */
export const CREATOR_ADDRESS_LINE_MAX_LENGTH = 200;
/** Longest contact address (0217). */
export const CREATOR_CONTACT_EMAIL_MAX_LENGTH = 320;

/** Possible travel (07 RG39; 0216): no distance, no radius. */
export const TRAVEL_SCOPES = ["none", "domestic", "international"] as const;
/** Declarative collaboration experience (07 RG32; 0216): a band, never a list of brands. */
export const COLLABORATION_EXPERIENCE_BANDS = [
  "none",
  "1_5",
  "6_20",
  "gt_20",
] as const;
/** Usual delivery time (07 block 5; 0216). */
export const DELIVERY_LEAD_BANDS = [
  "lt_7d",
  "7_14d",
  "15_30d",
  "gt_30d",
] as const;
/** Sector exclusivity accepted (07 block 5; 0216). */
export const CREATOR_EXCLUSIVITY_BANDS = [
  "none",
  "le_1m",
  "le_3m",
  "negotiable",
] as const;
/** Declared availability (07 RG74; 0216); its date is the database's. */
export const AVAILABILITY_BANDS = ["lt_2w", "lt_1m", "full"] as const;
/** A usage right is included in the offer or an option (07 RG73; 0216). */
export const USAGE_RIGHT_INCLUSIONS = ["included", "optional"] as const;

export const travelScopeSchema = z.enum(TRAVEL_SCOPES);
export const collaborationExperienceBandSchema = z.enum(
  COLLABORATION_EXPERIENCE_BANDS,
);
export const deliveryLeadBandSchema = z.enum(DELIVERY_LEAD_BANDS);
export const creatorExclusivityBandSchema = z.enum(CREATOR_EXCLUSIVITY_BANDS);
export const availabilityBandSchema = z.enum(AVAILABILITY_BANDS);
export const usageRightInclusionSchema = z.enum(USAGE_RIGHT_INCLUSIONS);

/** Caps of the lists (07 RG26, RG33, RG34; 0216): the closed reference lists bound the others. */
export const CREATOR_PROFILE_LIST_LIMITS = {
  secondaryTopics: 3,
  tones: 2,
  publicationLanguages: 5,
  formats: 100,
  usageRights: 20,
  refusedSectors: 50,
} as const;

/** A code of a `reference.*` table: snake_case, at most 63 characters (0201). */
const referenceCodeSchema = z
  .string()
  .max(63)
  .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/);

/** A region code, ISO 3166-2 (0201 `reference.regions`). */
const regionCodeSchema = z
  .string()
  .max(6)
  .regex(/^[A-Z]{2}-[A-Z0-9]{1,3}$/);

/** An ISO 639-1 language code (0003 `reference.languages`). */
const languageCodeSchema = z.string().regex(/^[a-z]{2}$/);

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

/** Any control character (0216 `headline_printable`). */
function hasControl(value: string): boolean {
  return /\p{Cc}/u.test(value);
}

/** The bio keeps its line feeds and no other control character (0216 `bio_printable`). */
function hasControlButLineFeed(value: string): boolean {
  return /[\p{Cc}]/u.test(value.replaceAll("\n", ""));
}

const headlineSchema = z
  .string()
  .max(CREATOR_HEADLINE_MAX_LENGTH * 4 + 8)
  .trim()
  .refine((value) => codeCount(value) <= CREATOR_HEADLINE_MAX_LENGTH, {
    message: "too_long",
  })
  .refine((value) => !hasControl(value), { message: "control_character" });

const bioSchema = z
  .string()
  .max(CREATOR_BIO_MAX_LENGTH * 4 + 8)
  .trim()
  .refine((value) => codeCount(value) <= CREATOR_BIO_MAX_LENGTH, {
    message: "too_long",
  })
  .refine((value) => !hasControlButLineFeed(value), {
    message: "control_character",
  });

const identityNameSchema = z
  .string()
  .max(CREATOR_IDENTITY_NAME_MAX_LENGTH * 4)
  .trim()
  .refine((value) => codeCount(value) <= CREATOR_IDENTITY_NAME_MAX_LENGTH, {
    message: "too_long",
  })
  .refine((value) => !hasControl(value), { message: "control_character" });

const addressLineSchema = z
  .string()
  .max(CREATOR_ADDRESS_LINE_MAX_LENGTH * 4)
  .trim()
  .refine((value) => codeCount(value) <= CREATOR_ADDRESS_LINE_MAX_LENGTH, {
    message: "too_long",
  })
  .refine((value) => !hasControl(value), { message: "control_character" });

/** Letters and digits, inner spaces and hyphens, 20 characters at most (0217). */
const postalCodeSchema = z
  .string()
  .trim()
  .max(20)
  .regex(/^[\p{L}\p{N}]([\p{L}\p{N} -]*[\p{L}\p{N}])?$/u);

/** An address, lower case as every address of the base (0004, 0217). */
const contactEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(CREATOR_CONTACT_EMAIL_MAX_LENGTH)
  .regex(/^[^@\s\p{Cc}]+@[^@\s\p{Cc}]+\.[^@\s\p{Cc}]+$/u);

/** E.164: + then 7 to 15 digits, no rule per country (0217). */
const contactPhoneSchema = z
  .string()
  .trim()
  .max(16)
  .regex(/^\+[0-9]{7,15}$/);

/**
 * The identifying fields of the creator, layer N (07 RG16): any subset, `null` empties one. Seen by
 * their owner and the team only, never by a brand, before or after the reveal (D46, 03 P5).
 */
export const creatorIdentityBodySchema = z
  .strictObject({
    legalFirstName: identityNameSchema.nullable().optional(),
    legalLastName: identityNameSchema.nullable().optional(),
    contactEmail: contactEmailSchema.nullable().optional(),
    contactPhone: contactPhoneSchema.nullable().optional(),
    addressLine: addressLineSchema.nullable().optional(),
    postalCode: postalCodeSchema.nullable().optional(),
    city: identityNameSchema.nullable().optional(),
    addressCountry: countryCodeSchema.nullable().optional(),
  })
  .refine((identity) => Object.keys(identity).length > 0, {
    message: "empty",
  });
export type CreatorIdentityBody = z.infer<typeof creatorIdentityBodySchema>;

/** A usage right with how it is offered (07 RG73): once per code, `none` is no right. */
export const creatorUsageRightSchema = z.strictObject({
  code: referenceCodeSchema.refine((code) => code !== "none", {
    message: "none_is_no_right",
  }),
  inclusion: usageRightInclusionSchema,
});
export type CreatorUsageRight = z.infer<typeof creatorUsageRightSchema>;

/**
 * PATCH /v1/me/creator-profile: the fields to change, at least one (autosave sends what changed).
 * A list is replaced as a whole; `null` empties a single value. The alias, the status, the
 * visibility, the bands derived from exact figures, the date of the availability and the country
 * and language of the account are NOT here: the system writes the first ones, the account the
 * others (07 RG2, RG23, CA2). No price exists (D78). `none` is no usage right (L2-amend).
 */
export const updateCreatorProfileBodySchema = z
  .strictObject({
    headline: headlineSchema.nullable().optional(),
    bio: bioSchema.nullable().optional(),
    collaborationExperience: collaborationExperienceBandSchema
      .nullable()
      .optional(),
    primaryTopic: referenceCodeSchema.nullable().optional(),
    secondaryTopics: choiceList(
      referenceCodeSchema,
      CREATOR_PROFILE_LIST_LIMITS.secondaryTopics,
    ).optional(),
    tones: choiceList(
      referenceCodeSchema,
      CREATOR_PROFILE_LIST_LIMITS.tones,
    ).optional(),
    publicationLanguages: choiceList(
      languageCodeSchema,
      CREATOR_PROFILE_LIST_LIMITS.publicationLanguages,
    ).optional(),
    residenceRegion: regionCodeSchema.nullable().optional(),
    travelScope: travelScopeSchema.nullable().optional(),
    formats: choiceList(
      referenceCodeSchema,
      CREATOR_PROFILE_LIST_LIMITS.formats,
    ).optional(),
    usageRights: z
      .array(creatorUsageRightSchema)
      .max(CREATOR_PROFILE_LIST_LIMITS.usageRights)
      .refine(
        (rights) => new Set(rights.map((r) => r.code)).size === rights.length,
        { message: "duplicate" },
      )
      .optional(),
    deliveryLead: deliveryLeadBandSchema.nullable().optional(),
    maxExclusivity: creatorExclusivityBandSchema.nullable().optional(),
    acceptsNonMonetary: z.boolean().optional(),
    availability: availabilityBandSchema.nullable().optional(),
    refusedSectors: choiceList(
      referenceCodeSchema,
      CREATOR_PROFILE_LIST_LIMITS.refusedSectors,
    ).optional(),
    identity: creatorIdentityBodySchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "empty" });
export type UpdateCreatorProfileBody = z.infer<
  typeof updateCreatorProfileBodySchema
>;

/** Required fields (07 RG4, RG16, Q15) in the order of the form; the twin of packages/domain, held equal by a test. */
export const CREATOR_PROFILE_REQUIRED_FIELD_CODES = [
  "headline",
  "bio",
  "primaryTopic",
  "publicationLanguages",
  "residenceCountry",
  "networkLines",
  "primaryAccount",
  "handle",
  "profileUrl",
  "followers",
  "figuresDate",
  "mainAudienceCountry",
  "mainAudienceShare",
  "formats",
  "availability",
] as const;
export const creatorProfileRequiredFieldSchema = z.enum(
  CREATOR_PROFILE_REQUIRED_FIELD_CODES,
);

/** The criteria of the completeness score (07 RG87), twin of packages/domain, held equal by a test. */
export const CREATOR_COMPLETENESS_CRITERION_CODES = [
  "headline",
  "bio",
  "primaryTopic",
  "secondaryTopics",
  "tone",
  "languages",
  "residenceCountry",
  "travelScope",
  "firstNetworkLine",
  "secondNetworkLine",
  "averageReach",
  "mainAudienceCountry",
  "otherAudienceCountries",
  "audienceAges",
  "audienceGenders",
  "firstOfferLine",
  "secondOfferLine",
  "formats",
  "usageRights",
  "exclusivity",
  "availability",
  "portfolioThree",
  "portfolioFive",
  "badgeRequested",
] as const;
export const CREATOR_COMPLETENESS_BLOCK_IDS = [
  "presentation",
  "editorial",
  "networks",
  "audience",
  "offer",
  "portfolio",
  "trust",
] as const;

export const creatorCompletenessCriterionSchema = z.strictObject({
  code: z.enum(CREATOR_COMPLETENESS_CRITERION_CODES),
  points: z.number().int().min(0).max(100),
  /** False: the creator cannot earn it today (portfolio L2G, badge L2E); left out of the reachable points. */
  offered: z.boolean(),
  earned: z.boolean(),
});

export const creatorCompletenessBlockSchema = z.strictObject({
  id: z.enum(CREATOR_COMPLETENESS_BLOCK_IDS),
  earnedPoints: z.number().int().min(0).max(100),
  attainablePoints: z.number().int().min(0).max(100),
  criteria: z.array(creatorCompletenessCriterionSchema),
});

/** Score of 0 to 100 (07 RG86), 90 at most while the portfolio and the badge request do not exist. It opens no right (RG89). */
export const creatorProfileCompletenessSchema = z.strictObject({
  score: z.number().int().min(0).max(100),
  earnedPoints: z.number().int().min(0).max(100),
  attainablePoints: z.number().int().min(0).max(100),
  blocks: z.array(creatorCompletenessBlockSchema),
});
export type CreatorProfileCompletenessView = z.infer<
  typeof creatorProfileCompletenessSchema
>;

/** The public texts the detection reads (07 RG27): the short title and the bio. */
export const CREATOR_DETECTED_FIELDS = ["headline", "bio"] as const;

/** What an identifying element looks like (shared/contact-detection.ts): a code, never the text. */
export const CREATOR_DETECTION_SIGNALS = [
  "email",
  "url",
  "domain",
  "phone",
  "handle",
  "messenger",
] as const;

/**
 * A non-blocking warning of the autosave (07 RG27, RG28): an identifying element seems to show in a
 * public text. Its type and its place only, never the text that matched; nothing is stored. The
 * moderator decides (L2G).
 */
export const creatorTextWarningSchema = z.strictObject({
  field: z.enum(CREATOR_DETECTED_FIELDS),
  signal: z.enum(CREATOR_DETECTION_SIGNALS),
  start: z.number().int().min(0),
  end: z.number().int().min(0),
});
export type CreatorTextWarning = z.infer<typeof creatorTextWarningSchema>;

/** The identifying fields as stored, for their owner only. Every field is null until entered. */
export const creatorIdentitySchema = z.strictObject({
  legalFirstName: z.string().nullable(),
  legalLastName: z.string().nullable(),
  contactEmail: z.string().nullable(),
  contactPhone: z.string().nullable(),
  addressLine: z.string().nullable(),
  postalCode: z.string().nullable(),
  city: z.string().nullable(),
  addressCountry: countryCodeSchema.nullable(),
});

/** A format the creator may offer, with the network it belongs to (null: UGC, published by no network). */
export const creatorFormatReferenceSchema = z.strictObject({
  code: z.string(),
  networkCode: z.string().nullable(),
});

/** Codes still active in each reference list the form draws from (labels are the front's). */
export const creatorProfileReferencesSchema = z.strictObject({
  topics: z.array(z.string()),
  tones: z.array(z.string()),
  languages: z.array(z.string()),
  /** The regions of the country of residence; empty when the country has none loaded. */
  regions: z.array(z.string()),
  formats: z.array(creatorFormatReferenceSchema),
  usageRights: z.array(z.string()),
  sectors: z.array(z.string()),
});
export type CreatorProfileReferences = z.infer<
  typeof creatorProfileReferencesSchema
>;

/**
 * GET /v1/me/creator-profile: the profile of the session's own account, blocks 1, 2 and 5. The
 * country of residence and the language are read from the account (07 RG2, CA2): they are not
 * written here. `alias` is null while the account holds no storefront yet (a role granted after
 * the sign-up): the absence of a row reads as an empty draft.
 */
export const creatorProfileResponseSchema = z.strictObject({
  status: creatorProfileStatusSchema,
  /** The public alias (07 RG23), attributed for life; written by nobody. */
  alias: z.string().nullable(),
  residenceCountry: countryCodeSchema,
  preferredLanguage: uiLocaleSchema,
  headline: z.string().nullable(),
  bio: z.string().nullable(),
  collaborationExperience: collaborationExperienceBandSchema.nullable(),
  primaryTopic: z.string().nullable(),
  secondaryTopics: z.array(z.string()),
  tones: z.array(z.string()),
  publicationLanguages: z.array(z.string()),
  residenceRegion: z.string().nullable(),
  travelScope: travelScopeSchema.nullable(),
  formats: z.array(z.string()),
  usageRights: z.array(creatorUsageRightSchema),
  deliveryLead: deliveryLeadBandSchema.nullable(),
  maxExclusivity: creatorExclusivityBandSchema.nullable(),
  acceptsNonMonetary: z.boolean(),
  availability: availabilityBandSchema.nullable(),
  /** Set by the system when the availability is declared (07 RG74), never entered. */
  availabilityDeclaredAt: z.iso.datetime().nullable(),
  refusedSectors: z.array(z.string()),
  identity: creatorIdentitySchema,
  completeness: creatorProfileCompletenessSchema,
  /** Required fields still missing, in the order of the form (07 RG4, RG90); empty: nothing left to fill at L2D. */
  missingRequired: z.array(creatorProfileRequiredFieldSchema),
  /** Identifying elements the detection sees in the public texts: signals, never blocking, never stored (07 RG27, RG28). */
  warnings: z.array(creatorTextWarningSchema),
  references: creatorProfileReferencesSchema,
});
export type CreatorProfileResponse = z.infer<
  typeof creatorProfileResponseSchema
>;

/** The answer of PATCH: the profile as saved. */
export const updateCreatorProfileResponseSchema = creatorProfileResponseSchema;
export type UpdateCreatorProfileResponse = CreatorProfileResponse;

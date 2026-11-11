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
// Networks (block 3) and audience (block 4) have their own routes, at the end of this file (commit 09).
import { z } from "./zod.ts";
import { uiLocaleSchema } from "./auth.ts";
import { countryCodeSchema } from "./signup.ts";

/**
 * The five states of a creator profile (04 §5.2, 0216). A member never writes one: the submission
 * door moves `draft` or `rejected` to `pending_review` (L2G), an agent publishes or refuses.
 */
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

/** Required fields (07 RG4, RG16, RG77, Q15) in the order of the form; the twin of packages/domain, held equal by a test. */
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
  // L2G: three visuals deposited (07 RG77) and an active « Compte vérifié » (08 RG16)
  "portfolio",
  "accountVerified",
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
  /** False: the creator cannot earn it today; left out of the reachable points (none since L2G: all are offered). */
  offered: z.boolean(),
  earned: z.boolean(),
});

export const creatorCompletenessBlockSchema = z.strictObject({
  id: z.enum(CREATOR_COMPLETENESS_BLOCK_IDS),
  earnedPoints: z.number().int().min(0).max(100),
  attainablePoints: z.number().int().min(0).max(100),
  criteria: z.array(creatorCompletenessCriterionSchema),
});

/** Score of 0 to 100 (07 RG86), every criterion being offered since L2G; the portfolio counts once deposited and the badge request once filed (RG88). It opens no right (RG89). */
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

// --- Submission, refusal and visibility (07 RG4, RG5, RG8, RG10, RG96; jalons/l2g/modele.md §2, §6) --
// POST /v1/me/creator-profile/submit and PUT .../visibility. The account is the session's; no path
// carries an identifier. The answer of a refusal comes from the closed list of RG96: the message the
// member reads is the one of its code (translations), and only `other` carries a free message.

/** The closed list of the reasons a creator profile is refused (07 RG96; `profiles.creator_rejection_reasons`). */
export const CREATOR_REJECTION_REASON_CODES = [
  "identifier_in_text",
  "bio_insufficient",
  "portfolio_insufficient",
  "portfolio_non_compliant",
  "network_link_inconsistent",
  "figures_inconsistent",
  "topic_inconsistent",
  "illicit_content",
  "age_doubt",
  "other",
] as const;
export const creatorRejectionReasonCodeSchema = z.enum(
  CREATOR_REJECTION_REASON_CODES,
);
export type CreatorRejectionReasonCode = z.infer<
  typeof creatorRejectionReasonCodeSchema
>;

/** What the member does next: correct and submit again (`fix`), or write to INFLUX (`contact`). */
export const CREATOR_REJECTION_NEXT_STEPS = ["fix", "contact"] as const;

/**
 * The step of each reason, as `profiles.creator_rejection_reasons.next_step` holds it (0243): the
 * creator reads no catalogue, so the API serves the step from this table, held equal to the base by
 * db-tests/profiles-creator-submission-route.test.ts.
 */
export const CREATOR_REJECTION_NEXT_STEP_OF: Readonly<
  Record<(typeof CREATOR_REJECTION_REASON_CODES)[number], "fix" | "contact">
> = {
  identifier_in_text: "fix",
  bio_insufficient: "fix",
  portfolio_insufficient: "fix",
  portfolio_non_compliant: "fix",
  network_link_inconsistent: "fix",
  figures_inconsistent: "fix",
  topic_inconsistent: "fix",
  illicit_content: "contact",
  age_doubt: "contact",
  other: "contact",
};

/** The free message of the reason `other`, the only one to carry one (0243: 20 to 500 characters). */
export const CREATOR_MEMBER_MESSAGE_MIN_LENGTH = 20;
export const CREATOR_MEMBER_MESSAGE_MAX_LENGTH = 500;

/**
 * The last refusal of a submission or of a revision of a published profile (RG10, RG96): the
 * reason, the step that follows and, for `other` alone, the message of the agent. Never the agent,
 * nor the internal comment (T14). `kind` `revision`: the profile stays published with its previous
 * version (CA48).
 */
export const creatorProfileRefusalSchema = z.strictObject({
  kind: z.enum(["submission", "revision"]),
  reasonCode: creatorRejectionReasonCodeSchema,
  nextStep: z.enum(CREATOR_REJECTION_NEXT_STEPS),
  memberMessage: z
    .string()
    .min(CREATOR_MEMBER_MESSAGE_MIN_LENGTH)
    .max(CREATOR_MEMBER_MESSAGE_MAX_LENGTH)
    .nullable(),
  decidedAt: z.iso.datetime(),
});
export type CreatorProfileRefusal = z.infer<typeof creatorProfileRefusalSchema>;

/**
 * The moderated fields of a creator profile (`profiles.moderated_fields`, 07 RG9, modele point 6) as
 * the member names them. A change of one of them on a PUBLISHED profile waits for a decision while
 * the validated version is served (CA48). `rowKey`: the visual or the network line, null for the
 * storefront texts.
 */
export const CREATOR_MODERATED_FIELDS = [
  "headline",
  "bio",
  "portfolio_caption",
  "network_line",
  "network_handle",
  "network_url",
] as const;
export const creatorPendingRevisionSchema = z.strictObject({
  field: z.enum(CREATOR_MODERATED_FIELDS),
  rowKey: z.uuid().nullable(),
});
export type CreatorPendingRevision = z.infer<
  typeof creatorPendingRevisionSchema
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
  /** Required fields still missing, in the order of the form (07 RG4, RG90); empty: the profile may be submitted. */
  missingRequired: z.array(creatorProfileRequiredFieldSchema),
  /** The switch « visible dans la recherche » (07 RG8), on by default; no effect readable before Lot 3. */
  isSearchable: z.boolean(),
  /** The last refusal, while it stands (07 RG10, CA51): never the agent nor the internal comment (T14). */
  refusal: creatorProfileRefusalSchema.nullable(),
  /**
   * The changes of a published profile waiting for a decision (CA48). `headline` and `bio` above then
   * carry what the creator typed, the validated version being the one served to a brand.
   */
  pendingRevisions: z.array(creatorPendingRevisionSchema),
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

// --- Network lines, figures and audience (07 RG41 to RG61, RG113 to RG116; commit 09) -------------
// Layer I, returned to the OWNER only: exact figures, handle, URL, audience. A brand never reaches
// them (03 P5, EC-L2D-1). Every route of this family takes the line's identifier in its path and
// the account from the session, so another creator's line answers as an unknown one (18 T14.1).

/** Bounds of a typed handle, pseudonym and profile URL (07 RG30, RG43, RG44; 0217): twin of packages/domain. */
export const CREATOR_HANDLE_MAX_LENGTH = 100;
export const CREATOR_PSEUDONYM_MAX_LENGTH = 60;
export const CREATOR_PROFILE_URL_MAX_LENGTH = 500;

/** The sources of a figure (07 RG49): typed by the creator, or seen by an agent (L2E). */
export const CREATOR_FIGURES_SOURCES = ["declared", "agent_observed"] as const;
/** The genders of an audience (07 RG61): about the AUDIENCE, never the creator (RG55). */
export const CREATOR_AUDIENCE_GENDER_CODES = [
  "female",
  "male",
  "other",
] as const;
/** The message asked of the screen when a figure changed alone (07 RG116, CA18, EC-L2D-6). */
export const CREATOR_FIGURES_CONFIRM_NOTICE =
  "creatorProfile.figures.confirmAll" as const;
/** Other countries of an audience, besides the main one (07 RG56). */
export const CREATOR_AUDIENCE_OTHER_COUNTRIES_MAX = 4;
/** Smallest share an "other" country may weigh (07 RG56). */
export const CREATOR_AUDIENCE_OTHER_COUNTRY_MIN_SHARE = 10;
/** Most age bands a form can hold (the reference list is short; the database arbitrates the codes). */
const CREATOR_AUDIENCE_AGE_BANDS_MAX = 20;

/** Whole numbers from zero: a count of followers or comments is never negative nor fractional (RG46). */
const figureCountSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
/** Publications of the last 30 days, a PostgreSQL integer (RG114, RG116). */
const figurePostsSchema = z.number().int().min(0).max(2_147_483_647);
/** An engagement rate in basis points (EC-L2D-8): 0 to 100 %, two decimals, converted by the chain. */
const engagementBasisPointsSchema = z.number().int().min(0).max(10_000);
/** A whole percentage (07 RG57). */
const audienceShareSchema = z.number().int().min(0).max(100);

/** A typed text of the line; the API trims it with packages/domain and a blank one empties the field. */
const lineTextSchema = (maxLength: number) => z.string().max(maxLength * 4 + 8);

export const creatorNetworkParamsSchema = z.strictObject({ id: z.uuid() });
export type CreatorNetworkParams = z.infer<typeof creatorNetworkParamsSchema>;

const networkLineFields = {
  isPrimary: z.boolean().optional(),
  handle: lineTextSchema(CREATOR_HANDLE_MAX_LENGTH).nullable().optional(),
  pseudonym: lineTextSchema(CREATOR_PSEUDONYM_MAX_LENGTH).nullable().optional(),
  profileUrl: lineTextSchema(CREATOR_PROFILE_URL_MAX_LENGTH)
    .nullable()
    .optional(),
  followersCount: figureCountSchema.nullable().optional(),
  postsLast30Days: figurePostsSchema.nullable().optional(),
  avgCommentsPerPost: figureCountSchema.nullable().optional(),
  avgReachPerPost: figureCountSchema.nullable().optional(),
  engagementRateBp: engagementBasisPointsSchema.nullable().optional(),
};

/**
 * POST /v1/me/creator-profile/networks: a new line. The network is chosen once: changing it later is
 * a deletion, then a new line. `isPrimary` true unchecks the current main line, in the same save
 * (07 RG41, CA11). The date of the figures is never sent (07 RG50, CA18): only the confirmation sets it.
 */
export const createCreatorNetworkBodySchema = z.strictObject({
  networkCode: referenceCodeSchema,
  ...networkLineFields,
});
export type CreateCreatorNetworkBody = z.infer<
  typeof createCreatorNetworkBodySchema
>;

/** PATCH /v1/me/creator-profile/networks/:id: what changed on the line, at least one field. */
export const updateCreatorNetworkBodySchema = z
  .strictObject(networkLineFields)
  .refine((body) => Object.keys(body).length > 0, { message: "empty" });
export type UpdateCreatorNetworkBody = z.infer<
  typeof updateCreatorNetworkBodySchema
>;

/**
 * POST /v1/me/creator-profile/networks/:id/figures: "Confirmer mes chiffres" (07 RG50, RG116,
 * EC-L2D-6). The three priority metrics travel together; `null` is a metric not declared. This is
 * the one action that renews the date of the figures.
 */
export const confirmCreatorFiguresBodySchema = z.strictObject({
  followersCount: figureCountSchema.nullable(),
  postsLast30Days: figurePostsSchema.nullable(),
  avgCommentsPerPost: figureCountSchema.nullable(),
});
export type ConfirmCreatorFiguresBody = z.infer<
  typeof confirmCreatorFiguresBodySchema
>;

/**
 * PUT /v1/me/creator-profile/networks/:id/audience: the whole exact audience of the line (07 RG56
 * to RG61), by country, age band and gender, whole percentages. A dimension adds up to 100 at most
 * (CA26); under 100 is accepted and the rest reads "others", never completed (CA27). The main
 * country may wait for its share; every other country weighs 10 % or more.
 */
export const putCreatorNetworkAudienceBodySchema = z.strictObject({
  mainCountry: z
    .strictObject({
      code: countryCodeSchema,
      share: audienceShareSchema.nullable(),
    })
    .nullable(),
  otherCountries: z
    .array(
      z.strictObject({
        code: countryCodeSchema,
        share: audienceShareSchema.min(
          CREATOR_AUDIENCE_OTHER_COUNTRY_MIN_SHARE,
        ),
      }),
    )
    .max(CREATOR_AUDIENCE_OTHER_COUNTRIES_MAX),
  ages: z
    .array(
      z.strictObject({ code: referenceCodeSchema, share: audienceShareSchema }),
    )
    .max(CREATOR_AUDIENCE_AGE_BANDS_MAX),
  genders: z
    .array(
      z.strictObject({
        code: z.enum(CREATOR_AUDIENCE_GENDER_CODES),
        share: audienceShareSchema,
      }),
    )
    .max(CREATOR_AUDIENCE_GENDER_CODES.length),
});
export type PutCreatorNetworkAudienceBody = z.infer<
  typeof putCreatorNetworkAudienceBodySchema
>;

/** The exact audience of a line as stored, for its owner. */
export const creatorNetworkAudienceSchema = z.strictObject({
  mainCountry: z
    .strictObject({
      code: countryCodeSchema,
      share: z.number().int().nullable(),
    })
    .nullable(),
  otherCountries: z.array(
    z.strictObject({ code: countryCodeSchema, share: z.number().int() }),
  ),
  ages: z.array(z.strictObject({ code: z.string(), share: z.number().int() })),
  genders: z.array(
    z.strictObject({
      code: z.enum(CREATOR_AUDIENCE_GENDER_CODES),
      share: z.number().int(),
    }),
  ),
});

/** What is left to "others" in each dimension (07 RG57): shown as such, never added. */
export const creatorNetworkRemaindersSchema = z.strictObject({
  countries: z.number().int().min(0).max(100),
  ages: z.number().int().min(0).max(100),
  genders: z.number().int().min(0).max(100),
});

/**
 * The bands the system derived from the figures of the MAIN line (07 RG22, RG45, RG114 to RG116),
 * returned to the creator alone: codes of the reference lists, never a figure. The engagement band
 * is absent until an agent has seen the figure (RG48).
 */
export const creatorNetworkBandsSchema = z.strictObject({
  audienceBand: z.string().nullable(),
  reachBand: z.string().nullable(),
  publicationFrequency: z.string().nullable(),
  commentBand: z.string().nullable(),
});

/** One network line, layer I, for its owner. Figures are never shown without their source and date (RG49). */
export const creatorNetworkLineSchema = z.strictObject({
  id: z.uuid(),
  networkCode: z.string(),
  isPrimary: z.boolean(),
  handle: z.string().nullable(),
  pseudonym: z.string().nullable(),
  profileUrl: z.string().nullable(),
  followersCount: z.number().int().nullable(),
  postsLast30Days: z.number().int().nullable(),
  avgCommentsPerPost: z.number().int().nullable(),
  avgReachPerPost: z.number().int().nullable(),
  engagementRateBp: z.number().int().nullable(),
  figuresSource: z.enum(CREATOR_FIGURES_SOURCES),
  /** Set by the confirmation alone, never typed (07 RG50, CA18); null until the first one. */
  figuresMeasuredAt: z.iso.datetime().nullable(),
  audience: creatorNetworkAudienceSchema,
  remainders: creatorNetworkRemaindersSchema,
  /** Present on the main line only (07 RG22). */
  bands: creatorNetworkBandsSchema.nullable(),
});
export type CreatorNetworkLine = z.infer<typeof creatorNetworkLineSchema>;

/**
 * The answer of every route of the family: the lines as saved (the main one unchecked by a new main
 * one reads here), the completeness and the required fields still missing, recomputed. `lineId` is
 * the line the call touched (null for a read and a deletion). `notices` asks the screen for a
 * message: a figure changed alone, so the date has not been renewed (07 RG116).
 */
export const creatorNetworksResponseSchema = z.strictObject({
  lines: z.array(creatorNetworkLineSchema),
  lineId: z.uuid().nullable(),
  completeness: creatorProfileCompletenessSchema,
  missingRequired: z.array(creatorProfileRequiredFieldSchema),
  notices: z.array(z.literal(CREATOR_FIGURES_CONFIRM_NOTICE)),
});
export type CreatorNetworksResponse = z.infer<
  typeof creatorNetworksResponseSchema
>;

/**
 * The answer of POST .../submit (modele §3, `submit_own_creator_profile()`): `status` after the
 * call and the required fields still missing, in the order of the form. `missing` empty and `status`
 * `pending_review`: submitted. `missing` not empty: nothing was written, the profile keeps its state
 * (RG4, RG90). No identifier of the entry of the queue leaves the API (T14).
 */
export const submitCreatorProfileResponseSchema = z.strictObject({
  status: creatorProfileStatusSchema,
  missing: z.array(creatorProfileRequiredFieldSchema),
});
export type SubmitCreatorProfileResponse = z.infer<
  typeof submitCreatorProfileResponseSchema
>;

/** The body of PUT .../visibility: the one global switch of RG8, writable in any state but `suspended`. */
export const creatorVisibilityBodySchema = z.strictObject({
  isSearchable: z.boolean(),
});
export type CreatorVisibilityBody = z.infer<typeof creatorVisibilityBodySchema>;

export const creatorVisibilityResponseSchema = z.strictObject({
  isSearchable: z.boolean(),
});
export type CreatorVisibilityResponse = z.infer<
  typeof creatorVisibilityResponseSchema
>;

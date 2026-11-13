// Contract of the campaigns a brand writes and submits (docs/mvp/09 RG4, RG14, RG16 to RG85, CA2,
// CA3, CA72, CA76; jalons/l3b, commit 07): the list, the draft, the read, the autosave and the
// submission of /v1/me/campaigns. Shared by apps/api and apps/web. The account is always the one of
// the session: no route takes an account id; the only identifier of a path is the campaign's own,
// opaque, and a campaign of another brand is an unknown one (18 T14).
// The request schemas are structural: shapes, closed lists of values, ceilings of the lists, a
// generous cap on the length of a text. The RULES of the form (bounds in characters, dates, the
// conditionals) are those of packages/domain, which the API applies and the front reads (RG14); this
// package carries no dependency on it, so the lists of codes it repeats are held equal to the
// domain's by apps/api/tests/domain-guards.test.ts.
// The response is the brand's OWN view of its OWN campaign, for the brand alone: it carries the
// budget band, the total budget, the internal reference and the declaration of RG85, which no
// creator ever receives (D78, CA68): the creator's view is another contract (commit 08). No
// amount is computed, no commission, no net (CLAUDE.md §2, D48, D78).
import { z } from "./zod.ts";
import { exclusivityBandSchema } from "./brand-profile.ts";
import { countryCodeSchema } from "./signup.ts";

/** The six states of a campaign (09 RG3, 0303). The brand writes none of them but by submitting. */
export const CAMPAIGN_STATUSES = [
  "draft",
  "pending_review",
  "published",
  "paused",
  "closed",
  "rejected",
] as const;
export const campaignStatusSchema = z.enum(CAMPAIGN_STATUSES);
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;

/** The nature of the consideration (09 RG62, 0303 `campaigns.remuneration_kind`). */
export const REMUNERATION_KINDS = [
  "cash",
  "cash_and_gift",
  "gift_only",
  "affiliate",
] as const;
export const remunerationKindSchema = z.enum(REMUNERATION_KINDS);

/** Who bears the shipping costs of the product (09 RG24; 0303). */
export const SHIPPING_PAYERS = ["brand", "creator"] as const;
export const shippingPayerSchema = z.enum(SHIPPING_PAYERS);

/** Duration of the usage rights (09 RG39; 0303). */
export const USAGE_RIGHTS_DURATIONS = [
  "1m",
  "3m",
  "6m",
  "12m",
  "unlimited",
] as const;
export const usageRightsDurationSchema = z.enum(USAGE_RIGHTS_DURATIONS);

/** Territory of the usage rights: the world, or a short list of countries (09 RG34; 0303). */
export const USAGE_RIGHTS_TERRITORY_SCOPES = [
  "worldwide",
  "selected_countries",
] as const;
export const usageRightsTerritoryScopeSchema = z.enum(
  USAGE_RIGHTS_TERRITORY_SCOPES,
);

/** Time the brand takes to review a content: 48 hours, 5 or 10 business days (09 RG44; 0303). */
export const CONTENT_REVIEW_DELAYS = ["48h", "5bd", "10bd"] as const;
export const contentReviewDelaySchema = z.enum(CONTENT_REVIEW_DELAYS);

/** The two languages of the declaration of RG85 (05 RG85; 0305 `authorization_declaration_texts`). */
export const DECLARATION_LOCALES = ["fr", "en"] as const;
export const declarationLocaleSchema = z.enum(DECLARATION_LOCALES);
export type DeclarationLocale = z.infer<typeof declarationLocaleSchema>;

/** Ceilings of the lists, the database's too (09 RG24, RG34, RG37, RG46, RG76; 0303). */
export const CAMPAIGN_LIST_LIMITS = {
  keyMessages: 5,
  deliverables: 10,
  usageRightsTerritories: 5,
  audienceCountries: 5,
  audienceTopics: 3,
  requestedItems: 4,
  // no cap in the database for these four: the closed reference lists bound them
  audienceLanguages: 50,
  audienceBands: 50,
  audienceAgeBands: 50,
} as const;

/** The most a text of the form may hold, in characters, before the API counts the code points. */
const TEXT_CAP = {
  title: 140,
  publicSummary: 400,
  brief: 4000,
  productDescription: 600,
  restrictions: 1000,
  internalReference: 40,
  keyMessage: 200,
} as const;

/** A code of a `reference.*` table: snake_case, at most 63 characters (0201). */
const referenceCodeSchema = z
  .string()
  .max(63)
  .regex(/^[a-z0-9]+(_[a-z0-9]+)*$/);

/** The code of a currency, ISO 4217 (0003). */
const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/);

/** The code of a language, ISO 639-1 (0003). */
const languageCodeSchema = z.string().regex(/^[a-z]{2}$/);

/** A civil date written YYYY-MM-DD; that it exists on the calendar is the API's check (RG69, RG70). */
const civilDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** A choice list of distinct values, at most `max` (the caps are the database's too). */
function choiceList<T extends z.ZodType<string>>(item: T, max: number) {
  return z
    .array(item)
    .max(max)
    .refine((values) => new Set(values).size === values.length, {
      message: "duplicate",
    });
}

/** Line breaks and tabs kept, any other control character refused (a NUL never reaches the base). */
function hasForbiddenControl(value: string): boolean {
  return [...value].some(
    (character) =>
      /\p{Cc}/u.test(character) && !["\t", "\n", "\r"].includes(character),
  );
}

/**
 * A free text: a structural cap here (4 UTF-16 units per character at most, margins included), the
 * count of code points outside the margins by the API with packages/domain (RG16, RG24).
 */
function freeTextSchema(maxCharacters: number) {
  return z
    .string()
    .max(maxCharacters * 4 + 8)
    .refine((value) => !hasForbiddenControl(value), {
      message: "control_character",
    });
}

/** One deliverable line: a network, a format, a quantity (09 RG36). */
export const campaignDeliverableSchema = z.strictObject({
  networkCode: referenceCodeSchema,
  formatCode: referenceCodeSchema,
  quantity: z.number().int().min(1).max(20),
});
export type CampaignDeliverable = z.infer<typeof campaignDeliverableSchema>;

/**
 * The fields a brand enters, by block of the form (09 blocks 1 to 7; modele §2, §5): every key is
 * optional (a save sends what changed), `null` empties a single value, a list is replaced whole.
 * The block 8 (RG85) is not here: it is written by the submission alone. The exact range per creator
 * is not here either (D78: suspended, no right on it).
 */
const campaignFields = {
  // block 1: identification and texts
  title: freeTextSchema(TEXT_CAP.title).nullable().optional(),
  campaignType: referenceCodeSchema.nullable().optional(),
  publicSummary: freeTextSchema(TEXT_CAP.publicSummary).nullable().optional(),
  brief: freeTextSchema(TEXT_CAP.brief).nullable().optional(),
  internalReference: freeTextSchema(TEXT_CAP.internalReference)
    .nullable()
    .optional(),
  // block 2: product and gift
  productDescription: freeTextSchema(TEXT_CAP.productDescription)
    .nullable()
    .optional(),
  productSector: referenceCodeSchema.nullable().optional(),
  restrictions: freeTextSchema(TEXT_CAP.restrictions).nullable().optional(),
  productIsSent: z.boolean().nullable().optional(),
  productValueBand: referenceCodeSchema.nullable().optional(),
  creatorKeepsProduct: z.boolean().nullable().optional(),
  shippingCostsBorneBy: shippingPayerSchema.nullable().optional(),
  keyMessages: z
    .array(freeTextSchema(TEXT_CAP.keyMessage))
    .max(CAMPAIGN_LIST_LIMITS.keyMessages)
    .optional(),
  // block 3: deliverables, rights and exclusivity
  deliverables: z
    .array(campaignDeliverableSchema)
    .max(CAMPAIGN_LIST_LIMITS.deliverables)
    .optional(),
  usageRights: referenceCodeSchema.nullable().optional(),
  usageRightsDuration: usageRightsDurationSchema.nullable().optional(),
  usageRightsTerritoryScope: usageRightsTerritoryScopeSchema
    .nullable()
    .optional(),
  usageRightsTerritories: choiceList(
    countryCodeSchema,
    CAMPAIGN_LIST_LIMITS.usageRightsTerritories,
  ).optional(),
  exclusivity: exclusivityBandSchema.nullable().optional(),
  contentReviewDelay: contentReviewDelaySchema.nullable().optional(),
  contentDueOn: civilDateSchema.nullable().optional(),
  // block 4: audience aimed at
  audienceGender: referenceCodeSchema.nullable().optional(),
  audienceCountries: choiceList(
    countryCodeSchema,
    CAMPAIGN_LIST_LIMITS.audienceCountries,
  ).optional(),
  audienceLanguages: choiceList(
    languageCodeSchema,
    CAMPAIGN_LIST_LIMITS.audienceLanguages,
  ).optional(),
  audienceBands: choiceList(
    referenceCodeSchema,
    CAMPAIGN_LIST_LIMITS.audienceBands,
  ).optional(),
  audienceAgeBands: choiceList(
    referenceCodeSchema,
    CAMPAIGN_LIST_LIMITS.audienceAgeBands,
  ).optional(),
  audienceTopics: choiceList(
    referenceCodeSchema,
    CAMPAIGN_LIST_LIMITS.audienceTopics,
  ).optional(),
  // block 5: budget (a band chosen, never an exact amount per creator: D78, Q16)
  currency: currencyCodeSchema.nullable().optional(),
  remunerationKind: remunerationKindSchema.nullable().optional(),
  budgetBand: referenceCodeSchema.nullable().optional(),
  creatorsWanted: z.number().int().min(1).max(50).nullable().optional(),
  /** In the minor unit of the currency; kept as entered, never computed on (T16.1). */
  totalBudgetMinor: z
    .number()
    .int()
    .min(1)
    .max(Number.MAX_SAFE_INTEGER)
    .nullable()
    .optional(),
  // block 6: calendar
  applicationsCloseOn: civilDateSchema.nullable().optional(),
  startsOn: civilDateSchema.nullable().optional(),
  endsOn: civilDateSchema.nullable().optional(),
  // block 7: application
  maxApplications: z.number().int().min(1).max(200).nullable().optional(),
  requestedItems: choiceList(
    referenceCodeSchema,
    CAMPAIGN_LIST_LIMITS.requestedItems,
  ).optional(),
};

/** POST /v1/me/campaigns: a draft, empty or with some fields already (the form's first save). */
export const createCampaignBodySchema = z.strictObject(campaignFields);
export type CreateCampaignBody = z.infer<typeof createCampaignBodySchema>;

/** PATCH /v1/me/campaigns/:id: the fields to change, at least one (the autosave sends what changed). */
export const updateCampaignBodySchema = z
  .strictObject(campaignFields)
  .refine((body) => Object.keys(body).length > 0, { message: "empty" });
export type UpdateCampaignBody = z.infer<typeof updateCampaignBodySchema>;

/** The only identifier of a path: the campaign's own, opaque. */
export const campaignParamsSchema = z.strictObject({ id: z.uuid() });
export type CampaignParams = z.infer<typeof campaignParamsSchema>;

/**
 * POST /v1/me/campaigns/:id/submit: the language of the declaration of RG85, sent ONLY when the box
 * is ticked (05 RG85: never pre-ticked); no body, or an empty one, when the box is not shown or not
 * ticked. A sector that is sensitive and a box not ticked is refused (`authorizationsDeclaration`).
 */
export const submitCampaignBodySchema = z
  .strictObject({ declarationLocale: declarationLocaleSchema.optional() })
  .optional();
export type SubmitCampaignBody = z.infer<typeof submitCampaignBodySchema>;

/** Required fields (09 RG4) in the order of the form; the twin of packages/domain, held equal by a test. */
export const CAMPAIGN_REQUIRED_FIELD_CODES = [
  "title",
  "campaignType",
  "publicSummary",
  "brief",
  "productDescription",
  "productSector",
  "keyMessages",
  "productIsSent",
  "productValueBand",
  "creatorKeepsProduct",
  "shippingCostsBorneBy",
  "deliverables",
  "usageRights",
  "usageRightsDuration",
  "usageRightsTerritory",
  "exclusivity",
  "contentReviewDelay",
  "audienceCountries",
  "audienceLanguages",
  "audienceTopics",
  "currency",
  "remunerationKind",
  "budgetBand",
  "creatorsWanted",
  "applicationsCloseOn",
  "startsOn",
  "endsOn",
] as const;
export const campaignRequiredFieldSchema = z.enum(
  CAMPAIGN_REQUIRED_FIELD_CODES,
);
export type CampaignRequiredFieldCode = z.infer<
  typeof campaignRequiredFieldSchema
>;

/** The codes the form draws its choices from (labels are the front's); the active ones only. */
export const campaignReferencesSchema = z.strictObject({
  campaignTypes: z.array(z.string()),
  sectors: z.array(z.string()),
  /** The sectors whose product asks the declaration of RG85 (09 RG84). */
  sensitiveSectors: z.array(z.string()),
  /** Includes `none`, the right of no right (09 RG38, RG39). */
  usageRights: z.array(z.string()),
  networks: z.array(z.string()),
  /** A format of a network names it; a format without network (UGC) goes with any (09 RG36). */
  formats: z.array(
    z.strictObject({ code: z.string(), networkCode: z.string().nullable() }),
  ),
  countries: z.array(z.string()),
  languages: z.array(z.string()),
  topics: z.array(z.string()),
  audienceGenders: z.array(z.string()),
  audienceBands: z.array(z.string()),
  audienceAgeBands: z.array(z.string()),
  /** Only the currencies that hold a grid of bands (modele §1); the bands in increasing order. */
  currencies: z.array(
    z.strictObject({ code: z.string(), bands: z.array(z.string()) }),
  ),
  /** The items a brand may ask an applicant for: the active ones (D78: no rate). */
  requestedItems: z.array(z.string()),
  /** The exact text of the box of RG85 per language: what is shown is what is kept (hashed). */
  authorizationDeclarations: z.array(
    z.strictObject({ locale: declarationLocaleSchema, body: z.string() }),
  ),
});
export type CampaignReferences = z.infer<typeof campaignReferencesSchema>;

/**
 * GET /v1/me/campaigns/:id: the campaign of the session's own account, as stored (null, `[]` when
 * not entered), what is still missing to submit it, whether its sector asks the declaration of
 * RG85, and the codes of the form. Whatever the brand entered is returned to the brand alone.
 */
export const campaignResponseSchema = z.strictObject({
  id: z.uuid(),
  status: campaignStatusSchema,
  submittedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  title: z.string().nullable(),
  campaignType: z.string().nullable(),
  publicSummary: z.string().nullable(),
  brief: z.string().nullable(),
  internalReference: z.string().nullable(),
  productDescription: z.string().nullable(),
  productSector: z.string().nullable(),
  restrictions: z.string().nullable(),
  productIsSent: z.boolean().nullable(),
  productValueBand: z.string().nullable(),
  creatorKeepsProduct: z.boolean().nullable(),
  shippingCostsBorneBy: shippingPayerSchema.nullable(),
  keyMessages: z.array(z.string()),
  deliverables: z.array(campaignDeliverableSchema),
  usageRights: z.string().nullable(),
  usageRightsDuration: usageRightsDurationSchema.nullable(),
  usageRightsTerritoryScope: usageRightsTerritoryScopeSchema.nullable(),
  usageRightsTerritories: z.array(countryCodeSchema),
  exclusivity: exclusivityBandSchema.nullable(),
  contentReviewDelay: contentReviewDelaySchema.nullable(),
  contentDueOn: z.string().nullable(),
  audienceGender: z.string().nullable(),
  audienceCountries: z.array(countryCodeSchema),
  audienceLanguages: z.array(z.string()),
  audienceBands: z.array(z.string()),
  audienceAgeBands: z.array(z.string()),
  audienceTopics: z.array(z.string()),
  currency: z.string().nullable(),
  remunerationKind: remunerationKindSchema.nullable(),
  budgetBand: z.string().nullable(),
  creatorsWanted: z.number().int().nullable(),
  totalBudgetMinor: z.number().int().nullable(),
  applicationsCloseOn: z.string().nullable(),
  startsOn: z.string().nullable(),
  endsOn: z.string().nullable(),
  maxApplications: z.number().int().nullable(),
  requestedItems: z.array(z.string()),
  /** The instant the declaration of RG85 was ticked at the last submission; null when none. */
  authorizationsDeclaredAt: z.iso.datetime().nullable(),
  /** The sector of the product asks the declaration of RG85 (09 RG84): read by join, never stored. */
  sectorIsSensitive: z.boolean(),
  /** Required fields still missing, in the order of the form (RG4, CA3); empty: may be submitted. */
  missingRequired: z.array(campaignRequiredFieldSchema),
  references: campaignReferencesSchema,
});
export type CampaignResponse = z.infer<typeof campaignResponseSchema>;

/** One line of the list "mes campagnes": the opaque identifier, the title, the state, the dates. */
export const campaignSummarySchema = z.strictObject({
  id: z.uuid(),
  title: z.string().nullable(),
  status: campaignStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  submittedAt: z.iso.datetime().nullable(),
  applicationsCloseOn: z.string().nullable(),
  startsOn: z.string().nullable(),
  endsOn: z.string().nullable(),
});
export type CampaignSummary = z.infer<typeof campaignSummarySchema>;

/** GET /v1/me/campaigns: the brand's own campaigns, the most recently changed first. */
export const campaignListResponseSchema = z.strictObject({
  campaigns: z.array(campaignSummarySchema),
});
export type CampaignListResponse = z.infer<typeof campaignListResponseSchema>;

/**
 * The answer of POST .../submit: the campaign now `pending_review`. `changed` is false when it
 * already was (a second click, a second tab: nothing written, nothing journalised).
 */
export const submitCampaignResponseSchema = campaignResponseSchema.extend({
  changed: z.boolean(),
});
export type SubmitCampaignResponse = z.infer<
  typeof submitCampaignResponseSchema
>;

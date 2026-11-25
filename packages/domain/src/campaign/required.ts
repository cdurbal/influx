// Fields a brand must have filled in before submitting a campaign (docs/mvp/09 RG4, RG16, RG24, RG34,
// RG46, RG55, RG69; 17 §4.3; jalons/l3b/modele.md §5). Codes only, no label: the screens translate
// them. The list is the single source of the parity test with the database check of the submission
// (0305 campaigns.campaign_missing_required_fields): the database holds the same fields under their
// column names, in snake_case. A draft is never refused for what it lacks (RG108): only the
// submission reads this.
import { trimmedLength } from "../brand-profile/required.ts";
import { isCivilDate } from "./dates.ts";
import {
  CAMPAIGN_CREATORS_WANTED_MAX,
  CAMPAIGN_CREATORS_WANTED_MIN,
  hasCampaignBrief,
  hasCampaignProduct,
  hasCampaignSummary,
  hasCampaignTitle,
  isCampaignKeyMessageLengthAllowed,
} from "./limits.ts";

/** The five steps of the form (17 §4.3, M3). */
export const CAMPAIGN_STEPS = [1, 2, 3, 4, 5] as const;
export type CampaignStep = (typeof CAMPAIGN_STEPS)[number];

/**
 * Required field codes in the order of the form, each with the step that asks for it (17 §4.3):
 * 1 the offer (blocks 1 and 2), 2 the work expected (block 3), 3 for whom (block 4), 4 the budget
 * (block 5), 5 calendar and application (blocks 6 and 7). Conditional fields (see below) are in
 * the list at their place: they count as missing only when their condition holds.
 */
export const CAMPAIGN_REQUIRED_FIELDS = [
  // Step 1: block 1 (RG16), then block 2 (RG24)
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
  // Step 2: block 3 (RG34)
  "deliverables",
  "usageRights",
  "usageRightsDuration",
  "usageRightsTerritory",
  "exclusivity",
  "contentReviewDelay",
  // Step 3: block 4 (RG46)
  "audienceCountries",
  "audienceLanguages",
  "audienceTopics",
  // Step 4: block 5 (RG55, RG62, Q16)
  "currency",
  "remunerationKind",
  "budgetBand",
  "creatorsWanted",
  // Step 5: block 6 (RG69)
  "applicationsCloseOn",
  "startsOn",
  "endsOn",
] as const;

export type CampaignRequiredField = (typeof CAMPAIGN_REQUIRED_FIELDS)[number];

/** The step of the form that asks for each required field. */
export const CAMPAIGN_REQUIRED_FIELD_STEP: Readonly<
  Record<CampaignRequiredField, CampaignStep>
> = {
  title: 1,
  campaignType: 1,
  publicSummary: 1,
  brief: 1,
  productDescription: 1,
  productSector: 1,
  keyMessages: 1,
  productIsSent: 1,
  productValueBand: 1,
  creatorKeepsProduct: 1,
  shippingCostsBorneBy: 1,
  deliverables: 2,
  usageRights: 2,
  usageRightsDuration: 2,
  usageRightsTerritory: 2,
  exclusivity: 2,
  contentReviewDelay: 2,
  audienceCountries: 3,
  audienceLanguages: 3,
  audienceTopics: 3,
  currency: 4,
  remunerationKind: 4,
  budgetBand: 4,
  creatorsWanted: 4,
  applicationsCloseOn: 5,
  startsOn: 5,
  endsOn: 5,
};

/**
 * The conditional fields and what makes them required: asked only when the field they hang on has
 * been answered that way (an unanswered condition is itself listed, not its dependants).
 * - product value band, creator keeps the product, shipping costs: the product is sent (RG24);
 * - usage rights duration and territory: the rights are not `none` (RG34, RG39);
 * - budget band: the nature is not `gift_only` (RG63, CA76, Q16: affiliation included, RG64).
 */
export const CAMPAIGN_CONDITIONAL_FIELDS = {
  productIsSent: [
    "productValueBand",
    "creatorKeepsProduct",
    "shippingCostsBorneBy",
  ],
  usageRights: ["usageRightsDuration", "usageRightsTerritory"],
  remunerationKind: ["budgetBand"],
} as const satisfies Readonly<Record<string, readonly CampaignRequiredField[]>>;

/** The nature of the consideration that carries no budget band (CA76). */
export const CAMPAIGN_GIFT_ONLY = "gift_only";
/** The code of "no usage rights" (RG38, RG39). */
export const CAMPAIGN_NO_USAGE_RIGHTS = "none";
/** The territory scopes of usage rights (RG34): the world, or at most five countries. */
export const CAMPAIGN_TERRITORY_WORLDWIDE = "worldwide";
export const CAMPAIGN_TERRITORY_SELECTED = "selected_countries";

/** One deliverable line (RG36): a network (none for a UGC format), a format, a quantity. */
export type CampaignDeliverableInput = {
  readonly networkCode?: string | null;
  readonly formatCode?: string | null;
  readonly quantity?: number | null;
};

/**
 * What the required check reads: every value as stored, null or empty when not entered, under the
 * keys the database builds for the same check (modele §5, §6: the codes above in camelCase, the
 * territory split into its scope and its countries).
 */
export type CampaignInput = {
  readonly title?: string | null;
  readonly campaignType?: string | null;
  readonly publicSummary?: string | null;
  readonly brief?: string | null;
  readonly productDescription?: string | null;
  readonly productSector?: string | null;
  readonly keyMessages?: readonly string[] | null;
  readonly productIsSent?: boolean | null;
  readonly productValueBand?: string | null;
  readonly creatorKeepsProduct?: boolean | null;
  readonly shippingCostsBorneBy?: string | null;
  readonly deliverables?: readonly CampaignDeliverableInput[] | null;
  readonly usageRights?: string | null;
  readonly usageRightsDuration?: string | null;
  readonly usageRightsTerritoryScope?: string | null;
  readonly usageRightsTerritories?: readonly string[] | null;
  readonly exclusivity?: string | null;
  readonly contentReviewDelay?: string | null;
  readonly audienceCountries?: readonly string[] | null;
  readonly audienceLanguages?: readonly string[] | null;
  readonly audienceTopics?: readonly string[] | null;
  readonly currency?: string | null;
  readonly remunerationKind?: string | null;
  readonly budgetBand?: string | null;
  readonly creatorsWanted?: number | null;
  readonly applicationsCloseOn?: string | null;
  readonly startsOn?: string | null;
  readonly endsOn?: string | null;
};

function filled(value: string | null | undefined): boolean {
  return trimmedLength(value) > 0;
}

function count(value: readonly unknown[] | null | undefined): number {
  return value === null || value === undefined ? 0 : value.length;
}

/** Key messages are optional; a bullet that is there must be 10 to 200 characters (RG24). */
function keyMessagesSound(
  value: readonly string[] | null | undefined,
): boolean {
  return (value ?? []).every(isCampaignKeyMessageLengthAllowed);
}

/**
 * The territory of the usage rights holds together (RG34): the world and no country, or at least one
 * country and the scope "selected countries". A scope without its countries, countries without
 * their scope, or both at once, is one missing field.
 */
function territorySound(input: CampaignInput): boolean {
  const countries = count(input.usageRightsTerritories);
  if (input.usageRightsTerritoryScope === CAMPAIGN_TERRITORY_WORLDWIDE) {
    return countries === 0;
  }
  if (input.usageRightsTerritoryScope === CAMPAIGN_TERRITORY_SELECTED) {
    return countries >= 1;
  }
  return false;
}

/**
 * The required fields still missing, in the order of the form (RG4, CA3: the message names what is
 * missing, so the order is part of the contract). An empty list means the campaign may be
 * submitted, the profile of the brand being published (checked by the database alone) and, for a
 * sensitive category, the declaration of RG85 being ticked (see isAuthorizationDeclarationMissing).
 */
export function missingCampaignFields(
  input: CampaignInput,
): CampaignRequiredField[] {
  const productIsSent = input.productIsSent === true;
  const rightsGranted =
    filled(input.usageRights) && input.usageRights !== CAMPAIGN_NO_USAGE_RIGHTS;
  const budgetAsked =
    filled(input.remunerationKind) &&
    input.remunerationKind !== CAMPAIGN_GIFT_ONLY;

  const present: Record<CampaignRequiredField, boolean> = {
    title: hasCampaignTitle(input.title),
    campaignType: filled(input.campaignType),
    publicSummary: hasCampaignSummary(input.publicSummary),
    brief: hasCampaignBrief(input.brief),
    productDescription: hasCampaignProduct(input.productDescription),
    productSector: filled(input.productSector),
    keyMessages: keyMessagesSound(input.keyMessages),
    productIsSent: typeof input.productIsSent === "boolean",
    productValueBand: !productIsSent || filled(input.productValueBand),
    creatorKeepsProduct:
      !productIsSent || typeof input.creatorKeepsProduct === "boolean",
    shippingCostsBorneBy: !productIsSent || filled(input.shippingCostsBorneBy),
    deliverables: count(input.deliverables) >= 1,
    usageRights: filled(input.usageRights),
    usageRightsDuration: !rightsGranted || filled(input.usageRightsDuration),
    usageRightsTerritory: !rightsGranted || territorySound(input),
    exclusivity: filled(input.exclusivity),
    contentReviewDelay: filled(input.contentReviewDelay),
    audienceCountries: count(input.audienceCountries) >= 1,
    audienceLanguages: count(input.audienceLanguages) >= 1,
    audienceTopics: count(input.audienceTopics) >= 1,
    currency: filled(input.currency),
    remunerationKind: filled(input.remunerationKind),
    budgetBand: !budgetAsked || filled(input.budgetBand),
    creatorsWanted:
      typeof input.creatorsWanted === "number" &&
      Number.isInteger(input.creatorsWanted) &&
      input.creatorsWanted >= CAMPAIGN_CREATORS_WANTED_MIN &&
      input.creatorsWanted <= CAMPAIGN_CREATORS_WANTED_MAX,
    applicationsCloseOn: isCivilDate(input.applicationsCloseOn),
    startsOn: isCivilDate(input.startsOn),
    endsOn: isCivilDate(input.endsOn),
  };
  return CAMPAIGN_REQUIRED_FIELDS.filter((field) => !present[field]);
}

/** The missing fields of one step of the form (17 §4.3), in the order of the form. */
export function missingCampaignFieldsOfStep(
  input: CampaignInput,
  step: CampaignStep,
): CampaignRequiredField[] {
  return missingCampaignFields(input).filter(
    (field) => CAMPAIGN_REQUIRED_FIELD_STEP[field] === step,
  );
}

/**
 * RG85: a sensitive product category asks the brand to tick the declaration of authorizations,
 * never pre-ticked. True when the box is required and not ticked. Whether the category is sensitive
 * is reference data (reference.sectors), read by the caller: it is never copied onto the campaign.
 */
export function isAuthorizationDeclarationMissing(options: {
  readonly sectorIsSensitive: boolean | null | undefined;
  readonly declarationTicked: boolean | null | undefined;
}): boolean {
  return (
    options.sectorIsSensitive === true && options.declarationTicked !== true
  );
}

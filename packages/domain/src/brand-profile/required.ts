// Fields a brand must have filled in before submitting its profile (docs/mvp/06 RG5, RG15, RG27,
// RG35, RG61; jalons/l2b/stockage.md §9). Codes only, no label: the screens translate them. The
// list is the single source of the parity test with the database check of the submission (0203):
// the database holds the same fields under their column names.

/** Required field codes, in the order of the form: block 1 (RG15), block 2 (RG27), block 3 (RG35). */
export const BRAND_PROFILE_REQUIRED_FIELDS = [
  // Block 1, identity (RG15)
  "legalName",
  "primarySector",
  "companySize",
  "country",
  "targetMarkets",
  "workingLanguages",
  "presentation",
  // Block 2, expectations (RG27)
  "topics",
  "networks",
  "formats",
  "audienceCountries",
  // Block 3, contact person (RG35)
  "contactRole",
] as const;

export type BrandProfileRequiredField =
  (typeof BRAND_PROFILE_REQUIRED_FIELDS)[number];

/**
 * Required by RG27 but not asked while the founder's answer A of jalon L2B holds (D48, D78): the
 * indicative budget has no band to choose from. It is neither entered, nor shown, nor required;
 * it joins the required list, at its place in block 2, when the field is offered.
 */
export const BRAND_PROFILE_SUSPENDED_REQUIRED_FIELDS = ["budgetBand"] as const;

/** Shortest presentation (RG15: 120 to 1 000 characters); shorter, the field counts as missing. */
export const PRESENTATION_MIN_LENGTH = 120;
/** Longest presentation (RG15). Enforced by the schemas and the database, not by the score. */
export const PRESENTATION_MAX_LENGTH = 1000;
/** Shortest trading name once trimmed (0106 `advertiser_profiles_legal_name_length`). */
export const LEGAL_NAME_MIN_LENGTH = 2;

/** What the required check reads: every value as stored, `null` or empty when not entered. */
export type BrandProfileRequiredInput = {
  readonly legalName?: string | null;
  readonly primarySector?: string | null;
  readonly companySize?: string | null;
  readonly country?: string | null;
  readonly targetMarkets?: readonly string[] | null;
  readonly workingLanguages?: readonly string[] | null;
  readonly presentation?: string | null;
  readonly topics?: readonly string[] | null;
  readonly networks?: readonly string[] | null;
  readonly formats?: readonly string[] | null;
  readonly audienceCountries?: readonly string[] | null;
  readonly contactRole?: string | null;
};

/** Number of characters as a person counts them (a code point is one), outside the margins. */
export function trimmedLength(value: string | null | undefined): number {
  return value === null || value === undefined
    ? 0
    : Array.from(value.trim()).length;
}

function filled(value: string | null | undefined): boolean {
  return trimmedLength(value) > 0;
}

function chosen(value: readonly string[] | null | undefined): boolean {
  return value !== null && value !== undefined && value.length > 0;
}

/** Whether a name is long enough to be a name (two characters outside the margins). */
export function hasLegalName(value: string | null | undefined): boolean {
  return trimmedLength(value) >= LEGAL_NAME_MIN_LENGTH;
}

/** Whether a presentation reaches the minimum of RG15. */
export function hasPresentation(value: string | null | undefined): boolean {
  return trimmedLength(value) >= PRESENTATION_MIN_LENGTH;
}

/**
 * The required fields still missing, in the order of the form (RG61: the message names what is
 * missing, so the order is part of the contract). An empty list means the profile may be submitted;
 * the score plays no part in it (RG60, CA37).
 */
export function missingRequiredFields(
  input: BrandProfileRequiredInput,
): BrandProfileRequiredField[] {
  const present: Record<BrandProfileRequiredField, boolean> = {
    legalName: hasLegalName(input.legalName),
    primarySector: filled(input.primarySector),
    companySize: filled(input.companySize),
    country: filled(input.country),
    targetMarkets: chosen(input.targetMarkets),
    workingLanguages: chosen(input.workingLanguages),
    presentation: hasPresentation(input.presentation),
    topics: chosen(input.topics),
    networks: chosen(input.networks),
    formats: chosen(input.formats),
    audienceCountries: chosen(input.audienceCountries),
    contactRole: filled(input.contactRole),
  };
  return BRAND_PROFILE_REQUIRED_FIELDS.filter((field) => !present[field]);
}

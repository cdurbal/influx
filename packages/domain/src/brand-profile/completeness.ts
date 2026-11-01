// Completeness score of a brand profile (docs/mvp/06 RG57 to RG61, CA35 to CA38; jalons/l2b/
// stockage.md §9). The only place in the code where it is computed: the API stores it, the screens
// show it, nobody recomputes it (a `*Completeness*` function outside this package fails a guard).
// The score counts what the brand entered, never what INFLUX decided (RG59), and it opens no right
// (RG60): publication depends on the required fields, not on a threshold.
import { hasLegalName, hasPresentation } from "./required.ts";

export type CompletenessBlockId =
  "identity" | "expectations" | "trust" | "contact";

export type CompletenessCriterionCode =
  | "legalName"
  | "primarySector"
  | "companySize"
  | "country"
  | "presentation"
  | "logo"
  | "targetMarkets"
  | "workingLanguages"
  | "topics"
  | "networks"
  | "formats"
  | "budgetBand"
  | "audienceCountries"
  | "usageRights"
  | "websiteDomain"
  | "badgeRequested"
  | "contactRole"
  | "contactPhone"
  | "contactEmail";

type CriterionWeight = {
  readonly code: CompletenessCriterionCode;
  readonly block: CompletenessBlockId;
  /** Points of RG58, exactly. */
  readonly points: number;
  /**
   * Whether the brand can earn it today. Not offered: left out of the points that can be reached,
   * so the score of a complete profile is still 100 (answer 1 of jalon L2B, D48, D78).
   */
  readonly offered: boolean;
};

/** RG58, in the order of the table. Block totals: 40, 35, 15, 10. */
export const BRAND_PROFILE_WEIGHTS: readonly CriterionWeight[] = [
  { code: "legalName", block: "identity", points: 5, offered: true },
  { code: "primarySector", block: "identity", points: 5, offered: true },
  { code: "companySize", block: "identity", points: 3, offered: true },
  { code: "country", block: "identity", points: 2, offered: true },
  { code: "presentation", block: "identity", points: 10, offered: true },
  { code: "logo", block: "identity", points: 10, offered: true },
  { code: "targetMarkets", block: "identity", points: 3, offered: true },
  { code: "workingLanguages", block: "identity", points: 2, offered: true },
  { code: "topics", block: "expectations", points: 8, offered: true },
  { code: "networks", block: "expectations", points: 6, offered: true },
  { code: "formats", block: "expectations", points: 6, offered: true },
  // Suspended until a price band exists (D78, answer A of jalon L2B).
  { code: "budgetBand", block: "expectations", points: 8, offered: false },
  {
    code: "audienceCountries",
    block: "expectations",
    points: 4,
    offered: true,
  },
  { code: "usageRights", block: "expectations", points: 3, offered: true },
  { code: "websiteDomain", block: "trust", points: 5, offered: true },
  // Not possible before the badge request of L2E: counted then, as "requested", never "obtained".
  { code: "badgeRequested", block: "trust", points: 10, offered: false },
  { code: "contactRole", block: "contact", points: 3, offered: true },
  { code: "contactPhone", block: "contact", points: 4, offered: true },
  { code: "contactEmail", block: "contact", points: 3, offered: true },
];

/** What the score reads. Values as entered; nothing here comes from a decision of INFLUX (RG59). */
export type BrandProfileCompletenessInput = {
  readonly legalName?: string | null;
  readonly primarySector?: string | null;
  readonly companySize?: string | null;
  readonly country?: string | null;
  readonly presentation?: string | null;
  /** A logo is attached, whatever its moderation state (RG59). */
  readonly hasLogo?: boolean;
  readonly targetMarkets?: readonly string[] | null;
  readonly workingLanguages?: readonly string[] | null;
  readonly topics?: readonly string[] | null;
  readonly networks?: readonly string[] | null;
  readonly formats?: readonly string[] | null;
  readonly budgetBand?: string | null;
  readonly audienceCountries?: readonly string[] | null;
  /** Codes of the usage rights asked for; `none` is not a right and counts for nothing. */
  readonly usageRights?: readonly string[] | null;
  readonly websiteDomain?: string | null;
  /** A badge request is filed, pending or not (RG59, CA36). */
  readonly badgeRequested?: boolean;
  readonly contactRole?: string | null;
  readonly contactPhone?: string | null;
  readonly contactEmail?: string | null;
};

export type CompletenessCriterion = {
  readonly code: CompletenessCriterionCode;
  readonly points: number;
  readonly offered: boolean;
  /** Entered by the brand. A criterion that is not offered is never earned. */
  readonly earned: boolean;
};

export type CompletenessBlock = {
  readonly id: CompletenessBlockId;
  readonly earnedPoints: number;
  /** Points the brand can reach today in this block (not offered criteria excluded). */
  readonly attainablePoints: number;
  readonly criteria: readonly CompletenessCriterion[];
};

export type BrandProfileCompleteness = {
  /** Integer from 0 to 100; 100 only when every offered criterion is earned. */
  readonly score: number;
  readonly earnedPoints: number;
  readonly attainablePoints: number;
  /** Detail block by block (CA35), in the order of RG58. */
  readonly blocks: readonly CompletenessBlock[];
};

const BLOCK_ORDER: readonly CompletenessBlockId[] = [
  "identity",
  "expectations",
  "trust",
  "contact",
];

function text(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim().length > 0;
}

function list(value: readonly string[] | null | undefined): boolean {
  return value !== null && value !== undefined && value.length > 0;
}

function entered(
  code: CompletenessCriterionCode,
  input: BrandProfileCompletenessInput,
): boolean {
  switch (code) {
    case "legalName":
      return hasLegalName(input.legalName);
    case "primarySector":
      return text(input.primarySector);
    case "companySize":
      return text(input.companySize);
    case "country":
      return text(input.country);
    case "presentation":
      return hasPresentation(input.presentation);
    case "logo":
      return input.hasLogo === true;
    case "targetMarkets":
      return list(input.targetMarkets);
    case "workingLanguages":
      return list(input.workingLanguages);
    case "topics":
      return list(input.topics);
    case "networks":
      return list(input.networks);
    case "formats":
      return list(input.formats);
    case "budgetBand":
      return text(input.budgetBand);
    case "audienceCountries":
      return list(input.audienceCountries);
    case "usageRights":
      return (input.usageRights ?? []).some((right) => right !== "none");
    case "websiteDomain":
      return text(input.websiteDomain);
    case "badgeRequested":
      return input.badgeRequested === true;
    case "contactRole":
      return text(input.contactRole);
    case "contactPhone":
      return text(input.contactPhone);
    case "contactEmail":
      return text(input.contactEmail);
  }
}

/**
 * Score of a profile (RG57 to RG59): points earned over points that can be reached today, rounded
 * to an integer. A profile that is not complete never shows 100.
 */
export function brandProfileCompleteness(
  input: BrandProfileCompletenessInput,
): BrandProfileCompleteness {
  const blocks = BLOCK_ORDER.map((id): CompletenessBlock => {
    const criteria = BRAND_PROFILE_WEIGHTS.filter(
      (weight) => weight.block === id,
    ).map((weight): CompletenessCriterion => ({
      code: weight.code,
      points: weight.points,
      offered: weight.offered,
      earned: weight.offered && entered(weight.code, input),
    }));
    return {
      id,
      earnedPoints: criteria.reduce(
        (sum, criterion) => sum + (criterion.earned ? criterion.points : 0),
        0,
      ),
      attainablePoints: criteria.reduce(
        (sum, criterion) => sum + (criterion.offered ? criterion.points : 0),
        0,
      ),
      criteria,
    };
  });
  const earnedPoints = blocks.reduce(
    (sum, block) => sum + block.earnedPoints,
    0,
  );
  const attainablePoints = blocks.reduce(
    (sum, block) => sum + block.attainablePoints,
    0,
  );
  const rounded = Math.round((earnedPoints * 100) / attainablePoints);
  return {
    score: earnedPoints < attainablePoints ? Math.min(rounded, 99) : 100,
    earnedPoints,
    attainablePoints,
    blocks,
  };
}

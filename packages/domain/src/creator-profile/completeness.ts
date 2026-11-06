// Completeness score of a creator profile (docs/mvp/07 RG86 to RG91, CA68; jalons/l2d EC-L2D-4,
// EC-L2D-5). The only place in the code where it is computed: the API stores it, the screens show
// it, nobody recomputes it (a `*Completeness*` function outside this package fails a guard).
// The weights are RG87 exactly, and they add up to 100 by construction. The score counts what the
// creator entered, never what INFLUX decided (RG88): no moderation state, no badge, no approval is an
// input. It opens no right (RG89): publication depends on the required fields.
// At L2D the portfolio and the badge request cannot be earned (L2G, L2E): the score cannot pass 90,
// and no screen announces 90 as a goal. There is no price line (D78): the 11 points of the two rate
// lines of RG87 go to the two lines of the offer, with the same weights (EC-L2D-4).
import { hasBio, hasHeadline } from "./limits.ts";
import {
  linesOf,
  listEntered,
  mainAudienceCountryOf,
  numberEntered,
  primaryLineOf,
  textEntered,
  type CreatorNetworkLineInput,
  type CreatorProfileInput,
} from "./input.ts";

export type CreatorCompletenessBlockId =
  | "presentation"
  | "editorial"
  | "networks"
  | "audience"
  | "offer"
  | "portfolio"
  | "trust";

export type CreatorCompletenessCriterionCode =
  | "headline"
  | "bio"
  | "primaryTopic"
  | "secondaryTopics"
  | "tone"
  | "languages"
  | "residenceCountry"
  | "travelScope"
  | "firstNetworkLine"
  | "secondNetworkLine"
  | "averageReach"
  | "mainAudienceCountry"
  | "otherAudienceCountries"
  | "audienceAges"
  | "audienceGenders"
  | "firstOfferLine"
  | "secondOfferLine"
  | "formats"
  | "usageRights"
  | "exclusivity"
  | "availability"
  | "portfolioThree"
  | "portfolioFive"
  | "badgeRequested";

type CriterionWeight = {
  readonly code: CreatorCompletenessCriterionCode;
  readonly block: CreatorCompletenessBlockId;
  /** Points of RG87, exactly. */
  readonly points: number;
  /** Whether the creator can earn it today; if not, the score of a full profile stays under 100. */
  readonly offered: boolean;
};

/** RG87, in the order of the table. Block totals: 15, 14, 22, 20, 19, 8, 2. */
export const CREATOR_PROFILE_WEIGHTS: readonly CriterionWeight[] = [
  { code: "headline", block: "presentation", points: 5, offered: true },
  { code: "bio", block: "presentation", points: 10, offered: true },
  { code: "primaryTopic", block: "editorial", points: 5, offered: true },
  { code: "secondaryTopics", block: "editorial", points: 2, offered: true },
  { code: "tone", block: "editorial", points: 2, offered: true },
  { code: "languages", block: "editorial", points: 3, offered: true },
  { code: "residenceCountry", block: "editorial", points: 1, offered: true },
  { code: "travelScope", block: "editorial", points: 1, offered: true },
  // A complete line holds the network, handle, URL, the three metrics and the date (RG87, D61).
  { code: "firstNetworkLine", block: "networks", points: 16, offered: true },
  { code: "secondNetworkLine", block: "networks", points: 5, offered: true },
  { code: "averageReach", block: "networks", points: 1, offered: true },
  { code: "mainAudienceCountry", block: "audience", points: 10, offered: true },
  {
    code: "otherAudienceCountries",
    block: "audience",
    points: 3,
    offered: true,
  },
  { code: "audienceAges", block: "audience", points: 4, offered: true },
  { code: "audienceGenders", block: "audience", points: 3, offered: true },
  // The two lines of the offer take the points of the two rate lines (EC-L2D-4, D78).
  { code: "firstOfferLine", block: "offer", points: 8, offered: true },
  { code: "secondOfferLine", block: "offer", points: 3, offered: true },
  { code: "formats", block: "offer", points: 3, offered: true },
  { code: "usageRights", block: "offer", points: 2, offered: true },
  { code: "exclusivity", block: "offer", points: 1, offered: true },
  { code: "availability", block: "offer", points: 2, offered: true },
  // The portfolio is block 6 (L2G); counted when deposited, never when approved (RG88).
  { code: "portfolioThree", block: "portfolio", points: 6, offered: false },
  { code: "portfolioFive", block: "portfolio", points: 2, offered: false },
  // Not possible before the badge request of L2E: counted as "filed", never "obtained" (RG88).
  { code: "badgeRequested", block: "trust", points: 2, offered: false },
];

const BLOCK_ORDER: readonly CreatorCompletenessBlockId[] = [
  "presentation",
  "editorial",
  "networks",
  "audience",
  "offer",
  "portfolio",
  "trust",
];

export type CreatorCompletenessCriterion = {
  readonly code: CreatorCompletenessCriterionCode;
  readonly points: number;
  readonly offered: boolean;
  /** Entered by the creator. A criterion that is not offered is never earned. */
  readonly earned: boolean;
};

export type CreatorCompletenessBlock = {
  readonly id: CreatorCompletenessBlockId;
  readonly earnedPoints: number;
  /** Points the creator can reach today in this block (criteria not offered excluded). */
  readonly attainablePoints: number;
  readonly criteria: readonly CreatorCompletenessCriterion[];
};

export type CreatorProfileCompleteness = {
  /** Points earned, an integer from 0 to the attainable points (90 at L2D): no rescaling. */
  readonly score: number;
  readonly earnedPoints: number;
  /** What can be reached today: 90 while the portfolio and the badge request do not exist. */
  readonly attainablePoints: number;
  /** Detail block by block, in the order of RG87. */
  readonly blocks: readonly CreatorCompletenessBlock[];
};

/** A complete line of RG87: network, handle, URL, the three priority metrics and their date. */
function isCompleteLine(line: CreatorNetworkLineInput): boolean {
  return (
    textEntered(line.networkCode) &&
    textEntered(line.handle) &&
    textEntered(line.profileUrl) &&
    numberEntered(line.followersCount) &&
    numberEntered(line.postsLast30Days) &&
    numberEntered(line.avgCommentsPerPost) &&
    textEntered(line.figuresConfirmedAt)
  );
}

function hasShare(
  rows: readonly { readonly share: number | null }[] | undefined,
): boolean {
  return (rows ?? []).some((row) => numberEntered(row.share));
}

function entered(
  code: CreatorCompletenessCriterionCode,
  input: CreatorProfileInput,
): boolean {
  const lines = linesOf(input);
  const primary = primaryLineOf(input);
  switch (code) {
    case "headline":
      return hasHeadline(input.headline);
    case "bio":
      return hasBio(input.bio);
    case "primaryTopic":
      return textEntered(input.primaryTopicCode);
    case "secondaryTopics":
      return listEntered(input.secondaryTopicCodes);
    case "tone":
      return listEntered(input.toneCodes);
    case "languages":
      return listEntered(input.publicationLanguages);
    case "residenceCountry":
      return textEntered(input.residenceCountryCode);
    case "travelScope":
      return textEntered(input.travelScope);
    case "firstNetworkLine":
      return lines.some(isCompleteLine);
    case "secondNetworkLine":
      return lines.filter(isCompleteLine).length >= 2;
    case "averageReach":
      return lines.some((line) => numberEntered(line.avgReachPerPost));
    case "mainAudienceCountry": {
      const main = mainAudienceCountryOf(primary);
      return textEntered(main?.code) && numberEntered(main?.share);
    }
    case "otherAudienceCountries":
      return (primary?.audienceCountries ?? []).some(
        (row) => row.slot > 0 && textEntered(row.code),
      );
    case "audienceAges":
      return hasShare(primary?.audienceAges);
    case "audienceGenders":
      return hasShare(primary?.audienceGenders);
    case "firstOfferLine":
      return (input.offerLines ?? []).length >= 1;
    case "secondOfferLine":
      return (input.offerLines ?? []).length >= 2;
    case "formats":
      return (input.offerLines ?? []).some((line) =>
        textEntered(line.formatCode),
      );
    case "usageRights":
      return (input.usageRights ?? []).some((right) => right.code !== "none");
    case "exclusivity":
      return textEntered(input.maxExclusivityBand);
    case "availability":
      return textEntered(input.availabilityBand);
    case "portfolioThree":
    case "portfolioFive":
    case "badgeRequested":
      return false;
  }
}

/**
 * Score of a profile (RG86 to RG88): the points of the criteria the creator has entered, among
 * those he can earn today. A profile with every offered criterion reaches the attainable points
 * (90 at L2D), never 100. Whole numbers only: the weights are points, nothing is divided.
 */
export function creatorProfileCompleteness(
  input: CreatorProfileInput,
): CreatorProfileCompleteness {
  const blocks = BLOCK_ORDER.map((id): CreatorCompletenessBlock => {
    const criteria = CREATOR_PROFILE_WEIGHTS.filter(
      (weight) => weight.block === id,
    ).map((weight): CreatorCompletenessCriterion => ({
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
  return { score: earnedPoints, earnedPoints, attainablePoints, blocks };
}

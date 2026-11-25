// Fields a creator must have filled in blocks 1 to 5 before the profile can be submitted (docs/mvp/07
// RG4, RG16, RG113, Q15; jalons/l2d/modele.md; EC-L2D-6). Codes only, no label: the screens translate
// them. Under Q15 only the community (abonnés) of the MAIN account is required among the three
// priority metrics; the rhythm and the comments stay optional. No price is asked (D78): the offer
// asks for formats and an availability. L2G adds the portfolio (RG4, RG77: three visuals deposited)
// and « Compte vérifié » (08 RG16, D79 (6)): the list is the one `submit_own_creator_profile()` checks
// in the base (0243), held equal by db-tests/creator-profile-parity.test.ts.
import { hasBio, hasHeadline } from "./limits.ts";
import { PORTFOLIO_MIN_ITEMS } from "./portfolio.ts";
import {
  linesOf,
  listEntered,
  mainAudienceCountryOf,
  numberEntered,
  primaryLineOf,
  textEntered,
  type CreatorProfileInput,
} from "./input.ts";

/** Required field codes, in the order of the form: blocks 1 to 5 of RG16, then the portfolio and the badge. */
export const CREATOR_PROFILE_REQUIRED_FIELDS = [
  // Block 1, presentation
  "headline",
  "bio",
  // Block 2, editorial line
  "primaryTopic",
  "publicationLanguages",
  "residenceCountry",
  // Block 3, networks (RG41: at least one line, exactly one main account)
  "networkLines",
  "primaryAccount",
  "handle",
  "profileUrl",
  "followers",
  "figuresDate",
  // Block 4, audience (RG56: the main country and its share, on the main account)
  "mainAudienceCountry",
  "mainAudienceShare",
  // Block 5, offer
  "formats",
  "availability",
  // Block 6, portfolio (RG77): at least three visuals deposited, approved or not (RG88)
  "portfolio",
  // Block 7, trust (08 RG16): an active « Compte vérifié », granted by an agent and never by the score
  "accountVerified",
] as const;

export type CreatorProfileRequiredField =
  (typeof CREATOR_PROFILE_REQUIRED_FIELDS)[number];

/**
 * The required fields still missing, in the order of the form (RG90: the message names what is
 * missing, so the order is part of the contract). What hangs on the main account (abonnés, date,
 * main audience country) is missing as long as no line is marked main.
 */
export function missingCreatorRequiredFields(
  input: CreatorProfileInput,
): CreatorProfileRequiredField[] {
  const lines = linesOf(input);
  const primary = primaryLineOf(input);
  const mainCountry = mainAudienceCountryOf(primary);
  const present: Record<CreatorProfileRequiredField, boolean> = {
    headline: hasHeadline(input.headline),
    bio: hasBio(input.bio),
    primaryTopic: textEntered(input.primaryTopicCode),
    publicationLanguages: listEntered(input.publicationLanguages),
    residenceCountry: textEntered(input.residenceCountryCode),
    networkLines:
      lines.length > 0 && lines.every((line) => textEntered(line.networkCode)),
    primaryAccount: primary !== null,
    handle: lines.length > 0 && lines.every((line) => textEntered(line.handle)),
    profileUrl:
      lines.length > 0 && lines.every((line) => textEntered(line.profileUrl)),
    followers: numberEntered(primary?.followersCount),
    figuresDate: textEntered(primary?.figuresConfirmedAt),
    mainAudienceCountry: textEntered(mainCountry?.code),
    mainAudienceShare: numberEntered(mainCountry?.share),
    formats: listEntered(input.offerLines),
    availability: textEntered(input.availabilityBand),
    portfolio: (input.portfolioDeposited ?? 0) >= PORTFOLIO_MIN_ITEMS,
    accountVerified: input.accountVerified === true,
  };
  return CREATOR_PROFILE_REQUIRED_FIELDS.filter((field) => !present[field]);
}

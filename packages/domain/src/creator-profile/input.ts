// What the creator profile rules read (docs/mvp/07 RG16; jalons/l2d/modele.md). Values as the creator
// entered them, codes as the reference lists hold them; nothing here comes from a decision of INFLUX
// (RG88) and nothing is a price (D78, D48): no field for a rate card, a currency or a net exists.

/** A row of the audience of one network line: a code and the whole percentage typed for it. */
export type CreatorAudienceShareInput = {
  readonly code: string;
  /** `null` while the creator has chosen the code and not typed its share yet. */
  readonly share: number | null;
};

/** The countries of an audience: slot 0 is the main country, slots 1 to 4 the others (RG56). */
export type CreatorAudienceCountryInput = CreatorAudienceShareInput & {
  readonly slot: number;
};

export type CreatorNetworkLineInput = {
  readonly networkCode?: string | null;
  readonly isPrimary?: boolean;
  readonly handle?: string | null;
  readonly profileUrl?: string | null;
  /** Metric 1 of RG113: the community. */
  readonly followersCount?: number | null;
  /** Metric 2: publications of the last 30 days (RG114). */
  readonly postsLast30Days?: number | null;
  /** Metric 3: average comments per publication (RG115). */
  readonly avgCommentsPerPost?: number | null;
  readonly avgReachPerPost?: number | null;
  /** Set by the one action "confirm my figures" (RG50, EC-L2D-6), never typed. */
  readonly figuresConfirmedAt?: string | null;
  readonly audienceCountries?: readonly CreatorAudienceCountryInput[];
  readonly audienceAges?: readonly CreatorAudienceShareInput[];
  readonly audienceGenders?: readonly CreatorAudienceShareInput[];
};

/** A line of the offer (EC-L2D-4): a format, tied to a network or, for UGC, to none. */
export type CreatorOfferLineInput = {
  readonly networkCode?: string | null;
  readonly formatCode: string;
};

export type CreatorUsageRightInput = {
  readonly code: string;
  readonly inclusion: "included" | "optional";
};

export type CreatorProfileInput = {
  // Block 1, presentation
  readonly headline?: string | null;
  readonly bio?: string | null;
  // Block 2, editorial line
  readonly primaryTopicCode?: string | null;
  readonly secondaryTopicCodes?: readonly string[] | null;
  readonly toneCodes?: readonly string[] | null;
  readonly publicationLanguages?: readonly string[] | null;
  readonly residenceCountryCode?: string | null;
  readonly travelScope?: string | null;
  // Block 3, networks, and block 4, audience (carried by the lines, EC-L2D-9)
  readonly networkLines?: readonly CreatorNetworkLineInput[] | null;
  // Block 5, offer
  readonly offerLines?: readonly CreatorOfferLineInput[] | null;
  /** `none` is not a right and counts for nothing. */
  readonly usageRights?: readonly CreatorUsageRightInput[] | null;
  readonly maxExclusivityBand?: string | null;
  readonly availabilityBand?: string | null;
  // Block 7, trust (RG87, RG88): a badge request FILED on one of his lines, never a badge obtained.
  readonly badgeRequested?: boolean;
};

export function textEntered(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && value.trim().length > 0;
}

export function listEntered(
  value: readonly unknown[] | null | undefined,
): boolean {
  return value !== null && value !== undefined && value.length > 0;
}

export function numberEntered(value: number | null | undefined): boolean {
  return value !== null && value !== undefined;
}

/** The lines of the profile, none when the creator has not declared any. */
export function linesOf(
  input: CreatorProfileInput,
): readonly CreatorNetworkLineInput[] {
  return input.networkLines ?? [];
}

/**
 * The main account (RG41): the one line marked primary. With none or several there is no main
 * account yet, and what hangs on it (the abonnés, the date, the audience) is missing.
 */
export function primaryLineOf(
  input: CreatorProfileInput,
): CreatorNetworkLineInput | null {
  const primary = linesOf(input).filter((line) => line.isPrimary === true);
  return primary.length === 1 ? (primary[0] ?? null) : null;
}

/** The main country of the audience of a line: slot 0 (RG56). */
export function mainAudienceCountryOf(
  line: CreatorNetworkLineInput | null,
): CreatorAudienceCountryInput | null {
  return line?.audienceCountries?.find((row) => row.slot === 0) ?? null;
}

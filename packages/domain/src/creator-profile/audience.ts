// The audience shares a creator types (docs/mvp/07 RG57, CA26, CA27): whole percentages, by network
// line and by dimension (country, age, gender). The sum of a dimension never exceeds 100; below
// it is accepted and the rest reads "others", never completed (RG57). The database holds the same
// sum (0218), the screen and the API this one (RG14).

/** A dimension adds up to 100 at most (RG57). */
export const AUDIENCE_SUM_MAX = 100;

/** Whether a typed share is a whole number from 0 to 100 (RG57). */
export function isAudienceShare(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= AUDIENCE_SUM_MAX;
}

/** The sum of the shares typed in one dimension; a share not typed yet counts for nothing. */
export function audienceSum(
  shares: readonly (number | null | undefined)[],
): number {
  return shares.reduce<number>((sum, share) => sum + (share ?? 0), 0);
}

/** Whether a dimension may be saved: 140 is refused (CA26), 60 is accepted (CA27). */
export function isAudienceSumAllowed(
  shares: readonly (number | null | undefined)[],
): boolean {
  return audienceSum(shares) <= AUDIENCE_SUM_MAX;
}

/** What is left to "others" (RG57), never added to a dimension; 0 when the sum is not allowed. */
export function audienceRemainder(
  shares: readonly (number | null | undefined)[],
): number {
  return Math.max(0, AUDIENCE_SUM_MAX - audienceSum(shares));
}

// A percentage typed with two decimals, kept in basis points (docs/mvp/07 RG46, jalons/l2d EC-L2D-8:
// `engagement_rate_bp` 0 to 10 000, the unit of `reference.engagement_bands`). The conversion is made
// by the CHAIN, never by arithmetic: "3.5" is the digits "3" and "50" read as one number, and back,
// the last two digits of the count are the decimals. No division, no multiplication: a percentage is
// never a quantity to compute on in this code (docs/mvp/18 T16.1).

/** The most a percentage can be: 100.00 (RG46). */
export const BASIS_POINTS_MAX = 10000;

export type BasisPointsRefusal =
  "empty" | "invalid_format" | "too_many_decimals" | "out_of_range";

export type BasisPointsResult =
  | { readonly ok: true; readonly basisPoints: number }
  | { readonly ok: false; readonly reason: BasisPointsRefusal };

/** Digits, then at most one separator (point or comma, the two a keyboard offers) and digits. */
const TYPED_PERCENTAGE = /^(\d+)(?:[.,](\d+))?$/u;

/**
 * Reads a typed percentage ("12", "3.5", "3,50", "100") as basis points (1200, 350, 350, 10000) by
 * joining the integer digits to the two decimal digits. Refuses a sign, a thousands separator, a
 * third decimal and anything above 100.
 */
export function parsePercentageToBasisPoints(input: string): BasisPointsResult {
  const typed = input.trim();
  if (typed === "") return { ok: false, reason: "empty" };
  const parts = TYPED_PERCENTAGE.exec(typed);
  if (parts === null) return { ok: false, reason: "invalid_format" };
  const whole = parts[1] ?? "";
  const decimals = parts[2] ?? "";
  if (decimals.length > 2) return { ok: false, reason: "too_many_decimals" };
  const basisPoints = Number(whole + decimals.padEnd(2, "0"));
  if (basisPoints > BASIS_POINTS_MAX) {
    return { ok: false, reason: "out_of_range" };
  }
  return { ok: true, basisPoints };
}

/**
 * Writes basis points back as a percentage with a point ("350" gives "3.5", "1200" gives "12",
 * "5" gives "0.05"), again by the digits alone. Not an integer from 0 to 10 000: `null`.
 */
export function formatBasisPoints(basisPoints: number): string | null {
  if (
    !Number.isInteger(basisPoints) ||
    basisPoints < 0 ||
    basisPoints > BASIS_POINTS_MAX
  ) {
    return null;
  }
  const digits = String(basisPoints).padStart(3, "0");
  const whole = digits.slice(0, -2);
  const decimals = digits.slice(-2).replace(/0+$/u, "");
  return decimals === "" ? whole : `${whole}.${decimals}`;
}

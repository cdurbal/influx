// SQL helpers shared by the backoffice repositories (one definition, no copy).

/** ISO 8601 UTC, millisecond precision, as `to_char` renders it. */
export const ISO_UTC = 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';

/**
 * A Postgres array literal, every element quoted: drizzle expands a JS array into a list of
 * parameters, not into one array parameter.
 */
export function arrayLiteral(values: readonly (string | number)[]): string {
  return `{${values
    .map((value) => `"${String(value).replace(/["\\]/g, "\\$&")}"`)
    .join(",")}}`;
}

// ISO 3166-1 alpha-2 codes of every officially assigned country (249 codes), from
// @influx/contracts so that the sign-up form and the API validate against the same list (05 RG10).
// The sign-up country list shows all of them, none marked as "open to contracts" (02 §3.18, D26).
// Names are produced by Intl.DisplayNames in the page locale.
import { ISO_COUNTRY_CODES } from "@influx/contracts/countries";

export { ISO_COUNTRY_CODES };

/** Every ISO 3166-1 country, named and sorted in the given page locale. */
export function getLocalizedCountryOptions(
  locale: string,
): { code: string; name: string }[] {
  const displayNames = new Intl.DisplayNames([locale], { type: "region" });
  const collator = new Intl.Collator(locale);
  return ISO_COUNTRY_CODES.map((code) => ({
    code,
    name: displayNames.of(code) ?? code,
  })).sort((first, second) => collator.compare(first.name, second.name));
}

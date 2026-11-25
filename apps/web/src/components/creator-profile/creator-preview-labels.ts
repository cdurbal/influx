// The words of "ce que voit une marque" in the language of the page (docs/mvp/04 R8: the labels come from
// the translation files, never from the database; jalons/l2g, commit 14). The lists of the brands
// (topics, networks, formats, usage rights, exclusivity) are `brandProfile`'s, the rest `creatorProfile`'s;
// countries and languages are named by the browser's own table. A code with no label shows as itself. The
// dates are told in UTC, so that a day never moves with the creator's clock. No logic of the preview lives
// here: the view (creator-preview-view.ts) decides what is shown.
import type { useTranslations } from "next-intl";
import type { PreviewLabels } from "./creator-preview-view";

type CreatorTranslator = ReturnType<typeof useTranslations<"creatorProfile">>;
type BrandTranslator = ReturnType<typeof useTranslations<"brandProfile">>;

function displayNames(
  locale: string,
  type: "region" | "language",
): Intl.DisplayNames | null {
  try {
    return new Intl.DisplayNames([locale], { type });
  } catch {
    return null;
  }
}

export function previewLabelsOf(
  t: CreatorTranslator,
  tBrand: BrandTranslator,
  locale: string,
): PreviewLabels {
  const regions = displayNames(locale, "region");
  const languages = displayNames(locale, "language");
  const dates = new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: "UTC",
  });
  const numbers = new Intl.NumberFormat(locale);
  const own = (key: string) => t.has(key as Parameters<CreatorTranslator>[0]);
  const brand = (group: string, code: string) => {
    const key = `${group}.${code}`;
    return tBrand.has(key as Parameters<BrandTranslator>[0])
      ? tBrand(key as Parameters<BrandTranslator>[0])
      : code;
  };
  return {
    text: (key, values) => t(key as Parameters<CreatorTranslator>[0], values),
    has: own,
    topic: (code) => brand("reference.topic", code),
    network: (code) => brand("reference.network", code),
    format: (code) => brand("reference.format", code),
    usageRight: (code) => brand("reference.usage_right", code),
    exclusivity: (code) => brand("exclusivity", code),
    country: (code) => regions?.of(code) ?? code,
    language: (code) => languages?.of(code) ?? code,
    date: (iso) => dates.format(new Date(iso)),
    count: (value) => numbers.format(value),
  };
}

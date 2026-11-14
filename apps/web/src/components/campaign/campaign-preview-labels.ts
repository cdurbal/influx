// The words of "what a creator sees" (docs/mvp/09 RG102; jalons/l3b, commit 11): the translators of the
// page in, the `PreviewLabels` of campaign-preview-view.ts out. The labels of the campaign's lists are
// `campaign.*`, those of the vocabulary it shares with the brand profile (sectors, networks, formats,
// topics, exclusivity: one vocabulary, 09 RG25, RG42, RG54) are `brandProfile.*`; a code without a label
// shows as itself (04 R8: the labels are the translation files', never the database's). Countries and
// languages are named by the browser's own tables in the language of the page.
import type { useTranslations } from "next-intl";
import { getLocalizedCountryOptions } from "@/content/country-codes";
import {
  BRAND_OPTION_GROUPS,
  type PreviewLabels,
  type PreviewScope,
} from "./campaign-preview-view";

type CampaignTranslator = ReturnType<typeof useTranslations<"campaign">>;
type BrandTranslator = ReturnType<typeof useTranslations<"brandProfile">>;

/** A civil date (YYYY-MM-DD) is a day, not an instant: it is written in UTC so that no zone moves it. */
function civilDateFormatter(locale: string): (date: string) => string {
  const format = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  });
  return (date) => format.format(new Date(`${date}T00:00:00Z`));
}

export function previewLabelsOf(
  t: CampaignTranslator,
  tBrand: BrandTranslator,
  locale: string,
): PreviewLabels {
  const own = (key: string): string | null =>
    t.has(key as Parameters<CampaignTranslator>[0])
      ? t(key as Parameters<CampaignTranslator>[0])
      : null;
  const brand = (key: string): string | null =>
    tBrand.has(key as Parameters<BrandTranslator>[0])
      ? tBrand(key as Parameters<BrandTranslator>[0])
      : null;
  const countries = new Map(
    getLocalizedCountryOptions(locale).map((country) => [
      country.code,
      country.name,
    ]),
  );
  let languages: Intl.DisplayNames | null = null;
  try {
    languages = new Intl.DisplayNames([locale], { type: "language" });
  } catch {
    languages = null;
  }
  const date = civilDateFormatter(locale);
  const rowLabel = (scope: PreviewScope, key: string): string =>
    (scope === "campaign"
      ? own(`preview.rows.${key}`)
      : brand(`fields.${key}.label`)) ?? key;

  return {
    row: rowLabel,
    option: (group, code) =>
      (BRAND_OPTION_GROUPS.has(group)
        ? brand(`${group}.${code}`)
        : own(`${group}.${code}`)) ?? code,
    country: (code) => countries.get(code) ?? code,
    language: (code) => languages?.of(code) ?? code,
    civilDate: date,
    yes: tBrand("field.yes"),
    no: tBrand("field.no"),
    deliverable: (quantity, network, format) =>
      t("preview.deliverable", { quantity, network, format }),
    nature: (kind) => own(`remuneration.${kind}`) ?? kind,
    notice: t("budget.negotiate"),
    section: (id) => t(`preview.sections.${id}`),
    badge: (since) =>
      tBrand("badge.label", {
        date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
          new Date(since),
        ),
      }),
  };
}

// The choices of the lists of the campaign form, labelled in the language of the page (docs/mvp/09
// RG25, RG50; 04 R8: the labels come from the translation files, never from the database). The
// codes still active come from the API (`references`). The sectors, topics, networks, formats and
// exclusivity are the brand profile's (09 RG25, RG42, RG54: one vocabulary), so their labels are
// `brandProfile.*`, which the parity test of the base already keeps whole; the rest are
// `campaign.*`. A code without a label shows as itself. The bands of the grid are labelled with the
// currency of the campaign (`price_band.<code>`, jalons/l3b/tranches.md §4): a text, never an amount
// read from the base.
import {
  REMUNERATION_KINDS,
  USAGE_RIGHTS_DURATIONS,
  USAGE_RIGHTS_TERRITORY_SCOPES,
  CONTENT_REVIEW_DELAYS,
  SHIPPING_PAYERS,
  type CampaignReferences,
} from "@influx/contracts/campaign";
import { EXCLUSIVITY_BANDS } from "@influx/contracts/brand-profile";
import type { useTranslations } from "next-intl";
import type { ChoiceOption } from "@/components/member/ui/choice-option";
import { languageOptionsOf } from "@/components/creator-profile/creator-profile-options";
import { getLocalizedCountryOptions } from "@/content/country-codes";

type CampaignTranslator = ReturnType<typeof useTranslations<"campaign">>;
type BrandTranslator = ReturnType<typeof useTranslations<"brandProfile">>;

function labelled(
  has: (key: string) => boolean,
  read: (key: string) => string,
  group: string,
  codes: readonly string[],
): ChoiceOption[] {
  return codes.map((code) => {
    const key = `${group}.${code}`;
    return { code, label: has(key) ? read(key) : code };
  });
}

export type CampaignOptions = {
  campaignTypes: ChoiceOption[];
  sectors: ChoiceOption[];
  networks: ChoiceOption[];
  usageRights: ChoiceOption[];
  usageDurations: ChoiceOption[];
  usageTerritories: ChoiceOption[];
  exclusivities: ChoiceOption[];
  reviewDelays: ChoiceOption[];
  shippingPayers: ChoiceOption[];
  countries: ChoiceOption[];
  languages: ChoiceOption[];
  topics: ChoiceOption[];
  audienceBands: ChoiceOption[];
  audienceAgeBands: ChoiceOption[];
  audienceGenders: ChoiceOption[];
  currencies: ChoiceOption[];
  remunerations: ChoiceOption[];
  requestedItems: ChoiceOption[];
};

/** The currency, named by the browser's own table in the language of the page: "EUR · euro". */
function currencyLabelOf(locale: string, code: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: "currency" }).of(code);
    return name === undefined ? code : `${code} · ${name}`;
  } catch {
    return code;
  }
}

export function campaignOptionsOf(
  t: CampaignTranslator,
  tBrand: BrandTranslator,
  locale: string,
  references: CampaignReferences,
): CampaignOptions {
  const own = (group: string, codes: readonly string[]) =>
    labelled(
      (key) => t.has(key as Parameters<CampaignTranslator>[0]),
      (key) => t(key as Parameters<CampaignTranslator>[0]),
      group,
      codes,
    );
  const brand = (group: string, codes: readonly string[]) =>
    labelled(
      (key) => tBrand.has(key as Parameters<BrandTranslator>[0]),
      (key) => tBrand(key as Parameters<BrandTranslator>[0]),
      group,
      codes,
    );
  const activeCountries = new Set(references.countries);
  return {
    campaignTypes: own("campaign_type", references.campaignTypes),
    sectors: brand("reference.sector", references.sectors),
    networks: brand("reference.network", references.networks),
    // `none` is a right of its own on this form (RG38: four values), unlike the profile's list.
    usageRights: own("usage_right", references.usageRights),
    usageDurations: own("usage_duration", USAGE_RIGHTS_DURATIONS),
    usageTerritories: own("usage_territory", USAGE_RIGHTS_TERRITORY_SCOPES),
    exclusivities: brand("exclusivity", EXCLUSIVITY_BANDS),
    reviewDelays: own("review_delay", CONTENT_REVIEW_DELAYS),
    shippingPayers: own("shipping", SHIPPING_PAYERS),
    countries: getLocalizedCountryOptions(locale)
      .filter((country) => activeCountries.has(country.code))
      .map((country) => ({ code: country.code, label: country.name })),
    languages: languageOptionsOf(locale, references.languages),
    topics: brand("reference.topic", references.topics),
    audienceBands: own("audience_band", references.audienceBands),
    audienceAgeBands: own("age_band", references.audienceAgeBands),
    audienceGenders: own("audience_gender", references.audienceGenders),
    currencies: references.currencies.map((currency) => ({
      code: currency.code,
      label: currencyLabelOf(locale, currency.code),
    })),
    remunerations: own("remuneration", REMUNERATION_KINDS),
    requestedItems: own("requested_item", references.requestedItems),
  };
}

/**
 * The bands of the grid of a currency, labelled with its ISO code (tranches.md §4: "100 à 250 EUR"):
 * none without a currency, since a band belongs to the grid of one. Their order is the API's, the
 * increasing one.
 */
export function bandOptionsOf(
  t: CampaignTranslator,
  references: CampaignReferences,
  currency: string | null,
): ChoiceOption[] {
  if (currency === null) {
    return [];
  }
  const bands =
    references.currencies.find((entry) => entry.code === currency)?.bands ?? [];
  return bands.map((code) => {
    const key = `price_band.${code}` as Parameters<CampaignTranslator>[0];
    return {
      code,
      label: t.has(key) ? t(key, { currency }) : code,
    };
  });
}

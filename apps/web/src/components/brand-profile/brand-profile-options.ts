// The choices of the lists of "mon profil de marque", labelled in the language of the page
// (docs/mvp/06 RG26: the labels come from the translation files, never from the database). The codes
// still active come from the API (`references`); a code without a label shows as itself, which the
// parity test between the base and brand-profile.json keeps from happening (L2B commit 10).
import {
  COLLABORATION_RHYTHMS,
  COMPANY_SIZE_BANDS,
  CONTACT_ROLES,
  EXCLUSIVITY_BANDS,
  type BrandProfileReferences,
} from "@influx/contracts/brand-profile";
import type { useTranslations } from "next-intl";
import type { ChoiceOption } from "@/components/member/ui/choice-option";
import { getLocalizedCountryOptions } from "@/content/country-codes";

type Translator = ReturnType<typeof useTranslations<"brandProfile">>;

function labelled(
  t: Translator,
  group: string,
  codes: readonly string[],
): ChoiceOption[] {
  return codes.map((code) => {
    const key = `${group}.${code}` as Parameters<Translator>[0];
    return { code, label: t.has(key) ? t(key) : code };
  });
}

export type ProfileOptions = {
  sectors: ChoiceOption[];
  topics: ChoiceOption[];
  networks: ChoiceOption[];
  formats: ChoiceOption[];
  usageRights: ChoiceOption[];
  countries: ChoiceOption[];
  languages: ChoiceOption[];
  companySizes: ChoiceOption[];
  exclusivities: ChoiceOption[];
  rhythms: ChoiceOption[];
  contactRoles: ChoiceOption[];
};

export function profileOptionsOf(
  t: Translator,
  locale: string,
  references: BrandProfileReferences,
): ProfileOptions {
  const active = new Set(references.countries);
  return {
    sectors: labelled(t, "reference.sector", references.sectors),
    topics: labelled(t, "reference.topic", references.topics),
    networks: labelled(t, "reference.network", references.networks),
    formats: labelled(t, "reference.format", references.formats),
    // `none` is no right: it is the empty list (L2-amend), never a box to tick.
    usageRights: labelled(
      t,
      "reference.usage_right",
      references.usageRights.filter((code) => code !== "none"),
    ),
    countries: getLocalizedCountryOptions(locale)
      .filter((country) => active.has(country.code))
      .map((country) => ({ code: country.code, label: country.name })),
    languages: labelled(t, "workingLanguage", references.languages),
    companySizes: labelled(t, "companySize", COMPANY_SIZE_BANDS),
    exclusivities: labelled(t, "exclusivity", EXCLUSIVITY_BANDS),
    rhythms: labelled(t, "rhythm", COLLABORATION_RHYTHMS),
    contactRoles: labelled(t, "contactRole", CONTACT_ROLES),
  };
}

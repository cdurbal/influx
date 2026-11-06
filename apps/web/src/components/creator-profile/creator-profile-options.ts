// The choices of the lists of "mon profil" (creator), labelled in the language of the page (docs/mvp
// 07 RG33 to RG39; 04 R8: the labels come from the translation files, never from the database). The
// codes still active come from the API (`references`). The topics are the brands' (07 RG33: one
// vocabulary for creators and campaigns), so their labels are `brandProfile.reference.topic`, which
// the parity test of the base already keeps whole. A code without a label shows as itself. The
// languages are named by the browser's own table (`Intl.DisplayNames`), in the language of the page.
import {
  AVAILABILITY_BANDS,
  COLLABORATION_EXPERIENCE_BANDS,
  CREATOR_EXCLUSIVITY_BANDS,
  DELIVERY_LEAD_BANDS,
  TRAVEL_SCOPES,
  type CreatorProfileReferences,
} from "@influx/contracts/creator-profile";
import type { useTranslations } from "next-intl";
import type { ChoiceOption } from "@/components/member/ui/choice-option";
import { networkCodesOf } from "./creator-networks-view";

type CreatorTranslator = ReturnType<typeof useTranslations<"creatorProfile">>;
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

/** The languages of the reference list, named in the language of the page and sorted by name. */
export function languageOptionsOf(
  locale: string,
  codes: readonly string[],
): ChoiceOption[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: "language" });
  } catch {
    names = null;
  }
  return codes
    .map((code) => ({ code, label: names?.of(code) ?? code }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

/** The networks a creator may add: the networks of the formats of the reference lists, labelled as the brand side does. */
export function networkOptionsOf(
  tBrand: BrandTranslator,
  references: CreatorProfileReferences,
): ChoiceOption[] {
  return labelled(
    (key) => tBrand.has(key as Parameters<BrandTranslator>[0]),
    (key) => tBrand(key as Parameters<BrandTranslator>[0]),
    "reference.network",
    networkCodesOf(references.formats),
  );
}

/** The label of a band derived by the system (audience, rhythm, comments), or its code when none is written. */
export function bandLabelOf(
  t: CreatorTranslator,
  group: string,
  code: string,
): string {
  const key = `reference.${group}.${code}`;
  return t.has(key as Parameters<CreatorTranslator>[0])
    ? t(key as Parameters<CreatorTranslator>[0])
    : code;
}

/** The formats of one network (or of none: UGC, published by no network), as the boxes of block 5 draw them. */
export type FormatGroup = {
  networkCode: string | null;
  label: string;
  options: ChoiceOption[];
};

export type CreatorProfileOptions = {
  topics: ChoiceOption[];
  tones: ChoiceOption[];
  languages: ChoiceOption[];
  experiences: ChoiceOption[];
  travelScopes: ChoiceOption[];
  // Block 5, "Mon offre" (commit 14): drawn from the reference lists the API says are still active.
  formatGroups: FormatGroup[];
  usageRights: ChoiceOption[];
  sectors: ChoiceOption[];
  deliveryLeads: ChoiceOption[];
  exclusivities: ChoiceOption[];
  availabilities: ChoiceOption[];
};

/** The formats of the reference list, one group per network in the order of the list, UGC last (07 §G). */
function formatGroupsOf(
  t: CreatorTranslator,
  tBrand: BrandTranslator,
  references: CreatorProfileReferences,
): FormatGroup[] {
  const has = (key: string) =>
    tBrand.has(key as Parameters<BrandTranslator>[0]);
  const read = (key: string) => tBrand(key as Parameters<BrandTranslator>[0]);
  const networks = networkCodesOf(references.formats);
  const groups: FormatGroup[] = [];
  for (const networkCode of [...networks, null]) {
    const codes = references.formats
      .filter((format) => format.networkCode === networkCode)
      .map((format) => format.code);
    if (codes.length === 0) {
      continue;
    }
    groups.push({
      networkCode,
      label:
        networkCode === null
          ? t("offer.ugcGroup")
          : (labelled(has, read, "reference.network", [networkCode])[0]
              ?.label ?? networkCode),
      options: labelled(has, read, "reference.format", codes),
    });
  }
  return groups;
}

export function creatorOptionsOf(
  t: CreatorTranslator,
  tBrand: BrandTranslator,
  locale: string,
  references: CreatorProfileReferences,
): CreatorProfileOptions {
  const own = (group: string, codes: readonly string[]) =>
    labelled(
      (key) => t.has(key as Parameters<CreatorTranslator>[0]),
      (key) => t(key as Parameters<CreatorTranslator>[0]),
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
  return {
    topics: brand("reference.topic", references.topics),
    tones: own("reference.tone", references.tones),
    languages: languageOptionsOf(locale, references.languages),
    experiences: own("experience", COLLABORATION_EXPERIENCE_BANDS),
    travelScopes: own("travel", TRAVEL_SCOPES),
    formatGroups: formatGroupsOf(t, tBrand, references),
    // `none` is no right (07 RG73): no box exists for it, an empty list says it.
    usageRights: brand(
      "reference.usage_right",
      references.usageRights.filter((code) => code !== "none"),
    ),
    sectors: brand("reference.sector", references.sectors),
    deliveryLeads: own("offer.delivery", DELIVERY_LEAD_BANDS),
    // The words of the exclusivity are the brands' (one vocabulary for both sides, 07 §G).
    exclusivities: brand("exclusivity", CREATOR_EXCLUSIVITY_BANDS),
    availabilities: own("offer.availability", AVAILABILITY_BANDS),
  };
}

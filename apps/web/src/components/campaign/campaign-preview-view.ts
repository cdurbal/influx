// The rows of "what a creator sees" (docs/mvp/09 RG98, RG102, CA15, CA68; D48, D78; jalons/l3b, commit 11),
// pure: the answer of `GET /v1/me/campaigns/:id/creator-view` in, the sections and rows to draw out. The
// answer is the ONLY input (RG102: never a reconstitution, nothing of the draft): a key that is null or
// empty makes no row, a key the answer does not hold cannot be asked for. A code is written by `labels`
// (the translation files, 04 R8), a code without a label shows as itself. No amount, band, currency, total
// budget or internal reference is in the answer and none is added here (CLAUDE.md §2, D48, D78); the
// consideration is its NATURE, then the notice of the answer. No address, link or button to contact the
// brand is built (CA15): the website is the domain, as text.
import type {
  CampaignBrandView,
  CampaignCreatorView,
  CampaignCreatorViewResponse,
} from "@influx/contracts/campaign-creator-view";
import type { CampaignStep } from "./campaign-domain";
import { AVAILABLE_STEPS } from "./campaign-view";

/** The query parameter of the preview that says where it was opened from (L3BU-1). */
export const PREVIEW_ORIGIN_PARAMETER = "from";

/** The value naming the list of campaigns; a step is named by its number. */
const PREVIEW_ORIGIN_LIST = "list";

/** Where the way back of the preview leads: the list, or the campaign (at a step when it is known). */
export type PreviewOrigin =
  { to: "list" } | { to: "campaign"; step: CampaignStep | null };

/** The `?from=` a link to the preview carries: the step it leaves, or the list. */
export function previewOriginQuery(from: CampaignStep | "list"): string {
  return `?${PREVIEW_ORIGIN_PARAMETER}=${from === "list" ? PREVIEW_ORIGIN_LIST : from}`;
}

/** The origin a `?from=` of the address names; the campaign itself when it names nothing known. */
export function previewOriginOf(
  value: string | string[] | undefined,
): PreviewOrigin {
  const text = Array.isArray(value) ? value[0] : value;
  if (text === PREVIEW_ORIGIN_LIST) {
    return { to: "list" };
  }
  const step = AVAILABLE_STEPS.find((candidate) => String(candidate) === text);
  return { to: "campaign", step: step ?? null };
}

/** Where the label of a row is read: the campaign's own list, or the brand profile's. */
export type PreviewScope = "campaign" | "brand";

/** The lists whose codes are labelled in the translation files, by the file that holds them (04 R8). */
export type OptionGroup =
  | "campaign_type"
  | "shipping"
  | "requested_item"
  | "usage_right"
  | "usage_duration"
  | "usage_territory"
  | "review_delay"
  | "audience_band"
  | "age_band"
  | "audience_gender"
  | "reference.sector"
  | "reference.network"
  | "reference.topic"
  | "reference.format"
  | "reference.usage_right"
  | "exclusivity"
  | "companySize"
  | "rhythm"
  | "contactRole"
  | "workingLanguage";

/** The groups read in `brandProfile` rather than in `campaign` (one vocabulary with the profile, RG25). */
export const BRAND_OPTION_GROUPS: ReadonlySet<OptionGroup> =
  new Set<OptionGroup>([
    "reference.sector",
    "reference.network",
    "reference.topic",
    "reference.format",
    "reference.usage_right",
    "exclusivity",
    "companySize",
    "rhythm",
    "contactRole",
    "workingLanguage",
  ]);

export type PreviewSectionId =
  "offer" | "product" | "work" | "audience" | "remuneration" | "calendar";

/** What the screen needs written: every word comes from here, none from this file. */
export type PreviewLabels = {
  row: (scope: PreviewScope, key: string) => string;
  option: (group: OptionGroup, code: string) => string;
  country: (code: string) => string;
  language: (code: string) => string;
  /** A civil date (YYYY-MM-DD) as the language writes it. */
  civilDate: (date: string) => string;
  yes: string;
  no: string;
  deliverable: (quantity: number, network: string, format: string) => string;
  nature: (kind: string) => string;
  /** « À négocier avec votre commercial » (D78), the notice the answer carries. */
  notice: string;
  section: (id: PreviewSectionId) => string;
  badge: (since: string) => string;
};

export type PreviewRow =
  | { key: string; label: string; kind: "text"; text: string }
  | { key: string; label: string; kind: "paragraph"; text: string }
  | { key: string; label: string; kind: "list"; items: string[] };

export type PreviewSection = {
  id: PreviewSectionId;
  title: string;
  rows: PreviewRow[];
};

export type PreviewBrand = {
  name: string;
  hasLogo: boolean;
  /** « Marque vérifiée le … », when the badge holds. */
  badge: string | null;
  rows: PreviewRow[];
};

/** The separator of a short list written on one line. */
const JOIN = ", ";

/** A row from a value, or nothing when the answer holds nothing for it. */
function textRow(
  key: string,
  label: string,
  text: string | null,
): PreviewRow[] {
  return text === null || text === ""
    ? []
    : [{ key, label, kind: "text", text }];
}

function paragraphRow(
  key: string,
  label: string,
  text: string | null,
): PreviewRow[] {
  return text === null || text.trim() === ""
    ? []
    : [{ key, label, kind: "paragraph", text }];
}

function listRow(key: string, label: string, items: string[]): PreviewRow[] {
  return items.length === 0 ? [] : [{ key, label, kind: "list", items }];
}

function joinedRow(key: string, label: string, items: string[]): PreviewRow[] {
  return textRow(key, label, items.length === 0 ? null : items.join(JOIN));
}

/** A yes or a no written in words; null is no row (nothing was answered). */
function booleanText(value: boolean | null, labels: PreviewLabels) {
  return value === null ? null : value ? labels.yes : labels.no;
}

function optionText(
  group: OptionGroup,
  code: string | null,
  labels: PreviewLabels,
): string | null {
  return code === null ? null : labels.option(group, code);
}

function optionList(
  group: OptionGroup,
  codes: readonly string[],
  labels: PreviewLabels,
): string[] {
  return codes.map((code) => labels.option(group, code));
}

function dateText(date: string | null, labels: PreviewLabels): string | null {
  return date === null ? null : labels.civilDate(date);
}

/** The sections of the campaign, in the order a creator reads them; a section without a row is absent. */
export function previewSectionsOf(
  response: CampaignCreatorViewResponse,
  labels: PreviewLabels,
): PreviewSection[] {
  const view: CampaignCreatorView = response.campaign;
  const row = (key: string) => labels.row("campaign", key);
  const section = (
    id: PreviewSectionId,
    rows: PreviewRow[],
  ): PreviewSection => ({
    id,
    title: labels.section(id),
    rows,
  });

  const offer = [
    ...textRow(
      "campaignType",
      row("campaignType"),
      optionText("campaign_type", view.campaignType, labels),
    ),
    ...paragraphRow("publicSummary", row("publicSummary"), view.publicSummary),
    ...paragraphRow("brief", row("brief"), view.brief),
    ...listRow("keyMessages", row("keyMessages"), view.keyMessages),
    ...paragraphRow("restrictions", row("restrictions"), view.restrictions),
  ];
  const product = [
    ...paragraphRow(
      "productDescription",
      row("productDescription"),
      view.productDescription,
    ),
    ...textRow(
      "productSector",
      row("productSector"),
      optionText("reference.sector", view.productSector, labels),
    ),
    ...textRow(
      "productIsSent",
      row("productIsSent"),
      booleanText(view.productIsSent, labels),
    ),
    ...textRow(
      "creatorKeepsProduct",
      row("creatorKeepsProduct"),
      booleanText(view.creatorKeepsProduct, labels),
    ),
    ...textRow(
      "shippingCostsBorneBy",
      row("shippingCostsBorneBy"),
      optionText("shipping", view.shippingCostsBorneBy, labels),
    ),
  ];
  const work = [
    ...listRow(
      "deliverables",
      row("deliverables"),
      view.deliverables.map((line) =>
        labels.deliverable(
          line.quantity,
          labels.option("reference.network", line.networkCode),
          labels.option("reference.format", line.formatCode),
        ),
      ),
    ),
    ...joinedRow(
      "networks",
      row("networks"),
      optionList("reference.network", view.networks, labels),
    ),
    ...textRow(
      "usageRights",
      row("usageRights"),
      optionText("usage_right", view.usageRights, labels),
    ),
    ...textRow(
      "usageRightsDuration",
      row("usageRightsDuration"),
      optionText("usage_duration", view.usageRightsDuration, labels),
    ),
    ...textRow(
      "usageRightsTerritoryScope",
      row("usageRightsTerritoryScope"),
      optionText("usage_territory", view.usageRightsTerritoryScope, labels),
    ),
    ...joinedRow(
      "usageRightsTerritories",
      row("usageRightsTerritories"),
      view.usageRightsTerritories.map(labels.country),
    ),
    ...textRow(
      "exclusivity",
      row("exclusivity"),
      optionText("exclusivity", view.exclusivity, labels),
    ),
    ...textRow(
      "contentReviewDelay",
      row("contentReviewDelay"),
      optionText("review_delay", view.contentReviewDelay, labels),
    ),
    ...listRow(
      "requestedItems",
      row("requestedItems"),
      optionList("requested_item", view.requestedItems, labels),
    ),
  ];
  const audience = [
    ...joinedRow(
      "audienceCountries",
      row("audienceCountries"),
      view.audienceCountries.map(labels.country),
    ),
    ...joinedRow(
      "audienceLanguages",
      row("audienceLanguages"),
      view.audienceLanguages.map(labels.language),
    ),
    ...joinedRow(
      "audienceTopics",
      row("audienceTopics"),
      optionList("reference.topic", view.audienceTopics, labels),
    ),
    ...joinedRow(
      "audienceBands",
      row("audienceBands"),
      optionList("audience_band", view.audienceBands, labels),
    ),
    ...joinedRow(
      "audienceAgeBands",
      row("audienceAgeBands"),
      optionList("age_band", view.audienceAgeBands, labels),
    ),
    ...textRow(
      "audienceGender",
      row("audienceGender"),
      optionText("audience_gender", view.audienceGender, labels),
    ),
  ];
  // The consideration: its nature, then the notice of the answer (D78). Never a figure.
  const remuneration = [
    ...textRow(
      "remunerationKind",
      row("remunerationKind"),
      view.remunerationKind === null
        ? null
        : labels.nature(view.remunerationKind),
    ),
    ...textRow(
      "creatorsWanted",
      row("creatorsWanted"),
      view.creatorsWanted === null ? null : String(view.creatorsWanted),
    ),
    ...textRow("remunerationNotice", row("remunerationNotice"), labels.notice),
  ];
  const calendar = [
    ...textRow(
      "applicationsCloseOn",
      row("applicationsCloseOn"),
      dateText(view.applicationsCloseOn, labels),
    ),
    ...textRow(
      "contentDueOn",
      row("contentDueOn"),
      dateText(view.contentDueOn, labels),
    ),
    ...textRow("startsOn", row("startsOn"), dateText(view.startsOn, labels)),
    ...textRow("endsOn", row("endsOn"), dateText(view.endsOn, labels)),
  ];

  return [
    section("offer", offer),
    section("product", product),
    section("work", work),
    section("audience", audience),
    section("remuneration", remuneration),
    section("calendar", calendar),
  ].filter((entry) => entry.rows.length > 0);
}

/** The published brand profile as the answer carries it; null while the profile is not published (06 RG73). */
export function previewBrandOf(
  response: CampaignCreatorViewResponse,
  labels: PreviewLabels,
): PreviewBrand | null {
  const brand: CampaignBrandView | null = response.brand;
  if (brand === null) {
    return null;
  }
  const row = (key: string) => labels.row("brand", key);
  return {
    name: brand.companyName,
    hasLogo: brand.hasLogo,
    badge: brand.badge === null ? null : labels.badge(brand.badge.since),
    rows: [
      ...textRow(
        "primarySector",
        row("primarySector"),
        optionText("reference.sector", brand.primarySector, labels),
      ),
      ...joinedRow(
        "secondarySectors",
        row("secondarySectors"),
        optionList("reference.sector", brand.secondarySectors, labels),
      ),
      ...textRow(
        "companySize",
        row("companySize"),
        optionText("companySize", brand.companySize, labels),
      ),
      ...textRow("country", row("country"), labels.country(brand.country)),
      ...joinedRow(
        "targetMarkets",
        row("targetMarkets"),
        brand.targetMarkets.map(labels.country),
      ),
      ...joinedRow(
        "workingLanguages",
        row("workingLanguages"),
        optionList("workingLanguage", brand.workingLanguages, labels),
      ),
      ...textRow("website", row("website"), brand.website),
      ...paragraphRow("presentation", row("presentation"), brand.presentation),
      ...joinedRow(
        "topics",
        row("topics"),
        optionList("reference.topic", brand.topics, labels),
      ),
      ...joinedRow(
        "networks",
        row("networks"),
        optionList("reference.network", brand.networks, labels),
      ),
      ...joinedRow(
        "formats",
        row("formats"),
        optionList("reference.format", brand.formats, labels),
      ),
      ...joinedRow(
        "audienceCountries",
        row("audienceCountries"),
        brand.audienceCountries.map(labels.country),
      ),
      ...joinedRow(
        "usageRights",
        row("usageRights"),
        optionList("reference.usage_right", brand.usageRights, labels),
      ),
      ...textRow(
        "exclusivityBand",
        row("exclusivityBand"),
        optionText("exclusivity", brand.exclusivityBand, labels),
      ),
      ...textRow(
        "collaborationRhythm",
        row("collaborationRhythm"),
        optionText("rhythm", brand.collaborationRhythm, labels),
      ),
      ...textRow(
        "offersNonMonetary",
        row("offersNonMonetary"),
        booleanText(brand.offersNonMonetary, labels),
      ),
      ...textRow(
        "contactRole",
        row("contactRole"),
        optionText("contactRole", brand.contactRole, labels),
      ),
    ],
  };
}

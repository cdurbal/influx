// The alerts of an entry of queue 7 (docs/mvp/09 RG21 to RG23, RG87, RG95; 15 RG93; jalons/l3c fiche
// invariant 12), assembled from texts the repositories read. Pure: the detection is packages/domain's,
// the text that matched is never returned, nothing is stored and nothing is logged. An alert informs, it
// never refuses: the moderator decides (RG21).
import type {
  CampaignAlertCode,
  CampaignTextAlert,
} from "@influx/contracts/campaign-review";
import { detectCampaignText } from "@influx/domain/campaign";

/** The free texts of a campaign the detection reads (packages/domain `CAMPAIGN_FREE_TEXT_FIELDS`). */
export type ExaminedCampaign = {
  title: string | null;
  publicSummary: string | null;
  brief: string | null;
  productDescription: string | null;
  restrictions: string | null;
  keyMessages: readonly string[];
};

type Field = CampaignTextAlert["field"];

/** The findings of one text, grouped by kind: one alert per kind, its shapes in the order found. */
function alertsOfText(
  field: Field,
  position: number | null,
  text: string | null,
): CampaignTextAlert[] {
  const byKind = new Map<CampaignTextAlert["code"], Set<string>>();
  for (const finding of detectCampaignText(text)) {
    const shapes = byKind.get(finding.kind) ?? new Set<string>();
    shapes.add(finding.signal);
    byKind.set(finding.kind, shapes);
  }
  return [...byKind].map(([code, shapes]) => ({
    code,
    field,
    position,
    signals: [...shapes] as CampaignTextAlert["signals"],
  }));
}

/** The alerts of the decision view and the record: the field, the key message, the kinds of signal. */
export function textAlertsOf(examined: ExaminedCampaign): CampaignTextAlert[] {
  return [
    ...alertsOfText("title", null, examined.title),
    ...alertsOfText("publicSummary", null, examined.publicSummary),
    ...alertsOfText("brief", null, examined.brief),
    ...alertsOfText("productDescription", null, examined.productDescription),
    ...alertsOfText("restrictions", null, examined.restrictions),
    ...examined.keyMessages.flatMap((message, rank) =>
      alertsOfText("keyMessages", rank, message),
    ),
  ];
}

/** The codes of a list line: each kind shown once, then the duplicate (RG95). */
export function alertCodesOf(
  examined: ExaminedCampaign,
  duplicate: boolean,
): CampaignAlertCode[] {
  const kinds = new Set(textAlertsOf(examined).map((alert) => alert.code));
  const codes: CampaignAlertCode[] = (
    ["contact", "link", "amount"] as const
  ).filter((kind) => kinds.has(kind));
  if (duplicate) {
    codes.push("duplicate");
  }
  return codes;
}

// Queue 7, « campagnes à valider », as a list, in words (docs/mvp/09 RG5, RG85, RG87, RG95; 15 RG27 C5, RG33;
// 17b §2.7 line 6, §3.8; jalons/l3c/modele.md §1; L3C-08). Pure functions, outside the components. No rule is
// decided here (apps/api says what is overdue, who holds what and which entries the caller may see); the list
// shows the brand, the title, the category, the mention of the enhanced review and the alerts, never a text of
// the campaign nor a band (09 RG87: the decision screen holds them, behind a logged opening).
import type { CampaignEntryRow } from "@influx/contracts/campaign-review";
import { messages } from "@/messages/fr";
import { humanCode } from "./queue-review-facts";

const t = messages.campaignQueue;

/** The address of the screen of the queue, and of one of its entries (`${LIST}/${id}`). */
export const CAMPAIGN_REVIEW_LIST = "/files/campagnes";

/** The title of a campaign as the list and the link name it. */
export function campaignTitleWords(
  row: Pick<CampaignEntryRow, "title">,
): string {
  return row.title === null || row.title.trim() === "" ? t.untitled : row.title;
}

export function campaignBrandWords(
  row: Pick<CampaignEntryRow, "brandName">,
): string {
  return row.brandName === null || row.brandName.trim() === ""
    ? t.unknownBrand
    : row.brandName;
}

/** The category of the campaign: the code of the reference list, written readable. */
export function campaignCategoryWords(
  row: Pick<CampaignEntryRow, "campaignType">,
): string {
  return row.campaignType === null ? t.none : humanCode(row.campaignType);
}

/** One examination, or the two of an enhanced review (09 RG85): written, never by a colour alone. */
export function campaignReviewWords(
  row: Pick<CampaignEntryRow, "phase" | "firstReviewer">,
): string {
  switch (row.phase) {
    case "single":
      return t.review.single;
    case "first":
      return t.review.first;
    case "second":
      return t.review.second(row.firstReviewer?.displayName ?? null);
  }
}

/** The line under a row: its alerts in words, or nothing (09 RG95: informative, never a refusal). */
export function campaignAlertNote(
  row: Pick<CampaignEntryRow, "alerts">,
): string | null {
  return row.alerts.length === 0
    ? null
    : messages.queueList.alertLine(
        row.alerts.map((code) => t.alerts[code]).join(" · "),
      );
}

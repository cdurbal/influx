// The alerts of an entry of queues 2 and 3 (docs/mvp/07 RG27, RG28; 15 RG93; jalons/l2g/modele.md
// EC-L2G-12), assembled from texts the repositories read. Pure: the detection is packages/domain's, the
// text that matched is never returned, nothing is stored and nothing is logged (fiche invariant 13).
// An alert informs, it never refuses: the moderator decides (RG93: « signal non bloquant »).
import type {
  CreatorAlertCode,
  CreatorReviewAlert,
} from "@influx/contracts/creator-queues";
import { detectDirectContact } from "@influx/domain/creator-profile";

/** What the moderator examines of a list line: the texts, a proposal replacing the live text. */
export type ExaminedTexts = {
  headline: string | null;
  bio: string | null;
  /** The captions of the visuals shown (pending or approved); the caption of the visual in queue 3. */
  captions: readonly (string | null)[];
};

/** What the moderator examines in a decision view: the same texts, the captions by their visual. */
export type ExaminedRows = {
  headline: string | null;
  bio: string | null;
  captions: readonly { rowKey: string; text: string | null }[];
};

/** The code of the list line: `direct_contact` when any examined text shows a signal (EC-L2G-12). */
export function alertCodesOf(examined: ExaminedTexts): CreatorAlertCode[] {
  const texts = [examined.headline, examined.bio, ...examined.captions];
  return texts.some((text) => detectDirectContact(text).length > 0)
    ? ["direct_contact"]
    : [];
}

/** The alerts of a decision view: the field, the visual of a caption, the kinds of signal. */
export function reviewAlertsOf(examined: ExaminedRows): CreatorReviewAlert[] {
  const alerts: CreatorReviewAlert[] = [];
  const add = (
    field: CreatorReviewAlert["field"],
    rowKey: string | null,
    text: string | null,
  ): void => {
    const signals = detectDirectContact(text);
    if (signals.length > 0) {
      alerts.push({
        code: "direct_contact",
        field,
        rowKey,
        signals: [...signals],
      });
    }
  };
  add("headline", null, examined.headline);
  add("bio", null, examined.bio);
  for (const caption of examined.captions) {
    add("portfolio_caption", caption.rowKey, caption.text);
  }
  return alerts;
}

// The rules of block 6 of "mon profil" of a creator, the portfolio, that are not apps/api's (docs/mvp/17
// §5.2; 07 RG77 to RG84; jalons/l2g/modele.md §6; commit 13): which message a failed deposit or action
// calls for, what the browser stops before sending, what the list shows and in which order, how a
// move becomes the order the API takes, what a caption holds before it is sent. Pure functions,
// unit-tested (tests/creator-portfolio-view.test.ts); the component and the hook only display and
// call. Whether a visual is approved, refused or removable is the API's and the base's: nothing of
// it is decided here. Nothing here carries an amount, a rate, a net or a price (D48, D78).
import {
  PORTFOLIO_CAPTION_MAX_LENGTH,
  PORTFOLIO_MAX_ITEMS,
  PORTFOLIO_MAX_UPLOAD_BYTES,
  PORTFOLIO_UPLOAD_REJECTIONS,
  portfolioCaptionSchema,
  type PortfolioConflictIssue,
  type PortfolioItem,
  type PortfolioUploadRejection,
} from "@influx/contracts/creator-portfolio";

/**
 * Why a deposit or an action did not give what was asked, as the key of its message
 * (`creatorProfile.portfolio.errors.<key>`): the six typed reasons of the API for a file, a file the
 * browser saw empty or too big before sending, the daily quota, the conflicts of a 409 (the closed
 * list of `PORTFOLIO_CONFLICT_ISSUES`), or the service that did not answer.
 */
export type PortfolioFailure =
  | PortfolioUploadRejection
  | "tooLarge"
  | "quota"
  | PortfolioConflictIssue
  | "conflict"
  | "unavailable";

/** Only a file the relay would refuse is stopped here (nothing to read, over 8 MiB); the rest is the API's. */
export function portfolioFileProblem(
  sizeInBytes: number,
): "empty" | "tooLarge" | null {
  if (sizeInBytes === 0) {
    return "empty";
  }
  return sizeInBytes > PORTFOLIO_MAX_UPLOAD_BYTES ? "tooLarge" : null;
}

const CONFLICT_ISSUES: ReadonlySet<string> = new Set<PortfolioConflictIssue>([
  "portfolio_full",
  "portfolio_minimum",
  "not_replaceable",
  "replacement_pending",
  "item_state",
  "profile_state",
]);

function isUploadRejection(
  issue: string | undefined,
): issue is PortfolioUploadRejection {
  return (PORTFOLIO_UPLOAD_REJECTIONS as readonly string[]).includes(
    issue ?? "",
  );
}

/**
 * The failure an answer of the relay stands for. `image_rejected` names its reason (path `portfolio`),
 * a 409 its issue, the quota and the size their own code; anything else is the service not answering,
 * which is the only case that leaves the same file worth sending again (RG111).
 */
export function portfolioFailureOf(failure: {
  code?: string;
  issues?: readonly string[];
}): PortfolioFailure {
  const first = failure.issues?.[0];
  switch (failure.code) {
    case "image_rejected":
      return isUploadRejection(first) ? first : "undecodable";
    case "payload_too_large":
      return "tooLarge";
    case "upload_quota_exceeded":
      return "quota";
    case "conflict":
      return first !== undefined && CONFLICT_ISSUES.has(first)
        ? (first as PortfolioConflictIssue)
        : "conflict";
    default:
      return "unavailable";
  }
}

// --- What the list shows ---------------------------------------------------------------------------

/** The states a creator sees written on a visual: the others (withdrawn, purging) are no longer his portfolio. */
export type PortfolioShownState = "pending" | "approved" | "rejected";

export type PortfolioShownItem = {
  item: PortfolioItem;
  state: PortfolioShownState;
  /** The pending replacement of this approved visual, shown beside it (RG81). */
  replacement: PortfolioItem | null;
};

export type PortfolioView = {
  /** The visuals in place, in the creator's order, each with its pending replacement. */
  placed: PortfolioShownItem[];
  /** The refused ones, the latest first, whose file waits for its deletion (D79 (8)). */
  refused: PortfolioShownItem[];
};

/**
 * What the screen lists: the pending and approved visuals in the creator's order (a replacement
 * standing for an approved visual shows beside it, not as a place of its own), then the refused ones.
 * A withdrawn or purging visual is not listed.
 */
export function portfolioViewOf(
  items: readonly PortfolioItem[],
): PortfolioView {
  const approvedIds = new Set(
    items.filter((item) => item.state === "approved").map((item) => item.id),
  );
  const replacementOf = (id: string): PortfolioItem | null =>
    items.find(
      (candidate) =>
        candidate.state === "pending" && candidate.replacesItemId === id,
    ) ?? null;
  const standsForApproved = (item: PortfolioItem): boolean =>
    item.replacesItemId !== null && approvedIds.has(item.replacesItemId);
  const placed = items
    .filter(
      (item) =>
        item.state === "approved" ||
        (item.state === "pending" && !standsForApproved(item)),
    )
    .sort(
      (first, second) =>
        (first.displayOrder ?? PORTFOLIO_MAX_ITEMS + 1) -
        (second.displayOrder ?? PORTFOLIO_MAX_ITEMS + 1),
    )
    .map((item) => ({
      item,
      state: item.state as PortfolioShownState,
      replacement: item.state === "approved" ? replacementOf(item.id) : null,
    }));
  const refused = items
    .filter((item) => item.state === "rejected")
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .map((item) => ({
      item,
      state: "rejected" as const,
      replacement: null,
    }));
  return { placed, refused };
}

/** The ids of the placed visuals in the creator's order: what `PUT …/order` takes (the API wants every one). */
export function placedIdsOf(items: readonly PortfolioItem[]): string[] {
  return items
    .filter((item) => item.displayOrder !== null)
    .sort(
      (first, second) => (first.displayOrder ?? 0) - (second.displayOrder ?? 0),
    )
    .map((item) => item.id);
}

/** The order after a visual moved by one place; `null` when it is already at the end it moves to. */
export function orderAfterMove(
  ids: readonly string[],
  id: string,
  delta: -1 | 1,
): string[] | null {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) {
    return null;
  }
  const next = [...ids];
  next.splice(from, 1);
  next.splice(to, 0, id);
  return next;
}

// --- The caption (07 RG82, RG83) --------------------------------------------------------------------

export type CaptionDraft = { caption: string; brandDeclared: boolean };

export function captionDraftOf(item: PortfolioItem): CaptionDraft {
  return { caption: item.caption ?? "", brandDeclared: item.brandDeclared };
}

export function sameCaption(
  first: CaptionDraft,
  second: CaptionDraft,
): boolean {
  return (
    first.caption === second.caption &&
    first.brandDeclared === second.brandDeclared
  );
}

/**
 * What the caption of a card says of itself (L2GU-5): a change not yet saved is written under the
 * field and the button turns primary; nothing changed, or a gesture running, leaves it secondary.
 */
export function captionSaveOf(
  draft: CaptionDraft,
  base: CaptionDraft,
  blocked: boolean,
): { unsaved: boolean; variant: "primary" | "secondary" } {
  const unsaved = !sameCaption(draft, base);
  return { unsaved, variant: unsaved && !blocked ? "primary" : "secondary" };
}

/**
 * What a save of the caption sends, or why it is not sent. A blank text is no caption (the API
 * empties on `null`); a caption of its own line, 200 characters at most (RG82, the very schema of the
 * API). The box of RG83 means nothing without a caption and is never pre-ticked: it travels as ticked.
 */
export type CaptionPlan =
  | { ok: true; body: { caption: string | null; brandDeclared: boolean } }
  | { ok: false; issue: "invalid" };

export function captionPlanOf(draft: CaptionDraft): CaptionPlan {
  const text = draft.caption.trim();
  if (text === "") {
    return { ok: true, body: { caption: null, brandDeclared: false } };
  }
  if (!portfolioCaptionSchema.safeParse(text).success) {
    return { ok: false, issue: "invalid" };
  }
  return {
    ok: true,
    body: { caption: text, brandDeclared: draft.brandDeclared },
  };
}

export const CAPTION_MAX_LENGTH = PORTFOLIO_CAPTION_MAX_LENGTH;
export const MAX_ITEMS = PORTFOLIO_MAX_ITEMS;

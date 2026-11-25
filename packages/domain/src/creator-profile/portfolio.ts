// Rules of the portfolio of a creator (docs/mvp/07 RG77 to RG85, RG87, RG88; jalons/l2g/modele.md
// §5; EC-L2G-3, EC-L2G-5). Pure: the base holds the same bounds as constraints and doors (0242,
// 0243), the schemas and the screens read these constants, never a copy.
import type { CreatorProfileInput } from "./input.ts";

/** A portfolio holds three visuals at least (RG77): below, a brand has nothing to judge. */
export const PORTFOLIO_MIN_ITEMS = 3;
/** ... and eight at most (RG77): beyond, the cost of moderation grows with no measured gain. */
export const PORTFOLIO_MAX_ITEMS = 8;
/** Five visuals or more earn the last two points of block 6 (RG87). */
export const PORTFOLIO_FULL_BLOCK_ITEMS = 5;
/** Longest caption, in characters (RG82). */
export const PORTFOLIO_CAPTION_MAX_LENGTH = 200;
/**
 * The key of the statement of RG83, kept with each declaration (`portfolio_brand_declarations.
 * statement_key`): the sentence is read from the translations, so the one declared is the one shown.
 */
export const PORTFOLIO_BRAND_STATEMENT_KEY =
  "creatorProfile.portfolio.brandConsent";

/** The states of a visual as the base holds them (EC-L2G-3). */
export const PORTFOLIO_ITEM_STATES = [
  "uploading",
  "pending",
  "approved",
  "rejected",
  "withdrawn",
  "purging",
  "purged",
] as const;
export type PortfolioItemState = (typeof PORTFOLIO_ITEM_STATES)[number];

/** What the deposited count reads of a visual. */
export type PortfolioItemCountInput = {
  readonly id: string;
  readonly state: PortfolioItemState;
  /** The approved visual this one replaces (EC-L2G-3), none for a first deposit. */
  readonly replacesItemId?: string | null;
};

/**
 * The visuals « déposés » (RG4, RG88; the same rule as `profiles.deposited_portfolio_count`): the
 * pending and the approved ones, never the approvals alone, a pending replacement of an approved
 * visual apart because it shares the place of its original. A refused, withdrawn or removed visual
 * does not count.
 */
export function depositedPortfolioCount(
  items: readonly PortfolioItemCountInput[],
): number {
  const approved = new Set(
    items.filter((item) => item.state === "approved").map((item) => item.id),
  );
  return items.filter(
    (item) =>
      (item.state === "approved" || item.state === "pending") &&
      !(
        item.state === "pending" &&
        item.replacesItemId !== null &&
        item.replacesItemId !== undefined &&
        approved.has(item.replacesItemId)
      ),
  ).length;
}

/** Where a count stands against the bounds of RG77. */
export type PortfolioCountState = "below_minimum" | "within" | "full";

export function portfolioCountState(deposited: number): PortfolioCountState {
  if (deposited < PORTFOLIO_MIN_ITEMS) return "below_minimum";
  return deposited >= PORTFOLIO_MAX_ITEMS ? "full" : "within";
}

/** Whether another visual may be deposited (RG77: eight at most; a replacement shares a place). */
export function canDepositPortfolioItem(deposited: number): boolean {
  return deposited < PORTFOLIO_MAX_ITEMS;
}

/**
 * Whether a visual may be removed: a published profile keeps three at least (RG77, the base refuses
 * `portfolio_minimum`), the creator replaces rather than removes. A profile not published is free.
 */
export function canRemovePortfolioItem(
  deposited: number,
  profilePublished: boolean,
): boolean {
  return !profilePublished || deposited > PORTFOLIO_MIN_ITEMS;
}

/** What a caption may be refused for (RG82, RG83), a code for the screen to translate. */
export type PortfolioCaptionIssue =
  "blank" | "too_long" | "control_characters" | "declaration_without_caption";

export type PortfolioCaptionCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly issue: PortfolioCaptionIssue };

/**
 * What a save of a caption accepts (RG82: one line of 200 characters at most, none blank; RG83: the
 * box of authorisation is never pre-ticked and means nothing without a caption). Same rule as
 * `profiles.set_own_portfolio_caption` (22023 `caption`). `null` is no caption. An identifying
 * element in the caption is NOT a refusal here: the detection signals it and the moderator decides
 * (RG27, EC-L2G-12).
 */
export function checkPortfolioCaption(
  caption: string | null,
  brandDeclared: boolean,
): PortfolioCaptionCheck {
  if (caption === null) {
    return brandDeclared
      ? { ok: false, issue: "declaration_without_caption" }
      : { ok: true };
  }
  if (caption.trim().length === 0) return { ok: false, issue: "blank" };
  // the base refuses [[:cntrl:]]: C0, DEL and C1
  if (/\p{Cc}/u.test(caption)) {
    return { ok: false, issue: "control_characters" };
  }
  if (Array.from(caption).length > PORTFOLIO_CAPTION_MAX_LENGTH) {
    return { ok: false, issue: "too_long" };
  }
  return { ok: true };
}

/**
 * The state written on a visual (17 §5.2 block 6; RG78: "approuvé", "en cours de modération",
 * "refusé + motif"). The approved original of a replacement under review stays shown as approved
 * while the replacement waits (RG81, EC-L2G-3); a caption under review leaves the previous one in
 * place (CA48). A visual that is no longer in the portfolio of the creator has no state to write.
 */
export type PortfolioItemDisplayState =
  | "pending"
  | "approved"
  | "rejected"
  | "replacement_pending"
  | "caption_pending";

export type PortfolioItemDisplayInput = {
  readonly state: PortfolioItemState;
  /** A replacement of this visual waits for its decision. */
  readonly replacementPending?: boolean;
  /** A revision of its caption waits for review (profile published, visual approved). */
  readonly captionPending?: boolean;
};

export function portfolioItemDisplayState(
  item: PortfolioItemDisplayInput,
): PortfolioItemDisplayState | null {
  switch (item.state) {
    case "pending":
      return "pending";
    case "rejected":
      return "rejected";
    case "approved":
      if (item.replacementPending === true) return "replacement_pending";
      return item.captionPending === true ? "caption_pending" : "approved";
    case "uploading":
    case "withdrawn":
    case "purging":
    case "purged":
      return null;
  }
}

/** The portfolio part of the input of the rules, from the visuals of a creator. */
export function portfolioInputOf(
  items: readonly PortfolioItemCountInput[],
): Pick<CreatorProfileInput, "portfolioDeposited"> {
  return { portfolioDeposited: depositedPortfolioCount(items) };
}

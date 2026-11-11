import { describe, expect, it } from "vitest";
import {
  PORTFOLIO_BRAND_STATEMENT_KEY,
  PORTFOLIO_CAPTION_MAX_LENGTH,
  PORTFOLIO_FULL_BLOCK_ITEMS,
  PORTFOLIO_ITEM_STATES,
  PORTFOLIO_MAX_ITEMS,
  PORTFOLIO_MIN_ITEMS,
  canDepositPortfolioItem,
  canRemovePortfolioItem,
  checkPortfolioCaption,
  depositedPortfolioCount,
  portfolioCountState,
  portfolioInputOf,
  portfolioItemDisplayState,
  type PortfolioItemCountInput,
  type PortfolioItemState,
} from "../src/creator-profile/index.ts";

const item = (
  id: string,
  state: PortfolioItemState,
  replacesItemId: string | null = null,
): PortfolioItemCountInput => ({ id, state, replacesItemId });

describe("L2G-U3 the bounds of the portfolio (RG77, RG87)", () => {
  it("holds three to eight visuals, and five for the last two points", () => {
    expect([
      PORTFOLIO_MIN_ITEMS,
      PORTFOLIO_MAX_ITEMS,
      PORTFOLIO_FULL_BLOCK_ITEMS,
      PORTFOLIO_CAPTION_MAX_LENGTH,
    ]).toEqual([3, 8, 5, 200]);
    expect(PORTFOLIO_BRAND_STATEMENT_KEY).toBe(
      "creatorProfile.portfolio.brandConsent",
    );
  });

  it("places a count against the bounds, and refuses a ninth deposit", () => {
    expect([0, 2, 3, 7, 8].map(portfolioCountState)).toEqual([
      "below_minimum",
      "below_minimum",
      "within",
      "within",
      "full",
    ]);
    expect(canDepositPortfolioItem(7)).toBe(true);
    expect(canDepositPortfolioItem(8)).toBe(false);
  });

  it("lets a published profile keep three at least: the creator replaces rather than removes (RG77)", () => {
    expect(canRemovePortfolioItem(3, true)).toBe(false);
    expect(canRemovePortfolioItem(4, true)).toBe(true);
    expect(canRemovePortfolioItem(1, false)).toBe(true);
  });
});

describe("L2G-U3 the visuals deposited (RG4, RG88, EC-L2G-5)", () => {
  it("counts the pending and the approved, never the refused, withdrawn or purged", () => {
    expect(
      depositedPortfolioCount(
        PORTFOLIO_ITEM_STATES.map((state) => item(state, state)),
      ),
    ).toBe(2);
    expect(depositedPortfolioCount([])).toBe(0);
  });

  it("gives a pending replacement the place of its approved original", () => {
    expect(
      depositedPortfolioCount([
        item("a", "approved"),
        item("b", "approved"),
        item("c", "pending", "a"),
      ]),
    ).toBe(2);
    // the original withdrawn: the replacement is a visual of its own
    expect(
      depositedPortfolioCount([
        item("a", "withdrawn"),
        item("c", "pending", "a"),
      ]),
    ).toBe(1);
  });

  it("feeds the input of the rules with the count alone", () => {
    expect(
      portfolioInputOf([item("a", "pending"), item("b", "rejected")]),
    ).toEqual({ portfolioDeposited: 1 });
  });
});

describe("L2G-U3 the caption and the box of RG83 (RG82, RG83)", () => {
  it("accepts no caption, or one of 200 characters, counted as code points", () => {
    expect(checkPortfolioCaption(null, false)).toEqual({ ok: true });
    expect(checkPortfolioCaption("a".repeat(200), false)).toEqual({ ok: true });
    expect(checkPortfolioCaption("🌿".repeat(200), true)).toEqual({ ok: true });
    expect(checkPortfolioCaption("a".repeat(201), false)).toEqual({
      ok: false,
      issue: "too_long",
    });
    expect(checkPortfolioCaption("🌿".repeat(201), false)).toEqual({
      ok: false,
      issue: "too_long",
    });
  });

  it("refuses a blank caption and a caption with a control character", () => {
    expect(checkPortfolioCaption("  \t ", false)).toEqual({
      ok: false,
      issue: "blank",
    });
    expect(checkPortfolioCaption("", false)).toEqual({
      ok: false,
      issue: "blank",
    });
    expect(checkPortfolioCaption("deux\nlignes", false)).toEqual({
      ok: false,
      issue: "control_characters",
    });
  });

  it("has nothing to declare without a caption: the box means nothing alone (RG83)", () => {
    expect(checkPortfolioCaption(null, true)).toEqual({
      ok: false,
      issue: "declaration_without_caption",
    });
    expect(checkPortfolioCaption("Un plat de saison", true)).toEqual({
      ok: true,
    });
  });

  it("leaves an identifying element to the moderator, never to a refusal (RG27)", () => {
    expect(checkPortfolioCaption("Suivez @camille_cuisine", false)).toEqual({
      ok: true,
    });
  });
});

describe("L2G-U3 the state written on a visual (RG78, RG81, CA48)", () => {
  it("writes pending, approved and refused as they are", () => {
    expect(portfolioItemDisplayState({ state: "pending" })).toBe("pending");
    expect(portfolioItemDisplayState({ state: "approved" })).toBe("approved");
    expect(portfolioItemDisplayState({ state: "rejected" })).toBe("rejected");
  });

  it("keeps an approved visual under a replacement or a caption review, the replacement first", () => {
    expect(
      portfolioItemDisplayState({
        state: "approved",
        replacementPending: true,
      }),
    ).toBe("replacement_pending");
    expect(
      portfolioItemDisplayState({ state: "approved", captionPending: true }),
    ).toBe("caption_pending");
    expect(
      portfolioItemDisplayState({
        state: "approved",
        replacementPending: true,
        captionPending: true,
      }),
    ).toBe("replacement_pending");
  });

  it("writes nothing for a visual that is not in the portfolio any more", () => {
    for (const state of [
      "uploading",
      "withdrawn",
      "purging",
      "purged",
    ] as const) {
      expect(portfolioItemDisplayState({ state }), state).toBeNull();
    }
  });
});

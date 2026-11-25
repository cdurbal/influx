// How a badge is written and to whom (docs/mvp/08 RG1 to RG7, RG10, RG13, RG70, RG78, RG93, RG97;
// 06 RG49, RG54; jalons/l2e fiche invariants 12, 13). The state of a badge gives the KEY of its
// written label, never the sentence: the sentences are the translation files', mot pour mot RG10
// and RG93 (hypothesis D34, read by a lawyer before `production`). The date and the network are the
// screen's arguments, on every badge (RG4); a badge with no key is not shown at all, and nothing
// here is a colour: the label is the carrier, never the colour alone (RG97).
import type { VerificationBadgeState, VerificationLevel } from "./levels.ts";

/** Who looks: the creator whose badge it is, or an advertiser (RG78: « à reconfirmer » is not shown to him as active). */
export type BadgeViewer = "owner" | "advertiser";

export type BadgeLabelKey =
  | "verif.badge.accountVerified"
  | "verif.badge.audienceVerified"
  | "verif.badge.toRefresh"
  | "verif.badge.toReconfirm"
  | "brandProfile.badge.label"
  | "brandProfile.badge.toRefresh";

export type BadgeHelpKey =
  "verif.badge.accountVerified.help" | "verif.badge.audienceVerified.help";

export type BadgeDisplay = {
  readonly labelKey: BadgeLabelKey;
  /** The short explanation that stays next to the badge (RG7); the brand badge has its own line. */
  readonly helpKey: BadgeHelpKey | null;
  /** Written « à rafraîchir » or « à reconfirmer »: not a plain, current badge. */
  readonly needsAction: boolean;
};

const ACCOUNT: BadgeDisplay = {
  labelKey: "verif.badge.accountVerified",
  helpKey: "verif.badge.accountVerified.help",
  needsAction: false,
};
const AUDIENCE: BadgeDisplay = {
  labelKey: "verif.badge.audienceVerified",
  helpKey: "verif.badge.audienceVerified.help",
  needsAction: false,
};
const BRAND: BadgeDisplay = {
  labelKey: "brandProfile.badge.label",
  helpKey: null,
  needsAction: false,
};
const AUDIENCE_TO_REFRESH: BadgeDisplay = {
  labelKey: "verif.badge.toRefresh",
  helpKey: "verif.badge.audienceVerified.help",
  needsAction: true,
};
const BRAND_TO_REFRESH: BadgeDisplay = {
  labelKey: "brandProfile.badge.toRefresh",
  helpKey: null,
  needsAction: true,
};
const ACCOUNT_TO_RECONFIRM: BadgeDisplay = {
  labelKey: "verif.badge.toReconfirm",
  helpKey: null,
  needsAction: true,
};

/**
 * The label of a badge, or `null` when it is not displayed: expired, revoked and replaced badges
 * disappear (RG70, RG76), and a badge to reconfirm shows to its owner only (RG78). « Compte
 * vérifié » is not touched by the expiry of the audience (RG71): only the audience level is
 * « à rafraîchir » (RG70) and only the account level « à reconfirmer » (RG78), the brand level being
 * « à rafraîchir » after its own 12 months (06 RG54).
 */
export function badgeDisplay(input: {
  readonly level: VerificationLevel;
  readonly state: VerificationBadgeState;
  readonly viewer: BadgeViewer;
}): BadgeDisplay | null {
  const { level, state, viewer } = input;
  switch (state) {
    case "active":
      if (level === "account_verified") return ACCOUNT;
      return level === "audience_verified" ? AUDIENCE : BRAND;
    case "to_refresh":
      if (level === "audience_verified") return AUDIENCE_TO_REFRESH;
      return level === "brand_verified" ? BRAND_TO_REFRESH : null;
    case "to_reconfirm":
      return level === "account_verified" && viewer === "owner"
        ? ACCOUNT_TO_RECONFIRM
        : null;
    case "expired":
    case "revoked":
    case "replaced":
      return null;
  }
}

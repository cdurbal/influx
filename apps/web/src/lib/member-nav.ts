// The main navigation of the member spaces (docs/mvp/17 §2.1 to §2.3; 02 §21.5 points 2, 3 and 9):
// which entries a role sees, in which order, and which one is active. Pure functions, tested alone
// (tests/member-nav.test.ts); the shell (src/components/member/MemberShell.tsx) only draws them.
import type { SignupDoor } from "@influx/contracts/auth";
import {
  ACCOUNT_PAGES,
  accountPagesOf,
  PARENT_PAGES,
  type MemberPage,
} from "./member-paths";

/** Every entry a space will have (17 §2.1); "relations" is the fourth entry of both spaces. */
export type NavEntry =
  "home" | "campaigns" | "creators" | "applications" | "relations" | "account";

type SpaceEntry = { entry: NavEntry; page: MemberPage | null };

/**
 * The five entries of each space, in the fixed order of 17 §2.1. `page`: the screen the entry
 * opens, or null until its lot ships it. An entry without a screen is left out (02 §21.5 point
 * 9), its label enters the translation files with its screen, and an entry that appeared never
 * goes away (17 §2.4): its `page` is never set back to null.
 */
export const SPACE_ENTRIES: Readonly<
  Record<SignupDoor, readonly SpaceEntry[]>
> = {
  advertiser: [
    { entry: "home", page: "advertiserHome" },
    { entry: "campaigns", page: null }, // Lot 3, "Mes campagnes"
    { entry: "creators", page: null }, // Lot 3, the anonymised search
    { entry: "relations", page: null }, // Lot 4, "Mises en relation"
    { entry: "account", page: "accountHub" },
  ],
  creator: [
    { entry: "home", page: "creatorHome" },
    { entry: "campaigns", page: null }, // Lot 3, the feed of open campaigns
    { entry: "applications", page: null }, // Lot 3, "Mes candidatures"
    { entry: "relations", page: null }, // Lot 4, "Mes relations"
    { entry: "account", page: "accountHub" },
  ],
};

/** 17 §2.2: five cells in the bottom bar, never six. */
export const NAV_ENTRY_MAX = 5;

/**
 * 17 §2.2: a label is read whole in a cell of 64 px at 320 px, the same at both widths, FR and EN
 * (« Candidatures », 12 characters, is to be shortened by `expert-marketing`, 18 §12.5 point 6).
 */
export const NAV_LABEL_MAX_LENGTH = 11;

/** Whether a label fits a cell of the bar, counted in characters, not in UTF-16 units. */
export function navLabelFits(label: string): boolean {
  return [...label].length <= NAV_LABEL_MAX_LENGTH;
}

export type NavItem = { entry: NavEntry; page: MemberPage };

/** The entries a member of `role` sees, in order: those whose screen exists. */
export function navItemsOf(role: SignupDoor): NavItem[] {
  return SPACE_ENTRIES[role].flatMap(({ entry, page }) =>
    page === null ? [] : [{ entry, page }],
  );
}

/**
 * The pages of each rubric that has several (D74, sn-fiche "Poste de travail"): its sub-entries in
 * the column, in order. A rubric of a single page has none (Accueil); its entry is its page.
 */
const SUB_PAGES: Readonly<Partial<Record<NavEntry, readonly MemberPage[]>>> = {
  account: ACCOUNT_PAGES,
};

/**
 * The sub-entries of a rubric, in order; none for a rubric of a single page. `role` adds the profile
 * page that leads "Compte" (a brand's or a creator's, L2D); without it, the pages common to both.
 */
export function subEntriesOf(
  entry: NavEntry,
  role?: SignupDoor,
): readonly MemberPage[] {
  const pages =
    entry === "account" && role !== undefined
      ? accountPagesOf()
      : (SUB_PAGES[entry] ?? []);
  return pages.length > 1 ? pages : [];
}

/** Where a page stands in the navigation: its rubric, and its sub-entry when it is one. */
export type ActivePlace = { entry: NavEntry; sub: MemberPage | null };

/**
 * The place of a page (17 §2.3, D74): a page of a rubric marks the rubric as its ancestor and
 * itself as the current sub-entry ({ account, accountData }); the page of an entry, page-menu
 * included, marks the entry itself ({ account, null }, { home, null }); null for the journey and
 * an unknown path. A page that hangs below another one (PARENT_PAGES: the verification of a network
 * below the profile, L2E) takes the place of its parent.
 */
export function activePlaceOf(
  pageOrChild: MemberPage | null,
): ActivePlace | null {
  if (pageOrChild === null) {
    return null;
  }
  const page = PARENT_PAGES[pageOrChild] ?? pageOrChild;
  const entries = Object.values(SPACE_ENTRIES).flat();
  for (const { entry } of entries) {
    // Every page a role may have counts (the profile included).
    const pages: readonly MemberPage[] =
      entry === "account" ? accountPagesOf() : subEntriesOf(entry);
    if (pages.includes(page)) {
      return { entry, sub: page };
    }
  }
  const entry = entries.find((item) => item.page === page)?.entry;
  return entry === undefined ? null : { entry, sub: null };
}

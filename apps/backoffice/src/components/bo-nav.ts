// The main navigation of the backoffice (docs/mvp/17b §1.2, §1.7; 02 §21.5 point 8; D74, sn-fiche
// "Poste de travail"): the seven entries of the rail in their fixed order, the screens each one
// holds as its sub-entries, which entries a role sees and which entry and screen a path belongs to.
// Pure functions, tested alone (tests/bo-nav.test.ts); BoNav.tsx only draws them.
import type { BackofficeMeResponse } from "@influx/contracts/backoffice-auth";

export type InternalRole = BackofficeMeResponse["role"];

/** The seven entries of 17b §1.2, by their number there (`g` then n keeps it, §1.7). */
export type RailKey =
  | "dashboard"
  | "queues"
  | "accounts"
  | "creatorSearch"
  | "deals"
  | "alerts"
  | "admin";

/** The screens that exist today, each a sub-entry of one entry (17b §1.7, D74). */
export type SectionKey =
  | "home"
  | "signups"
  | "memberInvitations"
  | "dualControl"
  | "internalAccounts"
  | "apollo"
  | "health";

export type Section = { key: SectionKey; href: string; adminOnly: boolean };

export type RailEntry = { key: RailKey; sections: readonly Section[] };

/**
 * 17b §1.2 and §1.7 "Entrées visibles": an entry without a screen has no section and is left out;
 * an entry that appeared never goes away. Administration holds admin screens only: an agent, who
 * has nothing there yet, does not see it (CA63; the server refuses those screens anyway).
 */
export const RAIL_ENTRIES: readonly RailEntry[] = [
  {
    key: "dashboard",
    sections: [{ key: "home", href: "/accueil", adminOnly: false }],
  },
  { key: "queues", sections: [] },
  {
    key: "accounts",
    sections: [
      { key: "signups", href: "/inscrits", adminOnly: false },
      { key: "memberInvitations", href: "/invitations", adminOnly: false },
    ],
  },
  { key: "creatorSearch", sections: [] }, // Lot 3
  { key: "deals", sections: [] }, // Lot 5
  { key: "alerts", sections: [] },
  {
    key: "admin",
    sections: [
      { key: "dualControl", href: "/double-validation", adminOnly: true },
      { key: "internalAccounts", href: "/comptes-internes", adminOnly: true },
      { key: "apollo", href: "/reglages/apollo", adminOnly: true },
      { key: "health", href: "/sante-technique", adminOnly: true },
    ],
  },
];

/** An entry as a role sees it: its link opens its first screen; its screens, in order. */
export type NavItem = { key: RailKey; href: string; sections: Section[] };

/** The entries `role` sees, in the order of 17b §1.2: those holding a screen open to the role. */
export function navItemsOf(
  role: InternalRole,
  entries: readonly RailEntry[] = RAIL_ENTRIES,
): NavItem[] {
  return entries.flatMap(({ key, sections }) => {
    const open = sections.filter(
      (section) => !section.adminOnly || role === "admin",
    );
    const first = open[0];
    return first === undefined
      ? []
      : [{ key, href: first.href, sections: open }];
  });
}

/** Whether `pathname` is `href` or one of its pages (`/inscrits/⟨id⟩`), never a mere prefix. */
function isUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export type ActivePlace = { entry: RailKey; section: SectionKey };

/** The entry and the section a path belongs to; null for an unknown path. */
export function activePlaceOf(
  pathname: string,
  entries: readonly RailEntry[] = RAIL_ENTRIES,
): ActivePlace | null {
  for (const { key, sections } of entries) {
    const section = sections.find((item) => isUnder(pathname, item.href));
    if (section !== undefined) {
      return { entry: key, section: section.key };
    }
  }
  return null;
}

/** An entry of a single screen has no sub-menu (D74): its link is the screen. */
export function subEntriesOf(item: NavItem): Section[] {
  return item.sections.length < 2 ? [] : item.sections;
}

/**
 * The state of an entry's link (D74): "current" when the page is its one screen; "ancestor" when the
 * page is one of its sub-entries (the sub-entry carries `aria-current`); "idle" otherwise.
 */
export type EntryState = "current" | "ancestor" | "idle";

export function entryStateOf(
  item: NavItem,
  place: ActivePlace | null,
): EntryState {
  if (place?.entry !== item.key) {
    return "idle";
  }
  return subEntriesOf(item).length === 0 ? "current" : "ancestor";
}

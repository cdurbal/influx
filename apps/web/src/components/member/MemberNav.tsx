// The one main navigation of the member spaces (docs/mvp/17 §2.2, §2.3; 02 §21.5 point 3; D74,
// sn-fiche "Poste de travail"), drawn from what member-nav.ts decides: a bar at the bottom below
// lg, the list of the side column from lg, restyled by CSS alone. The sub-entries of the active
// rubric are a list nested in its item, right after its link (keyboard order), shown from lg only.
// One `aria-current` per page: the entry on its own page (page-menu included), else the sub-entry.
// Pure: labels, addresses and the link component come as props, so that a test renders it without
// the router (tests/member-nav-ui.test.ts).
import type { ComponentType, ReactNode } from "react";
import { HomeIcon, MegaphoneIcon, UserRoundIcon } from "@/components/ui/icons";
import type { ActivePlace, NavEntry } from "@/lib/member-nav";
import type { MemberPage } from "@/lib/member-paths";
import {
  NAV_CELL_CLASSES,
  NAV_CLASSES,
  NAV_ICON_CLASSES,
  NAV_LIST_CLASSES,
  SUB_NAV_LIST_CLASSES,
  navLinkClasses,
  subNavLinkClasses,
  type NavLinkState,
} from "./shell-classes";

const ENTRY_ICONS: Partial<Record<NavEntry, typeof HomeIcon>> = {
  home: HomeIcon,
  campaigns: MegaphoneIcon,
  account: UserRoundIcon,
};

export type MemberNavSubEntry = {
  page: MemberPage;
  href: string;
  label: string;
};

export type MemberNavEntry = {
  entry: NavEntry;
  href: string;
  label: string;
  /** The pages of the rubric (subEntriesOf), empty for a rubric of a single page. */
  subEntries: readonly MemberNavSubEntry[];
};

export type MemberNavLinkProps = {
  href: string;
  className: string;
  "aria-current"?: "page";
  children: ReactNode;
};

/** The state of an entry's link for the place of the current page. */
function entryState(entry: NavEntry, place: ActivePlace | null): NavLinkState {
  if (place?.entry !== entry) {
    return "idle";
  }
  return place.sub === null ? "current" : "ancestor";
}

export function MemberNav({
  label,
  entries,
  place,
  LinkComponent,
}: {
  label: string;
  entries: readonly MemberNavEntry[];
  place: ActivePlace | null;
  LinkComponent: ComponentType<MemberNavLinkProps>;
}) {
  return (
    <nav aria-label={label} data-member-nav="" className={NAV_CLASSES}>
      <ul className={NAV_LIST_CLASSES}>
        {entries.map((item) => {
          const state = entryState(item.entry, place);
          const Icon = ENTRY_ICONS[item.entry];
          return (
            <li key={item.entry} className={NAV_CELL_CLASSES}>
              <LinkComponent
                href={item.href}
                aria-current={state === "current" ? "page" : undefined}
                className={navLinkClasses(state)}
              >
                {Icon === undefined ? null : (
                  <Icon aria-hidden="true" className={NAV_ICON_CLASSES} />
                )}
                {item.label}
              </LinkComponent>
              {state === "idle" || item.subEntries.length === 0 ? null : (
                <ul className={SUB_NAV_LIST_CLASSES}>
                  {item.subEntries.map((sub) => {
                    const isCurrent = sub.page === place?.sub;
                    return (
                      <li key={sub.page}>
                        <LinkComponent
                          href={sub.href}
                          aria-current={isCurrent ? "page" : undefined}
                          className={subNavLinkClasses(isCurrent)}
                        >
                          {sub.label}
                        </LinkComponent>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// The one main navigation of the backoffice (docs/mvp/17b §1.7; 02 §21.5 point 8; D74, sn-fiche
// "Poste de travail" and "Backoffice de 768 à 1 023 px"), drawn from what bo-nav.ts decides: the
// rail from lg, a compact horizontal list from md to lg, restyled by CSS alone. The sub-entries of
// the active entry are a list nested in its item, right after its link (keyboard order); in the
// strip, that item takes a line of its own. One `aria-current` per page: the entry of a single
// screen, else the current sub-entry. Pure: the items, the place and the link component come as
// props, so that a test renders it without the router (tests/bo-nav-ui.test.ts).
import type { ComponentType, ReactNode } from "react";
import { messages } from "@/messages/fr";
import {
  entryStateOf,
  subEntriesOf,
  type ActivePlace,
  type NavItem,
  type RailKey,
} from "./bo-nav";
import {
  BellIcon,
  BriefcaseIcon,
  InboxIcon,
  LayoutDashboardIcon,
  SearchIcon,
  SettingsIcon,
  UsersRoundIcon,
} from "./icons";
import {
  NAV_CLASSES,
  NAV_ICON_CLASSES,
  NAV_LIST_CLASSES,
  navCellClasses,
  navLinkClasses,
  SUB_NAV_LIST_CLASSES,
  subNavLinkClasses,
} from "./shell-classes";

const ENTRY_ICONS: Record<RailKey, typeof InboxIcon> = {
  dashboard: LayoutDashboardIcon,
  queues: InboxIcon,
  accounts: UsersRoundIcon,
  creatorSearch: SearchIcon,
  deals: BriefcaseIcon,
  alerts: BellIcon,
  admin: SettingsIcon,
};

export type BoNavLinkProps = {
  href: string;
  className: string;
  "aria-current"?: "page";
  children: ReactNode;
};

export function BoNav({
  items,
  place,
  LinkComponent,
}: {
  items: readonly NavItem[];
  place: ActivePlace | null;
  LinkComponent: ComponentType<BoNavLinkProps>;
}) {
  return (
    <nav aria-label={messages.nav.label} className={NAV_CLASSES}>
      <ul className={NAV_LIST_CLASSES}>
        {items.map((item) => {
          const state = entryStateOf(item, place);
          const subEntries = state === "idle" ? [] : subEntriesOf(item);
          const Icon = ENTRY_ICONS[item.key];
          return (
            <li
              key={item.key}
              className={navCellClasses(subEntries.length > 0)}
            >
              <LinkComponent
                href={item.href}
                aria-current={state === "current" ? "page" : undefined}
                className={navLinkClasses(state)}
              >
                <Icon aria-hidden="true" className={NAV_ICON_CLASSES} />
                {messages.nav[item.key]}
              </LinkComponent>
              {subEntries.length === 0 ? null : (
                <ul className={SUB_NAV_LIST_CLASSES}>
                  {subEntries.map((section) => {
                    const isCurrent = section.key === place?.section;
                    return (
                      <li key={section.key}>
                        <LinkComponent
                          href={section.href}
                          aria-current={isCurrent ? "page" : undefined}
                          className={subNavLinkClasses(isCurrent)}
                        >
                          {messages.nav[section.key]}
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

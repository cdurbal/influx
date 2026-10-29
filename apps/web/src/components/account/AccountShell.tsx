"use client";

// The frame of every "mon compte" page (docs/mvp/17 §6, §6.7; 05 RG28, RG54, RG71), inside the
// member shell (src/components/member/MemberShell.tsx), which reads the session, sends a member
// without one to the sign-in page and shows the blocking terms screen BEFORE any page, except
// "mes préférences" and "mes données", whose rights survive a refused version (J7 A3): they show a
// notice instead. Here: the navigation between the four pages, the offline banner, that notice.
// The page itself receives the account, a way to read it again, and a way to end on "signed out"
// (closing the current session, changing the address) or "account deleted".
import type { MeResponse } from "@influx/contracts/account";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import {
  INFO_CLASSES,
  SPACE_SCREEN_CLASSES,
  WARNING_CLASSES,
} from "@/components/auth/auth-classes";
import { useOnline } from "@/components/auth/use-online";
import { useMember } from "@/components/member/member-context";
import { Link } from "@/i18n/navigation";
import {
  ACCOUNT_PAGES,
  homePageOf,
  memberPageHref,
  type AccountPage,
} from "@/lib/member-paths";
import {
  INLINE_LINK_CLASSES,
  NAV_LIST_CLASSES,
  navLinkClasses,
} from "./account-classes";

export type AccountContext = {
  me: MeResponse;
  online: boolean;
  /** Reads the account again (after a change of address, a new language…). */
  refresh: () => Promise<void>;
  /** Ends the page on "signed out", with the sentence that says why. */
  signedOut: (message: string) => void;
  /** Ends the page on "your account is deleted" (D72): no account navigation, the session is closed. */
  accountDeleted: () => void;
};

export function AccountShell({
  page,
  children,
}: {
  page: AccountPage;
  children: (context: AccountContext) => ReactNode;
}) {
  const t = useTranslations("account");
  const locale = useLocale();
  const online = useOnline();
  const { me, refresh, signedOut, accountDeleted } = useMember();

  // The shell lets a pending version through on the exempted pages only (isTermsExempt).
  const termsPending = me.termsToAccept !== null;

  return (
    <div className={SPACE_SCREEN_CLASSES}>
      <nav aria-label={t("nav.label")} className="flex flex-col gap-3">
        <Link
          href={memberPageHref(homePageOf(me.role), locale)}
          className={INLINE_LINK_CLASSES}
        >
          {t("nav.home")}
        </Link>
        <ul className={NAV_LIST_CLASSES}>
          {ACCOUNT_PAGES.map((item) => (
            <li key={item}>
              <Link
                href={memberPageHref(item, locale)}
                aria-current={item === page ? "page" : undefined}
                className={navLinkClasses(item === page)}
              >
                {t(`nav.${item}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {online ? null : (
        <p role="status" className={WARNING_CLASSES}>
          {t("offline")}
        </p>
      )}
      {termsPending ? (
        <p role="note" className={INFO_CLASSES}>
          {t("terms.pendingNotice")}{" "}
          <Link
            href={memberPageHref("accountDetails", locale)}
            className={INLINE_LINK_CLASSES}
          >
            {t("terms.pendingLink")}
          </Link>
        </p>
      ) : null}
      {children({ me, online, refresh, signedOut, accountDeleted })}
    </div>
  );
}

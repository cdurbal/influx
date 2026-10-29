"use client";

// The frame of every "mon compte" page (docs/mvp/17 §6, §6.7; 05 RG28, RG54, RG71), inside the
// member shell (src/components/member/MemberShell.tsx), which reads the session, sends a member
// without one to the sign-in page and shows the blocking terms screen BEFORE any page, except
// "mes préférences" and "mes données", whose rights survive a refused version (J7 A3): they show a
// notice instead. Here: the way back to the page-menu above the h1 (« ‹ Mon compte », D74; the
// pages of the rubric are sub-entries of the shell's column), the offline banner, that notice.
// The page itself receives the account, a way to read it again, and a way to end on "signed out"
// (closing the current session, changing the address) or "account deleted".
import type { MeResponse } from "@influx/contracts/account";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { SPACE_SCREEN_CLASSES } from "@/components/auth/auth-classes";
import { useOnline } from "@/components/auth/use-online";
import { Notice } from "@/components/member/ui/Notice";
import { PageBackContext } from "@/components/member/ui/PageHeader";
import { useMember } from "@/components/member/member-context";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import {
  BACK_ICON_CLASSES,
  BACK_LINK_CLASSES,
  INLINE_LINK_CLASSES,
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
  children,
}: {
  children: (context: AccountContext) => ReactNode;
}) {
  const t = useTranslations("account");
  const locale = useLocale();
  const online = useOnline();
  const { me, refresh, signedOut, accountDeleted } = useMember();

  // The shell lets a pending version through on the exempted pages only (isTermsExempt).
  const termsPending = me.termsToAccept !== null;

  // The screen reader hears « Retour à Mon compte »; the eye sees « ‹ Mon compte ».
  const back = (
    <Link
      href={memberPageHref("accountHub", locale)}
      className={BACK_LINK_CLASSES}
    >
      <span className="sr-only">{t("hub.backPrefix")} </span>
      <ChevronLeftIcon aria-hidden="true" className={BACK_ICON_CLASSES} />
      {t("hub.back")}
    </Link>
  );

  return (
    <PageBackContext value={back}>
      <div className={SPACE_SCREEN_CLASSES}>
        {online ? null : <Notice tone="warning">{t("offline")}</Notice>}
        {termsPending ? (
          <Notice tone="info" announce={false}>
            {t("terms.pendingNotice")}{" "}
            <Link
              href={memberPageHref("accountDetails", locale)}
              className={INLINE_LINK_CLASSES}
            >
              {t("terms.pendingLink")}
            </Link>
          </Notice>
        ) : null}
        {children({ me, online, refresh, signedOut, accountDeleted })}
      </div>
    </PageBackContext>
  );
}

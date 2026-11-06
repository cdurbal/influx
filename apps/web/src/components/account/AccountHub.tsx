"use client";

// The page-menu of "mon compte" (docs/mvp/17 §6.0; D74; 20 page-menu): the page of the "Compte"
// entry, at every width. One full-width row per page of the rubric, in the order of accountPagesOf():
// a decorative icon, the label, one sentence, a decorative chevron; the label's link is stretched
// over the row. A list in <main>, never a <nav>: the shell's is the one navigation landmark. It
// shows links only, so the blocking terms screen lets it through (TERMS_EXEMPT_PAGES); a link to a
// page that is not exempted leads, as before, to that screen.
import { useLocale, useTranslations } from "next-intl";
import { SPACE_SCREEN_CLASSES } from "@/components/auth/auth-classes";
import { useMember } from "@/components/member/member-context";
import { PageHeader } from "@/components/member/ui/PageHeader";
import {
  ChevronRightIcon,
  BriefcaseIcon,
  DatabaseIcon,
  MailIcon,
  MonitorSmartphoneIcon,
  UserRoundIcon,
} from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import {
  accountLabelKeyOf,
  accountPagesOf,
  memberPageHref,
  type AccountSubPage,
} from "@/lib/member-paths";
import {
  HUB_CHEVRON_CLASSES,
  HUB_ICON_CLASSES,
  HUB_LINK_CLASSES,
  HUB_LIST_CLASSES,
  HUB_ROW_CLASSES,
  HUB_SENTENCE_CLASSES,
} from "./account-classes";

const HUB_ICONS: Readonly<Record<AccountSubPage, typeof UserRoundIcon>> = {
  accountProfile: BriefcaseIcon,
  accountDetails: UserRoundIcon,
  accountPreferences: MailIcon,
  accountSessions: MonitorSmartphoneIcon,
  accountData: DatabaseIcon,
};

export function AccountHub() {
  const t = useTranslations("account");
  const locale = useLocale();
  const { me } = useMember();

  return (
    <div className={SPACE_SCREEN_CLASSES}>
      <PageHeader title={t("hub.title")} />
      <ul className={HUB_LIST_CLASSES}>
        {accountPagesOf().map((page) => {
          const Icon = HUB_ICONS[page];
          return (
            <li key={page} className={HUB_ROW_CLASSES}>
              <Icon aria-hidden="true" className={HUB_ICON_CLASSES} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <Link
                  href={memberPageHref(page, locale)}
                  className={HUB_LINK_CLASSES}
                >
                  {t(`nav.${accountLabelKeyOf(page, me.role)}`)}
                </Link>
                <p className={HUB_SENTENCE_CLASSES}>
                  {t(`hub.items.${accountLabelKeyOf(page, me.role)}`)}
                </p>
              </div>
              <ChevronRightIcon
                aria-hidden="true"
                className={HUB_CHEVRON_CLASSES}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

"use client";

// The badge « Marque vérifiée », written and dated (docs/mvp/06 RG49 to RG54, RG84; jalons/l2e, commit
// 20): « Marque vérifiée le 3 mars 2026 — domaine et immatriculation contrôlés. », the date complete
// and in every state, the short explanation beside it and never in a help page. A badge to refresh
// is written in full and drawn as a warning with its own icon: the state is the words, never the
// colour (RG97). It is the badge of the account, never one per network, and it carries no raison
// sociale, no number, no agent (RG48). This component only writes what the API gave and the translation
// files say (`brandProfile.badge.*`, mot pour mot RG84).
import type { OwnBadge } from "@influx/contracts/verification";
import { useLocale, useTranslations } from "next-intl";
import { Notice } from "@/components/member/ui/Notice";
import { VerifiedBadge } from "@/components/member/ui/VerifiedBadge";
import { MEMBER_FIELD_HELP_CLASSES } from "@/components/member/ui/field-classes";
import {
  brandBadgeKeyOf,
  isBrandBadgeCurrent,
} from "./brand-verification-view";
import { badgeNoticeOf, formatVerificationDate } from "./verification-view";

export function BrandBadgeLine({ badge }: { badge: OwnBadge }) {
  const t = useTranslations("verification");
  const tBrand = useTranslations("brandProfile");
  const locale = useLocale();
  const notice = badgeNoticeOf(badge);
  const label = tBrand(brandBadgeKeyOf(badge), {
    date: formatVerificationDate(badge.grantedAt, locale),
  });
  return (
    <div
      className="flex flex-col gap-2"
      data-badge="brand_verified"
      data-badge-state={badge.state}
    >
      {isBrandBadgeCurrent(badge) ? (
        <VerifiedBadge text={label} />
      ) : (
        <Notice tone="warning" announce={false}>
          {label}
        </Notice>
      )}
      {notice?.key === "verif.expiry.brandToRefresh" && notice.date !== null ? (
        <p data-badge-notice={notice.key}>
          {t(notice.key, {
            date: formatVerificationDate(notice.date, locale),
          })}
        </p>
      ) : null}
      <p className={MEMBER_FIELD_HELP_CLASSES}>
        {t("verif.badge.brandVerified.help")}
      </p>
    </div>
  );
}

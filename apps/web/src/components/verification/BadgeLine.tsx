"use client";

// A badge of a creator's network line, written (docs/mvp/08 RG4, RG5, RG7, RG10, RG93, RG97, EC-L2E-9;
// 17 §5.3): « Compte vérifié — Instagram, le 3 mars 2026 », the date complete, the network named, the
// short explanation beside it and never in a help page. A badge that needs an action (« à rafraîchir »,
// « à reconfirmer ») is written in full and drawn as a warning, with its own icon: the state is the
// words, never the colour (RG97). No identifier of the account, no agent, no gap appears here (RG89,
// RG90); this component only writes what the API gave and the translation files say.
import type { OwnBadge } from "@influx/contracts/verification";
import { useLocale, useTranslations } from "next-intl";
import { Notice } from "@/components/member/ui/Notice";
import { VerifiedBadge } from "@/components/member/ui/VerifiedBadge";
import { MEMBER_FIELD_HELP_CLASSES } from "@/components/member/ui/field-classes";
import {
  badgeKeysOf,
  badgeNoticeOf,
  formatCalendarDay,
  formatVerificationDate,
} from "./verification-view";

export function BadgeLine({
  badge,
  network,
}: {
  badge: OwnBadge;
  /** The name of the network, in the language of the page. */
  network: string;
}) {
  const t = useTranslations("verification");
  const locale = useLocale();
  const keys = badgeKeysOf(badge);
  if (keys === null) {
    return null;
  }
  const date = formatVerificationDate(badge.grantedAt, locale);
  const label = t(keys.label, { network, date });
  const periodKnown = badge.periodStart !== null && badge.periodEnd !== null;
  const help =
    keys.help === null ||
    (keys.help === "verif.badge.audienceVerified.help" && !periodKnown)
      ? null
      : t(keys.help, {
          network,
          start:
            badge.periodStart === null
              ? ""
              : formatCalendarDay(badge.periodStart, locale),
          end:
            badge.periodEnd === null
              ? ""
              : formatCalendarDay(badge.periodEnd, locale),
        });
  const notice = badgeNoticeOf(badge);
  return (
    <div
      className="flex flex-col gap-2"
      data-badge={badge.level}
      data-badge-state={badge.state}
    >
      {keys.needsAction ? (
        <Notice tone="warning" announce={false}>
          {label}
        </Notice>
      ) : (
        <VerifiedBadge text={label} />
      )}
      {notice === null ? null : (
        <p data-badge-notice={notice.key}>
          {t(notice.key, {
            network,
            date:
              notice.date === null
                ? ""
                : formatVerificationDate(notice.date, locale),
          })}
        </p>
      )}
      {help === null ? null : (
        <p className={MEMBER_FIELD_HELP_CLASSES}>{help}</p>
      )}
    </div>
  );
}

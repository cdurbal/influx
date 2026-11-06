"use client";

// The state of a creator's account in the side column (docs/mvp/17 §2.3 "Bloc d'état du compte";
// jalons/l2d, commit 15), written as the brand's is (brand-profile/AccountStateBlock.tsx): the state
// of the profile, what is missing, the way to the profile. From lg only (the home carries it on a
// phone); nothing for a brand, nor while the profile is read or unreadable (the home says so). The
// completeness is the creator's own and no score is shown here at all (07 RG90). Nothing but words:
// no amount, rate or price (D78).
import { useLocale, useTranslations } from "next-intl";
import { ACCOUNT_STATE_CLASSES } from "@/components/member/shell-classes";
import { memberButtonClasses } from "@/components/member/ui/button-classes";
import { cn } from "@/components/ui/class-names";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import { creatorNextActionOf } from "./creator-profile-view";
import type { CreatorSummaryState } from "./use-creator-summary";

export function CreatorAccountStateBlock({
  state,
}: {
  state: CreatorSummaryState;
}) {
  const t = useTranslations("creatorProfile");
  const tState = useTranslations("member.shell.accountState");
  const locale = useLocale();
  if (state.kind !== "ready") {
    return null;
  }
  const { summary } = state;
  const missing = summary.missingRequired.length;
  return (
    <div className={ACCOUNT_STATE_CLASSES}>
      <p className="text-sm font-semibold text-text-primary">
        {tState("state", { state: t(`state.${summary.status}`) })}
      </p>
      {missing > 0 ? (
        <p className="text-sm text-text-secondary">
          {tState("missing", { count: missing })}
        </p>
      ) : null}
      <Link
        href={memberPageHref("accountProfile", locale)}
        className={cn(memberButtonClasses("secondary", "md"), "w-full")}
      >
        {t(`home.${creatorNextActionOf(summary)}`)}
      </Link>
    </div>
  );
}

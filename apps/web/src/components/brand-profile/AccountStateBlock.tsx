"use client";

// The state of a brand's account in the side column (docs/mvp/17 §2.3 "Bloc d'état du compte";
// jalons/l2b, commit 13): the state of the profile written, what is missing, and the way to the
// profile. From lg only (the home carries it on a phone); nothing for a creator, nor while the
// profile is read or unreadable (the home says so). The completeness is never shown to the other
// party (06 RG57), and no score is shown here at all. Nothing but words: no amount, rate or price.
import { useLocale, useTranslations } from "next-intl";
import { memberButtonClasses } from "@/components/member/ui/button-classes";
import { cn } from "@/components/ui/class-names";
import { ACCOUNT_STATE_CLASSES } from "@/components/member/shell-classes";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import { nextActionOf } from "./brand-profile-view";
import type { BrandSummaryState } from "./use-brand-summary";

export function AccountStateBlock({ state }: { state: BrandSummaryState }) {
  const t = useTranslations("brandProfile");
  const tState = useTranslations("member.shell.accountState");
  const locale = useLocale();
  if (state.kind !== "ready") {
    return null;
  }
  const { summary } = state;
  const missing = summary.missingRequired.length;
  const action = nextActionOf(summary);
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
      {action === null ? null : (
        <Link
          href={memberPageHref("accountProfile", locale)}
          className={cn(memberButtonClasses("secondary", "md"), "w-full")}
        >
          {tState(action)}
        </Link>
      )}
    </div>
  );
}

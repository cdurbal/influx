"use client";

// The state of a brand's account in the side column (docs/mvp/17 §2.3 "Bloc d'état du compte";
// jalons/l2b, commit 13; E01.0-S11 to S13): the state of the profile written, what is missing, and
// the way to the profile; once published, the state alone (CA04). From lg only (the home carries it
// on a phone); nothing for a creator, nor while the profile is read or unreadable (the home says
// so). The completeness is never shown to the other party (06 RG57), and no score is shown here at
// all. Nothing but words: no amount, rate or price.
import { useLocale, useTranslations } from "next-intl";
import { AccountStateLines } from "@/components/member/AccountStateLines";
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
  const missing =
    summary.status === "published" ? 0 : summary.missingRequired.length;
  // Null once the profile is submitted, published or suspended: no way is offered then.
  const action = nextActionOf(summary);
  return (
    <AccountStateLines
      state={tState("state", { state: t(`state.${summary.status}`) })}
      missing={missing > 0 ? tState("missing", { count: missing }) : null}
      way={
        action === null
          ? null
          : {
              href: memberPageHref("accountProfile", locale),
              label: tState(action),
            }
      }
    />
  );
}

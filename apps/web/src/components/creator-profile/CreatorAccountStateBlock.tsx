"use client";

// The state of a creator's account in the side column (docs/mvp/17 §2.3 "Bloc d'état du compte";
// jalons/l2d, commit 15; E01.0-S11 to S13), written as the brand's is
// (brand-profile/AccountStateBlock.tsx): the state of the profile, what is missing, the way to the
// profile; once published, the state alone (CA04). From lg only (the home carries it on a phone);
// nothing for a brand, nor while the profile is read or unreadable (the home says so). The
// completeness is the creator's own and no score is shown here at all (07 RG90). Nothing but words:
// no amount, rate or price (D78).
import { useLocale, useTranslations } from "next-intl";
import { AccountStateLines } from "@/components/member/AccountStateLines";
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
  const published = summary.status === "published";
  const missing = published ? 0 : summary.missingRequired.length;
  return (
    <AccountStateLines
      state={tState("state", { state: t(`state.${summary.status}`) })}
      missing={missing > 0 ? tState("missing", { count: missing }) : null}
      way={
        published
          ? null
          : {
              href: memberPageHref("accountProfile", locale),
              label: t(`home.${creatorNextActionOf(summary)}`),
            }
      }
    />
  );
}

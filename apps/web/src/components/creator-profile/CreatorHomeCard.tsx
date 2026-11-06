"use client";

// The card "Mon profil" of a creator's home (docs/mvp/17 §2.4 "Créateur, compte créé il y a 30
// secondes"; jalons/l2d, commit 15): the alias the brands will see, the state, the completeness, what
// is missing by name and the way to the profile. Nothing else: no campaign, no "to do" of a badge
// (L2E), no chart, no zero everywhere, and never a word about publication (the portfolio and the
// badge do not exist yet, EC-L2D-5). The completeness is the creator's own, never shown to a brand
// (07 RG90). The state comes from the shell (useMember), which reads it with the session. No amount,
// rate, net or price (CLAUDE.md §2, D48, D78).
import { useLocale, useTranslations } from "next-intl";
import { HELP_CLASSES } from "@/components/auth/auth-classes";
import { useMember } from "@/components/member/member-context";
import { Card } from "@/components/member/ui/Card";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { memberButtonClasses } from "@/components/member/ui/button-classes";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { ScoreGauge } from "@/components/member/ui/ScoreGauge";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import {
  creatorNextActionOf,
  type CreatorProfileSummary,
} from "./creator-profile-view";

export function CreatorHomeCard() {
  const t = useTranslations("creatorProfile");
  const { creatorProfile } = useMember();
  const { state } = creatorProfile;
  if (state.kind === "ready") {
    return <ProfileCard summary={state.summary} />;
  }
  if (state.kind === "unavailable") {
    return (
      <Card>
        <ErrorNotice>{t("page.unavailable")}</ErrorNotice>
        <MemberButton variant="secondary" onClick={creatorProfile.reload}>
          {t("page.retry")}
        </MemberButton>
      </Card>
    );
  }
  return (
    <Card>
      <p role="status" className={HELP_CLASSES}>
        {t("page.loading")}
      </p>
    </Card>
  );
}

function ProfileCard({ summary }: { summary: CreatorProfileSummary }) {
  const t = useTranslations("creatorProfile");
  const locale = useLocale();
  const missing = summary.missingRequired;
  const names = new Intl.ListFormat(locale, {
    style: "long",
    type: "conjunction",
  }).format(missing.map((code) => t(`required.${code}`)));
  return (
    <Card>
      <h2 className={CARD_TITLE}>{t("page.title")}</h2>
      <p className="text-md text-text-primary">
        {summary.alias === null
          ? t("alias.none")
          : t("alias.name", { alias: summary.alias })}
      </p>
      <p className="text-sm text-text-secondary">
        {t("home.state", { state: t(`state.${summary.status}`) })}
      </p>
      <ScoreGauge
        label={t("completeness.label")}
        value={summary.score}
        valueText={t("completeness.value", { score: summary.score })}
      />
      <p className="text-md text-text-secondary">
        {missing.length === 0
          ? t("blocks.allSet")
          : t("blocks.missing", { fields: names })}
      </p>
      <Link
        href={memberPageHref("accountProfile", locale)}
        className={memberButtonClasses("primary", "md")}
      >
        {t(`home.${creatorNextActionOf(summary)}`)}
      </Link>
    </Card>
  );
}

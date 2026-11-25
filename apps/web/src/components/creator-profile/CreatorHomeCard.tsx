"use client";

// The card "Mon profil" of a creator's home (docs/mvp/17 §2.4 "Créateur, compte créé il y a 30
// secondes"; jalons/l2d, commit 15): the alias the brands will see, the state, the completeness, what
// is missing by name and the way to the profile. Nothing else: no campaign, no "to do" of a badge
// (L2E), no chart, no zero everywhere, and never a word about publication (the portfolio and the
// badge do not exist yet, EC-L2D-5). The completeness is the creator's own, never shown to a brand
// (07 RG90). The state comes from the shell (useMember), which reads it with the session. The way to
// the profile is the first thing under the gauge, then what is left by section (a count each, a link
// to its anchor), never a paragraph of fourteen names (L2DU-3). No amount, rate, net or price
// (CLAUDE.md §2, D48, D78).
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
  missingBySectionOf,
  sectionAnchorOf,
  type CreatorProfileSummary,
} from "./creator-profile-view";

const LEFT_LINK_CLASSES =
  "inline-flex min-h-(--size-touch-target) items-center text-md text-text-primary underline";

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
  const left = missingBySectionOf(missing);
  const profileHref = memberPageHref("accountProfile", locale);
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
      <Link href={profileHref} className={memberButtonClasses("primary", "md")}>
        {t(`home.${creatorNextActionOf(summary)}`)}
      </Link>
      {missing.length === 0 ? (
        <p className="text-md text-text-secondary">{t("blocks.allSet")}</p>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-md text-text-secondary">
            {t("home.remaining", { count: missing.length })}
          </p>
          <ul className="flex flex-wrap gap-x-4">
            {left.map(({ section, count }) => (
              <li key={section}>
                <Link
                  href={`${profileHref}#${sectionAnchorOf(section)}`}
                  className={LEFT_LINK_CLASSES}
                >
                  {t("home.leftIn", {
                    section: t(`sections.${section}`),
                    count,
                  })}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

"use client";

// The home of a brand (docs/mvp/17 §2.4 "Marque, compte créé il y a 30 secondes"; jalons/l2b,
// commit 13): the next action, the locked screens told in advance, how it works, nothing else. The
// action is the profile: a card that names what is missing and leads to it, or, once the profile is
// submitted, its state written in its place. The state comes from the shell (useMember), which
// reads it with the session; the sign-out and the identity live in the column only (L2AU-4). No
// fake chart, no zero everywhere, no amount, rate, net or price (CLAUDE.md §2, D48, D78).
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";
import {
  HELP_CLASSES,
  SPACE_SCREEN_CLASSES,
  TEXT_LINK_CLASSES,
} from "@/components/auth/auth-classes";
import { useMember } from "@/components/member/member-context";
import { Card } from "@/components/member/ui/Card";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { memberButtonClasses } from "@/components/member/ui/button-classes";
import { PageHeader } from "@/components/member/ui/PageHeader";
import { cn } from "@/components/ui/class-names";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { LockIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import {
  labelKeyOfRequired,
  nextActionOf,
  type BrandProfileSummary,
} from "./brand-profile-view";
import { ProfileStateNotice } from "./ProfileStateNotice";

/** 17 §2.4: three short steps, profile → campaign → a salesperson makes the introduction. */
const HOME_STEPS = ["one", "two", "three"] as const;

export function BrandHome() {
  const t = useTranslations("auth");
  const tAccount = useTranslations("account");
  const tProfile = useTranslations("brandProfile");
  const locale = useLocale();
  const stepsTitleId = useId();
  const { brandProfile } = useMember();
  const { state } = brandProfile;

  return (
    <div className={SPACE_SCREEN_CLASSES}>
      <PageHeader title={t("home.advertiser.title")} />
      {state.kind === "ready" ? (
        <>
          <ProfileCard summary={state.summary} />
          <LockedScreens published={state.summary.status === "published"} />
        </>
      ) : state.kind === "unavailable" ? (
        <UnavailableCard onRetry={brandProfile.reload} />
      ) : (
        <Card>
          <p role="status" className={HELP_CLASSES}>
            {tProfile("page.loading")}
          </p>
        </Card>
      )}
      <section aria-labelledby={stepsTitleId}>
        <Card>
          <h2 id={stepsTitleId} className={CARD_TITLE}>
            {t("home.howItWorks")}
          </h2>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-md text-text-secondary">
            {HOME_STEPS.map((step) => (
              <li key={step}>{t(`home.advertiser.steps.${step}`)}</li>
            ))}
          </ol>
        </Card>
      </section>
      <Link
        href={memberPageHref("accountHub", locale)}
        className={TEXT_LINK_CLASSES}
      >
        {tAccount("homeLink")}
      </Link>
    </div>
  );
}

/** The profile unreadable: said, with a way to try again; the rest of the home stands. */
function UnavailableCard({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("brandProfile");
  return (
    <Card>
      <ErrorNotice>{t("page.unavailable")}</ErrorNotice>
      <MemberButton variant="secondary" onClick={onRetry}>
        {t("page.retry")}
      </MemberButton>
    </Card>
  );
}

/**
 * Block 1. A draft or a refused profile: the action card, the state written, what is missing by
 * name (06 RG61, the sentence of the form) and the way to the profile. Any other state is written in
 * place of the card (17 §2.4), with the words the profile page uses.
 */
function ProfileCard({ summary }: { summary: BrandProfileSummary }) {
  const t = useTranslations("brandProfile");
  const tState = useTranslations("member.shell.accountState");
  const locale = useLocale();
  const action = nextActionOf(summary);
  const written = summary.status !== "draft" && summary.status !== "rejected";
  if (written) {
    return <ProfileStateNotice source={summary} locale={locale} />;
  }
  const missing = summary.missingRequired;
  const names = new Intl.ListFormat(locale, {
    style: "long",
    type: "conjunction",
  }).format(
    missing.map((code) =>
      t(`fields.${labelKeyOfRequired(code)}.label`).toLowerCase(),
    ),
  );
  return (
    <Card>
      <h2 className={CARD_TITLE}>
        {missing.length === 0
          ? t("home.action.titleReady")
          : t("home.action.title")}
      </h2>
      <ProfileStateNotice source={summary} locale={locale} />
      <p className="text-md text-text-secondary">
        {missing.length === 0
          ? t("progress.allSet")
          : t("publish.missing", { count: missing.length, fields: names })}
      </p>
      <Link
        href={memberPageHref("accountProfile", locale)}
        className={memberButtonClasses("primary", "md")}
      >
        {tState(action ?? "complete")}
      </Link>
    </Card>
  );
}

/**
 * Block 2 (17 §2.4): "Publier une campagne" and "Rechercher des créateurs", present and explained,
 * not hidden. Until the profile is published they say so (`search.blockedUntilPublished` for the
 * search); once it is, they say they are coming, the screens being those of the next lot.
 */
function LockedScreens({ published }: { published: boolean }) {
  const t = useTranslations("brandProfile");
  const items = [
    {
      key: "campaign",
      title: t("home.locked.campaign.title"),
      text: published ? t("home.locked.soon") : t("home.locked.campaign.text"),
    },
    {
      key: "search",
      title: t("home.locked.search.title"),
      text: published
        ? t("home.locked.soon")
        : t("search.blockedUntilPublished"),
    },
  ];
  return (
    <ul className="flex flex-col gap-4">
      {items.map((item) => (
        <li key={item.key}>
          <Card>
            <h2 className={cn(CARD_TITLE, "flex items-center gap-2")}>
              <LockIcon
                aria-hidden="true"
                className="size-(--size-icon-md) shrink-0 text-text-secondary"
              />
              {item.title}
            </h2>
            <p className="text-md text-text-secondary">{item.text}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

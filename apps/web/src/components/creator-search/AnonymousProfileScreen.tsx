"use client";

// The anonymous profile a brand opens from its search (docs/mvp/10 RG1, RG15, RG41, RG42, RG48, RG50, RG51, RG55,
// RG61, RG65, RG66; 17 §4.4, §7.1; D38, D45, D46, D48, D78; jalons/l3f, commit 11): the card of the search, whole and
// larger (the same fields, never richer: RG50), its three approved visuals, the region when the base serves it
// (RG15), « Proposé car » and the note of vigilance, and the two actions the pilot has (RG55): « Ajouter à ma
// sélection » and « Demander une sélection à l'équipe INFLUX » (permanent, RG61). No other button: nothing leads to an
// introduction, which is Lot 4. Opening the profile is journaled and bounded by the base (RG66, T15.2); an alias
// unknown, excluded or malformed is told once, « ce profil n'est plus disponible » (CA49). The page of a brand: any
// other role finds no such page (18 T14.3, T14.4). The profile is the answer of the API as it is, never a reconstitution.
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { TEXT_LINK_CLASSES } from "@/components/auth/auth-classes";
import { useOnline } from "@/components/auth/use-online";
import { CreatorCardView } from "@/components/creator-profile/CreatorCardView";
import {
  BACK_ICON_CLASSES,
  BACK_LINK_CLASSES,
} from "@/components/account/account-classes";
import { useMember } from "@/components/member/member-context";
import { Card } from "@/components/member/ui/Card";
import { Notice } from "@/components/member/ui/Notice";
import { PageBackContext, PageHeader } from "@/components/member/ui/PageHeader";
import { buttonClasses } from "@/components/member/ui/button-classes";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { ChevronLeftIcon, CircleAlertIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import { AddToSelectionButton } from "./AddToSelectionButton";
import { openCreatorProfile } from "./creator-search-api";
import {
  CARD_ACTION_ROW_CLASSES,
  CARD_ACTIONS_CLASSES,
  SEARCH_PAGE_CLASSES,
  SEARCH_REASON_LIST_CLASSES,
  SEARCH_REASONS_CLASSES,
} from "./creator-search-classes";
import { cardVisualsOf, waitOf, type SearchQuery } from "./creator-search-view";
import {
  PROFILE_VISUALS_SHOWN,
  profileScreenOf,
  profileViewOf,
  requestHref,
  searchHref,
  type OpenedProfile,
  type ProfileScreen,
  type SearchPlace,
} from "./shortlists-view";
import { ShortlistsLink } from "./ShortlistsLink";
import { useVisualImages } from "./use-card-visuals";
import { useSearchLabels } from "./use-search-labels";
import { useShortlists } from "./use-shortlists";

/** The page of a brand; any other role finds a page that does not exist (18 T14.3, T14.4). */
export function AnonymousProfileScreen({
  alias,
  query,
  page,
  listId,
}: {
  alias: string;
  query: SearchQuery;
  page: number;
  listId: string | null;
}) {
  const { me } = useMember();
  if (me.role !== "advertiser") {
    notFound();
  }
  return <AnonymousProfileView alias={alias} place={{ query, page, listId }} />;
}

/**
 * Opens the profile once: it is journaled and counted by the base, so a second run of the effect (React's strict
 * mode) or a re-render never asks again; going to another alias asks again.
 */
function useOpenedProfile(alias: string, onSignedOut: () => void) {
  const [answer, setAnswer] = useState<{
    alias: string;
    screen: ProfileScreen;
  } | null>(null);
  const asked = useRef<string | null>(null);
  const callbacks = useRef(onSignedOut);
  useEffect(() => {
    callbacks.current = onSignedOut;
  }, [onSignedOut]);
  useEffect(() => {
    if (asked.current === alias) {
      return;
    }
    asked.current = alias;
    void openCreatorProfile(alias).then((result) => {
      if (result.kind === "unauthenticated") {
        callbacks.current();
        return;
      }
      setAnswer({ alias, screen: profileScreenOf(result) });
    });
  }, [alias]);
  return answer?.alias === alias
    ? answer.screen
    : ({ kind: "loading" } as const);
}

function AnonymousProfileView({
  alias,
  place,
}: {
  alias: string;
  place: SearchPlace;
}) {
  const t = useTranslations("creatorSearch");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const online = useOnline();
  const { signedOut } = useMember();
  const onSignedOut = () => signedOut(null);
  const screen = useOpenedProfile(alias, onSignedOut);
  const back = (
    <Link href={searchHref(locale, place)} className={BACK_LINK_CLASSES}>
      <span className="sr-only">{tAccount("hub.backPrefix")} </span>
      <ChevronLeftIcon aria-hidden="true" className={BACK_ICON_CLASSES} />
      {t("profile.back")}
    </Link>
  );
  return (
    <PageBackContext value={back}>
      <div className={SEARCH_PAGE_CLASSES}>
        {online ? null : <Notice tone="warning">{tAccount("offline")}</Notice>}
        <PageHeader title={t("profile.title")} />
        <ShortlistsLink />
        <p className="text-md text-text-secondary">{t("profile.explain")}</p>
        <ProfileBody
          alias={alias}
          screen={screen}
          place={place}
          onSignedOut={onSignedOut}
        />
      </div>
    </PageBackContext>
  );
}

function ProfileBody({
  alias,
  screen,
  place,
  onSignedOut,
}: {
  alias: string;
  screen: ProfileScreen;
  place: SearchPlace;
  onSignedOut: () => void;
}) {
  const t = useTranslations("creatorSearch");
  const tBrand = useTranslations("brandProfile");
  const locale = useLocale();
  const request = (
    <Link
      href={requestHref(locale, place)}
      className={buttonClasses("secondary")}
    >
      {t("request.link")}
    </Link>
  );
  switch (screen.kind) {
    case "loading":
      return (
        <p role="status" className="text-sm text-text-secondary">
          {t("profile.loading")}
        </p>
      );
    case "closed":
      return (
        <Card>
          <h2 className={CARD_TITLE}>{t("closed.title")}</h2>
          <p data-state="closed" className="text-md text-text-secondary">
            {t("closed.notice")}
          </p>
          {request}
        </Card>
      );
    case "brand_not_published":
      return (
        <Card>
          <p
            data-state="brand_not_published"
            className="text-md text-text-secondary"
          >
            {tBrand("search.blockedUntilPublished")}
          </p>
          <Link
            href={memberPageHref("accountProfile", locale)}
            className={TEXT_LINK_CLASSES}
          >
            {t("notPublished.action")}
          </Link>
        </Card>
      );
    case "gone":
      return (
        <Card>
          <p data-state="gone" className="text-md text-text-secondary">
            {t("profile.gone")}
          </p>
          <Link
            href={searchHref(locale, place)}
            className={buttonClasses("secondary")}
          >
            {t("profile.back")}
          </Link>
        </Card>
      );
    case "rate_limited": {
      const wait = waitOf(screen.retryAfterSeconds);
      return (
        <div className="flex flex-col gap-4">
          <Notice tone="warning">
            <p data-state="rate_limited">{t("profile.rateLimited")}</p>
            {wait === null ? null : (
              <p>
                {wait.unit === "minutes"
                  ? t("profile.waitMinutes", { count: wait.count })
                  : t("profile.waitHours", { count: wait.count })}
              </p>
            )}
          </Notice>
          {request}
        </div>
      );
    }
    case "failed":
      return (
        <div className="flex flex-col gap-4">
          <ErrorNotice>
            <span data-state="failed">{t("profile.failed")}</span>
          </ErrorNotice>
          <Link
            href={searchHref(locale, place)}
            className={buttonClasses("secondary")}
          >
            {t("profile.back")}
          </Link>
        </div>
      );
    case "profile":
      return (
        <OpenedProfileView
          alias={alias}
          profile={screen.profile}
          place={place}
          onSignedOut={onSignedOut}
        />
      );
  }
}

function OpenedProfileView({
  alias,
  profile,
  place,
  onSignedOut,
}: {
  alias: string;
  profile: OpenedProfile;
  place: SearchPlace;
  onSignedOut: () => void;
}) {
  const t = useTranslations("creatorSearch");
  const locale = useLocale();
  const labels = useSearchLabels();
  const selection = useShortlists({
    preferredId: place.listId,
    onSignedOut,
  });
  const refs = useMemo(
    () => cardVisualsOf(profile, PROFILE_VISUALS_SHOWN),
    [profile],
  );
  const visuals = useVisualImages(refs, onSignedOut);
  const view = useMemo(() => {
    const drawn = profileViewOf(profile, labels);
    return {
      ...drawn,
      card: {
        ...drawn.card,
        visuals: drawn.card.visuals.filter(
          (visual) => !visuals.failed.has(visual.id),
        ),
      },
    };
  }, [profile, labels, visuals.failed]);
  return (
    <div
      data-profile={alias}
      className="mx-auto w-full max-w-(--container-narrow)"
    >
      <CreatorCardView
        card={view.card}
        images={visuals.images}
        noVisualText={null}
        footer={
          <>
            <div data-reasons="" className={SEARCH_REASONS_CLASSES}>
              <h3 className={CARD_TITLE}>{t("reasons.title")}</h3>
              <ul className={SEARCH_REASON_LIST_CLASSES}>
                {view.reasons.map((text, index) => (
                  <li key={index}>{text}</li>
                ))}
              </ul>
              {view.vigilance === null ? null : (
                <p
                  data-vigilance={profile.vigilance}
                  className="flex items-start gap-2 text-sm"
                >
                  <CircleAlertIcon
                    aria-hidden="true"
                    className="size-(--size-icon-md) shrink-0 text-feedback-warning-icon"
                  />
                  <span>
                    {t("reasons.vigilance", { text: view.vigilance })}
                  </span>
                </p>
              )}
            </div>
            <div className={CARD_ACTIONS_CLASSES}>
              <AddToSelectionButton selection={selection} alias={alias} />
              <div className={CARD_ACTION_ROW_CLASSES}>
                <Link
                  href={requestHref(locale, place)}
                  data-profile-request=""
                  className={buttonClasses("secondary")}
                >
                  {t("request.link")}
                </Link>
                <Link
                  href={memberPageHref("advertiserShortlists", locale)}
                  className={TEXT_LINK_CLASSES}
                >
                  {t("panel.all")}
                </Link>
              </div>
              <p className="text-sm text-text-secondary">
                {t("profile.private")}
              </p>
            </div>
          </>
        }
      />
    </div>
  );
}

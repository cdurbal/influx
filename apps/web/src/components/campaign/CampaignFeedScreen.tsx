"use client";

// "Campagnes" of a creator, the feed C5 (docs/mvp/17 §2.6, §5.5; 11 RG13 to RG26, RG33 to RG36; D11, D48, D78;
// jalons/l3d, commit 04): the count of campaigns BEFORE the list (RG35), two sorts (RG33), one card per campaign
// (RG15 at the pilot), the greyed cards of the campaigns whose applications closed within the last days (RG26),
// and « Voir la suite » (RG36: never an endless scroll, the cap of RG21 is said when it hides cards). Five states:
// loading (three skeletons), empty (what a creator can do), the list, unreadable, and refused (a suspended
// profile, a read too soon). The list, its order, its count and its cap are the API's: nothing here ranks,
// filters or counts, and no amount, range or net is shown (CLAUDE.md §2, D48, D78). The page is the one a brand
// reads as "Mes campagnes"; the screen follows the real role (CampaignsScreen).
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";
import { TEXT_LINK_CLASSES } from "@/components/auth/auth-classes";
import { useOnline } from "@/components/auth/use-online";
import { useMember } from "@/components/member/member-context";
import { Card } from "@/components/member/ui/Card";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { PageHeader } from "@/components/member/ui/PageHeader";
import {
  MEMBER_FIELD_LABEL_CLASSES,
  memberControlClasses,
} from "@/components/member/ui/field-classes";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import {
  CAMPAIGN_PAGE_CLASSES,
  FEED_COUNT_CLASSES,
  FEED_LIST_CLASSES,
  FEED_SKELETON_CLASSES,
  FEED_SORT_CLASSES,
  FEED_TOOLBAR_CLASSES,
} from "./campaign-classes";
import { previewLabelsOf } from "./campaign-preview-labels";
import { CampaignFeedCard } from "./CampaignFeedCard";
import {
  cardViewOf,
  FEED_SORTS,
  sortOf,
  type FeedFailure,
} from "./open-campaigns-view";
import { useOpenCampaigns } from "./use-open-campaigns";

/** The three skeletons of the first reading (17 §5.5, « chargement »): the page says it is loading, once. */
const SKELETON_COUNT = 3;

export function CampaignFeedScreen() {
  const t = useTranslations("campaign");
  const tBrand = useTranslations("brandProfile");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const online = useOnline();
  const { signedOut } = useMember();
  const feed = useOpenCampaigns({ onSignedOut: () => signedOut(null) });
  const { state } = feed;
  const labels = useMemo(
    () => previewLabelsOf(t, tBrand, locale),
    [t, tBrand, locale],
  );
  const cards = useMemo(
    () =>
      state.phase === "ready"
        ? state.items.map((card) => cardViewOf(card, labels))
        : [],
    [state, labels],
  );

  const failureText = (
    failure: FeedFailure,
    retryAfterSeconds: number | null,
  ): string => {
    switch (failure) {
      case "forbidden":
        return t("feed.forbidden");
      case "rate_limited":
        return retryAfterSeconds === null
          ? t("feed.rateLimited")
          : t("feed.rateLimitedWait", { seconds: retryAfterSeconds });
      default:
        return t("feed.unavailable");
    }
  };

  let body;
  if (state.phase === "loading") {
    body = (
      <div className="flex flex-col gap-4">
        <p role="status" className="text-sm text-text-secondary">
          {t("feed.loading")}
        </p>
        <div aria-hidden="true" className={FEED_LIST_CLASSES}>
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <div key={index} className={FEED_SKELETON_CLASSES} />
          ))}
        </div>
      </div>
    );
  } else if (state.phase === "failed") {
    body = (
      <div className="flex flex-col gap-4">
        <ErrorNotice>
          {failureText(state.failure, state.retryAfterSeconds)}
        </ErrorNotice>
        {state.failure === "forbidden" ? null : (
          <MemberButton
            variant="secondary"
            onClick={() => feed.load(state.sort)}
          >
            {t("feed.retry")}
          </MemberButton>
        )}
      </div>
    );
  } else if (state.items.length === 0) {
    body = (
      <Card>
        <h2 className={CARD_TITLE}>{t("feed.empty.title")}</h2>
        <p className="text-md text-text-secondary">{t("feed.empty.text")}</p>
        <Link
          href={memberPageHref("accountProfile", locale)}
          className={TEXT_LINK_CLASSES}
        >
          {t("feed.empty.profileLink")}
        </Link>
      </Card>
    );
  } else {
    const { more } = state;
    body = (
      <>
        <ul aria-label={t("feed.title")} className={FEED_LIST_CLASSES}>
          {cards.map((view) => (
            <CampaignFeedCard key={view.id} view={view} locale={locale} />
          ))}
        </ul>
        {state.capReached ? (
          <Notice tone="info">
            {t("feed.capReached", {
              count: state.items.length,
              total: state.total,
            })}
          </Notice>
        ) : null}
        {more.kind === "failed" ? (
          <ErrorNotice>
            {failureText(more.failure, more.retryAfterSeconds)}
          </ErrorNotice>
        ) : null}
        {state.nextPage === null ? null : (
          <MemberButton
            variant="secondary"
            aria-disabled={more.kind === "loading" || undefined}
            onClick={() => feed.more()}
          >
            {more.kind === "loading" ? t("feed.moreLoading") : t("feed.more")}
          </MemberButton>
        )}
      </>
    );
  }

  const sortControl = (
    <div className={FEED_SORT_CLASSES}>
      <label htmlFor="feed-sort" className={MEMBER_FIELD_LABEL_CLASSES}>
        {t("feed.sort.label")}
      </label>
      <select
        id="feed-sort"
        name="feedSort"
        value={state.sort}
        onChange={(event) => feed.load(sortOf(event.target.value))}
        className={memberControlClasses(false)}
      >
        {FEED_SORTS.map((sort) => (
          <option key={sort} value={sort}>
            {t(`feed.sort.${sort}`)}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <div className={CAMPAIGN_PAGE_CLASSES}>
      {online ? null : <Notice tone="warning">{tAccount("offline")}</Notice>}
      <PageHeader title={t("feed.title")} />
      <div className={FEED_TOOLBAR_CLASSES}>
        {state.phase === "ready" && state.items.length > 0 ? (
          <p
            role="status"
            data-feed-count={state.total}
            className={FEED_COUNT_CLASSES}
          >
            {t("feed.count", { count: state.total })}
          </p>
        ) : (
          <span />
        )}
        {state.phase === "ready" && state.items.length === 0
          ? null
          : sortControl}
      </div>
      {body}
    </div>
  );
}

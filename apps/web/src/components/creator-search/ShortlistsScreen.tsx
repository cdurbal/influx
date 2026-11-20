"use client";

// « Mes sélections » (docs/mvp/10 RG51, RG63; 17 §4.9; D38, D45; jalons/l3f, commit 11): the brand's private lists, the
// second page of « Créateurs » (D74). It makes a list, opens one (its page renames it, attaches it to a campaign,
// notes and removes its creators) and says what a list is: private, nothing sent to a creator. There is no « tout
// sélectionner » and no export (RG63). The lists, their counts and the bound on their number are the base's. The page of
// a brand: any other role finds no such page (18 T14.3, T14.4).
import type { ShortlistSummary } from "@influx/contracts/shortlists";
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { TEXT_LINK_CLASSES } from "@/components/auth/auth-classes";
import { useOnline } from "@/components/auth/use-online";
import {
  BACK_ICON_CLASSES,
  BACK_LINK_CLASSES,
} from "@/components/account/account-classes";
import { useMember } from "@/components/member/member-context";
import { Card } from "@/components/member/ui/Card";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { PageBackContext, PageHeader } from "@/components/member/ui/PageHeader";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { ChevronLeftIcon } from "@/components/ui/icons";
import type { AppLocale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import {
  LISTS_GRID_CLASSES,
  SEARCH_PAGE_CLASSES,
} from "./creator-search-classes";
import { ShortlistForm } from "./ShortlistForm";
import { shortlistHref } from "./shortlists-view";
import { useSearchLabels } from "./use-search-labels";
import { useOriginCampaigns, type OriginCampaign } from "./use-search-sources";
import { useShortlists } from "./use-shortlists";
import { memberButtonClasses } from "@/components/member/ui/button-classes";

/** The page of a brand; any other role finds a page that does not exist (18 T14.3, T14.4). */
export function ShortlistsScreen() {
  const { me } = useMember();
  if (me.role !== "advertiser") {
    notFound();
  }
  return <ShortlistsView />;
}

/** The campaign a list is attached to, by its title; none when it has none. */
function campaignLineOf(
  list: ShortlistSummary,
  campaigns: readonly OriginCampaign[],
  text: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (list.campaignId === null) {
    return text("lists.noCampaign");
  }
  const found = campaigns.find((campaign) => campaign.id === list.campaignId);
  return text("lists.campaign", {
    title:
      found === undefined
        ? text("lists.campaignOther")
        : (found.title ?? text("campaign.untitled")),
  });
}

function ShortlistsView() {
  const t = useTranslations("creatorSearch");
  const tAccount = useTranslations("account");
  const locale = useLocale() as AppLocale;
  const online = useOnline();
  const { signedOut } = useMember();
  const labels = useSearchLabels();
  const campaigns = useOriginCampaigns();
  const selection = useShortlists({
    preferredId: null,
    readMembers: false,
    onSignedOut: () => signedOut(null),
  });
  const { state } = selection;
  const back = (
    <Link
      href={memberPageHref("advertiserCreators", locale)}
      className={BACK_LINK_CLASSES}
    >
      <span className="sr-only">{tAccount("hub.backPrefix")} </span>
      <ChevronLeftIcon aria-hidden="true" className={BACK_ICON_CLASSES} />
      {t("selectionRequest.back")}
    </Link>
  );
  const options =
    campaigns.state.phase === "ready" ? campaigns.state.value : [];
  return (
    <PageBackContext value={back}>
      <div className={SEARCH_PAGE_CLASSES}>
        {online ? null : <Notice tone="warning">{tAccount("offline")}</Notice>}
        <PageHeader title={t("lists.title")} />
        <p className="text-md text-text-secondary">{t("lists.explain")}</p>
        {state.phase === "loading" ? (
          <p role="status" className="text-sm text-text-secondary">
            {t("lists.loading")}
          </p>
        ) : null}
        {state.phase === "failed" ? (
          <div className="flex flex-col gap-4">
            <ErrorNotice>
              <span data-state="failed">{t("lists.failed")}</span>
            </ErrorNotice>
            <div>
              <MemberButton variant="secondary" onClick={selection.reload}>
                {t("failed.retry")}
              </MemberButton>
            </div>
          </div>
        ) : null}
        {state.phase === "closed" ? (
          <Card>
            <h2 className={CARD_TITLE}>{t("closed.title")}</h2>
            <p data-state="closed" className="text-md text-text-secondary">
              {t("lists.closed")}
            </p>
          </Card>
        ) : null}
        {state.phase === "brand_not_published" ? (
          <Card>
            <p
              data-state="brand_not_published"
              className="text-md text-text-secondary"
            >
              {t("lists.notPublished")}
            </p>
            <Link
              href={memberPageHref("accountProfile", locale)}
              className={TEXT_LINK_CLASSES}
            >
              {t("notPublished.action")}
            </Link>
          </Card>
        ) : null}
        {state.phase === "ready" ? (
          <>
            {state.lists.length === 0 ? (
              <Card>
                <p
                  data-state="no_lists"
                  className="text-md text-text-secondary"
                >
                  {t("lists.empty")}
                </p>
                <Link
                  href={memberPageHref("advertiserCreators", locale)}
                  className={memberButtonClasses("secondary")}
                >
                  {t("lists.toSearch")}
                </Link>
              </Card>
            ) : (
              <ul aria-label={t("lists.title")} className={LISTS_GRID_CLASSES}>
                {state.lists.map((list) => (
                  <li key={list.id} data-shortlist={list.id}>
                    <Card>
                      <h2 className={CARD_TITLE}>{list.name}</h2>
                      <p className="text-md text-text-primary">
                        {t("lists.count", { count: list.count })}
                      </p>
                      <p className="text-sm text-text-secondary">
                        {campaignLineOf(list, options, labels.text)}
                      </p>
                      <Link
                        href={shortlistHref(locale, list.id)}
                        data-open-shortlist={list.id}
                        className={memberButtonClasses("secondary")}
                      >
                        {t("lists.open")}
                        <span className="sr-only"> {list.name}</span>
                      </Link>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
            <Card>
              <h2 className={CARD_TITLE}>{t("lists.form.title")}</h2>
              <ShortlistForm
                initialName=""
                initialCampaignId={null}
                campaigns={campaigns.state}
                submitLabel={t("lists.form.create")}
                savedText={t("lists.form.created")}
                clearOnSuccess
                onSubmit={selection.create}
              />
            </Card>
          </>
        ) : null}
      </div>
    </PageBackContext>
  );
}

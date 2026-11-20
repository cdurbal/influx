"use client";

// « Demander une sélection à l'équipe INFLUX » (docs/mvp/10 RG61; 17 §4.4; D45; jalons/l3f, commits 10 and 11): the
// child of M4 that the permanent button leads to. It takes the criteria of the search back from the address
// (reprise) and says what a request is; its form (the message, the campaign, the send) is the next commit's. No
// creator is told, nothing leaves INFLUX (D45, CA64). The page of a brand: any other role finds no such page.
import type { CreatorSearchFilters } from "@influx/contracts/creator-search";
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  BACK_ICON_CLASSES,
  BACK_LINK_CLASSES,
} from "@/components/account/account-classes";
import { useMember } from "@/components/member/member-context";
import { Card } from "@/components/member/ui/Card";
import { PageBackContext, PageHeader } from "@/components/member/ui/PageHeader";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import { SEARCH_PAGE_CLASSES } from "./creator-search-classes";
import { addressParamsOf, criteriaOf } from "./creator-search-view";
import { useSearchLabels } from "./use-search-labels";

export function SelectionRequestScreen({
  filters,
}: {
  filters: CreatorSearchFilters;
}) {
  const { me } = useMember();
  if (me.role !== "advertiser") {
    notFound();
  }
  return <SelectionRequestView filters={filters} />;
}

function SelectionRequestView({ filters }: { filters: CreatorSearchFilters }) {
  const t = useTranslations("creatorSearch");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const labels = useSearchLabels();
  const criteria = criteriaOf(filters, labels);
  const back = (
    <Link
      href={`${memberPageHref("advertiserCreators", locale)}${addressParamsOf({ filters, sort: "default", campaignId: null })}`}
      className={BACK_LINK_CLASSES}
    >
      <span className="sr-only">{tAccount("hub.backPrefix")} </span>
      <ChevronLeftIcon aria-hidden="true" className={BACK_ICON_CLASSES} />
      {t("selectionRequest.back")}
    </Link>
  );
  return (
    <PageBackContext value={back}>
      <div className={SEARCH_PAGE_CLASSES}>
        <PageHeader title={t("selectionRequest.title")} />
        <p className="text-md text-text-secondary">
          {t("selectionRequest.explain")}
        </p>
        <Card>
          <h2 className={CARD_TITLE}>{t("selectionRequest.recap")}</h2>
          {criteria.length === 0 ? (
            <p className="text-md text-text-secondary">
              {t("selectionRequest.recapNone")}
            </p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-md text-text-primary">
              {criteria.map((criterion) => (
                <li key={criterion.id}>{criterion.label}</li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </PageBackContext>
  );
}

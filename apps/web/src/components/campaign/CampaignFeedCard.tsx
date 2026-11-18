"use client";

// One card of the creator's feed of open campaigns (docs/mvp/11 RG15, RG26; 17 §5.5; D46, D48, D78; jalons/l3d,
// commit 04): the brand with its badge and the date of its check, the title, the topics, the deliverables, the
// nature of the consideration followed by « À négocier avec votre commercial », the audience countries, the
// period, the deadline and the date of publication. Nothing else: no amount, no range, no net, no counter of
// applications or of views, no way to contact the brand (RG25, D46). A greyed card (applications closed, RG26)
// says so in words and opens nothing. The card is drawn from `cardViewOf` (open-campaigns-view.ts): no rule here.
import type { BrandLogo } from "@influx/contracts/brand-profile";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Card } from "@/components/member/ui/Card";
import { memberButtonClasses } from "@/components/member/ui/button-classes";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { StatusBadge } from "@/components/member/ui/StatusBadge";
import { VerifiedBadge } from "@/components/member/ui/VerifiedBadge";
import { Link } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { CAMPAIGN_PAGE, memberPageHref } from "@/lib/member-paths";
import {
  FEED_BRAND_CLASSES,
  FEED_CARD_CLASSES,
  FEED_CARD_CLOSED_CLASSES,
  FEED_FACTS_CLASSES,
  FEED_PAY_CLASSES,
  PREVIEW_LOGO_CLASSES,
} from "./campaign-classes";
import { readOpenCampaignBrandLogo } from "./open-campaigns-api";
import type { FeedCardView } from "./open-campaigns-view";

/** The logo of the brand of a card, read once through its own route; the name stands without it. */
function CardLogo({ id, name }: { id: string; name: string }) {
  const t = useTranslations("campaign");
  const [logo, setLogo] = useState<BrandLogo | null>(null);
  useEffect(() => {
    let current = true;
    void readOpenCampaignBrandLogo(id).then((result) => {
      if (current && result.kind === "ok") {
        setLogo(result.data.logo);
      }
    });
    return () => {
      current = false;
    };
  }, [id]);
  return logo === null ? null : (
    // eslint-disable-next-line @next/next/no-img-element -- a data: source built by the API
    <img
      src={`data:${logo.contentType};base64,${logo.data}`}
      alt={t("feed.card.logoAlt", { name })}
      width={logo.width}
      height={logo.height}
      className={PREVIEW_LOGO_CLASSES}
    />
  );
}

export function CampaignFeedCard({
  view,
  locale,
}: {
  view: FeedCardView;
  locale: AppLocale;
}) {
  const t = useTranslations("campaign");
  const title = view.title ?? t("list.untitled");
  const record = memberPageHref(CAMPAIGN_PAGE, locale, view.id);
  const { period } = view;
  return (
    <li data-feed-card={view.id} data-closed={view.closed ? "" : undefined}>
      <Card
        className={
          view.closed
            ? `${FEED_CARD_CLASSES} ${FEED_CARD_CLOSED_CLASSES}`
            : FEED_CARD_CLASSES
        }
      >
        <div className={FEED_BRAND_CLASSES}>
          {view.hasLogo ? (
            <CardLogo id={view.id} name={view.brandName} />
          ) : null}
          <div className="flex min-w-0 flex-col gap-1">
            <p
              data-feed-brand=""
              className="font-display text-md font-bold text-text-primary"
            >
              {view.brandName}
            </p>
            {view.badge === null ? null : <VerifiedBadge text={view.badge} />}
            {view.brandFacts === null ? null : (
              <p className="text-sm text-text-secondary">{view.brandFacts}</p>
            )}
          </div>
        </div>
        <h2 className={CARD_TITLE}>
          {view.closed ? (
            title
          ) : (
            <Link href={record} className="underline">
              {title}
            </Link>
          )}
        </h2>
        {view.closed ? (
          <StatusBadge tone="neutral">{t("feed.closed")}</StatusBadge>
        ) : null}
        {view.topics === null ? null : (
          <p className="text-md text-text-secondary">{view.topics}</p>
        )}
        {view.deliverables.length === 0 ? null : (
          <ul className="list-disc pl-5 text-md text-text-primary">
            {view.deliverables.map((line, index) => (
              <li key={`${index}-${line}`}>{line}</li>
            ))}
          </ul>
        )}
        <div className={FEED_PAY_CLASSES}>
          {view.nature === null ? null : (
            <p className="text-md text-text-primary">{view.nature}</p>
          )}
          <p data-feed-notice="" className="text-sm text-text-secondary">
            {view.notice}
          </p>
        </div>
        <div className={FEED_FACTS_CLASSES}>
          {view.countries === null ? null : (
            <p>{t("feed.card.countries", { countries: view.countries })}</p>
          )}
          {period === null ? null : (
            <p>
              {period.kind === "range"
                ? t("feed.card.period.range", {
                    from: period.from,
                    to: period.to,
                  })
                : period.kind === "from"
                  ? t("feed.card.period.from", { from: period.from })
                  : t("feed.card.period.until", { to: period.to })}
            </p>
          )}
          {view.deadline === null ? null : (
            <p>{t("feed.card.deadline", { date: view.deadline })}</p>
          )}
          <p>{t("feed.card.publishedOn", { date: view.publishedOn })}</p>
        </div>
        {view.closed ? null : (
          <Link
            href={record}
            className={memberButtonClasses("primary", "md") + " self-start"}
          >
            {t("feed.card.open")}
            <span className="sr-only"> {title}</span>
          </Link>
        )}
      </Card>
    </li>
  );
}

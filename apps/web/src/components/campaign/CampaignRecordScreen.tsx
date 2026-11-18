"use client";

// The record of an open campaign for a creator, C6 (docs/mvp/09 RG32, RG40, RG80 to RG82, RG102; 11 RG16, RG22 to
// RG24; 17 §5.6; D46, D48, D78; jalons/l3d, commit 05): everything a card carries, plus the brief, the product, the
// usage rights, the languages and the brand WITHOUT contact (the role of its contact person, never a name, an
// e-mail or a phone), then the notices of RG40 and RG32 when they apply. The drawing is CampaignReadBody, the one
// the brand reads as "Ce que voit un créateur" (RG102); the rows are campaign-preview-view.ts, the words the
// translation files, the state use-open-campaign-record.ts. A campaign that is no longer open (unknown, paused,
// closed, greyed, a brand suspended: the same refusal, T14) is said in words, « Cette campagne n'est plus ouverte »
// (RG24), never as a technical error. No button of application (Lot 4), no link, address or form to contact the
// brand (RG81), no figure (CLAUDE.md §2, D48, D78). The reading is journaled by the API alone (RG22).
import { useLocale, useTranslations } from "next-intl";
import { useMemo, type ReactNode } from "react";
import {
  BACK_ICON_CLASSES,
  BACK_LINK_CLASSES,
} from "@/components/account/account-classes";
import { TEXT_LINK_CLASSES } from "@/components/auth/auth-classes";
import { useOnline } from "@/components/auth/use-online";
import { useMember } from "@/components/member/member-context";
import { Card } from "@/components/member/ui/Card";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { PageBackContext, PageHeader } from "@/components/member/ui/PageHeader";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { CAMPAIGNS_PAGE, memberPageHref } from "@/lib/member-paths";
import { CAMPAIGN_PAGE_CLASSES } from "./campaign-classes";
import { previewLabelsOf } from "./campaign-preview-labels";
import {
  previewBrandOf,
  previewNoticesOf,
  previewSectionsOf,
} from "./campaign-preview-view";
import { CampaignReadBody } from "./CampaignReadBody";
import type { FeedFailure } from "./open-campaigns-view";
import { useOpenCampaignRecord } from "./use-open-campaign-record";

export function CampaignRecordScreen({ id }: { id: string }) {
  const t = useTranslations("campaign");
  const tBrand = useTranslations("brandProfile");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const online = useOnline();
  const { signedOut } = useMember();
  const state = useOpenCampaignRecord(id, {
    onSignedOut: () => signedOut(null),
  });
  const labels = useMemo(
    () => previewLabelsOf(t, tBrand, locale),
    [t, tBrand, locale],
  );
  const { record } = state;
  const sections = useMemo(
    () =>
      record === null
        ? []
        : previewSectionsOf(
            {
              campaign: record.campaign,
              brand: record.brand,
              remunerationNotice: record.remunerationNotice,
            },
            labels,
          ),
    [record, labels],
  );
  const brand = useMemo(
    () =>
      record === null
        ? null
        : previewBrandOf(
            {
              campaign: record.campaign,
              brand: record.brand,
              remunerationNotice: record.remunerationNotice,
            },
            labels,
          ),
    [record, labels],
  );
  const notices = useMemo(
    () => (record === null ? [] : previewNoticesOf(record.campaign)),
    [record],
  );

  const failureText = (
    failure: FeedFailure | null,
    retryAfterSeconds: number | null,
  ): string => {
    if (failure === "forbidden") {
      return t("record.forbidden");
    }
    if (failure === "rate_limited") {
      return retryAfterSeconds === null
        ? t("record.rateLimited")
        : t("record.rateLimitedWait", { seconds: retryAfterSeconds });
    }
    return t("record.unavailable");
  };

  const back = (
    <Link
      href={memberPageHref(CAMPAIGNS_PAGE, locale)}
      className={BACK_LINK_CLASSES}
    >
      <span className="sr-only">{t("form.backPrefix")} </span>
      <ChevronLeftIcon aria-hidden="true" className={BACK_ICON_CLASSES} />
      {t("record.back")}
    </Link>
  );

  let title: string;
  let body: ReactNode;
  if (state.phase === "gone") {
    title = t("record.gone.title");
    body = (
      <Card>
        <p className="text-md text-text-secondary">{t("record.gone.text")}</p>
        <Link
          href={memberPageHref(CAMPAIGNS_PAGE, locale)}
          className={TEXT_LINK_CLASSES}
        >
          {t("record.back")}
        </Link>
      </Card>
    );
  } else if (record === null) {
    title = t("feed.title");
    body =
      state.phase === "failed" ? (
        <div className="flex flex-col gap-4">
          <ErrorNotice>
            {failureText(state.failure, state.retryAfterSeconds)}
          </ErrorNotice>
          {state.failure === "forbidden" ? null : (
            <MemberButton variant="secondary" onClick={state.reload}>
              {t("record.retry")}
            </MemberButton>
          )}
        </div>
      ) : (
        <p role="status" className="text-sm text-text-secondary">
          {t("record.loading")}
        </p>
      );
  } else {
    title = record.campaign.title ?? t("list.untitled");
    body = (
      <CampaignReadBody
        heading={t("record.campaign")}
        sections={sections}
        brand={brand}
        logo={state.logo}
        notices={notices}
      />
    );
  }

  return (
    <PageBackContext value={back}>
      <div className={CAMPAIGN_PAGE_CLASSES} data-campaign-record="">
        {online ? null : <Notice tone="warning">{tAccount("offline")}</Notice>}
        <PageHeader title={title} />
        {body}
      </div>
    </PageBackContext>
  );
}

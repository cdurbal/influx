"use client";

// "Ce que voit un créateur" (docs/mvp/17 §4.3; 09 RG102, CA15, CA68; D48, D78; jalons/l3b, commit 11): the
// brand reads its campaign exactly as the platform serves it to a creator, the nature of the consideration
// and « À négocier avec votre commercial » where a creator would find them, and no total budget, band or
// internal reference anywhere (the brand sees for itself that they are not published). The screen draws
// the answer of `GET /v1/me/campaigns/:id/creator-view` and nothing else: no reconstitution and no field of
// the draft (RG102); the rows are campaign-preview-view.ts, the words campaign-preview-labels.ts, the state
// use-campaign-preview.ts. A banner says it is a preview. Nothing in it is a button, a link or an address to
// contact the brand (CA15): the only way out is the way back, above the title, outside the preview. The
// page of a brand: a creator, another brand's campaign and an identifier that is nobody's all reach a page
// that does not exist, as the API answers (T14). No amount, rate, net or price (CLAUDE.md §2, D48, D78).
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, type ReactNode } from "react";
import {
  BACK_ICON_CLASSES,
  BACK_LINK_CLASSES,
} from "@/components/account/account-classes";
import { useOnline } from "@/components/auth/use-online";
import { useMember } from "@/components/member/member-context";
import { Card } from "@/components/member/ui/Card";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { PageBackContext, PageHeader } from "@/components/member/ui/PageHeader";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import {
  CAMPAIGN_PAGE_CLASSES,
  PREVIEW_LABEL_CLASSES,
  PREVIEW_LOGO_CLASSES,
  PREVIEW_ROW_LIST_CLASSES,
  PREVIEW_VALUE_CLASSES,
} from "./campaign-classes";
import { previewLabelsOf } from "./campaign-preview-labels";
import {
  previewBrandOf,
  previewSectionsOf,
  type PreviewOrigin,
  type PreviewRow,
} from "./campaign-preview-view";
import { useCampaignPreview } from "./use-campaign-preview";

/** The page of a brand; any other role finds a page that does not exist (18 T14.3, T14.4). */
export function CampaignPreviewScreen({
  id,
  origin,
}: {
  id: string;
  origin: PreviewOrigin;
}) {
  const { me } = useMember();
  if (me.role !== "advertiser") {
    notFound();
  }
  return <CampaignPreviewView id={id} origin={origin} />;
}

function CampaignPreviewView({
  id,
  origin,
}: {
  id: string;
  origin: PreviewOrigin;
}) {
  const t = useTranslations("campaign");
  const tBrand = useTranslations("brandProfile");
  const tAccount = useTranslations("account");
  const locale = useLocale();
  const online = useOnline();
  const { signedOut } = useMember();
  const state = useCampaignPreview(id, { onSignedOut: () => signedOut(null) });
  const labels = useMemo(
    () => previewLabelsOf(t, tBrand, locale),
    [t, tBrand, locale],
  );
  const { preview } = state;
  const sections = useMemo(
    () => (preview === null ? [] : previewSectionsOf(preview, labels)),
    [preview, labels],
  );
  const brand = useMemo(
    () => (preview === null ? null : previewBrandOf(preview, labels)),
    [preview, labels],
  );
  if (state.phase === "gone") {
    notFound();
  }

  // The way back leads where the preview was opened from (L3BU-1): the list, a step, or the campaign. The
  // name of the link is its label alone, but for « Mes campagnes », which has no verb of its own (L3BU-15).
  const back =
    origin.to === "list" ? (
      <Link
        href={memberPageHref("advertiserCampaigns", locale)}
        className={BACK_LINK_CLASSES}
      >
        <span className="sr-only">{t("form.backPrefix")} </span>
        <ChevronLeftIcon aria-hidden="true" className={BACK_ICON_CLASSES} />
        {t("form.back")}
      </Link>
    ) : (
      <Link
        href={`${memberPageHref("advertiserCampaign", locale, id)}${
          origin.step === null ? "" : `?step=${origin.step}`
        }`}
        className={BACK_LINK_CLASSES}
      >
        <ChevronLeftIcon aria-hidden="true" className={BACK_ICON_CLASSES} />
        {t("preview.back")}
      </Link>
    );

  let body: ReactNode;
  if (preview === null) {
    body =
      state.phase === "unavailable" ? (
        <div className="flex flex-col gap-4">
          <ErrorNotice>{t("preview.unavailable")}</ErrorNotice>
          <MemberButton variant="secondary" onClick={state.reload}>
            {t("preview.retry")}
          </MemberButton>
        </div>
      ) : (
        <p role="status" className="text-sm text-text-secondary">
          {t("preview.loading")}
        </p>
      );
  } else {
    const title = preview.campaign.title;
    body = (
      <div data-creator-preview="" className="flex flex-col gap-4">
        <Card>
          <h2 className={CARD_TITLE}>{title ?? t("list.untitled")}</h2>
          {sections.length === 0 ? (
            <p className="text-md text-text-secondary">{t("preview.empty")}</p>
          ) : (
            sections.map((section) => (
              <section
                key={section.id}
                data-preview-section={section.id}
                aria-labelledby={`preview-section-${section.id}`}
                className="flex flex-col gap-3"
              >
                <h3
                  id={`preview-section-${section.id}`}
                  className="font-display text-md font-bold leading-snug text-text-primary"
                >
                  {section.title}
                </h3>
                <Rows rows={section.rows} />
              </section>
            ))
          )}
        </Card>
        <Card>
          <h2 className={CARD_TITLE} data-preview-brand="">
            {t("preview.brandTitle")}
          </h2>
          {brand === null ? (
            <Notice tone="info" announce={false}>
              {t("preview.brandUnpublished")}
            </Notice>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                {state.logo === null ? null : (
                  // eslint-disable-next-line @next/next/no-img-element -- a data: source built by the API
                  <img
                    src={`data:${state.logo.contentType};base64,${state.logo.data}`}
                    alt={t("preview.logoAlt")}
                    width={state.logo.width}
                    height={state.logo.height}
                    className={PREVIEW_LOGO_CLASSES}
                  />
                )}
                <p className="font-display text-md font-bold text-text-primary">
                  {brand.name}
                </p>
              </div>
              {brand.badge === null ? null : (
                <p className="text-sm text-text-secondary">{brand.badge}</p>
              )}
              <Rows rows={brand.rows} />
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <PageBackContext value={back}>
      <div className={CAMPAIGN_PAGE_CLASSES}>
        {online ? null : <Notice tone="warning">{tAccount("offline")}</Notice>}
        <PageHeader title={t("preview.title")} />
        <Notice tone="info" announce={false}>
          <span data-preview-banner="">{t("preview.banner")}</span>
        </Notice>
        {body}
      </div>
    </PageBackContext>
  );
}

/** The rows of a section or of the brand: a name, then what the answer says, as text, a paragraph or a list. */
function Rows({ rows }: { rows: readonly PreviewRow[] }) {
  return (
    <dl className={PREVIEW_ROW_LIST_CLASSES}>
      {rows.map((row) => (
        <div key={row.key} data-field={row.key}>
          <dt className={PREVIEW_LABEL_CLASSES}>{row.label}</dt>
          <dd className={PREVIEW_VALUE_CLASSES}>
            {row.kind === "list" ? (
              <ul className="list-disc pl-5">
                {row.items.map((item, index) => (
                  <li key={`${index}-${item}`}>{item}</li>
                ))}
              </ul>
            ) : row.kind === "paragraph" ? (
              <span className="whitespace-pre-line">{row.text}</span>
            ) : (
              row.text
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

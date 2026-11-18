"use client";

// The one drawing of a campaign as a creator reads it (docs/mvp/09 RG32, RG40, RG81, RG102; 17 §5.6; D46, D48, D78;
// jalons/l3d, commit 05): the notices that apply, the sections, then the brand. Shared by the brand's preview
// ("Ce que voit un créateur") and the creator's record (C6), so that the brand sees exactly what the creator reads
// (RG102). The rows come from campaign-preview-view.ts, the words from the translation files; nothing is decided
// here. Nothing in it is a button, a link or an address to contact the brand (RG81), and no amount, band, rate or
// net is drawn (CLAUDE.md §2, D48, D78).
import type { BrandLogo } from "@influx/contracts/brand-profile";
import { useTranslations } from "next-intl";
import { Card } from "@/components/member/ui/Card";
import { Notice } from "@/components/member/ui/Notice";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import {
  PREVIEW_LABEL_CLASSES,
  PREVIEW_LOGO_CLASSES,
  PREVIEW_ROW_LIST_CLASSES,
  PREVIEW_VALUE_CLASSES,
} from "./campaign-classes";
import type {
  PreviewBrand,
  PreviewNoticeId,
  PreviewRow,
  PreviewSection,
} from "./campaign-preview-view";

export function CampaignReadBody({
  heading,
  sections,
  brand,
  logo,
  notices,
}: {
  /** The title of the first card: the campaign's own on the preview, whose page title is another. */
  heading: string;
  sections: readonly PreviewSection[];
  /** Null while the brand profile is not published: only the brand's own preview can show it so. */
  brand: PreviewBrand | null;
  logo: BrandLogo | null;
  notices: readonly PreviewNoticeId[];
}) {
  const t = useTranslations("campaign");
  return (
    <div data-creator-preview="" className="flex flex-col gap-4">
      {notices.map((notice) => (
        <Notice
          key={notice}
          tone={notice === "usageRights" ? "warning" : "info"}
          announce={false}
        >
          <span data-campaign-notice={notice}>
            {notice === "usageRights"
              ? t("usageRights.warning")
              : t("disclosure.notice")}
          </span>
        </Notice>
      ))}
      <Card>
        <h2 className={CARD_TITLE}>{heading}</h2>
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
              {logo === null ? null : (
                // eslint-disable-next-line @next/next/no-img-element -- a data: source built by the API
                <img
                  src={`data:${logo.contentType};base64,${logo.data}`}
                  alt={t("preview.logoAlt")}
                  width={logo.width}
                  height={logo.height}
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

import Link from "next/link";
import { type CampaignFeedCard as CampaignFeedCardType } from "@influx/contracts";
import { type CreatorCampaignLabels } from "./creator-campaign-labels";

interface CampaignFeedCardProps {
  campaign: CampaignFeedCardType;
  labels: CreatorCampaignLabels;
  locale: string;
}

export function CampaignFeedCard({
  campaign,
  labels,
  locale,
}: CampaignFeedCardProps) {
  const { card: t } = labels;

  const isClosed = campaign.isClosed;
  const detailUrl = `/${locale}/creator/campaigns/${campaign.id}`;

  return (
    <article
      className={`relative flex flex-col justify-between rounded-xl border bg-surface-card p-5 shadow-sm transition-all duration-150 ${
        isClosed
          ? "border-border-subtle bg-surface-muted/40 opacity-75 grayscale-[20%]"
          : "border-border-default hover:border-border-strong hover:shadow-md"
      }`}
    >
      {/* Bandeau de fermeture ou statut d'application */}
      {isClosed && (
        <div className="mb-3 inline-flex items-center gap-2 self-start rounded-md bg-surface-muted px-2.5 py-1 text-xs font-medium text-text-tertiary">
          <span>🔒</span>
          <span>
            {t.campaignClosed}
            {campaign.closedSinceDays != null && campaign.closedSinceDays > 0
              ? ` (${t.closedSince(campaign.closedSinceDays)})`
              : ""}
          </span>
        </div>
      )}

      {campaign.hasApplied && (
        <div className="mb-3 inline-flex items-center gap-2 self-start rounded-md bg-feedback-success-bg px-2.5 py-1 text-xs font-semibold text-feedback-success-text">
          <span>✓</span>
          <span>
            {campaign.appliedAt
              ? t.alreadyApplied(
                  new Date(campaign.appliedAt).toLocaleDateString(locale),
                )
              : t.alreadyApplied("")}
          </span>
        </div>
      )}

      <div>
        {/* 1. En-tête Marque & Badges (RG15, RG17) */}
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-raised font-bold text-text-secondary text-xs">
              {campaign.brandLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={campaign.brandLogoUrl}
                  alt={campaign.brandName}
                  className="h-full w-full rounded-lg object-cover"
                />
              ) : (
                campaign.brandName.slice(0, 2).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-text-primary text-sm truncate">
                  {campaign.brandName}
                </span>
                {campaign.brandVerified && (
                  <span
                    className="inline-flex items-center rounded bg-feedback-success-bg px-1.5 py-0.5 text-xs font-medium text-feedback-success-text"
                    title={
                      campaign.brandVerifiedAt
                        ? t.brandVerifiedDate(
                            new Date(
                              campaign.brandVerifiedAt,
                            ).toLocaleDateString(locale),
                          )
                        : t.brandVerified
                    }
                  >
                    ✓ {t.brandVerified}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-tertiary truncate">
                {campaign.brandSector} · {campaign.brandCompanySize}
              </p>
            </div>
          </div>

          {/* Badge audience vérifiée requise (RG83, RG85) */}
          {campaign.verifiedOnly && (
            <span className="shrink-0 rounded-full border border-feedback-warning-border bg-feedback-warning-bg px-2.5 py-0.5 text-xs font-medium text-feedback-warning-text">
              ★ {t.verifiedOnlyBadge}
            </span>
          )}
        </div>

        {/* 2. Titre & Thématiques (RG15) */}
        <div className="mt-3">
          <Link
            href={detailUrl}
            className="group block font-semibold text-md text-text-primary transition-colors hover:text-text-brand line-clamp-2"
          >
            {campaign.title}
          </Link>

          <div className="mt-2 flex flex-wrap gap-2">
            {campaign.targetTopics.map((topic) => (
              <span
                key={topic}
                className="rounded-md bg-surface-raised border border-border-subtle px-2 py-0.5 text-xs text-text-secondary"
              >
                #{topic}
              </span>
            ))}
          </div>
        </div>

        {/* 3. Livrables attendus (RG15) */}
        <div className="mt-3 rounded-lg bg-surface-raised/60 border border-border-subtle p-3 text-xs">
          <span className="font-medium text-text-tertiary block">
            {t.deliverablesTitle}
          </span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {campaign.deliverables.map((del, idx) => (
              <span
                key={`${del.network}-${del.format}-${idx}`}
                className="inline-flex items-center gap-1 rounded bg-surface-card border border-border-subtle px-2 py-1 font-medium text-text-secondary"
              >
                <span className="capitalize">{del.network}</span>:{" "}
                <span className="text-text-primary font-semibold">
                  {del.quantity}x {del.format}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* 4. Rémunération indicative & Net estimé (RG15, RG18, RG19, RG57, RG58) */}
        <div className="mt-3 space-y-1.5 border-t border-border-subtle pt-3">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-text-tertiary">{t.compensationTitle}</span>
            <span className="font-semibold text-sm text-text-primary">
              {campaign.compensationNature === "dotation_seule" ? (
                <span className="text-text-secondary font-medium">
                  {t.nonMonetaryOnly}
                </span>
              ) : campaign.minCompensationMinor != null &&
                campaign.maxCompensationMinor != null ? (
                `${(campaign.minCompensationMinor / 100).toLocaleString(locale)} – ${(campaign.maxCompensationMinor / 100).toLocaleString(locale)} ${campaign.currency}`
              ) : (
                "—"
              )}
            </span>
          </div>

          {/* Net estimé sans multiplication dans le front (Invariant A1 & T16) */}
          {campaign.estimatedNet && (
            <div className="flex items-center justify-between text-xs text-feedback-success-text">
              <span>{t.estimatedNetLabel}</span>
              <span className="font-semibold">
                {campaign.estimatedNet.formattedLabel}
              </span>
            </div>
          )}
        </div>

        {/* 5. Calendrier (RG15) */}
        <div className="mt-2.5 flex items-center justify-between text-xs text-text-tertiary">
          <span>
            {t.deadlineLabel}{" "}
            <strong className="text-text-secondary">
              {new Date(campaign.applicationDeadline).toLocaleDateString(
                locale,
              )}
            </strong>
          </span>
          <span>
            {t.periodLabel}{" "}
            {new Date(campaign.startsOn).toLocaleDateString(locale, {
              month: "short",
            })}{" "}
            –{" "}
            {new Date(campaign.endsOn).toLocaleDateString(locale, {
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* 6. Boutons d'Action & État d'éligibilité (RG46) */}
      <div className="mt-4 border-t border-border-subtle pt-3">
        {campaign.ineligibilityReasons.length > 0 && !campaign.hasApplied && (
          <p className="mb-2 text-xs text-feedback-warning-text">
            ⚠ {campaign.ineligibilityReasons[0]}
          </p>
        )}

        <div className="flex items-center justify-end gap-3">
          <Link
            href={detailUrl}
            className="flex-1 rounded-lg border border-border-default px-3 py-2 text-center text-xs font-semibold text-text-primary transition-colors hover:bg-surface-raised"
          >
            {t.viewBriefButton}
          </Link>
          {campaign.canApply && (
            <Link
              href={detailUrl}
              className="flex-1 rounded-lg bg-action-primary-bg px-3 py-2 text-center text-xs font-semibold text-text-on-action transition-colors hover:bg-action-primary-bg-hover shadow-sm"
            >
              {t.applyButton}
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

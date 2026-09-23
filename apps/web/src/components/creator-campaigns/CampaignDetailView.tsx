"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  type CampaignPublicCreatorView,
  type Introduction,
} from "@influx/contracts";
import { ApplicationModal } from "./ApplicationModal";
import {
  getCreatorCampaignLabels,
  type CreatorCampaignLabels,
} from "./creator-campaign-labels";

interface CampaignDetailViewProps {
  campaignId: string;
  locale: string;
}

export function CampaignDetailView({
  campaignId,
  locale,
}: CampaignDetailViewProps) {
  const labels: CreatorCampaignLabels = getCreatorCampaignLabels(locale);
  const { detail: t, card: tc } = labels;

  const [campaign, setCampaign] = useState<CampaignPublicCreatorView | null>(
    null,
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = useState<boolean>(false);
  const [appliedIntro, setAppliedIntro] = useState<Introduction | null>(null);

  useEffect(() => {
    async function loadCampaign() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/campaigns/public/${campaignId}`, {
          credentials: "include",
        });
        if (!res.ok) {
          throw new Error(
            res.status === 404 ? t.notFoundMessage : `Erreur (${res.status})`,
          );
        }
        const data = await res.json();
        setCampaign(data.campaign);

        // Vérifier si le créateur a déjà postulé à cette campagne
        try {
          const introRes = await fetch("/api/introductions/my", {
            credentials: "include",
          });
          if (introRes.ok) {
            const intros: Introduction[] = await introRes.json();
            const existing = intros.find(
              (i) =>
                i.campaignId === campaignId &&
                i.origin === "creator_application" &&
                i.status !== "withdrawn",
            );
            if (existing) {
              setAppliedIntro(existing);
            }
          }
        } catch {
          // Silencieux si non authentifié ou erreur réseau
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    }
    loadCampaign();
  }, [campaignId, t.notFoundMessage]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface-card p-12 text-center text-text-tertiary">
        <span className="text-heading-2 block mb-2">⏳</span>
        <p className="text-sm font-medium">{labels.feed.loadingText}</p>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface-card p-12 text-center max-w-lg mx-auto">
        <span className="text-heading-2 block mb-3">⚠️</span>
        <h3 className="font-semibold text-text-primary text-md">
          {t.notFoundTitle}
        </h3>
        <p className="text-xs text-text-tertiary mt-2">
          {error || t.notFoundMessage}
        </p>
        <Link
          href={`/${locale}/creator/campaigns`}
          className="mt-6 inline-block rounded-lg bg-action-primary-bg px-4 py-2 text-xs font-semibold text-text-on-action hover:bg-action-primary-bg-hover"
        >
          {t.backToFeed}
        </Link>
      </div>
    );
  }

  const { brandProfile } = campaign;

  return (
    <div className="space-y-8">
      {/* 1. Lien retour */}
      <div>
        <Link
          href={`/${locale}/creator/campaigns`}
          className="inline-flex items-center gap-2 text-xs font-medium text-text-tertiary transition-colors hover:text-text-brand"
        >
          ← {t.backToFeed}
        </Link>
      </div>

      {/* 2. En-tête principal de la campagne */}
      <div className="rounded-xl border border-border-default bg-surface-card p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-raised font-bold text-text-secondary text-sm">
              {brandProfile.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brandProfile.logoUrl}
                  alt={brandProfile.companyName}
                  className="h-full w-full rounded-xl object-cover"
                />
              ) : (
                brandProfile.companyName.slice(0, 2).toUpperCase()
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-text-primary text-md">
                  {brandProfile.companyName}
                </span>
                {brandProfile.badgeStatus === "verified" && (
                  <span className="rounded bg-feedback-success-bg px-2 py-0.5 text-xs font-medium text-feedback-success-text">
                    ✓ {tc.brandVerified}
                  </span>
                )}
              </div>
              <p className="text-xs text-text-tertiary mt-0.5">
                {brandProfile.sector} · {brandProfile.companySize}
              </p>
              <h1 className="mt-2 font-bold text-heading-3 md:text-heading-2 text-text-primary">
                {campaign.title}
              </h1>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {campaign.targetTopics.map((topic) => (
                  <span
                    key={topic}
                    className="rounded-md bg-surface-raised border border-border-subtle px-2.5 py-0.5 text-xs font-medium text-text-secondary"
                  >
                    #{topic}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Rémunération mise en avant */}
          <div className="shrink-0 rounded-xl border border-border-subtle bg-surface-raised p-4 md:text-right space-y-1">
            <span className="text-xs uppercase tracking-wider text-text-tertiary block font-medium">
              {tc.compensationTitle}
            </span>
            <span className="font-bold text-heading-3 text-text-primary block">
              {campaign.compensationNature === "dotation_seule"
                ? tc.nonMonetaryOnly
                : campaign.minCompensationMinor != null &&
                    campaign.maxCompensationMinor != null
                  ? `${(campaign.minCompensationMinor / 100).toLocaleString(locale)} – ${(campaign.maxCompensationMinor / 100).toLocaleString(locale)} ${campaign.currency}`
                  : "—"}
            </span>
            {campaign.estimatedNet && (
              <span className="text-xs font-semibold text-feedback-success-text block">
                {t.compensationTitle}: {campaign.estimatedNet.formattedLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Corps du brief : 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Colonne gauche (2/3) : Brief, Livrables, Produit */}
        <div className="lg:col-span-2 space-y-6">
          {/* Résumé public */}
          <section className="rounded-xl border border-border-default bg-surface-card p-6 space-y-3">
            <h3 className="font-semibold text-text-primary text-md">
              {t.summaryTitle}
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              {campaign.publicSummary}
            </p>
          </section>

          {/* Brief détaillé */}
          <section className="rounded-xl border border-border-default bg-surface-card p-6 space-y-3">
            <h3 className="font-semibold text-text-primary text-md">
              {t.briefTitle}
            </h3>
            <div className="text-sm text-text-secondary whitespace-pre-line leading-relaxed">
              {campaign.detailedBrief}
            </div>
          </section>

          {/* Livrables demandés */}
          <section className="rounded-xl border border-border-default bg-surface-card p-6 space-y-4">
            <h3 className="font-semibold text-text-primary text-md">
              {t.deliverablesTitle}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {campaign.deliverables.map((del, idx) => (
                <div
                  key={`${del.network}-${del.format}-${idx}`}
                  className="rounded-lg border border-border-subtle bg-surface-raised p-3 flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <span className="font-semibold text-xs text-text-primary capitalize block">
                      {del.network}
                    </span>
                    <span className="text-xs text-text-secondary block">
                      {del.format}
                    </span>
                  </div>
                  <span className="rounded bg-brand-subtle-bg border border-brand-subtle-border text-text-brand px-2 py-1 text-xs font-bold">
                    x{del.quantity}
                  </span>
                </div>
              ))}
            </div>

            {/* Droits & Exclusivité */}
            <div className="border-t border-border-subtle pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-text-tertiary block font-medium">
                  {t.usageRightsTitle}
                </span>
                <span className="font-semibold text-text-secondary block mt-0.5 capitalize">
                  {campaign.usageRights.replace("_", " ")}
                  {campaign.usageDuration
                    ? ` (${campaign.usageDuration.replace("_", " ")})`
                    : ""}
                </span>
              </div>
              <div>
                <span className="text-text-tertiary block font-medium">
                  {t.exclusivityTitle}
                </span>
                <span className="font-semibold text-text-secondary block mt-0.5 capitalize">
                  {campaign.exclusivity}
                </span>
              </div>
              <div>
                <span className="text-text-tertiary block font-medium">
                  {t.validationDelayTitle}
                </span>
                <span className="font-semibold text-text-secondary block mt-0.5">
                  {campaign.contentValidationDelay}
                </span>
              </div>
            </div>
          </section>

          {/* Produit concerné */}
          <section className="rounded-xl border border-border-default bg-surface-card p-6 space-y-3">
            <h3 className="font-semibold text-text-primary text-md">
              {t.productTitle}
            </h3>
            <div className="space-y-2 text-xs">
              <p className="font-semibold text-sm text-text-primary">
                {campaign.productName}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div>
                  <span className="text-text-tertiary block">
                    {t.productShipped}
                  </span>
                  <span className="font-medium text-text-secondary block mt-0.5">
                    {campaign.productShipped ? "Oui" : "Non"}
                  </span>
                </div>
                <div>
                  <span className="text-text-tertiary block">
                    {t.productKept}
                  </span>
                  <span className="font-medium text-text-secondary block mt-0.5">
                    {campaign.productKept ? "Oui" : "Non"}
                  </span>
                </div>
                <div>
                  <span className="text-text-tertiary block">
                    {t.productShippingCost}
                  </span>
                  <span className="font-medium text-text-secondary block mt-0.5 capitalize">
                    {campaign.productShippingCost || "—"}
                  </span>
                </div>
              </div>

              {campaign.keyMessages.length > 0 && (
                <div className="pt-3 border-t border-border-subtle">
                  <span className="font-medium text-text-tertiary block mb-1">
                    {t.keyMessagesTitle}
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-text-secondary">
                    {campaign.keyMessages.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              {campaign.prohibitions && (
                <div className="pt-2 border-t border-border-subtle">
                  <span className="font-medium text-text-tertiary block mb-1">
                    {t.prohibitionsTitle}
                  </span>
                  <p className="text-text-secondary">{campaign.prohibitions}</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Colonne droite (1/3) : Calendrier, Marque sans contact, CTA & Notices */}
        <div className="space-y-6">
          {/* Calendrier de la campagne */}
          <section className="rounded-xl border border-border-default bg-surface-card p-5 space-y-3">
            <h3 className="font-semibold text-text-primary text-sm">
              {t.datesTitle}
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between border-b border-border-subtle pb-2">
                <span className="text-text-tertiary">
                  {t.applicationDeadline}
                </span>
                <span className="font-semibold text-text-primary">
                  {new Date(campaign.applicationDeadline).toLocaleDateString(
                    locale,
                  )}
                </span>
              </div>
              {campaign.deliveryDeadline && (
                <div className="flex justify-between border-b border-border-subtle pb-2">
                  <span className="text-text-tertiary">
                    {t.deliveryDeadline}
                  </span>
                  <span className="font-semibold text-text-primary">
                    {new Date(campaign.deliveryDeadline).toLocaleDateString(
                      locale,
                    )}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-tertiary">
                  {t.publicationPeriod}
                </span>
                <span className="font-semibold text-text-primary">
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
          </section>

          {/* Fiche Marque publique (RG16, RG37, D40) - ZÉRO coordonnées directes */}
          <section className="rounded-xl border border-border-default bg-surface-card p-5 space-y-3">
            <h3 className="font-semibold text-text-primary text-sm">
              {t.brandInfoTitle}
            </h3>
            <div className="space-y-2 text-xs">
              <p className="text-text-secondary leading-relaxed">
                {brandProfile.presentation}
              </p>
              <div className="pt-2 border-t border-border-subtle space-y-2">
                <div className="flex justify-between">
                  <span className="text-text-tertiary">{t.sector}</span>
                  <span className="font-medium text-text-secondary">
                    {brandProfile.sector}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-tertiary">{t.companySize}</span>
                  <span className="font-medium text-text-secondary">
                    {brandProfile.companySize}
                  </span>
                </div>
                {brandProfile.website && (
                  <div className="flex justify-between">
                    <span className="text-text-tertiary">{t.website}</span>
                    <a
                      href={
                        brandProfile.website.startsWith("http")
                          ? brandProfile.website
                          : `https://${brandProfile.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-text-brand hover:underline"
                    >
                      {brandProfile.website} ↗
                    </a>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Bloc d'action / Candidature (C6, C7) */}
          <section className="rounded-xl border border-brand-subtle-border bg-brand-subtle-bg p-5 space-y-3 text-center">
            {appliedIntro ? (
              <div className="space-y-3 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-feedback-success-bg border border-feedback-success-border text-feedback-success-text text-lg font-bold">
                  ✓
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-text-primary text-sm">
                    {labels.applicationModal.alreadyAppliedTitle}
                  </h4>
                  <p className="text-xs text-text-secondary leading-normal">
                    {labels.applicationModal.alreadyAppliedText(
                      new Date(appliedIntro.createdAt).toLocaleDateString(
                        locale,
                      ),
                      appliedIntro.reference,
                    )}
                  </p>
                </div>
                <div className="rounded-lg bg-surface-card border border-border-subtle p-2.5 text-[11px] text-text-tertiary">
                  ⏱ {labels.applicationModal.slaNotice}
                </div>
                <button
                  type="button"
                  disabled
                  className="w-full mt-1 rounded-lg bg-surface-raised border border-border-default px-4 py-2.5 text-xs font-semibold text-text-tertiary cursor-not-allowed"
                >
                  {labels.applicationModal.alreadyAppliedButton}
                </button>
              </div>
            ) : campaign.isApplicationsClosed ? (
              <div className="text-text-tertiary text-xs">
                <span className="text-heading-3 block mb-1">🔒</span>
                <p className="font-semibold">{t.closedBanner}</p>
              </div>
            ) : (
              <>
                <h4 className="font-bold text-text-primary text-sm">
                  {t.applyCtaTitle}
                </h4>
                <p className="text-xs text-text-tertiary leading-normal">
                  {t.applyCtaSub}
                </p>
                <button
                  type="button"
                  onClick={() => setIsApplyModalOpen(true)}
                  className="w-full mt-2 rounded-lg bg-action-primary-bg px-4 py-2.5 text-xs font-semibold text-text-on-action hover:bg-action-primary-bg-hover shadow-sm cursor-pointer transition-all"
                >
                  {t.applyButton}
                </button>
              </>
            )}
          </section>

          {/* Notices & Avertissements légaux (RG32, RG80) */}
          {campaign.notices && campaign.notices.length > 0 && (
            <section className="rounded-xl border border-border-subtle bg-surface-raised p-4 space-y-2 text-xs text-text-tertiary">
              <h4 className="font-semibold text-text-secondary uppercase tracking-wider text-xs">
                {t.noticesTitle}
              </h4>
              <ul className="space-y-2">
                {campaign.notices.map((n) => (
                  <li key={n.key} className="flex items-start gap-2">
                    <span className="text-feedback-warning-text">ℹ</span>
                    <span>{n.message}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      {/* Modale de candidature (Mission 3.8) */}
      {campaign && (
        <ApplicationModal
          campaign={campaign}
          locale={locale}
          isOpen={isApplyModalOpen}
          onClose={() => setIsApplyModalOpen(false)}
          onSuccess={(intro) => {
            setAppliedIntro(intro);
          }}
        />
      )}
    </div>
  );
}

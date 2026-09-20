"use client";

import React, { useEffect } from "react";
import {
  type AnonymizedCreatorCard,
  type IdentifiedCreatorCard,
} from "@influx/contracts";
import { getSearchLabels } from "./search-labels";

export interface CreatorDetailModalProps {
  creator: AnonymizedCreatorCard | IdentifiedCreatorCard;
  searchQueryId?: string;
  locale?: string;
  onClose: () => void;
  onShortlist: (creator: AnonymizedCreatorCard | IdentifiedCreatorCard) => void;
  onIntroduce: (creator: AnonymizedCreatorCard | IdentifiedCreatorCard) => void;
}

export function CreatorDetailModal({
  creator,
  searchQueryId,
  locale = "fr",
  onClose,
  onShortlist,
  onIntroduce,
}: CreatorDetailModalProps) {
  const t = getSearchLabels(locale);

  // RG63, RG66 : Journalisation de l'ouverture de profil
  useEffect(() => {
    if (!searchQueryId) return;
    fetch(`/api/search/creators/${creator.creatorAccountId}/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ searchQueryId }),
      credentials: "include",
    }).catch(() => {
      // Échec silencieux non bloquant
    });
  }, [creator.creatorAccountId, searchQueryId]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-creator-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay-scrim backdrop-blur-xs overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-surface-card border border-border-default rounded-xl shadow-2xl overflow-hidden my-auto">
        {/* En-tête de la modale */}
        <div className="flex items-start justify-between p-6 border-b border-border-subtle bg-surface-muted">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-semibold text-text-brand bg-brand-subtle-bg px-2 py-0.5 rounded-sm border border-brand-subtle-border">
                {creator.alias}
              </span>
              <span className="text-xs text-text-tertiary">
                {creator.contextLabel}
              </span>
            </div>
            <h2
              id="modal-creator-title"
              className="text-lg font-bold text-text-primary"
            >
              {creator.shortTitle || t.detailModal.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary p-2 rounded-lg hover:bg-surface-raised transition-colors"
            aria-label={t.detailModal.close}
          >
            ✕
          </button>
        </div>

        {/* Corps déroulant */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Bloc 1 : Réseaux & Badges */}
          <div className="bg-surface-raised p-4 rounded-lg border border-border-subtle space-y-3">
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              {t.detailModal.networksAudience}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {creator.networks.map((net, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-surface-card rounded-md border border-border-subtle flex flex-col gap-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-text-primary capitalize">
                      {net.network} {net.isPrimary && "★"}
                    </span>
                    <span className="text-xs bg-surface-muted px-2 py-0.5 rounded text-text-secondary border border-border-subtle">
                      {t.facets.audienceBandOptions[net.audienceBand] ||
                        net.audienceBand}
                    </span>
                  </div>
                  {net.engagementRateBand && (
                    <div className="text-xs text-text-tertiary flex items-center gap-1">
                      <span>Engagement vérifié :</span>
                      <span className="text-feedback-info-text font-mono font-medium">
                        {t.facets.engagementBandOptions[
                          net.engagementRateBand
                        ] || net.engagementRateBand}
                      </span>
                    </div>
                  )}
                  {net.hasVerifiedAudienceBadge && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-feedback-success-text mt-1">
                      ✓ {t.card.verifiedAudience} (90j)
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bloc 2 : Portfolio approuvé (1 à 3 visuels modérés - RG47, RG50) */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              {t.detailModal.portfolioTitle}
            </h3>
            {creator.portfolio && creator.portfolio.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {creator.portfolio.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative bg-surface-muted border border-border-subtle rounded-lg overflow-hidden flex flex-col"
                  >
                    <div className="h-40 bg-surface-raised flex items-center justify-center text-text-tertiary overflow-hidden">
                      {/* En mock local, image placeholder stylisée sans fuite identifiante */}
                      <div className="text-center p-3">
                        <span className="block text-2xl mb-1">🖼️</span>
                        <span className="text-xs text-text-secondary font-medium">
                          {img.caption || `Contenu approuvé ${idx + 1}`}
                        </span>
                      </div>
                    </div>
                    {img.caption && (
                      <div className="p-2 text-[11px] text-text-tertiary bg-surface-card border-t border-border-subtle">
                        {img.caption}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-surface-raised rounded-md border border-border-subtle text-text-tertiary text-xs">
                {t.detailModal.noPortfolio}
              </div>
            )}
          </div>

          {/* Bloc 3 : Grille tarifaire par format (en coût total annonceur - RG47) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                {t.detailModal.pricingOffers}
              </h3>
              <span className="text-[11px] text-text-tertiary">
                {t.card.costExplanation}
              </span>
            </div>
            <div className="border border-border-subtle rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-muted text-text-tertiary border-b border-border-subtle">
                  <tr>
                    <th className="p-2.5">Réseau / {t.detailModal.format}</th>
                    <th className="p-2.5">{t.detailModal.costBand}</th>
                    <th className="p-2.5">{t.detailModal.deliveryTime}</th>
                    <th className="p-2.5">{t.detailModal.usageRights}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {creator.offers && creator.offers.length > 0 ? (
                    creator.offers.map((offer, idx) => (
                      <tr key={idx} className="hover:bg-surface-raised">
                        <td className="p-2.5 font-medium text-text-primary capitalize">
                          {offer.network} ·{" "}
                          {t.facets.formatOptions[offer.format] || offer.format}
                        </td>
                        <td className="p-2.5 font-mono text-text-brand font-semibold">
                          {t.facets.priceBandOptions[offer.priceBand] ||
                            offer.priceBand}
                        </td>
                        <td className="p-2.5 text-text-secondary">
                          {offer.deliveryLeadBand || "Sous 7 à 14 jours"}
                        </td>
                        <td className="p-2.5 text-text-tertiary">
                          {offer.includedUsageRights?.join(", ") ||
                            "Usage organique standard"}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-3 text-center text-text-tertiary"
                      >
                        Grille tarifaire disponible sur demande
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bloc 4 : Démographie d'audience & Disponibilité */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-surface-raised rounded-lg border border-border-subtle space-y-2">
              <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                {t.detailModal.audienceDemographics}
              </h4>
              <div className="text-xs text-text-secondary space-y-1">
                <p>
                  <span className="text-text-tertiary">
                    {t.detailModal.mainCountry} :
                  </span>{" "}
                  <strong className="text-text-primary">
                    {t.facets.countries[creator.audience.primaryCountry] ||
                      creator.audience.primaryCountry}
                  </strong>{" "}
                  (
                  {creator.audience.primaryCountryShareBand === "gte_80"
                    ? "> 80 %"
                    : creator.audience.primaryCountryShareBand === "50_80"
                      ? "50 – 80 %"
                      : "< 50 %"}
                  )
                </p>
                {creator.languages && (
                  <p>
                    <span className="text-text-tertiary">Langues :</span>{" "}
                    {creator.languages.map((l) => l.toUpperCase()).join(", ")}
                  </p>
                )}
              </div>
            </div>

            <div className="p-3 bg-surface-raised rounded-lg border border-border-subtle space-y-2">
              <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                {t.detailModal.declaredAvailability}
              </h4>
              <div className="text-xs text-text-secondary space-y-1">
                <p className="text-feedback-success-text font-medium">
                  {creator.availability === "lt_2w"
                    ? "Sous 2 semaines"
                    : creator.availability === "lt_1m"
                      ? "Sous 1 mois"
                      : "Complet"}
                </p>
                <p className="text-[11px] text-text-tertiary">
                  {t.card.availabilityDeclared}{" "}
                  {new Date(
                    creator.availabilityDeclaredAt,
                  ).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pied d'action */}
        <div className="p-4 border-t border-border-subtle bg-surface-muted flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-raised text-xs transition-colors"
          >
            {t.detailModal.close}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onShortlist(creator)}
              className="px-4 py-2 rounded-lg border border-border-strong text-text-primary hover:bg-surface-raised text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <span>☆</span>
              <span>{t.card.shortlistButton}</span>
            </button>
            <button
              type="button"
              onClick={() => onIntroduce(creator)}
              className="px-4 py-2 rounded-lg bg-action-primary-bg hover:bg-action-primary-bg-hover text-text-on-action text-xs font-semibold transition-colors"
            >
              {t.card.introduceButton}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

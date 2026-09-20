"use client";

import React from "react";
import {
  type AnonymizedCreatorCard as AnonymizedCreatorCardType,
  type IdentifiedCreatorCard,
} from "@influx/contracts";
import { getSearchLabels } from "./search-labels";

export interface AnonymizedCreatorCardProps {
  creator: AnonymizedCreatorCardType | IdentifiedCreatorCard;
  locale?: string;
  onViewDetail: (
    creator: AnonymizedCreatorCardType | IdentifiedCreatorCard,
  ) => void;
  onShortlist: (
    creator: AnonymizedCreatorCardType | IdentifiedCreatorCard,
  ) => void;
  onIntroduce: (
    creator: AnonymizedCreatorCardType | IdentifiedCreatorCard,
  ) => void;
}

export function AnonymizedCreatorCard({
  creator,
  locale = "fr",
  onViewDetail,
  onShortlist,
  onIntroduce,
}: AnonymizedCreatorCardProps) {
  const t = getSearchLabels(locale);

  const primaryNetwork =
    creator.networks.find((n) => n.isPrimary) || creator.networks[0];

  const primaryOffer = creator.offers?.[0];

  // Calcul du badge vérifié
  const hasAudienceBadge = creator.networks.some(
    (n) => n.hasVerifiedAudienceBadge,
  );
  const hasAccountBadge = creator.networks.some(
    (n) => n.hasVerifiedAccountBadge,
  );

  return (
    <div className="flex flex-col bg-surface-card border border-border-default hover:border-border-strong rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-150">
      {/* 1. En-tête : Alias & Contexte (RG47, RG49) */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-text-brand bg-brand-subtle-bg px-2.5 py-1 rounded border border-brand-subtle-border tracking-wider">
            {creator.alias}
          </span>
          <span className="text-xs font-medium text-text-tertiary">
            {creator.contextLabel}
          </span>
        </div>

        {/* Badges de vérification certifiée (RG47) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {hasAudienceBadge && (
            <span
              title="Audience vérifiée par l'équipe commerciale INFLUX (< 90j)"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-feedback-success-bg text-feedback-success-text border border-feedback-success-border"
            >
              ✓ {t.card.verifiedAudience}
            </span>
          )}
          {hasAccountBadge && !hasAudienceBadge && (
            <span
              title="Propriété du compte certifiée"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-surface-raised text-text-secondary border border-border-subtle"
            >
              ✓ {t.card.verifiedIdentity}
            </span>
          )}
        </div>
      </div>

      {/* 2. Titre court modéré (RG47) */}
      <h3 className="text-sm font-semibold text-text-primary mb-3 line-clamp-2">
        {creator.shortTitle || "Créateur de contenu certifié"}
      </h3>

      {/* 3. Données clés : Réseau & Audience (RG47) */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="p-2.5 bg-surface-muted rounded-lg border border-border-subtle">
          <span className="text-text-tertiary block text-[11px] mb-0.5">
            Réseau principal
          </span>
          <span className="font-medium text-text-primary capitalize">
            {primaryNetwork ? primaryNetwork.network : "Multi-réseaux"}
          </span>
          {primaryNetwork && (
            <span className="text-text-secondary block text-[11px] mt-0.5">
              {t.facets.audienceBandOptions[primaryNetwork.audienceBand] ||
                primaryNetwork.audienceBand}
            </span>
          )}
        </div>

        <div className="p-2.5 bg-surface-muted rounded-lg border border-border-subtle">
          <span className="text-text-tertiary block text-[11px] mb-0.5">
            {t.card.primaryAudience}
          </span>
          <span className="font-medium text-text-primary">
            {t.facets.countries[creator.audience.primaryCountry] ||
              creator.audience.primaryCountry}
          </span>
          <span className="text-text-secondary block text-[11px] mt-0.5">
            {creator.audience.primaryCountryShareBand === "gte_80"
              ? "> 80 % de l'audience"
              : creator.audience.primaryCountryShareBand === "50_80"
                ? "50 % – 80 % d'audience"
                : "< 50 % d'audience"}
          </span>
        </div>
      </div>

      {/* 4. Tarifs indicatifs & Disponibilité (RG47) */}
      <div className="flex items-center justify-between p-2.5 bg-surface-raised rounded-lg border border-border-subtle mb-3 text-xs">
        <div>
          <span className="text-text-tertiary block text-[10px] uppercase tracking-wider">
            {t.card.indicativeCost}
          </span>
          <span className="font-mono font-bold text-text-brand text-sm">
            {primaryOffer
              ? t.facets.priceBandOptions[primaryOffer.priceBand] ||
                primaryOffer.priceBand
              : "Sur devis"}
          </span>
        </div>

        <div className="text-right">
          <span className="text-text-tertiary block text-[10px] uppercase tracking-wider">
            {t.card.availability}
          </span>
          <span className="text-text-secondary text-[11px] font-medium">
            {creator.availability === "lt_2w"
              ? "< 2 semaines"
              : creator.availability === "lt_1m"
                ? "< 1 mois"
                : "Complet"}
          </span>
        </div>
      </div>

      {/* 5. Portfolio approuvé (aperçu du 1er visuel - RG47, RG50) */}
      {creator.portfolio && creator.portfolio.length > 0 && (
        <div className="mb-3">
          <div className="h-28 bg-surface-muted border border-border-subtle rounded-lg flex items-center justify-center text-text-tertiary overflow-hidden relative">
            <div className="text-center p-2">
              <span className="text-xl block mb-1">📸</span>
              <span className="text-xs text-text-secondary font-medium">
                {creator.portfolio[0]?.caption || t.card.portfolioPreview}
              </span>
            </div>
            {creator.portfolio.length > 1 && (
              <span className="absolute bottom-2 right-2 bg-surface-card border border-border-subtle px-1.5 py-0.5 rounded text-[10px] text-text-tertiary">
                +{creator.portfolio.length - 1} visuels
              </span>
            )}
          </div>
        </div>
      )}

      {/* 6. Explication factuelle "Proposé car :" (RG41) */}
      {creator.reasons && creator.reasons.length > 0 && (
        <div className="p-2.5 bg-surface-muted rounded-lg border border-border-subtle mb-3 text-xs">
          <span className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider block mb-1">
            {t.card.proposedBecause} :
          </span>
          <ul className="space-y-0.5">
            {creator.reasons.slice(0, 3).map((r, idx) => (
              <li
                key={idx}
                className="text-text-secondary text-[11px] flex items-center gap-1.5"
              >
                <span className="text-text-brand">✦</span>
                <span>{t.explanations[r.code] || r.labelKey}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 7. Point de vigilance le cas échéant (RG42) */}
      {creator.vigilanceWarning && (
        <div className="p-2 mb-3 bg-feedback-warning-bg border border-feedback-warning-border rounded text-[11px] text-feedback-warning-text flex items-center gap-1.5">
          <span>⚠️</span>
          <span>
            {t.vigilanceWarnings[creator.vigilanceWarning] ||
              creator.vigilanceWarning}
          </span>
        </div>
      )}

      {/* 8. Indicateur de relation existante (RG32, RG53) */}
      {creator.relationStatus === "already_introduced" && (
        <div className="p-2 mb-3 bg-feedback-info-bg border border-feedback-info-border rounded text-[11px] text-feedback-info-text text-center font-medium">
          💬 {t.card.alreadyIntroduced}
        </div>
      )}
      {creator.relationStatus === "request_pending" && (
        <div className="p-2 mb-3 bg-surface-raised border border-border-default rounded text-[11px] text-text-secondary text-center font-medium">
          ⏳ {t.card.requestPending}
        </div>
      )}

      {/* 9. Boutons d'action (RG51, RG52, RG53) */}
      <div className="mt-auto pt-3 border-t border-border-subtle flex items-center gap-2">
        <button
          type="button"
          onClick={() => onViewDetail(creator)}
          className="flex-1 py-1.5 px-3 rounded-lg border border-border-default hover:bg-surface-raised text-text-secondary hover:text-text-primary text-xs font-medium transition-colors text-center"
        >
          {t.card.detailsButton}
        </button>

        <button
          type="button"
          onClick={() => onShortlist(creator)}
          title={t.card.shortlistButton}
          className="p-1.5 px-2.5 rounded-lg border border-border-strong text-text-primary hover:bg-surface-raised text-xs font-medium transition-colors"
        >
          ☆
        </button>

        <button
          type="button"
          disabled={creator.relationStatus === "request_pending"}
          onClick={() => onIntroduce(creator)}
          className="flex-1 py-1.5 px-3 rounded-lg bg-action-primary-bg hover:bg-action-primary-bg-hover text-text-on-action text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-center"
        >
          {creator.relationStatus === "request_pending"
            ? t.card.introductionRequested
            : creator.relationStatus === "already_introduced"
              ? t.card.relationActive
              : t.card.introduceButton}
        </button>
      </div>
    </div>
  );
}

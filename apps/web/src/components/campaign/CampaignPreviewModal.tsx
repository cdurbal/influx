"use client";

import React, { useEffect } from "react";
import { type Campaign, isSensitiveSector } from "@influx/contracts";
import { getCampaignLabels } from "./campaign-labels";

export interface CampaignPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Partial<Campaign>;
  brandName?: string;
  locale?: string;
}

export function CampaignPreviewModal({
  isOpen,
  onClose,
  campaign,
  brandName = "Votre Marque",
  locale = "fr",
}: CampaignPreviewModalProps) {
  const t = getCampaignLabels(locale);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const minFormatted = campaign.minCompensationMinor
    ? (campaign.minCompensationMinor / 100).toLocaleString("fr-FR")
    : null;
  const maxFormatted = campaign.maxCompensationMinor
    ? (campaign.maxCompensationMinor / 100).toLocaleString("fr-FR")
    : null;
  const currency = campaign.currency || "EUR";

  const isSensitive = campaign.productCategory
    ? isSensitiveSector(campaign.productCategory)
    : false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
    >
      <div className="bg-surface-card w-full max-w-3xl rounded-2xl border border-border-default shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-border-default bg-surface-page/60 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-brand-subtle-bg text-brand-primary border border-brand-subtle-border">
                {t.previewModal.title}
              </span>
              {isSensitive && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-feedback-warning-bg text-feedback-warning-text border border-feedback-warning-border">
                  Secteur sensible
                </span>
              )}
            </div>
            <h2
              id="preview-modal-title"
              className="text-lg font-extrabold text-text-primary tracking-tight"
            >
              {campaign.title || "Titre de la campagne"}
            </h2>
            <p className="text-xs text-text-tertiary mt-0.5">
              {t.previewModal.disclaimer}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-surface-hover transition-colors text-base"
            aria-label={t.previewModal.close}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-text-secondary">
          {/* Card Marque */}
          <div className="p-4 rounded-xl bg-surface-page border border-border-default flex items-center justify-between">
            <div>
              <span className="text-xs text-text-tertiary block">
                Proposé par
              </span>
              <span className="font-bold text-sm text-text-primary">
                {brandName}
              </span>
              <span className="text-[11px] text-text-tertiary block mt-0.5">
                Catégorie : {campaign.productCategory || "Non spécifiée"}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-text-tertiary block">
                Candidatures
              </span>
              <span className="font-semibold text-text-primary">
                {campaign.applicationDeadline
                  ? `Jusqu'au ${campaign.applicationDeadline}`
                  : "Ouvertes"}
              </span>
            </div>
          </div>

          {/* Rémunération */}
          <div className="p-4 rounded-xl bg-surface-page border border-border-default space-y-2">
            <span className="font-bold text-text-primary block">
              {t.previewModal.perCreatorBudget}
            </span>
            <div className="text-base font-extrabold text-text-primary">
              {minFormatted && maxFormatted
                ? `${minFormatted} – ${maxFormatted} ${currency}`
                : "Dotation seule"}
            </div>
            <p className="text-[11px] text-text-tertiary italic">
              « Fourchette indicative pour cette campagne. Elle ne vaut pas
              engagement : le montant se négocie dans la conversation. » (RG67)
            </p>
          </div>

          {/* Livrables demandés */}
          <div className="space-y-2">
            <span className="font-bold text-text-primary block">
              {t.previewModal.deliverables}
            </span>
            <div className="flex flex-wrap gap-2">
              {campaign.deliverables && campaign.deliverables.length > 0 ? (
                campaign.deliverables.map((d) => (
                  <span
                    key={`${d.network}-${d.format}`}
                    className="px-3 py-1 rounded-lg bg-surface-page border border-border-default font-medium text-text-primary"
                  >
                    {d.quantity}× {d.format} ({d.network})
                  </span>
                ))
              ) : (
                <span className="text-text-tertiary">
                  Aucun livrable renseigné
                </span>
              )}
            </div>
          </div>

          {/* Droits & Exclusivité */}
          <div className="p-3.5 rounded-xl bg-surface-page border border-border-default grid grid-cols-2 gap-4 text-[11px]">
            <div>
              <span className="text-text-tertiary block">
                Droits d&apos;usage
              </span>
              <span className="font-medium text-text-primary">
                {campaign.usageRights || "Aucun"} (
                {campaign.usageDuration || "non spécifié"})
              </span>
            </div>
            <div>
              <span className="text-text-tertiary block">
                Exclusivité sectorielle
              </span>
              <span className="font-medium text-text-primary">
                {campaign.exclusivity || "Non"}
              </span>
            </div>
          </div>

          {/* Brief */}
          <div className="space-y-2">
            <span className="font-bold text-text-primary block">
              {t.previewModal.brief}
            </span>
            {campaign.publicSummary && (
              <p className="p-3 rounded-lg bg-surface-page border border-border-default italic">
                {campaign.publicSummary}
              </p>
            )}
            {campaign.detailedBrief && (
              <pre className="p-4 rounded-lg bg-surface-muted border border-border-default font-mono text-[11px] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto text-text-primary">
                {campaign.detailedBrief}
              </pre>
            )}
          </div>

          {/* Mention légale de divulgation (RG32) */}
          <div className="p-3 rounded-lg bg-feedback-info-bg border border-feedback-info-border text-feedback-info-text text-[11px] leading-relaxed">
            ℹ {t.previewModal.legalNotice}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-default bg-surface-page/60 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-surface-card border border-border-default text-text-primary font-semibold text-xs hover:bg-surface-hover transition-colors"
          >
            {t.previewModal.close}
          </button>
        </div>
      </div>
    </div>
  );
}

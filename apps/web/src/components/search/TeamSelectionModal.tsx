"use client";

import React, { useState } from "react";
import { type CreatorSearchFilters } from "@influx/contracts";
import { getSearchLabels } from "./search-labels";

export interface TeamSelectionModalProps {
  filters: CreatorSearchFilters;
  campaignId?: string;
  locale?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TeamSelectionModal({
  filters,
  campaignId,
  locale = "fr",
  onClose,
  onSuccess,
}: TeamSelectionModalProps) {
  const t = getSearchLabels(locale);

  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/search/team-selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: campaignId || undefined,
          filters,
          notes: notes.trim(),
          locale,
        }),
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.message || "Erreur lors de l'envoi de la demande.",
        );
      }

      setSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-team-selection-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay-scrim backdrop-blur-xs"
    >
      <div className="relative w-full max-w-lg bg-surface-card border border-border-default rounded-xl shadow-2xl p-6 text-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2
              id="modal-team-selection-title"
              className="text-base font-bold text-text-primary"
            >
              {t.teamSelectionModal.title}
            </h2>
            <p className="text-xs text-text-secondary mt-1">
              {t.teamSelectionModal.subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary p-1 rounded hover:bg-surface-raised"
          >
            ✕
          </button>
        </div>

        {success ? (
          <div className="py-6 text-center space-y-2">
            <span className="text-3xl">✓</span>
            <p className="text-sm font-semibold text-feedback-success-text">
              {t.teamSelectionModal.submittedSuccess}
            </p>
            <p className="text-xs text-text-secondary">
              {t.teamSelectionModal.slaNotice}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-xs bg-feedback-error-bg text-feedback-error-text border border-feedback-error-border rounded-lg">
                {error}
              </div>
            )}

            {/* Récapitulatif des filtres */}
            <div className="p-3 bg-surface-raised rounded-lg border border-border-subtle space-y-1.5 text-xs">
              <span className="font-semibold text-text-tertiary uppercase tracking-wider block text-[10px]">
                {t.teamSelectionModal.activeFiltersSummary}
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {filters.primaryTopic && (
                  <span className="bg-surface-muted px-2 py-0.5 rounded border border-border-subtle text-text-secondary">
                    Thématique :{" "}
                    {t.facets.topics[filters.primaryTopic] ||
                      filters.primaryTopic}
                  </span>
                )}
                {filters.audienceBand && (
                  <span className="bg-surface-muted px-2 py-0.5 rounded border border-border-subtle text-text-secondary">
                    Audience :{" "}
                    {t.facets.audienceBandOptions[filters.audienceBand] ||
                      filters.audienceBand}
                  </span>
                )}
                {filters.priceBand && (
                  <span className="bg-surface-muted px-2 py-0.5 rounded border border-border-subtle text-text-secondary">
                    Budget :{" "}
                    {t.facets.priceBandOptions[filters.priceBand] ||
                      filters.priceBand}
                  </span>
                )}
                {filters.networks && filters.networks.length > 0 && (
                  <span className="bg-surface-muted px-2 py-0.5 rounded border border-border-subtle text-text-secondary">
                    Réseaux : {filters.networks.join(", ")}
                  </span>
                )}
                {!filters.primaryTopic &&
                  !filters.audienceBand &&
                  !filters.priceBand && (
                    <span className="text-text-tertiary italic">
                      Recherche générale (sans filtre restrictif)
                    </span>
                  )}
              </div>
            </div>

            {/* Brief libre */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-text-secondary">
                {t.teamSelectionModal.briefNotes}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.teamSelectionModal.briefPlaceholder}
                rows={4}
                className="w-full bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-text-primary text-xs focus:border-border-selected focus:outline-hidden resize-none"
              />
            </div>

            {/* Engagement SLA */}
            <div className="p-2.5 bg-feedback-info-bg text-feedback-info-text border border-feedback-info-border rounded-lg text-xs flex items-center gap-2">
              <span className="text-base">ℹ</span>
              <span>{t.teamSelectionModal.slaNotice}</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg border border-border-default text-text-secondary hover:bg-surface-raised text-xs"
              >
                {t.teamSelectionModal.cancel}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 rounded-lg bg-action-primary-bg hover:bg-action-primary-bg-hover text-text-on-action text-xs font-semibold disabled:opacity-50"
              >
                {submitting ? "Transmission..." : t.teamSelectionModal.submit}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

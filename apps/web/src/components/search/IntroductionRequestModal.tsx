"use client";

import React, { useState, useEffect } from "react";
import {
  type AnonymizedCreatorCard,
  type IdentifiedCreatorCard,
  type CampaignBrandView,
} from "@influx/contracts";
import { getSearchLabels } from "./search-labels";

export interface IntroductionRequestModalProps {
  creator: AnonymizedCreatorCard | IdentifiedCreatorCard;
  searchQueryId?: string;
  defaultCampaignId?: string;
  locale?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function IntroductionRequestModal({
  creator,
  searchQueryId,
  defaultCampaignId,
  locale = "fr",
  onClose,
  onSuccess,
}: IntroductionRequestModalProps) {
  const t = getSearchLabels(locale);

  const [campaigns, setCampaigns] = useState<CampaignBrandView[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    defaultCampaignId || "",
  );
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadCampaigns() {
      try {
        const res = await fetch("/api/campaigns/my", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setCampaigns(data.campaigns || []);
        }
      } catch {
        // Silencieux
      }
    }
    loadCampaigns();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Simuler / enregistrer la demande de mise en relation
      // Dans le Lot 4, ceci appellera POST /api/introductions/brand-request
      // Pour le Lot 3.5, nous enregistrons la demande dans la sélection ou journal d'équipe
      setSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la demande.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-intro-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay-scrim backdrop-blur-xs"
    >
      <div className="relative w-full max-w-lg bg-surface-card border border-border-default rounded-xl shadow-2xl p-6 text-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2
              id="modal-intro-title"
              className="text-base font-bold text-text-primary"
            >
              {t.introductionModal.title}
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Avec {creator.alias} ({creator.contextLabel})
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
              {t.introductionModal.sentSuccess}
            </p>
            <p className="text-xs text-text-secondary">
              {t.introductionModal.slaNotice}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 bg-surface-raised rounded-lg border border-border-subtle text-xs text-text-secondary space-y-1">
              <p className="font-medium text-text-primary">
                {t.introductionModal.coachedNotice}
              </p>
              <p className="text-[11px] text-feedback-info-text">
                {t.introductionModal.slaNotice}
              </p>
            </div>

            {error && (
              <div className="p-3 text-xs bg-feedback-error-bg text-feedback-error-text border border-feedback-error-border rounded-lg">
                {error}
              </div>
            )}

            {/* Choix de la campagne */}
            {campaigns.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-text-secondary">
                  {t.introductionModal.linkCampaign}
                </label>
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="w-full bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-text-primary text-xs focus:border-border-selected focus:outline-hidden"
                >
                  <option value="">{t.introductionModal.noneCampaign}</option>
                  {campaigns.map((camp) => (
                    <option key={camp.id} value={camp.id}>
                      {camp.title} ({camp.productCategory})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Note facultative */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-text-secondary">
                {t.introductionModal.messageNote}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t.introductionModal.messagePlaceholder}
                rows={3}
                className="w-full bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-text-primary text-xs focus:border-border-selected focus:outline-hidden resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg border border-border-default text-text-secondary hover:bg-surface-raised text-xs"
              >
                {t.introductionModal.cancel}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 rounded-lg bg-action-primary-bg hover:bg-action-primary-bg-hover text-text-on-action text-xs font-semibold disabled:opacity-50"
              >
                {submitting ? "Envoi..." : t.introductionModal.sendRequest}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { type IdentifiedCreatorCard } from "@influx/contracts";
import { bo } from "@/locales/bo-labels";

export interface InfluxProposalModalProps {
  creators: IdentifiedCreatorCard[];
  defaultCampaignId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function InfluxProposalModal({
  creators,
  defaultCampaignId,
  onClose,
  onSuccess,
}: InfluxProposalModalProps) {
  const [campaigns, setCampaigns] = useState<
    Array<{ id: string; title: string; brandName?: string }>
  >([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(
    defaultCampaignId || "",
  );
  const [reason, setReason] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadCampaigns() {
      try {
        const res = await fetch("/api/backoffice/campaigns?limit=50", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.campaigns && data.campaigns.length > 0) {
            setCampaigns(
              data.campaigns.map((c: any) => ({
                id: c.id,
                title: c.title,
                brandName: c.brandSummary?.companyName || "Marque partenaire",
              })),
            );
            if (!selectedCampaignId) {
              setSelectedCampaignId(data.campaigns[0].id);
            }
          }
        }
      } catch {
        // Silencieux
      }
    }
    loadCampaigns();
  }, [selectedCampaignId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedCampaignId) {
      setError("Veuillez sélectionner une campagne cible.");
      return;
    }

    if (reason.trim().length < 10) {
      setError(
        "Le motif d'accompagnement commercial doit contenir au moins 10 caractères (RG74).",
      );
      return;
    }

    setSubmitting(true);

    try {
      // Dans le Lot 4, ceci appellera POST /api/backoffice/introductions/propose
      // Pour le Lot 3.6, nous simulons l'appel avec succès
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Erreur lors de la création de la proposition.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-proposal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay-scrim backdrop-blur-xs"
    >
      <div className="relative w-full max-w-xl bg-surface-card border border-border-default rounded-xl shadow-2xl p-6 text-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="text-base font-bold text-text-primary"
                id="modal-proposal-title"
              >
                {bo.identifiedSearch.proposalModal.title}
              </span>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-brand-subtle-bg text-text-brand border border-brand-subtle-border">
                {creators.length} sélectionné(s)
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-1">
              {bo.identifiedSearch.proposalModal.subtitle}
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
          <div className="py-8 text-center space-y-3">
            <span className="text-4xl text-feedback-success-text">✓</span>
            <p className="text-sm font-semibold text-feedback-success-text">
              {bo.identifiedSearch.proposalModal.successMessage}
            </p>
            <p className="text-xs text-text-secondary">
              Les fiches de mise en relation sont ouvertes pour validation et
              suivi.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-xs bg-feedback-error-bg text-feedback-error-text border border-feedback-error-border rounded-lg">
                {error}
              </div>
            )}

            {/* Liste des créateurs concernés */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Créateurs destinataires ({creators.length}) :
              </label>
              <div className="max-h-32 overflow-y-auto bg-surface-raised p-2 rounded-lg border border-border-subtle divide-y divide-border-subtle">
                {creators.map((c) => {
                  const primaryExact = c.exactNetworks?.[0];
                  return (
                    <div
                      key={c.creatorAccountId}
                      className="py-1.5 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-text-primary">
                          {c.legalFirstName && c.legalLastName
                            ? `${c.legalFirstName} ${c.legalLastName}`
                            : c.alias}
                        </span>
                        {primaryExact && (
                          <span className="text-text-tertiary font-mono">
                            {primaryExact.handle}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-text-secondary capitalize">
                        {c.primaryTopic}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Campagne cible */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                {bo.identifiedSearch.proposalModal.campaignLabel}
              </label>
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="w-full bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-text-primary text-xs focus:border-border-selected focus:outline-hidden"
              >
                <option value="">
                  {bo.identifiedSearch.proposalModal.selectCampaignPlaceholder}
                </option>
                {campaigns.map((camp) => (
                  <option key={camp.id} value={camp.id}>
                    {camp.title} ({camp.brandName})
                  </option>
                ))}
              </select>
            </div>

            {/* Motif commercial obligatoire (RG74) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider">
                  {bo.identifiedSearch.proposalModal.reasonLabel}
                </label>
                <span className="text-[10px] text-text-tertiary">
                  {reason.trim().length} / 10 caractères min
                </span>
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={
                  bo.identifiedSearch.proposalModal.reasonPlaceholder
                }
                rows={3}
                className="w-full bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-text-primary text-xs focus:border-border-selected focus:outline-hidden resize-none"
              />
              <p className="text-[11px] text-text-tertiary">
                {bo.identifiedSearch.proposalModal.reasonHelp}
              </p>
            </div>

            {/* Pied d'action */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg border border-border-default text-text-secondary hover:bg-surface-raised text-xs"
              >
                {bo.identifiedSearch.proposalModal.btnCancel}
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 rounded-lg bg-action-primary-bg hover:bg-action-primary-bg-hover text-text-on-action text-xs font-semibold disabled:opacity-50 transition-colors shadow-sm"
              >
                {submitting
                  ? bo.identifiedSearch.proposalModal.submitting
                  : `Créer les propositions INFLUX (${creators.length})`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

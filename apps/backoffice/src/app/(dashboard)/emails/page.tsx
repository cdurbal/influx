"use client";

import React, { useState, useEffect, useCallback } from "react";
import { type BrevoCampaign } from "@influx/contracts";
import { BrevoEmailComposer } from "@/components/emails/BrevoEmailComposer";
import { authFetch } from "@/lib/api-client";

export default function EmailsPage() {
  const [campaigns, setCampaigns] = useState<BrevoCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/backoffice/emails/campaigns");
      if (!res.ok) {
        throw new Error("Erreur de chargement des campagnes e-mails");
      }
      const data = await res.json();
      setCampaigns(data.campaigns || []);
    } catch (err: any) {
      setError(err.message || "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
    const interval = setInterval(fetchCampaigns, 30000); // Actualisation toutes les 30s
    return () => clearInterval(interval);
  }, [fetchCampaigns]);

  const handleCancelCampaign = async (campaignId: string) => {
    setCancellingId(campaignId);
    try {
      const res = await authFetch(
        `/api/backoffice/emails/${campaignId}/cancel`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Échec de l'annulation");
      }
      await fetchCampaigns();
    } catch (err: any) {
      alert(`Erreur : ${err.message}`);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* En-tête Linear */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[rgba(255,255,255,0.07)] gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.12)] text-[#4ade80] border border-[rgba(34,197,94,0.25)]">
              Communication Brevo
            </span>
            <span className="text-xs text-[#8a8f98]">· Fenêtre de grâce 15 min · Doc 16</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Campagnes &amp; E-mails Brevo
          </h1>
          <p className="text-xs text-[#8a8f98] mt-1 max-w-2xl">
            Envois encadrés depuis le backoffice avec filtrage RGPD des consentements et fenêtre d&apos;annulation immédiate de 15 minutes (Doc 16).
          </p>
        </div>

        <button
          onClick={() => setIsComposerOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-[#eaeaea] text-[#08090b] text-xs font-semibold rounded-lg transition-all shadow-[0_1px_3px_rgba(0,0,0,0.3),0_0_15px_rgba(255,255,255,0.15)] cursor-pointer"
        >
          <span>+</span>
          <span>Nouvel envoi d&apos;e-mails</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-[rgba(239,68,68,0.1)] text-[#fca5a5] border border-[rgba(239,68,68,0.25)] rounded-xl text-xs">
          {error}
        </div>
      )}

      {/* Liste des campagnes */}
      {loading ? (
        <div className="py-20 text-center text-text-secondary text-sm">
          Chargement de l'historique des envois...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="py-16 text-center bg-surface-panel rounded-lg border border-border-subtle">
          <p className="text-sm font-semibold text-text-primary">
            Aucun envoi Brevo programmé pour le moment
          </p>
          <p className="text-xs text-text-secondary mt-1">
            Utilisez le bouton ci-dessus pour lancer une relance ou une
            prospection encadrée.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((camp) => {
            const isScheduled = camp.status === "scheduled";
            const graceLimit = new Date(camp.cancelGraceUntil);
            const now = new Date();
            const remainingMinutes = Math.max(
              0,
              Math.ceil((graceLimit.getTime() - now.getTime()) / (60 * 1000)),
            );

            return (
              <div
                key={camp.id}
                className={`p-5 rounded-lg border transition-all ${
                  isScheduled
                    ? "bg-feedback-info-bg/30 border-feedback-info-border"
                    : camp.status === "cancelled"
                      ? "bg-surface-panel border-border-subtle opacity-75"
                      : "bg-surface-panel border-border-subtle"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-text-primary">
                        {camp.templateName}
                      </span>
                      <span
                        className={`text-3xs uppercase font-bold px-2 py-0.5 rounded-full ${
                          camp.status === "scheduled"
                            ? "bg-feedback-warning-bg text-feedback-warning-text border border-feedback-warning-border"
                            : camp.status === "sent"
                              ? "bg-feedback-success-bg text-feedback-success-text"
                              : camp.status === "cancelled"
                                ? "bg-feedback-error-bg text-feedback-error-text"
                                : "bg-surface-elevated text-text-secondary"
                        }`}
                      >
                        {camp.status === "scheduled" && "⏱ En attente d'envoi"}
                        {camp.status === "sent" && "✓ Envoyé"}
                        {camp.status === "cancelled" && "✕ Annulé"}
                        {camp.status === "sending" && "En cours..."}
                      </span>
                    </div>

                    <div className="text-xs text-text-secondary mt-1 flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        Source : <strong>{camp.audienceSource}</strong>
                      </span>
                      <span>
                        Destinataires estimés :{" "}
                        <strong>{camp.estimatedCount}</strong>
                      </span>
                      {camp.manualRecipient && (
                        <span>
                          Prospect :{" "}
                          <strong>{camp.manualRecipient.email}</strong>
                        </span>
                      )}
                      <span>
                        Programmé le :{" "}
                        {new Date(camp.scheduledAt).toLocaleString("fr-FR")}
                      </span>
                    </div>
                  </div>

                  {/* Actions ou stats */}
                  <div className="flex items-center gap-3">
                    {isScheduled && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-feedback-warning-text">
                          Fenêtre d'annulation : {remainingMinutes} min
                        </span>
                        <button
                          onClick={() => handleCancelCampaign(camp.id)}
                          disabled={cancellingId === camp.id}
                          className="px-3 py-1.5 bg-feedback-error-bg text-feedback-error-text hover:bg-feedback-error-border border border-feedback-error-border text-xs font-semibold rounded-md transition-colors"
                        >
                          {cancellingId === camp.id
                            ? "Annulation..."
                            : "⚠ Annuler cet envoi"}
                        </button>
                      </div>
                    )}

                    {camp.status === "sent" && (
                      <div className="flex items-center gap-4 text-xs font-mono bg-surface-elevated px-3 py-1.5 rounded-md border border-border-subtle">
                        <span>
                          Envoyés: <strong>{camp.stats.sent}</strong>
                        </span>
                        <span>
                          Ouverts:{" "}
                          <strong className="text-feedback-success-text">
                            {camp.stats.opened}
                          </strong>
                        </span>
                        <span>
                          Cliqués:{" "}
                          <strong className="text-brand-primary">
                            {camp.stats.clicked}
                          </strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assistant de création d'envoi */}
      <BrevoEmailComposer
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        onCampaignCreated={() => {
          fetchCampaigns();
        }}
      />
    </div>
  );
}

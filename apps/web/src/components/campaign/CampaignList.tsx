"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  type CampaignBrandView,
  type CampaignStatus,
  CAMPAIGN_REJECTION_MESSAGES,
} from "@influx/contracts";
import { getCampaignLabels } from "./campaign-labels";
import { CampaignPreviewModal } from "./CampaignPreviewModal";

export interface CampaignListProps {
  locale?: string;
}

export function CampaignList({ locale = "fr" }: CampaignListProps) {
  const t = getCampaignLabels(locale);

  const [campaigns, setCampaigns] = useState<CampaignBrandView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);

  // Modale aperçu créateur
  const [previewCampaign, setPreviewCampaign] =
    useState<CampaignBrandView | null>(null);

  // Modale de confirmation clôture définitive (RG9)
  const [closingCampaignId, setClosingCampaignId] = useState<string | null>(
    null,
  );
  const [actionLoading, setActionLoading] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setIsAuthError(false);
      const res = await fetch("/api/campaigns/my", {
        credentials: "include",
      });
      if (res.status === 401) {
        setIsAuthError(true);
        setError(
          locale === "en"
            ? "You must be signed in with an advertiser account to view your campaigns."
            : "Vous devez être connecté avec votre compte annonceur pour accéder à vos campagnes.",
        );
        return;
      }
      if (!res.ok) {
        throw new Error(
          `Erreur (${res.status}) lors du chargement des campagnes.`,
        );
      }
      const json = await res.json();
      setCampaigns(json.campaigns || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Erreur lors du chargement.",
      );
    } finally {
      setLoading(false);
    }
  }, [locale]);

  const handleDemoLogin = async () => {
    setActionLoading(true);
    try {
      await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "contact@maisonsolene.fr",
          role: "advertiser",
        }),
        credentials: "include",
      });
      await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "contact@maisonsolene.fr",
          code: "123456",
          termsVersion: "2026-09-v1",
          hasNonCircumventionAcknowledged: true,
        }),
        credentials: "include",
      });
      await fetchCampaigns();
    } catch {
      // Ignorer
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Actions cycle de vie
  const handlePause = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/pause`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        await fetchCampaigns();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/resume`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        await fetchCampaigns();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleClose = async () => {
    if (!closingCampaignId) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${closingCampaignId}/close`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setClosingCampaignId(null);
        await fetchCampaigns();
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${id}/duplicate`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        await fetchCampaigns();
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Plafond actif de 10 campagnes (RG15)
  const activeCount = campaigns.filter(
    (c) => c.status === "publiee" || c.status === "en_pause",
  ).length;

  const getStatusBadge = (status: CampaignStatus) => {
    switch (status) {
      case "publiee":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-subtle-bg text-brand-primary border border-brand-subtle-border">
            ✓ {t.list.statusPublished}
          </span>
        );
      case "a_valider":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-feedback-warning-bg text-feedback-warning-text border border-feedback-warning-border">
            ⏳ {t.list.statusPendingReview}
          </span>
        );
      case "en_pause":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-muted text-text-secondary border border-border-default">
            ⏸ {t.list.statusPaused}
          </span>
        );
      case "cloturee":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-muted text-text-tertiary border border-border-default">
            {t.list.statusClosed}
          </span>
        );
      case "refusee":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-feedback-error-bg text-feedback-error-text border border-feedback-error-border">
            ✕ {t.list.statusRejected}
          </span>
        );
      case "brouillon":
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-page text-text-secondary border border-border-default">
            ○ {t.list.statusDraft}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Barre d'action et plafond */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs text-text-tertiary">
            {campaigns.length} campagne(s) au total · {activeCount}/10 active(s)
          </span>
          {activeCount >= 10 && (
            <p className="text-xs text-feedback-warning-text font-medium mt-0.5">
              ⚠ {t.list.activeLimitReached}
            </p>
          )}
        </div>

        <Link
          href={`/${locale}/advertiser/campaigns/new`}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-brand-primary text-surface-page font-extrabold text-xs hover:bg-brand-hover transition-colors shadow-xs self-start sm:self-auto"
        >
          {t.list.createNewButton}
        </Link>
      </div>

      {/* Message d'erreur d'authentification ou serveur */}
      {isAuthError ? (
        <div className="p-6 rounded-2xl bg-surface-card border border-border-default space-y-4 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-xl">🔒</span>
            <div className="space-y-1">
              <h4 className="font-extrabold text-sm text-text-primary">
                {locale === "en"
                  ? "Authentication required"
                  : "Session requise"}
              </h4>
              <p className="text-xs text-text-secondary">{error}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link
              href={`/${locale}/login`}
              className="inline-flex items-center px-4 py-2 rounded-xl bg-brand-primary text-surface-page font-bold text-xs hover:bg-brand-hover transition-colors shadow-xs"
            >
              {locale === "en" ? "Sign in" : "Se connecter"}
            </Link>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={actionLoading}
              className="inline-flex items-center px-4 py-2 rounded-xl border border-dashed border-brand-primary/60 bg-brand-primary/10 text-brand-primary text-xs font-semibold hover:bg-brand-primary/20 transition-colors cursor-pointer"
            >
              {actionLoading
                ? locale === "en"
                  ? "Connecting..."
                  : "Connexion en cours..."
                : locale === "en"
                  ? "Quick Demo Login (Maison Solène)"
                  : "Connexion rapide Démo (Maison Solène)"}
            </button>
          </div>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-feedback-error-bg border border-feedback-error-border text-feedback-error-text text-xs">
          ✕ {error}
        </div>
      ) : null}

      {/* Liste des campagnes */}
      {loading ? (
        <div className="p-12 text-center rounded-2xl bg-surface-card border border-border-default text-text-tertiary text-xs">
          Chargement de vos campagnes...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-surface-card border border-border-default space-y-4">
          <div className="text-3xl">🎯</div>
          <div>
            <h3 className="font-extrabold text-base text-text-primary">
              {t.list.emptyTitle}
            </h3>
            <p className="text-xs text-text-tertiary mt-1 max-w-md mx-auto">
              {t.list.emptySubtitle}
            </p>
          </div>
          <Link
            href={`/${locale}/advertiser/campaigns/new`}
            className="inline-flex items-center px-5 py-2.5 rounded-xl bg-brand-primary text-surface-page font-bold text-xs hover:bg-brand-hover transition-colors shadow-xs"
          >
            {t.list.createNewButton}
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-border-default bg-surface-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-default bg-surface-page/60 text-text-tertiary font-semibold uppercase tracking-wider text-[11px]">
                  <th className="p-4 pl-6">{t.list.colTitle}</th>
                  <th className="p-4">{t.list.colStatus}</th>
                  <th className="p-4">{t.list.colDates}</th>
                  <th className="p-4">{t.list.colBudget}</th>
                  <th className="p-4">{t.list.colApplications}</th>
                  <th className="p-4 pr-6 text-right">{t.list.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {campaigns.map((camp) => {
                  const reasonInfo = camp.rejectionReason
                    ? CAMPAIGN_REJECTION_MESSAGES[camp.rejectionReason]
                    : null;

                  return (
                    <tr
                      key={camp.id}
                      className="hover:bg-surface-hover/50 transition-colors"
                    >
                      {/* Titre & Catégorie */}
                      <td className="p-4 pl-6 max-w-xs">
                        <div className="space-y-0.5">
                          <span className="font-bold text-text-primary block text-sm">
                            {camp.title}
                          </span>
                          <span className="text-[11px] text-text-tertiary block">
                            Type : {camp.campaignType} · {camp.productCategory}
                          </span>
                          {camp.internalReference && (
                            <span className="font-mono text-[10px] text-text-tertiary block">
                              Réf : {camp.internalReference}
                            </span>
                          )}

                          {/* Alerte motif de refus (RG10, RG90) */}
                          {camp.status === "refusee" && reasonInfo && (
                            <div className="mt-2 p-2.5 rounded-lg bg-feedback-error-bg border border-feedback-error-border text-[11px] text-feedback-error-text space-y-0.5">
                              <span className="font-bold block">
                                {t.list.rejectionReasonTitle}
                              </span>
                              <p>« {reasonInfo.messageFr} »</p>
                              {camp.rejectionComment && (
                                <p className="italic text-[10px] opacity-90">
                                  Commentaire : {camp.rejectionComment}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Statut */}
                      <td className="p-4">{getStatusBadge(camp.status)}</td>

                      {/* Dates */}
                      <td className="p-4 text-[11px]">
                        <div className="space-y-0.5">
                          <span className="text-text-primary block font-medium">
                            Candidatures : {camp.applicationDeadline || "—"}
                          </span>
                          <span className="text-text-tertiary block">
                            Période : {camp.startsOn || "—"} au{" "}
                            {camp.endsOn || "—"}
                          </span>
                        </div>
                      </td>

                      {/* Rémunération */}
                      <td className="p-4 font-semibold text-text-primary">
                        {camp.minCompensationMinor != null &&
                        camp.maxCompensationMinor != null
                          ? `${(camp.minCompensationMinor / 100).toLocaleString("fr-FR")} – ${(camp.maxCompensationMinor / 100).toLocaleString("fr-FR")} ${camp.currency}`
                          : "Dotation seule"}
                      </td>

                      {/* Candidatures reçues (RG82 : visible de la marque) */}
                      <td className="p-4">
                        <span className="font-bold text-text-primary">
                          {camp.applicationsCount}
                        </span>
                        <span className="text-text-tertiary block text-[11px]">
                          reçue(s)
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setPreviewCampaign(camp)}
                            className="p-1.5 rounded-lg bg-surface-page border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-hover text-xs"
                            title={t.list.actionPreview}
                          >
                            👁
                          </button>

                          {/* Pause / Reprise */}
                          {camp.status === "publiee" && (
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handlePause(camp.id)}
                              className="p-1.5 rounded-lg bg-surface-page border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-hover text-xs"
                              title={t.list.actionPause}
                            >
                              ⏸
                            </button>
                          )}

                          {camp.status === "en_pause" && (
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleResume(camp.id)}
                              className="p-1.5 rounded-lg bg-surface-page border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-hover text-xs"
                              title={t.list.actionResume}
                            >
                              ▶
                            </button>
                          )}

                          {/* Dupliquer */}
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleDuplicate(camp.id)}
                            className="p-1.5 rounded-lg bg-surface-page border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-hover text-xs"
                            title={t.list.actionDuplicate}
                          >
                            ⎘
                          </button>

                          {/* Clôturer */}
                          {camp.status !== "cloturee" && (
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => setClosingCampaignId(camp.id)}
                              className="p-1.5 rounded-lg bg-surface-page border border-border-default text-feedback-error-text hover:bg-surface-hover text-xs"
                              title={t.list.actionClose}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modale d'Aperçu Créateur */}
      {previewCampaign && (
        <CampaignPreviewModal
          isOpen={Boolean(previewCampaign)}
          onClose={() => setPreviewCampaign(null)}
          campaign={previewCampaign}
          locale={locale}
        />
      )}

      {/* Modale de Confirmation de Clôture Définitive (RG9) */}
      {closingCampaignId && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-surface-card w-full max-w-md rounded-2xl border border-border-default shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-text-primary">
              {t.list.confirmCloseTitle}
            </h3>
            <p className="text-xs text-text-secondary leading-relaxed">
              {t.list.confirmCloseMessage}
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setClosingCampaignId(null)}
                className="px-4 py-2 rounded-lg bg-surface-page border border-border-default text-text-secondary hover:text-text-primary text-xs font-semibold"
              >
                {t.list.confirmCloseCancel}
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleClose}
                className="px-4 py-2 rounded-lg bg-feedback-error-bg text-feedback-error-text border border-feedback-error-border text-xs font-bold hover:bg-feedback-error-bg/80"
              >
                {actionLoading ? "Clôture..." : t.list.confirmCloseConfirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

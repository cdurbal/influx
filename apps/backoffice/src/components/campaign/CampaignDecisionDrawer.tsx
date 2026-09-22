"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  type CampaignBackofficeView,
  type CampaignRejectionReason,
  CAMPAIGN_REJECTION_REASONS,
  CAMPAIGN_REJECTION_MESSAGES,
} from "@influx/contracts";
import { bo } from "@/locales/bo-labels";
import { authFetch } from "@/lib/api-client";

export interface CampaignDecisionDrawerProps {
  campaign: CampaignBackofficeView | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentAgentId?: string;
  currentAgentName?: string;
  isAdmin?: boolean;
}

export function CampaignDecisionDrawer({
  campaign,
  isOpen,
  onClose,
  onSuccess,
  currentAgentId = "88888888-8888-4888-8888-888888888888",
  currentAgentName = "Alexandre Martin",
  isAdmin = false,
}: CampaignDecisionDrawerProps) {
  const [actionTab, setActionTab] = useState<"publish" | "reject">("publish");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Formulaire de refus
  const [rejectionReason, setRejectionReason] =
    useState<CampaignRejectionReason>("brief_insuffisant");
  const [rejectionComment, setRejectionComment] = useState("");

  // Revue renforcée (secteur sensible)
  const [secondAgentId, setSecondAgentId] = useState("agent-2");
  const [dualReviewNote, setDualReviewNote] = useState("");

  // Commercial responsable
  const [responsibleAgentId, setResponsibleAgentId] = useState(currentAgentId);

  // Auto-claim à l'ouverture (15 RG27 C1, CA11)
  const autoClaim = useCallback(
    async (campaignId: string) => {
      try {
        const res = await authFetch(
          `/api/backoffice/campaigns/${campaignId}/claim`,
          {
            method: "POST",
          },
        );
        if (res.ok) {
          onSuccess();
        }
      } catch (err: unknown) {
        console.warn("Auto-claim non bloquant:", err);
      }
    },
    [onSuccess],
  );

  useEffect(() => {
    if (isOpen && campaign && !campaign.lockedByAgentId) {
      autoClaim(campaign.id);
    }
  }, [isOpen, campaign?.id, campaign?.lockedByAgentId, autoClaim]);

  // Fermeture sur Échap (15 RG116)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !campaign) return null;

  const isLockedByMe =
    Boolean(campaign.lockedByAgentId) &&
    campaign.lockedByAgentId === currentAgentId;
  const isLockedByOther =
    Boolean(campaign.lockedByAgentId) &&
    campaign.lockedByAgentId !== currentAgentId;

  // Libérer le verrou
  const handleReleaseLock = async () => {
    try {
      setSubmitting(true);
      const res = await authFetch(
        `/api/backoffice/campaigns/${campaign.id}/release-claim`,
        {
          method: "POST",
        },
      );
      if (res.ok) {
        onSuccess();
        onClose();
      }
    } catch {
      // Ignorer
    } finally {
      setSubmitting(false);
    }
  };

  // Décision de publication
  const handlePublish = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const body: { secondAgentId?: string; responsibleAgentId?: string } = {
        responsibleAgentId,
      };

      if (campaign.isSensitive && !isAdmin) {
        body.secondAgentId = secondAgentId;
      }

      const res = await authFetch(
        `/api/backoffice/campaigns/${campaign.id}/publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || "Erreur lors de la publication");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Erreur lors de la publication",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Décision de refus
  const handleReject = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await authFetch(
        `/api/backoffice/campaigns/${campaign.id}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reason: rejectionReason,
            comment: rejectionComment.trim() || undefined,
          }),
        },
      );

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || "Erreur lors du refus");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Erreur lors du refus",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectedReasonInfo = CAMPAIGN_REJECTION_MESSAGES[rejectionReason];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="campaign-drawer-title"
      className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end"
    >
      <div className="w-full max-w-3xl bg-surface-card h-full overflow-y-auto border-l border-border-default shadow-2xl flex flex-col">
        {/* En-tête du tiroir */}
        <div className="p-6 border-b border-border-default bg-surface-page/50 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-brand-primary px-2 py-0.5 rounded bg-brand-subtle-bg border border-brand-subtle-border">
                {campaign.id.slice(0, 13).toUpperCase()}
              </span>
              <span className="text-xs text-text-tertiary">
                Créée le{" "}
                {new Date(campaign.createdAt).toLocaleDateString("fr-FR")}
              </span>
              {campaign.isSensitive && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-feedback-warning-bg text-feedback-warning-text border border-feedback-warning-border">
                  ⚠ Secteur sensible
                </span>
              )}
            </div>
            <h2
              id="campaign-drawer-title"
              className="text-lg font-extrabold text-text-primary tracking-tight"
            >
              {campaign.title}
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              {campaign.brandSummary?.companyName || "Marque"} · Catégorie :{" "}
              <span className="font-semibold text-text-primary">
                {campaign.productCategory}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isLockedByMe && (
              <button
                type="button"
                onClick={handleReleaseLock}
                disabled={submitting}
                className="text-xs text-text-tertiary hover:text-text-secondary px-2.5 py-1 rounded border border-border-default hover:bg-surface-hover transition-colors"
                title={bo.campaignDecisionDrawer.releaseLock}
              >
                Relâcher verrou
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-text-tertiary hover:text-text-primary hover:bg-surface-hover rounded-md text-lg leading-none"
              aria-label={bo.campaignDecisionDrawer.close}
            >
              ✕
            </button>
          </div>
        </div>

        {/* État du verrou d'agent */}
        <div className="px-6 py-2 bg-surface-muted/60 border-b border-border-subtle flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {isLockedByMe && (
              <span className="text-brand-primary font-medium flex items-center gap-1">
                🔒 Verrouillé à votre nom ({currentAgentName}) — 30 min
              </span>
            )}
            {isLockedByOther && (
              <span className="text-feedback-warning-text font-medium flex items-center gap-1">
                🔒 En cours d&apos;examen par un autre agent
              </span>
            )}
            {!campaign.lockedByAgentId && (
              <span className="text-text-tertiary">
                ○ Dossier libre (Prise en charge automatique)
              </span>
            )}
          </div>
          <span className="text-text-tertiary text-[11px]">
            Touche ‹Échap› pour fermer
          </span>
        </div>

        {/* Corps déroulant */}
        <div className="p-6 space-y-6 flex-1 text-xs">
          {/* Bandeau Revue Renforcée si secteur sensible (RG85, CA56, 17b §3.8) */}
          {campaign.isSensitive && (
            <div className="p-4 rounded-lg bg-feedback-warning-bg border border-feedback-warning-border text-feedback-warning-text space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <span>⚠</span>
                <span>{bo.campaignDecisionDrawer.sensitiveBadge}</span>
              </div>
              <p className="text-xs leading-relaxed">
                {bo.campaignDecisionDrawer.sensitiveNotice}
              </p>
              <div className="text-[11px] bg-surface-card/60 p-2.5 rounded border border-feedback-warning-border/40 text-text-secondary">
                <span className="font-semibold text-text-primary">
                  Attestation légale de la marque :
                </span>{" "}
                « Déclare détenir les autorisations nécessaires pour promouvoir
                ce produit et respecter les règles de publicité applicables »
                {campaign.sensitiveDeclarationAcceptedAt ? (
                  <span className="block mt-0.5 text-text-tertiary">
                    ✓ Déclaration horodatée le{" "}
                    {new Date(
                      campaign.sensitiveDeclarationAcceptedAt,
                    ).toLocaleString("fr-FR")}
                  </span>
                ) : (
                  <span className="block mt-0.5 text-feedback-error-text font-semibold">
                    ✕ Aucune déclaration horodatée trouvée
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Alertes d'inspection & Détections automatiques (RG21, RG22, RG23, RG48, RG95) */}
          {campaign.reviewWarnings && campaign.reviewWarnings.length > 0 && (
            <div className="p-4 rounded-lg bg-feedback-info-bg border border-feedback-info-border text-feedback-info-text space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs">
                <span>👁</span>
                <span>Points de vigilance & détections automatiques :</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                {campaign.reviewWarnings.map((warning) => (
                  <li key={warning} className="leading-snug">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Section 1 : LA MARQUE */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary flex items-center gap-1.5">
              <span>🏢</span>
              <span>{bo.campaignDecisionDrawer.brandSectionTitle}</span>
            </h3>
            <div className="p-3.5 rounded-lg bg-surface-page border border-border-default flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-text-primary">
                    {campaign.brandSummary?.companyName || "Marque"}
                  </span>
                  <span className="text-text-tertiary font-mono">
                    · {campaign.brandSummary?.country || "FR"}
                  </span>
                  {campaign.brandSummary?.isVerified && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-subtle-bg text-brand-primary border border-brand-subtle-border">
                      ✓ Profil publié
                    </span>
                  )}
                </div>
                {campaign.brandSummary?.website && (
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {campaign.brandSummary.website}
                  </p>
                )}
              </div>
              <div className="text-right text-xs">
                <span className="text-text-tertiary block">
                  Historique campagnes
                </span>
                <span className="font-semibold text-text-primary">
                  {campaign.brandSummary?.publishedCampaignsCount || 0}{" "}
                  publiée(s)
                </span>
              </div>
            </div>
          </section>

          {/* Section 2 : LA CAMPAGNE & CONDITIONS */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary flex items-center gap-1.5">
              <span>🎯</span>
              <span>{bo.campaignDecisionDrawer.campaignSectionTitle}</span>
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-surface-page border border-border-default space-y-1">
                <span className="text-text-tertiary block text-[11px]">
                  Rémunération par créateur :
                </span>
                <span className="text-sm font-extrabold text-text-primary block">
                  {campaign.minCompensationMinor != null &&
                  campaign.maxCompensationMinor != null
                    ? `${(campaign.minCompensationMinor / 100).toLocaleString("fr-FR")} – ${(campaign.maxCompensationMinor / 100).toLocaleString("fr-FR")} ${campaign.currency}`
                    : "Dotation seule"}
                </span>
                {campaign.totalBudgetMinor && (
                  <span className="text-[11px] text-text-tertiary block">
                    Budget total interne :{" "}
                    {(campaign.totalBudgetMinor / 100).toLocaleString("fr-FR")}{" "}
                    {campaign.currency}
                  </span>
                )}
              </div>

              <div className="p-3 rounded-lg bg-surface-page border border-border-default space-y-1">
                <span className="text-text-tertiary block text-[11px]">
                  Calendrier de campagne :
                </span>
                <span className="font-medium text-text-primary block">
                  Période : {campaign.startsOn || "—"} au{" "}
                  {campaign.endsOn || "—"}
                </span>
                <span className="text-[11px] text-text-tertiary block">
                  Candidatures jusqu&apos;au :{" "}
                  {campaign.applicationDeadline || "—"}
                </span>
              </div>
            </div>

            {/* Livrables demandés */}
            <div className="p-3.5 rounded-lg bg-surface-page border border-border-default space-y-2">
              <span className="text-text-tertiary block font-semibold text-[11px]">
                Livrables exigés ({campaign.deliverables?.length || 0} ligne(s))
                :
              </span>
              <div className="flex flex-wrap gap-2">
                {campaign.deliverables?.map((d) => (
                  <span
                    key={`${d.network}-${d.format}`}
                    className="px-2.5 py-1 rounded bg-surface-card border border-border-default text-xs text-text-primary font-medium"
                  >
                    {d.quantity}× {d.format} ({d.network})
                  </span>
                ))}
              </div>
              <div className="pt-2 border-t border-border-subtle flex flex-wrap gap-4 text-[11px] text-text-secondary">
                <span>
                  Droits d&apos;usage :{" "}
                  <strong className="text-text-primary">
                    {campaign.usageRights}
                  </strong>{" "}
                  ({campaign.usageDuration || "non spécifié"})
                </span>
                <span>
                  Exclusivité :{" "}
                  <strong className="text-text-primary">
                    {campaign.exclusivity}
                  </strong>
                </span>
                <span>
                  Délai validation contenus :{" "}
                  <strong className="text-text-primary">
                    {campaign.contentValidationDelay}
                  </strong>
                </span>
              </div>
            </div>

            {/* Dotation produit si applicable */}
            {campaign.productShipped && (
              <div className="p-3 rounded-lg bg-surface-page border border-border-default text-[11px] space-y-1">
                <span className="font-bold text-text-primary">
                  🎁 Produit envoyé au créateur : {campaign.productName}
                </span>
                <p className="text-text-secondary">
                  Tranche de valeur :{" "}
                  {campaign.productValueBand || "non spécifiée"} ·{" "}
                  {campaign.productKept
                    ? "Le créateur conserve le produit"
                    : "Produit à renvoyer"}{" "}
                  · Frais d&apos;envoi : {campaign.productShippingCost}
                </p>
              </div>
            )}
          </section>

          {/* Section 3 : LE BRIEF DÉTAILLÉ (17b §3.8 : texte brut, non tronqué, jamais HTML) */}
          <section className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-tertiary flex items-center gap-1.5">
              <span>📝</span>
              <span>{bo.campaignDecisionDrawer.briefSectionTitle}</span>
            </h3>

            <div className="space-y-2">
              <span className="text-[11px] text-text-tertiary block">
                Résumé public :
              </span>
              <p className="p-3 rounded bg-surface-page border border-border-default text-text-secondary italic">
                {campaign.publicSummary}
              </p>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] text-text-tertiary block">
                Brief complet :
              </span>
              <pre className="p-3.5 rounded bg-surface-muted text-text-primary border border-border-default font-mono text-[11px] whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                {campaign.detailedBrief}
              </pre>
            </div>

            {/* Messages clés & Interdits */}
            {campaign.keyMessages && campaign.keyMessages.length > 0 && (
              <div className="p-3 rounded bg-surface-page border border-border-default space-y-1.5">
                <span className="text-[11px] font-semibold text-text-secondary block">
                  Messages clés souhaités :
                </span>
                <ul className="list-disc pl-4 space-y-0.5 text-text-primary">
                  {campaign.keyMessages.map((msg) => (
                    <li key={msg}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}

            {campaign.prohibitions && (
              <div className="p-3 rounded bg-surface-page border border-border-default space-y-1">
                <span className="text-[11px] font-semibold text-feedback-error-text block">
                  Interdits et points de vigilance :
                </span>
                <p className="text-text-secondary">{campaign.prohibitions}</p>
              </div>
            )}
          </section>

          {/* Section 4 : DÉCISION DE MODÉRATION (17b §3.8) */}
          <section className="p-4 rounded-xl bg-surface-page border-2 border-border-default space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary flex items-center gap-1.5">
              <span>⚖</span>
              <span>{bo.campaignDecisionDrawer.decisionSectionTitle}</span>
            </h3>

            {/* Attribution du commercial responsable (RG97, AL20) */}
            <div className="space-y-1">
              <label
                htmlFor="responsibleAgent"
                className="block text-xs font-semibold text-text-primary"
              >
                {bo.campaignDecisionDrawer.responsibleAgentLabel}
              </label>
              <select
                id="responsibleAgent"
                value={responsibleAgentId}
                onChange={(e) => setResponsibleAgentId(e.target.value)}
                className="w-full p-2 rounded bg-surface-card border border-border-default text-text-primary text-xs focus:ring-1 focus:ring-brand-primary"
              >
                <option value={currentAgentId}>
                  {currentAgentName} (vous-même)
                </option>
                <option value="agent-2">Alexandre INFLUX (Agent 2)</option>
                <option value="agent-3">Sarah Commerciale (Agent 3)</option>
              </select>
              <span className="text-[10px] text-text-tertiary block">
                {bo.campaignDecisionDrawer.responsibleAgentHelp}
              </span>
            </div>

            {/* Onglets de décision : Publier ou Refuser */}
            <div className="flex gap-2 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setActionTab("publish")}
                className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-colors ${
                  actionTab === "publish"
                    ? "bg-brand-primary text-surface-page shadow-sm"
                    : "bg-surface-card text-text-secondary border border-border-default hover:text-text-primary"
                }`}
              >
                ✓ Publier la campagne
              </button>
              <button
                type="button"
                onClick={() => setActionTab("reject")}
                className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-colors ${
                  actionTab === "reject"
                    ? "bg-feedback-error-bg text-feedback-error-text border border-feedback-error-border shadow-sm"
                    : "bg-surface-card text-text-secondary border border-border-default hover:text-text-primary"
                }`}
              >
                ✕ Refuser avec motif
              </button>
            </div>

            {/* Formulaire de Publication */}
            {actionTab === "publish" && (
              <div className="space-y-3 pt-2">
                {campaign.isSensitive && !isAdmin ? (
                  <div className="p-3 rounded-lg bg-surface-card border border-border-default space-y-2">
                    <p className="text-xs text-text-secondary">
                      {bo.campaignDecisionDrawer.dualReviewHelp}
                    </p>
                    <div className="space-y-1">
                      <label
                        htmlFor="secondExaminer"
                        className="block text-[11px] font-semibold text-text-secondary"
                      >
                        Sélectionner le 2nd examinateur :
                      </label>
                      <select
                        id="secondExaminer"
                        value={secondAgentId}
                        onChange={(e) => setSecondAgentId(e.target.value)}
                        className="w-full p-2 rounded bg-surface-page border border-border-default text-text-primary text-xs"
                      >
                        <option value="agent-2">
                          Alexandre INFLUX (Agent 2)
                        </option>
                        <option value="admin-1">
                          Sarah Admin (Administratrice)
                        </option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label
                        htmlFor="dualReviewNote"
                        className="block text-[11px] font-semibold text-text-secondary"
                      >
                        Avis motivé obligatoire du 1er examinateur :
                      </label>
                      <textarea
                        id="dualReviewNote"
                        rows={2}
                        value={dualReviewNote}
                        onChange={(e) => setDualReviewNote(e.target.value)}
                        placeholder="Ex : Attestation vérifiée, mentions d'avertissement conformes..."
                        className="w-full p-2 rounded bg-surface-page border border-border-default text-text-primary text-xs"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handlePublish}
                      disabled={submitting || isLockedByOther}
                      className="w-full py-2.5 px-4 rounded-lg bg-action-primary-bg text-text-on-action font-bold text-xs hover:bg-action-primary-bg-hover transition-colors disabled:opacity-50"
                    >
                      {submitting
                        ? bo.campaignDecisionDrawer.btnSaving
                        : bo.campaignDecisionDrawer.btnTransmitSecond}
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-text-secondary mb-3">
                      La campagne sera immédiatement visible par tous les
                      créateurs éligibles (Couche A). Les coordonnées de la
                      marque et son budget total restent masqués.
                    </p>
                    <button
                      type="button"
                      onClick={handlePublish}
                      disabled={submitting || isLockedByOther}
                      className="w-full py-2.5 px-4 rounded-lg bg-action-primary-bg text-text-on-action font-bold text-xs hover:bg-action-primary-bg-hover transition-colors disabled:opacity-50"
                    >
                      {submitting
                        ? bo.campaignDecisionDrawer.btnSaving
                        : bo.campaignDecisionDrawer.btnPublish}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Formulaire de Refus (RG89, RG90) */}
            {actionTab === "reject" && (
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <label
                    htmlFor="rejectionReason"
                    className="block text-xs font-semibold text-text-primary"
                  >
                    {bo.campaignDecisionDrawer.rejectionReasonLabel}
                  </label>
                  <select
                    id="rejectionReason"
                    value={rejectionReason}
                    onChange={(e) =>
                      setRejectionReason(
                        e.target.value as CampaignRejectionReason,
                      )
                    }
                    className="w-full p-2 rounded bg-surface-card border border-border-default text-text-primary text-xs"
                  >
                    {CAMPAIGN_REJECTION_REASONS.map((code) => (
                      <option key={code} value={code}>
                        {CAMPAIGN_REJECTION_MESSAGES[code]?.label || code}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Explication du message transmis */}
                {selectedReasonInfo && (
                  <div className="p-2.5 rounded bg-surface-card border border-border-default text-[11px] space-y-1 text-text-secondary">
                    <p>
                      <strong className="text-text-primary">
                        Message transmis à la marque :
                      </strong>{" "}
                      « {selectedReasonInfo.messageFr} »
                    </p>
                    <p className="text-text-tertiary">
                      Action proposée à la marque :{" "}
                      <span className="font-semibold text-brand-primary">
                        {selectedReasonInfo.whatBrandCanDoFr}
                      </span>
                    </p>
                  </div>
                )}

                <div className="space-y-1">
                  <label
                    htmlFor="rejectionComment"
                    className="block text-[11px] font-semibold text-text-secondary"
                  >
                    {bo.campaignDecisionDrawer.agentCommentLabel} :
                  </label>
                  <textarea
                    id="rejectionComment"
                    rows={3}
                    value={rejectionComment}
                    onChange={(e) => setRejectionComment(e.target.value)}
                    placeholder={
                      bo.campaignDecisionDrawer.agentCommentPlaceholder
                    }
                    className="w-full p-2 rounded bg-surface-card border border-border-default text-text-primary text-xs"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleReject}
                  disabled={
                    submitting ||
                    isLockedByOther ||
                    (rejectionReason === "autre" && !rejectionComment.trim())
                  }
                  className="w-full py-2.5 px-4 rounded-lg bg-feedback-error-bg text-feedback-error-text border border-feedback-error-border font-bold text-xs hover:bg-feedback-error-bg/80 transition-colors disabled:opacity-50"
                >
                  {submitting
                    ? bo.campaignDecisionDrawer.btnSaving
                    : bo.campaignDecisionDrawer.btnConfirmReject}
                </button>
              </div>
            )}

            {/* Message d'erreur éventuel */}
            {errorMessage && (
              <p className="text-xs text-feedback-error-text bg-feedback-error-bg p-2.5 rounded border border-feedback-error-border font-medium">
                ✕ {errorMessage}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

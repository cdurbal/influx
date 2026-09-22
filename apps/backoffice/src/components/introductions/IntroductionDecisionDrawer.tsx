"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  type Introduction,
  type IntroductionRejectionReason,
  INTRODUCTION_REJECTION_REASONS,
} from "@influx/contracts";

export interface IntroductionDecisionDrawerProps {
  introduction: Introduction | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentAgentId?: string;
  currentAgentName?: string;
  isAdmin?: boolean;
}

export const INTRODUCTION_REJECTION_LABELS: Record<
  IntroductionRejectionReason,
  string
> = {
  off_topic: "Hors sujet / Inadéquation thématique",
  budget_mismatch: "Écart ou désaccord budgétaire manifeste",
  creator_unavailable: "Créateur indisponible ou capacité saturée",
  campaign_closed: "Campagne clôturée ou pourvue",
  duplicate: "Doublon de mise en relation existante",
  account_suspended: "Compte suspendu ou non conforme",
  suspected_circumvention: "Suspicion de contournement de la plateforme",
  country_out_of_scope: "Pays hors périmètre contractuel autorisé",
  other: "Autre motif (justification détaillée obligatoire)",
};

export function IntroductionDecisionDrawer({
  introduction,
  isOpen,
  onClose,
  onSuccess,
  currentAgentId = "88888888-8888-4888-8888-888888888888",
  currentAgentName = "Alexandre Martin",
  isAdmin = false,
}: IntroductionDecisionDrawerProps) {
  const [activeTab, setActiveTab] = useState<"approve" | "reject">("approve");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Formulaire de refus
  const [rejectionReason, setRejectionReason] =
    useState<IntroductionRejectionReason>("off_topic");
  const [rejectionComment, setRejectionComment] = useState("");

  // Auto-claim lors de l'ouverture (verrou d'agent RG13 §2)
  const autoClaim = useCallback(
    async (introId: string) => {
      try {
        const res = await fetch(
          `/api/backoffice/introductions/${introId}/claim`,
          {
            method: "POST",
            credentials: "include",
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
    if (
      isOpen &&
      introduction &&
      introduction.status === "pending_review" &&
      !introduction.claimedByAgentId
    ) {
      autoClaim(introduction.id);
    }
  }, [isOpen, introduction, autoClaim]);

  // Libération manuelle du verrou
  const handleRelease = async () => {
    if (!introduction) return;
    try {
      setSubmitting(true);
      setErrorMessage(null);
      const res = await fetch(
        `/api/backoffice/introductions/${introduction.id}/release`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Impossible de libérer le verrou");
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Décision commerciale : Validation
  const handleApprove = async () => {
    if (!introduction) return;
    try {
      setSubmitting(true);
      setErrorMessage(null);

      const res = await fetch(
        `/api/backoffice/introductions/${introduction.id}/decide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "approve" }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors de la validation");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Décision commerciale : Refus
  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!introduction) return;

    if (rejectionReason === "other" && rejectionComment.trim().length < 5) {
      setErrorMessage(
        "Veuillez préciser le motif de refus dans le commentaire (au moins 5 caractères).",
      );
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const res = await fetch(
        `/api/backoffice/introductions/${introduction.id}/decide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "reject",
            rejectionReasonCode: rejectionReason,
            rejectionReasonComment: rejectionComment.trim() || undefined,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Erreur lors du refus");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !introduction) return null;

  const isLockedByOther =
    introduction.claimedByAgentId &&
    introduction.claimedByAgentId !== currentAgentId &&
    !isAdmin;

  const isClosed =
    introduction.status === "approved" ||
    introduction.status === "rejected" ||
    introduction.status === "withdrawn" ||
    introduction.status === "expired";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      className="fixed inset-0 z-50 overflow-hidden"
    >
      {/* Fond sombre */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-surface-card border-l border-border-default flex flex-col shadow-2xl">
          {/* En-tête du tiroir */}
          <div className="px-6 py-5 border-b border-border-default flex items-center justify-between bg-surface-muted">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-brand-subtle-bg text-text-brand border border-brand-subtle-border">
                  {introduction.reference}
                </span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-semibold border ${
                    introduction.status === "pending_review"
                      ? "bg-feedback-warning-bg text-feedback-warning-text border-feedback-warning-border"
                      : introduction.status === "in_review"
                        ? "bg-feedback-info-bg text-feedback-info-text border-feedback-info-border"
                        : introduction.status === "approved"
                          ? "bg-brand-subtle-bg text-text-brand border-brand-subtle-border"
                          : "bg-feedback-error-bg text-feedback-error-text border-feedback-error-border"
                  }`}
                >
                  {introduction.status === "pending_review" && "En attente"}
                  {introduction.status === "in_review" && "En cours d'examen"}
                  {introduction.status === "approved" && "Validée (Approuvée)"}
                  {introduction.status === "rejected" && "Refusée"}
                </span>
              </div>
              <h2
                id="drawer-title"
                className="text-lg font-bold text-text-primary mt-1"
              >
                File 8 · Décision de mise en relation
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-text-tertiary hover:text-text-primary p-1.5 rounded-lg hover:bg-surface-card text-sm"
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>

          {/* Bandeau de verrou d'agent */}
          <div className="px-6 py-2.5 bg-surface-page border-b border-border-default flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-feedback-info-icon animate-pulse" />
              <span>
                {introduction.claimedByAgentId === currentAgentId ? (
                  <strong className="text-feedback-info-text">
                    Vous avez le verrou sur cette demande
                  </strong>
                ) : introduction.claimedByAgentId ? (
                  <span className="text-feedback-warning-text">
                    Verrouillé par un autre agent (
                    {introduction.claimedByAgentId})
                  </span>
                ) : (
                  <span className="text-text-tertiary">
                    Demande libre (non verrouillée)
                  </span>
                )}
              </span>
            </div>
            {introduction.claimedByAgentId === currentAgentId && !isClosed && (
              <button
                onClick={handleRelease}
                disabled={submitting}
                className="text-xs text-text-tertiary hover:text-feedback-error-text underline"
              >
                Libérer le verrou
              </button>
            )}
          </div>

          {/* Message d'erreur */}
          {errorMessage && (
            <div className="mx-6 mt-4 p-3 bg-feedback-error-bg border border-feedback-error-border text-feedback-error-text text-xs rounded-lg">
              {errorMessage}
            </div>
          )}

          {/* Corps défilable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Bloc Origine & SLA */}
            <div className="p-4 rounded-lg bg-surface-muted border border-border-default space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-tertiary">
                  Origine du déclencheur :
                </span>
                <span className="font-semibold text-text-primary uppercase tracking-wider">
                  {introduction.origin === "brand_contact_request" &&
                    "Demande de contact Marque (1)"}
                  {introduction.origin === "creator_application" &&
                    "Candidature Créateur (2)"}
                  {introduction.origin === "influx_proposal" &&
                    "Proposition INFLUX (3)"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-tertiary">Échéance SLA :</span>
                <span className="font-mono text-text-primary">
                  {new Date(introduction.slaDueAt).toLocaleString("fr-FR")}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-tertiary">Créée le :</span>
                <span className="font-mono text-text-primary">
                  {new Date(introduction.createdAt).toLocaleString("fr-FR")}
                </span>
              </div>
            </div>

            {/* Bloc Parties prenantes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-surface-card border border-border-default space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                  Annonceur (Marque)
                </div>
                <div className="text-xs space-y-1">
                  <div>
                    <span className="text-text-tertiary">ID Compte :</span>{" "}
                    <span className="font-mono text-text-primary break-all">
                      {introduction.advertiserAccountId}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">
                      Pays d&apos;origine :
                    </span>{" "}
                    <span className="font-semibold text-text-primary">
                      {introduction.advertiserCountryAtIntro}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">Acceptation :</span>{" "}
                    <span className="font-medium text-text-brand">
                      {introduction.advertiserAcceptedAt
                        ? "Acceptée à l'écran"
                        : "En attente d'acceptation"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-surface-card border border-border-default space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                  Créateur
                </div>
                <div className="text-xs space-y-1">
                  <div>
                    <span className="text-text-tertiary">ID Compte :</span>{" "}
                    <span className="font-mono text-text-primary break-all">
                      {introduction.creatorAccountId}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">
                      Pays d&apos;origine :
                    </span>{" "}
                    <span className="font-semibold text-text-primary">
                      {introduction.creatorCountryAtIntro}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">Acceptation :</span>{" "}
                    <span className="font-medium text-text-brand">
                      {introduction.creatorAcceptedAt
                        ? "Acceptée à l'écran"
                        : "En attente d'acceptation"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bloc Campagne rattachée */}
            {introduction.campaignId && (
              <div className="p-4 rounded-lg bg-surface-card border border-border-default space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                  Campagne ciblée
                </div>
                <div className="text-xs font-mono text-text-primary break-all">
                  {introduction.campaignId}
                </div>
              </div>
            )}

            {/* Message de motivation / motif d'origine */}
            <div className="p-4 rounded-lg bg-surface-card border border-border-default space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider text-text-tertiary">
                Motif d&apos;origine / Message rédigé
              </div>
              <p className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed bg-surface-muted p-3 rounded border border-border-default">
                {introduction.originReason}
              </p>
            </div>

            {/* Panneau de décision commerciale */}
            {!isClosed ? (
              <div className="border border-border-default rounded-lg overflow-hidden bg-surface-card">
                {/* Onglets Valider / Refuser */}
                <div className="flex border-b border-border-default bg-surface-muted">
                  <button
                    type="button"
                    onClick={() => setActiveTab("approve")}
                    disabled={Boolean(isLockedByOther)}
                    className={`flex-1 py-3 text-xs font-bold tracking-wider uppercase transition-colors ${
                      activeTab === "approve"
                        ? "bg-surface-card text-text-brand border-b-2 border-brand-primary shadow-sm"
                        : "text-text-tertiary hover:text-text-primary"
                    }`}
                  >
                    ✓ Valider la mise en relation
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("reject")}
                    disabled={Boolean(isLockedByOther)}
                    className={`flex-1 py-3 text-xs font-bold tracking-wider uppercase transition-colors ${
                      activeTab === "reject"
                        ? "bg-surface-card text-feedback-error-text border-b-2 border-feedback-error-border shadow-sm"
                        : "text-text-tertiary hover:text-text-primary"
                    }`}
                  >
                    ✕ Refuser avec motif
                  </button>
                </div>

                <div className="p-5">
                  {isLockedByOther ? (
                    <div className="text-center py-6 text-xs text-feedback-warning-text">
                      Cette demande est actuellement verrouillée par un autre
                      commercial. Vous ne pouvez pas valider ou refuser cette
                      demande.
                    </div>
                  ) : activeTab === "approve" ? (
                    <div className="space-y-4 text-xs">
                      <div className="p-3 bg-brand-subtle-bg border border-brand-subtle-border text-text-brand rounded leading-relaxed">
                        <p className="font-semibold mb-1">
                          Effets de la validation :
                        </p>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>
                            Vous devenez le{" "}
                            <strong>
                              commercial titulaire de l&apos;affaire (
                              {currentAgentName})
                            </strong>
                            .
                          </li>
                          <li>
                            La demande passe en statut <code>approved</code>.
                          </li>
                          <li>
                            L&apos;invitation d&apos;acceptation est envoyée aux
                            deux parties. Dès validation conjointe, les
                            identités seront révélées et la messagerie à trois
                            s&apos;ouvrira.
                          </li>
                        </ul>
                      </div>

                      <button
                        type="button"
                        onClick={handleApprove}
                        disabled={submitting}
                        className="w-full py-2.5 px-4 bg-action-primary-bg hover:bg-action-primary-bg-hover text-text-on-action font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50"
                      >
                        {submitting
                          ? "Validation en cours..."
                          : "Valider et s'attribuer l'affaire"}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleReject} className="space-y-4 text-xs">
                      <div>
                        <label className="block font-bold text-text-primary mb-1.5">
                          Motif typé de refus obligatoire (RG13 §G) :
                        </label>
                        <select
                          value={rejectionReason}
                          onChange={(e) =>
                            setRejectionReason(
                              e.target.value as IntroductionRejectionReason,
                            )
                          }
                          className="w-full p-2.5 rounded border border-border-default bg-surface-page text-text-primary text-xs focus:ring-1 focus:ring-brand-primary"
                        >
                          {INTRODUCTION_REJECTION_REASONS.map((reason) => (
                            <option key={reason} value={reason}>
                              {INTRODUCTION_REJECTION_LABELS[reason]}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block font-bold text-text-primary mb-1.5">
                          Commentaire explicatif interne{" "}
                          {rejectionReason === "other" && (
                            <span className="text-feedback-error-text">
                              * (Requis)
                            </span>
                          )}
                          :
                        </label>
                        <textarea
                          rows={3}
                          value={rejectionComment}
                          onChange={(e) => setRejectionComment(e.target.value)}
                          placeholder="Note explicative pour l'équipe commerciale et pour la traçabilité..."
                          className="w-full p-2.5 rounded border border-border-default bg-surface-page text-text-primary text-xs focus:ring-1 focus:ring-feedback-error-border"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-2.5 px-4 bg-feedback-error-bg hover:bg-feedback-error-border text-feedback-error-text font-bold rounded-lg transition-colors shadow-sm disabled:opacity-50 border border-feedback-error-border"
                      >
                        {submitting
                          ? "Traitement..."
                          : "Confirmer le refus définitif"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-surface-muted border border-border-default rounded-lg text-xs space-y-1">
                <span className="font-bold text-text-primary">
                  Demande déjà clôturée :
                </span>
                <div>
                  Statut final : <strong>{introduction.status}</strong>
                </div>
                {introduction.rejectionReasonCode && (
                  <div>
                    Motif :{" "}
                    {
                      INTRODUCTION_REJECTION_LABELS[
                        introduction.rejectionReasonCode
                      ]
                    }
                  </div>
                )}
                {introduction.rejectionReasonComment && (
                  <div className="text-text-tertiary mt-1 italic">
                    « {introduction.rejectionReasonComment} »
                  </div>
                )}
                {(introduction.status === "approved" ||
                  introduction.conversationId) && (
                  <div className="pt-3 border-t border-border-default">
                    <Link
                      href={`/messages/${introduction.conversationId || "e1111111-e111-4111-8111-111111111111"}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-subtle-bg border border-brand-subtle-border text-text-brand font-bold hover:bg-brand-subtle-border/30 transition-colors"
                    >
                      <span>💬 Ouvrir le fil de négociation à trois</span>
                      <span>→</span>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

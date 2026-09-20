"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  type VerificationQueueItem,
  type VerificationRequest,
  type VerificationRejectionReasonCode,
  VERIFICATION_REJECTION_REASONS,
  VERIFICATION_REJECTION_MESSAGES,
} from "@influx/contracts";
import { bo } from "@/locales/bo-labels";

export interface VerificationDecisionDrawerProps {
  request: (VerificationRequest & Partial<VerificationQueueItem>) | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentAgentId?: string;
  currentAgentName?: string;
}

interface DecisionPayload {
  decision: "approve" | "reject" | "reexamine";
  observedHandle?: string;
  observedPlatformAccountRef?: string;
  observedFollowers?: number;
  observedPeriodStart?: string;
  observedPeriodEnd?: string;
  observedEngagement?: number;
  rejectionReasonCode?: VerificationRejectionReasonCode;
  agentComment?: string;
  reexamineReason?: string;
}

export function VerificationDecisionDrawer({
  request,
  isOpen,
  onClose,
  onSuccess,
  currentAgentId = "88888888-8888-4888-8888-888888888888",
  currentAgentName = "Alexandre Martin",
}: VerificationDecisionDrawerProps) {
  // Deux issues uniquement : approve ou reject (15 RG27 C6, 17b §2.5)
  const [activeTab, setActiveTab] = useState<"approve" | "reject">("approve");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Formulaire d'approbation propriété (Niveau 1)
  const [observedHandle, setObservedHandle] = useState("");
  const [observedPlatformAccountRef, setObservedPlatformAccountRef] =
    useState("");

  // Formulaire d'approbation audience (Niveau 2)
  const [observedFollowers, setObservedFollowers] = useState<string>("");
  const [observedPeriodStart, setObservedPeriodStart] = useState<string>("");
  const [observedPeriodEnd, setObservedPeriodEnd] = useState<string>("");
  const [observedEngagement, setObservedEngagement] = useState<string>("");

  // Formulaire de refus
  const [rejectionReasonCode, setRejectionReasonCode] =
    useState<VerificationRejectionReasonCode>("ownership_not_proven");
  const [agentComment, setAgentComment] = useState("");

  // B-E4 : Prise en charge automatique à l'ouverture (15 RG27 C1, CA11)
  const autoClaim = useCallback(
    async (requestId: string) => {
      try {
        const res = await fetch(
          `/api/backoffice/verification/${requestId}/claim`,
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
    if (isOpen && request && request.status === "pending") {
      autoClaim(request.id);
    }
  }, [isOpen, request?.id, request?.status, autoClaim]);

  // Raccourci Échap pour fermer le panneau (15 RG116)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Réinitialiser les erreurs et formulaires au changement de requête
  useEffect(() => {
    setErrorMessage(null);
    setObservedHandle("");
    setObservedPlatformAccountRef("");
    setObservedFollowers("");
    setObservedPeriodStart("");
    setObservedPeriodEnd("");
    setObservedEngagement("");
    setRejectionReasonCode("ownership_not_proven");
    setAgentComment("");
    setActiveTab("approve");
  }, [request?.id]);

  if (!isOpen || !request) return null;

  const isClaimedByMe = Boolean(
    request.status === "in_review" &&
    request.claimedByAgentId === currentAgentId,
  );
  const isClaimedByOther = Boolean(
    request.status === "in_review" &&
    request.claimedByAgentId &&
    request.claimedByAgentId !== currentAgentId,
  );

  // Relâcher le verrou (retour en file) - Requalification de l'ancien 3e onglet (B-E5, 15 RG27 C3/C6)
  const handleReleaseLock = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const payload: DecisionPayload = {
        decision: "reexamine",
        reexamineReason: "Verrou relâché par l'agent (retour en file)",
      };
      const res = await fetch(
        `/api/backoffice/verification/${request.id}/decide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Échec du relâchement du verrou");
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur réseau";
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Soumission de la décision (Accorder ou Refuser)
  const handleDecide = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const payload: DecisionPayload = { decision: activeTab };

      if (activeTab === "approve") {
        if (request.requestedLevel === "account_ownership") {
          if (!observedHandle.trim()) {
            throw new Error("L'identifiant @ constaté est obligatoire.");
          }
          payload.observedHandle = observedHandle.trim();
          if (observedPlatformAccountRef.trim()) {
            payload.observedPlatformAccountRef =
              observedPlatformAccountRef.trim();
          }
        } else {
          const followers = parseInt(observedFollowers, 10);
          if (isNaN(followers) || followers < 0) {
            throw new Error(
              "Le nombre d'abonnés constaté doit être un entier positif.",
            );
          }
          if (!observedPeriodStart || !observedPeriodEnd) {
            throw new Error(
              "La période de capture (début et fin) est obligatoire.",
            );
          }
          payload.observedFollowers = followers;
          payload.observedPeriodStart = observedPeriodStart;
          payload.observedPeriodEnd = observedPeriodEnd;

          if (observedEngagement.trim()) {
            const eng = parseFloat(observedEngagement);
            if (!isNaN(eng)) {
              payload.observedEngagement = eng;
            }
          }
        }
      } else if (activeTab === "reject") {
        payload.rejectionReasonCode = rejectionReasonCode;
        if (rejectionReasonCode === "other" && !agentComment.trim()) {
          throw new Error(
            "Un commentaire explicatif est obligatoire pour le motif 'Autre'.",
          );
        }
        if (agentComment.trim()) {
          payload.agentComment = agentComment.trim();
        }
      }

      const res = await fetch(
        `/api/backoffice/verification/${request.id}/decide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message || "Échec de l'enregistrement de la décision.",
        );
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur réseau";
      setErrorMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const labels = bo.decisionDrawer;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="decision-drawer-title"
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity"
    >
      <div className="w-full max-w-2xl bg-surface-page border-l border-border-default h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Entête du tiroir avec marqueur ▮ de consultation journalisée (15 RG35) */}
        <div className="p-6 border-b border-border-default flex items-center justify-between bg-surface-card">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-muted text-text-secondary border border-border-subtle">
                {request.id.slice(0, 8)} ▮
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  request.requestedLevel === "account_ownership"
                    ? "bg-feedback-info-bg text-feedback-info-text border border-feedback-info-border"
                    : "bg-brand-subtle-bg text-brand-primary border border-brand-subtle-border"
                }`}
              >
                {request.requestedLevel === "account_ownership"
                  ? labels.ownershipTitle
                  : labels.audienceTitle}
              </span>
            </div>
            <h2
              id="decision-drawer-title"
              className="text-lg font-bold text-text-primary mt-1"
            >
              Vérification {request.network.toUpperCase()} ·{" "}
              {request.creatorAlias || request.accountId.slice(0, 8)}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={labels.close}
            className="p-2 text-text-tertiary hover:text-text-primary rounded-lg hover:bg-surface-hover transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Corps déroulant */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 text-sm text-text-secondary">
          {/* Bandeau d'état du verrou */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              isClaimedByOther
                ? "bg-feedback-error-bg border-feedback-error-border text-feedback-error-text"
                : isClaimedByMe
                  ? "bg-brand-subtle-bg border-brand-subtle-border text-brand-primary"
                  : "bg-surface-card border-border-default text-text-secondary"
            }`}
          >
            <div>
              <p className="font-semibold text-text-primary">
                {isClaimedByOther
                  ? labels.lockClaimedByOther.replace(
                      "{agentName}",
                      request.claimedByAgentName || "un autre agent",
                    )
                  : isClaimedByMe
                    ? labels.lockClaimedByMe
                    : labels.lockUnclaimed}
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                {isClaimedByOther
                  ? labels.lockHelpClaimedByOther
                  : isClaimedByMe
                    ? labels.lockHelpClaimedByMe
                    : labels.lockUnclaimed}
              </p>
            </div>
            {isClaimedByMe && (
              <button
                type="button"
                onClick={handleReleaseLock}
                disabled={submitting}
                className="px-3 py-1.5 bg-surface-muted hover:bg-surface-hover text-text-primary border border-border-default rounded-lg text-xs font-medium transition-colors shrink-0 cursor-pointer disabled:opacity-50"
              >
                {labels.releaseLock}
              </button>
            )}
          </div>

          {/* Message d'erreur éventuel */}
          {errorMessage && (
            <div
              role="alert"
              className="p-3 bg-feedback-error-bg border border-feedback-error-border text-feedback-error-text rounded-lg text-xs"
            >
              {errorMessage}
            </div>
          )}

          {/* Section 1 : Rappel des pièces et preuves */}
          <div className="bg-surface-card p-4 rounded-xl border border-border-default flex flex-col gap-3">
            <h3 className="font-semibold text-text-primary text-xs uppercase tracking-wider">
              {labels.evidenceSectionTitle}
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-text-tertiary block">
                  {labels.creatorAccount}
                </span>
                <span className="font-medium text-text-primary">
                  {request.creatorAlias ? `${request.creatorAlias} ` : ""}
                </span>
                <span className="font-mono text-text-tertiary text-xs block">
                  ({request.accountId})
                </span>
              </div>
              <div>
                <span className="text-text-tertiary block">
                  {labels.targetNetwork}
                </span>
                <span className="capitalize text-text-primary font-medium">
                  {request.network}
                </span>
              </div>
              <div>
                <span className="text-text-tertiary block">
                  {labels.submissionDate}
                </span>
                <span className="text-text-primary">
                  {new Date(request.createdAt).toLocaleString("fr-FR")}
                </span>
              </div>
              <div>
                <span className="text-text-tertiary block">
                  {labels.slaDeadline}
                </span>
                <span className="text-text-primary font-medium">
                  {new Date(request.slaDueAt).toLocaleString("fr-FR")}
                </span>
              </div>
            </div>

            {request.requestedLevel === "account_ownership" ? (
              <div className="mt-2 p-3 bg-surface-muted rounded-lg border border-border-subtle text-xs">
                <p className="font-semibold text-text-primary">
                  {labels.ownershipInstructionsTitle}
                </p>
                <p className="text-text-secondary mt-1 space-y-0.5">
                  <span className="block">
                    {labels.ownershipInstruction1.replace(
                      "du réseau",
                      `du réseau ${request.network}`,
                    )}
                  </span>
                  <span className="block">{labels.ownershipInstruction2}</span>
                  <span className="block">{labels.ownershipInstruction3}</span>
                </p>
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <span className="text-xs text-text-tertiary font-semibold">
                  {labels.evidenceScreenshotsTitle.replace(
                    "{count}",
                    String(request.evidenceFileIds?.length || 0),
                  )}
                </span>
                {request.evidenceFileIds &&
                request.evidenceFileIds.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {request.evidenceFileIds.map((fId, idx) => (
                      <div
                        key={fId}
                        className="p-3 bg-surface-muted rounded-lg border border-border-subtle flex items-center justify-between text-xs"
                      >
                        <span className="font-mono text-text-secondary truncate">
                          Pièce {idx + 1} ({fId.slice(0, 8)}...)
                        </span>
                        <a
                          href={`/api/storage/files/${fId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 bg-surface-raised hover:bg-surface-hover border border-border-default rounded text-text-primary text-xs transition-colors"
                          title="Consultation journalisée"
                        >
                          {labels.openEvidence}
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-feedback-error-text">
                    {labels.noEvidenceAttached}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Section 2 : Décision de l'agent (deux issues, 15 RG27 C6) */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-text-primary text-xs uppercase tracking-wider">
              {labels.decisionSectionTitle}
            </h3>

            {/* Deux onglets uniques : Accorder ou Refuser */}
            <div className="flex border-b border-border-default">
              <button
                type="button"
                onClick={() => setActiveTab("approve")}
                className={`px-4 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                  activeTab === "approve"
                    ? "border-brand-primary text-brand-primary"
                    : "border-transparent text-text-tertiary hover:text-text-primary"
                }`}
              >
                {labels.tabApprove}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("reject")}
                className={`px-4 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                  activeTab === "reject"
                    ? "border-feedback-error-text text-feedback-error-text"
                    : "border-transparent text-text-tertiary hover:text-text-primary"
                }`}
              >
                {labels.tabReject}
              </button>
            </div>

            {/* Contenu de l'onglet Approbation */}
            {activeTab === "approve" && (
              <div className="flex flex-col gap-4 bg-surface-card p-4 rounded-xl border border-border-default">
                {request.requestedLevel === "account_ownership" ? (
                  <div className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="font-semibold text-text-primary">
                        {labels.observedHandleLabel}
                      </span>
                      <input
                        type="text"
                        value={observedHandle}
                        onChange={(e) => setObservedHandle(e.target.value)}
                        placeholder={labels.observedHandlePlaceholder}
                        className="px-3 py-2 bg-surface-page border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-primary"
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-xs">
                      <span className="font-semibold text-text-secondary">
                        {labels.observedRefLabel}
                      </span>
                      <input
                        type="text"
                        value={observedPlatformAccountRef}
                        onChange={(e) =>
                          setObservedPlatformAccountRef(e.target.value)
                        }
                        placeholder={labels.observedRefPlaceholder}
                        className="px-3 py-2 bg-surface-page border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-primary"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="font-semibold text-text-primary">
                        {labels.observedFollowersLabel}
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={observedFollowers}
                        onChange={(e) => setObservedFollowers(e.target.value)}
                        placeholder={labels.observedFollowersPlaceholder}
                        className="px-3 py-2 bg-surface-page border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-primary"
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="font-semibold text-text-primary">
                        {labels.observedPeriodStartLabel}
                      </span>
                      <input
                        type="date"
                        value={observedPeriodStart}
                        onChange={(e) => setObservedPeriodStart(e.target.value)}
                        className="px-3 py-2 bg-surface-page border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-primary"
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="font-semibold text-text-primary">
                        {labels.observedPeriodEndLabel}
                      </span>
                      <input
                        type="date"
                        value={observedPeriodEnd}
                        onChange={(e) => setObservedPeriodEnd(e.target.value)}
                        className="px-3 py-2 bg-surface-page border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-primary"
                      />
                    </label>

                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="font-semibold text-text-secondary">
                        {labels.observedEngagementLabel}
                      </span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={observedEngagement}
                        onChange={(e) => setObservedEngagement(e.target.value)}
                        placeholder="ex. 4.2"
                        className="px-3 py-2 bg-surface-page border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-primary"
                      />
                    </label>

                    <div className="sm:col-span-2 p-3 bg-surface-muted rounded-lg border border-border-subtle text-xs text-text-tertiary space-y-1">
                      <p>ⓘ {labels.audienceDisclaimer1}</p>
                      <p>ⓘ {labels.audienceDisclaimer2}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Contenu de l'onglet Refus */}
            {activeTab === "reject" && (
              <div className="flex flex-col gap-3 bg-surface-card p-4 rounded-xl border border-border-default text-xs">
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-text-primary">
                    {labels.rejectionReasonLabel}
                  </span>
                  <select
                    value={rejectionReasonCode}
                    onChange={(e) =>
                      setRejectionReasonCode(
                        e.target.value as VerificationRejectionReasonCode,
                      )
                    }
                    className="px-3 py-2 bg-surface-page border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:border-feedback-error-border"
                  >
                    {VERIFICATION_REJECTION_REASONS.map((code) => (
                      <option key={code} value={code}>
                        {VERIFICATION_REJECTION_MESSAGES[code]?.label || code}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Message transmis au créateur affiché avant décision (15 RG7, 17b §2.5 point 4) */}
                <div className="p-3 bg-surface-muted rounded-lg border border-border-subtle text-text-secondary">
                  <span className="text-text-primary font-semibold block mb-1">
                    {labels.rejectionMessageToCreator}
                  </span>
                  «{" "}
                  {
                    VERIFICATION_REJECTION_MESSAGES[rejectionReasonCode]
                      ?.messageFr
                  }{" "}
                  »
                </div>

                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-text-primary">
                    {labels.agentCommentLabel}
                  </span>
                  <textarea
                    rows={3}
                    value={agentComment}
                    onChange={(e) => setAgentComment(e.target.value)}
                    placeholder={labels.agentCommentPlaceholder}
                    className="px-3 py-2 bg-surface-page border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:border-feedback-error-border"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Pied d'actions */}
        <div className="p-6 border-t border-border-default bg-surface-card flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-surface-muted hover:bg-surface-hover text-text-secondary hover:text-text-primary border border-border-default rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            {labels.close}
          </button>

          <button
            type="button"
            disabled={submitting || isClaimedByOther}
            onClick={handleDecide}
            className={`px-6 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
              activeTab === "approve"
                ? "bg-brand-primary hover:bg-brand-accent text-surface-page"
                : "bg-feedback-error-text hover:bg-feedback-error-text/90 text-surface-page"
            }`}
          >
            {submitting
              ? labels.btnSaving
              : activeTab === "approve"
                ? request.requestedLevel === "account_ownership"
                  ? labels.btnApproveOwnership
                  : labels.btnApproveAudience
                : labels.btnReject}
          </button>
        </div>
      </div>
    </div>
  );
}

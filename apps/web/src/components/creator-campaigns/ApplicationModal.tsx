"use client";

import React, { useState } from "react";
import {
  type CampaignPublicCreatorView,
  type Introduction,
} from "@influx/contracts";
import { getCreatorCampaignLabels } from "./creator-campaign-labels";

export interface ApplicationModalProps {
  campaign: CampaignPublicCreatorView;
  locale: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (introduction: Introduction) => void;
}

export function ApplicationModal({
  campaign,
  locale,
  isOpen,
  onClose,
  onSuccess,
}: ApplicationModalProps) {
  const labels = getCreatorCampaignLabels(locale);
  const t = labels.applicationModal;

  // Par défaut, tous les livrables de la campagne sont pré-sélectionnés
  const deliverableOptions = campaign.deliverables.map(
    (del) => `${del.network} - ${del.format} (x${del.quantity})`,
  );

  const [selectedFormats, setSelectedFormats] =
    useState<string[]>(deliverableOptions);
  const [message, setMessage] = useState<string>("");
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [createdIntroduction, setCreatedIntroduction] =
    useState<Introduction | null>(null);

  if (!isOpen) return null;

  const toggleFormat = (formatStr: string) => {
    setSelectedFormats((prev) =>
      prev.includes(formatStr)
        ? prev.filter((f) => f !== formatStr)
        : [...prev, formatStr],
    );
  };

  const isMessageValid = message.trim().length >= 10;
  const canSubmit = !submitting && isMessageValid && termsAccepted;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/introductions/creator-apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          campaignId: campaign.id,
          message: message.trim(),
          proposedFormats:
            selectedFormats.length > 0 ? selectedFormats : undefined,
          termsAccepted: true,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        let errorMsg = data.message || `Erreur HTTP ${res.status}`;
        if (res.status === 401) {
          errorMsg = t.loginRequiredText;
        } else if (res.status === 409) {
          errorMsg = data.message || "Vous avez déjà postulé à cette campagne.";
        } else if (res.status === 429) {
          errorMsg =
            data.message || "Plafond de candidatures actives atteint (10 max).";
        }
        throw new Error(errorMsg);
      }

      const intro = data.introduction as Introduction;
      setCreatedIntroduction(intro);
      onSuccess(intro);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Une erreur est survenue lors de l'envoi.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-apply-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay-scrim backdrop-blur-xs"
    >
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto bg-surface-card border border-border-default rounded-xl shadow-2xl p-6 text-sm">
        {/* En-tête de la modale */}
        <div className="flex items-start justify-between pb-4 border-b border-border-subtle">
          <div className="space-y-1 pr-4">
            <h2
              id="modal-apply-title"
              className="text-base font-bold text-text-primary"
            >
              {createdIntroduction ? t.successTitle : t.title}
            </h2>
            <p className="text-xs text-text-secondary">
              {campaign.title} ·{" "}
              <span className="font-medium text-text-brand">
                {campaign.brandProfile.companyName}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary p-1.5 rounded-lg hover:bg-surface-raised cursor-pointer transition-colors"
            aria-label={t.closeButton}
          >
            ✕
          </button>
        </div>

        {/* Vue de Confirmation après Soumission réussie */}
        {createdIntroduction ? (
          <div className="py-6 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-feedback-success-bg border border-feedback-success-border text-feedback-success-text text-2xl font-bold">
              ✓
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-text-primary text-sm">
                {t.successSubtitle}
              </h3>
              <p className="text-xs font-mono font-medium text-text-brand bg-brand-subtle-bg border border-brand-subtle-border px-3 py-1 rounded-md inline-block">
                {t.referenceLabel(createdIntroduction.reference)}
              </p>
            </div>
            <div className="rounded-lg bg-surface-raised border border-border-subtle p-3.5 text-xs text-text-secondary text-left space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-text-primary">
                <span>⏱</span>
                <span>{t.slaNotice}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-full mt-4 rounded-lg bg-action-primary-bg px-4 py-2.5 text-xs font-semibold text-text-on-action hover:bg-action-primary-bg-hover shadow-sm cursor-pointer"
            >
              {t.closeButton}
            </button>
          </div>
        ) : (
          /* Formulaire de Candidature */
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            {/* Bannière de sous-titre SLA */}
            <div className="rounded-lg bg-brand-subtle-bg border border-brand-subtle-border p-3 text-xs text-text-secondary flex items-start gap-2">
              <span className="text-text-brand font-bold">ℹ</span>
              <span>{t.subtitle}</span>
            </div>

            {/* Message d'erreur éventuel */}
            {error && (
              <div className="rounded-lg bg-feedback-error-bg border border-feedback-error-border p-3 text-xs text-feedback-error-text space-y-1">
                <span className="font-semibold block">{t.errorPrefix}</span>
                <span>{error}</span>
              </div>
            )}

            {/* 1. Sélection des livrables proposés */}
            {deliverableOptions.length > 0 && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-text-primary">
                  {t.deliverablesSectionTitle}
                </label>
                <p className="text-[11px] text-text-tertiary">
                  {t.deliverablesSectionHelp}
                </p>
                <div className="space-y-1.5">
                  {deliverableOptions.map((opt) => {
                    const isChecked = selectedFormats.includes(opt);
                    return (
                      <label
                        key={opt}
                        className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-surface-raised border-border-strong text-text-primary"
                            : "bg-surface-card border-border-subtle text-text-tertiary hover:border-border-default"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleFormat(opt)}
                          className="h-3.5 w-3.5 rounded border-border-default text-action-primary-bg focus:ring-0 cursor-pointer"
                        />
                        <span className="capitalize">{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Note de motivation & proposition éditoriale */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="application-message"
                  className="block text-xs font-semibold text-text-primary"
                >
                  {t.messageSectionTitle}{" "}
                  <span className="text-feedback-error-text">*</span>
                </label>
                <span
                  className={`text-[11px] ${
                    message.length < 10
                      ? "text-text-tertiary"
                      : message.length > 1900
                        ? "text-feedback-warning-text font-medium"
                        : "text-feedback-success-text"
                  }`}
                >
                  {message.length} / 2000
                </span>
              </div>
              <p className="text-[11px] text-text-tertiary">
                {t.messageSectionHelp}
              </p>
              <textarea
                id="application-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={2000}
                placeholder={t.messagePlaceholder}
                rows={4}
                className="w-full bg-surface-raised border border-border-default rounded-lg p-3 text-text-primary text-xs focus:border-border-selected focus:outline-hidden resize-none leading-relaxed"
                required
              />
              {message.length > 0 && message.length < 10 && (
                <p className="text-[11px] text-feedback-error-text">
                  {t.messageMinLength}
                </p>
              )}
            </div>

            {/* 3. Avertissement anti-contournement (Arbitrage A9) */}
            <div className="rounded-lg bg-surface-raised border border-border-subtle p-3 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-text-secondary">
                <span>🛡️</span>
                <span>{t.antiBypassNoticeTitle}</span>
              </div>
              <p className="text-[11px] text-text-tertiary leading-relaxed">
                {t.antiBypassNoticeText}
              </p>
            </div>

            {/* 4. Acceptation des CGU & Conditions d'intermédiation */}
            <label className="flex items-start gap-2.5 pt-1 text-xs text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-border-default text-action-primary-bg focus:ring-0 cursor-pointer"
                required
              />
              <span className="leading-snug">{t.termsLabel}</span>
            </label>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-3.5 py-2 rounded-lg border border-border-default text-text-secondary hover:bg-surface-raised text-xs font-medium cursor-pointer transition-colors"
              >
                {t.cancelButton}
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                className="px-4 py-2 rounded-lg bg-action-primary-bg hover:bg-action-primary-bg-hover text-text-on-action text-xs font-semibold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                {submitting ? t.submittingButton : t.submitButton}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

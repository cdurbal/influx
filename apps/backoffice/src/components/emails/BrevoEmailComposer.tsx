"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  type BrevoTemplate,
  type BrevoAudienceSource,
  BREVO_AUDIENCE_SOURCES,
} from "@influx/contracts";
import { authFetch } from "@/lib/api-client";

export interface BrevoEmailComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onCampaignCreated: () => void;
}

export function BrevoEmailComposer({
  isOpen,
  onClose,
  onCampaignCreated,
}: BrevoEmailComposerProps) {
  const [templates, setTemplates] = useState<BrevoTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [previewLang, setPreviewLang] = useState<"fr" | "en">("fr");
  const [previewData, setPreviewData] = useState<{
    subject: string;
    body: string;
  } | null>(null);

  const [audienceSource, setAudienceSource] =
    useState<BrevoAudienceSource>("platform_contacts");
  const [targetRole, setTargetRole] = useState<
    "advertiser" | "creator" | "both"
  >("creator");

  // Prospect unitaire
  const [prospectEmail, setProspectEmail] = useState("");
  const [prospectFirstName, setProspectFirstName] = useState("");
  const [prospectCompany, setProspectCompany] = useState("");
  const [contactReason, setContactReason] = useState("");

  // Estimation
  const [estimation, setEstimation] = useState<{
    estimatedCount: number;
    excludedCount: number;
    description: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Charger les templates
  useEffect(() => {
    if (!isOpen) return;

    authFetch("/api/backoffice/emails/templates")
      .then((res) => res.json())
      .then((data) => {
        const list: BrevoTemplate[] = data.templates || [];
        setTemplates(list);
        if (list.length > 0 && !selectedTemplateId) {
          setSelectedTemplateId(list[0].id);
        }
      })
      .catch((err) => setError(err.message));
  }, [isOpen, selectedTemplateId]);

  // 2. Prévisualiser le template
  const updatePreview = useCallback(
    async (templateId: string, lang: "fr" | "en") => {
      if (!templateId) return;
      try {
        const res = await authFetch("/api/backoffice/emails/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ templateId, lang }),
        });
        if (res.ok) {
          const data = await res.json();
          setPreviewData(data);
        }
      } catch {
        // Ignorer
      }
    },
    [],
  );

  useEffect(() => {
    if (selectedTemplateId) {
      updatePreview(selectedTemplateId, previewLang);
    }
  }, [selectedTemplateId, previewLang, updatePreview]);

  // 3. Estimer l'audience
  const updateEstimation = useCallback(async () => {
    try {
      const payload: any = { audienceSource };
      if (audienceSource === "platform_contacts") {
        payload.targetRole = targetRole;
      }

      const res = await authFetch("/api/backoffice/emails/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setEstimation(data);
      }
    } catch {
      // Ignorer
    }
  }, [audienceSource, targetRole]);

  useEffect(() => {
    if (isOpen) {
      updateEstimation();
    }
  }, [isOpen, updateEstimation]);

  // 4. Soumettre l'envoi
  const handleSubmitSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);

    const payload: any = {
      templateId: selectedTemplateId,
      audienceSource,
      targetRole:
        audienceSource === "platform_contacts" ? targetRole : undefined,
    };

    if (audienceSource === "manual_prospect") {
      if (!contactReason || contactReason.length < 10) {
        setError(
          "Le motif de contact légitime doit contenir au moins 10 caractères.",
        );
        setSending(false);
        return;
      }
      payload.manualRecipient = {
        email: prospectEmail,
        firstName: prospectFirstName || undefined,
        company: prospectCompany || undefined,
        contactReason,
      };
    }

    try {
      const res = await authFetch("/api/backoffice/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message || "Erreur lors de la programmation de l'envoi",
        );
      }

      onCampaignCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-surface-panel border-l border-border-subtle h-full overflow-y-auto p-6 shadow-2xl flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-6">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Programmer un envoi d'e-mails Brevo
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Délai de grâce d'annulation de 15 minutes inclus (Doc 16).
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary p-2 rounded-md hover:bg-surface-elevated transition-colors text-sm"
            >
              Fermer ✕
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-feedback-error-bg text-feedback-error-text border border-feedback-error-border rounded-md text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmitSend} className="space-y-6">
            {/* Étape 1 : Sélection du modèle validé */}
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase mb-1">
                1. Modèle d'e-mail validé
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full bg-surface-page border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:outline-hidden"
              >
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    [{tpl.category.toUpperCase()}] {tpl.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Prévisualisation FR/EN */}
            {previewData && (
              <div className="bg-surface-elevated p-4 rounded-lg border border-border-subtle space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-secondary uppercase">
                    Aperçu du message
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setPreviewLang("fr")}
                      className={`px-2 py-0.5 rounded text-2xs font-semibold ${
                        previewLang === "fr"
                          ? "bg-brand-primary text-white"
                          : "bg-surface-page text-text-secondary border border-border-subtle"
                      }`}
                    >
                      FR
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewLang("en")}
                      className={`px-2 py-0.5 rounded text-2xs font-semibold ${
                        previewLang === "en"
                          ? "bg-brand-primary text-white"
                          : "bg-surface-page text-text-secondary border border-border-subtle"
                      }`}
                    >
                      EN
                    </button>
                  </div>
                </div>

                <div className="text-xs">
                  <span className="text-text-secondary font-medium">
                    Objet :{" "}
                  </span>
                  <span className="text-text-primary font-semibold">
                    {previewData.subject}
                  </span>
                </div>
                <div className="text-2xs text-text-primary whitespace-pre-line font-sans bg-surface-page p-3 rounded border border-border-subtle mt-2">
                  {previewData.body}
                </div>
              </div>
            )}

            {/* Étape 2 : Choix de l'audience encadrée */}
            <div>
              <label className="block text-xs font-bold text-text-secondary uppercase mb-2">
                2. Source d'audience encadrée
              </label>
              <div className="grid grid-cols-3 gap-2">
                {BREVO_AUDIENCE_SOURCES.map((source) => (
                  <button
                    key={source}
                    type="button"
                    onClick={() => setAudienceSource(source)}
                    className={`p-2.5 rounded-md border text-xs font-medium transition-all text-left ${
                      audienceSource === source
                        ? "bg-brand-secondary/20 border-brand-primary text-brand-primary font-semibold"
                        : "bg-surface-page border-border-subtle text-text-secondary hover:bg-surface-hover"
                    }`}
                  >
                    {source === "platform_contacts" && "Contacts plateforme"}
                    {source === "brevo_segments" && "Segments Brevo"}
                    {source === "manual_prospect" && "Prospect unitaire"}
                  </button>
                ))}
              </div>
            </div>

            {/* Options selon la source */}
            {audienceSource === "platform_contacts" && (
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Ciblage par rôle
                </label>
                <select
                  value={targetRole}
                  onChange={(e) =>
                    setTargetRole(
                      e.target.value as "advertiser" | "creator" | "both",
                    )
                  }
                  className="w-full bg-surface-page border border-border-subtle rounded-md px-3 py-1.5 text-xs text-text-primary"
                >
                  <option value="creator">Créateurs uniquement</option>
                  <option value="advertiser">Annonceurs uniquement</option>
                  <option value="both">Tous les membres consentants</option>
                </select>
              </div>
            )}

            {audienceSource === "manual_prospect" && (
              <div className="bg-surface-elevated p-4 rounded-lg border border-border-subtle space-y-3">
                <div className="text-xs font-bold text-text-primary">
                  Informations du prospect
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="email"
                    required
                    placeholder="Email professionnel *"
                    value={prospectEmail}
                    onChange={(e) => setProspectEmail(e.target.value)}
                    className="bg-surface-page border border-border-subtle rounded px-2.5 py-1 text-xs text-text-primary"
                  />
                  <input
                    type="text"
                    placeholder="Entreprise"
                    value={prospectCompany}
                    onChange={(e) => setProspectCompany(e.target.value)}
                    className="bg-surface-page border border-border-subtle rounded px-2.5 py-1 text-xs text-text-primary"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Prénom du contact"
                  value={prospectFirstName}
                  onChange={(e) => setProspectFirstName(e.target.value)}
                  className="w-full bg-surface-page border border-border-subtle rounded px-2.5 py-1 text-xs text-text-primary"
                />
                <div>
                  <label className="block text-2xs text-text-secondary mb-0.5">
                    Motif légitime de contact (RGPD, min 10 car.) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="ex: Sélection pour campagne Luxe Paris..."
                    value={contactReason}
                    onChange={(e) => setContactReason(e.target.value)}
                    className="w-full bg-surface-page border border-border-subtle rounded px-2.5 py-1 text-xs text-text-primary"
                  />
                </div>
              </div>
            )}

            {/* Étape 3 : Estimation et garde-fous */}
            {estimation && (
              <div className="p-4 bg-surface-elevated border border-border-subtle rounded-lg flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-text-primary">
                    Destinataires éligibles : {estimation.estimatedCount}
                  </div>
                  <div className="text-2xs text-text-secondary mt-0.5">
                    {estimation.description}
                  </div>
                </div>
                {estimation.excludedCount > 0 && (
                  <span className="text-2xs text-text-secondary bg-surface-page px-2 py-1 rounded border border-border-subtle">
                    {estimation.excludedCount} exclu(s) (non consentants)
                  </span>
                )}
              </div>
            )}

            {/* Avertissement délai de grâce 15 minutes */}
            <div className="p-3 bg-feedback-info-bg/50 border border-feedback-info-border text-feedback-info-text rounded-md text-xs">
              <span className="font-bold">
                ⏱ Délai de grâce de 15 minutes :
              </span>{" "}
              L'envoi sera différé de 15 minutes. Vous ou n'importe quel agent
              pourrez annuler cet envoi à tout moment depuis le tableau de bord
              avant son départ définitif.
            </div>

            {/* Boutons d'action */}
            <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-surface-elevated hover:bg-surface-hover border border-border-subtle rounded-md text-xs font-medium text-text-primary transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={sending}
                className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-semibold rounded-md transition-colors disabled:opacity-50"
              >
                {sending ? "Programmation..." : "Programmer l'envoi Brevo"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

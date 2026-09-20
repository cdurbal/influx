"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  type Campaign,
  type CampaignType,
  type CompensationNature,
  type UsageRight,
  type UsageDuration,
  type ExclusivityBand,
  type ContentValidationDelay,
  type ProductShippingCost,
  type PriceBand,
  type CandidateElement,
  type AgeBand,
  type Language,
  type Currency,
  CAMPAIGN_TYPES,
  COMPENSATION_NATURES,
  USAGE_RIGHTS,
  USAGE_DURATIONS,
  CONTENT_VALIDATION_DELAYS,
  EXCLUSIVITY_BANDS,
  PRODUCT_SHIPPING_COSTS,
  CANDIDATE_ELEMENTS,
  isSensitiveSector,
  isDeliverableFormatValid,
  validateCampaignDates,
  detectForbiddenPatternsInText,
  calculateCampaignCompleteness,
} from "@influx/contracts";
import { inputClassName, RequiredMark } from "@/components/ui/form-controls";
import { getCampaignLabels } from "./campaign-labels";
import { CampaignPreviewModal } from "./CampaignPreviewModal";

const inputClass = inputClassName(false);
const textareaClass =
  "w-full rounded-md border-(length:--border-width-thin) border-border-strong bg-surface-page p-3 text-sm text-text-primary focus:outline-none";

function FormRequiredMark() {
  return <RequiredMark mark="*" />;
}

export interface CampaignFormProps {
  initialCampaign?: Partial<Campaign>;
  locale?: string;
}

const CATEGORY_OPTIONS = [
  { value: "beaute_cosmetiques", label: "Beauté, Cosmétiques & Soins" },
  { value: "mode_accessoires", label: "Mode, Prêt-à-porter & Accessoires" },
  { value: "tech_gadgets", label: "High-Tech, Électronique & Gaming" },
  { value: "sport_fitness", label: "Sport, Fitness & Outdoor" },
  { value: "alimentation_boissons", label: "Alimentation, Boissons & Food" },
  { value: "maison_deco", label: "Maison, Décoration & Bricolage" },
  { value: "voyage_tourisme", label: "Voyage, Hôtellerie & Tourisme" },
  { value: "services_b2b", label: "Services, SaaS & B2B" },
  { value: "sante", label: "Santé, Compléments & Bien-être (Sensible ⚠)" },
  { value: "cbd", label: "CBD & Chanvre (Sensible ⚠)" },
  { value: "finance", label: "Banque, Épargne & Finance (Sensible ⚠)" },
  { value: "crypto", label: "Crypto & Web3 (Sensible ⚠)" },
  { value: "alcool", label: "Alcools, Vins & Spiritueux (Sensible ⚠)" },
  { value: "jeux_argent", label: "Jeux d'argent & Paris (Sensible ⚠)" },
  { value: "autre", label: "Autre catégorie" },
];

const NETWORK_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "twitch", label: "Twitch" },
  { value: "podcast", label: "Podcast" },
];

const FORMAT_OPTIONS = [
  { value: "post", label: "Post image dédié" },
  { value: "story", label: "Story (ou séquence)" },
  { value: "reel", label: "Reel / Vidéo courte" },
  { value: "carousel", label: "Carrousel" },
  { value: "video_tiktok", label: "Vidéo TikTok" },
  { value: "video_dedicated", label: "Vidéo longue dédiée" },
  { value: "short_video", label: "Short / Format vertical" },
  { value: "integration", label: "Intégration sponsorisée" },
  { value: "article", label: "Article / Newsletter" },
  { value: "live_stream", label: "Live stream" },
  { value: "episode_dedie", label: "Épisode de podcast dédié" },
  { value: "pre_roll", label: "Mention pré-roll" },
];

const PRODUCT_PRICE_BANDS: { value: PriceBand; label: string }[] = [
  { value: "lt_250", label: "Moins de 250 €" },
  { value: "250_500", label: "250 € à 500 €" },
  { value: "500_1000", label: "500 € à 1 000 €" },
  { value: "1000_2000", label: "1 000 € à 2 000 €" },
  { value: "2000_5000", label: "2 000 € à 5 000 €" },
  { value: "5000_10000", label: "5 000 € à 10 000 €" },
  { value: "plus_10000", label: "Plus de 10 000 €" },
];

const TOPIC_OPTIONS = [
  { value: "lifestyle", label: "Lifestyle" },
  { value: "mode", label: "Mode" },
  { value: "beaute", label: "Beauté" },
  { value: "tech", label: "Tech" },
  { value: "gaming", label: "Gaming" },
  { value: "sport", label: "Sport" },
  { value: "food", label: "Food" },
  { value: "voyage", label: "Voyage" },
  { value: "business", label: "Business" },
];

export function CampaignForm({
  initialCampaign,
  locale = "fr",
}: CampaignFormProps) {
  const router = useRouter();
  const t = getCampaignLabels(locale);

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [campaignId, setCampaignId] = useState<string | null>(
    initialCampaign?.id || null,
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">(
    "idle",
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // État du formulaire
  const [form, setForm] = useState({
    title: initialCampaign?.title || "",
    campaignType: (initialCampaign?.campaignType ||
      "placement_produit") as CampaignType,
    publicSummary: initialCampaign?.publicSummary || "",
    detailedBrief: initialCampaign?.detailedBrief || "",
    internalReference: initialCampaign?.internalReference || "",

    productName: initialCampaign?.productName || "",
    productCategory: initialCampaign?.productCategory || "beaute_cosmetiques",
    keyMessages: initialCampaign?.keyMessages || [""],
    prohibitions: initialCampaign?.prohibitions || "",
    productShipped: initialCampaign?.productShipped ?? false,
    productValueBand: (initialCampaign?.productValueBand ||
      "lt_250") as PriceBand,
    productCurrency: (initialCampaign?.productCurrency || "EUR") as Currency,
    productKept: initialCampaign?.productKept ?? true,
    productShippingCost: (initialCampaign?.productShippingCost ||
      "marque") as ProductShippingCost,

    deliverables: initialCampaign?.deliverables || [
      { network: "instagram", format: "post", quantity: 1 },
    ],
    usageRights: (initialCampaign?.usageRights || "aucun") as UsageRight,
    usageDuration: (initialCampaign?.usageDuration ||
      "1_mois") as UsageDuration,
    usageTerritory: initialCampaign?.usageTerritory || ("mondial" as const),
    exclusivity: (initialCampaign?.exclusivity || "none") as ExclusivityBand,
    contentValidationDelay: (initialCampaign?.contentValidationDelay ||
      "5j") as ContentValidationDelay,

    targetCountries: (initialCampaign?.targetCountries || ["FR"]) as string[],
    targetLanguages: (initialCampaign?.targetLanguages || ["fr"]) as Language[],
    targetTopics: (initialCampaign?.targetTopics || ["lifestyle"]) as string[],
    targetAudienceBands: initialCampaign?.targetAudienceBands || [],
    targetAgeBands: (initialCampaign?.targetAgeBands || ["25-34"]) as AgeBand[],
    targetGender: initialCampaign?.targetGender || null,

    minCompensationMinor:
      initialCampaign?.minCompensationMinor != null
        ? Math.round(initialCampaign.minCompensationMinor / 100)
        : 500,
    maxCompensationMinor:
      initialCampaign?.maxCompensationMinor != null
        ? Math.round(initialCampaign.maxCompensationMinor / 100)
        : 1000,
    currency: (initialCampaign?.currency || "EUR") as Currency,
    compensationNature: (initialCampaign?.compensationNature ||
      "numeraire") as CompensationNature,
    creatorsCount: initialCampaign?.creatorsCount || 3,
    totalBudgetMinor:
      initialCampaign?.totalBudgetMinor != null
        ? Math.round(initialCampaign.totalBudgetMinor / 100)
        : "",

    applicationDeadline:
      initialCampaign?.applicationDeadline ||
      new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
    deliveryDeadline: initialCampaign?.deliveryDeadline || "",
    startsOn:
      initialCampaign?.startsOn ||
      new Date(Date.now() + 25 * 86400000).toISOString().split("T")[0],
    endsOn:
      initialCampaign?.endsOn ||
      new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0],

    requestedCandidateElements: initialCampaign?.requestedCandidateElements || [
      "message_motivation",
    ],
    applicationCap: initialCampaign?.applicationCap || "",
    verifiedOnly: initialCampaign?.verifiedOnly || false,
    internalNotes: initialCampaign?.internalNotes || "",
    sensitiveDeclarationAccepted: false,
  });

  const isSensitive = isSensitiveSector(form.productCategory);

  // Détection des patterns interdits dans les textes libres
  const textDetections = useMemo(() => {
    const fullText = [
      form.title,
      form.publicSummary,
      form.detailedBrief,
      form.productName,
      ...form.keyMessages,
      form.prohibitions,
    ].join(" ");
    return detectForbiddenPatternsInText(fullText);
  }, [
    form.title,
    form.publicSummary,
    form.detailedBrief,
    form.productName,
    form.keyMessages,
    form.prohibitions,
  ]);

  // Sauvegarde automatique du brouillon (RG108)
  const saveDraft = useCallback(
    async (silent = true) => {
      if (!silent) setSaveStatus("saving");
      try {
        const payload = {
          title: form.title.trim() || undefined,
          campaignType: form.campaignType,
          publicSummary: form.publicSummary.trim() || undefined,
          detailedBrief: form.detailedBrief.trim() || undefined,
          internalReference: form.internalReference.trim() || null,

          productName: form.productName.trim() || undefined,
          productCategory: form.productCategory,
          keyMessages: form.keyMessages.filter((m) => m.trim().length > 0),
          prohibitions: form.prohibitions.trim() || null,
          productShipped: form.productShipped,
          productValueBand: form.productShipped ? form.productValueBand : null,
          productCurrency: form.productCurrency,
          productKept: form.productShipped ? form.productKept : null,
          productShippingCost: form.productShipped
            ? form.productShippingCost
            : null,

          deliverables: form.deliverables,
          usageRights: form.usageRights,
          usageDuration:
            form.usageRights !== "aucun" ? form.usageDuration : null,
          usageTerritory:
            form.usageRights !== "aucun" ? form.usageTerritory : null,
          exclusivity: form.exclusivity,
          contentValidationDelay: form.contentValidationDelay,

          targetCountries: form.targetCountries,
          targetLanguages: form.targetLanguages,
          targetTopics: form.targetTopics,
          targetAudienceBands: form.targetAudienceBands,
          targetAgeBands: form.targetAgeBands,
          targetGender: form.targetGender,

          minCompensationMinor: form.minCompensationMinor
            ? Number(form.minCompensationMinor) * 100
            : null,
          maxCompensationMinor: form.maxCompensationMinor
            ? Number(form.maxCompensationMinor) * 100
            : null,
          currency: form.currency,
          compensationNature: form.compensationNature,
          creatorsCount: Number(form.creatorsCount) || 1,
          totalBudgetMinor: form.totalBudgetMinor
            ? Number(form.totalBudgetMinor) * 100
            : null,

          applicationDeadline: form.applicationDeadline || undefined,
          deliveryDeadline: form.deliveryDeadline || null,
          startsOn: form.startsOn || undefined,
          endsOn: form.endsOn || undefined,

          requestedCandidateElements: form.requestedCandidateElements,
          applicationCap: form.applicationCap
            ? Number(form.applicationCap)
            : null,
          verifiedOnly: form.verifiedOnly,
          internalNotes: form.internalNotes.trim() || undefined,
        };

        const endpoint = campaignId
          ? `/api/campaigns/${campaignId}`
          : "/api/campaigns/draft";
        const method = campaignId ? "PUT" : "POST";

        const res = await fetch(endpoint, {
          method,
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.campaign?.id && !campaignId) {
            setCampaignId(json.campaign.id);
          }
          setSaveStatus("saved");
        }
      } catch (err) {
        console.warn("Autosave draft non bloquant:", err);
      }
    },
    [form, campaignId],
  );

  // Debounced autosave à chaque modification
  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, [saveDraft]);

  // Contrôle de complétude
  const completeness = useMemo(() => {
    const candidateCampaign: Partial<Campaign> = {
      title: form.title,
      campaignType: form.campaignType,
      publicSummary: form.publicSummary,
      detailedBrief: form.detailedBrief,
      productName: form.productName,
      productCategory: form.productCategory,
      productShipped: form.productShipped,
      productValueBand: form.productShipped ? form.productValueBand : null,
      productKept: form.productShipped ? form.productKept : null,
      productShippingCost: form.productShipped
        ? form.productShippingCost
        : null,
      deliverables: form.deliverables,
      usageRights: form.usageRights,
      usageDuration: form.usageRights !== "aucun" ? form.usageDuration : null,
      usageTerritory: form.usageRights !== "aucun" ? form.usageTerritory : null,
      exclusivity: form.exclusivity,
      contentValidationDelay: form.contentValidationDelay,
      targetCountries: form.targetCountries,
      targetLanguages: form.targetLanguages,
      targetTopics: form.targetTopics,
      minCompensationMinor: form.minCompensationMinor
        ? Number(form.minCompensationMinor) * 100
        : undefined,
      maxCompensationMinor: form.maxCompensationMinor
        ? Number(form.maxCompensationMinor) * 100
        : undefined,
      currency: form.currency,
      compensationNature: form.compensationNature,
      creatorsCount: Number(form.creatorsCount) || 1,
      applicationDeadline: form.applicationDeadline,
      startsOn: form.startsOn,
      endsOn: form.endsOn,
    };

    return calculateCampaignCompleteness(candidateCampaign, true);
  }, [form]);

  // Soumission pour modération
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Vérification des secteurs sensibles (RG85)
    if (isSensitive && !form.sensitiveDeclarationAccepted) {
      setSubmitError(t.step5.sensitiveDeclarationRequired);
      return;
    }

    // Vérification UGC droits d'usage (RG43)
    if (form.campaignType === "ugc" && form.usageRights === "aucun") {
      setSubmitError(t.step2.warningUgcRequiresRights);
      return;
    }

    // Validation des dates (RG70, RG74)
    const dateVal = validateCampaignDates({
      applicationDeadline: form.applicationDeadline,
      deliveryDeadline: form.deliveryDeadline || null,
      startsOn: form.startsOn,
      endsOn: form.endsOn,
    });
    if (!dateVal.valid) {
      setSubmitError(dateVal.error || "Dates incohérentes");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Sauvegarde explicite
      await saveDraft(false);

      if (!campaignId) {
        throw new Error("Campagne non initialisée");
      }

      // 2. Appel submit
      const res = await fetch(`/api/campaigns/${campaignId}/submit`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || "Erreur lors de la soumission");
      }

      // 3. Redirection vers la liste
      router.push(`/${locale}/advertiser/campaigns`);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Erreur de soumission",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Gestion des livrables
  const handleAddDeliverable = () => {
    if (form.deliverables.length >= 10) return;
    setForm((prev) => ({
      ...prev,
      deliverables: [
        ...prev.deliverables,
        { network: "instagram", format: "story", quantity: 1 },
      ],
    }));
  };

  const handleRemoveDeliverable = (index: number) => {
    setForm((prev) => ({
      ...prev,
      deliverables: prev.deliverables.filter((_, i) => i !== index),
    }));
  };

  const handleDeliverableChange = (
    index: number,
    field: "network" | "format" | "quantity",
    value: string | number,
  ) => {
    setForm((prev) => {
      const current = prev.deliverables[index];
      if (!current) return prev;
      const updated = [...prev.deliverables];
      updated[index] = { ...current, [field]: value };
      return { ...prev, deliverables: updated };
    });
  };

  // Gestion des messages clés
  const handleAddKeyMessage = () => {
    if (form.keyMessages.length >= 5) return;
    setForm((prev) => ({ ...prev, keyMessages: [...prev.keyMessages, ""] }));
  };

  const handleRemoveKeyMessage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      keyMessages: prev.keyMessages.filter((_, i) => i !== index),
    }));
  };

  const handleKeyMessageChange = (index: number, text: string) => {
    setForm((prev) => {
      const updated = [...prev.keyMessages];
      updated[index] = text;
      return { ...prev, keyMessages: updated };
    });
  };

  return (
    <div className="space-y-6">
      {/* Barre de navigation des 5 étapes (17 §4.3) */}
      <div className="bg-surface-card p-4 rounded-xl border border-border-default shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {([1, 2, 3, 4, 5] as const).map((step) => {
            const isActive = currentStep === step;
            const stepLabel =
              step === 1
                ? t.steps.step1
                : step === 2
                  ? t.steps.step2
                  : step === 3
                    ? t.steps.step3
                    : step === 4
                      ? t.steps.step4
                      : t.steps.step5;

            return (
              <button
                key={step}
                type="button"
                onClick={() => setCurrentStep(step)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-brand-primary text-surface-page shadow-xs"
                    : "bg-surface-page text-text-secondary border border-border-default hover:text-text-primary hover:bg-surface-hover"
                }`}
              >
                {stepLabel}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-xs">
          {saveStatus === "saved" && (
            <span className="text-text-tertiary">✓ Brouillon sauvegardé</span>
          )}
          {saveStatus === "saving" && (
            <span className="text-brand-primary">Sauvegarde...</span>
          )}
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-surface-page border border-border-default text-text-primary font-medium hover:bg-surface-hover transition-colors"
          >
            👁 {t.common.previewCreatorButton}
          </button>
        </div>
      </div>

      {/* Avertissement détection anti-coordonnées (RG21, RG23) */}
      {textDetections.details.length > 0 && (
        <div className="p-4 rounded-xl bg-feedback-warning-bg border border-feedback-warning-border text-feedback-warning-text text-xs space-y-1">
          <span className="font-bold block">
            ⚠ Attention à la conformité de vos textes :
          </span>
          <ul className="list-disc pl-5 space-y-0.5">
            {textDetections.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Formulaire multi-étapes */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ÉTAPE 1 : L'OFFRE (Blocs 1 & 2 + Référence interne) */}
        {currentStep === 1 && (
          <div className="p-6 rounded-2xl bg-surface-card border border-border-default space-y-6">
            <div className="border-b border-border-default pb-4">
              <h2 className="text-lg font-extrabold text-text-primary">
                {t.stepTitles.step1}
              </h2>
              <p className="text-xs text-text-tertiary mt-1">
                Définissez le titre, le résumé, le brief et le produit concerné.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2">
                <label
                  htmlFor="campaignTitle"
                  className="block text-xs font-semibold text-text-primary"
                >
                  {t.step1.titleLabel} <FormRequiredMark />
                </label>
                <input
                  id="campaignTitle"
                  type="text"
                  required
                  maxLength={140}
                  placeholder={t.step1.titlePlaceholder}
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={inputClass}
                />
                <span className="text-[11px] text-text-tertiary">
                  {form.title.length}/140 {t.common.characters} ·{" "}
                  {t.step1.titleHint}
                </span>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="campaignType"
                  className="block text-xs font-semibold text-text-primary"
                >
                  {t.step1.typeLabel} <FormRequiredMark />
                </label>
                <select
                  id="campaignType"
                  value={form.campaignType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      campaignType: e.target.value as CampaignType,
                    })
                  }
                  className={inputClass}
                >
                  {CAMPAIGN_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type === "placement_produit"
                        ? "Placement de produit"
                        : type === "ugc"
                          ? "Contenu livré à la marque (UGC)"
                          : type === "test_produit"
                            ? "Test & Avis produit"
                            : type === "ambassadeur"
                              ? "Programme Ambassadeur"
                              : type === "concours"
                                ? "Jeu-concours"
                                : type === "evenement"
                                  ? "Événementiel"
                                  : "Affiliation"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="productCategory"
                  className="block text-xs font-semibold text-text-primary"
                >
                  {t.step1.productCategoryLabel} <FormRequiredMark />
                </label>
                <select
                  id="productCategory"
                  value={form.productCategory}
                  onChange={(e) =>
                    setForm({ ...form, productCategory: e.target.value })
                  }
                  className={inputClass}
                >
                  {CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label
                  htmlFor="productName"
                  className="block text-xs font-semibold text-text-primary"
                >
                  {t.step1.productNameLabel} <FormRequiredMark />
                </label>
                <input
                  id="productName"
                  type="text"
                  required
                  maxLength={600}
                  placeholder={t.step1.productNamePlaceholder}
                  value={form.productName}
                  onChange={(e) =>
                    setForm({ ...form, productName: e.target.value })
                  }
                  className={inputClass}
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label
                  htmlFor="publicSummary"
                  className="block text-xs font-semibold text-text-primary"
                >
                  {t.step1.summaryLabel} <FormRequiredMark />
                </label>
                <textarea
                  id="publicSummary"
                  rows={3}
                  required
                  maxLength={400}
                  placeholder={t.step1.summaryPlaceholder}
                  value={form.publicSummary}
                  onChange={(e) =>
                    setForm({ ...form, publicSummary: e.target.value })
                  }
                  className={textareaClass}
                />
                <span className="text-[11px] text-text-tertiary">
                  {form.publicSummary.length}/400 {t.common.characters} ·{" "}
                  {t.step1.summaryHint}
                </span>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label
                  htmlFor="detailedBrief"
                  className="block text-xs font-semibold text-text-primary"
                >
                  {t.step1.briefLabel} <FormRequiredMark />
                </label>
                <textarea
                  id="detailedBrief"
                  rows={6}
                  required
                  maxLength={4000}
                  placeholder={t.step1.briefPlaceholder}
                  value={form.detailedBrief}
                  onChange={(e) =>
                    setForm({ ...form, detailedBrief: e.target.value })
                  }
                  className={textareaClass}
                />
                <span className="text-[11px] text-text-tertiary">
                  {form.detailedBrief.length}/4000 {t.common.characters} ·{" "}
                  {t.step1.briefHint}
                </span>
              </div>

              {/* Messages clés */}
              <div className="space-y-2 md:col-span-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-text-primary">
                    {t.step1.keyMessagesLabel}
                  </label>
                  {form.keyMessages.length < 5 && (
                    <button
                      type="button"
                      onClick={handleAddKeyMessage}
                      className="text-xs text-brand-primary hover:underline font-bold"
                    >
                      {t.step1.addKeyMessage}
                    </button>
                  )}
                </div>
                {form.keyMessages.map((msg, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={200}
                      placeholder={t.step1.keyMessagesPlaceholder}
                      value={msg}
                      onChange={(e) =>
                        handleKeyMessageChange(i, e.target.value)
                      }
                      className={inputClass}
                    />
                    {form.keyMessages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyMessage(i)}
                        className="text-xs text-feedback-error-text px-2 py-1 rounded hover:bg-surface-hover"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Interdits */}
              <div className="space-y-1 md:col-span-2">
                <label
                  htmlFor="prohibitions"
                  className="block text-xs font-semibold text-text-primary"
                >
                  {t.step1.prohibitionsLabel}
                </label>
                <textarea
                  id="prohibitions"
                  rows={2}
                  maxLength={1000}
                  placeholder={t.step1.prohibitionsPlaceholder}
                  value={form.prohibitions}
                  onChange={(e) =>
                    setForm({ ...form, prohibitions: e.target.value })
                  }
                  className={textareaClass}
                />
                <span className="text-[11px] text-text-tertiary">
                  {t.step1.prohibitionsHint}
                </span>
              </div>

              {/* Produit expédié ? */}
              <div className="space-y-2 md:col-span-2 pt-3 border-t border-border-default">
                <label className="block text-xs font-semibold text-text-primary">
                  {t.step1.productShippedLabel} <FormRequiredMark />
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                    <input
                      type="radio"
                      name="productShipped"
                      checked={form.productShipped === true}
                      onChange={() =>
                        setForm({ ...form, productShipped: true })
                      }
                    />
                    <span>{t.step1.productShippedYes}</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                    <input
                      type="radio"
                      name="productShipped"
                      checked={form.productShipped === false}
                      onChange={() =>
                        setForm({ ...form, productShipped: false })
                      }
                    />
                    <span>{t.step1.productShippedNo}</span>
                  </label>
                </div>
              </div>

              {/* Champs conditionnels si produit expédié */}
              {form.productShipped && (
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-xl bg-surface-page border border-border-default">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-text-secondary">
                      {t.step1.productValueBandLabel}
                    </label>
                    <select
                      value={form.productValueBand}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          productValueBand: e.target.value as PriceBand,
                        })
                      }
                      className={inputClass}
                    >
                      {PRODUCT_PRICE_BANDS.map((pb) => (
                        <option key={pb.value} value={pb.value}>
                          {pb.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-text-secondary">
                      {t.step1.productKeptLabel}
                    </label>
                    <select
                      value={form.productKept ? "true" : "false"}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          productKept: e.target.value === "true",
                        })
                      }
                      className={inputClass}
                    >
                      <option value="true">{t.step1.productKeptYes}</option>
                      <option value="false">{t.step1.productKeptNo}</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-text-secondary">
                      {t.step1.productShippingCostLabel}
                    </label>
                    <select
                      value={form.productShippingCost}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          productShippingCost: e.target
                            .value as ProductShippingCost,
                        })
                      }
                      className={inputClass}
                    >
                      {PRODUCT_SHIPPING_COSTS.map((cost) => (
                        <option key={cost} value={cost}>
                          {cost === "marque"
                            ? "À la charge de la marque"
                            : "À la charge du créateur"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Bloc interne : Référence */}
              <div className="md:col-span-2 p-4 rounded-xl bg-surface-muted/60 border border-border-subtle space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary block">
                  {t.common.internalBlockTitle}
                </span>
                <label
                  htmlFor="internalRef"
                  className="block text-xs font-semibold text-text-secondary"
                >
                  {t.step1.internalRefLabel}
                </label>
                <input
                  id="internalRef"
                  type="text"
                  maxLength={40}
                  placeholder={t.step1.internalRefPlaceholder}
                  value={form.internalReference}
                  onChange={(e) =>
                    setForm({ ...form, internalReference: e.target.value })
                  }
                  className={inputClass}
                />
                <span className="text-[11px] text-text-tertiary">
                  {t.step1.internalRefHint}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ÉTAPE 2 : LE TRAVAIL ATTENDU (Livrables, Droits, Exclusivité) */}
        {currentStep === 2 && (
          <div className="p-6 rounded-2xl bg-surface-card border border-border-default space-y-6">
            <div className="border-b border-border-default pb-4">
              <h2 className="text-lg font-extrabold text-text-primary">
                {t.stepTitles.step2}
              </h2>
              <p className="text-xs text-text-tertiary mt-1">
                {t.step2.deliverablesSubtitle}
              </p>
            </div>

            {/* Lignes de livrables */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  {t.step2.deliverablesTitle}
                </span>
                {form.deliverables.length < 10 && (
                  <button
                    type="button"
                    onClick={handleAddDeliverable}
                    className="text-xs text-brand-primary hover:underline font-bold"
                  >
                    {t.step2.addDeliverable}
                  </button>
                )}
              </div>

              {form.deliverables.map((deliv, index) => (
                <div
                  key={index}
                  className="p-3.5 rounded-xl bg-surface-page border border-border-default grid grid-cols-1 sm:grid-cols-3 gap-3 items-center"
                >
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-text-tertiary">
                      {t.step2.networkLabel}
                    </label>
                    <select
                      value={deliv.network}
                      onChange={(e) =>
                        handleDeliverableChange(
                          index,
                          "network",
                          e.target.value,
                        )
                      }
                      className={inputClass}
                    >
                      {NETWORK_OPTIONS.map((net) => (
                        <option key={net.value} value={net.value}>
                          {net.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-text-tertiary">
                      {t.step2.formatLabel}
                    </label>
                    <select
                      value={deliv.format}
                      onChange={(e) =>
                        handleDeliverableChange(index, "format", e.target.value)
                      }
                      className={inputClass}
                    >
                      {FORMAT_OPTIONS.filter((f) =>
                        isDeliverableFormatValid(deliv.network, f.value),
                      ).map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1 flex items-end gap-2">
                    <div className="flex-1">
                      <label className="block text-[11px] font-semibold text-text-tertiary">
                        {t.step2.quantityLabel}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={deliv.quantity}
                        onChange={(e) =>
                          handleDeliverableChange(
                            index,
                            "quantity",
                            Number(e.target.value) || 1,
                          )
                        }
                        className={inputClass}
                      />
                    </div>
                    {form.deliverables.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDeliverable(index)}
                        className="text-xs text-feedback-error-text px-2 py-2 rounded hover:bg-surface-hover"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Droits d'usage & Conditions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border-default">
              <div className="space-y-1 md:col-span-2">
                <label className="block text-xs font-semibold text-text-primary">
                  {t.step2.usageRightsLabel} <FormRequiredMark />
                </label>
                <select
                  value={form.usageRights}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      usageRights: e.target.value as UsageRight,
                    })
                  }
                  className={inputClass}
                >
                  {USAGE_RIGHTS.map((ur) => (
                    <option key={ur} value={ur}>
                      {ur === "aucun"
                        ? "Aucun (diffusion sur le compte du créateur uniquement)"
                        : ur === "repost_organique"
                          ? "Repost organique (republication sans budget publicitaire)"
                          : ur === "whitelisting"
                            ? "Whitelisting publicitaire (depuis le compte créateur)"
                            : "Achat média (publicité sur les supports de la marque)"}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-text-tertiary">
                  {t.step2.usageRightsHint}
                </span>
              </div>

              {/* Si droits !== aucun */}
              {form.usageRights !== "aucun" && (
                <>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-text-primary">
                      {t.step2.usageDurationLabel} <FormRequiredMark />
                    </label>
                    <select
                      value={form.usageDuration}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          usageDuration: e.target.value as UsageDuration,
                        })
                      }
                      className={inputClass}
                    >
                      {USAGE_DURATIONS.map((ud) => (
                        <option key={ud} value={ud}>
                          {ud === "1_mois"
                            ? "1 mois"
                            : ud === "3_mois"
                              ? "3 mois"
                              : ud === "6_mois"
                                ? "6 mois"
                                : ud === "12_mois"
                                  ? "12 mois"
                                  : "Illimitée"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-text-primary">
                      {t.step2.usageTerritoryLabel} <FormRequiredMark />
                    </label>
                    <select
                      value={
                        form.usageTerritory === "mondial"
                          ? "mondial"
                          : "selected"
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          usageTerritory:
                            e.target.value === "mondial" ? "mondial" : ["FR"],
                        })
                      }
                      className={inputClass}
                    >
                      <option value="mondial">
                        {t.step2.territoryWorldwide}
                      </option>
                      <option value="selected">
                        {t.step2.territorySelected}
                      </option>
                    </select>
                  </div>
                </>
              )}

              {/* Avertissement Achat média lourd (RG40) */}
              {form.usageRights === "achat_media" &&
                form.usageDuration === "illimitee" &&
                form.usageTerritory === "mondial" && (
                  <div className="md:col-span-2 p-3 rounded-lg bg-feedback-warning-bg border border-feedback-warning-border text-feedback-warning-text text-xs">
                    {t.step2.warningHeavyMediaRights}
                  </div>
                )}

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-primary">
                  {t.step2.exclusivityLabel} <FormRequiredMark />
                </label>
                <select
                  value={form.exclusivity}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      exclusivity: e.target.value as ExclusivityBand,
                    })
                  }
                  className={inputClass}
                >
                  {EXCLUSIVITY_BANDS.map((eb) => (
                    <option key={eb} value={eb}>
                      {eb === "none"
                        ? "Non (aucune exclusivité)"
                        : eb === "1_month"
                          ? "≤ 1 mois"
                          : eb === "3_months"
                            ? "≤ 3 mois"
                            : "Négociable"}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-primary">
                  {t.step2.contentDelayLabel} <FormRequiredMark />
                </label>
                <select
                  value={form.contentValidationDelay}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      contentValidationDelay: e.target
                        .value as ContentValidationDelay,
                    })
                  }
                  className={inputClass}
                >
                  {CONTENT_VALIDATION_DELAYS.map((cvd) => (
                    <option key={cvd} value={cvd}>
                      {cvd === "48h"
                        ? "48 heures"
                        : cvd === "5j"
                          ? "5 jours ouvrés"
                          : "10 jours ouvrés"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ÉTAPE 3 : POUR QUI (Audience visée) */}
        {currentStep === 3 && (
          <div className="p-6 rounded-2xl bg-surface-card border border-border-default space-y-6">
            <div className="border-b border-border-default pb-4">
              <h2 className="text-lg font-extrabold text-text-primary">
                {t.stepTitles.step3}
              </h2>
              <p className="text-xs text-text-tertiary mt-1">
                Définissez les pays, thématiques et profils d&apos;audience
                recherchés.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-primary">
                  {t.step3.targetCountriesLabel} <FormRequiredMark />
                </label>
                <select
                  multiple
                  value={form.targetCountries}
                  onChange={(e) => {
                    const values = Array.from(
                      e.target.selectedOptions,
                      (opt) => opt.value,
                    ).slice(0, 5);
                    setForm({ ...form, targetCountries: values });
                  }}
                  className={`${inputClass} h-24`}
                >
                  <option value="FR">France (FR)</option>
                  <option value="BE">Belgique (BE)</option>
                  <option value="CH">Suisse (CH)</option>
                  <option value="CA">Canada (CA)</option>
                  <option value="US">États-Unis (US)</option>
                  <option value="GB">Royaume-Uni (GB)</option>
                </select>
                <span className="text-[11px] text-text-tertiary">
                  Sélectionnez jusqu&apos;à 5 pays prioritaires.
                </span>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-primary">
                  {t.step3.targetLanguagesLabel} <FormRequiredMark />
                </label>
                <select
                  multiple
                  value={form.targetLanguages}
                  onChange={(e) => {
                    const values = Array.from(
                      e.target.selectedOptions,
                      (opt) => opt.value as Language,
                    );
                    setForm({ ...form, targetLanguages: values });
                  }}
                  className={`${inputClass} h-24`}
                >
                  <option value="fr">Français (fr)</option>
                  <option value="en">Anglais (en)</option>
                </select>
              </div>

              {/* Thématiques (1 à 3) */}
              <div className="space-y-2 md:col-span-2 pt-2 border-t border-border-default">
                <label className="block text-xs font-semibold text-text-primary">
                  {t.step3.targetTopicsLabel} <FormRequiredMark />
                </label>
                <div className="flex flex-wrap gap-2">
                  {TOPIC_OPTIONS.map((topic) => {
                    const isSelected = form.targetTopics.includes(topic.value);
                    return (
                      <button
                        key={topic.value}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (form.targetTopics.length > 1) {
                              setForm({
                                ...form,
                                targetTopics: form.targetTopics.filter(
                                  (t) => t !== topic.value,
                                ),
                              });
                            }
                          } else {
                            if (form.targetTopics.length < 3) {
                              setForm({
                                ...form,
                                targetTopics: [
                                  ...form.targetTopics,
                                  topic.value,
                                ],
                              });
                            }
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isSelected
                            ? "bg-brand-primary text-surface-page shadow-xs"
                            : "bg-surface-page text-text-secondary border border-border-default hover:text-text-primary"
                        }`}
                      >
                        {topic.label}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[11px] text-text-tertiary block">
                  {t.step3.targetTopicsHint} ({form.targetTopics.length}/3
                  sélectionnés)
                </span>
              </div>

              {/* Tranches d'âge de l'audience */}
              <div className="space-y-2 md:col-span-2 pt-2">
                <label className="block text-xs font-semibold text-text-primary">
                  {t.step3.targetAgeBandsLabel}
                </label>
                <div className="flex flex-wrap gap-3">
                  {(
                    [
                      { value: "18-24", label: "18 – 24 ans" },
                      { value: "25-34", label: "25 – 34 ans" },
                      { value: "35-44", label: "35 – 44 ans" },
                      { value: "45_plus", label: "45 ans et plus" },
                    ] as const
                  ).map((age) => {
                    const isChecked = form.targetAgeBands.includes(age.value);
                    return (
                      <label
                        key={age.value}
                        className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setForm({
                                ...form,
                                targetAgeBands: form.targetAgeBands.filter(
                                  (a) => a !== age.value,
                                ),
                              });
                            } else {
                              setForm({
                                ...form,
                                targetAgeBands: [
                                  ...form.targetAgeBands,
                                  age.value,
                                ],
                              });
                            }
                          }}
                        />
                        <span>{age.label}</span>
                      </label>
                    );
                  })}
                </div>
                <span className="text-[11px] text-text-tertiary block">
                  {t.step3.targetAgeBandsHint}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ÉTAPE 4 : LE BUDGET (Rémunération par créateur & Budget total) */}
        {currentStep === 4 && (
          <div className="p-6 rounded-2xl bg-surface-card border border-border-default space-y-6">
            <div className="border-b border-border-default pb-4">
              <h2 className="text-lg font-extrabold text-text-primary">
                {t.stepTitles.step4}
              </h2>
              <p className="text-xs text-text-tertiary mt-1">
                Indiquez ce que vous payez au total, commission INFLUX incluse.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 md:col-span-2">
                <label className="block text-xs font-semibold text-text-primary">
                  {t.step4.compensationNatureLabel} <FormRequiredMark />
                </label>
                <select
                  value={form.compensationNature}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      compensationNature: e.target.value as CompensationNature,
                    })
                  }
                  className={inputClass}
                >
                  {COMPENSATION_NATURES.map((nat) => (
                    <option key={nat} value={nat}>
                      {nat === "numeraire"
                        ? "Rémunération en numéraire (cash)"
                        : nat === "numeraire_et_dotation"
                          ? "Numéraire + Dotation produit"
                          : nat === "dotation_seule"
                            ? "Dotation produit seule (sans numéraire)"
                            : "Commission sur ventes (Affiliation)"}
                    </option>
                  ))}
                </select>
              </div>

              {form.compensationNature !== "dotation_seule" && (
                <>
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-text-primary">
                      {t.step4.minAmountLabel} <FormRequiredMark />
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={form.minCompensationMinor}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          minCompensationMinor: Number(e.target.value) || 0,
                        })
                      }
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-text-primary">
                      {t.step4.maxAmountLabel} <FormRequiredMark />
                    </label>
                    <input
                      type="number"
                      min={form.minCompensationMinor || 1}
                      value={form.maxCompensationMinor}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          maxCompensationMinor: Number(e.target.value) || 0,
                        })
                      }
                      className={inputClass}
                    />
                  </div>
                </>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-primary">
                  {t.step4.currencyLabel} <FormRequiredMark />
                </label>
                <select
                  value={form.currency}
                  onChange={(e) =>
                    setForm({ ...form, currency: e.target.value as Currency })
                  }
                  className={inputClass}
                >
                  <option value="EUR">Euro (EUR €)</option>
                  <option value="USD">Dollar américain (USD $)</option>
                  <option value="GBP">Livre sterling (GBP £)</option>
                  <option value="CAD">Dollar canadien (CAD $)</option>
                  <option value="BRL">Real brésilien (BRL R$)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-primary">
                  {t.step4.creatorsCountLabel} <FormRequiredMark />
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.creatorsCount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      creatorsCount: Number(e.target.value) || 1,
                    })
                  }
                  className={inputClass}
                />
                <span className="text-[11px] text-text-tertiary">
                  {t.step4.creatorsCountHint}
                </span>
              </div>

              {/* Encadré « Ce que voit un créateur » (17 §4.3, RG60, RG61) */}
              <div className="md:col-span-2 p-4 rounded-xl bg-surface-page border border-border-default space-y-2">
                <span className="text-xs font-bold text-text-primary block">
                  {t.step4.creatorViewBoxTitle}
                </span>
                <p className="text-sm font-extrabold text-brand-primary">
                  « Ce que la marque paie au total :{" "}
                  {form.minCompensationMinor.toLocaleString("fr-FR")} –{" "}
                  {form.maxCompensationMinor.toLocaleString("fr-FR")}{" "}
                  {form.currency} »
                </p>
                <p className="text-[11px] text-text-secondary">
                  {t.step4.creatorViewBoxNetNotice}
                </p>
                <p className="text-[11px] text-text-tertiary italic pt-1 border-t border-border-subtle">
                  {t.step4.indicativeRangeNotice}
                </p>
              </div>

              {/* Bloc interne : Budget total (RG65) */}
              <div className="md:col-span-2 p-4 rounded-xl bg-surface-muted/60 border border-border-subtle space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary block">
                  {t.common.internalBlockTitle}
                </span>
                <label
                  htmlFor="totalBudget"
                  className="block text-xs font-semibold text-text-secondary"
                >
                  {t.step4.budgetTotalInternalLabel} ({form.currency})
                </label>
                <input
                  id="totalBudget"
                  type="number"
                  placeholder="ex. 5000"
                  value={form.totalBudgetMinor}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      totalBudgetMinor: e.target.value
                        ? Number(e.target.value)
                        : "",
                    })
                  }
                  className={inputClass}
                />
                <span className="text-[11px] text-text-tertiary">
                  {t.step4.budgetTotalInternalHint}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ÉTAPE 5 : CALENDRIER ET CANDIDATURE (Dates, Attestation, Soumission) */}
        {currentStep === 5 && (
          <div className="p-6 rounded-2xl bg-surface-card border border-border-default space-y-6">
            <div className="border-b border-border-default pb-4">
              <h2 className="text-lg font-extrabold text-text-primary">
                {t.stepTitles.step5}
              </h2>
              <p className="text-xs text-text-tertiary mt-1">
                Fixez les échéances clés et finalisez la soumission pour
                modération.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-primary">
                  {t.step5.applicationDeadlineLabel} <FormRequiredMark />
                </label>
                <input
                  type="date"
                  required
                  value={form.applicationDeadline}
                  onChange={(e) =>
                    setForm({ ...form, applicationDeadline: e.target.value })
                  }
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-primary">
                  {t.step5.deliveryDeadlineLabel}
                </label>
                <input
                  type="date"
                  value={form.deliveryDeadline}
                  onChange={(e) =>
                    setForm({ ...form, deliveryDeadline: e.target.value })
                  }
                  className={inputClass}
                />
                <span className="text-[11px] text-text-tertiary">
                  {t.step5.deliveryDeadlineHint}
                </span>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-primary">
                  {t.step5.startsOnLabel} <FormRequiredMark />
                </label>
                <input
                  type="date"
                  required
                  value={form.startsOn}
                  onChange={(e) =>
                    setForm({ ...form, startsOn: e.target.value })
                  }
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-primary">
                  {t.step5.endsOnLabel} <FormRequiredMark />
                </label>
                <input
                  type="date"
                  required
                  value={form.endsOn}
                  onChange={(e) => setForm({ ...form, endsOn: e.target.value })}
                  className={inputClass}
                />
                <span className="text-[11px] text-text-tertiary">
                  {t.step5.durationMaxHint}
                </span>
              </div>

              {/* Éléments demandés lors de la candidature */}
              <div className="space-y-2 md:col-span-2 pt-2 border-t border-border-default">
                <label className="block text-xs font-semibold text-text-primary">
                  {t.step5.candidateElementsLabel}
                </label>
                <div className="flex flex-wrap gap-3">
                  {CANDIDATE_ELEMENTS.map((el) => {
                    const isChecked =
                      form.requestedCandidateElements.includes(el);
                    return (
                      <label
                        key={el}
                        className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setForm({
                                ...form,
                                requestedCandidateElements:
                                  form.requestedCandidateElements.filter(
                                    (e) => e !== el,
                                  ),
                              });
                            } else {
                              setForm({
                                ...form,
                                requestedCandidateElements: [
                                  ...form.requestedCandidateElements,
                                  el,
                                ],
                              });
                            }
                          }}
                        />
                        <span>
                          {el === "message_motivation"
                            ? "Note de motivation"
                            : el === "exemples_contenus"
                              ? "Exemples de contenus similaires"
                              : el === "proposition_concept"
                                ? "Proposition de concept"
                                : el === "tarif_propose"
                                  ? "Tarif proposé"
                                  : "Disponibilité"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Plafond et Filtre créateurs vérifiés */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-text-primary">
                  {t.step5.applicationCapLabel}
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  placeholder={t.step5.applicationCapPlaceholder}
                  value={form.applicationCap}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      applicationCap: e.target.value
                        ? Number(e.target.value)
                        : "",
                    })
                  }
                  className={inputClass}
                />
                <span className="text-[11px] text-text-tertiary">
                  {t.step5.applicationCapHint}
                </span>
              </div>

              <div className="space-y-1 flex flex-col justify-center">
                <label className="flex items-center gap-2 text-xs text-text-primary font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.verifiedOnly}
                    onChange={(e) =>
                      setForm({ ...form, verifiedOnly: e.target.checked })
                    }
                  />
                  <span>{t.step5.verifiedOnlyLabel}</span>
                </label>
                <span className="text-[11px] text-text-tertiary">
                  {t.step5.verifiedOnlyDescription}
                </span>
              </div>

              {/* Attestation légale obligatoire si secteur sensible (RG85, CA56) */}
              {isSensitive && (
                <div className="md:col-span-2 p-4 rounded-xl bg-feedback-warning-bg border border-feedback-warning-border text-feedback-warning-text space-y-2">
                  <span className="font-bold text-xs block">
                    {t.step5.sensitiveDeclarationTitle}
                  </span>
                  <label className="flex items-start gap-2.5 text-xs cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      required
                      checked={form.sensitiveDeclarationAccepted}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          sensitiveDeclarationAccepted: e.target.checked,
                        })
                      }
                      className="mt-0.5"
                    />
                    <span className="leading-snug">
                      {t.step5.sensitiveDeclarationCheckbox}
                    </span>
                  </label>
                </div>
              )}

              {/* Notes internes */}
              <div className="md:col-span-2 p-4 rounded-xl bg-surface-muted/60 border border-border-subtle space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-tertiary block">
                  {t.common.internalBlockTitle}
                </span>
                <label className="block text-xs font-semibold text-text-secondary">
                  {t.step5.internalNotesLabel}
                </label>
                <textarea
                  rows={2}
                  placeholder={t.step5.internalNotesPlaceholder}
                  value={form.internalNotes}
                  onChange={(e) =>
                    setForm({ ...form, internalNotes: e.target.value })
                  }
                  className={textareaClass}
                />
              </div>

              {/* Jauge de complétude / Erreurs bloquantes */}
              <div className="md:col-span-2 p-4 rounded-xl bg-surface-page border border-border-default space-y-2">
                <span className="text-xs font-bold text-text-primary block">
                  {t.step5.completenessTitle} : Score {completeness.score}/100
                </span>
                {!completeness.isSubmittable ? (
                  <div className="space-y-1 text-feedback-error-text text-xs">
                    <span className="font-semibold block">
                      {t.step5.missingFieldsPrefix}
                    </span>
                    <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                      {completeness.missingFieldLabels.map((mf) => (
                        <li key={mf}>{mf}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-brand-primary text-xs font-semibold">
                    ✓ {t.step5.readyToSubmit}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Message d'erreur de soumission */}
        {submitError && (
          <div className="p-4 rounded-xl bg-feedback-error-bg border border-feedback-error-border text-feedback-error-text text-xs font-medium">
            ✕ {submitError}
          </div>
        )}

        {/* Barre de navigation et boutons d'actions */}
        <div className="p-4 rounded-xl bg-surface-card border border-border-default flex flex-wrap items-center justify-between gap-4">
          <div>
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() =>
                  setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4 | 5)
                }
                className="px-4 py-2 rounded-lg bg-surface-page border border-border-default text-text-primary text-xs font-semibold hover:bg-surface-hover transition-colors"
              >
                {t.common.prevStep}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => saveDraft(false)}
              disabled={saveStatus === "saving"}
              className="px-4 py-2 rounded-lg bg-surface-page border border-border-default text-text-secondary hover:text-text-primary text-xs font-semibold hover:bg-surface-hover transition-colors"
            >
              {saveStatus === "saving"
                ? t.common.savingDraft
                : t.common.saveDraft}
            </button>

            {currentStep < 5 ? (
              <button
                type="button"
                onClick={() =>
                  setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3 | 4 | 5)
                }
                className="px-5 py-2.5 rounded-lg bg-brand-primary text-surface-page text-xs font-bold hover:bg-brand-hover transition-colors shadow-xs"
              >
                {t.common.nextStep}
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSubmitting || !completeness.isSubmittable}
                className="px-6 py-2.5 rounded-lg bg-brand-primary text-surface-page text-xs font-extrabold hover:bg-brand-hover transition-colors shadow-xs disabled:opacity-50"
              >
                {isSubmitting ? t.common.submitting : t.common.submitForReview}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Modal d'aperçu « Ce que voit un créateur » */}
      <CampaignPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        campaign={
          {
            ...form,
            id: campaignId || "nouveau-brouillon",
            minCompensationMinor: form.minCompensationMinor
              ? Number(form.minCompensationMinor) * 100
              : null,
            maxCompensationMinor: form.maxCompensationMinor
              ? Number(form.maxCompensationMinor) * 100
              : null,
          } as any
        }
        locale={locale}
      />
    </div>
  );
}

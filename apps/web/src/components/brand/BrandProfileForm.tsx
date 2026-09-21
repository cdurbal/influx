"use client";

import { useState, useMemo, useEffect } from "react";
import {
  calculateBrandProfileCompleteness,
  normalizeWebsiteDomain,
  type BrandProfile,
  type CompanySizeBand,
  type ContactRole,
} from "@influx/contracts";
import { inputClassName, RequiredMark } from "@/components/ui/form-controls";
import {
  BadgeCheckIcon,
  BriefcaseIcon,
  CheckIcon,
  CircleAlertIcon,
  GlobeIcon,
  InfoIcon,
  LockIcon,
} from "@/components/ui/icons";
import {
  FR_BRAND_PROFILE_LABELS,
  EN_BRAND_PROFILE_LABELS,
  type BrandProfileLabels,
} from "./brand-profile-labels";

export interface BrandProfileFormProps {
  initialProfile?: Partial<BrandProfile>;
  locale?: string;
}

const SECTOR_OPTIONS = [
  { value: "beaute_cosmetiques", label: "Beauté, Cosmétiques & Soins" },
  { value: "mode_accessoires", label: "Mode, Prêt-à-porter & Accessoires" },
  { value: "tech_gadgets", label: "High-Tech, Électronique & Gaming" },
  { value: "sport_fitness", label: "Sport, Fitness & Outdoor" },
  { value: "alimentation_boissons", label: "Alimentation, Boissons & Food" },
  { value: "maison_deco", label: "Maison, Décoration & Bricolage" },
  { value: "voyage_tourisme", label: "Voyage, Hôtellerie & Tourisme" },
  { value: "services_b2b", label: "Services, SaaS & B2B" },
  { value: "sante_bienetre", label: "Santé, Compléments & Bien-être" },
  { value: "autre", label: "Autre secteur" },
] as const;

const COMPANY_SIZE_OPTIONS: { value: CompanySizeBand; label: string }[] = [
  { value: "1-10", label: "1 à 10 salariés (Micro-entreprise / TPE)" },
  { value: "11-50", label: "11 à 50 salariés (PME de croissance)" },
  { value: "51-250", label: "51 à 250 salariés (Moyenne entreprise)" },
  { value: "251-1000", label: "251 à 1 000 salariés (ETI)" },
  { value: "plus_1000", label: "Plus de 1 000 salariés (Grand groupe)" },
];

const TOPIC_OPTIONS = [
  { value: "lifestyle", label: "Lifestyle & Quotidien" },
  { value: "mode", label: "Mode & Style" },
  { value: "beaute", label: "Beauté & Skincare" },
  { value: "tech", label: "Tech & Informatique" },
  { value: "gaming", label: "Gaming & Esport" },
  { value: "sport", label: "Sport & Santé" },
  { value: "food", label: "Cuisine & Gastronomie" },
  { value: "voyage", label: "Voyage & Évasion" },
  { value: "business", label: "Business & Entrepreneuriat" },
];

const NETWORK_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X (Twitter)" },
  { value: "twitch", label: "Twitch" },
  { value: "pinterest", label: "Pinterest" },
];

const FORMAT_OPTIONS = [
  { value: "post", label: "Post image dédié" },
  { value: "story", label: "Séquence de stories" },
  { value: "reel", label: "Reel / Vidéo courte verticale" },
  { value: "video_dedicated", label: "Vidéo longue dédiée (YouTube)" },
  { value: "ugc", label: "Contenu UGC brut (droits marque)" },
  { value: "product_placement", label: "Placement de produit intégré" },
];

const BUDGET_OPTIONS = [
  { value: "<500", label: "Moins de 500 €" },
  { value: "500-1000", label: "500 € à 1 000 €" },
  { value: "1000-3000", label: "1 000 € à 3 000 €" },
  { value: "3000-5000", label: "3 000 € à 5 000 €" },
  { value: ">5000", label: "Plus de 5 000 €" },
];

const CONTACT_ROLE_OPTIONS: { value: ContactRole; label: string }[] = [
  { value: "marketing", label: "Responsable / Équipe Marketing" },
  {
    value: "partenariats_influence",
    label: "Responsable Partenariats & Influence",
  },
  { value: "communication", label: "Direction / Équipe Communication" },
  { value: "dirigeant", label: "Fondateur / Dirigeant" },
  { value: "ecommerce", label: "Responsable E-commerce" },
  { value: "achats", label: "Achats & Gestion" },
  { value: "agence_mandatee", label: "Agence mandatée par la marque" },
];

const ASTERISK = "*";

export function BrandProfileForm({
  initialProfile,
  locale,
}: BrandProfileFormProps) {
  const labels: BrandProfileLabels =
    locale === "en" ? EN_BRAND_PROFILE_LABELS : FR_BRAND_PROFILE_LABELS;

  const [profile, setProfile] = useState<Partial<BrandProfile>>(() => ({
    companyName: initialProfile?.companyName || "Maison Solène",
    sector: initialProfile?.sector || "beaute_cosmetiques",
    secondarySectors: initialProfile?.secondarySectors || [],
    companySize: initialProfile?.companySize || "11-50",
    country: initialProfile?.country || "FR",
    targetMarkets: initialProfile?.targetMarkets?.length
      ? initialProfile.targetMarkets
      : ["FR"],
    languages: initialProfile?.languages?.length
      ? initialProfile.languages
      : ["fr"],
    website: initialProfile?.website || "maisonsolene.fr",
    presentation:
      initialProfile?.presentation ||
      "Maison Solène conçoit des soins bio certifiés issus de la biodiversité provençale avec des packagings rechargeables et éco-conçus pour toute la famille.",
    topics: initialProfile?.topics?.length
      ? initialProfile.topics
      : ["beaute", "lifestyle"],
    targetNetworks: initialProfile?.targetNetworks?.length
      ? initialProfile.targetNetworks
      : ["instagram", "tiktok"],
    expectedFormats: initialProfile?.expectedFormats?.length
      ? initialProfile.expectedFormats
      : ["reel", "story"],
    indicativeBudgetBand: initialProfile?.indicativeBudgetBand || "1000-3000",
    currency: initialProfile?.currency || "EUR",
    usageRights: initialProfile?.usageRights || ["digital_30d"],
    exclusivity: initialProfile?.exclusivity || "none",
    nonMonetaryCounterpart: initialProfile?.nonMonetaryCounterpart ?? false,
    targetAudienceCountries: initialProfile?.targetAudienceCountries?.length
      ? initialProfile.targetAudienceCountries
      : ["FR"],
    collaborationRhythm: initialProfile?.collaborationRhythm || "one_off",
    contactRole: initialProfile?.contactRole || "marketing",
    contactFirstName: initialProfile?.contactFirstName || "Solène",
    contactEmail: initialProfile?.contactEmail || "contact@maisonsolene.fr",
    contactPhone: initialProfile?.contactPhone || "+33 6 12 34 56 78",
    contactPageUrl: initialProfile?.contactPageUrl || "",
    legalName: initialProfile?.legalName || "",
    registrationNumber: initialProfile?.registrationNumber || "",
    badgeStatus: initialProfile?.badgeStatus || "none",
    badgeDomainProofCode: initialProfile?.badgeDomainProofCode || "",
    status: initialProfile?.status || "brouillon",
  }));

  const [activeTab, setActiveTab] = useState<
    "identity" | "expectations" | "contact" | "badge"
  >("identity");
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "submitted" | "error"
  >("idle");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(!initialProfile);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (initialProfile) return;

    let mounted = true;
    async function loadProfile() {
      try {
        setIsLoadingProfile(true);
        const res = await fetch("/api/profiles/brand/me", {
          credentials: "include",
        });

        if (res.status === 401) {
          if (mounted) {
            setAuthError(
              locale === "en"
                ? "You must be logged in with a Brand / Advertiser account to view and edit this profile."
                : "Vous devez être connecté avec un compte Marque / Annonceur pour modifier ce profil.",
            );
          }
          return;
        }

        if (res.status === 403) {
          if (mounted) {
            setAuthError(
              locale === "en"
                ? "This page is reserved for Brand accounts. Use the DEV MOCK toolbar below to switch to a Brand persona (e.g. Maison Solène or TechGear France)."
                : "Cette page est réservée aux comptes Marque / Annonceur. Utilisez la barre DEV MOCK en bas pour sélectionner un profil Marque (ex: Maison Solène ou TechGear France).",
            );
          }
          return;
        }

        if (res.ok) {
          const data = await res.json();
          if (mounted && data.profile) {
            setProfile((prev) => ({
              ...prev,
              ...data.profile,
              secondarySectors:
                data.profile.secondarySectors || prev.secondarySectors || [],
              targetMarkets: data.profile.targetMarkets?.length
                ? data.profile.targetMarkets
                : prev.targetMarkets,
              languages: data.profile.languages?.length
                ? data.profile.languages
                : prev.languages,
              topics: data.profile.topics?.length
                ? data.profile.topics
                : prev.topics,
              targetNetworks: data.profile.targetNetworks?.length
                ? data.profile.targetNetworks
                : prev.targetNetworks,
              expectedFormats: data.profile.expectedFormats?.length
                ? data.profile.expectedFormats
                : prev.expectedFormats,
              usageRights: data.profile.usageRights?.length
                ? data.profile.usageRights
                : prev.usageRights,
              targetAudienceCountries: data.profile.targetAudienceCountries
                ?.length
                ? data.profile.targetAudienceCountries
                : prev.targetAudienceCountries,
            }));
            setAuthError(null);
          }
        }
      } catch {
        // Mode offline/mock local fallback
      } finally {
        if (mounted) {
          setIsLoadingProfile(false);
        }
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [initialProfile, locale]);

  const completeness = useMemo(() => {
    return calculateBrandProfileCompleteness(profile);
  }, [profile]);

  const { score, breakdown, missingRequiredForPublish } = completeness;

  function updateField<K extends keyof BrandProfile>(
    key: K,
    value: BrandProfile[K],
  ) {
    setProfile((prev) => ({
      ...prev,
      [key]: value,
    }));
    setSaveStatus("idle");
    setFeedbackMessage(null);
  }

  function toggleArrayItem<
    K extends "topics" | "targetNetworks" | "expectedFormats" | "targetMarkets",
  >(key: K, item: string, maxAllowed?: number) {
    setProfile((prev) => {
      const current = (prev[key] as string[]) || [];
      if (current.includes(item)) {
        return {
          ...prev,
          [key]: current.filter((x) => x !== item),
        };
      }
      if (maxAllowed && current.length >= maxAllowed) {
        return prev;
      }
      return {
        ...prev,
        [key]: [...current, item],
      };
    });
    setSaveStatus("idle");
  }

  function handleWebsiteBlur() {
    if (profile.website) {
      const normalized = normalizeWebsiteDomain(profile.website);
      updateField("website", normalized);
    }
  }

  async function handleSaveDraft() {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/profiles/brand/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(profile),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setProfile((prev) => ({ ...prev, ...data.profile }));
        }
        setSaveStatus("saved");
        setFeedbackMessage(labels.actions.saveSuccess);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setSaveStatus("error");
        setFeedbackMessage(errJson.message || labels.actions.missingAlert);
      }
    } catch {
      setSaveStatus("error");
      setFeedbackMessage(labels.actions.missingAlert);
    }
  }

  async function handleSubmitForValidation() {
    if (missingRequiredForPublish.length > 0) {
      setSaveStatus("error");
      setFeedbackMessage(
        `${labels.missingMessage.prefix} ${missingRequiredForPublish.length} ${labels.missingMessage.midfix} ${missingRequiredForPublish.join(", ")}${labels.missingMessage.suffix}`,
      );
      return;
    }

    setSaveStatus("saving");
    try {
      // 1. Sauvegarder d'abord
      await fetch("/api/profiles/brand/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(profile),
      });

      // 2. Soumettre pour validation
      const res = await fetch("/api/profiles/brand/me/submit", {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        setProfile((prev) => ({ ...prev, status: "en_attente" }));
        setSaveStatus("submitted");
        setFeedbackMessage(labels.actions.submitSuccess);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setSaveStatus("error");
        setFeedbackMessage(errJson.message || labels.actions.missingAlert);
      }
    } catch {
      setSaveStatus("error");
      setFeedbackMessage(labels.actions.missingAlert);
    }
  }

  function handleBadgeRequest() {
    if (!profile.legalName || !profile.registrationNumber) {
      setSaveStatus("error");
      setFeedbackMessage(labels.badge.unrequestedBody);
      return;
    }

    setProfile((prev) => ({
      ...prev,
      badgeStatus: "pending",
      badgeDomainProofCode: "INFLUX-VERIF-MS892011",
    }));
    setSaveStatus("saved");
    setFeedbackMessage(labels.actions.badgeSuccess);
  }

  const statusLabel =
    profile.status === "publie"
      ? labels.status.published
      : profile.status === "en_attente"
        ? labels.status.pending
        : profile.status === "refuse"
          ? labels.status.rejected
          : labels.status.draft;

  const scoreDisplay = `${score}%`;
  const charCountDisplay = `${profile.presentation?.length || 0} ${labels.identity.presentationMinHint}`;
  const missingCountDisplay = `${missingRequiredForPublish.length}`;
  const missingListDisplay = missingRequiredForPublish.join(", ");

  const publicPtsDisplay = `${breakdown.publicIdentity} / 40 ${labels.breakdown.pts}`;
  const collabPtsDisplay = `${breakdown.collaborationExpectations} / 35 ${labels.breakdown.pts}`;
  const trustPtsDisplay = `${breakdown.trust} / 15 ${labels.breakdown.pts}`;
  const contactPtsDisplay = `${breakdown.contact} / 10 ${labels.breakdown.pts}`;

  const progressWidthClass =
    score >= 100
      ? "w-full"
      : score >= 80
        ? "w-5/6"
        : score >= 60
          ? "w-3/5"
          : score >= 40
            ? "w-2/5"
            : score >= 20
              ? "w-1/5"
              : "w-0";

  return (
    <div className="flex flex-col gap-8">
      {authError ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 shadow-sm dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-semibold">{authError}</p>
        </div>
      ) : null}
      {isLoadingProfile ? (
        <div className="rounded-lg border border-border-default bg-surface-card p-6 text-center text-xs text-text-tertiary">
          {locale === "en"
            ? "Loading brand profile..."
            : "Chargement du profil marque..."}
        </div>
      ) : null}
      {/* 1. JAUGE DE COMPLÉTUDE VISUELLE & STATUT DU PROFIL (RG57, RG58, RG61) */}
      <section
        aria-labelledby="completeness-heading"
        className="flex flex-col gap-4 rounded-lg border-(length:--border-width-thin) border-border-default bg-surface-card p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2
              id="completeness-heading"
              className="text-heading-3 font-semibold text-text-primary"
            >
              {labels.completenessHeading}
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {profile.badgeStatus === "verified" ? (
                <span className="inline-flex items-center gap-1 rounded-pill bg-feedback-success-bg px-3 py-1 text-xs font-semibold text-feedback-success-text border border-feedback-success-border">
                  <BadgeCheckIcon className="size-3.5" aria-hidden="true" />
                  <span>Marque Vérifiée ✓</span>
                </span>
              ) : null}
              <span
                className={`inline-flex items-center gap-1 rounded-pill px-3 py-1 text-xs font-medium border-(length:--border-width-thin) ${
                  profile.status === "publie"
                    ? "bg-feedback-success-bg text-feedback-success-text border-feedback-success-border"
                    : profile.status === "en_attente"
                      ? "bg-feedback-warning-bg text-feedback-warning-text border-feedback-warning-border"
                      : profile.status === "refuse"
                        ? "bg-feedback-error-bg text-feedback-error-text border-feedback-error-border"
                        : "bg-surface-raised text-text-secondary border-border-default"
                }`}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-display font-bold text-text-brand">
              {scoreDisplay}
            </span>
            <span className="text-sm text-text-secondary">
              {labels.completenessMax}
            </span>
          </div>
        </div>

        {/* Barre de progression visuelle */}
        <div className="h-3 w-full overflow-hidden rounded-pill bg-surface-raised">
          <div
            className={`h-full rounded-pill bg-action-primary-bg ${progressWidthClass}`}
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={labels.completenessHeading}
          />
        </div>

        {/* Décomposition par bloc (RG58) */}
        <div className="grid grid-cols-2 gap-3 text-xs text-text-secondary sm:grid-cols-4">
          <div className="rounded-md bg-surface-page p-3 border-(length:--border-width-thin) border-border-subtle">
            <span className="block text-text-tertiary">
              {labels.breakdown.publicIdentity}
            </span>
            <span className="text-md font-semibold text-text-primary">
              {publicPtsDisplay}
            </span>
          </div>
          <div className="rounded-md bg-surface-page p-3 border-(length:--border-width-thin) border-border-subtle">
            <span className="block text-text-tertiary">
              {labels.breakdown.collaborationExpectations}
            </span>
            <span className="text-md font-semibold text-text-primary">
              {collabPtsDisplay}
            </span>
          </div>
          <div className="rounded-md bg-surface-page p-3 border-(length:--border-width-thin) border-border-subtle">
            <span className="block text-text-tertiary">
              {labels.breakdown.trust}
            </span>
            <span className="text-md font-semibold text-text-primary">
              {trustPtsDisplay}
            </span>
          </div>
          <div className="rounded-md bg-surface-page p-3 border-(length:--border-width-thin) border-border-subtle">
            <span className="block text-text-tertiary">
              {labels.breakdown.contact}
            </span>
            <span className="text-md font-semibold text-text-primary">
              {contactPtsDisplay}
            </span>
          </div>
        </div>

        {/* Message factuel des champs obligatoires manquants (RG61) */}
        {missingRequiredForPublish.length > 0 ? (
          <p className="flex items-start gap-2 rounded-md border-(length:--border-width-thin) border-feedback-warning-border bg-feedback-warning-bg p-3 text-sm text-feedback-warning-text">
            <CircleAlertIcon
              aria-hidden="true"
              className="size-(--size-icon-sm) shrink-0 text-feedback-warning-icon mt-1"
            />
            <span>
              {labels.missingMessage.prefix}{" "}
              <strong>{missingCountDisplay}</strong>{" "}
              {labels.missingMessage.midfix} {missingListDisplay}
              {labels.missingMessage.suffix}
            </span>
          </p>
        ) : (
          <p className="flex items-center gap-2 rounded-md border-(length:--border-width-thin) border-feedback-success-border bg-feedback-success-bg p-3 text-sm text-feedback-success-text">
            <CheckIcon
              aria-hidden="true"
              className="size-(--size-icon-sm) shrink-0 text-feedback-success-icon"
            />
            <span>{labels.missingMessage.allComplete}</span>
          </p>
        )}
      </section>

      {/* FEEDBACK BANNER */}
      {feedbackMessage && (
        <div
          role="alert"
          className={`flex items-start gap-2 rounded-md p-4 text-sm border-(length:--border-width-thin) ${
            saveStatus === "error"
              ? "bg-feedback-error-bg text-feedback-error-text border-feedback-error-border"
              : "bg-feedback-success-bg text-feedback-success-text border-feedback-success-border"
          }`}
        >
          {saveStatus === "error" ? (
            <CircleAlertIcon
              className="size-(--size-icon-sm) shrink-0 text-feedback-error-icon mt-1"
              aria-hidden="true"
            />
          ) : (
            <CheckIcon
              className="size-(--size-icon-sm) shrink-0 text-feedback-success-icon mt-1"
              aria-hidden="true"
            />
          )}
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* NAVIGATION ONGLET DU FORMULAIRE */}
      <nav
        aria-label={labels.completenessHeading}
        className="flex flex-wrap gap-2 border-b-(length:--border-width-thin) border-border-default pb-2"
      >
        <button
          type="button"
          onClick={() => setActiveTab("identity")}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium border-(length:--border-width-thin) ${
            activeTab === "identity"
              ? "bg-surface-raised text-text-brand border-border-selected font-semibold"
              : "border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          }`}
        >
          <BriefcaseIcon className="size-(--size-icon-sm)" aria-hidden="true" />
          <span>{labels.tabs.identity}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("expectations")}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium border-(length:--border-width-thin) ${
            activeTab === "expectations"
              ? "bg-surface-raised text-text-brand border-border-selected font-semibold"
              : "border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          }`}
        >
          <GlobeIcon className="size-(--size-icon-sm)" aria-hidden="true" />
          <span>{labels.tabs.expectations}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("contact")}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium border-(length:--border-width-thin) ${
            activeTab === "contact"
              ? "bg-surface-raised text-text-brand border-border-selected font-semibold"
              : "border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          }`}
        >
          <LockIcon
            className="size-(--size-icon-sm) text-feedback-warning-icon"
            aria-hidden="true"
          />
          <span>{labels.tabs.contact}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("badge")}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium border-(length:--border-width-thin) ${
            activeTab === "badge"
              ? "bg-surface-raised text-text-brand border-border-selected font-semibold"
              : "border-transparent text-text-secondary hover:bg-surface-hover hover:text-text-primary"
          }`}
        >
          <BadgeCheckIcon
            className="size-(--size-icon-sm)"
            aria-hidden="true"
          />
          <span>{labels.tabs.badge}</span>
        </button>
      </nav>

      {/* FORMULAIRE ACTIF */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSaveDraft();
        }}
        className="flex flex-col gap-6"
      >
        {/* ============================================================ */}
        {/* ONGLET 1 : IDENTITÉ PUBLIQUE (RG15) */}
        {/* ============================================================ */}
        {activeTab === "identity" && (
          <div className="flex flex-col gap-6 rounded-lg border-(length:--border-width-thin) border-border-default bg-surface-card p-6">
            <div className="border-b-(length:--border-width-thin) border-border-subtle pb-4">
              <h3 className="text-heading-3 font-semibold text-text-primary">
                {labels.identity.title}
              </h3>
              <p className="text-sm text-text-secondary">
                {labels.identity.subtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Nom commercial */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="companyName"
                  className="text-sm font-medium text-text-primary"
                >
                  {labels.identity.companyNameLabel}{" "}
                  <RequiredMark mark={ASTERISK} />
                </label>
                <input
                  id="companyName"
                  type="text"
                  maxLength={80}
                  value={profile.companyName || ""}
                  onChange={(e) => updateField("companyName", e.target.value)}
                  className={inputClassName(!profile.companyName)}
                  placeholder={labels.identity.placeholders.companyName}
                  required
                />
                <span className="text-xs text-text-tertiary">
                  {labels.identity.companyNameHint}
                </span>
              </div>

              {/* Secteur principal */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="sector"
                  className="text-sm font-medium text-text-primary"
                >
                  {labels.identity.sectorLabel} <RequiredMark mark={ASTERISK} />
                </label>
                <select
                  id="sector"
                  value={profile.sector || ""}
                  onChange={(e) => updateField("sector", e.target.value)}
                  className={inputClassName(!profile.sector)}
                  required
                >
                  <option value="">{labels.identity.sectorEmptyOption}</option>
                  {SECTOR_OPTIONS.map((sec) => (
                    <option key={sec.value} value={sec.value}>
                      {sec.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Taille de l'entreprise (Tranches fermées - RG22, CA5) */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="companySize"
                  className="text-sm font-medium text-text-primary"
                >
                  {labels.identity.companySizeLabel}{" "}
                  <RequiredMark mark={ASTERISK} />
                </label>
                <select
                  id="companySize"
                  value={profile.companySize || "11-50"}
                  onChange={(e) =>
                    updateField(
                      "companySize",
                      e.target.value as CompanySizeBand,
                    )
                  }
                  className={inputClassName(false)}
                  required
                >
                  {COMPANY_SIZE_OPTIONS.map((size) => (
                    <option key={size.value} value={size.value}>
                      {size.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-text-tertiary">
                  {labels.identity.companySizeHint}
                </span>
              </div>

              {/* Site web (domaine seul RG17) */}
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="website"
                  className="text-sm font-medium text-text-primary"
                >
                  {labels.identity.websiteLabel}
                </label>
                <input
                  id="website"
                  type="text"
                  maxLength={100}
                  value={profile.website || ""}
                  onChange={(e) => updateField("website", e.target.value)}
                  onBlur={handleWebsiteBlur}
                  className={inputClassName(false)}
                  placeholder={labels.identity.placeholders.website}
                />
                <span className="text-xs text-text-tertiary">
                  {labels.identity.websiteHint}
                </span>
              </div>
            </div>

            {/* Présentation (RG15, RG19, RG58) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="presentation"
                  className="text-sm font-medium text-text-primary"
                >
                  {labels.identity.presentationLabel}{" "}
                  <RequiredMark mark={ASTERISK} />
                </label>
                <span
                  className={`text-xs ${
                    (profile.presentation?.length || 0) < 120
                      ? "text-feedback-warning-text"
                      : "text-text-tertiary"
                  }`}
                >
                  {charCountDisplay}
                </span>
              </div>
              <textarea
                id="presentation"
                rows={4}
                maxLength={1000}
                value={profile.presentation || ""}
                onChange={(e) => updateField("presentation", e.target.value)}
                className="w-full rounded-md border-(length:--border-width-thin) border-border-strong bg-surface-page p-4 text-md text-text-primary focus:outline-none"
                placeholder={labels.identity.placeholders.presentation}
                required
              />
              <span className="text-xs text-text-tertiary">
                {labels.identity.presentationNotice}
              </span>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* ONGLET 2 : CE QUE VOUS CHERCHEZ (RG27) */}
        {/* ============================================================ */}
        {activeTab === "expectations" && (
          <div className="flex flex-col gap-6 rounded-lg border-(length:--border-width-thin) border-border-default bg-surface-card p-6">
            <div className="border-b-(length:--border-width-thin) border-border-subtle pb-4">
              <h3 className="text-heading-3 font-semibold text-text-primary">
                {labels.expectations.title}
              </h3>
              <p className="text-sm text-text-secondary">
                {labels.expectations.subtitle}
              </p>
            </div>

            {/* Thématiques (1 à 3 choix) */}
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium text-text-primary">
                {labels.expectations.topicsLabel}{" "}
                <RequiredMark mark={ASTERISK} />
              </span>
              <div className="flex flex-wrap gap-2">
                {TOPIC_OPTIONS.map((topic) => {
                  const isSelected = profile.topics?.includes(topic.value);
                  return (
                    <button
                      key={topic.value}
                      type="button"
                      onClick={() => toggleArrayItem("topics", topic.value, 3)}
                      className={`rounded-pill px-3 py-1 text-xs font-medium border-(length:--border-width-thin) ${
                        isSelected
                          ? "bg-action-primary-bg text-text-on-action border-border-selected font-semibold"
                          : "bg-surface-page text-text-secondary border-border-default hover:bg-surface-raised"
                      }`}
                    >
                      {topic.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Réseaux visés */}
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium text-text-primary">
                {labels.expectations.networksLabel}{" "}
                <RequiredMark mark={ASTERISK} />
              </span>
              <div className="flex flex-wrap gap-2">
                {NETWORK_OPTIONS.map((net) => {
                  const isSelected = profile.targetNetworks?.includes(
                    net.value,
                  );
                  return (
                    <button
                      key={net.value}
                      type="button"
                      onClick={() =>
                        toggleArrayItem("targetNetworks", net.value)
                      }
                      className={`rounded-pill px-3 py-1 text-xs font-medium border-(length:--border-width-thin) ${
                        isSelected
                          ? "bg-action-primary-bg text-text-on-action border-border-selected font-semibold"
                          : "bg-surface-page text-text-secondary border-border-default hover:bg-surface-raised"
                      }`}
                    >
                      {net.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Formats attendus */}
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium text-text-primary">
                {labels.expectations.formatsLabel}{" "}
                <RequiredMark mark={ASTERISK} />
              </span>
              <div className="flex flex-wrap gap-2">
                {FORMAT_OPTIONS.map((fmt) => {
                  const isSelected = profile.expectedFormats?.includes(
                    fmt.value,
                  );
                  return (
                    <button
                      key={fmt.value}
                      type="button"
                      onClick={() =>
                        toggleArrayItem("expectedFormats", fmt.value)
                      }
                      className={`rounded-pill px-3 py-1 text-xs font-medium border-(length:--border-width-thin) ${
                        isSelected
                          ? "bg-action-primary-bg text-text-on-action border-border-selected font-semibold"
                          : "bg-surface-page text-text-secondary border-border-default hover:bg-surface-raised"
                      }`}
                    >
                      {fmt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Budget indicatif (RG12, RG31) */}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="budgetBand"
                className="text-sm font-medium text-text-primary"
              >
                {labels.expectations.budgetLabel}{" "}
                <RequiredMark mark={ASTERISK} />
              </label>
              <select
                id="budgetBand"
                value={profile.indicativeBudgetBand || "1000-3000"}
                onChange={(e) =>
                  updateField("indicativeBudgetBand", e.target.value)
                }
                className={inputClassName(!profile.indicativeBudgetBand)}
                required
              >
                <option value="">
                  {labels.expectations.budgetEmptyOption}
                </option>
                {BUDGET_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>
                    {b.label}
                  </option>
                ))}
              </select>
              {/* Mention obligatoire RG31 */}
              <p className="flex items-center gap-2 text-xs text-text-tertiary">
                <InfoIcon
                  className="size-(--size-icon-sm) shrink-0 text-text-tertiary"
                  aria-hidden="true"
                />
                <span>{labels.expectations.budgetNotice}</span>
              </p>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* ONGLET 3 : INTERLOCUTEUR & MASQUAGE SYMÉTRIQUE D40 (RG35) */}
        {/* ============================================================ */}
        {activeTab === "contact" && (
          <div className="flex flex-col gap-6 rounded-lg border-(length:--border-width-thin) border-border-default bg-surface-card p-6">
            <div className="border-b-(length:--border-width-thin) border-border-subtle pb-4">
              <div className="flex items-center gap-2">
                <LockIcon
                  className="size-(--size-icon-md) text-feedback-warning-icon"
                  aria-hidden="true"
                />
                <h3 className="text-heading-3 font-semibold text-text-primary">
                  {labels.contact.title}
                </h3>
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                {labels.contact.subtitle}
              </p>
            </div>

            {/* AVERTISSEMENT EXPLICITE NON NÉGOCIABLE D40 */}
            <div
              role="status"
              className="flex items-start gap-3 rounded-md border-(length:--border-width-thin) border-brand-subtle-border bg-surface-brand-subtle p-4 text-sm text-text-primary"
            >
              <LockIcon
                className="size-(--size-icon-md) shrink-0 text-text-brand mt-1"
                aria-hidden="true"
              />
              <div className="flex flex-col gap-1">
                <strong className="text-text-brand font-semibold">
                  {labels.contact.d40NoticeTitle}
                </strong>
                <p className="text-text-secondary text-xs leading-relaxed">
                  {labels.contact.d40NoticeBody}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Fonction de l'interlocuteur (Publique RG35, RG36) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="contactRole"
                    className="text-sm font-medium text-text-primary"
                  >
                    {labels.contact.roleLabel} <RequiredMark mark={ASTERISK} />
                  </label>
                  <span className="rounded-pill bg-surface-page px-2 py-1 text-xs text-text-brand border-(length:--border-width-thin) border-brand-subtle-border">
                    {labels.contact.rolePublicBadge}
                  </span>
                </div>
                <select
                  id="contactRole"
                  value={profile.contactRole || "marketing"}
                  onChange={(e) =>
                    updateField("contactRole", e.target.value as ContactRole)
                  }
                  className={inputClassName(!profile.contactRole)}
                  required
                >
                  {CONTACT_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-text-tertiary">
                  {labels.contact.roleHint}
                </span>
              </div>

              {/* Prénom (Masqué) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="contactFirstName"
                    className="text-sm font-medium text-text-primary"
                  >
                    {labels.contact.firstNameLabel}
                  </label>
                  <span className="rounded-pill bg-feedback-warning-bg px-2 py-1 text-xs text-feedback-warning-text border-(length:--border-width-thin) border-feedback-warning-border">
                    {labels.contact.maskedBadge}
                  </span>
                </div>
                <input
                  id="contactFirstName"
                  type="text"
                  maxLength={40}
                  value={profile.contactFirstName || ""}
                  onChange={(e) =>
                    updateField("contactFirstName", e.target.value)
                  }
                  className={inputClassName(false)}
                  placeholder={labels.contact.placeholders.firstName}
                />
                <span className="text-xs text-text-tertiary">
                  {labels.contact.firstNameHint}
                </span>
              </div>

              {/* Email professionnel (Masqué) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="contactEmail"
                    className="text-sm font-medium text-text-primary"
                  >
                    {labels.contact.emailLabel}
                  </label>
                  <span className="rounded-pill bg-feedback-warning-bg px-2 py-1 text-xs text-feedback-warning-text border-(length:--border-width-thin) border-feedback-warning-border">
                    {labels.contact.maskedBadge}
                  </span>
                </div>
                <input
                  id="contactEmail"
                  type="email"
                  value={profile.contactEmail || ""}
                  onChange={(e) => updateField("contactEmail", e.target.value)}
                  className={inputClassName(false)}
                  placeholder={labels.contact.placeholders.email}
                />
                <span className="text-xs text-text-tertiary">
                  {labels.contact.emailHint}
                </span>
              </div>

              {/* Téléphone (Masqué) */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="contactPhone"
                    className="text-sm font-medium text-text-primary"
                  >
                    {labels.contact.phoneLabel}
                  </label>
                  <span className="rounded-pill bg-feedback-warning-bg px-2 py-1 text-xs text-feedback-warning-text border-(length:--border-width-thin) border-feedback-warning-border">
                    {labels.contact.maskedBadge}
                  </span>
                </div>
                <input
                  id="contactPhone"
                  type="tel"
                  value={profile.contactPhone || ""}
                  onChange={(e) => updateField("contactPhone", e.target.value)}
                  className={inputClassName(false)}
                  placeholder={labels.contact.placeholders.phone}
                />
                <span className="text-xs text-text-tertiary">
                  {labels.contact.phoneHint}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* ONGLET 4 : BADGE « MARQUE VÉRIFIÉE » (RG46, RG49, RG51) */}
        {/* ============================================================ */}
        {activeTab === "badge" && (
          <div className="flex flex-col gap-6 rounded-lg border-(length:--border-width-thin) border-border-default bg-surface-card p-6">
            <div className="border-b-(length:--border-width-thin) border-border-subtle pb-4">
              <div className="flex items-center gap-2">
                <BadgeCheckIcon
                  className="size-(--size-icon-md) text-text-brand"
                  aria-hidden="true"
                />
                <h3 className="text-heading-3 font-semibold text-text-primary">
                  {labels.badge.title}
                </h3>
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                {labels.badge.subtitle}
              </p>
            </div>

            {profile.badgeStatus === "verified" ? (
              <div className="flex flex-col gap-4 rounded-xl border border-feedback-success-border bg-feedback-success-bg p-5 text-sm text-feedback-success-text shadow-sm">
                <div className="flex items-center gap-2.5">
                  <BadgeCheckIcon
                    className="size-6 text-feedback-success-icon"
                    aria-hidden="true"
                  />
                  <strong className="text-md">
                    {labels.badge.title} : Actif & Vérifié ✓
                  </strong>
                </div>
                <p className="text-xs leading-relaxed text-text-primary">
                  Le badge « Marque vérifiée » est actif pour{" "}
                  <strong>{profile.companyName || "votre marque"}</strong>.
                  Votre nom de domaine (
                  <strong>{profile.website || "maisonsolene.fr"}</strong>) et
                  vos informations d'immatriculation légale (
                  <strong>{profile.legalName || "Maison Solène SAS"}</strong> —
                  N°{" "}
                  <strong>
                    {profile.registrationNumber || "89201145600012"}
                  </strong>
                  ) ont été vérifiés par l’équipe INFLUX.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-feedback-success-border/40 text-xs">
                  <span className="rounded bg-surface-page px-2.5 py-1 font-mono font-bold text-feedback-success-text border border-feedback-success-border">
                    ✓ Badge certifié visible de tous les créateurs
                  </span>
                  <span className="text-text-secondary">
                    Contrôle DNS & Kbis vérifiés
                  </span>
                </div>
              </div>
            ) : profile.badgeStatus === "pending" ? (
              <div className="flex flex-col gap-4 rounded-md border-(length:--border-width-thin) border-feedback-warning-border bg-feedback-warning-bg p-4 text-sm text-feedback-warning-text">
                <div className="flex items-center gap-2">
                  <BadgeCheckIcon
                    className="size-(--size-icon-md) text-feedback-warning-icon"
                    aria-hidden="true"
                  />
                  <strong>{labels.badge.pendingTitle}</strong>
                </div>
                <p>{labels.badge.pendingInstruction}</p>
                <div className="rounded-md bg-surface-page p-3 font-mono text-sm text-text-primary border-(length:--border-width-thin) border-border-default">
                  {profile.badgeDomainProofCode || "INFLUX-VERIF-MS892011"}
                </div>
                <p className="text-xs text-text-secondary">
                  {labels.badge.pendingTimeNotice}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-text-secondary">
                  {labels.badge.unrequestedBody}
                </p>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="legalName"
                      className="text-sm font-medium text-text-primary"
                    >
                      {labels.badge.legalNameLabel}
                    </label>
                    <input
                      id="legalName"
                      type="text"
                      maxLength={160}
                      value={profile.legalName || ""}
                      onChange={(e) => updateField("legalName", e.target.value)}
                      className={inputClassName(false)}
                      placeholder={labels.badge.placeholders.legalName}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="registrationNumber"
                      className="text-sm font-medium text-text-primary"
                    >
                      {labels.badge.regNumberLabel}
                    </label>
                    <input
                      id="registrationNumber"
                      type="text"
                      maxLength={40}
                      value={profile.registrationNumber || ""}
                      onChange={(e) =>
                        updateField("registrationNumber", e.target.value)
                      }
                      className={inputClassName(false)}
                      placeholder={labels.badge.placeholders.regNumber}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBadgeRequest}
                  className="self-start rounded-pill border-(length:--border-width-thick) border-action-secondary-border bg-action-secondary-bg px-4 py-2 text-sm font-medium text-text-primary hover:bg-action-secondary-bg-hover active:bg-action-secondary-bg-active"
                >
                  {labels.badge.ctaRequest}
                </button>
              </div>
            )}
          </div>
        )}

        {/* BARRE D'ACTIONS INCLUANT SOUMISSION ET ENREGISTREMENT */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t-(length:--border-width-thin) border-border-default pt-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={saveStatus === "saving"}
              className="rounded-pill border-(length:--border-width-thick) border-action-secondary-border bg-action-secondary-bg px-6 py-2 text-sm font-medium text-text-primary hover:bg-action-secondary-bg-hover active:bg-action-secondary-bg-active"
            >
              {saveStatus === "saving"
                ? labels.actions.saving
                : labels.actions.saveDraft}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmitForValidation}
              disabled={
                saveStatus === "saving" || missingRequiredForPublish.length > 0
              }
              className="rounded-pill bg-action-primary-bg px-6 py-2 text-sm font-semibold text-text-on-action hover:bg-action-primary-bg-hover active:bg-action-primary-bg-active"
            >
              {labels.actions.submit}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

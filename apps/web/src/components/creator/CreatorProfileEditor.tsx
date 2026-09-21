"use client";

import { useState, useMemo, useEffect } from "react";
import {
  calculateCreatorProfileCompleteness,
  calculateAudienceBand,
  type CreatorProfile,
  type CreatorNetworkInternal,
  type CreatorAudienceIdentified,
  type EditorialTone,
  type TravelScope,
  type CollaborationExperienceBand,
  type CountryShareBand,
  type AudienceGenderBand,
} from "@influx/contracts";
import { inputClassName, RequiredMark } from "@/components/ui/form-controls";
import {
  BadgeCheckIcon,
  CircleAlertIcon,
  LockIcon,
  UserRoundIcon,
} from "@/components/ui/icons";
import {
  FR_CREATOR_PROFILE_LABELS,
  EN_CREATOR_PROFILE_LABELS,
  type CreatorProfileLabels,
} from "./creator-profile-labels";
import { RateCardEditor } from "./RateCardEditor";

export interface CreatorProfileEditorProps {
  initialProfile?: Partial<CreatorProfile>;
  locale?: string;
}

const PRIMARY_TOPIC_OPTIONS = [
  { value: "tech_gadgets", label: "Tech, Informatique & IA" },
  { value: "mode_beaute", label: "Mode, Style & Beauté" },
  { value: "lifestyle_quotidien", label: "Lifestyle & Quotidien" },
  { value: "voyage_aventure", label: "Voyage, Hôtellerie & Plein air" },
  { value: "cuisine_food", label: "Cuisine, Recettes & Gastronomie" },
  { value: "sport_fitness", label: "Sport, Musculation & Bien-être" },
  { value: "gaming_esport", label: "Gaming, Stream & Esport" },
  { value: "business_finance", label: "Business, Entrepreneuriat & Finance" },
  { value: "culture_cinema", label: "Culture, Cinéma & Séries" },
  { value: "automobile_mobilite", label: "Automobile & Nouvelles mobilités" },
] as const;

const EDITORIAL_TONE_OPTIONS: { value: EditorialTone; label: string }[] = [
  { value: "pedagogique", label: "Pédagogique / Vulgarisation" },
  { value: "humoristique", label: "Humoristique / Décalé" },
  { value: "inspirant", label: "Inspirant / Storytelling" },
  { value: "premium_elegant", label: "Premium / Élégant" },
  { value: "direct", label: "Direct / Authentique" },
  { value: "familial", label: "Familial / Grand public" },
  { value: "expert_technique", label: "Expert / Spécialisé" },
];

const TRAVEL_SCOPE_OPTIONS: { value: TravelScope; label: string }[] = [
  {
    value: "none",
    label: "Pas de déplacement (Tournage en studio uniquement)",
  },
  { value: "country", label: "Déplacements nationaux (France entière)" },
  { value: "international", label: "Déplacements internationaux acceptés" },
];

const COLLAB_EXP_OPTIONS: {
  value: CollaborationExperienceBand;
  label: string;
}[] = [
  { value: "none", label: "Premières collaborations" },
  { value: "1_5", label: "1 à 5 partenariats réalisés" },
  { value: "6_20", label: "6 à 20 partenariats réalisés" },
  { value: "gt_20", label: "Plus de 20 partenariats (Expérimenté)" },
];

const COUNTRY_SHARE_OPTIONS: { value: CountryShareBand; label: string }[] = [
  { value: "gte_80", label: "Plus de 80 % de l'audience" },
  { value: "50_80", label: "Entre 50 % et 80 % de l'audience" },
  { value: "lt_50", label: "Moins de 50 % de l'audience" },
];

const GENDER_BAND_OPTIONS: { value: AudienceGenderBand; label: string }[] = [
  { value: "majority_female", label: "Majoritairement féminine (≥ 60%)" },
  { value: "mixed", label: "Mixte / Équilibrée (40-60%)" },
  { value: "majority_male", label: "Majoritairement masculine (≥ 60%)" },
];

const AUDIENCE_COUNTRIES = [
  { code: "FR", label: "France" },
  { code: "BE", label: "Belgique" },
  { code: "CH", label: "Suisse" },
  { code: "CA", label: "Canada" },
  { code: "US", label: "États-Unis" },
  { code: "GB", label: "Royaume-Uni" },
];

const DEFAULT_AUDIENCE: CreatorAudienceIdentified = {
  primaryCountry: "FR",
  primaryCountryShareBand: "50_80",
  genderBand: "majority_male",
  otherCountries: [{ country: "BE", shareBand: "10_25" }],
  figuresSource: "declared",
  figuresUpdatedAt: new Date().toISOString().substring(0, 10),
};

const TEXTAREA_CLASS =
  "w-full rounded-md border-(length:--border-width-thin) border-border-strong bg-surface-page p-4 text-md text-text-primary focus:outline-none";

export function CreatorProfileEditor({
  initialProfile,
  locale,
}: CreatorProfileEditorProps) {
  const labels: CreatorProfileLabels =
    locale === "en" ? EN_CREATOR_PROFILE_LABELS : FR_CREATOR_PROFILE_LABELS;

  const [profile, setProfile] = useState<Partial<CreatorProfile>>(() => ({
    id: initialProfile?.id || "mock-creator-profile-id",
    accountId: initialProfile?.accountId || "mock-creator-account-id",
    alias: initialProfile?.alias || "Profil 7K3M",
    status: initialProfile?.status || "brouillon",
    shortTitle:
      initialProfile?.shortTitle ||
      "Vulgarisateur Tech & IA : tests matériel et workflows productivité",
    bio:
      initialProfile?.bio ||
      "Ingénieur de formation et créateur passionné depuis 5 ans, je conçois des analyses indépendantes et didactiques pour aider ma communauté à maîtriser les nouvelles technologies sans jargon superflu. Orienté formats courts impactants et vidéos de fond sur YouTube.",
    primaryTopic: initialProfile?.primaryTopic || "tech_gadgets",
    secondaryTopics: initialProfile?.secondaryTopics || ["lifestyle_quotidien"],
    editorialTone: initialProfile?.editorialTone || [
      "pedagogique",
      "expert_technique",
    ],
    languages: initialProfile?.languages || ["fr"],
    country: initialProfile?.country || "FR",
    travelScope: initialProfile?.travelScope || "country",
    collaborationExperienceBand:
      initialProfile?.collaborationExperienceBand || "6_20",
    networks: initialProfile?.networks?.length
      ? initialProfile.networks
      : [
          {
            network: "youtube",
            isPrimary: true,
            handle: "@LucasTechFR",
            profileUrl: "https://youtube.com/@LucasTechFR",
            followersCount: 85000,
            audienceBand: "mid",
            engagementRateBand: "3_6",
            figuresSource: "declared",
            figuresUpdatedAt: new Date().toISOString().substring(0, 10),
            hasVerifiedAccountBadge: true,
            hasVerifiedAudienceBadge: true,
          },
          {
            network: "tiktok",
            isPrimary: false,
            handle: "@lucas_tech",
            profileUrl: "https://tiktok.com/@lucas_tech",
            followersCount: 140000,
            audienceBand: "macro",
            figuresSource: "declared",
            figuresUpdatedAt: new Date().toISOString().substring(0, 10),
            hasVerifiedAccountBadge: false,
            hasVerifiedAudienceBadge: false,
          },
        ],
    audience: initialProfile?.audience || DEFAULT_AUDIENCE,
    offers: initialProfile?.offers?.length
      ? initialProfile.offers
      : [
          {
            format: "video_longue",
            network: "youtube",
            priceBand: "2000_5000",
            currency: "EUR",
            deliveryLeadBand: "15_30d",
            includedUsageRights: ["digital_organic"],
            optionalUsageRights: ["digital_paid_ads", "website_embed"],
            exclusivity: "1_month",
            exactAmountMinor: 350000,
            estimatedNetMinMinor: 130000,
            estimatedNetMaxMinor: 325000,
          },
          {
            format: "reel",
            network: "tiktok",
            priceBand: "500_1000",
            currency: "EUR",
            deliveryLeadBand: "7_14d",
            includedUsageRights: ["digital_organic"],
            optionalUsageRights: ["digital_paid_ads"],
            exclusivity: "none",
            exactAmountMinor: 80000,
            estimatedNetMinMinor: 32500,
            estimatedNetMaxMinor: 65000,
          },
        ],
    availability: initialProfile?.availability || "lt_2w",
    availabilityDeclaredAt:
      initialProfile?.availabilityDeclaredAt || new Date().toISOString(),
    acceptsNonMonetaryCounterpart:
      initialProfile?.acceptsNonMonetaryCounterpart ?? false,
    portfolio: initialProfile?.portfolio?.length
      ? initialProfile.portfolio
      : [
          {
            id: "e4b47f02-1234-4567-8901-000000000001",
            imageUrl:
              "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800",
            caption:
              "Tournage studio configuration setup minimaliste pour test",
            brandNamed: "SetupTech",
            brandConsentConfirmed: true,
            displayOrder: 1,
            status: "approved",
            uploadedAt: new Date().toISOString(),
            exifStripped: true,
          },
          {
            id: "e4b47f02-1234-4567-8901-000000000002",
            imageUrl:
              "https://images.unsplash.com/photo-1526738549149-8e07eca6c147?w=800",
            caption: "Prise de vue produit high-tech en éclairage dynamique",
            brandNamed: "SoundVibe",
            brandConsentConfirmed: true,
            displayOrder: 2,
            status: "approved",
            uploadedAt: new Date().toISOString(),
            exifStripped: true,
          },
        ],
    searchVisibility: initialProfile?.searchVisibility ?? true,
    pseudonym: initialProfile?.pseudonym || "Lucas Tech",
    city: initialProfile?.city || "Lyon",
    legalFirstName: initialProfile?.legalFirstName || "Lucas",
    legalLastName: initialProfile?.legalLastName || "Martinez",
    email: initialProfile?.email || "lucas.tech@example.com",
    phone: initialProfile?.phone || "+33 6 45 78 12 34",
    postalAddress:
      initialProfile?.postalAddress || "45 quai Rambaud, 69002 Lyon",
    declaredStatus: initialProfile?.declaredStatus || "professional",
    refusedSectors: initialProfile?.refusedSectors || [
      "jeux_argent",
      "crypto_speculation",
    ],
  }));

  const [activeTab, setActiveTab] = useState<"public" | "private" | "preview">(
    "public",
  );
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "submitting" | "submitted" | "error"
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
        const res = await fetch("/api/profiles/creator/me", {
          credentials: "include",
        });

        if (res.status === 401) {
          if (mounted) {
            setAuthError(
              locale === "en"
                ? "You must be signed in with a Creator account to view and edit this profile."
                : "Vous devez être connecté avec un compte Créateur pour modifier ce profil.",
            );
          }
          return;
        }

        if (res.status === 403) {
          if (mounted) {
            setAuthError(
              locale === "en"
                ? "This page is reserved for Creator accounts. Use the DEV MOCK toolbar below to switch to a Creator persona (e.g. Lucas Tech or Sophie Mode)."
                : "Cette page est réservée aux comptes Créateurs. Utilisez la barre DEV MOCK en bas pour sélectionner un profil Créateur (ex: Lucas Tech ou Sophie Mode).",
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
              // Fallback ensure arrays exist
              secondaryTopics:
                data.profile.secondaryTopics || prev.secondaryTopics || [],
              editorialTone:
                data.profile.editorialTone || prev.editorialTone || [],
              networks: data.profile.networks?.length
                ? data.profile.networks
                : prev.networks,
              offers: data.profile.offers?.length
                ? data.profile.offers
                : prev.offers,
              languages: data.profile.languages?.length
                ? data.profile.languages
                : prev.languages,
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

  // Identifier detection in Bio & Short Title (RG27)
  const hasIdentifierInBioOrTitle = useMemo(() => {
    const text = `${profile.shortTitle || ""} ${profile.bio || ""}`;
    return (
      /@[\w.-]+/.test(text) ||
      /https?:\/\//.test(text) ||
      /\b[\w.-]+@[\w.-]+\.\w+\b/.test(text) ||
      /\b0[1-9](?:[ .-]?\d{2}){4}\b/.test(text)
    );
  }, [profile.shortTitle, profile.bio]);

  const completeness = useMemo(() => {
    return calculateCreatorProfileCompleteness(profile);
  }, [profile]);

  const { score, breakdown, missingRequiredForPublish } = completeness;

  function updateField<K extends keyof CreatorProfile>(
    key: K,
    value: CreatorProfile[K],
  ) {
    setProfile((prev) => ({
      ...prev,
      [key]: value,
    }));
    setSaveStatus("idle");
    setFeedbackMessage(null);
  }

  function updateAudience(partial: Partial<CreatorAudienceIdentified>) {
    const current = profile.audience || DEFAULT_AUDIENCE;
    const merged: CreatorAudienceIdentified = {
      ...current,
      ...partial,
      otherCountries: partial.otherCountries || current.otherCountries || [],
    };
    updateField("audience", merged);
  }

  function updateNetwork(
    idx: number,
    partial: Partial<CreatorNetworkInternal>,
  ) {
    const networks = profile.networks || [];
    const updated = networks.map((net, i) => {
      if (i === idx) {
        return { ...net, ...partial } as CreatorNetworkInternal;
      }
      return net;
    });
    updateField("networks", updated);
  }

  function toggleSecondaryTopic(topic: string) {
    setProfile((prev) => {
      const current = prev.secondaryTopics || [];
      if (current.includes(topic)) {
        return {
          ...prev,
          secondaryTopics: current.filter((t) => t !== topic),
        };
      }
      if (current.length >= 3) return prev;
      return {
        ...prev,
        secondaryTopics: [...current, topic],
      };
    });
    setSaveStatus("idle");
  }

  function toggleEditorialTone(tone: EditorialTone) {
    setProfile((prev) => {
      const current = prev.editorialTone || [];
      if (current.includes(tone)) {
        return {
          ...prev,
          editorialTone: current.filter((t) => t !== tone),
        };
      }
      if (current.length >= 2) return prev;
      return {
        ...prev,
        editorialTone: [...current, tone],
      };
    });
    setSaveStatus("idle");
  }

  async function handleSaveDraft() {
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/profiles/creator/me", {
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
        setFeedbackMessage(labels.actions.savedSuccess);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setSaveStatus("error");
        setFeedbackMessage(errJson.message || labels.actions.fixErrors);
      }
    } catch {
      setSaveStatus("error");
      setFeedbackMessage(labels.actions.fixErrors);
    }
  }

  async function handleSubmitForValidation() {
    if (missingRequiredForPublish.length > 0 || hasIdentifierInBioOrTitle) {
      setSaveStatus("error");
      setFeedbackMessage(labels.actions.fixErrors);
      return;
    }
    setSaveStatus("submitting");
    try {
      // 1. Sauvegarder d'abord
      await fetch("/api/profiles/creator/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(profile),
      });

      // 2. Soumettre pour validation
      const res = await fetch("/api/profiles/creator/me/submit", {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setProfile((prev) => ({ ...prev, ...data.profile }));
        } else {
          updateField("status", "en_attente");
        }
        setSaveStatus("submitted");
        setFeedbackMessage(labels.actions.submittedSuccess);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setSaveStatus("error");
        setFeedbackMessage(errJson.message || labels.actions.fixErrors);
      }
    } catch {
      setSaveStatus("error");
      setFeedbackMessage(labels.actions.fixErrors);
    }
  }

  const statusTitle =
    labels.statusBanner.title[
      profile.status as keyof typeof labels.statusBanner.title
    ] || labels.statusBanner.title.brouillon;
  const statusDesc =
    labels.statusBanner.description[
      profile.status as keyof typeof labels.statusBanner.description
    ] || labels.statusBanner.description.brouillon;

  const scoreDisplay = `${score}%`;
  const maxScoreDisplay = labels.completeness.maxScore;
  const titleCharCount = `${profile.shortTitle?.length || 0} / 120`;
  const bioCharCount = `${profile.bio?.length || 0} / 800 (min. 150)`;

  const presentationPtsDisplay = `${breakdown.presentation || 0} / 15 ${labels.completeness.blocks.pts}`;
  const editorialPtsDisplay = `${breakdown.editorial || 0} / 14 ${labels.completeness.blocks.pts}`;
  const networksPtsDisplay = `${breakdown.networks || 0} / 22 ${labels.completeness.blocks.pts}`;
  const audiencePtsDisplay = `${breakdown.audience || 0} / 20 ${labels.completeness.blocks.pts}`;
  const offersPtsDisplay = `${breakdown.offers || 0} / 19 ${labels.completeness.blocks.pts}`;
  const portfolioPtsDisplay = `${breakdown.portfolio || 0} / 8 ${labels.completeness.blocks.pts}`;
  const trustPtsDisplay = `${breakdown.trust || 0} / 2 ${labels.completeness.blocks.pts}`;

  const missingCountDisplay = `${missingRequiredForPublish.length}`;
  const missingListDisplay = missingRequiredForPublish.join(", ");

  const aliasContextTag = `${profile.alias} — ${
    PRIMARY_TOPIC_OPTIONS.find((t) => t.value === profile.primaryTopic)
      ?.label || "Créateur"
  } · ${profile.country || "FR"}`;

  const hasAudienceBadge = profile.networks?.some(
    (n) => n.hasVerifiedAudienceBadge,
  );
  const hasAccountBadge = profile.networks?.some(
    (n) => n.hasVerifiedAccountBadge,
  );

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
            ? "Loading creator profile..."
            : "Chargement du profil créateur..."}
        </div>
      ) : null}
      {/* 1. BANDEAU DE STATUT DU PROFIL (RG3, RG9, RG111) */}
      <section
        aria-label={labels.statusBanner.ariaLabel}
        className={`flex flex-col gap-3 rounded-lg border-(length:--border-width-thin) p-6 ${
          profile.status === "publie"
            ? "bg-feedback-success-bg border-feedback-success-border text-text-primary"
            : profile.status === "en_attente"
              ? "bg-feedback-warning-bg border-feedback-warning-border text-text-primary"
              : profile.status === "refuse"
                ? "bg-feedback-error-bg border-feedback-error-border text-text-primary"
                : "bg-surface-card border-border-default text-text-primary"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {hasAudienceBadge ? (
              <span className="inline-flex items-center gap-1 rounded-pill bg-feedback-success-bg px-3 py-1 text-xs font-semibold text-feedback-success-text border border-feedback-success-border">
                <BadgeCheckIcon className="size-3.5" aria-hidden="true" />
                <span>Audience Vérifiée (&lt; 90j) ✓</span>
              </span>
            ) : hasAccountBadge ? (
              <span className="inline-flex items-center gap-1 rounded-pill bg-surface-raised px-3 py-1 text-xs font-medium text-text-secondary border border-border-subtle">
                <BadgeCheckIcon className="size-3.5" aria-hidden="true" />
                <span>Compte Vérifié ✓</span>
              </span>
            ) : null}
            <span
              className={`rounded-pill px-3 py-1 text-xs font-semibold border-(length:--border-width-thin) ${
                profile.status === "publie"
                  ? "bg-feedback-success-bg text-feedback-success-text border-feedback-success-border"
                  : profile.status === "en_attente"
                    ? "bg-feedback-warning-bg text-feedback-warning-text border-feedback-warning-border"
                    : profile.status === "refuse"
                      ? "bg-feedback-error-bg text-feedback-error-text border-feedback-error-border"
                      : "bg-surface-raised text-text-secondary border-border-subtle"
              }`}
            >
              {statusTitle}
            </span>
          </div>
          <span className="text-xs text-text-tertiary">
            {labels.actions.autoSaved}
          </span>
        </div>
        <p className="text-sm text-text-secondary">{statusDesc}</p>
        {profile.status === "refuse" && profile.rejectionReason && (
          <div className="rounded-md border-(length:--border-width-thin) border-feedback-error-border bg-surface-page p-3 text-xs text-feedback-error-text">
            <strong>{labels.statusBanner.rejectionReasonLabel}</strong>{" "}
            <span>
              {labels.rejectionReasons[profile.rejectionReason] ||
                profile.rejectionMessage ||
                profile.rejectionReason}
            </span>
          </div>
        )}
      </section>

      {/* 2. JAUGE DE COMPLÉTUDE VISUELLE FACTUELLE (RG86, RG87, RG90) */}
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
              {labels.completeness.heading}
            </h2>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-display font-bold text-text-brand">
              {scoreDisplay}
            </span>
            <span className="text-sm text-text-secondary">
              {maxScoreDisplay}
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
            aria-label={labels.completeness.heading}
          />
        </div>

        {/* Décomposition par bloc (RG87 : 15/14/22/20/19/8/2) */}
        <div className="grid grid-cols-2 gap-3 text-xs text-text-secondary sm:grid-cols-4 lg:grid-cols-7">
          <div className="rounded-md bg-surface-page p-3 border-(length:--border-width-thin) border-border-subtle">
            <span className="block text-text-tertiary">
              {labels.completeness.blocks.presentation}
            </span>
            <span className="text-md font-semibold text-text-primary">
              {presentationPtsDisplay}
            </span>
          </div>
          <div className="rounded-md bg-surface-page p-3 border-(length:--border-width-thin) border-border-subtle">
            <span className="block text-text-tertiary">
              {labels.completeness.blocks.editorial}
            </span>
            <span className="text-md font-semibold text-text-primary">
              {editorialPtsDisplay}
            </span>
          </div>
          <div className="rounded-md bg-surface-page p-3 border-(length:--border-width-thin) border-border-subtle">
            <span className="block text-text-tertiary">
              {labels.completeness.blocks.networks}
            </span>
            <span className="text-md font-semibold text-text-primary">
              {networksPtsDisplay}
            </span>
          </div>
          <div className="rounded-md bg-surface-page p-3 border-(length:--border-width-thin) border-border-subtle">
            <span className="block text-text-tertiary">
              {labels.completeness.blocks.audience}
            </span>
            <span className="text-md font-semibold text-text-primary">
              {audiencePtsDisplay}
            </span>
          </div>
          <div className="rounded-md bg-surface-page p-3 border-(length:--border-width-thin) border-border-subtle">
            <span className="block text-text-tertiary">
              {labels.completeness.blocks.offers}
            </span>
            <span className="text-md font-semibold text-text-primary">
              {offersPtsDisplay}
            </span>
          </div>
          <div className="rounded-md bg-surface-page p-3 border-(length:--border-width-thin) border-border-subtle">
            <span className="block text-text-tertiary">
              {labels.completeness.blocks.portfolio}
            </span>
            <span className="text-md font-semibold text-text-primary">
              {portfolioPtsDisplay}
            </span>
          </div>
          <div className="rounded-md bg-surface-page p-3 border-(length:--border-width-thin) border-border-subtle">
            <span className="block text-text-tertiary">
              {labels.completeness.blocks.trust}
            </span>
            <span className="text-md font-semibold text-text-primary">
              {trustPtsDisplay}
            </span>
          </div>
        </div>

        {/* Message factuel des champs obligatoires manquants (RG90) */}
        {missingRequiredForPublish.length > 0 ? (
          <div className="flex items-start gap-2 rounded-md border-(length:--border-width-thin) border-feedback-warning-border bg-feedback-warning-bg p-3 text-sm text-feedback-warning-text">
            <CircleAlertIcon
              aria-hidden="true"
              className="size-(--size-icon-sm) shrink-0 text-feedback-warning-icon mt-1"
            />
            <span>
              {labels.completeness.messages.missingPrefix}{" "}
              <strong>{missingCountDisplay}</strong>{" "}
              {labels.completeness.messages.missingSuffix} {missingListDisplay}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-md border-(length:--border-width-thin) border-feedback-success-border bg-feedback-success-bg p-3 text-sm text-feedback-success-text">
            <BadgeCheckIcon
              aria-hidden="true"
              className="size-(--size-icon-sm) shrink-0 text-feedback-success-icon"
            />
            <span>{labels.completeness.messages.readyToPublish}</span>
          </div>
        )}
      </section>

      {/* 3. NAVIGATION PAR ONGLETS (17 §1.1) */}
      <nav
        aria-label={labels.tabs.ariaLabel}
        className="flex border-b-(length:--border-width-thin) border-border-default"
      >
        <button
          type="button"
          onClick={() => setActiveTab("public")}
          className={`px-6 py-3 text-sm font-semibold border-b-(length:--border-width-thick) ${
            activeTab === "public"
              ? "border-border-selected text-text-brand"
              : "border-border-subtle text-text-secondary hover:text-text-primary"
          }`}
        >
          {labels.tabs.publicView}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("private")}
          className={`px-6 py-3 text-sm font-semibold border-b-(length:--border-width-thick) ${
            activeTab === "private"
              ? "border-border-selected text-text-brand"
              : "border-border-subtle text-text-secondary hover:text-text-primary"
          }`}
        >
          {labels.tabs.privateCoordinates}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("preview")}
          className={`px-6 py-3 text-sm font-semibold border-b-(length:--border-width-thick) ${
            activeTab === "preview"
              ? "border-border-selected text-text-brand"
              : "border-border-subtle text-text-secondary hover:text-text-primary"
          }`}
        >
          {labels.tabs.anonymousCardPreview}
        </button>
      </nav>

      {/* 4. CONTENU DE L'ONGLET SÉLECTIONNÉ */}
      {activeTab === "public" && (
        <div className="flex flex-col gap-6">
          {/* Alias Security Notice (RG23, RG24) */}
          <div className="flex items-start gap-3 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-card p-4">
            <UserRoundIcon
              className="size-(--size-icon-md) shrink-0 text-text-brand mt-1"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-text-primary">
                {labels.aliasNotice.title}
              </span>
              <p className="text-text-secondary">{labels.aliasNotice.body}</p>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-text-tertiary">
                  {labels.aliasNotice.contextBadge}
                </span>
                <span className="rounded-pill bg-surface-raised px-2 py-1 font-mono text-text-brand border-(length:--border-width-thin) border-border-subtle">
                  {aliasContextTag}
                </span>
              </div>
            </div>
          </div>

          {/* Bloc 1 : Présentation (RG25, RG26, RG27) */}
          <section className="flex flex-col gap-4 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-card p-6">
            <div className="flex items-center justify-between border-b-(length:--border-width-thin) border-border-subtle pb-3">
              <div>
                <h3 className="text-heading-3 font-semibold text-text-primary">
                  {labels.presentation.title}
                </h3>
                <p className="text-xs text-text-secondary">
                  {labels.presentation.subtitle}
                </p>
              </div>
              <span className="rounded-pill bg-surface-raised px-3 py-1 text-xs text-text-secondary border-(length:--border-width-thin) border-border-subtle">
                {labels.layers.publicBadge}
              </span>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 text-xs text-text-secondary">
                <label
                  htmlFor="creator-alias"
                  className="font-medium text-text-primary"
                >
                  {labels.presentation.aliasLabel}
                </label>
                <input
                  id="creator-alias"
                  type="text"
                  readOnly
                  value={profile.alias}
                  className={`${inputClassName(false)} bg-surface-raised font-mono font-bold text-text-brand`}
                />
              </div>

              <div className="flex flex-col gap-1 text-xs text-text-secondary">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="creator-short-title"
                    className="font-medium text-text-primary"
                  >
                    {labels.presentation.shortTitleLabel}{" "}
                    <RequiredMark mark="*" />
                  </label>
                  <span className="text-text-tertiary">{titleCharCount}</span>
                </div>
                <input
                  id="creator-short-title"
                  type="text"
                  value={profile.shortTitle}
                  onChange={(e) => updateField("shortTitle", e.target.value)}
                  placeholder={labels.presentation.placeholders.shortTitle}
                  className={inputClassName(
                    !profile.shortTitle || profile.shortTitle.length < 20,
                  )}
                  maxLength={120}
                />
                <span className="text-text-tertiary">
                  {labels.presentation.shortTitleHint}
                </span>
              </div>

              <div className="flex flex-col gap-1 text-xs text-text-secondary">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="creator-bio"
                    className="font-medium text-text-primary"
                  >
                    {labels.presentation.bioLabel} <RequiredMark mark="*" />
                  </label>
                  <span className="text-text-tertiary">{bioCharCount}</span>
                </div>
                <textarea
                  id="creator-bio"
                  rows={4}
                  value={profile.bio}
                  onChange={(e) => updateField("bio", e.target.value)}
                  placeholder={labels.presentation.placeholders.bio}
                  className={TEXTAREA_CLASS}
                  maxLength={800}
                />
                <span className="text-text-tertiary">
                  {labels.presentation.bioHint}
                </span>
              </div>

              {hasIdentifierInBioOrTitle && (
                <div className="flex items-center gap-2 rounded-md border-(length:--border-width-thin) border-feedback-error-border bg-feedback-error-bg p-3 text-xs text-feedback-error-text">
                  <CircleAlertIcon
                    className="size-(--size-icon-sm) shrink-0 text-feedback-error-icon"
                    aria-hidden="true"
                  />
                  <span>{labels.presentation.identifierWarning}</span>
                </div>
              )}
            </div>
          </section>

          {/* Bloc 2 : Ligne éditoriale (RG33-RG40) */}
          <section className="flex flex-col gap-4 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-card p-6">
            <div className="flex items-center justify-between border-b-(length:--border-width-thin) border-border-subtle pb-3">
              <div>
                <h3 className="text-heading-3 font-semibold text-text-primary">
                  {labels.editorial.title}
                </h3>
                <p className="text-xs text-text-secondary">
                  {labels.editorial.subtitle}
                </p>
              </div>
              <span className="rounded-pill bg-surface-raised px-3 py-1 text-xs text-text-secondary border-(length:--border-width-thin) border-border-subtle">
                {labels.layers.publicBadge}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-xs text-text-secondary">
                <span className="font-medium text-text-primary">
                  {labels.editorial.primaryTopicLabel} <RequiredMark mark="*" />
                </span>
                <select
                  value={profile.primaryTopic}
                  onChange={(e) => updateField("primaryTopic", e.target.value)}
                  className={inputClassName(!profile.primaryTopic)}
                >
                  <option value="">{labels.editorial.primaryTopicEmpty}</option>
                  {PRIMARY_TOPIC_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs text-text-secondary">
                <span className="font-medium text-text-primary">
                  {labels.editorial.travelScopeLabel}
                </span>
                <select
                  value={profile.travelScope}
                  onChange={(e) =>
                    updateField("travelScope", e.target.value as TravelScope)
                  }
                  className={inputClassName(false)}
                >
                  {TRAVEL_SCOPE_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs text-text-secondary">
                <span className="font-medium text-text-primary">
                  {labels.editorial.experienceLabel}
                </span>
                <select
                  value={profile.collaborationExperienceBand}
                  onChange={(e) =>
                    updateField(
                      "collaborationExperienceBand",
                      e.target.value as CollaborationExperienceBand,
                    )
                  }
                  className={inputClassName(false)}
                >
                  <option value="">{labels.editorial.experienceEmpty}</option>
                  {COLLAB_EXP_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Secondary topics chips */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-text-primary">
                {labels.editorial.secondaryTopicsLabel}
              </span>
              <div className="flex flex-wrap gap-2">
                {PRIMARY_TOPIC_OPTIONS.map((topic) => {
                  const isSelected = profile.secondaryTopics?.includes(
                    topic.value,
                  );
                  return (
                    <button
                      key={`sec-${topic.value}`}
                      type="button"
                      onClick={() => toggleSecondaryTopic(topic.value)}
                      className={`rounded-pill px-3 py-1 text-xs font-medium border-(length:--border-width-thin) ${
                        isSelected
                          ? "bg-action-primary-bg text-text-on-action border-action-primary-bg"
                          : "bg-surface-raised text-text-secondary border-border-subtle hover:text-text-primary"
                      }`}
                    >
                      {topic.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Editorial tones chips */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-text-primary">
                {labels.editorial.toneLabel}
              </span>
              <div className="flex flex-wrap gap-2">
                {EDITORIAL_TONE_OPTIONS.map((tone) => {
                  const isSelected = profile.editorialTone?.includes(
                    tone.value,
                  );
                  return (
                    <button
                      key={`tone-${tone.value}`}
                      type="button"
                      onClick={() => toggleEditorialTone(tone.value)}
                      className={`rounded-pill px-3 py-1 text-xs font-medium border-(length:--border-width-thin) ${
                        isSelected
                          ? "bg-action-primary-bg text-text-on-action border-action-primary-bg"
                          : "bg-surface-raised text-text-secondary border-border-subtle hover:text-text-primary"
                      }`}
                    >
                      {tone.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Bloc 4 : Audience (RG57-RG64) */}
          <section className="flex flex-col gap-4 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-card p-6">
            <div className="flex items-center justify-between border-b-(length:--border-width-thin) border-border-subtle pb-3">
              <div>
                <h3 className="text-heading-3 font-semibold text-text-primary">
                  {labels.audience.title}
                </h3>
                <p className="text-xs text-text-secondary">
                  {labels.audience.subtitle}
                </p>
              </div>
              <span className="rounded-pill bg-surface-raised px-3 py-1 text-xs text-text-secondary border-(length:--border-width-thin) border-border-subtle">
                {labels.layers.publicBadge}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-text-secondary">
                <span className="font-medium text-text-primary">
                  {labels.audience.primaryCountryLabel}{" "}
                  <RequiredMark mark="*" />
                </span>
                <select
                  value={profile.audience?.primaryCountry || "FR"}
                  onChange={(e) =>
                    updateAudience({ primaryCountry: e.target.value })
                  }
                  className={inputClassName(false)}
                >
                  {AUDIENCE_COUNTRIES.map((ac) => (
                    <option key={ac.code} value={ac.code}>
                      {ac.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs text-text-secondary">
                <span className="font-medium text-text-primary">
                  {labels.audience.primaryCountryShareLabel}
                </span>
                <select
                  value={profile.audience?.primaryCountryShareBand || "50_80"}
                  onChange={(e) =>
                    updateAudience({
                      primaryCountryShareBand: e.target
                        .value as CountryShareBand,
                    })
                  }
                  className={inputClassName(false)}
                >
                  {COUNTRY_SHARE_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-xs text-text-secondary">
                <span className="font-medium text-text-primary">
                  {labels.audience.genderBreakdownLabel}
                </span>
                <select
                  value={profile.audience?.genderBand || "majority_male"}
                  onChange={(e) =>
                    updateAudience({
                      genderBand: e.target.value as AudienceGenderBand,
                    })
                  }
                  className={inputClassName(false)}
                >
                  {GENDER_BAND_OPTIONS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {/* Bloc 5 : Barème d'offres & Tarifs indicatifs (RateCardEditor) (RG65-RG73) */}
          <section className="flex flex-col gap-4 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-card p-6">
            <RateCardEditor
              offers={profile.offers || []}
              availability={profile.availability || "lt_2w"}
              acceptsNonMonetaryCounterpart={
                profile.acceptsNonMonetaryCounterpart ?? false
              }
              onChangeOffers={(offers) => updateField("offers", offers)}
              onChangeAvailability={(val) => updateField("availability", val)}
              onChangeAcceptsGifts={(val) =>
                updateField("acceptsNonMonetaryCounterpart", val)
              }
              labels={labels}
              locale={locale}
            />
          </section>

          {/* Bloc 6 : Portfolio de créations (RG78-RG85) */}
          <section className="flex flex-col gap-4 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-card p-6">
            <div className="flex items-center justify-between border-b-(length:--border-width-thin) border-border-subtle pb-3">
              <div>
                <h3 className="text-heading-3 font-semibold text-text-primary">
                  {labels.portfolio.title}
                </h3>
                <p className="text-xs text-text-secondary">
                  {labels.portfolio.subtitle}
                </p>
              </div>
              <span className="rounded-pill bg-surface-raised px-3 py-1 text-xs text-text-secondary border-(length:--border-width-thin) border-border-subtle">
                {labels.layers.publicBadge}
              </span>
            </div>

            <div className="rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-page p-3 text-xs text-text-secondary">
              {labels.portfolio.publicNotice}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {profile.portfolio?.map((item) => {
                const statusBadge =
                  item.status === "approved"
                    ? labels.portfolio.approvedBadge
                    : item.status === "rejected"
                      ? labels.portfolio.rejectedBadge
                      : labels.portfolio.pendingBadge;

                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-page p-3"
                  >
                    <div className="relative aspect-card-id1 w-full overflow-hidden rounded-md bg-surface-raised">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute bottom-2 left-2 rounded-pill bg-surface-card px-2 py-1 text-xs font-medium text-text-primary border-(length:--border-width-thin) border-border-subtle">
                        {statusBadge}
                      </span>
                    </div>

                    <span className="text-xs font-medium text-text-primary">
                      {item.caption || "Visuel sans description"}
                    </span>
                    {item.brandNamed && (
                      <span className="text-xs text-text-tertiary">
                        {item.brandNamed}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Bloc 7 : Paramètres de visibilité recherche (RG8, RG877) */}
          <section className="flex flex-col gap-4 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-heading-3 font-semibold text-text-primary">
                  {labels.searchVisibility.title}
                </h3>
                <p className="text-xs text-text-secondary">
                  {labels.searchVisibility.description}
                </p>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={profile.searchVisibility}
                  onChange={(e) =>
                    updateField("searchVisibility", e.target.checked)
                  }
                  className="size-(--size-icon-sm) rounded-sm border-(length:--border-width-thin) border-border-subtle"
                />
                <span className="text-xs font-semibold text-text-primary">
                  {labels.searchVisibility.toggleLabel}
                </span>
              </label>
            </div>
            {!profile.searchVisibility && (
              <div className="rounded-md border-(length:--border-width-thin) border-feedback-warning-border bg-feedback-warning-bg p-3 text-xs text-feedback-warning-text">
                {labels.searchVisibility.offWarning}
              </div>
            )}
          </section>
        </div>
      )}

      {/* 5. ONGLET COORDONNÉES PRIVÉES (Couches I & N) */}
      {activeTab === "private" && (
        <div className="flex flex-col gap-6">
          {/* D40 Notice */}
          <div className="flex items-start gap-3 rounded-md border-(length:--border-width-thin) border-feedback-info-border bg-feedback-info-bg p-4 text-text-primary">
            <LockIcon
              className="size-(--size-icon-md) shrink-0 text-feedback-info-icon mt-1"
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-feedback-info-text">
                {labels.privateCoords.d40NoticeTitle}
              </span>
              <p className="text-text-secondary">
                {labels.privateCoords.d40NoticeBody}
              </p>
            </div>
          </div>

          {/* Réseaux sociaux & URLs (Couche I) */}
          <section className="flex flex-col gap-4 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-card p-6">
            <div className="flex items-center justify-between border-b-(length:--border-width-thin) border-border-subtle pb-3">
              <div>
                <h3 className="text-heading-3 font-semibold text-text-primary">
                  {labels.networks.title}
                </h3>
                <p className="text-xs text-text-secondary">
                  {labels.networks.subtitle}
                </p>
              </div>
              <span className="rounded-pill bg-surface-raised px-3 py-1 text-xs text-text-secondary border-(length:--border-width-thin) border-border-subtle">
                {labels.layers.revealedBadge}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              {profile.networks?.map((net, idx) => {
                const networkBand = calculateAudienceBand(net.followersCount);
                const followersFormatted = `${net.followersCount.toLocaleString()} abonnés · Tranche : ${networkBand}`;
                const dateDisplay = `Màj : ${net.figuresUpdatedAt}`;

                return (
                  <div
                    key={`net-${idx}`}
                    className="flex flex-col gap-3 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-page p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold capitalize text-text-primary">
                          {net.network}
                        </span>
                        {net.isPrimary && (
                          <span className="rounded-pill bg-action-primary-bg px-2 py-1 text-xs font-semibold text-text-on-action">
                            {labels.networks.primaryBadge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {net.hasVerifiedAccountBadge && (
                          <span className="rounded-pill bg-feedback-success-bg px-2 py-1 text-xs text-feedback-success-text border-(length:--border-width-thin) border-feedback-success-border">
                            {labels.networks.verifiedAccountBadge}
                          </span>
                        )}
                        {net.hasVerifiedAudienceBadge && (
                          <span className="rounded-pill bg-feedback-success-bg px-2 py-1 text-xs text-feedback-success-text border-(length:--border-width-thin) border-feedback-success-border">
                            {labels.networks.verifiedAudienceBadge}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="flex flex-col gap-1 text-xs text-text-secondary">
                        <span className="font-medium text-text-primary">
                          {labels.networks.handleCol}
                        </span>
                        <input
                          type="text"
                          value={net.handle}
                          onChange={(e) =>
                            updateNetwork(idx, { handle: e.target.value })
                          }
                          className={inputClassName(false)}
                          placeholder={labels.networks.placeholders.handle}
                        />
                      </div>

                      <div className="flex flex-col gap-1 text-xs text-text-secondary">
                        <span className="font-medium text-text-primary">
                          {labels.networks.profileUrlCol}
                        </span>
                        <input
                          type="url"
                          value={net.profileUrl}
                          onChange={(e) =>
                            updateNetwork(idx, { profileUrl: e.target.value })
                          }
                          className={inputClassName(false)}
                          placeholder={labels.networks.placeholders.profileUrl}
                        />
                      </div>

                      <div className="flex flex-col gap-1 text-xs text-text-secondary">
                        <span className="font-medium text-text-primary">
                          {labels.networks.followersCol}
                        </span>
                        <input
                          type="number"
                          value={net.followersCount}
                          onChange={(e) => {
                            const num = parseInt(e.target.value, 10) || 0;
                            updateNetwork(idx, {
                              followersCount: num,
                              audienceBand: calculateAudienceBand(num),
                            });
                          }}
                          className={inputClassName(false)}
                          placeholder={labels.networks.placeholders.followers}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-text-tertiary">
                      <span>{followersFormatted}</span>
                      <span>{dateDisplay}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Données d'identité (Couche I & Couche N) */}
          <section className="flex flex-col gap-4 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-card p-6">
            <div className="flex items-center justify-between border-b-(length:--border-width-thin) border-border-subtle pb-3">
              <div>
                <h3 className="text-heading-3 font-semibold text-text-primary">
                  {labels.privateCoords.title}
                </h3>
                <p className="text-xs text-text-secondary">
                  {labels.privateCoords.subtitle}
                </p>
              </div>
              <span className="rounded-pill bg-surface-raised px-3 py-1 text-xs text-text-secondary border-(length:--border-width-thin) border-border-subtle">
                {labels.layers.internalBadge}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1 text-xs text-text-secondary">
                <label
                  htmlFor="creator-pseudonym"
                  className="font-medium text-text-primary"
                >
                  {labels.privateCoords.pseudonymLabel}
                </label>
                <input
                  id="creator-pseudonym"
                  type="text"
                  value={profile.pseudonym || ""}
                  onChange={(e) => updateField("pseudonym", e.target.value)}
                  placeholder={labels.privateCoords.placeholders.pseudonym}
                  className={inputClassName(false)}
                />
                <span className="text-text-tertiary">
                  {labels.privateCoords.pseudonymHint}
                </span>
              </div>

              <div className="flex flex-col gap-1 text-xs text-text-secondary">
                <label
                  htmlFor="creator-city"
                  className="font-medium text-text-primary"
                >
                  {labels.privateCoords.cityLabel}
                </label>
                <input
                  id="creator-city"
                  type="text"
                  value={profile.city || ""}
                  onChange={(e) => updateField("city", e.target.value)}
                  placeholder={labels.privateCoords.placeholders.city}
                  className={inputClassName(false)}
                />
                <span className="text-text-tertiary">
                  {labels.privateCoords.cityHint}
                </span>
              </div>
            </div>

            {/* Strict Internal Couche N fields */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1 text-xs text-text-secondary">
                <label
                  htmlFor="creator-legal-first"
                  className="font-medium text-text-primary"
                >
                  {labels.privateCoords.legalFirstNameLabel}
                </label>
                <input
                  id="creator-legal-first"
                  type="text"
                  value={profile.legalFirstName || ""}
                  onChange={(e) =>
                    updateField("legalFirstName", e.target.value)
                  }
                  placeholder={labels.privateCoords.placeholders.legalFirstName}
                  className={inputClassName(false)}
                />
              </div>

              <div className="flex flex-col gap-1 text-xs text-text-secondary">
                <label
                  htmlFor="creator-legal-last"
                  className="font-medium text-text-primary"
                >
                  {labels.privateCoords.legalLastNameLabel}
                </label>
                <input
                  id="creator-legal-last"
                  type="text"
                  value={profile.legalLastName || ""}
                  onChange={(e) => updateField("legalLastName", e.target.value)}
                  placeholder={labels.privateCoords.placeholders.legalLastName}
                  className={inputClassName(false)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1 text-xs text-text-secondary">
                <label
                  htmlFor="creator-email"
                  className="font-medium text-text-primary"
                >
                  {labels.privateCoords.emailLabel}
                </label>
                <input
                  id="creator-email"
                  type="email"
                  value={profile.email || ""}
                  onChange={(e) => updateField("email", e.target.value)}
                  placeholder={labels.privateCoords.placeholders.email}
                  className={inputClassName(false)}
                />
              </div>

              <div className="flex flex-col gap-1 text-xs text-text-secondary">
                <label
                  htmlFor="creator-phone"
                  className="font-medium text-text-primary"
                >
                  {labels.privateCoords.phoneLabel}
                </label>
                <input
                  id="creator-phone"
                  type="tel"
                  value={profile.phone || ""}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder={labels.privateCoords.placeholders.phone}
                  className={inputClassName(false)}
                />
              </div>
            </div>

            {/* Refused Sectors (RG75) */}
            <div className="flex flex-col gap-1 text-xs text-text-secondary">
              <label
                htmlFor="creator-refused-sectors"
                className="font-medium text-text-primary"
              >
                {labels.privateCoords.refusedSectorsLabel}
              </label>
              <input
                id="creator-refused-sectors"
                type="text"
                value={profile.refusedSectors?.join(", ") || ""}
                onChange={(e) => {
                  const val = e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  updateField("refusedSectors", val);
                }}
                placeholder={labels.privateCoords.placeholders.refusedSectors}
                className={inputClassName(false)}
              />
              <span className="text-text-tertiary">
                {labels.privateCoords.refusedSectorsHint}
              </span>
            </div>
          </section>
        </div>
      )}

      {/* 6. ONGLET APERÇU CARTE ANONYME (Aperçu en conditions réelles - RG104) */}
      {activeTab === "preview" && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-heading-3 font-semibold text-text-primary">
                {labels.preview.title}
              </h3>
              <p className="text-xs text-text-secondary">
                {labels.preview.subtitle}
              </p>
            </div>
            <span className="rounded-pill bg-action-primary-bg px-3 py-1 text-xs font-semibold text-text-on-action">
              {labels.preview.cardBadge}
            </span>
          </div>

          {/* Carte Anonyme simulée */}
          <div className="mx-auto max-w-(--container-narrow) w-full flex flex-col gap-6 rounded-lg border-(length:--border-width-thin) border-border-subtle bg-surface-card p-6 shadow-md">
            {/* Header de la carte */}
            <div className="flex items-start justify-between border-b-(length:--border-width-thin) border-border-subtle pb-4">
              <div className="flex flex-col gap-1">
                <span className="font-mono text-heading-3 font-bold text-text-brand">
                  {profile.alias}
                </span>
                <span className="text-xs text-text-secondary">
                  {aliasContextTag}
                </span>
              </div>
              <span className="rounded-pill bg-surface-raised px-3 py-1 text-xs font-medium text-text-secondary border-(length:--border-width-thin) border-border-subtle">
                {labels.layers.publicBadge}
              </span>
            </div>

            {/* Titre court & Bio */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-text-primary">
                {profile.shortTitle}
              </span>
              <p className="text-xs leading-relaxed text-text-secondary">
                {profile.bio}
              </p>
            </div>

            {/* Tranches d'audience par réseau (sans handle, sans URL - RG22, RG48) */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-text-primary">
                {labels.preview.networksHeading}
              </span>
              <div className="grid gap-2 sm:grid-cols-2">
                {profile.networks?.map((net, idx) => (
                  <div
                    key={`prev-net-${idx}`}
                    className="flex items-center justify-between rounded-md bg-surface-page p-3 border-(length:--border-width-thin) border-border-subtle text-xs"
                  >
                    <span className="font-semibold capitalize text-text-primary">
                      {net.network}
                    </span>
                    <span className="rounded-pill bg-surface-raised px-2 py-1 text-text-secondary font-mono">
                      {net.audienceBand}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tarifs indicatifs (Tranches sans net estimé exposé à la marque - RG70) */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-text-primary">
                {labels.preview.ratesSummaryHeading}
              </span>
              <div className="grid gap-2 sm:grid-cols-2">
                {profile.offers?.map((offer, idx) => {
                  const offerSummary = `${offer.format} (${offer.network})`;
                  return (
                    <div
                      key={`prev-offer-${idx}`}
                      className="flex items-center justify-between rounded-md bg-surface-page p-3 border-(length:--border-width-thin) border-border-subtle text-xs"
                    >
                      <span className="capitalize text-text-primary">
                        {offerSummary}
                      </span>
                      <span className="font-semibold text-text-brand">
                        {offer.priceBand}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Portfolio modéré (seuls les visuels avec status: approved) */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-text-primary">
                {labels.preview.portfolioHeading}
              </span>
              <div className="grid grid-cols-2 gap-2">
                {profile.portfolio
                  ?.filter((item) => item.status === "approved")
                  .map((item) => (
                    <div
                      key={`prev-port-${item.id}`}
                      className="aspect-card-id1 w-full overflow-hidden rounded-md bg-surface-raised"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. ACTIONS : SAUVEGARDER & SOUMETTRE (RG111) */}
      <footer className="sticky bottom-0 z-(--z-header) flex flex-wrap items-center justify-between gap-4 border-t-(length:--border-width-thin) border-border-default bg-surface-card p-4 rounded-lg shadow-lg">
        <div>
          {feedbackMessage && (
            <span
              className={`text-xs font-medium ${
                saveStatus === "error"
                  ? "text-feedback-error-text"
                  : "text-feedback-success-text"
              }`}
            >
              {feedbackMessage}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={saveStatus === "saving" || saveStatus === "submitting"}
            onClick={handleSaveDraft}
            className="rounded-md border-(length:--border-width-thin) border-border-default bg-surface-raised px-4 py-2 text-xs font-semibold text-text-primary hover:bg-surface-hover"
          >
            {saveStatus === "saving"
              ? labels.actions.saving
              : labels.actions.saveDraft}
          </button>

          <button
            type="button"
            disabled={
              saveStatus === "submitting" ||
              saveStatus === "saving" ||
              missingRequiredForPublish.length > 0 ||
              hasIdentifierInBioOrTitle
            }
            onClick={handleSubmitForValidation}
            className="rounded-md bg-action-primary-bg px-6 py-2 text-xs font-semibold text-text-on-action hover:bg-action-primary-bg-hover"
          >
            {saveStatus === "submitting"
              ? labels.actions.submitting
              : labels.actions.submitForValidation}
          </button>
        </div>
      </footer>
    </div>
  );
}

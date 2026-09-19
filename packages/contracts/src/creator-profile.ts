import { z } from "zod";
import {
  CountryCodeSchema,
  CurrencySchema,
  LanguageSchema,
  ExclusivityBandSchema,
  type ExclusivityBand,
} from "./common";

// ==========================================
// 1. Taxonomies & Listes fermées (RG16, RG33-RG40, RG72)
// ==========================================

export const AudienceBandSchema = z.enum([
  "nano", // < 10k
  "micro", // 10k - 50k
  "mid", // 50k - 100k
  "macro", // 100k - 500k
  "mega", // > 500k
]);
export type AudienceBand = z.infer<typeof AudienceBandSchema>;

export const EngagementBandSchema = z.enum([
  "lt_1", // < 1%
  "1_3", // 1% - 3%
  "3_6", // 3% - 6%
  "gt_6", // > 6%
]);
export type EngagementBand = z.infer<typeof EngagementBandSchema>;

export const PriceBandSchema = z.enum([
  "lt_250",
  "250_500",
  "500_1000",
  "1000_2000",
  "2000_5000",
  "5000_10000",
  "plus_10000",
]);
export type PriceBand = z.infer<typeof PriceBandSchema>;

export const EditorialToneSchema = z.enum([
  "pedagogique",
  "humoristique",
  "inspirant",
  "premium_elegant",
  "direct",
  "familial",
  "expert_technique",
]);
export type EditorialTone = z.infer<typeof EditorialToneSchema>;

export const PublicationFrequencySchema = z.enum([
  "daily",
  "several_per_week",
  "weekly",
  "biweekly",
  "monthly_or_less",
]);
export type PublicationFrequency = z.infer<typeof PublicationFrequencySchema>;

export const DeliveryLeadBandSchema = z.enum([
  "lt_7d",
  "7_14d",
  "15_30d",
  "gt_30d",
]);
export type DeliveryLeadBand = z.infer<typeof DeliveryLeadBandSchema>;

export const TravelScopeSchema = z.enum(["none", "country", "international"]);
export type TravelScope = z.infer<typeof TravelScopeSchema>;

export const CollaborationExperienceBandSchema = z.enum([
  "none",
  "1_5",
  "6_20",
  "gt_20",
]);
export type CollaborationExperienceBand = z.infer<
  typeof CollaborationExperienceBandSchema
>;

export const AvailabilityBandSchema = z.enum(["lt_2w", "lt_1m", "full"]);
export type AvailabilityBand = z.infer<typeof AvailabilityBandSchema>;

export const CountryShareBandSchema = z.enum(["gte_80", "50_80", "lt_50"]);
export type CountryShareBand = z.infer<typeof CountryShareBandSchema>;

export const OtherCountryShareBandSchema = z.enum(["10_25", "25_50", "gt_50"]);
export type OtherCountryShareBand = z.infer<typeof OtherCountryShareBandSchema>;

export const AudienceGenderBandSchema = z.enum([
  "majority_female", // >= 60%
  "mixed",
  "majority_male", // >= 60%
]);
export type AudienceGenderBand = z.infer<typeof AudienceGenderBandSchema>;

export const CreatorProfileStatusSchema = z.enum([
  "brouillon",
  "en_attente",
  "publie",
  "refuse",
  "suspendu",
]);
export type CreatorProfileStatus = z.infer<typeof CreatorProfileStatusSchema>;

export const CreatorRejectionReasonSchema = z.enum([
  "identifier_in_text",
  "bio_too_short_or_unclear",
  "insufficient_portfolio",
  "non_compliant_portfolio",
  "inconsistent_handle_or_link",
  "inconsistent_figures",
  "inconsistent_topic",
  "illicit_or_cgu_violation",
  "age_verification_doubt",
  "other",
]);
export type CreatorRejectionReason = z.infer<
  typeof CreatorRejectionReasonSchema
>;

export const PortfolioItemStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);
export type PortfolioItemStatus = z.infer<typeof PortfolioItemStatusSchema>;

export const PortfolioRejectionReasonSchema = z.enum([
  "watermark_or_logo",
  "handle_or_pseudo_in_image",
  "app_ui_visible",
  "text_or_brand_without_consent",
  "identifying_location",
  "face_revealing",
  "stats_screenshot",
  "exif_not_stripped",
  "illicit_or_cgu_violation",
  "other",
]);
export type PortfolioRejectionReason = z.infer<
  typeof PortfolioRejectionReasonSchema
>;

// ==========================================
// 2. Référentiel des tranches tarifaires et net estimé (RG68, RG72)
// Aucune multiplication dans le code applicatif : valeurs lues telles quelles.
// ==========================================

export interface PriceBandReferenceEntry {
  code: PriceBand;
  currency: string;
  minAmountMinor: number;
  maxAmountMinor: number;
  netMinAmountMinor: number; // 65% pre-computé dans le référentiel
  netMaxAmountMinor: number;
  netBasisLabel: string;
}

export const REFERENCE_PRICE_BANDS: Record<string, PriceBandReferenceEntry> = {
  lt_250: {
    code: "lt_250",
    currency: "EUR",
    minAmountMinor: 0,
    maxAmountMinor: 25000,
    netMinAmountMinor: 0,
    netMaxAmountMinor: 16250,
    netBasisLabel: "Barème plateforme 35 % (20% marque, 15% créateur)",
  },
  "250_500": {
    code: "250_500",
    currency: "EUR",
    minAmountMinor: 25000,
    maxAmountMinor: 50000,
    netMinAmountMinor: 16250,
    netMaxAmountMinor: 32500,
    netBasisLabel: "Barème plateforme 35 % (20% marque, 15% créateur)",
  },
  "500_1000": {
    code: "500_1000",
    currency: "EUR",
    minAmountMinor: 50000,
    maxAmountMinor: 100000,
    netMinAmountMinor: 32500,
    netMaxAmountMinor: 65000,
    netBasisLabel: "Barème plateforme 35 % (20% marque, 15% créateur)",
  },
  "1000_2000": {
    code: "1000_2000",
    currency: "EUR",
    minAmountMinor: 100000,
    maxAmountMinor: 200000,
    netMinAmountMinor: 65000,
    netMaxAmountMinor: 130000,
    netBasisLabel: "Barème plateforme 35 % (20% marque, 15% créateur)",
  },
  "2000_5000": {
    code: "2000_5000",
    currency: "EUR",
    minAmountMinor: 200000,
    maxAmountMinor: 500000,
    netMinAmountMinor: 130000,
    netMaxAmountMinor: 325000,
    netBasisLabel: "Barème plateforme 35 % (20% marque, 15% créateur)",
  },
  "5000_10000": {
    code: "5000_10000",
    currency: "EUR",
    minAmountMinor: 500000,
    maxAmountMinor: 1000000,
    netMinAmountMinor: 325000,
    netMaxAmountMinor: 650000,
    netBasisLabel: "Barème plateforme 35 % (20% marque, 15% créateur)",
  },
  plus_10000: {
    code: "plus_10000",
    currency: "EUR",
    minAmountMinor: 1000000,
    maxAmountMinor: 2500000,
    netMinAmountMinor: 650000,
    netMaxAmountMinor: 1625000,
    netBasisLabel: "Barème plateforme 35 % (20% marque, 15% créateur)",
  },
};

export function getEstimatedNetForPriceBand(
  priceBand: PriceBand,
  _currency: string = "EUR",
): {
  minNetMinor: number;
  maxNetMinor: number;
  label: string;
} {
  const ref = REFERENCE_PRICE_BANDS[priceBand];
  if (!ref) {
    return { minNetMinor: 0, maxNetMinor: 0, label: "" };
  }
  return {
    minNetMinor: ref.netMinAmountMinor,
    maxNetMinor: ref.netMaxAmountMinor,
    label: ref.netBasisLabel,
  };
}

// ==========================================
// 3. Sous-modèles par couche
// ==========================================

// --- Réseaux ---
export const CreatorNetworkPublicSchema = z.object({
  network: z.string().min(1),
  isPrimary: z.boolean().default(false),
  audienceBand: AudienceBandSchema,
  engagementRateBand: EngagementBandSchema.nullable().optional(), // RG48 : STRICTEMENT NUL si non vérifié
  averageReachBand: AudienceBandSchema.nullable().optional(),
  publicationFrequency: PublicationFrequencySchema.nullable().optional(),
  figuresSource: z.enum(["declared", "agent_observed"]).default("declared"),
  figuresUpdatedAt: z.string(),
  hasVerifiedAccountBadge: z.boolean().default(false),
  accountBadgeVerifiedAt: z.string().datetime().nullable().optional(),
  hasVerifiedAudienceBadge: z.boolean().default(false),
  audienceBadgeVerifiedAt: z.string().datetime().nullable().optional(),
});
export type CreatorNetworkPublic = z.infer<typeof CreatorNetworkPublicSchema>;

export const CreatorNetworkIdentifiedSchema = CreatorNetworkPublicSchema.extend(
  {
    handle: z.string().min(1).max(100),
    profileUrl: z.string().url(),
    followersCount: z.number().int().nonnegative(),
    engagementRate: z.number().min(0).max(100).nullable().optional(),
    avgReachPerPost: z.number().int().nonnegative().nullable().optional(),
  },
);
export type CreatorNetworkIdentified = z.infer<
  typeof CreatorNetworkIdentifiedSchema
>;

export const CreatorNetworkInternalSchema =
  CreatorNetworkIdentifiedSchema.extend({
    observedFollowersByAgent: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .optional(),
    observedEngagementByAgent: z.number().min(0).max(100).nullable().optional(),
    evidenceFileUrl: z.string().nullable().optional(),
  });
export type CreatorNetworkInternal = z.infer<
  typeof CreatorNetworkInternalSchema
>;

// --- Audience ---
export const CreatorAudiencePublicSchema = z.object({
  primaryCountry: CountryCodeSchema,
  primaryCountryShareBand: CountryShareBandSchema,
  otherCountries: z
    .array(
      z.object({
        country: CountryCodeSchema,
        shareBand: OtherCountryShareBandSchema,
      }),
    )
    .max(4)
    .default([]),
  ageBands: z
    .object({
      "18_24": z.number().int().min(0).max(100).optional(),
      "25_34": z.number().int().min(0).max(100).optional(),
      "35_44": z.number().int().min(0).max(100).optional(),
      "45_plus": z.number().int().min(0).max(100).optional(),
    })
    .optional(),
  genderBand: AudienceGenderBandSchema.optional(),
  figuresSource: z.enum(["declared", "agent_observed"]).default("declared"),
  figuresUpdatedAt: z.string(),
});
export type CreatorAudiencePublic = z.infer<typeof CreatorAudiencePublicSchema>;

export const CreatorAudienceIdentifiedSchema =
  CreatorAudiencePublicSchema.extend({
    primaryCountrySharePercent: z.number().min(0).max(100).optional(),
    otherCountriesExact: z
      .array(
        z.object({
          country: CountryCodeSchema,
          percent: z.number().min(0).max(100),
        }),
      )
      .optional(),
    exactGenderPercentages: z
      .object({
        female: z.number().min(0).max(100).optional(),
        male: z.number().min(0).max(100).optional(),
        other: z.number().min(0).max(100).optional(),
      })
      .optional(),
  });
export type CreatorAudienceIdentified = z.infer<
  typeof CreatorAudienceIdentifiedSchema
>;

// --- Offres & Tarifs ---
export const CreatorOfferPublicSchema = z.object({
  format: z.string().min(1),
  network: z.string().min(1),
  priceBand: PriceBandSchema,
  currency: CurrencySchema.default("EUR"),
  deliveryLeadBand: DeliveryLeadBandSchema.nullable().optional(),
  includedUsageRights: z.array(z.string()).default([]),
  optionalUsageRights: z.array(z.string()).default([]),
  exclusivity: ExclusivityBandSchema.nullable().optional(),
});
export type CreatorOfferPublic = z.infer<typeof CreatorOfferPublicSchema>;

export const CreatorOfferInternalSchema = CreatorOfferPublicSchema.extend({
  exactAmountMinor: z.number().int().positive().nullable().optional(),
  estimatedNetMinMinor: z.number().int().nonnegative().nullable().optional(),
  estimatedNetMaxMinor: z.number().int().nonnegative().nullable().optional(),
});
export type CreatorOfferInternal = z.infer<typeof CreatorOfferInternalSchema>;

// --- Portfolio ---
export const PortfolioItemPublicSchema = z.object({
  id: z.string().uuid(),
  imageUrl: z.string().url(),
  caption: z.string().max(200).nullable().optional(),
  brandNamed: z.string().nullable().optional(),
  brandConsentConfirmed: z.boolean().default(false),
  displayOrder: z.number().int().default(0),
});
export type PortfolioItemPublic = z.infer<typeof PortfolioItemPublicSchema>;

export const PortfolioItemInternalSchema = PortfolioItemPublicSchema.extend({
  status: PortfolioItemStatusSchema.default("pending"),
  rejectionReason: PortfolioRejectionReasonSchema.nullable().optional(),
  uploadedAt: z.string().datetime(),
  moderatedAt: z.string().datetime().nullable().optional(),
  moderatedBy: z.string().nullable().optional(),
  exifStripped: z.boolean().default(true),
});
export type PortfolioItemInternal = z.infer<typeof PortfolioItemInternalSchema>;

// ==========================================
// 4. Modèle Complet du Profil Créateur (Stockage interne / Couche N)
// ==========================================

export const CreatorProfileSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  status: CreatorProfileStatusSchema.default("brouillon"),

  // Bloc 1 : Présentation
  alias: z.string().min(4).max(20), // Ex: "Profil 7K3M" (RG23)
  shortTitle: z.string().max(120).default(""),
  bio: z.string().max(800).default(""),

  // Bloc 2 : Ligne éditoriale & Situation
  primaryTopic: z.string().default(""),
  secondaryTopics: z.array(z.string()).max(3).default([]),
  editorialTone: z.array(EditorialToneSchema).max(2).default([]),
  languages: z.array(LanguageSchema).min(1).default(["fr"]),
  country: CountryCodeSchema.default("FR"),
  region: z.string().nullable().optional(),
  city: z.string().max(80).nullable().optional(), // Couche I
  travelScope: TravelScopeSchema.default("none"),
  collaborationExperienceBand:
    CollaborationExperienceBandSchema.default("none"),

  // Bloc 3 : Réseaux sociaux
  networks: z.array(CreatorNetworkInternalSchema).default([]),

  // Bloc 4 : Audience
  audience: CreatorAudienceIdentifiedSchema.nullable().optional(),

  // Bloc 5 : Offres & Tarifs
  offers: z.array(CreatorOfferInternalSchema).default([]),
  availability: AvailabilityBandSchema.default("lt_2w"),
  availabilityDeclaredAt: z.string(),
  acceptsNonMonetaryCounterpart: z.boolean().default(false),

  // Bloc 6 : Portfolio
  portfolio: z.array(PortfolioItemInternalSchema).default([]),

  // Bloc 7 : Indicateurs & Paramètres de visibilité
  searchVisibility: z.boolean().default(true),
  completenessScore: z.number().int().min(0).max(100).default(0),

  // Couche N : Identité Légale & Interne (Stricte RG16, RG20)
  pseudonym: z.string().max(60).nullable().optional(),
  legalFirstName: z.string().nullable().optional(),
  legalLastName: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  postalAddress: z.string().nullable().optional(),
  declaredStatus: z.enum(["individual", "professional"]).default("individual"),
  refusedSectors: z.array(z.string()).default([]),
  internalNotes: z.string().nullable().optional(),
  rejectionReason: CreatorRejectionReasonSchema.nullable().optional(),
  rejectionMessage: z.string().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CreatorProfile = z.infer<typeof CreatorProfileSchema>;

// ==========================================
// 5. Vues d'exposition (Couche A et Couche I)
// ==========================================

/**
 * Couche A : Vue Publique Anonyme servie à tout annonceur (RG16, RG18, CA4)
 * Absolument AUCUN champ identifiant (pas de handle, ni URL, ni pseudo, ni coordonnées,
 * ni chiffres exacts, ni tarifs exacts, ni net créateur, ni secteurs refusés).
 */
export const CreatorPublicProfileSchema = z.object({
  id: z.string().uuid(),
  alias: z.string(),
  shortTitle: z.string(),
  bio: z.string(),
  primaryTopic: z.string(),
  secondaryTopics: z.array(z.string()),
  editorialTone: z.array(EditorialToneSchema),
  languages: z.array(LanguageSchema),
  country: CountryCodeSchema,
  region: z.string().nullable().optional(),
  travelScope: TravelScopeSchema,
  collaborationExperienceBand: CollaborationExperienceBandSchema,
  networks: z.array(CreatorNetworkPublicSchema),
  audience: CreatorAudiencePublicSchema.nullable().optional(),
  offers: z.array(CreatorOfferPublicSchema),
  availability: AvailabilityBandSchema,
  availabilityDeclaredAt: z.string(),
  acceptsNonMonetaryCounterpart: z.boolean(),
  portfolio: z.array(PortfolioItemPublicSchema),
  searchVisibility: z.boolean(),
  publishedAt: z.string().datetime().nullable().optional(),
});
export type CreatorPublicProfile = z.infer<typeof CreatorPublicProfileSchema>;

/**
 * Couche I : Vue Révélée servie à un annonceur APRÈS mise en relation (RG19, RG102)
 * Révèle : pseudonyme, ville, handles, URLs de profil, chiffres exacts avec source et date.
 * Exclut TOUJOURS : nom légal, téléphone, email, adresse, tarif exact, net estimé, secteurs refusés.
 */
export const CreatorRevealedProfileSchema = CreatorPublicProfileSchema.extend({
  pseudonym: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  networks: z.array(CreatorNetworkIdentifiedSchema),
  audience: CreatorAudienceIdentifiedSchema.nullable().optional(),
});
export type CreatorRevealedProfile = z.infer<
  typeof CreatorRevealedProfileSchema
>;

// ==========================================
// 6. Requêtes API
// ==========================================

export const UpdateCreatorProfileRequestSchema = z.object({
  shortTitle: z.string().max(120).optional(),
  bio: z.string().max(800).optional(),
  primaryTopic: z.string().optional(),
  secondaryTopics: z.array(z.string()).max(3).optional(),
  editorialTone: z.array(EditorialToneSchema).max(2).optional(),
  languages: z.array(LanguageSchema).min(1).optional(),
  country: CountryCodeSchema.optional(),
  region: z.string().nullable().optional(),
  city: z.string().max(80).nullable().optional(),
  travelScope: TravelScopeSchema.optional(),
  collaborationExperienceBand: CollaborationExperienceBandSchema.optional(),
  networks: z.array(CreatorNetworkInternalSchema).optional(),
  audience: CreatorAudienceIdentifiedSchema.nullable().optional(),
  offers: z.array(CreatorOfferInternalSchema).optional(),
  availability: AvailabilityBandSchema.optional(),
  acceptsNonMonetaryCounterpart: z.boolean().optional(),
  searchVisibility: z.boolean().optional(),
  // Données identifiantes privées
  pseudonym: z.string().max(60).nullable().optional(),
  legalFirstName: z.string().nullable().optional(),
  legalLastName: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  postalAddress: z.string().nullable().optional(),
  refusedSectors: z.array(z.string()).optional(),
});
export type UpdateCreatorProfileRequest = z.infer<
  typeof UpdateCreatorProfileRequestSchema
>;

export const RejectCreatorProfileRequestSchema = z.object({
  reason: CreatorRejectionReasonSchema,
  customMessage: z.string().optional(),
});
export type RejectCreatorProfileRequest = z.infer<
  typeof RejectCreatorProfileRequestSchema
>;

// ==========================================
// 7. Fonctions pures métier (RG23, RG45, RG87)
// ==========================================

/**
 * Génère un alias créateur aléatoire non séquentiel, sans genre, sans ambigüité (RG23)
 * Ex: "Profil 7K3M"
 */
export function generateCreatorAlias(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // pas de 0/O, 1/I
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    suffix += chars[idx];
  }
  return `Profil ${suffix}`;
}

/**
 * Dérive la tranche d'abonnés à partir du nombre exact (RG45)
 */
export function calculateAudienceBand(followers: number): AudienceBand {
  if (followers < 10000) return "nano";
  if (followers < 50000) return "micro";
  if (followers < 100000) return "mid";
  if (followers < 500000) return "macro";
  return "mega";
}

/**
 * Dérive la tranche d'engagement (pourcentage 0-100) (RG45, RG48)
 */
export function calculateEngagementBand(ratePercent: number): EngagementBand {
  if (ratePercent < 1) return "lt_1";
  if (ratePercent < 3) return "1_3";
  if (ratePercent < 6) return "3_6";
  return "gt_6";
}

/**
 * Dérive la tranche de part d'un pays d'audience (RG58)
 */
export function calculateCountryShareBand(
  sharePercent: number,
): CountryShareBand {
  if (sharePercent >= 80) return "gte_80";
  if (sharePercent >= 50) return "50_80";
  return "lt_50";
}

/**
 * Calcul pondéré de la complétude du profil créateur (0-100) (RG87)
 */
export function calculateCreatorProfileCompleteness(
  profile: Partial<CreatorProfile>,
): {
  score: number;
  breakdown: {
    presentation: number;
    editorial: number;
    networks: number;
    audience: number;
    offers: number;
    portfolio: number;
    trust: number;
  };
  missingRequiredForPublish: string[];
} {
  let presentation = 0;
  let editorial = 0;
  let networks = 0;
  let audience = 0;
  let offers = 0;
  let portfolio = 0;
  let trust = 0;
  const missingRequiredForPublish: string[] = [];

  // 1. Présentation (15 pts)
  // Titre court 20-120 car (5 pts) - Obligatoire
  if (
    profile.shortTitle &&
    profile.shortTitle.trim().length >= 20 &&
    profile.shortTitle.trim().length <= 120
  ) {
    presentation += 5;
  } else {
    missingRequiredForPublish.push("shortTitle");
  }

  // Bio 150-800 car (10 pts) - Obligatoire
  if (
    profile.bio &&
    profile.bio.trim().length >= 150 &&
    profile.bio.trim().length <= 800
  ) {
    presentation += 10;
  } else {
    missingRequiredForPublish.push("bio");
  }

  // 2. Ligne éditoriale & situation (14 pts)
  // Thématique principale (5 pts) - Obligatoire
  if (profile.primaryTopic && profile.primaryTopic.trim().length > 0) {
    editorial += 5;
  } else {
    missingRequiredForPublish.push("primaryTopic");
  }

  // Thématiques secondaires (2 pts)
  if (profile.secondaryTopics && profile.secondaryTopics.length > 0) {
    editorial += 2;
  }

  // Ton éditorial (2 pts)
  if (profile.editorialTone && profile.editorialTone.length > 0) {
    editorial += 2;
  }

  // Langues >= 1 (3 pts) - Obligatoire
  if (profile.languages && profile.languages.length > 0) {
    editorial += 3;
  } else {
    missingRequiredForPublish.push("languages");
  }

  // Pays (1 pt) - Obligatoire
  if (profile.country) {
    editorial += 1;
  } else {
    missingRequiredForPublish.push("country");
  }

  // Déplacements possibles (1 pt)
  if (profile.travelScope && profile.travelScope !== "none") {
    editorial += 1;
  }

  // 3. Réseaux sociaux (22 pts)
  const networksList = profile.networks ?? [];
  const primaryNetwork = networksList.find((n) => n.isPrimary);

  if (
    networksList.length > 0 &&
    primaryNetwork &&
    primaryNetwork.network &&
    primaryNetwork.handle &&
    primaryNetwork.profileUrl
  ) {
    networks += 12; // 1re ligne complète (12 pts)
  } else {
    missingRequiredForPublish.push("primaryNetwork");
  }

  // 2e ligne complète (5 pts)
  if (networksList.length >= 2) {
    networks += 5;
  }

  // Fréquence de publication (2 pts)
  if (networksList.some((n) => n.publicationFrequency)) {
    networks += 2;
  }

  // Portée moyenne (3 pts)
  if (
    networksList.some((n) => n.averageReachBand || (n.avgReachPerPost ?? 0) > 0)
  ) {
    networks += 3;
  }

  // 4. Audience (20 pts)
  if (profile.audience && profile.audience.primaryCountry) {
    audience += 10; // Pays principal et part (10 pts) - Obligatoire
  } else {
    missingRequiredForPublish.push("audiencePrimaryCountry");
  }

  if (profile.audience && profile.audience.otherCountries?.length) {
    audience += 3; // Autres pays (3 pts)
  }

  if (profile.audience && profile.audience.ageBands) {
    audience += 4; // Tranches d'âge (4 pts)
  }

  if (profile.audience && profile.audience.genderBand) {
    audience += 3; // Genre (3 pts)
  }

  // 5. Offre (19 pts)
  const offersList = profile.offers ?? [];
  const firstOffer = offersList[0];
  if (firstOffer && firstOffer.format && firstOffer.priceBand) {
    offers += 8; // 1re ligne tarif (8 pts) - Obligatoire
  } else {
    missingRequiredForPublish.push("offers");
  }

  if (offersList.length >= 2) {
    offers += 3; // 2e ligne tarif (3 pts)
  }

  // Formats (3 pts)
  if (offersList.some((o) => o.format)) {
    offers += 3;
  }

  // Droits d'usage (2 pts)
  if (
    offersList.some(
      (o) =>
        o.includedUsageRights?.length > 0 || o.optionalUsageRights?.length > 0,
    )
  ) {
    offers += 2;
  }

  // Exclusivité (1 pt)
  if (offersList.some((o) => o.exclusivity && o.exclusivity !== "none")) {
    offers += 1;
  }

  // Disponibilité (2 pts) - Obligatoire
  if (profile.availability) {
    offers += 2;
  } else {
    missingRequiredForPublish.push("availability");
  }

  // 6. Portfolio (8 pts) - Obligatoire min 3 éléments déposés (RG4, RG77)
  const portfolioList = profile.portfolio ?? [];
  if (portfolioList.length >= 3) {
    portfolio += 6; // 3 éléments déposés (6 pts)
  } else {
    missingRequiredForPublish.push("portfolio");
  }

  if (portfolioList.length >= 5) {
    portfolio += 2; // 5 éléments ou plus (2 pts)
  }

  // 7. Confiance (2 pts)
  // Demande de badge déposée (RG88 : compte le dépôt, pas l'obtention)
  const hasBadgeDeposit = networksList.some(
    (n) => n.hasVerifiedAccountBadge || n.evidenceFileUrl,
  );
  if (hasBadgeDeposit) {
    trust += 2;
  }

  const score =
    presentation + editorial + networks + audience + offers + portfolio + trust;

  return {
    score,
    breakdown: {
      presentation,
      editorial,
      networks,
      audience,
      offers,
      portfolio,
      trust,
    },
    missingRequiredForPublish,
  };
}

/**
 * Filtre strictement le profil vers sa Vue Publique Anonyme (Couche A)
 * RG18 / CA4 / CA13 / CA15 : Aucun handle, url, pseudo, contact, chiffre exact, tarif exact.
 */
export function sanitizeCreatorProfileToPublic(
  profile: CreatorProfile,
): CreatorPublicProfile {
  // 1. Réseaux en couche A
  const publicNetworks: CreatorNetworkPublic[] = profile.networks.map((net) => {
    return {
      network: net.network,
      isPrimary: net.isPrimary,
      audienceBand: net.audienceBand,
      // RG48 : Si badge audience vérifié, on donne la tranche. Sinon STRICTEMENT NUL.
      engagementRateBand: net.hasVerifiedAudienceBadge
        ? (net.engagementRateBand ??
          (typeof net.engagementRate === "number"
            ? calculateEngagementBand(net.engagementRate)
            : null))
        : null,
      averageReachBand:
        net.averageReachBand ??
        (typeof net.avgReachPerPost === "number"
          ? calculateAudienceBand(net.avgReachPerPost)
          : null),
      publicationFrequency: net.publicationFrequency ?? null,
      figuresSource: net.figuresSource,
      figuresUpdatedAt: net.figuresUpdatedAt,
      hasVerifiedAccountBadge: net.hasVerifiedAccountBadge,
      accountBadgeVerifiedAt: net.accountBadgeVerifiedAt ?? null,
      hasVerifiedAudienceBadge: net.hasVerifiedAudienceBadge,
      audienceBadgeVerifiedAt: net.audienceBadgeVerifiedAt ?? null,
    };
  });

  // 2. Audience en couche A (tranches seulement)
  let publicAudience: CreatorAudiencePublic | null = null;
  if (profile.audience) {
    publicAudience = {
      primaryCountry: profile.audience.primaryCountry,
      primaryCountryShareBand: profile.audience.primaryCountryShareBand,
      otherCountries: profile.audience.otherCountries || [],
      ageBands: profile.audience.ageBands,
      genderBand: profile.audience.genderBand,
      figuresSource: profile.audience.figuresSource,
      figuresUpdatedAt: profile.audience.figuresUpdatedAt,
    };
  }

  // 3. Offres en couche A (tranches de tarif uniquement, sans net estimé ni montant exact)
  const publicOffers: CreatorOfferPublic[] = profile.offers.map((off) => ({
    format: off.format,
    network: off.network,
    priceBand: off.priceBand,
    currency: off.currency,
    deliveryLeadBand: off.deliveryLeadBand ?? null,
    includedUsageRights: off.includedUsageRights || [],
    optionalUsageRights: off.optionalUsageRights || [],
    exclusivity: off.exclusivity ?? null,
  }));

  // 4. Portfolio en couche A (uniquement les éléments approuvés, avec métadonnées purgées)
  const publicPortfolio: PortfolioItemPublic[] = profile.portfolio
    .filter((p) => p.status === "approved")
    .map((p) => ({
      id: p.id,
      imageUrl: p.imageUrl,
      caption: p.caption ?? null,
      brandNamed: p.brandNamed ?? null,
      brandConsentConfirmed: p.brandConsentConfirmed,
      displayOrder: p.displayOrder,
    }));

  return CreatorPublicProfileSchema.parse({
    id: profile.id,
    alias: profile.alias,
    shortTitle: profile.shortTitle,
    bio: profile.bio,
    primaryTopic: profile.primaryTopic,
    secondaryTopics: profile.secondaryTopics,
    editorialTone: profile.editorialTone,
    languages: profile.languages,
    country: profile.country,
    region: profile.region ?? null,
    travelScope: profile.travelScope,
    collaborationExperienceBand: profile.collaborationExperienceBand,
    networks: publicNetworks,
    audience: publicAudience,
    offers: publicOffers,
    availability: profile.availability,
    availabilityDeclaredAt: profile.availabilityDeclaredAt,
    acceptsNonMonetaryCounterpart: profile.acceptsNonMonetaryCounterpart,
    portfolio: publicPortfolio,
    searchVisibility: profile.searchVisibility,
    publishedAt: profile.publishedAt ?? null,
  });
}

/**
 * Filtre le profil vers sa Vue Révélée (Couche A + Couche I)
 * Révèle : pseudonyme, ville, handles, URLs, chiffres exacts.
 * Ne contient JAMAIS la Couche N (nom légal, email, téléphone, tarif exact, net estimé, secteurs refusés).
 */
export function sanitizeCreatorProfileToRevealed(
  profile: CreatorProfile,
): CreatorRevealedProfile {
  const publicBase = sanitizeCreatorProfileToPublic(profile);

  // Révélation des réseaux (chiffres exacts + handles + URLs)
  const revealedNetworks: CreatorNetworkIdentified[] = profile.networks.map(
    (net) => ({
      network: net.network,
      isPrimary: net.isPrimary,
      audienceBand: net.audienceBand,
      engagementRateBand:
        net.engagementRateBand ??
        (typeof net.engagementRate === "number"
          ? calculateEngagementBand(net.engagementRate)
          : null),
      averageReachBand:
        net.averageReachBand ??
        (typeof net.avgReachPerPost === "number"
          ? calculateAudienceBand(net.avgReachPerPost)
          : null),
      publicationFrequency: net.publicationFrequency ?? null,
      figuresSource: net.figuresSource,
      figuresUpdatedAt: net.figuresUpdatedAt,
      hasVerifiedAccountBadge: net.hasVerifiedAccountBadge,
      accountBadgeVerifiedAt: net.accountBadgeVerifiedAt ?? null,
      hasVerifiedAudienceBadge: net.hasVerifiedAudienceBadge,
      audienceBadgeVerifiedAt: net.audienceBadgeVerifiedAt ?? null,
      handle: net.handle,
      profileUrl: net.profileUrl,
      followersCount: net.followersCount,
      engagementRate: net.engagementRate ?? null,
      avgReachPerPost: net.avgReachPerPost ?? null,
    }),
  );

  return CreatorRevealedProfileSchema.parse({
    ...publicBase,
    pseudonym: profile.pseudonym ?? null,
    city: profile.city ?? null,
    networks: revealedNetworks,
    audience: profile.audience,
  });
}

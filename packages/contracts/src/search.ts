import { z } from "zod";
import {
  CountryCodeSchema,
  CurrencySchema,
  LanguageSchema,
  ExclusivityBandSchema,
  type CountryCode,
  type Currency,
  type Language,
  type ExclusivityBand,
} from "./common";
import {
  AudienceBandSchema,
  EngagementBandSchema,
  PriceBandSchema,
  EditorialToneSchema,
  type AudienceBand,
  type EngagementBand,
  type PriceBand,
  type EditorialTone,
  CreatorProfileStatusSchema,
  type CreatorProfileStatus,
  AudienceGenderBandSchema,
  type AudienceGenderBand,
  DeliveryLeadBandSchema,
  type DeliveryLeadBand,
  TravelScopeSchema,
  type TravelScope,
  CollaborationExperienceBandSchema,
  type CollaborationExperienceBand,
  AvailabilityBandSchema,
  type AvailabilityBand,
} from "./creator-profile";

// ============================================================================
// 1. Taxonomies & Listes fermées de recherche (10 RG12, RG13, RG16, RG43, RG59)
// ============================================================================

export const SEARCH_SORT_CODES = [
  "default", // Paliers 1 à 8 avec rotation quotidienne UTC (RG35)
  "audience_desc", // Tranche d'audience décroissante (RG43)
  "price_asc", // Fourchette tarifaire croissante dans la devise (RG43)
  "verified_first", // Profils vérifiés d'abord (RG43)
  "new_profiles", // Profils publiés < 30j en tête (RG43)
] as const;
export const SearchSortCodeSchema = z.enum(SEARCH_SORT_CODES);
export type SearchSortCode = z.infer<typeof SearchSortCodeSchema>;

export const SEARCH_VIEW_MODES = [
  "advertiser_anonymous",
  "agent_identified",
] as const;
export const SearchViewModeSchema = z.enum(SEARCH_VIEW_MODES);
export type SearchViewMode = z.infer<typeof SearchViewModeSchema>;

export const SEARCH_RESULT_COUNT_BANDS = [
  "zero", // 0 résultat (RG58)
  "under_k", // 1 à 4 résultats (bloqué par k-anonymat, message identique à 0, RG58)
  "5_9", // 5 à 9 profils (RG59)
  "10_24", // 10 à 24 profils
  "25_49", // 25 à 49 profils
  "50_plus", // 50 profils ou plus
] as const;
export const SearchResultCountBandSchema = z.enum(SEARCH_RESULT_COUNT_BANDS);
export type SearchResultCountBand = z.infer<typeof SearchResultCountBandSchema>;

export const AUDIENCE_SHARE_BANDS = ["gte_80", "50_80", "lt_50"] as const;
export const AudienceShareBandSchema = z.enum(AUDIENCE_SHARE_BANDS);
export type AudienceShareBand = z.infer<typeof AudienceShareBandSchema>;

export const AUDIENCE_AGE_BANDS = [
  "18-24",
  "25-34",
  "35-44",
  "45_plus",
] as const;
export const AudienceAgeBandSchema = z.enum(AUDIENCE_AGE_BANDS);
export type AudienceAgeBand = z.infer<typeof AudienceAgeBandSchema>;

export const SEARCH_BADGE_FILTERS = [
  "account_verified",
  "audience_verified",
] as const;
export const SearchBadgeFilterSchema = z.enum(SEARCH_BADGE_FILTERS);
export type SearchBadgeFilter = z.infer<typeof SearchBadgeFilterSchema>;

export const CreatorAvailabilityBandSchema = AvailabilityBandSchema;
export type CreatorAvailabilityBand = AvailabilityBand;

// ============================================================================
// 2. Filtres de recherche (RG12, RG13, RG16)
// ============================================================================

export const CreatorSearchFiltersSchema = z.object({
  // F1 : Thématique principale (Socle)
  primaryTopic: z.string().optional(),
  // F2 : Thématiques secondaires (Vague 2)
  secondaryTopics: z.array(z.string()).max(3).optional(),

  // F3 & F4 : Réseaux et Tranche d'audience (Socle - RG17 : appliqués à la même ligne réseau)
  networks: z.array(z.string()).optional(),
  audienceBand: AudienceBandSchema.optional(),

  // F5 : Tranche d'engagement vérifié uniquement (Vague 2 - RG20)
  engagementBand: EngagementBandSchema.optional(),

  // F6 : Pays principal de l'audience et part (Socle - RG17)
  audienceCountry: CountryCodeSchema.optional(),
  audienceCountryShareBand: AudienceShareBandSchema.optional(),

  // F8 : Langues de publication (Socle)
  languages: z.array(LanguageSchema).optional(),

  // F11 & F12 : Formats proposés et fourchette tarifaire (Socle - RG17)
  formats: z.array(z.string()).optional(),
  priceBand: PriceBandSchema.optional(),
  currency: CurrencySchema.default("EUR"),
  includeOtherCurrencies: z.boolean().default(false), // RG18

  // F17 : Badges (Socle)
  badges: z.array(SearchBadgeFilterSchema).optional(),

  // Vague 2 : Audience démographie
  audienceGender: AudienceGenderBandSchema.optional(),
  audienceAgeBands: z.array(AudienceAgeBandSchema).optional(),

  // Vague 2 : Modalités de collaboration
  acceptsNonMonetaryCounterpart: z.boolean().optional(),
  usageRights: z
    .enum(["aucun", "repost_organique", "whitelisting", "achat_media"])
    .optional(),
  exclusivity: ExclusivityBandSchema.optional(),
  availability: CreatorAvailabilityBandSchema.optional(),
  deliveryLeadBand: DeliveryLeadBandSchema.optional(),
  editorialTones: z.array(EditorialToneSchema).max(2).optional(),
  travelScope: TravelScopeSchema.optional(),
  collaborationExperienceBand: CollaborationExperienceBandSchema.optional(),

  // Pont Campagne (RG73, RG75)
  campaignId: z.string().uuid().optional(),

  // Facettes réservées à la vue commerciale (RG16 - mode agent_identified uniquement)
  declaredStatus: z.enum(["individual", "professional"]).optional(), // G1
  profileStatus: CreatorProfileStatusSchema.optional(), // G2
  neverProposed: z.boolean().optional(), // G6 (Filtre d'équité)
  refusedSector: z.string().optional(), // G10
});
export type CreatorSearchFilters = z.infer<typeof CreatorSearchFiltersSchema>;

// ============================================================================
// 3. Explication factuelle & Points de vigilance (RG41, RG42)
// ============================================================================

export const ExplanationReasonCodeSchema = z.enum([
  "topic_match",
  "audience_country_match",
  "price_fit",
  "format_match",
  "verified_badge",
  "availability_match",
  "campaign_match",
]);
export type ExplanationReasonCode = z.infer<typeof ExplanationReasonCodeSchema>;

export const ExplanationReasonSchema = z.object({
  code: ExplanationReasonCodeSchema,
  tier: z.number().int().min(1).max(8),
  labelKey: z.string(),
  params: z.record(z.string(), z.string()).default({}),
});
export type ExplanationReason = z.infer<typeof ExplanationReasonSchema>;

export const VigilanceWarningCodeSchema = z.enum([
  "stale_figures", // Chiffres > 90j (RG42)
  "recent_profile", // Publié < 30j (RG42, RG45)
  "expired_audience_badge", // Badge vérification périmé
  "other_currency", // Tarif dans une autre devise (RG18)
  "declared_full", // Se déclare complet (RG42)
]);
export type VigilanceWarningCode = z.infer<typeof VigilanceWarningCodeSchema>;

// ============================================================================
// 4. Cartes de profil dans les résultats de recherche (RG47, RG48, RG71)
// ============================================================================

export const RelationStatusSchema = z.enum([
  "none",
  "shortlisted",
  "request_pending", // Demande envoyée en file (RG53)
  "already_introduced", // Déjà en relation (RG32, RG53)
]);
export type RelationStatus = z.infer<typeof RelationStatusSchema>;

/**
 * Carte de recherche Anonymisée (Mode advertiser_anonymous - Couche A enrichie)
 * Strictement ZÉRO donnée personnelle identifiante (RG48).
 */
export const AnonymizedCreatorCardSchema = z.object({
  creatorAccountId: z.string().uuid(),
  profileId: z.string().uuid(),
  alias: z.string(), // "Profil 7K3M" (RG49)
  contextLabel: z.string(), // "Beauté · France"
  shortTitle: z.string(),
  primaryTopic: z.string(),
  secondaryTopics: z.array(z.string()).default([]),
  editorialTones: z.array(EditorialToneSchema).default([]),
  country: z.string(),
  region: z.string().nullable().optional(), // Uniquement si ≥ 5 profils dans la région (RG15)
  travelScope: TravelScopeSchema.default("none"),
  collaborationExperienceBand:
    CollaborationExperienceBandSchema.default("none"),

  networks: z.array(
    z.object({
      network: z.string(),
      isPrimary: z.boolean(),
      audienceBand: AudienceBandSchema,
      engagementRateBand: EngagementBandSchema.nullable().optional(), // Nullable si non vérifié (RG20)
      averageReachBand: AudienceBandSchema.nullable().optional(),
      publicationFrequency: z.string().nullable().optional(),
      hasVerifiedAccountBadge: z.boolean().default(false),
      accountBadgeVerifiedAt: z.string().nullable().optional(),
      hasVerifiedAudienceBadge: z.boolean().default(false),
      audienceBadgeVerifiedAt: z.string().nullable().optional(),
    }),
  ),

  audience: z.object({
    primaryCountry: z.string(),
    primaryCountryShareBand: AudienceShareBandSchema,
    otherCountries: z.array(
      z.object({
        country: z.string(),
        shareBand: z.string(),
      }),
    ),
  }),

  languages: z.array(LanguageSchema).default(["fr"]),
  audienceGender: AudienceGenderBandSchema.nullable().optional(),
  audienceAgeBands: z.array(AudienceAgeBandSchema).default([]),

  offers: z.array(
    z.object({
      network: z.string(),
      format: z.string(),
      priceBand: PriceBandSchema,
      currency: CurrencySchema,
      deliveryLeadBand: DeliveryLeadBandSchema.nullable().optional(),
      includedUsageRights: z.array(z.string()).default([]),
      optionalUsageRights: z.array(z.string()).default([]),
      exclusivity: ExclusivityBandSchema.nullable().optional(),
    }),
  ),

  availability: CreatorAvailabilityBandSchema.default("lt_2w"),
  availabilityDeclaredAt: z.string(),
  acceptsNonMonetaryCounterpart: z.boolean().default(false),

  // Portfolio modéré uniquement (1 à 3 visuels max, sans métadonnées - RG47, RG69)
  portfolio: z.array(
    z.object({
      id: z.string(),
      imageUrl: z.string(),
      caption: z.string().nullable().optional(),
      brandNamed: z.string().nullable().optional(),
    }),
  ),

  figuresUpdatedAt: z.string(),
  publishedAt: z.string().nullable().optional(),
  isRecent: z.boolean().default(false), // Publié < 30j (RG45)

  // Moteur d'explication (RG41)
  reasons: z.array(ExplanationReasonSchema).min(1).max(4),
  vigilanceWarning: VigilanceWarningCodeSchema.nullable().optional(), // RG42
  relationStatus: RelationStatusSchema.default("none"), // RG53
  relationIntroducedAt: z.string().nullable().optional(),
  relationRequestPendingAt: z.string().nullable().optional(),
});
export type AnonymizedCreatorCard = z.infer<typeof AnonymizedCreatorCardSchema>;

/**
 * Carte de recherche Identifiée pour commercial (Mode agent_identified - RG71)
 */
export const IdentifiedCreatorCardSchema = AnonymizedCreatorCardSchema.extend({
  legalFirstName: z.string().nullable().optional(),
  legalLastName: z.string().nullable().optional(),
  pseudonym: z.string().nullable().optional(),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  profileStatus: CreatorProfileStatusSchema,
  declaredStatus: z.enum(["individual", "professional"]),
  refusedSectors: z.array(z.string()).default([]),
  internalNotes: z.string().nullable().optional(),
  exactNetworks: z.array(
    z.object({
      network: z.string(),
      handle: z.string(),
      profileUrl: z.string().nullable().optional(),
      followersCount: z.number().int().nonnegative().nullable().optional(),
      engagementRate: z.number().nullable().optional(),
    }),
  ),
});
export type IdentifiedCreatorCard = z.infer<typeof IdentifiedCreatorCardSchema>;

// ============================================================================
// 5. Requête et Réponse de recherche (RG57, RG58, RG59, RG63)
// ============================================================================

export const CreatorSearchRequestSchema = z.object({
  filters: CreatorSearchFiltersSchema.default({
    currency: "EUR",
    includeOtherCurrencies: false,
  }),
  sort: SearchSortCodeSchema.default("default"),
  page: z.coerce.number().int().min(1).max(5).default(1), // Plafond 5 pages max (RG63)
  limit: z.coerce
    .number()
    .int()
    .default(12)
    .transform((val) => Math.min(12, Math.max(1, val))), // Plafond 12 par page (RG63, CA42)
  viewMode: SearchViewModeSchema.default("advertiser_anonymous"),
});
export type CreatorSearchRequest = z.infer<typeof CreatorSearchRequestSchema>;

export const CreatorSearchResponseSchema = z.object({
  // k-anonymat (RG57, RG58, RG59)
  isBlockedByKAnonymity: z.boolean(),
  countBand: SearchResultCountBandSchema,
  broadeningSuggestions: z.array(z.string()).default([]), // Suggestions statiques (RG60)

  // Résultats
  items: z.array(
    z.union([AnonymizedCreatorCardSchema, IdentifiedCreatorCardSchema]),
  ),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  totalPages: z.number().int().nonnegative(),

  // Décompte exact : STRICTEMENT réservé aux agents en vue identifiée (RG59, RG71)
  exactTotal: z.number().int().nonnegative().optional(),

  // Métadonnées & Journalisation (RG66)
  searchQueryId: z.string().uuid(),
  activeSort: SearchSortCodeSchema,
  isOpenToAdvertisers: z.boolean().default(true), // RG2, RG3
});
export type CreatorSearchResponse = z.infer<typeof CreatorSearchResponseSchema>;

// ============================================================================
// 6. Sélections privées (Shortlists - RG51, RG53)
// ============================================================================

export const ShortlistSchema = z.object({
  id: z.string().uuid(),
  advertiserAccountId: z.string().uuid(),
  name: z.string().min(1).max(100),
  campaignId: z.string().uuid().nullable().optional(),
  itemsCount: z.number().int().nonnegative().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Shortlist = z.infer<typeof ShortlistSchema>;

export const ShortlistItemSchema = z.object({
  id: z.string().uuid(),
  shortlistId: z.string().uuid(),
  creatorAccountId: z.string().uuid(),
  note: z.string().max(500).nullable().optional(),
  addedAt: z.string(),
});
export type ShortlistItem = z.infer<typeof ShortlistItemSchema>;

// ============================================================================
// 7. Demande « Sélection par l'équipe INFLUX » (RG61)
// ============================================================================

export const TeamSelectionRequestSchema = z.object({
  id: z.string().uuid(),
  advertiserAccountId: z.string().uuid(),
  campaignId: z.string().uuid().nullable().optional(),
  filters: CreatorSearchFiltersSchema,
  notes: z.string().max(2000).default(""),
  locale: z.string().default("fr"),
  status: z.enum(["pending", "in_review", "fulfilled"]).default("pending"),
  createdAt: z.string(),
});
export type TeamSelectionRequest = z.infer<typeof TeamSelectionRequestSchema>;

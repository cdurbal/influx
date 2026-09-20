import { z } from "zod";
import {
  CountryCodeSchema,
  CurrencySchema,
  LanguageSchema,
  ExclusivityBandSchema,
  type ExclusivityBand,
  type CountryCode,
  type Currency,
  type Language,
} from "./common";
import {
  PriceBandSchema,
  AudienceBandSchema,
  AudienceGenderBandSchema,
  REFERENCE_PRICE_BANDS,
  type PriceBand,
  type AudienceBand,
  type AudienceGenderBand,
} from "./creator-profile";
import {
  BrandProfilePublicViewSchema,
  type BrandProfilePublicView,
} from "./brand-profile";

// ==========================================
// 1. Taxonomies & Listes fermées (RG3, RG18, RG24, RG34, RG38, RG39, RG42, RG46, RG51, RG62, RG77, RG84, RG90)
// ==========================================

export const CAMPAIGN_STATUSES = [
  "brouillon",
  "a_valider",
  "publiee",
  "en_pause",
  "cloturee",
  "refusee",
] as const;
export const CampaignStatusSchema = z.enum(CAMPAIGN_STATUSES);
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;

export const CAMPAIGN_TYPES = [
  "placement_produit",
  "ugc",
  "test_produit",
  "ambassadeur",
  "concours",
  "evenement",
  "affiliation",
] as const;
export const CampaignTypeSchema = z.enum(CAMPAIGN_TYPES);
export type CampaignType = z.infer<typeof CampaignTypeSchema>;

export const USAGE_RIGHTS = [
  "aucun",
  "repost_organique",
  "whitelisting",
  "achat_media",
] as const;
export const UsageRightSchema = z.enum(USAGE_RIGHTS);
export type UsageRight = z.infer<typeof UsageRightSchema>;

export const USAGE_DURATIONS = [
  "1_mois",
  "3_mois",
  "6_mois",
  "12_mois",
  "illimitee",
] as const;
export const UsageDurationSchema = z.enum(USAGE_DURATIONS);
export type UsageDuration = z.infer<typeof UsageDurationSchema>;

export const CONTENT_VALIDATION_DELAYS = ["48h", "5j", "10j"] as const;
export const ContentValidationDelaySchema = z.enum(CONTENT_VALIDATION_DELAYS);
export type ContentValidationDelay = z.infer<
  typeof ContentValidationDelaySchema
>;

export const AGE_BANDS = ["18-24", "25-34", "35-44", "45_plus"] as const;
export const AgeBandSchema = z.enum(AGE_BANDS);
export type AgeBand = z.infer<typeof AgeBandSchema>;

export const COMPENSATION_NATURES = [
  "numeraire",
  "numeraire_et_dotation",
  "dotation_seule",
  "affiliation",
] as const;
export const CompensationNatureSchema = z.enum(COMPENSATION_NATURES);
export type CompensationNature = z.infer<typeof CompensationNatureSchema>;

export const PRODUCT_SHIPPING_COSTS = ["marque", "createur"] as const;
export const ProductShippingCostSchema = z.enum(PRODUCT_SHIPPING_COSTS);
export type ProductShippingCost = z.infer<typeof ProductShippingCostSchema>;

export const CANDIDATE_ELEMENTS = [
  "message_motivation",
  "exemples_contenus",
  "proposition_concept",
  "tarif_propose",
  "disponibilite",
] as const;
export const CandidateElementSchema = z.enum(CANDIDATE_ELEMENTS);
export type CandidateElement = z.infer<typeof CandidateElementSchema>;

export const CAMPAIGN_REJECTION_REASONS = [
  "coordonnee_directe",
  "montant_dans_texte",
  "lien_ou_code_a_scanner",
  "brief_insuffisant",
  "livrables_incoherents",
  "budget_incoherent",
  "calendrier_depasse_ou_incoherent",
  "critere_sur_le_createur",
  "dissimulation_caractere_commercial",
  "autorisations_manquantes_secteur_sensible",
  "illicite_ou_cgu",
  "doublon",
  "autre",
] as const;
export const CampaignRejectionReasonSchema = z.enum(CAMPAIGN_REJECTION_REASONS);
export type CampaignRejectionReason = z.infer<
  typeof CampaignRejectionReasonSchema
>;

/**
 * Messages associés aux motifs de refus de campagne (RG90)
 */
export const CAMPAIGN_REJECTION_MESSAGES: Record<
  CampaignRejectionReason,
  {
    label: string;
    messageFr: string;
    messageEn: string;
    whatBrandCanDoFr: string;
  }
> = {
  coordonnee_directe: {
    label: "Coordonnée directe dans un texte publié",
    messageFr:
      "Votre campagne contient une adresse, un numéro, un lien ou une invitation à vous contacter en dehors d'INFLUX.",
    messageEn:
      "Your campaign contains an address, phone number, link or invitation to contact you outside INFLUX.",
    whatBrandCanDoFr: "Corriger et resoumettre",
  },
  montant_dans_texte: {
    label: "Montant dans un texte publié",
    messageFr:
      "Un montant figure dans votre texte. Les montants se déclarent dans le bloc budget, où ils sont affichés avec la commission.",
    messageEn:
      "An amount is mentioned in your text. Amounts must be declared in the budget section, where they are displayed with the commission.",
    whatBrandCanDoFr: "Corriger",
  },
  lien_ou_code_a_scanner: {
    label: "Lien ou code à scanner",
    messageFr:
      "Les liens ne sont pas acceptés dans une campagne. Votre site figure déjà sur votre profil.",
    messageEn:
      "Links are not accepted in a campaign. Your website is already listed on your profile.",
    whatBrandCanDoFr: "Retirer",
  },
  brief_insuffisant: {
    label: "Brief insuffisant",
    messageFr:
      "Votre brief ne permet pas à un créateur de comprendre ce que vous attendez.",
    messageEn:
      "Your brief does not allow a creator to understand what you expect.",
    whatBrandCanDoFr: "Compléter",
  },
  livrables_incoherents: {
    label: "Livrables incohérents",
    messageFr: "Les formats demandés ne correspondent pas aux réseaux visés.",
    messageEn: "Requested formats do not match targeted networks.",
    whatBrandCanDoFr: "Corriger",
  },
  budget_incoherent: {
    label: "Budget incohérent",
    messageFr: "La fourchette annoncée n'est pas exploitable en l'état.",
    messageEn: "The announced range is not usable in its current state.",
    whatBrandCanDoFr: "Corriger",
  },
  calendrier_depasse_ou_incoherent: {
    label: "Calendrier dépassé ou incohérent",
    messageFr: "Les dates de votre campagne ne sont plus valides.",
    messageEn: "Your campaign dates are no longer valid.",
    whatBrandCanDoFr: "Corriger",
  },
  critere_sur_le_createur: {
    label: "Critère portant sur la personne du créateur",
    messageFr:
      "Votre campagne exprime un critère portant sur la personne du créateur (âge, genre, apparence…). Le ciblage porte sur l'audience, jamais sur le créateur.",
    messageEn:
      "Your campaign expresses criteria regarding the creator as a person (age, gender, appearance...). Targeting applies to audience, never the creator.",
    whatBrandCanDoFr: "Corriger",
  },
  dissimulation_caractere_commercial: {
    label: "Demande de dissimulation du caractère commercial",
    messageFr:
      "Une campagne ne peut pas demander de présenter un contenu rémunéré comme un avis spontané.",
    messageEn:
      "A campaign cannot request to present paid content as spontaneous opinion.",
    whatBrandCanDoFr: "Corriger",
  },
  autorisations_manquantes_secteur_sensible: {
    label: "Autorisations manquantes en secteur sensible",
    messageFr:
      "Nous n'avons pas pu vérifier vos autorisations pour ce type de produit.",
    messageEn:
      "We could not verify your authorizations for this type of product.",
    whatBrandCanDoFr: "Contacter INFLUX",
  },
  illicite_ou_cgu: {
    label: "Contenu illicite ou contraire aux CGU",
    messageFr:
      "Le contenu proposé est contraire à nos conditions générales d'utilisation ou à la réglementation.",
    messageEn:
      "The proposed content breaches our terms of service or applicable regulations.",
    whatBrandCanDoFr: "Selon le cas",
  },
  doublon: {
    label: "Doublon d'une campagne déjà publiée",
    messageFr: "Une campagne identique est déjà publiée.",
    messageEn: "An identical campaign is already published.",
    whatBrandCanDoFr: "Clôturer ou modifier",
  },
  autre: {
    label: "Autre motif exceptionnel",
    messageFr:
      "Votre campagne n'a pas pu être validée pour un motif spécifique.",
    messageEn: "Your campaign could not be validated for a specific reason.",
    whatBrandCanDoFr: "Contacter INFLUX",
  },
};

/**
 * Secteurs sensibles soumis à revue renforcée obligatoire (RG84, RG85, Q6)
 */
export const SENSITIVE_SECTORS = [
  "alcool",
  "jeux_argent",
  "cbd",
  "finance",
  "sante",
  "crypto",
  "contenu_adulte",
] as const;
export type SensitiveSector = (typeof SENSITIVE_SECTORS)[number];

export function isSensitiveSector(sector: string): boolean {
  return (SENSITIVE_SECTORS as readonly string[]).includes(
    sector.toLowerCase(),
  );
}

/**
 * Formats de livrables autorisés par réseau social (RG36)
 */
export const NETWORK_FORMAT_COMPATIBILITY: Record<string, string[]> = {
  instagram: ["post", "story", "reel", "carousel"],
  tiktok: ["video_tiktok", "short_video", "story"],
  youtube: ["video_dedicated", "short_video", "integration"],
  linkedin: ["post", "article", "carousel"],
  twitch: ["live_stream", "integration"],
  podcast: ["episode_dedie", "pre_roll", "mid_roll"],
};

export function isDeliverableFormatValid(
  network: string,
  format: string,
): boolean {
  const allowed = NETWORK_FORMAT_COMPATIBILITY[network.toLowerCase()];
  if (!allowed) {
    // Si réseau générique ou non restreint
    return true;
  }
  return allowed.includes(format.toLowerCase());
}

// ==========================================
// 2. Livrables (RG34, RG36, RG37)
// ==========================================

export const CampaignDeliverableSchema = z.object({
  network: z.string().min(1),
  format: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
});
export type CampaignDeliverable = z.infer<typeof CampaignDeliverableSchema>;

// ==========================================
// 3. Modèle Complet Campagne (8 blocs fonctionnels)
// ==========================================

export const CampaignSchema = z.object({
  id: z.string().uuid(),
  brandAccountId: z.string().uuid(),
  status: CampaignStatusSchema.default("brouillon"),

  // Bloc 1 : Identification (RG16)
  title: z.string().max(140).default(""),
  campaignType: CampaignTypeSchema.default("placement_produit"),
  publicSummary: z.string().max(400).default(""),
  detailedBrief: z.string().max(4000).default(""),
  internalReference: z.string().max(40).nullable().optional(), // Interne marque

  // Bloc 2 : Produit, dotation et divulgation (RG24)
  productName: z.string().max(600).default(""),
  productCategory: z.string().default(""),
  keyMessages: z.array(z.string().min(10).max(200)).max(5).default([]),
  prohibitions: z.string().max(1000).nullable().optional(),
  productShipped: z.boolean().default(false), // Obligatoire sans défaut à la soumission (RG29)
  productValueBand: PriceBandSchema.nullable().optional(), // Requis si productShipped = true
  productCurrency: CurrencySchema.default("EUR"),
  productKept: z.boolean().nullable().optional(), // Requis si productShipped = true
  productShippingCost: ProductShippingCostSchema.nullable().optional(), // Requis si productShipped = true

  // Bloc 3 : Livrables, droits d'usage et exclusivité (RG34)
  deliverables: z.array(CampaignDeliverableSchema).max(10).default([]),
  targetNetworks: z.array(z.string()).default([]), // Déduit des livrables (RG35)
  usageRights: UsageRightSchema.default("aucun"),
  usageDuration: UsageDurationSchema.nullable().optional(), // Requis si rights != aucun (RG39)
  usageTerritory: z
    .array(CountryCodeSchema)
    .or(z.literal("mondial"))
    .nullable()
    .optional(), // Requis si rights != aucun
  exclusivity: ExclusivityBandSchema.default("none"),
  contentValidationDelay: ContentValidationDelaySchema.default("48h"),

  // Bloc 4 : Audience visée (RG46)
  targetCountries: z.array(CountryCodeSchema).max(5).default([]),
  targetLanguages: z.array(LanguageSchema).default(["fr"]),
  targetTopics: z.array(z.string()).max(3).default([]),
  targetAudienceBands: z.array(AudienceBandSchema).default([]),
  targetAgeBands: z.array(AgeBandSchema).default([]),
  targetGender: AudienceGenderBandSchema.nullable().optional(), // Indifférent si nul (RG52)

  // Bloc 5 : Budget & Rémunération (RG55)
  minCompensationMinor: z.number().int().positive().nullable().optional(), // Requis sauf dotation_seule
  maxCompensationMinor: z.number().int().positive().nullable().optional(), // Requis sauf dotation_seule
  currency: CurrencySchema.default("EUR"),
  compensationNature: CompensationNatureSchema.default("numeraire"),
  creatorsCount: z.number().int().min(1).max(50).default(1),
  totalBudgetMinor: z.number().int().positive().nullable().optional(), // INTERNE - jamais publié (RG65)
  derivedPriceBands: z.array(PriceBandSchema).default([]), // Dérivé RG59

  // Bloc 6 : Calendrier (RG69, RG70)
  applicationDeadline: z.string().default(""), // Date civile
  deliveryDeadline: z.string().nullable().optional(),
  startsOn: z.string().default(""),
  endsOn: z.string().default(""),

  // Bloc 7 : Candidature (RG76)
  requestedCandidateElements: z
    .array(CandidateElementSchema)
    .max(4)
    .default([]),
  applicationCap: z.number().int().min(1).max(200).nullable().optional(),
  verifiedOnly: z.boolean().default(false), // RG79

  // Bloc 8 : Interne & Backoffice (RG83)
  internalNotes: z.string().nullable().optional(),
  responsibleAgentId: z.string().uuid().nullable().optional(),
  validatorAgentId: z.string().uuid().nullable().optional(),
  secondValidatorAgentId: z.string().uuid().nullable().optional(),
  rejectionReason: CampaignRejectionReasonSchema.nullable().optional(),
  rejectionComment: z.string().nullable().optional(),
  sensitiveDeclarationAcceptedAt: z.string().datetime().nullable().optional(),
  lockedByAgentId: z.string().uuid().nullable().optional(),
  lockedAt: z.string().datetime().nullable().optional(),

  // Historique de version publiée (RG7)
  lastPublishedSnapshot: z
    .record(z.string(), z.unknown())
    .nullable()
    .optional(),

  // Métadonnées système
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  submittedAt: z.string().datetime().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  pausedAt: z.string().datetime().nullable().optional(),
  closedAt: z.string().datetime().nullable().optional(),
  applicationsCount: z.number().int().nonnegative().default(0),
});
export type Campaign = z.infer<typeof CampaignSchema>;

// ==========================================
// 4. Schémas de Requête (Draft, Update, Submit)
// ==========================================

export const CreateCampaignDraftSchema = z.object({
  title: z.string().min(1).max(140).optional(),
  campaignType: CampaignTypeSchema.optional(),
  publicSummary: z.string().max(400).optional(),
  detailedBrief: z.string().max(4000).optional(),
  internalReference: z.string().max(40).nullable().optional(),

  productName: z.string().max(600).optional(),
  productCategory: z.string().optional(),
  keyMessages: z.array(z.string().max(200)).max(5).optional(),
  prohibitions: z.string().max(1000).nullable().optional(),
  productShipped: z.boolean().optional(),
  productValueBand: PriceBandSchema.nullable().optional(),
  productCurrency: CurrencySchema.optional(),
  productKept: z.boolean().nullable().optional(),
  productShippingCost: ProductShippingCostSchema.nullable().optional(),

  deliverables: z.array(CampaignDeliverableSchema).max(10).optional(),
  usageRights: UsageRightSchema.optional(),
  usageDuration: UsageDurationSchema.nullable().optional(),
  usageTerritory: z
    .array(CountryCodeSchema)
    .or(z.literal("mondial"))
    .nullable()
    .optional(),
  exclusivity: ExclusivityBandSchema.optional(),
  contentValidationDelay: ContentValidationDelaySchema.optional(),

  targetCountries: z.array(CountryCodeSchema).max(5).optional(),
  targetLanguages: z.array(LanguageSchema).optional(),
  targetTopics: z.array(z.string()).max(3).optional(),
  targetAudienceBands: z.array(AudienceBandSchema).optional(),
  targetAgeBands: z.array(AgeBandSchema).optional(),
  targetGender: AudienceGenderBandSchema.nullable().optional(),

  minCompensationMinor: z.number().int().positive().nullable().optional(),
  maxCompensationMinor: z.number().int().positive().nullable().optional(),
  currency: CurrencySchema.optional(),
  compensationNature: CompensationNatureSchema.optional(),
  creatorsCount: z.number().int().min(1).max(50).optional(),
  totalBudgetMinor: z.number().int().positive().nullable().optional(),

  applicationDeadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  deliveryDeadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  startsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endsOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),

  requestedCandidateElements: z.array(CandidateElementSchema).max(4).optional(),
  applicationCap: z.number().int().min(1).max(200).nullable().optional(),
  verifiedOnly: z.boolean().optional(),

  sensitiveDeclarationAccepted: z.boolean().optional(),
  internalNotes: z.string().optional(),
});
export type CreateCampaignDraftInput = z.infer<
  typeof CreateCampaignDraftSchema
>;

export const UpdateCampaignSchema = CreateCampaignDraftSchema;
export type UpdateCampaignInput = z.infer<typeof UpdateCampaignSchema>;

// ==========================================
// 5. Vues Sécurisées (Brand vs Creator vs Backoffice)
// ==========================================

/**
 * Vue publique destinée au créateur (RG60, RG65, RG98)
 * AUCUNE donnée interne : ni totalBudgetMinor, ni internalNotes, ni interlocuteur marque.
 */
export const CampaignPublicCreatorViewSchema = z.object({
  id: z.string().uuid(),
  status: CampaignStatusSchema,
  isPaused: z.boolean(),
  isApplicationsClosed: z.boolean(),

  // Identification
  title: z.string(),
  campaignType: CampaignTypeSchema,
  publicSummary: z.string(),
  detailedBrief: z.string(),

  // Produit
  productName: z.string(),
  productCategory: z.string(),
  keyMessages: z.array(z.string()),
  prohibitions: z.string().nullable(),
  productShipped: z.boolean(),
  productValueBand: PriceBandSchema.nullable(),
  productCurrency: CurrencySchema,
  productKept: z.boolean().nullable(),
  productShippingCost: ProductShippingCostSchema.nullable(),

  // Livrables
  deliverables: z.array(CampaignDeliverableSchema),
  targetNetworks: z.array(z.string()),
  usageRights: UsageRightSchema,
  usageDuration: UsageDurationSchema.nullable(),
  usageTerritory: z
    .array(CountryCodeSchema)
    .or(z.literal("mondial"))
    .nullable(),
  exclusivity: ExclusivityBandSchema,
  contentValidationDelay: ContentValidationDelaySchema,

  // Audience visée
  targetCountries: z.array(CountryCodeSchema),
  targetLanguages: z.array(LanguageSchema),
  targetTopics: z.array(z.string()),
  targetAudienceBands: z.array(AudienceBandSchema),
  targetAgeBands: z.array(AgeBandSchema),
  targetGender: AudienceGenderBandSchema.nullable(),

  // Budget & Rémunération créateur (RG60)
  minCompensationMinor: z.number().int().nullable(),
  maxCompensationMinor: z.number().int().nullable(),
  currency: CurrencySchema,
  compensationNature: CompensationNatureSchema,
  creatorsCount: z.number().int(),
  derivedPriceBands: z.array(PriceBandSchema),
  estimatedNet: z
    .object({
      minNetMinor: z.number().int().nonnegative(),
      maxNetMinor: z.number().int().nonnegative(),
      formattedLabel: z.string(),
    })
    .nullable(),

  // Calendrier
  applicationDeadline: z.string(),
  deliveryDeadline: z.string().nullable(),
  startsOn: z.string(),
  endsOn: z.string(),

  // Candidature
  requestedCandidateElements: z.array(CandidateElementSchema),
  verifiedOnly: z.boolean(),

  // Profil Marque public (RG98)
  brandProfile: BrandProfilePublicViewSchema,

  // Mentions d'avertissement et avis (RG32, RG40, RG67, RG80)
  notices: z.array(
    z.object({
      key: z.string(),
      message: z.string(),
    }),
  ),

  publishedAt: z.string().datetime().nullable(),
});
export type CampaignPublicCreatorView = z.infer<
  typeof CampaignPublicCreatorViewSchema
>;

// ==========================================
// 4b. Schémas Fil des Campagnes Créateur (C5, RG13 à RG36)
// ==========================================

export const CampaignFeedFiltersSchema = z
  .object({
    // C1: Thématique (Multi-choix reference.topics)
    topics: z.array(z.string()).optional(),
    // C2: Réseau (Multi-choix reference.networks)
    networks: z.array(z.string()).optional(),
    // C3: Format (Multi-choix reference.formats)
    formats: z.array(z.string()).optional(),
    // C4: Pays d'audience visé (Multi-choix reference.countries)
    targetCountries: z.array(CountryCodeSchema).optional(),
    // C5: Rémunération minimale (borne basse + devise obligatoire RG28)
    minCompensationMinor: z.number().int().nonnegative().optional(),
    currency: CurrencySchema.optional(),
    // C6: Nature de la rémunération (RG15, RG27)
    compensationNatures: z.array(CompensationNatureSchema).optional(),
    // C7: Campagnes auxquelles je peux candidater (Booléen RG27)
    onlyEligible: z.boolean().optional(),

    // Tris (RG33)
    sortBy: z.enum(["recent", "deadline"]).default("recent"),

    // Pagination (RG21, RG36)
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(20).default(12),
  })
  .refine(
    (data) => data.minCompensationMinor == null || data.currency != null,
    {
      message:
        "Une devise est obligatoire pour filtrer par rémunération minimale",
      path: ["currency"],
    },
  );
export type CampaignFeedFilters = z.infer<typeof CampaignFeedFiltersSchema>;

export const CampaignFeedCardSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),

  // Marque (RG15, RG17, D40)
  brandName: z.string(),
  brandLogoUrl: z.string().nullable(),
  brandSector: z.string(),
  brandCompanySize: z.string(),
  brandVerified: z.boolean(),
  brandVerifiedAt: z.string().nullable(),

  // Contenu & Thématiques
  targetTopics: z.array(z.string()),
  deliverables: z.array(CampaignDeliverableSchema),
  targetCountries: z.array(CountryCodeSchema),

  // Rémunération (RG15, RG18, RG19, RG57, RG58)
  compensationNature: CompensationNatureSchema,
  minCompensationMinor: z.number().int().nullable(),
  maxCompensationMinor: z.number().int().nullable(),
  currency: CurrencySchema,
  estimatedNet: z
    .object({
      minNetMinor: z.number().int().nonnegative(),
      maxNetMinor: z.number().int().nonnegative(),
      formattedLabel: z.string(),
    })
    .nullable(),

  // Calendrier
  startsOn: z.string(),
  endsOn: z.string(),
  applicationDeadline: z.string(),

  // Restriction vérifiée (RG15, RG83, RG85)
  verifiedOnly: z.boolean(),

  // Statuts & Cycle (RG15, RG26)
  publishedAt: z.string().nullable(),
  isClosed: z.boolean(),
  closedSinceDays: z.number().nullable(),

  // Statut créateur (RG15, RG46, RG66)
  hasApplied: z.boolean(),
  appliedAt: z.string().nullable(),
  canApply: z.boolean(),
  ineligibilityReasons: z.array(z.string()),
});
export type CampaignFeedCard = z.infer<typeof CampaignFeedCardSchema>;

export const CampaignFeedResponseSchema = z.object({
  items: z.array(CampaignFeedCardSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().min(1),
  limit: z.number().int().min(1),
  totalPages: z.number().int().nonnegative(),
  otherCurrencyCampaignsCount: z.number().int().nonnegative(),
});
export type CampaignFeedResponse = z.infer<typeof CampaignFeedResponseSchema>;

/**
 * Vue marque (US3, US4, RG61) : voit son budget total et référence interne,
 * mais JAMAIS le net créateur estimé ni les données backoffice d'enquête.
 */
export const CampaignBrandViewSchema = z.object({
  id: z.string().uuid(),
  brandAccountId: z.string().uuid(),
  status: CampaignStatusSchema,
  title: z.string(),
  campaignType: CampaignTypeSchema,
  publicSummary: z.string(),
  detailedBrief: z.string(),
  internalReference: z.string().nullable(),

  productName: z.string(),
  productCategory: z.string(),
  keyMessages: z.array(z.string()),
  prohibitions: z.string().nullable(),
  productShipped: z.boolean(),
  productValueBand: PriceBandSchema.nullable(),
  productCurrency: CurrencySchema,
  productKept: z.boolean().nullable(),
  productShippingCost: ProductShippingCostSchema.nullable(),

  deliverables: z.array(CampaignDeliverableSchema),
  targetNetworks: z.array(z.string()),
  usageRights: UsageRightSchema,
  usageDuration: UsageDurationSchema.nullable(),
  usageTerritory: z
    .array(CountryCodeSchema)
    .or(z.literal("mondial"))
    .nullable(),
  exclusivity: ExclusivityBandSchema,
  contentValidationDelay: ContentValidationDelaySchema,

  targetCountries: z.array(CountryCodeSchema),
  targetLanguages: z.array(LanguageSchema),
  targetTopics: z.array(z.string()),
  targetAudienceBands: z.array(AudienceBandSchema),
  targetAgeBands: z.array(AgeBandSchema),
  targetGender: AudienceGenderBandSchema.nullable(),

  minCompensationMinor: z.number().int().nullable(),
  maxCompensationMinor: z.number().int().nullable(),
  currency: CurrencySchema,
  compensationNature: CompensationNatureSchema,
  creatorsCount: z.number().int(),
  totalBudgetMinor: z.number().int().nullable(), // Visible de la marque (US3)

  applicationDeadline: z.string(),
  deliveryDeadline: z.string().nullable(),
  startsOn: z.string(),
  endsOn: z.string(),

  requestedCandidateElements: z.array(CandidateElementSchema),
  applicationCap: z.number().int().nullable(),
  verifiedOnly: z.boolean(),

  rejectionReason: CampaignRejectionReasonSchema.nullable(),
  rejectionComment: z.string().nullable(),
  sensitiveDeclarationAcceptedAt: z.string().nullable(),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  submittedAt: z.string().datetime().nullable(),
  publishedAt: z.string().datetime().nullable(),
  pausedAt: z.string().datetime().nullable(),
  closedAt: z.string().datetime().nullable(),
  applicationsCount: z.number().int().nonnegative(),
});
export type CampaignBrandView = z.infer<typeof CampaignBrandViewSchema>;

/**
 * Vue backoffice complète (RG83, RG85, RG87)
 */
export const CampaignBackofficeViewSchema = CampaignSchema.extend({
  isSensitive: z.boolean(),
  needsDualValidation: z.boolean(),
  reviewWarnings: z.array(z.string()),
  brandSummary: z
    .object({
      companyName: z.string(),
      country: z.string().optional(),
      website: z.string().optional(),
      isVerified: z.boolean().default(false),
      publishedCampaignsCount: z.number().int().default(0),
    })
    .nullable()
    .optional(),
});
export type CampaignBackofficeView = z.infer<
  typeof CampaignBackofficeViewSchema
>;

export interface CampaignQueueMetrics {
  totalPending: number;
  totalSensitive: number;
  totalInReview: number;
  oldestPendingHours: number;
}

export interface CampaignQueueResponse {
  items: CampaignBackofficeView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  metrics: CampaignQueueMetrics;
}

// ==========================================
// 6. Détecteurs Anti-Contournement & Conformité (RG21, RG22, RG23, RG48)
// ==========================================

export interface TextDetectionResult {
  hasContact: boolean;
  hasUrl: boolean;
  hasAmount: boolean;
  hasPersonCriterion: boolean;
  details: string[];
}

export function detectForbiddenPatternsInText(
  text: string,
): TextDetectionResult {
  const details: string[] = [];

  // RG21: Coordonnées directes (email, téléphone, @handle, messagerie)
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/i;
  const phoneRegex = /(?:(?:\+|00)33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/;
  const handleRegex = /(?:\s|^)@[a-zA-Z0-9._]{3,30}\b/;
  const contactInvitationRegex =
    /(?:contactez(?:-|\s+)nous|écrivez(?:-|\s+)à|appelez|kit(?:\s+)m[ée]dia|whatsapp|telegram|t\.me|dm\s+sur|envoi(?:-|\s+)sur)/i;

  const hasContact =
    emailRegex.test(text) ||
    phoneRegex.test(text) ||
    handleRegex.test(text) ||
    contactInvitationRegex.test(text);

  if (hasContact) {
    details.push("Coordonnée directe ou invitation à contacter hors INFLUX");
  }

  // RG22: URLs, liens
  const urlRegex = /(?:https?:\/\/|www\.)[^\s/$.?#].[^\s]*/i;
  const hasUrl = urlRegex.test(text);
  if (hasUrl) {
    details.push("Lien web ou URL interdit dans le texte");
  }

  // RG23: Montants chiffrés (ex: 500 €, 1000 EUR, 250$)
  const amountRegex =
    /(?:\d+[\s.,]?\d*)\s*(?:€|\$|£|EUR|USD|GBP|CAD|BRL|euros?|dollars?)/i;
  const hasAmount = amountRegex.test(text);
  if (hasAmount) {
    details.push(
      "Montant chiffré dans le texte (doit être déclaré dans le bloc budget)",
    );
  }

  // RG48: Critères portant sur la personne du créateur (âge, genre, apparence, origine)
  const personCriterionRegex =
    /(?:créatrice(?:s)?\s+de|créateur(?:s)?\s+de\s+\d{2}|jeune\s+(?:femme|homme|fille|garçon)|homme(?:s)?\s+uniquement|femme(?:s)?\s+uniquement|âgé(?:e)?s?\s+de|apparence\s+physique|taille\s+de\s+vêtements?|origine\s+ethnique|couleur\s+de\s+peau)/i;
  const hasPersonCriterion = personCriterionRegex.test(text);
  if (hasPersonCriterion) {
    details.push(
      "Critère portant sur la personne du créateur (le ciblage porte sur l'audience visée)",
    );
  }

  return {
    hasContact,
    hasUrl,
    hasAmount,
    hasPersonCriterion,
    details,
  };
}

// ==========================================
// 7. Dérivation des Tranches & Net Estimé (RG59, RG60, Invariants A1 & T16)
// ==========================================

/**
 * Dérive les codes reference.price_bands couverts par la fourchette saisie (RG59).
 * Règle d'or : aucune multiplication dans le code applicatif.
 */
export function deriveCampaignPriceBands(
  minMinor?: number | null,
  maxMinor?: number | null,
  currency: string = "EUR",
): PriceBand[] {
  if (
    minMinor == null ||
    maxMinor == null ||
    minMinor <= 0 ||
    maxMinor < minMinor
  ) {
    return [];
  }

  const coveredBands: PriceBand[] = [];
  const entries = Object.values(REFERENCE_PRICE_BANDS);

  for (const entry of entries) {
    if (entry.currency !== currency && entry.currency !== "EUR") continue;

    // Recouvrement entre [minMinor, maxMinor] et [entry.minAmountMinor, entry.maxAmountMinor]
    const bandMin = entry.minAmountMinor;
    const bandMax = entry.maxAmountMinor;

    const overlap =
      minMinor === maxMinor
        ? bandMin <= minMinor && minMinor <= bandMax
        : Math.max(minMinor, bandMin) < Math.min(maxMinor, bandMax);

    if (overlap) {
      coveredBands.push(entry.code);
    }
  }

  return coveredBands;
}

/**
 * Lit les bornes nettes dans le référentiel pour les tranches couvertes (RG60, Invariant T16)
 * SANS aucun calcul ni formule mathématique de commission.
 */
export function getEstimatedNetForDerivedBands(
  priceBands: PriceBand[],
  currency: string = "EUR",
): {
  minNetMinor: number;
  maxNetMinor: number;
  formattedLabel: string;
} | null {
  if (!priceBands.length) return null;

  let minNet = Number.POSITIVE_INFINITY;
  let maxNet = 0;

  for (const code of priceBands) {
    const ref = REFERENCE_PRICE_BANDS[code];
    if (ref) {
      if (ref.netMinAmountMinor < minNet) minNet = ref.netMinAmountMinor;
      if (ref.netMaxAmountMinor > maxNet) maxNet = ref.netMaxAmountMinor;
    }
  }

  if (minNet === Number.POSITIVE_INFINITY || maxNet === 0) return null;

  const minFormatted = (minNet / 100)
    .toLocaleString("fr-FR")
    .replace(/[\u202f\u00a0]/g, " ");
  const maxFormatted = (maxNet / 100)
    .toLocaleString("fr-FR")
    .replace(/[\u202f\u00a0]/g, " ");

  return {
    minNetMinor: minNet,
    maxNetMinor: maxNet,
    formattedLabel: `environ ${minFormatted} – ${maxFormatted} ${currency}`,
  };
}

// ==========================================
// 8. Validation du Calendrier (RG70, RG71, RG74)
// ==========================================

export function validateCampaignDates(dates: {
  applicationDeadline?: string;
  deliveryDeadline?: string | null;
  startsOn?: string;
  endsOn?: string;
}): { valid: boolean; error?: string; conflicts?: [string, string] } {
  const { applicationDeadline, deliveryDeadline, startsOn, endsOn } = dates;

  if (!applicationDeadline || !startsOn || !endsOn) {
    return { valid: false, error: "Dates obligatoires manquantes" };
  }

  const appClose = new Date(`${applicationDeadline}T00:00:00Z`).getTime();
  const start = new Date(`${startsOn}T00:00:00Z`).getTime();
  const end = new Date(`${endsOn}T00:00:00Z`).getTime();

  // RG70: applicationDeadline <= (deliveryDeadline || startsOn) <= startsOn <= endsOn
  if (appClose > start) {
    return {
      valid: false,
      error:
        "La date limite de candidature doit précéder le début de la publication",
      conflicts: ["applicationDeadline", "startsOn"],
    };
  }

  if (deliveryDeadline) {
    const delivery = new Date(`${deliveryDeadline}T00:00:00Z`).getTime();
    if (appClose > delivery) {
      return {
        valid: false,
        error:
          "La date limite de candidature doit précéder la date de livraison",
        conflicts: ["applicationDeadline", "deliveryDeadline"],
      };
    }
    if (delivery > start) {
      return {
        valid: false,
        error: "La date de livraison doit précéder le début de la publication",
        conflicts: ["deliveryDeadline", "startsOn"],
      };
    }
  }

  if (start > end) {
    return {
      valid: false,
      error: "Le début de publication doit précéder la fin de publication",
      conflicts: ["startsOn", "endsOn"],
    };
  }

  // RG74: Durée max 12 mois (366 jours)
  const maxPeriodMs = 366 * 24 * 60 * 60 * 1000;
  if (end - start > maxPeriodMs) {
    return {
      valid: false,
      error: "La période de publication ne peut pas excéder 12 mois",
      conflicts: ["startsOn", "endsOn"],
    };
  }

  return { valid: true };
}

// ==========================================
// 9. Calcul de Complétude & Eligibilité à la Soumission (RG4, RG16, RG24, RG34, RG46, RG55, RG69)
// ==========================================

export function calculateCampaignCompleteness(
  campaign: Partial<Campaign>,
  isBrandProfilePublished: boolean,
): {
  isSubmittable: boolean;
  missingFields: string[];
  missingFieldLabels: string[];
  score: number;
} {
  const missingFields: string[] = [];
  const missingFieldLabels: string[] = [];

  // RG4: Profil marque publié obligatoire
  if (!isBrandProfilePublished) {
    missingFields.push("brandProfilePublished");
    missingFieldLabels.push("Profil de marque publié");
  }

  // Bloc 1 : Identification
  if (!campaign.title || campaign.title.trim().length < 10) {
    missingFields.push("title");
    missingFieldLabels.push("Titre (min 10 caractères)");
  }
  if (!campaign.campaignType) {
    missingFields.push("campaignType");
    missingFieldLabels.push("Type de campagne");
  }
  if (!campaign.publicSummary || campaign.publicSummary.trim().length < 120) {
    missingFields.push("publicSummary");
    missingFieldLabels.push("Résumé public (min 120 caractères)");
  }
  if (!campaign.detailedBrief || campaign.detailedBrief.trim().length < 300) {
    missingFields.push("detailedBrief");
    missingFieldLabels.push("Brief détaillé (min 300 caractères)");
  }

  // Bloc 2 : Produit
  if (!campaign.productName || campaign.productName.trim().length < 20) {
    missingFields.push("productName");
    missingFieldLabels.push("Produit concerné (min 20 caractères)");
  }
  if (!campaign.productCategory) {
    missingFields.push("productCategory");
    missingFieldLabels.push("Catégorie de produit");
  }
  if (
    campaign.productShipped === undefined ||
    campaign.productShipped === null
  ) {
    missingFields.push("productShipped");
    missingFieldLabels.push("Produit envoyé (oui / non)");
  } else if (campaign.productShipped === true) {
    if (!campaign.productValueBand) {
      missingFields.push("productValueBand");
      missingFieldLabels.push("Valeur estimée du produit envoyé");
    }
    if (campaign.productKept === undefined || campaign.productKept === null) {
      missingFields.push("productKept");
      missingFieldLabels.push("Le créateur conserve le produit (oui / non)");
    }
    if (!campaign.productShippingCost) {
      missingFields.push("productShippingCost");
      missingFieldLabels.push("Prise en charge des frais d'envoi");
    }
  }

  // Bloc 3 : Livrables & Droits
  if (!campaign.deliverables || campaign.deliverables.length === 0) {
    missingFields.push("deliverables");
    missingFieldLabels.push("Au moins un livrable (réseau, format, quantité)");
  }
  if (!campaign.usageRights) {
    missingFields.push("usageRights");
    missingFieldLabels.push("Droits d'usage");
  } else if (campaign.usageRights !== "aucun") {
    if (!campaign.usageDuration) {
      missingFields.push("usageDuration");
      missingFieldLabels.push("Durée des droits d'usage");
    }
    if (!campaign.usageTerritory) {
      missingFields.push("usageTerritory");
      missingFieldLabels.push("Territoire des droits d'usage");
    }
  }
  if (campaign.campaignType === "ugc" && campaign.usageRights === "aucun") {
    missingFields.push("ugcUsageRightsInconsistent");
    missingFieldLabels.push("Droits d'usage obligatoires pour un contenu UGC");
  }
  if (!campaign.exclusivity) {
    missingFields.push("exclusivity");
    missingFieldLabels.push("Exclusivité sectorielle demandée");
  }
  if (!campaign.contentValidationDelay) {
    missingFields.push("contentValidationDelay");
    missingFieldLabels.push("Délai de validation des contenus");
  }

  // Bloc 4 : Audience visée
  if (!campaign.targetCountries || campaign.targetCountries.length === 0) {
    missingFields.push("targetCountries");
    missingFieldLabels.push("Au moins un pays visé");
  }
  if (!campaign.targetLanguages || campaign.targetLanguages.length === 0) {
    missingFields.push("targetLanguages");
    missingFieldLabels.push("Au moins une langue de publication");
  }
  if (!campaign.targetTopics || campaign.targetTopics.length === 0) {
    missingFields.push("targetTopics");
    missingFieldLabels.push("Thématiques visées (1 à 3)");
  }

  // Bloc 5 : Budget
  if (!campaign.compensationNature) {
    missingFields.push("compensationNature");
    missingFieldLabels.push("Nature de la rémunération");
  } else if (campaign.compensationNature !== "dotation_seule") {
    if (
      campaign.minCompensationMinor == null ||
      campaign.minCompensationMinor <= 0
    ) {
      missingFields.push("minCompensationMinor");
      missingFieldLabels.push("Rémunération minimum par créateur");
    }
    if (
      campaign.maxCompensationMinor == null ||
      (campaign.minCompensationMinor != null &&
        campaign.maxCompensationMinor < campaign.minCompensationMinor)
    ) {
      missingFields.push("maxCompensationMinor");
      missingFieldLabels.push("Rémunération maximum par créateur");
    }
  }
  if (!campaign.currency) {
    missingFields.push("currency");
    missingFieldLabels.push("Devise");
  }
  if (!campaign.creatorsCount || campaign.creatorsCount < 1) {
    missingFields.push("creatorsCount");
    missingFieldLabels.push("Nombre de créateurs recherchés (1 à 50)");
  }

  // Bloc 6 : Calendrier
  if (!campaign.applicationDeadline) {
    missingFields.push("applicationDeadline");
    missingFieldLabels.push("Date limite de candidature");
  }
  if (!campaign.startsOn) {
    missingFields.push("startsOn");
    missingFieldLabels.push("Début de la période de publication");
  }
  if (!campaign.endsOn) {
    missingFields.push("endsOn");
    missingFieldLabels.push("Fin de la période de publication");
  }

  // Cohérence des dates
  if (campaign.applicationDeadline && campaign.startsOn && campaign.endsOn) {
    const datesCheck = validateCampaignDates({
      applicationDeadline: campaign.applicationDeadline,
      deliveryDeadline: campaign.deliveryDeadline,
      startsOn: campaign.startsOn,
      endsOn: campaign.endsOn,
    });
    if (!datesCheck.valid) {
      missingFields.push("datesOrder");
      missingFieldLabels.push(datesCheck.error || "Ordre des dates incohérent");
    }
  }

  // Bloc 8 : Secteur sensible
  if (
    campaign.productCategory &&
    isSensitiveSector(campaign.productCategory) &&
    !campaign.sensitiveDeclarationAcceptedAt
  ) {
    missingFields.push("sensitiveDeclarationAccepted");
    missingFieldLabels.push(
      "Déclaration d'autorisations en secteur sensible obligatoire",
    );
  }

  const isSubmittable = missingFields.length === 0;

  // Calcul d'un score indicatif de complétude (sur 100)
  const totalWeight = 20;
  const currentFilled = Math.max(0, totalWeight - missingFields.length);
  const score = Math.round((currentFilled / totalWeight) * 100);

  return {
    isSubmittable,
    missingFields,
    missingFieldLabels,
    score,
  };
}

// ==========================================
// 10. Fonctions de Sanitization & Écrans
// ==========================================

export function sanitizeCampaignForBrand(
  campaign: Campaign,
): CampaignBrandView {
  return CampaignBrandViewSchema.parse({
    id: campaign.id,
    brandAccountId: campaign.brandAccountId,
    status: campaign.status,
    title: campaign.title,
    campaignType: campaign.campaignType,
    publicSummary: campaign.publicSummary,
    detailedBrief: campaign.detailedBrief,
    internalReference: campaign.internalReference ?? null,

    productName: campaign.productName,
    productCategory: campaign.productCategory,
    keyMessages: campaign.keyMessages,
    prohibitions: campaign.prohibitions ?? null,
    productShipped: campaign.productShipped,
    productValueBand: campaign.productValueBand ?? null,
    productCurrency: campaign.productCurrency,
    productKept: campaign.productKept ?? null,
    productShippingCost: campaign.productShippingCost ?? null,

    deliverables: campaign.deliverables,
    targetNetworks: campaign.targetNetworks,
    usageRights: campaign.usageRights,
    usageDuration: campaign.usageDuration ?? null,
    usageTerritory: campaign.usageTerritory ?? null,
    exclusivity: campaign.exclusivity,
    contentValidationDelay: campaign.contentValidationDelay,

    targetCountries: campaign.targetCountries,
    targetLanguages: campaign.targetLanguages,
    targetTopics: campaign.targetTopics,
    targetAudienceBands: campaign.targetAudienceBands,
    targetAgeBands: campaign.targetAgeBands,
    targetGender: campaign.targetGender ?? null,

    minCompensationMinor: campaign.minCompensationMinor ?? null,
    maxCompensationMinor: campaign.maxCompensationMinor ?? null,
    currency: campaign.currency,
    compensationNature: campaign.compensationNature,
    creatorsCount: campaign.creatorsCount,
    totalBudgetMinor: campaign.totalBudgetMinor ?? null,

    applicationDeadline: campaign.applicationDeadline,
    deliveryDeadline: campaign.deliveryDeadline ?? null,
    startsOn: campaign.startsOn,
    endsOn: campaign.endsOn,

    requestedCandidateElements: campaign.requestedCandidateElements,
    applicationCap: campaign.applicationCap ?? null,
    verifiedOnly: campaign.verifiedOnly,

    rejectionReason: campaign.rejectionReason ?? null,
    rejectionComment: campaign.rejectionComment ?? null,
    sensitiveDeclarationAcceptedAt:
      campaign.sensitiveDeclarationAcceptedAt ?? null,

    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    submittedAt: campaign.submittedAt ?? null,
    publishedAt: campaign.publishedAt ?? null,
    pausedAt: campaign.pausedAt ?? null,
    closedAt: campaign.closedAt ?? null,
    applicationsCount: campaign.applicationsCount,
  });
}

export function sanitizeCampaignForCreator(
  campaign: Campaign,
  brandProfilePublic: BrandProfilePublicView,
): CampaignPublicCreatorView {
  const notices: { key: string; message: string }[] = [];

  // RG32: Divulgation du caractère commercial
  if (
    campaign.compensationNature !== "dotation_seule" ||
    campaign.productShipped === true
  ) {
    notices.push({
      key: "campaign.disclosure.notice",
      message:
        "Cette collaboration est rémunérée ou comporte un produit offert : votre publication devra en indiquer le caractère commercial, selon les règles de votre pays.",
    });
  }

  // RG40: Warning Achat Média Illimité & Mondial
  if (
    campaign.usageRights === "achat_media" &&
    campaign.usageDuration === "illimitee" &&
    campaign.usageTerritory === "mondial"
  ) {
    notices.push({
      key: "campaign.usageRights.warning",
      message:
        "Cette campagne demande un achat média illimité et mondial. Vos contenus pourront être diffusés sans limite de durée ni de pays.",
    });
  }

  // RG67: Fourchette indicative
  if (campaign.compensationNature !== "dotation_seule") {
    notices.push({
      key: "campaign.budget.notice",
      message:
        "Fourchette indicative pour cette campagne. Elle ne vaut pas engagement : le montant se négocie dans la conversation.",
    });
  }

  // RG80: Candidater n'ouvre pas de conversation directe
  notices.push({
    key: "campaign.application.validationNotice",
    message:
      "Candidater n'ouvre pas de conversation : votre candidature est examinée par un commercial INFLUX.",
  });

  // Dérivation nette issue du barème sans multiplication (RG59, RG60)
  const estimatedNet =
    campaign.compensationNature !== "dotation_seule"
      ? getEstimatedNetForDerivedBands(
          campaign.derivedPriceBands,
          campaign.currency,
        )
      : null;

  const now = new Date().toISOString().split("T")[0] ?? "";
  const isApplicationsClosed =
    campaign.status === "cloturee" ||
    (campaign.applicationCap != null &&
      campaign.applicationsCount >= campaign.applicationCap) ||
    Boolean(campaign.applicationDeadline && campaign.applicationDeadline < now);

  return CampaignPublicCreatorViewSchema.parse({
    id: campaign.id,
    status: campaign.status,
    isPaused: campaign.status === "en_pause",
    isApplicationsClosed,

    title: campaign.title,
    campaignType: campaign.campaignType,
    publicSummary: campaign.publicSummary,
    detailedBrief: campaign.detailedBrief,

    productName: campaign.productName,
    productCategory: campaign.productCategory,
    keyMessages: campaign.keyMessages,
    prohibitions: campaign.prohibitions ?? null,
    productShipped: campaign.productShipped,
    productValueBand: campaign.productValueBand ?? null,
    productCurrency: campaign.productCurrency,
    productKept: campaign.productKept ?? null,
    productShippingCost: campaign.productShippingCost ?? null,

    deliverables: campaign.deliverables,
    targetNetworks: campaign.targetNetworks,
    usageRights: campaign.usageRights,
    usageDuration: campaign.usageDuration ?? null,
    usageTerritory: campaign.usageTerritory ?? null,
    exclusivity: campaign.exclusivity,
    contentValidationDelay: campaign.contentValidationDelay,

    targetCountries: campaign.targetCountries,
    targetLanguages: campaign.targetLanguages,
    targetTopics: campaign.targetTopics,
    targetAudienceBands: campaign.targetAudienceBands,
    targetAgeBands: campaign.targetAgeBands,
    targetGender: campaign.targetGender ?? null,

    minCompensationMinor:
      campaign.compensationNature !== "dotation_seule"
        ? (campaign.minCompensationMinor ?? null)
        : null,
    maxCompensationMinor:
      campaign.compensationNature !== "dotation_seule"
        ? (campaign.maxCompensationMinor ?? null)
        : null,
    currency: campaign.currency,
    compensationNature: campaign.compensationNature,
    creatorsCount: campaign.creatorsCount,
    derivedPriceBands: campaign.derivedPriceBands,
    estimatedNet,

    applicationDeadline: campaign.applicationDeadline,
    deliveryDeadline: campaign.deliveryDeadline ?? null,
    startsOn: campaign.startsOn,
    endsOn: campaign.endsOn,

    requestedCandidateElements: campaign.requestedCandidateElements,
    verifiedOnly: campaign.verifiedOnly,

    brandProfile: brandProfilePublic,
    notices,

    publishedAt: campaign.publishedAt ?? null,
  });
}

export function sanitizeCampaignForFeedCard(
  campaign: Campaign,
  brandProfilePublic: BrandProfilePublicView,
  creatorContext?: {
    isProfilePublished?: boolean;
    hasAudienceVerifiedBadge?: boolean;
    creatorNetworksAndFormats?: Array<{ network: string; format: string }>;
    hasApplied?: boolean;
    appliedAt?: string | null;
    activeApplicationsCount?: number;
    maxActiveApplicationsCap?: number;
  },
): CampaignFeedCard {
  const estimatedNet =
    campaign.compensationNature !== "dotation_seule"
      ? getEstimatedNetForDerivedBands(
          campaign.derivedPriceBands,
          campaign.currency,
        )
      : null;

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0] ?? "";

  // Date de fermeture ou échéance
  const isClosed =
    campaign.status === "cloturee" ||
    (campaign.applicationCap != null &&
      campaign.applicationsCount >= campaign.applicationCap) ||
    Boolean(
      campaign.applicationDeadline && campaign.applicationDeadline < todayStr,
    );

  let closedSinceDays: number | null = null;
  if (isClosed) {
    const closedDateStr = campaign.closedAt
      ? campaign.closedAt.split("T")[0]
      : campaign.applicationDeadline;
    if (closedDateStr) {
      const closedTime = new Date(`${closedDateStr}T00:00:00Z`).getTime();
      const diffDays = Math.floor(
        (now.getTime() - closedTime) / (24 * 3600 * 1000),
      );
      closedSinceDays = Math.max(0, diffDays);
    }
  }

  // Éligibilité du créateur
  const ineligibilityReasons: string[] = [];
  const hasApplied = creatorContext?.hasApplied ?? false;
  const appliedAt = creatorContext?.appliedAt ?? null;

  if (isClosed) {
    ineligibilityReasons.push("Candidatures closes pour cette campagne");
  }

  if (hasApplied) {
    ineligibilityReasons.push(
      "Vous avez déjà une candidature active sur cette campagne",
    );
  }

  if (creatorContext) {
    if (creatorContext.isProfilePublished === false) {
      ineligibilityReasons.push(
        "Votre profil créateur doit être publié pour postuler",
      );
    }

    if (campaign.verifiedOnly && !creatorContext.hasAudienceVerifiedBadge) {
      ineligibilityReasons.push(
        "Campagne réservée aux créateurs dont l'audience est vérifiée",
      );
    }

    if (
      creatorContext.activeApplicationsCount != null &&
      creatorContext.maxActiveApplicationsCap != null &&
      creatorContext.activeApplicationsCount >=
        creatorContext.maxActiveApplicationsCap
    ) {
      ineligibilityReasons.push("Plafond de candidatures actives atteint");
    }

    if (
      creatorContext.creatorNetworksAndFormats &&
      creatorContext.creatorNetworksAndFormats.length > 0
    ) {
      const hasCommonDeliverable = campaign.deliverables.some((d) =>
        creatorContext.creatorNetworksAndFormats!.some(
          (c) => c.network === d.network && c.format === d.format,
        ),
      );
      if (!hasCommonDeliverable) {
        ineligibilityReasons.push(
          "Aucun format compatible avec vos réseaux déclarés",
        );
      }
    }
  }

  const canApply =
    !isClosed && !hasApplied && ineligibilityReasons.length === 0;

  return CampaignFeedCardSchema.parse({
    id: campaign.id,
    title: campaign.title,
    brandName: brandProfilePublic.companyName,
    brandLogoUrl: brandProfilePublic.logoUrl ?? null,
    brandSector: brandProfilePublic.sector,
    brandCompanySize: brandProfilePublic.companySize,
    brandVerified: brandProfilePublic.badgeStatus === "verified",
    brandVerifiedAt: brandProfilePublic.badgeVerifiedAt ?? null,

    targetTopics: campaign.targetTopics,
    deliverables: campaign.deliverables,
    targetCountries: campaign.targetCountries,

    compensationNature: campaign.compensationNature,
    minCompensationMinor:
      campaign.compensationNature !== "dotation_seule"
        ? (campaign.minCompensationMinor ?? null)
        : null,
    maxCompensationMinor:
      campaign.compensationNature !== "dotation_seule"
        ? (campaign.maxCompensationMinor ?? null)
        : null,
    currency: campaign.currency,
    estimatedNet,

    startsOn: campaign.startsOn,
    endsOn: campaign.endsOn,
    applicationDeadline: campaign.applicationDeadline,

    verifiedOnly: campaign.verifiedOnly,

    publishedAt: campaign.publishedAt ?? null,
    isClosed,
    closedSinceDays,

    hasApplied,
    appliedAt,
    canApply,
    ineligibilityReasons,
  });
}

export function sanitizeCampaignForBackoffice(
  campaign: Campaign,
): CampaignBackofficeView {
  const isSensitive = isSensitiveSector(campaign.productCategory);
  const needsDualValidation = isSensitive;

  const reviewWarnings: string[] = [];

  // Alerte ratio fourchette > 10 (RG68)
  if (
    campaign.minCompensationMinor &&
    campaign.maxCompensationMinor &&
    campaign.maxCompensationMinor / campaign.minCompensationMinor > 10
  ) {
    reviewWarnings.push(
      "Fourchette très large : le montant maximum excède 10 fois le montant minimum.",
    );
  }

  // Alerte Achat média illimité et mondial (RG40)
  if (
    campaign.usageRights === "achat_media" &&
    campaign.usageDuration === "illimitee" &&
    campaign.usageTerritory === "mondial"
  ) {
    reviewWarnings.push(
      "Achat média illimité et mondial demandé : condition lourde du marché nécessitant vigilance.",
    );
  }

  // Alerte secteur sensible (RG85)
  if (isSensitive) {
    reviewWarnings.push(
      "Campagne en secteur sensible : soumise à double validation humaine obligatoire.",
    );
  }

  // Détection automatique de patterns suspects dans les textes libres
  const fullText = [
    campaign.title,
    campaign.publicSummary,
    campaign.detailedBrief,
    campaign.productName,
    ...(campaign.keyMessages || []),
    campaign.prohibitions || "",
  ].join(" ");

  const detections = detectForbiddenPatternsInText(fullText);
  if (detections.details.length > 0) {
    for (const detail of detections.details) {
      reviewWarnings.push(`Détection texte suspect : ${detail}`);
    }
  }

  return CampaignBackofficeViewSchema.parse({
    ...campaign,
    isSensitive,
    needsDualValidation,
    reviewWarnings,
  });
}

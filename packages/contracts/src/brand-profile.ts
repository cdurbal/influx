import { z } from "zod";
import {
  CountryCodeSchema,
  CurrencySchema,
  LanguageSchema,
  ExclusivityBandSchema,
  type ExclusivityBand,
} from "./common";

// ==========================================
// 1. Taxonomies & Listes fermées (RG15, RG27, RG35)
// ==========================================

export const CompanySizeBandSchema = z.enum([
  "1-10",
  "11-50",
  "51-250",
  "251-1000",
  "plus_1000",
]);
export type CompanySizeBand = z.infer<typeof CompanySizeBandSchema>;

export const ContactRoleSchema = z.enum([
  "dirigeant",
  "marketing",
  "partenariats_influence",
  "communication",
  "ecommerce",
  "achats",
  "agence_mandatee",
]);
export type ContactRole = z.infer<typeof ContactRoleSchema>;

export const CollaborationRhythmSchema = z.enum([
  "one_off",
  "recurring",
  "ambassador",
]);
export type CollaborationRhythm = z.infer<typeof CollaborationRhythmSchema>;

export const BrandProfileStatusSchema = z.enum([
  "brouillon",
  "en_attente",
  "publie",
  "refuse",
  "suspendu",
]);
export type BrandProfileStatus = z.infer<typeof BrandProfileStatusSchema>;

export const BrandBadgeStatusSchema = z.enum([
  "none",
  "pending",
  "verified",
  "to_refresh",
  "revoked",
]);
export type BrandBadgeStatus = z.infer<typeof BrandBadgeStatusSchema>;

export const BrandRejectionReasonSchema = z.enum([
  "contact_in_public_text",
  "presentation_too_short_or_unclear",
  "logo_non_compliant",
  "misleading_brand_name",
  "inconsistent_sector",
  "illicit_or_cgu_violation",
  "duplicate_brand",
  "other",
]);
export type BrandRejectionReason = z.infer<typeof BrandRejectionReasonSchema>;

// ==========================================
// 2. Schéma complet du Profil Marque
// ==========================================

export const BrandProfileSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  status: BrandProfileStatusSchema.default("brouillon"),

  // Bloc 1 : Identité publique (RG15)
  companyName: z.string().min(1).max(80),
  logoUrl: z.string().nullable().optional(),
  sector: z.string().min(1),
  secondarySectors: z.array(z.string()).max(2).default([]),
  companySize: CompanySizeBandSchema,
  country: CountryCodeSchema,
  targetMarkets: z.array(CountryCodeSchema).max(5).default([]),
  languages: z.array(LanguageSchema).min(1).default(["fr"]),
  website: z.string().max(100).nullable().optional(), // Domaine seul (RG17)
  presentation: z.string().max(1000).default(""), // 120-1000 pour publication

  // Bloc 2 : Attentes de collaboration (RG27)
  topics: z.array(z.string()).max(3).default([]),
  targetNetworks: z.array(z.string()).default([]),
  expectedFormats: z.array(z.string()).default([]),
  indicativeBudgetBand: z.string().nullable().optional(),
  currency: CurrencySchema.default("EUR"),
  usageRights: z.array(z.string()).default([]),
  exclusivity: ExclusivityBandSchema.nullable().optional(),
  nonMonetaryCounterpart: z.boolean().default(false),
  targetAudienceCountries: z.array(CountryCodeSchema).max(5).default([]),
  collaborationRhythm: CollaborationRhythmSchema.nullable().optional(),

  // Bloc 3 : Interlocuteur & Masquage symétrique D40 (RG35)
  contactRole: ContactRoleSchema.default("marketing"),
  contactFirstName: z.string().max(40).nullable().optional(),
  contactEmail: z.string().email().toLowerCase().nullable().optional(),
  contactPhone: z.string().max(30).nullable().optional(),
  contactPageUrl: z.string().nullable().optional(),

  // Bloc 4 : Champs internes & Badge Marque vérifiée (RG46)
  legalName: z.string().max(160).nullable().optional(),
  registrationCountry: CountryCodeSchema.nullable().optional(),
  registrationNumber: z.string().max(40).nullable().optional(),
  internalNotes: z.string().nullable().optional(),
  badgeStatus: BrandBadgeStatusSchema.default("none"),
  badgeVerifiedAt: z.string().datetime().nullable().optional(),
  badgeExpiresAt: z.string().datetime().nullable().optional(),
  badgeDomainProofCode: z.string().nullable().optional(),

  // Métadonnées & scores
  completenessScore: z.number().int().min(0).max(100).default(0),
  rejectionReason: BrandRejectionReasonSchema.nullable().optional(),
  rejectionMessage: z.string().nullable().optional(),
  publishedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type BrandProfile = z.infer<typeof BrandProfileSchema>;

// ==========================================
// 3. Schémas de requêtes et vues
// ==========================================

export const UpdateBrandProfileRequestSchema = z.object({
  companyName: z.string().min(1).max(80).optional(),
  logoUrl: z.string().nullable().optional(),
  sector: z.string().optional(),
  secondarySectors: z.array(z.string()).max(2).optional(),
  companySize: CompanySizeBandSchema.optional(),
  country: CountryCodeSchema.optional(),
  targetMarkets: z.array(CountryCodeSchema).max(5).optional(),
  languages: z.array(LanguageSchema).min(1).optional(),
  website: z.string().max(100).nullable().optional(),
  presentation: z.string().max(1000).optional(),
  topics: z.array(z.string()).max(3).optional(),
  targetNetworks: z.array(z.string()).optional(),
  expectedFormats: z.array(z.string()).optional(),
  indicativeBudgetBand: z.string().nullable().optional(),
  currency: CurrencySchema.optional(),
  usageRights: z.array(z.string()).optional(),
  exclusivity: ExclusivityBandSchema.nullable().optional(),
  nonMonetaryCounterpart: z.boolean().optional(),
  targetAudienceCountries: z.array(CountryCodeSchema).max(5).optional(),
  collaborationRhythm: CollaborationRhythmSchema.nullable().optional(),
  contactRole: ContactRoleSchema.optional(),
  contactFirstName: z.string().max(40).nullable().optional(),
  contactEmail: z.string().email().toLowerCase().nullable().optional(),
  contactPhone: z.string().max(30).nullable().optional(),
  contactPageUrl: z.string().nullable().optional(),
});
export type UpdateBrandProfileRequest = z.infer<
  typeof UpdateBrandProfileRequestSchema
>;

export const BadgeRequestSchema = z.object({
  legalName: z.string().min(1).max(160),
  registrationCountry: CountryCodeSchema,
  registrationNumber: z.string().min(1).max(40),
});
export type BadgeRequest = z.infer<typeof BadgeRequestSchema>;

export const RejectProfileRequestSchema = z.object({
  reason: BrandRejectionReasonSchema,
  customMessage: z.string().optional(),
});
export type RejectProfileRequest = z.infer<typeof RejectProfileRequestSchema>;

// Vue Créateur AVANT révélation (RG74)
export const BrandProfilePublicViewSchema = z.object({
  id: z.string().uuid(),
  companyName: z.string(),
  logoUrl: z.string().nullable().optional(),
  sector: z.string(),
  secondarySectors: z.array(z.string()),
  companySize: CompanySizeBandSchema,
  country: CountryCodeSchema,
  targetMarkets: z.array(CountryCodeSchema),
  languages: z.array(LanguageSchema),
  website: z.string().nullable().optional(),
  presentation: z.string(),
  topics: z.array(z.string()),
  targetNetworks: z.array(z.string()),
  expectedFormats: z.array(z.string()),
  indicativeBudgetBand: z.string().nullable().optional(),
  currency: CurrencySchema,
  usageRights: z.array(z.string()),
  exclusivity: ExclusivityBandSchema.nullable().optional(),
  nonMonetaryCounterpart: z.boolean(),
  targetAudienceCountries: z.array(CountryCodeSchema),
  collaborationRhythm: CollaborationRhythmSchema.nullable().optional(),
  contactRole: ContactRoleSchema, // Visible pour savoir à quelle fonction on parle
  badgeStatus: BrandBadgeStatusSchema,
  badgeVerifiedAt: z.string().nullable().optional(),
});
export type BrandProfilePublicView = z.infer<
  typeof BrandProfilePublicViewSchema
>;

// Vue Créateur APRÈS révélation d'identité (RG74 - coordonnées révélées, aucun champ interne)
export const BrandProfileRevealedViewSchema =
  BrandProfilePublicViewSchema.extend({
    contactFirstName: z.string().nullable().optional(),
    contactEmail: z.string().nullable().optional(),
    contactPhone: z.string().nullable().optional(),
    contactPageUrl: z.string().nullable().optional(),
  });
export type BrandProfileRevealedView = z.infer<
  typeof BrandProfileRevealedViewSchema
>;

// ==========================================
// 4. Fonctions pures métier (RG17, RG19, RG58)
// ==========================================

/**
 * Normalisation de l'URL du site web au nom de domaine seul (RG17, CA4)
 * exemple : "https://exemple.com/contact?ref=1" -> "exemple.com"
 */
export function normalizeWebsiteDomain(input: string): string {
  if (!input || typeof input !== "string") return "";
  let clean = input.trim();
  if (!clean) return "";

  // Si pas de protocole, ajouter https:// pour le parseur URL
  if (!clean.match(/^[a-zA-Z]+:\/\//)) {
    clean = "https://" + clean;
  }

  try {
    const parsed = new URL(clean);
    let domain = parsed.hostname.toLowerCase();
    if (domain.startsWith("www.")) {
      domain = domain.slice(4);
    }
    return domain;
  } catch {
    // Fallback robuste
    const cleaned =
      input
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0] || "";
    return cleaned;
  }
}

/**
 * Détection de coordonnées directes dans un texte public (RG19, RG66)
 */
export function detectDirectContactInText(text: string): boolean {
  if (!text || typeof text !== "string") return false;

  // E-mail
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  if (emailRegex.test(text)) return true;

  // Numéro de téléphone (au moins 8-10 chiffres avec séparateurs éventuels)
  const phoneRegex =
    /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{2,4}/;
  const digitsMatch = text.match(/\d/g);
  if (digitsMatch && digitsMatch.length >= 8 && phoneRegex.test(text)) {
    return true;
  }

  // Handle réseaux sociaux (@pseudo)
  const handleRegex = /(?:^|\s)@[a-zA-Z0-9_.]+/;
  if (handleRegex.test(text)) return true;

  // Lien web ou lien de contact
  const linkRegex = /(?:https?:\/\/|www\.)[^\s]+/;
  if (linkRegex.test(text)) return true;

  return false;
}

/**
 * Calcul pondéré de la complétude du profil marque (0-100) (RG58)
 */
export function calculateBrandProfileCompleteness(
  profile: Partial<BrandProfile>,
): {
  score: number;
  breakdown: {
    publicIdentity: number;
    collaborationExpectations: number;
    trust: number;
    contact: number;
  };
  missingRequiredForPublish: string[];
} {
  let publicIdentity = 0;
  let collaborationExpectations = 0;
  let trust = 0;
  let contact = 0;
  const missingRequiredForPublish: string[] = [];

  // --- 1. Identité publique (max 40) ---
  // Nom commercial (5 pts) - Obligatoire
  if (profile.companyName && profile.companyName.trim().length > 0) {
    publicIdentity += 5;
  } else {
    missingRequiredForPublish.push("companyName");
  }

  // Secteur (5 pts) - Obligatoire
  if (profile.sector && profile.sector.trim().length > 0) {
    publicIdentity += 5;
  } else {
    missingRequiredForPublish.push("sector");
  }

  // Taille (3 pts) - Obligatoire
  if (profile.companySize) {
    publicIdentity += 3;
  } else {
    missingRequiredForPublish.push("companySize");
  }

  // Pays (2 pts) - Obligatoire
  if (profile.country) {
    publicIdentity += 2;
  } else {
    missingRequiredForPublish.push("country");
  }

  // Présentation >= 120 car (10 pts) - Obligatoire
  if (profile.presentation && profile.presentation.trim().length >= 120) {
    publicIdentity += 10;
  } else {
    missingRequiredForPublish.push("presentation");
  }

  // Logo (10 pts) - Optionnel
  if (profile.logoUrl && profile.logoUrl.trim().length > 0) {
    publicIdentity += 10;
  }

  // Marchés visés (3 pts) - Obligatoire (min 1)
  if (profile.targetMarkets && profile.targetMarkets.length > 0) {
    publicIdentity += 3;
  } else {
    missingRequiredForPublish.push("targetMarkets");
  }

  // Langues (2 pts) - Obligatoire (min 1)
  if (profile.languages && profile.languages.length > 0) {
    publicIdentity += 2;
  } else {
    missingRequiredForPublish.push("languages");
  }

  // --- 2. Attentes de collaboration (max 35) ---
  // Thématiques (8 pts) - Obligatoire (min 1)
  if (profile.topics && profile.topics.length > 0) {
    collaborationExpectations += 8;
  } else {
    missingRequiredForPublish.push("topics");
  }

  // Réseaux (6 pts) - Obligatoire (min 1)
  if (profile.targetNetworks && profile.targetNetworks.length > 0) {
    collaborationExpectations += 6;
  } else {
    missingRequiredForPublish.push("targetNetworks");
  }

  // Formats (6 pts) - Obligatoire (min 1)
  if (profile.expectedFormats && profile.expectedFormats.length > 0) {
    collaborationExpectations += 6;
  } else {
    missingRequiredForPublish.push("expectedFormats");
  }

  // Budget indicatif (8 pts) - Obligatoire
  if (
    profile.indicativeBudgetBand &&
    profile.indicativeBudgetBand.trim().length > 0
  ) {
    collaborationExpectations += 8;
  } else {
    missingRequiredForPublish.push("indicativeBudgetBand");
  }

  // Pays d'audience visés (4 pts) - Obligatoire (min 1)
  if (
    profile.targetAudienceCountries &&
    profile.targetAudienceCountries.length > 0
  ) {
    collaborationExpectations += 4;
  } else {
    missingRequiredForPublish.push("targetAudienceCountries");
  }

  // Droits d'usage (3 pts) - Optionnel
  if (profile.usageRights && profile.usageRights.length > 0) {
    collaborationExpectations += 3;
  }

  // --- 3. Confiance (max 15) ---
  // Domaine renseigné (5 pts) - Optionnel
  if (profile.website && profile.website.trim().length > 0) {
    trust += 5;
  }

  // Badge « Marque vérifiée » demandé (10 pts) - RG59 : compte la demande, pas l'obtention
  if (profile.badgeStatus && profile.badgeStatus !== "none") {
    trust += 10;
  }

  // --- 4. Interlocuteur (max 10) ---
  // Fonction (3 pts) - Obligatoire
  if (profile.contactRole) {
    contact += 3;
  } else {
    missingRequiredForPublish.push("contactRole");
  }

  // Téléphone (4 pts) - Optionnel
  if (profile.contactPhone && profile.contactPhone.trim().length > 0) {
    contact += 4;
  }

  // E-mail professionnel (3 pts) - Optionnel
  if (profile.contactEmail && profile.contactEmail.trim().length > 0) {
    contact += 3;
  }

  const score = publicIdentity + collaborationExpectations + trust + contact;

  return {
    score,
    breakdown: {
      publicIdentity,
      collaborationExpectations,
      trust,
      contact,
    },
    missingRequiredForPublish,
  };
}

/**
 * Filtre strictement le profil marque vers sa vue publique créateur (RG74, RG98)
 * Omet contactFirstName, contactEmail, contactPhone, contactPageUrl.
 */
export function sanitizeBrandProfileToPublic(
  profile: BrandProfile,
): BrandProfilePublicView {
  return BrandProfilePublicViewSchema.parse({
    id: profile.id,
    companyName: profile.companyName,
    logoUrl: profile.logoUrl ?? null,
    sector: profile.sector,
    secondarySectors: profile.secondarySectors || [],
    companySize: profile.companySize,
    country: profile.country,
    targetMarkets: profile.targetMarkets || [profile.country],
    languages: profile.languages || ["fr"],
    website: profile.website ?? null,
    presentation: profile.presentation,
    topics: profile.topics || [],
    targetNetworks: profile.targetNetworks || [],
    expectedFormats: profile.expectedFormats || [],
    indicativeBudgetBand: profile.indicativeBudgetBand ?? null,
    currency: profile.currency || "EUR",
    usageRights: profile.usageRights || [],
    exclusivity: profile.exclusivity ?? null,
    nonMonetaryCounterpart: profile.nonMonetaryCounterpart || false,
    targetAudienceCountries: profile.targetAudienceCountries || ["FR"],
    collaborationRhythm: profile.collaborationRhythm ?? null,
    contactRole: profile.contactRole || "marketing",
    badgeStatus: profile.badgeStatus || "none",
    badgeVerifiedAt: profile.badgeVerifiedAt ?? null,
  });
}

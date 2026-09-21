import { z } from "zod";
import { CountryCodeSchema } from "./common";

// ============================================================================
// 1. Origines et Déclencheurs (docs/mvp/01-intermediation-courtee.md §4)
// ============================================================================

export const INTRODUCTION_ORIGINS = [
  "brand_contact_request", // Déclencheur 1 : Marque depuis profil créateur anonymisé
  "creator_application", // Déclencheur 2 : Créateur depuis campagne publiée
  "influx_proposal", // Déclencheur 3 : Commercial depuis recherche identifiée
] as const;
export const IntroductionOriginSchema = z.enum(INTRODUCTION_ORIGINS);
export type IntroductionOrigin = z.infer<typeof IntroductionOriginSchema>;

// ============================================================================
// 2. Statuts du cycle de vie (skill intermediation-tracking & doc 13)
// ============================================================================

export const INTRODUCTION_STATUSES = [
  "pending_review", // En attente de validation commerciale dans la file
  "in_review", // Prise en charge par un commercial (verrou d'agent posé)
  "approved", // Validée par le commercial (ou proposition INFLUX active)
  "rejected", // Refusée par le commercial avec motif typé obligatoire
  "withdrawn", // Retirée par l'initiateur avant décision
  "expired", // Expirée (dépassement du délai SLA)
] as const;
export const IntroductionStatusSchema = z.enum(INTRODUCTION_STATUSES);
export type IntroductionStatus = z.infer<typeof IntroductionStatusSchema>;

// ============================================================================
// 3. Motifs typés de refus (skill intermediation-tracking §Étape 3.4 & doc 13 §G)
// ============================================================================

export const INTRODUCTION_REJECTION_REASONS = [
  "off_topic", // Hors sujet / inadéquation thématique
  "budget_mismatch", // Désaccord ou écart budgétaire manifeste
  "creator_unavailable", // Créateur indisponible ou capacité saturée
  "campaign_closed", // Campagne fermée ou pourvue
  "duplicate", // Doublon de mise en relation existante
  "account_suspended", // Compte suspendu ou non conforme
  "suspected_circumvention", // Suspicion de contournement
  "country_out_of_scope", // Pays hors périmètre contractuel autorisé
  "other", // Autre motif (commentaire interne requis)
] as const;
export const IntroductionRejectionReasonSchema = z.enum(
  INTRODUCTION_REJECTION_REASONS,
);
export type IntroductionRejectionReason = z.infer<
  typeof IntroductionRejectionReasonSchema
>;

// ============================================================================
// 4. Objet Pivot : IntroductionSchema (Entité de première classe M1)
// ============================================================================

export const IntroductionSchema = z.object({
  id: z.string().uuid(),
  // Référence lisible unique citée dans les e-mails et contrats (ex: MER-2026-000001)
  reference: z
    .string()
    .regex(
      /^MER-\d{4}-\d{6}$/,
      "Format de référence invalide (MER-YYYY-NNNNNN)",
    ),
  origin: IntroductionOriginSchema,
  originReason: z.string().min(1).max(4000),
  campaignId: z.string().uuid().nullable().optional(),
  advertiserAccountId: z.string().uuid(),
  creatorAccountId: z.string().uuid(),

  // Rôles et responsabilités commerciales
  ownerAgentId: z.string().uuid().nullable().optional(), // Commercial titulaire
  claimedByAgentId: z.string().uuid().nullable().optional(), // Agent tenant le verrou
  claimedAt: z.string().datetime().nullable().optional(),

  // Cycle de vie & Refus
  status: IntroductionStatusSchema.default("pending_review"),
  rejectionReasonCode: IntroductionRejectionReasonSchema.nullable().optional(),
  rejectionReasonComment: z.string().max(2000).nullable().optional(),

  // Historisation immuable des pays au jour de l'introduction (M1)
  advertiserCountryAtIntro: CountryCodeSchema,
  creatorCountryAtIntro: CountryCodeSchema,

  // Versions de CGU et acceptations à l'écran par partie (M1 & D37)
  advertiserTermsVersionId: z.string().nullable().optional(),
  creatorTermsVersionId: z.string().nullable().optional(),
  advertiserAcceptedAt: z.string().datetime().nullable().optional(),
  creatorAcceptedAt: z.string().datetime().nullable().optional(),

  // Révélation d'identité : write-once, figée à la validation des deux consentements
  identityRevealedAt: z.string().datetime().nullable().optional(),

  // Objets liés créés à la révélation
  conversationId: z.string().uuid().nullable().optional(),
  dealId: z.string().uuid().nullable().optional(),

  // Mesure des délais et SLA (D39)
  slaDueAt: z.string().datetime(),
  decidedAt: z.string().datetime().nullable().optional(),

  // Métadonnées
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Introduction = z.infer<typeof IntroductionSchema>;

// ============================================================================
// 5. Schémas de requêtes pour les 3 Déclencheurs
// ============================================================================

// Déclencheur 1 : Demande de contact marque (depuis profil créateur anonymisé)
export const BrandContactRequestSchema = z.object({
  creatorAccountId: z.string().uuid("Identifiant créateur invalide"),
  campaignId: z.string().uuid("Identifiant campagne invalide").optional(),
  message: z
    .string()
    .min(10, "Le motif ou message doit contenir au moins 10 caractères")
    .max(2000),
  termsAccepted: z.literal(true, {
    message: "L'acceptation des conditions d'intermédiation est requise",
  }),
});
export type BrandContactRequest = z.infer<typeof BrandContactRequestSchema>;

// Déclencheur 2 : Candidature créateur (depuis campagne publiée)
export const CreatorApplyRequestSchema = z.object({
  campaignId: z.string().uuid("Identifiant campagne invalide"),
  message: z
    .string()
    .min(10, "La note de candidature doit contenir au moins 10 caractères")
    .max(2000),
  proposedFormats: z.array(z.string().min(1)).max(10).optional(),
  termsAccepted: z.literal(true, {
    message: "L'acceptation des conditions d'intermédiation est requise",
  }),
});
export type CreatorApplyRequest = z.infer<typeof CreatorApplyRequestSchema>;

// Déclencheur 3 : Proposition commerciale INFLUX (court-circuite la file)
export const InfluxProposalRequestSchema = z
  .object({
    campaignId: z.string().uuid("Identifiant campagne invalide"),
    creatorAccountIds: z
      .array(z.string().uuid())
      .min(1, "Au moins un créateur doit être sélectionné")
      .optional(),
    creatorAccountId: z
      .string()
      .uuid("Identifiant créateur invalide")
      .optional(),
    message: z
      .string()
      .min(10, "Le motif commercial écrit est obligatoire")
      .max(2000),
  })
  .refine(
    (data) =>
      (data.creatorAccountIds && data.creatorAccountIds.length > 0) ||
      Boolean(data.creatorAccountId),
    {
      message:
        "Au moins un créateur doit être sélectionné (creatorAccountId ou creatorAccountIds)",
      path: ["creatorAccountIds"],
    },
  );
export type InfluxProposalRequest = z.infer<typeof InfluxProposalRequestSchema>;

// Décision commerciale d'approbation ou de refus (Mission 4.2)
export const IntroductionDecisionSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    rejectionReasonCode: IntroductionRejectionReasonSchema.optional(),
    rejectionReasonComment: z.string().max(2000).optional(),
  })
  .refine(
    (data) => {
      if (data.action === "reject" && !data.rejectionReasonCode) {
        return false;
      }
      if (
        data.action === "reject" &&
        data.rejectionReasonCode === "other" &&
        (!data.rejectionReasonComment ||
          data.rejectionReasonComment.trim().length < 5)
      ) {
        return false;
      }
      return true;
    },
    {
      message:
        "Le motif typé est obligatoire pour un refus (et un commentaire explicatif est requis si motif 'Autre')",
      path: ["rejectionReasonCode"],
    },
  );
export type IntroductionDecision = z.infer<typeof IntroductionDecisionSchema>;

// Filtres de recherche / consultation
export const IntroductionQueryFiltersSchema = z.object({
  status: IntroductionStatusSchema.optional(),
  campaignId: z.string().uuid().optional(),
  creatorAccountId: z.string().uuid().optional(),
  advertiserAccountId: z.string().uuid().optional(),
  ownerAgentId: z.string().uuid().optional(),
});
export type IntroductionQueryFilters = z.infer<
  typeof IntroductionQueryFiltersSchema
>;

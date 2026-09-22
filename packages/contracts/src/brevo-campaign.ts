import { z } from "zod";

// ============================================================================
// 1. Sources d'audience et statuts (Doc 16 §Besoin & §User Stories)
// ============================================================================

export const BREVO_AUDIENCE_SOURCES = [
  "platform_contacts", // Source 1 : Contacts plateforme consentants
  "brevo_segments", // Source 2 : Segments Brevo synchronisés
  "manual_prospect", // Source 3 : Saisie unitaire avec motif légitime
] as const;
export const BrevoAudienceSourceSchema = z.enum(BREVO_AUDIENCE_SOURCES);
export type BrevoAudienceSource = z.infer<typeof BrevoAudienceSourceSchema>;

export const BREVO_CAMPAIGN_STATUSES = [
  "scheduled", // En attente avec délai de grâce d'annulation (15 minutes)
  "sending", // En cours de distribution
  "sent", // Envoi effectué
  "cancelled", // Annulé par un agent durant la fenêtre de grâce
] as const;
export const BrevoCampaignStatusSchema = z.enum(BREVO_CAMPAIGN_STATUSES);
export type BrevoCampaignStatus = z.infer<typeof BrevoCampaignStatusSchema>;

// ============================================================================
// 2. Modèle de Campagne Brevo
// ============================================================================

export const BrevoCampaignSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string(),
  templateName: z.string(),
  audienceSource: BrevoAudienceSourceSchema,
  targetRole: z.enum(["advertiser", "creator", "both"]).nullable().optional(),
  segmentId: z.string().nullable().optional(),
  manualRecipient: z
    .object({
      email: z.string().email(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      company: z.string().optional(),
      contactReason: z
        .string()
        .min(10, "Motif de contact obligatoire (min 10 caractères)"),
    })
    .nullable()
    .optional(),
  status: BrevoCampaignStatusSchema.default("scheduled"),
  scheduledAt: z.string().datetime(),
  cancelGraceUntil: z.string().datetime(), // scheduledAt + 15 minutes
  sentAt: z.string().datetime().nullable().optional(),
  cancelledAt: z.string().datetime().nullable().optional(),
  cancelledByAgentId: z.string().uuid().nullable().optional(),
  createdByAgentId: z.string().uuid(),
  estimatedCount: z.number().int().min(0),
  excludedCount: z.number().int().min(0),
  stats: z.object({
    sent: z.number().int().default(0),
    opened: z.number().int().default(0),
    clicked: z.number().int().default(0),
    bounced: z.number().int().default(0),
    unsubscribed: z.number().int().default(0),
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type BrevoCampaign = z.infer<typeof BrevoCampaignSchema>;

// ============================================================================
// 3. Catalogue des Modèles d'e-mails validés
// ============================================================================

export interface BrevoTemplate {
  id: string;
  name: string;
  category: "onboarding" | "relance" | "marketing" | "prospection";
  target: "advertiser" | "creator" | "prospect";
  subjectFr: string;
  subjectEn: string;
  bodyFr: string;
  bodyEn: string;
}

export const BREVO_TEMPLATES_CATALOG: BrevoTemplate[] = [
  {
    id: "tpl_creator_onboarding_reminder",
    name: "Relance complétion profil créateur",
    category: "onboarding",
    target: "creator",
    subjectFr:
      "Complétez votre profil pour recevoir des propositions de marques",
    subjectEn: "Complete your profile to receive brand collaboration offers",
    bodyFr:
      "Bonjour {{firstName}},\n\nVotre profil créateur sur INFLUX est presque complet. Ajoutez vos réseaux sociaux et vos formats pour devenir visible auprès des annonceurs qualifiés.\n\nL'équipe INFLUX",
    bodyEn:
      "Hello {{firstName}},\n\nYour creator profile on INFLUX is almost complete. Add your social networks and formats to become visible to qualified brands.\n\nThe INFLUX Team",
  },
  {
    id: "tpl_brand_campaign_invitation",
    name: "Invitation publication première campagne",
    category: "marketing",
    target: "advertiser",
    subjectFr: "Trouvez les créateurs idéaux pour votre prochaine campagne",
    subjectEn: "Find the ideal creators for your next campaign",
    bodyFr:
      "Bonjour {{firstName}},\n\nPubliez votre brief sur INFLUX pour recevoir les candidatures de créateurs certifiés dans votre secteur.\n\nL'équipe commerciale INFLUX",
    bodyEn:
      "Hello {{firstName}},\n\nPublish your brief on INFLUX to receive applications from certified creators in your industry.\n\nThe INFLUX Sales Team",
  },
  {
    id: "tpl_direct_prospect_outreach",
    name: "Prospection unitaire ciblée",
    category: "prospection",
    target: "prospect",
    subjectFr:
      "Découvrez notre sélection de créateurs qualifiés pour {{company}}",
    subjectEn: "Discover our curated creators for {{company}}",
    bodyFr:
      "Bonjour {{firstName}},\n\nNous avons repéré l'actualité de {{company}}. INFLUX vous permet de collaborer avec des créateurs vérifiés en toute sécurité contractuelle.\n\nBien cordialement,\nL'équipe INFLUX",
    bodyEn:
      "Hello {{firstName}},\n\nWe noticed the latest updates from {{company}}. INFLUX allows you to collaborate with verified creators safely.\n\nBest regards,\nThe INFLUX Team",
  },
];

// ============================================================================
// 4. Schémas de requêtes
// ============================================================================

export const EstimateAudienceSchema = z.object({
  audienceSource: BrevoAudienceSourceSchema,
  targetRole: z.enum(["advertiser", "creator", "both"]).optional(),
  segmentId: z.string().optional(),
});
export type EstimateAudienceInput = z.infer<typeof EstimateAudienceSchema>;

export const SendBrevoCampaignSchema = z.object({
  templateId: z.string().min(1),
  audienceSource: BrevoAudienceSourceSchema,
  targetRole: z.enum(["advertiser", "creator", "both"]).optional(),
  segmentId: z.string().optional(),
  manualRecipient: z
    .object({
      email: z.string().email(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      company: z.string().optional(),
      contactReason: z.string().min(10),
    })
    .optional(),
});
export type SendBrevoCampaignInput = z.infer<typeof SendBrevoCampaignSchema>;

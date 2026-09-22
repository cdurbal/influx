import { z } from "zod";

// ============================================================================
// 1. Statuts du fil de discussion (docs/mvp/12-messagerie-a-trois.md RG15)
// ============================================================================

export const CONVERSATION_STATUSES = [
  "ouverte", // Créée, identités révélées, aucun message échangé
  "active", // Au moins un message échangé
  "en_pause", // Négociation suspendue par décision d'un agent
  "close", // Négociation terminée avec motif typé obligatoire
  "archivee", // Sortie des listes courantes
] as const;
export const ConversationStatusSchema = z.enum(CONVERSATION_STATUSES);
export type ConversationStatus = z.infer<typeof ConversationStatusSchema>;

// Motifs de clôture du fil (RG20)
export const CONVERSATION_CLOSE_REASONS = [
  "affaire_signee",
  "refus_marque",
  "refus_createur",
  "sans_reponse",
  "desaccord_budget",
  "hors_sujet",
  "ouverture_erronee",
  "signalement_fonde",
  "blocage_entre_parties",
  "compte_supprime",
  "compte_suspendu",
  "autre",
] as const;
export const ConversationCloseReasonSchema = z.enum(CONVERSATION_CLOSE_REASONS);
export type ConversationCloseReason = z.infer<
  typeof ConversationCloseReasonSchema
>;

// ============================================================================
// 2. Rôles et Participants (RG4, RG5, RG13)
// ============================================================================

export const PARTICIPANT_ROLES = ["advertiser", "creator", "agent"] as const;
export const ParticipantRoleSchema = z.enum(PARTICIPANT_ROLES);
export type ParticipantRole = z.infer<typeof ParticipantRoleSchema>;

export const ConversationParticipantSchema = z.object({
  accountId: z.string().uuid(),
  role: ParticipantRoleSchema,
  displayName: z.string().min(1),
  email: z.string().email(),
  joinedAt: z.string().datetime(),
  leftAt: z.string().datetime().nullable().optional(),
  lastReadMessageId: z.string().uuid().nullable().optional(),
  lastReadAt: z.string().datetime().nullable().optional(),
});
export type ConversationParticipant = z.infer<
  typeof ConversationParticipantSchema
>;

// ============================================================================
// 3. Messages (RG35 à RG38)
// ============================================================================

export const MESSAGE_SENDER_ROLES = [
  "advertiser",
  "creator",
  "agent",
  "system",
] as const;
export const MessageSenderRoleSchema = z.enum(MESSAGE_SENDER_ROLES);
export type MessageSenderRole = z.infer<typeof MessageSenderRoleSchema>;

export const ConversationMessageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderAccountId: z.string().uuid(),
  senderRole: MessageSenderRoleSchema,
  senderDisplayName: z.string().min(1),
  content: z.string().min(1).max(10000),
  systemCode: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
});
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

// ============================================================================
// 4. Conversation (Objet Pivot Messagerie)
// ============================================================================

export const ConversationSchema = z.object({
  id: z.string().uuid(),
  introductionId: z.string().uuid(),
  campaignId: z.string().uuid().nullable().optional(),
  reference: z.string().min(1), // Ex: MER-2026-000001
  status: ConversationStatusSchema.default("ouverte"),
  participants: z.array(ConversationParticipantSchema).min(3),
  ownerAgentId: z.string().uuid(),
  pauseReason: z.string().nullable().optional(),
  closeReason: ConversationCloseReasonSchema.nullable().optional(),
  closeComment: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastMessage: ConversationMessageSchema.nullable().optional(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

// Requête d'envoi de message (RG35, RG43, RG45)
export const SendMessageRequestSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Le message ne peut pas être vide")
    .max(10000, "Le message ne peut pas dépasser 10 000 caractères"),
  warnedBeforeSend: z.boolean().optional().default(false),
  sentAnyway: z.boolean().optional().default(false),
});
export type SendMessageRequest = z.input<typeof SendMessageRequestSchema>;

// ============================================================================
// 5. Détection de coordonnées (Anti-contournement RG42 à RG50)
// ============================================================================

export const CONTACT_DETECTION_TYPES = [
  "email",
  "phone",
  "social_handle",
  "messaging_link",
  "iban",
  "external_url",
] as const;
export const ContactDetectionTypeSchema = z.enum(CONTACT_DETECTION_TYPES);
export type ContactDetectionType = z.infer<typeof ContactDetectionTypeSchema>;

export const DetectedSpanSchema = z.object({
  detectedType: ContactDetectionTypeSchema,
  startIndex: z.number().int().min(0),
  endIndex: z.number().int().min(0),
  label: z.string().min(1),
});
export type DetectedSpan = z.infer<typeof DetectedSpanSchema>;

export const CheckMessageRequestSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Le texte à vérifier ne peut pas être vide")
    .max(10000, "Le texte ne peut pas dépasser 10 000 caractères"),
});
export type CheckMessageRequest = z.infer<typeof CheckMessageRequestSchema>;

export const CheckMessageResponseSchema = z.object({
  hasDetections: z.boolean(),
  detections: z.array(DetectedSpanSchema),
  warningMessage: z.string().nullable().optional(),
});
export type CheckMessageResponse = z.infer<typeof CheckMessageResponseSchema>;

export const ContactDetectionSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  conversationId: z.string().uuid(),
  senderAccountId: z.string().uuid(),
  senderRole: MessageSenderRoleSchema,
  detectedType: ContactDetectionTypeSchema,
  startIndex: z.number().int().min(0),
  endIndex: z.number().int().min(0),
  detectorVersion: z.string().default("v1.0"),
  warnedBeforeSend: z.boolean().default(false),
  sentAnyway: z.boolean().default(false),
  status: z.enum(["pending", "reviewed"]).default("pending"),
  classification: z
    .enum(["legitimate", "circumvention_suspected", "false_positive"])
    .nullable()
    .optional(),
  createdAt: z.string().datetime(),
});
export type ContactDetection = z.infer<typeof ContactDetectionSchema>;

// ============================================================================
// 6. Journalisation des lectures agents (docs/mvp/12-messagerie-a-trois.md RG55 à RG61)
// ============================================================================

export const AGENT_ACCESS_REASONS = [
  "suivi_de_l_affaire", // L'agent est participant ; retenu automatiquement
  "continuite_de_service", // Le responsable est absent
  "reprise_de_dossier", // Réattribution en cours
  "instruction_signalement", // Un signalement a été émis sur ce fil
  "litige_ou_contestation", // Différend entre les parties
  "controle_qualite", // Revue interne d'échantillon
  "demande_rgpd", // Instruction d'une demande d'accès
  "autre", // Commentaire obligatoire
] as const;
export const AgentAccessReasonSchema = z.enum(AGENT_ACCESS_REASONS);
export type AgentAccessReason = z.infer<typeof AgentAccessReasonSchema>;

export const ConversationAccessLogSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  accountId: z.string().uuid(),
  role: z.enum(["agent", "admin"]),
  reason: AgentAccessReasonSchema,
  comment: z.string().nullable().optional(),
  isParticipant: z.boolean(),
  sourceScreen: z.string().default("conversation_view"),
  messagesCount: z.number().int().min(0),
  timestamp: z.string().datetime(),
});
export type ConversationAccessLog = z.infer<typeof ConversationAccessLogSchema>;

export const AccessConversationQuerySchema = z.object({
  reason: AgentAccessReasonSchema.optional(),
  comment: z.string().max(1000).optional(),
  sourceScreen: z.string().optional(),
});
export type AccessConversationQuery = z.infer<
  typeof AccessConversationQuerySchema
>;

import { z } from "zod";
import { CurrencySchema } from "./common";

// ============================================================================
// 1. Statuts du pipeline d'affaires (docs/mvp/14-pipeline-commercial.md §E1-E11)
// ============================================================================

export const DEAL_STATUSES = [
  "open", // Créé à la révélation, en attente de cadrage commercial
  "negotiating", // Échanges en cours dans le fil à trois
  "contract_sent", // Contrat envoyé pour signature hors-plateforme
  "signed", // Contrat signé par les deux parties
  "paid", // Commission encaissée totalement
  "lost", // Négociation avortée ou refusée
  "cancelled", // Annulée après signature ou encaissement
] as const;
export const DealStatusSchema = z.enum(DEAL_STATUSES);
export type DealStatus = z.infer<typeof DealStatusSchema>;

// ============================================================================
// 2. Modes d'envoi du contrat & Encaissements
// ============================================================================

export const CONTRACT_SENDING_MODES = [
  "email", // Envoi par e-mail
  "docusign", // Envoi via DocuSign / signature électronique
  "in_person", // Remise en main propre / signature papier
] as const;
export const ContractSendingModeSchema = z.enum(CONTRACT_SENDING_MODES);
export type ContractSendingMode = z.infer<typeof ContractSendingModeSchema>;

export const COMMISSION_RECEIPT_KINDS = [
  "paiement", // Encaissement effectif
  "remboursement", // Restitution d'un trop-perçu ou annulation
  "abandon_de_creance", // Abandon formalisé par l'admin
] as const;
export const CommissionReceiptKindSchema = z.enum(COMMISSION_RECEIPT_KINDS);
export type CommissionReceiptKind = z.infer<typeof CommissionReceiptKindSchema>;

export const PAYER_SIDES = [
  "advertiser", // Encaissé auprès de l'annonceur
  "creator", // Encaissé auprès du créateur
] as const;
export const PayerSideSchema = z.enum(PAYER_SIDES);
export type PayerSide = z.infer<typeof PayerSideSchema>;

// ============================================================================
// 3. Modèle Deal (Affaire commerciale interne INFLUX)
// ============================================================================

export const DealSchema = z.object({
  id: z.string().uuid(),
  introductionId: z.string().uuid(),
  campaignId: z.string().uuid().nullable().optional(),
  advertiserAccountId: z.string().uuid(),
  creatorAccountId: z.string().uuid(),
  ownerAgentId: z.string().uuid().nullable().optional(),
  status: DealStatusSchema.default("open"),

  // Devises et montants commerciaux manuels (JAMAIS calculés automatiquement au MVP)
  currency: CurrencySchema.default("EUR"),
  negotiatedAmountMinor: z.number().int().min(0).nullable().optional(),
  agreedCommissionMinor: z.number().int().min(0).nullable().optional(),

  // Envoi contrat
  contractSendingMode: ContractSendingModeSchema.nullable().optional(),
  contractSentAt: z.string().datetime().nullable().optional(),
  signedAt: z.string().datetime().nullable().optional(),

  // Motifs de perte ou d'annulation
  lostReason: z.string().max(1000).nullable().optional(),
  cancellationReason: z.string().max(1000).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),

  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Deal = z.infer<typeof DealSchema>;

// ============================================================================
// 4. Modèle CommissionReceipt (billing.commission_receipts - E1)
// ============================================================================

export const CommissionReceiptSchema = z.object({
  id: z.string().uuid(),
  dealId: z.string().uuid(),
  kind: CommissionReceiptKindSchema.default("paiement"),
  amountMinor: z
    .number()
    .int()
    .positive("Le montant encaissé doit être strictement positif"),
  currency: CurrencySchema.default("EUR"),
  receivedOn: z.string(), // Format ISO date YYYY-MM-DD ou datetime
  payerSide: PayerSideSchema,
  paymentMethod: z.string().min(1).default("virement"),
  externalRef: z.string().max(255).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  recordedByAccountId: z.string().uuid(),
  recordedAt: z.string().datetime(),
});
export type CommissionReceipt = z.infer<typeof CommissionReceiptSchema>;

// ============================================================================
// 5. Schémas de mutation et filtres
// ============================================================================

export const UpdateDealSchema = z.object({
  status: DealStatusSchema.optional(),
  currency: CurrencySchema.optional(),
  negotiatedAmountMinor: z.number().int().min(0).nullable().optional(),
  agreedCommissionMinor: z.number().int().min(0).nullable().optional(),
  contractSendingMode: ContractSendingModeSchema.nullable().optional(),
  contractSentAt: z.string().datetime().nullable().optional(),
  signedAt: z.string().datetime().nullable().optional(),
  lostReason: z.string().max(1000).nullable().optional(),
  cancellationReason: z.string().max(1000).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  ownerAgentId: z.string().uuid().nullable().optional(),
});
export type UpdateDealInput = z.infer<typeof UpdateDealSchema>;

export const CreateCommissionReceiptSchema = z.object({
  kind: CommissionReceiptKindSchema.default("paiement"),
  amountMinor: z
    .number()
    .int()
    .positive("Le montant doit être supérieur à zéro"),
  currency: CurrencySchema.optional(),
  receivedOn: z.string().optional(),
  payerSide: PayerSideSchema,
  paymentMethod: z.string().min(1).default("virement"),
  externalRef: z.string().max(255).nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
});
export type CreateCommissionReceiptInput = z.infer<
  typeof CreateCommissionReceiptSchema
>;

export const DealFilterSchema = z.object({
  status: DealStatusSchema.optional(),
  ownerAgentId: z.string().uuid().optional(),
  currency: CurrencySchema.optional(),
});
export type DealFilter = z.infer<typeof DealFilterSchema>;

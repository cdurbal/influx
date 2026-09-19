import { z } from "zod";

// ============================================================================
// CONSTANTES & LISTES FERMÉES (RG11, RG57, RG73)
// ============================================================================

export const VERIFICATION_LEVELS = [
  "account_ownership",
  "audience",
  "brand",
] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

export const VERIFICATION_STATUSES = [
  "pending",
  "in_review",
  "approved",
  "rejected",
  "cancelled",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const BADGE_LEVELS = [
  "account_verified",
  "audience_verified",
  "brand_verified",
] as const;
export type BadgeLevel = (typeof BADGE_LEVELS)[number];

export const BADGE_STATES = [
  "active",
  "to_refresh",
  "to_reconfirm",
  "expired",
  "revoked",
] as const;
export type BadgeState = (typeof BADGE_STATES)[number];

export const EVIDENCE_SOURCES = [
  "native_dashboard",
  "registry",
  "domain_control",
] as const;
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];

/**
 * Liste fermée des motifs de refus d'une demande créateur (RG57)
 */
export const VERIFICATION_REJECTION_REASONS = [
  "missing_evidence",
  "evidence_too_old",
  "evidence_unreadable",
  "evidence_wrong_source",
  "evidence_too_wide",
  "ownership_not_proven",
  "account_not_public",
  "ownership_prerequisite",
  "evidence_inconsistent",
  "evidence_suspected_forgery",
  "shared_account",
  "agency_managed",
  "terms_breach",
  "minor",
  "account_unavailable",
  "other",
] as const;
export type VerificationRejectionReasonCode =
  (typeof VERIFICATION_REJECTION_REASONS)[number];

/**
 * Liste fermée des motifs de retrait d'un badge (RG73)
 */
export const BADGE_REVOCATION_REASONS = [
  "forged_evidence",
  "account_closed",
  "owner_changed",
  "terms_breach",
  "influx_error",
] as const;
export type BadgeRevocationReasonCode =
  (typeof BADGE_REVOCATION_REASONS)[number];

/**
 * Messages associés aux motifs de refus (RG57)
 */
export const VERIFICATION_REJECTION_MESSAGES: Record<
  VerificationRejectionReasonCode,
  { label: string; messageFr: string; messageEn: string; canRetry: boolean }
> = {
  missing_evidence: {
    label: "Pièce absente",
    messageFr: "Aucune pièce n'a été jointe à votre demande.",
    messageEn: "No evidence was attached to your request.",
    canRetry: true,
  },
  evidence_too_old: {
    label: "Pièce trop ancienne",
    messageFr:
      "La période affichée sur votre capture se termine il y a plus de 30 jours.",
    messageEn:
      "The period shown on your screenshot ended more than 30 days ago.",
    canRetry: true,
  },
  evidence_unreadable: {
    label: "Pièce illisible, rognée ou incomplète",
    messageFr:
      "Le compte ou la période ne sont pas lisibles sur votre capture.",
    messageEn:
      "The account or period is not clearly readable on your screenshot.",
    canRetry: true,
  },
  evidence_wrong_source: {
    label: "Source non acceptée",
    messageFr:
      "Seules les statistiques officielles du réseau sont acceptées. Une capture issue d'un outil de mesure tiers ne peut pas être retenue.",
    messageEn:
      "Only official in-network statistics are accepted. Third-party measurement tools cannot be retained.",
    canRetry: true,
  },
  evidence_too_wide: {
    label: "Pièce non conforme aux instructions de capture",
    messageFr:
      "Votre capture montre des informations concernant d'autres personnes. Recadrez-la en suivant nos instructions.",
    messageEn:
      "Your screenshot shows information about third parties. Please crop it following our guidelines.",
    canRetry: true,
  },
  ownership_not_proven: {
    label: "Compte non prouvé",
    messageFr: "Le code de vérification n'a pas été trouvé sur votre profil.",
    messageEn: "The verification code was not found on your profile.",
    canRetry: true,
  },
  account_not_public: {
    label: "Compte non consultable publiquement",
    messageFr:
      "Nous n'avons pas pu consulter votre profil sans être connectés. Rendez-le public le temps du constat, ou renoncez à la vérification de ce réseau.",
    messageEn:
      "We could not view your profile publicly. Make it public during check or decline verification for this network.",
    canRetry: true,
  },
  ownership_prerequisite: {
    label: "Audience demandée sans propriété établie",
    messageFr:
      "Nous vérifions d'abord que ce compte vous appartient, avant de constater vos chiffres.",
    messageEn:
      "We must first verify this account belongs to you before checking audience figures.",
    canRetry: true,
  },
  evidence_inconsistent: {
    label: "Incohérence entre les pièces",
    messageFr: "Les informations fournies ne concordent pas.",
    messageEn: "The information provided does not match.",
    canRetry: false,
  },
  evidence_suspected_forgery: {
    label: "Soupçon de document modifié",
    messageFr: "Nous ne pouvons pas retenir cette pièce.",
    messageEn: "We cannot accept this document.",
    canRetry: false,
  },
  shared_account: {
    label: "Compte partagé entre plusieurs personnes",
    messageFr:
      "Ce compte semble géré par plusieurs personnes. Nous ne pouvons pas établir sa propriété pour une personne identifiée.",
    messageEn:
      "This account appears to be shared by multiple people. Ownership cannot be attributed to an identified individual.",
    canRetry: false,
  },
  agency_managed: {
    label: "Compte géré par une agence",
    messageFr:
      "Les comptes gérés par une agence ne sont pas pris en charge pour le moment.",
    messageEn:
      "Agency-managed accounts are not supported in the current version.",
    canRetry: false,
  },
  terms_breach: {
    label: "Profil non conforme aux CGU",
    messageFr:
      "Votre profil ne respecte pas les conditions générales d'utilisation d'INFLUX.",
    messageEn: "Your profile does not comply with INFLUX terms of service.",
    canRetry: false,
  },
  minor: {
    label: "Créateur mineur",
    messageFr: "La plateforme INFLUX est réservée aux personnes majeures.",
    messageEn: "The INFLUX platform is strictly reserved for adults.",
    canRetry: false,
  },
  account_unavailable: {
    label: "Compte suspendu ou en cours de suppression",
    messageFr:
      "Votre demande ne peut pas être traitée tant que votre compte est suspendu.",
    messageEn:
      "Your request cannot be processed while your account is suspended.",
    canRetry: false,
  },
  other: {
    label: "Autre motif",
    messageFr: "Votre demande de vérification n'a pas pu être validée.",
    messageEn: "Your verification request could not be validated.",
    canRetry: true,
  },
};

/**
 * Messages associés aux motifs de retrait (RG73)
 */
export const BADGE_REVOCATION_MESSAGES: Record<
  BadgeRevocationReasonCode,
  {
    label: string;
    messageFr: string;
    messageEn: string;
    escalatesToAdmin: boolean;
  }
> = {
  forged_evidence: {
    label: "Pièce reconnue fausse après coup",
    messageFr:
      "Votre badge a été retiré suite à la détection d'une pièce falsifiée.",
    messageEn: "Your badge was revoked following detection of forged evidence.",
    escalatesToAdmin: true,
  },
  account_closed: {
    label: "Compte réseau fermé ou inaccessible",
    messageFr:
      "Votre badge a été retiré car le compte sur le réseau est fermé ou inaccessible.",
    messageEn:
      "Your badge was revoked because the social account is closed or unreachable.",
    escalatesToAdmin: false,
  },
  owner_changed: {
    label: "Changement de titulaire du compte",
    messageFr:
      "Votre badge a été retiré suite à un changement de titulaire du compte.",
    messageEn:
      "Your badge was revoked following a change in account ownership.",
    escalatesToAdmin: true,
  },
  terms_breach: {
    label: "Manquement grave aux CGU",
    messageFr:
      "Votre badge a été retiré suite à un manquement aux conditions générales.",
    messageEn: "Your badge was revoked due to a serious breach of our terms.",
    escalatesToAdmin: true,
  },
  influx_error: {
    label: "Erreur interne INFLUX",
    messageFr:
      "Votre badge a été retiré suite à une erreur d'attribution d'INFLUX. Veuillez nous excuser.",
    messageEn:
      "Your badge was revoked due to an internal INFLUX error. We apologize for the inconvenience.",
    escalatesToAdmin: true,
  },
};

// ============================================================================
// SCHÉMAS ZOD DES REQUÊTES ET RÉPONSES
// ============================================================================

export const CreateVerificationRequestSchema = z.object({
  network: z.string().min(1, "Le réseau est requis"),
  requestedLevel: z.enum(VERIFICATION_LEVELS),
  evidenceFileIds: z.array(z.string().uuid()).optional().default([]),
});
export type CreateVerificationRequestInput = z.input<
  typeof CreateVerificationRequestSchema
>;
export type CreateVerificationRequestOutput = z.infer<
  typeof CreateVerificationRequestSchema
>;

export const ClaimVerificationRequestSchema = z.object({
  comment: z.string().optional(),
});
export type ClaimVerificationRequestInput = z.infer<
  typeof ClaimVerificationRequestSchema
>;

export const DecideVerificationRequestSchema = z
  .object({
    decision: z.enum(["approve", "reject", "reexamine"]),
    // Si approve et requestedLevel == account_ownership
    observedHandle: z.string().min(1).optional(),
    observedPlatformAccountRef: z.string().optional(),
    // Si approve et requestedLevel == audience
    observedFollowers: z.number().int().nonnegative().optional(),
    observedPeriodStart: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD requis")
      .optional(),
    observedPeriodEnd: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD requis")
      .optional(),
    observedEngagement: z.number().min(0).max(100).optional(),
    // Si reject
    rejectionReasonCode: z.enum(VERIFICATION_REJECTION_REASONS).optional(),
    agentComment: z.string().optional(),
    // Si reexamine
    reexamineReason: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.decision === "reject" && !data.rejectionReasonCode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rejectionReasonCode"],
        message:
          "Un motif de rejet typé est obligatoire en cas de refus (RG56)",
      });
    }
    if (
      data.decision === "reject" &&
      data.rejectionReasonCode === "other" &&
      (!data.agentComment || data.agentComment.trim().length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["agentComment"],
        message:
          "Un commentaire explicatif est obligatoire pour le motif 'other' (RG57)",
      });
    }
  });
export type DecideVerificationRequestInput = z.infer<
  typeof DecideVerificationRequestSchema
>;

export const RevokeBadgeSchema = z.object({
  revocationReasonCode: z.enum(BADGE_REVOCATION_REASONS),
  comment: z.string().optional(),
});
export type RevokeBadgeInput = z.infer<typeof RevokeBadgeSchema>;

// ============================================================================
// MODÈLES DE DONNÉES (ENTITÉS)
// ============================================================================

export interface OwnershipCode {
  id: string;
  accountId: string;
  network: string;
  code: string; // INFLUX-XXXXXXXX (RG21)
  expiresAt: string; // J+7 (RG22)
  observedByAgentId?: string | null;
  observedAt?: string | null;
  observedHandle?: string | null;
  observedPlatformAccountRef?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export interface VerificationRequest {
  id: string;
  accountId: string;
  network: string;
  requestedLevel: VerificationLevel;
  status: VerificationStatus;
  claimedByAgentId?: string | null;
  claimedAt?: string | null;
  claimExpiresAt?: string | null; // claimedAt + 30 min (RG64)
  decidedByAgentId?: string | null;
  decidedAt?: string | null;
  rejectionReasonCode?: VerificationRejectionReasonCode | null;
  agentComment?: string | null;
  slaDueAt: string; // createdAt + 1 business day (RG65)
  evidenceFileIds: string[];
  ownershipCodeId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Badge {
  id: string;
  accountId: string;
  socialAccountId: string | null;
  network: string;
  level: BadgeLevel;
  grantedByAgentId: string;
  grantedAt: string;
  evidenceSource: EvidenceSource;
  observedFollowers?: number;
  observedEngagement?: number;
  observedPeriodStart?: string;
  observedPeriodEnd?: string;
  declaredFollowersAtDecision?: number;
  expiresAt: string | null; // J+90 pour audience_verified (RG69), null pour account_verified
  state: BadgeState;
  revokedAt?: string | null;
  revocationReasonCode?: BadgeRevocationReasonCode | null;
  revocationComment?: string | null;
  observedHandleAtDecision?: string;
  observedPlatformAccountRef?: string | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// FONCTIONS UTILITAIRES MÉTIER
// ============================================================================

/**
 * Génère un code de propriété non ambigu de format INFLUX-XXXXXXXX (RG21)
 */
export function generateOwnershipCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 caractères sans 0/O, 1/I
  let code = "INFLUX-";
  for (let i = 0; i < 8; i++) {
    const rand = Math.floor(Math.random() * chars.length);
    code += chars[rand];
  }
  return code;
}

/**
 * Calcule l'état dynamique d'un badge selon son cycle de vie (RG70)
 * - audience_verified : expire à 90 jours.
 *   - Si now >= expiresAt et now < expiresAt + 30 jours (délai de grâce) -> to_refresh
 *   - Si now >= expiresAt + 30 jours -> expired
 */
export function calculateBadgeLifecycleState(
  badge: Pick<Badge, "level" | "state" | "expiresAt">,
  nowIso: string = new Date().toISOString(),
): BadgeState {
  if (badge.state === "revoked" || badge.state === "to_reconfirm") {
    return badge.state;
  }

  if (badge.level === "account_verified" || badge.level === "brand_verified") {
    return "active";
  }

  if (badge.level === "audience_verified") {
    if (!badge.expiresAt) return "active";

    const now = new Date(nowIso).getTime();
    const expiresAt = new Date(badge.expiresAt).getTime();
    const gracePeriodEnd = expiresAt + 30 * 24 * 60 * 60 * 1000; // 30 jours de grâce (RG70)

    if (now < expiresAt) {
      return "active";
    }
    if (now >= expiresAt && now < gracePeriodEnd) {
      return "to_refresh";
    }
    return "expired";
  }

  return badge.state;
}

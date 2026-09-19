import { describe, it, expect } from "vitest";
import {
  generateOwnershipCode,
  calculateBadgeLifecycleState,
  CreateVerificationRequestSchema,
  DecideVerificationRequestSchema,
  RevokeBadgeSchema,
  VERIFICATION_REJECTION_REASONS,
  BADGE_REVOCATION_REASONS,
  VERIFICATION_REJECTION_MESSAGES,
  BADGE_REVOCATION_MESSAGES,
} from "../src/verification";

describe("Contrats de vérification et badges (Mission 2.6)", () => {
  describe("generateOwnershipCode (RG21)", () => {
    it("génère un code au format INFLUX-XXXXXXXX de 15 caractères", () => {
      const code = generateOwnershipCode();
      expect(code).toMatch(/^INFLUX-[A-Z0-9]{8}$/);
      expect(code.length).toBe(15);
    });

    it("génère des codes uniques sans caractères ambigus", () => {
      const codes = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const c = generateOwnershipCode();
        expect(codes.has(c)).toBe(false);
        // Le suffixe aléatoire de 8 caractères ne doit pas contenir 0, O, 1, I
        const randomPart = c.slice(7);
        expect(randomPart).not.toMatch(/[0O1I]/);
        codes.add(c);
      }
    });
  });

  describe("calculateBadgeLifecycleState (RG70)", () => {
    const grantedAt = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = new Date("2026-04-01T00:00:00.000Z"); // +90 jours

    it("conserve l'état révoqué ou à reconfirmer sans modification", () => {
      expect(
        calculateBadgeLifecycleState({
          level: "audience_verified",
          state: "revoked",
          expiresAt: expiresAt.toISOString(),
        }),
      ).toBe("revoked");

      expect(
        calculateBadgeLifecycleState({
          level: "account_verified",
          state: "to_reconfirm",
          expiresAt: null,
        }),
      ).toBe("to_reconfirm");
    });

    it("maintient un badge de compte ou de marque actif en permanence (RG30)", () => {
      expect(
        calculateBadgeLifecycleState({
          level: "account_verified",
          state: "active",
          expiresAt: null,
        }),
      ).toBe("active");

      expect(
        calculateBadgeLifecycleState({
          level: "brand_verified",
          state: "active",
          expiresAt: null,
        }),
      ).toBe("active");
    });

    it("calcule les 3 étapes d'audience vérifiée : actif (<90j), à rafraîchir (90-120j), expiré (>120j)", () => {
      // 1. Actif à J+80
      const atDay80 = "2026-03-22T00:00:00.000Z";
      expect(
        calculateBadgeLifecycleState(
          {
            level: "audience_verified",
            state: "active",
            expiresAt: expiresAt.toISOString(),
          },
          atDay80,
        ),
      ).toBe("active");

      // 2. À rafraîchir à J+95 (délai de grâce 30 jours)
      const atDay95 = "2026-04-06T00:00:00.000Z";
      expect(
        calculateBadgeLifecycleState(
          {
            level: "audience_verified",
            state: "active",
            expiresAt: expiresAt.toISOString(),
          },
          atDay95,
        ),
      ).toBe("to_refresh");

      // 3. Expiré à J+125 (délai de grâce dépassé)
      const atDay125 = "2026-05-06T00:00:00.000Z";
      expect(
        calculateBadgeLifecycleState(
          {
            level: "audience_verified",
            state: "active",
            expiresAt: expiresAt.toISOString(),
          },
          atDay125,
        ),
      ).toBe("expired");
    });
  });

  describe("Référentiels fermés et messages (RG57, RG73)", () => {
    it("définit les 16 motifs fermés de refus avec leurs messages bilingues (RG57)", () => {
      expect(VERIFICATION_REJECTION_REASONS.length).toBe(16);
      for (const reason of VERIFICATION_REJECTION_REASONS) {
        const item = VERIFICATION_REJECTION_MESSAGES[reason];
        expect(item).toBeDefined();
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.messageFr.length).toBeGreaterThan(0);
        expect(item.messageEn.length).toBeGreaterThan(0);
      }
    });

    it("définit les 5 motifs fermés de retrait de badge avec leurs messages bilingues (RG73)", () => {
      expect(BADGE_REVOCATION_REASONS.length).toBe(5);
      for (const reason of BADGE_REVOCATION_REASONS) {
        const item = BADGE_REVOCATION_MESSAGES[reason];
        expect(item).toBeDefined();
        expect(item.label.length).toBeGreaterThan(0);
        expect(item.messageFr.length).toBeGreaterThan(0);
        expect(item.messageEn.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Schémas Zod de validation", () => {
    it("valide une demande de création valide avec ou sans pièces", () => {
      const parsed1 = CreateVerificationRequestSchema.parse({
        network: "youtube",
        requestedLevel: "account_ownership",
      });
      expect(parsed1.evidenceFileIds).toEqual([]);

      const parsed2 = CreateVerificationRequestSchema.parse({
        network: "tiktok",
        requestedLevel: "audience",
        evidenceFileIds: ["11111111-1111-4111-8111-111111111111"],
      });
      expect(parsed2.evidenceFileIds.length).toBe(1);
    });

    it("exige un motif typé si decision === 'reject' (RG56)", () => {
      expect(() =>
        DecideVerificationRequestSchema.parse({
          decision: "reject",
        }),
      ).toThrow("motif de rejet typé");

      const valid = DecideVerificationRequestSchema.parse({
        decision: "reject",
        rejectionReasonCode: "evidence_too_old",
      });
      expect(valid.rejectionReasonCode).toBe("evidence_too_old");
    });

    it("exige un commentaire si rejectionReasonCode === 'other' (RG57)", () => {
      expect(() =>
        DecideVerificationRequestSchema.parse({
          decision: "reject",
          rejectionReasonCode: "other",
        }),
      ).toThrow("commentaire explicatif");

      const valid = DecideVerificationRequestSchema.parse({
        decision: "reject",
        rejectionReasonCode: "other",
        agentComment: "Explication détaillée du refus",
      });
      expect(valid.agentComment).toBe("Explication détaillée du refus");
    });

    it("valide le schéma de révocation avec motif typé (RG73)", () => {
      const valid = RevokeBadgeSchema.parse({
        revocationReasonCode: "forged_evidence",
        comment: "Document falsifié détecté lors d'un audit",
      });
      expect(valid.revocationReasonCode).toBe("forged_evidence");
    });
  });
});

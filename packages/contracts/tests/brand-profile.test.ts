import { describe, it, expect } from "vitest";
import {
  BrandProfileSchema,
  BrandProfilePublicViewSchema,
  BrandProfileRevealedViewSchema,
  calculateBrandProfileCompleteness,
  normalizeWebsiteDomain,
  detectDirectContactInText,
  type BrandProfile,
} from "../src/brand-profile";

describe("Brand Profile Contracts & Business Rules", () => {
  describe("Website domain normalization (RG17, CA4)", () => {
    it("réduit une URL avec protocole et chemin au domaine seul", () => {
      expect(
        normalizeWebsiteDomain("https://exemple.com/contact?utm=abc"),
      ).toBe("exemple.com");
    });

    it("retire les préfixes www. et les chemins", () => {
      expect(normalizeWebsiteDomain("http://www.techgear.fr/about")).toBe(
        "techgear.fr",
      );
    });

    it("accepte un domaine brut", () => {
      expect(normalizeWebsiteDomain("maisonsolene.fr")).toBe("maisonsolene.fr");
    });
  });

  describe("Détection de coordonnées dans un texte public (RG19, RG66)", () => {
    it("détecte une adresse e-mail", () => {
      expect(
        detectDirectContactInText(
          "Écrivez-nous à contact@marque.com pour discuter",
        ),
      ).toBe(true);
    });

    it("détecte un numéro de téléphone", () => {
      expect(
        detectDirectContactInText("Appelez le 06 12 34 56 78 dès maintenant"),
      ).toBe(true);
    });

    it("détecte un handle @", () => {
      expect(
        detectDirectContactInText("Suivez notre compte @notremarque"),
      ).toBe(true);
    });

    it("détecte un lien externe", () => {
      expect(
        detectDirectContactInText("Visitez https://notresite.com/contact"),
      ).toBe(true);
    });

    it("ne signale pas un texte de présentation valide sans coordonnées", () => {
      expect(
        detectDirectContactInText(
          "Maison Solène est une marque de cosmétiques bio formulés en Provence avec des ingrédients 100% naturels.",
        ),
      ).toBe(false);
    });
  });

  describe("Calcul de la complétude du profil (RG58)", () => {
    it("attribue 100% à un profil entièrement rempli", () => {
      const fullProfile: Partial<BrandProfile> = {
        companyName: "Maison Solène",
        sector: "beaute_cosmetiques",
        companySize: "11-50",
        country: "FR",
        presentation:
          "Maison Solène conçoit des soins bio certifiés issus de la biodiversité provençale avec des packagings rechargeables et éco-conçus pour toute la famille.",
        logoUrl: "https://storage.influx.dev/logos/solene.png",
        targetMarkets: ["FR", "BE"],
        languages: ["fr"],
        topics: ["beaute", "lifestyle"],
        targetNetworks: ["instagram", "tiktok"],
        expectedFormats: ["reel", "story"],
        indicativeBudgetBand: "1000-3000",
        targetAudienceCountries: ["FR"],
        usageRights: ["digital_30d"],
        website: "maisonsolene.fr",
        badgeStatus: "pending",
        contactRole: "dirigeant",
        contactPhone: "+33612345678",
        contactEmail: "contact@maisonsolene.fr",
      };

      const result = calculateBrandProfileCompleteness(fullProfile);
      expect(result.score).toBe(100);
      expect(result.breakdown.publicIdentity).toBe(40);
      expect(result.breakdown.collaborationExpectations).toBe(35);
      expect(result.breakdown.trust).toBe(15);
      expect(result.breakdown.contact).toBe(10);
      expect(result.missingRequiredForPublish).toHaveLength(0);
    });

    it("identifie précisément les champs manquants requis pour la publication (RG5, RG61)", () => {
      const draftProfile: Partial<BrandProfile> = {
        companyName: "TechGear",
        sector: "tech",
        country: "FR",
      };

      const result = calculateBrandProfileCompleteness(draftProfile);
      expect(result.score).toBe(12); // 5 nom + 5 secteur + 2 pays
      expect(result.missingRequiredForPublish).toContain("companySize");
      expect(result.missingRequiredForPublish).toContain("presentation");
      expect(result.missingRequiredForPublish).toContain("expectedFormats");
      expect(result.missingRequiredForPublish).toContain(
        "indicativeBudgetBand",
      );
      expect(result.missingRequiredForPublish).toContain("contactRole");
    });
  });

  describe("Schémas de visibilité D40 (Masquage symétrique RG74)", () => {
    it("la vue publique créateur omet strictement coordonnées et bloc interne", () => {
      const sample = {
        id: "11111111-1111-4111-8111-111111111111",
        companyName: "Maison Solène",
        logoUrl: "https://storage.influx.dev/logos/solene.png",
        sector: "beaute",
        secondarySectors: [],
        companySize: "11-50",
        country: "FR",
        targetMarkets: ["FR"],
        languages: ["fr"],
        website: "maisonsolene.fr",
        presentation:
          "Présentation longue de plus de 120 caractères pour le test...",
        topics: ["beaute"],
        targetNetworks: ["instagram"],
        expectedFormats: ["story"],
        indicativeBudgetBand: "1000-3000",
        currency: "EUR",
        usageRights: ["web"],
        nonMonetaryCounterpart: false,
        targetAudienceCountries: ["FR"],
        contactRole: "marketing",
        badgeStatus: "verified",
        badgeVerifiedAt: new Date().toISOString(),
      };

      const parsed = BrandProfilePublicViewSchema.parse(sample);
      expect(parsed.contactRole).toBe("marketing");
      expect((parsed as any).contactEmail).toBeUndefined();
      expect((parsed as any).contactPhone).toBeUndefined();
      expect((parsed as any).legalName).toBeUndefined();
      expect((parsed as any).completenessScore).toBeUndefined();
    });

    it("la vue révélée créateur inclut les coordonnées de contact", () => {
      const sample = {
        id: "11111111-1111-4111-8111-111111111111",
        companyName: "Maison Solène",
        sector: "beaute",
        secondarySectors: [],
        companySize: "11-50",
        country: "FR",
        targetMarkets: ["FR"],
        languages: ["fr"],
        presentation: "Présentation de plus de 120 caractères...",
        topics: ["beaute"],
        targetNetworks: ["instagram"],
        expectedFormats: ["story"],
        currency: "EUR",
        usageRights: [],
        nonMonetaryCounterpart: false,
        targetAudienceCountries: ["FR"],
        contactRole: "marketing",
        contactFirstName: "Solène",
        contactEmail: "solene@maisonsolene.fr",
        contactPhone: "+33612345678",
        badgeStatus: "verified",
      };

      const parsed = BrandProfileRevealedViewSchema.parse(sample);
      expect(parsed.contactFirstName).toBe("Solène");
      expect(parsed.contactEmail).toBe("solene@maisonsolene.fr");
      expect(parsed.contactPhone).toBe("+33612345678");
    });
  });
});

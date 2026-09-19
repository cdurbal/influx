import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import cookiePlugin from "@fastify/cookie";
import { brandProfileRoutes } from "../src/routes/brand-profile-routes";
import { BrandProfileService } from "../src/services/brand-profile-service";
import { AuthService } from "../src/services/auth-service";
import { MockStore } from "../src/mocks/mock-store";
import { SEED_IDS } from "../src/mocks/seed-data";

describe("Mission 2.1 : Contrats & Service profil Marque", () => {
  let app: ReturnType<typeof Fastify>;
  let store: MockStore;
  let authService: AuthService;
  let profileService: BrandProfileService;

  let advertiserToken: string;
  let creatorToken: string;
  let agentToken: string;

  beforeEach(async () => {
    store = MockStore.getInstance();
    store.reset();

    authService = new AuthService(store);
    profileService = new BrandProfileService(store);

    // Initialisation des sessions pour les tests
    // 1. Session annonceur (Maison Solène)
    await authService.sendOtp("contact@maisonsolene.fr", "advertiser");
    const advAuth = await authService.verifyOtp({
      email: "contact@maisonsolene.fr",
      code: "123456",
    });
    advertiserToken = advAuth.token;

    // 2. Session créateur (Lucas Tech)
    await authService.sendOtp("lucas@lucastech.fr", "creator");
    const creatorAuth = await authService.verifyOtp({
      email: "lucas@lucastech.fr",
      code: "123456",
    });
    creatorToken = creatorAuth.token;

    // 3. Session agent (Alexandre)
    const agentAuth = await authService.loginBackoffice({
      email: "alexandre@influx.io",
      code: "123456",
    });
    agentToken = agentAuth.token;

    app = Fastify();
    await app.register(cookiePlugin);
    await app.register(brandProfileRoutes, {
      profileService,
      authServiceInstance: authService,
    });
    await app.ready();
  });

  describe("CA1 & CA2 : Création automatique et pré-remplissage du profil", () => {
    it("crée automatiquement un profil brouillon pré-rempli à la première consultation", async () => {
      // Nouvel annonceur
      await authService.sendOtp("newbrand@influx.dev", "advertiser");
      const newAuth = await authService.verifyOtp({
        email: "newbrand@influx.dev",
        code: "123456",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/profiles/brand/me",
        headers: {
          authorization: `Bearer ${newAuth.token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.profile).toBeDefined();
      expect(data.profile.status).toBe("brouillon");
      expect(data.profile.country).toBe("FR");
      expect(data.profile.languages).toContain("fr");
      expect(data.profile.contactEmail).toBe("newbrand@influx.dev");
      expect(data.completenessScore).toBeGreaterThanOrEqual(0);
    });

    it("refuse l'accès à un créateur sur /me", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/profiles/brand/me",
        headers: {
          authorization: `Bearer ${creatorToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe("CA3, CA4 & CA5 : Mise à jour et normalisation du domaine", () => {
    it("normalise automatiquement le site web au nom de domaine seul (RG17, CA4)", async () => {
      const updatePayload = {
        website: "https://maisonsolene.fr/contact?utm_source=test",
        sector: "beaute_cosmetiques",
        companySize: "11-50",
      };

      const response = await app.inject({
        method: "PUT",
        url: "/api/profiles/brand/me",
        headers: {
          authorization: `Bearer ${advertiserToken}`,
        },
        payload: updatePayload,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.profile.website).toBe("maisonsolene.fr");
      expect(data.profile.sector).toBe("beaute_cosmetiques");
    });

    it("rejette une taille d'entreprise non conforme aux tranches fermées (CA5)", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/profiles/brand/me",
        headers: {
          authorization: `Bearer ${advertiserToken}`,
        },
        payload: {
          companySize: "142-salaries-exacts",
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe("ValidationError");
    });
  });

  describe("CA6 & CA7 : Soumission et contrôle des champs obligatoires", () => {
    it("échoue à la soumission si des champs obligatoires sont manquants (CA7, RG5)", async () => {
      // On vide la présentation et les formats
      await app.inject({
        method: "PUT",
        url: "/api/profiles/brand/me",
        headers: {
          authorization: `Bearer ${advertiserToken}`,
        },
        payload: {
          presentation: "Trop court",
          expectedFormats: [],
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/profiles/brand/me/submit",
        headers: {
          authorization: `Bearer ${advertiserToken}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.error).toBe("IncompleteProfileError");
      expect(data.missingFields).toContain("presentation");
      expect(data.missingFields).toContain("expectedFormats");
    });

    it("passe à l'état en_attente quand tous les champs obligatoires sont renseignés (CA6, RG5)", async () => {
      // On fournit tous les champs obligatoires
      const fullValidProfile = {
        companyName: "Maison Solène",
        sector: "beaute",
        companySize: "11-50",
        country: "FR",
        targetMarkets: ["FR"],
        languages: ["fr"],
        presentation:
          "Maison Solène conçoit des soins bio certifiés issus de la biodiversité provençale avec des packagings rechargeables et éco-conçus pour toute la famille.",
        topics: ["beaute", "lifestyle"],
        targetNetworks: ["instagram", "tiktok"],
        expectedFormats: ["reel", "story"],
        indicativeBudgetBand: "1000-3000",
        currency: "EUR",
        targetAudienceCountries: ["FR"],
        contactRole: "marketing",
      };

      await app.inject({
        method: "PUT",
        url: "/api/profiles/brand/me",
        headers: {
          authorization: `Bearer ${advertiserToken}`,
        },
        payload: fullValidProfile,
      });

      const submitResponse = await app.inject({
        method: "POST",
        url: "/api/profiles/brand/me/submit",
        headers: {
          authorization: `Bearer ${advertiserToken}`,
        },
      });

      expect(submitResponse.statusCode).toBe(200);
      const data = JSON.parse(submitResponse.body);
      expect(data.success).toBe(true);
      expect(data.profile.status).toBe("en_attente");
    });
  });

  describe("CA8 & D40 : Masquage symétrique des coordonnées de l'interlocuteur", () => {
    it("masque strictement les coordonnées de l'interlocuteur et le bloc interne pour un créateur (RG74, CA8)", async () => {
      // Configuration d'un profil complet avec coordonnées
      const soleneProfile = profileService.updateProfile(
        SEED_IDS.ADVERTISER_1,
        {
          contactFirstName: "Solène",
          contactEmail: "solene.prive@maisonsolene.fr",
          contactPhone: "+33612345678",
          contactPageUrl: "https://maisonsolene.fr/contact",
          contactRole: "marketing",
        },
      );

      // Consultation par le créateur SANS révélation
      const response = await app.inject({
        method: "GET",
        url: `/api/profiles/brand/${soleneProfile.id}`,
        headers: {
          authorization: `Bearer ${creatorToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const publicView = body.profile;

      // La fonction est publique (RG35, RG36)
      expect(publicView.contactRole).toBe("marketing");

      // Les coordonnées directes sont masquées (D40, RG35, RG39)
      expect(publicView.contactFirstName).toBeUndefined();
      expect(publicView.contactEmail).toBeUndefined();
      expect(publicView.contactPhone).toBeUndefined();
      expect(publicView.contactPageUrl).toBeUndefined();

      // Le bloc interne et la complétude ne sont jamais exposés (RG46, RG57, RG74)
      expect(publicView.legalName).toBeUndefined();
      expect(publicView.registrationNumber).toBeUndefined();
      expect(publicView.completenessScore).toBeUndefined();
    });

    it("révèle les coordonnées de l'interlocuteur après mise en relation ouverte (RG74)", async () => {
      const soleneProfile = profileService.updateProfile(
        SEED_IDS.ADVERTISER_1,
        {
          contactFirstName: "Solène",
          contactEmail: "solene.prive@maisonsolene.fr",
          contactPhone: "+33612345678",
          contactRole: "marketing",
        },
      );

      // Consultation par le créateur avec révélation (revealed=true)
      const response = await app.inject({
        method: "GET",
        url: `/api/profiles/brand/${soleneProfile.id}?revealed=true`,
        headers: {
          authorization: `Bearer ${creatorToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const revealedView = body.profile;

      expect(revealedView.contactRole).toBe("marketing");
      expect(revealedView.contactFirstName).toBe("Solène");
      expect(revealedView.contactEmail).toBe("solene.prive@maisonsolene.fr");
      expect(revealedView.contactPhone).toBe("+33612345678");

      // Le bloc interne et la complétude restent STRICTEMENT exclus même après révélation (RG74)
      expect(revealedView.legalName).toBeUndefined();
      expect(revealedView.completenessScore).toBeUndefined();
    });
  });

  describe("Validation commerciale et rejet Backoffice (RG6, RG10, RG66)", () => {
    it("permet à un commercial de valider et publier un profil", async () => {
      const profile = profileService.getProfileByAccountId(
        SEED_IDS.ADVERTISER_1,
      );
      expect(profile).toBeDefined();

      const response = await app.inject({
        method: "POST",
        url: `/api/backoffice/profiles/brand/${profile!.id}/publish`,
        headers: {
          authorization: `Bearer ${agentToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.profile.status).toBe("publie");
      expect(data.profile.publishedAt).toBeDefined();
    });

    it("permet à un commercial de rejeter un profil avec motif typé", async () => {
      const profile = profileService.getProfileByAccountId(
        SEED_IDS.ADVERTISER_1,
      );

      const response = await app.inject({
        method: "POST",
        url: `/api/backoffice/profiles/brand/${profile!.id}/reject`,
        headers: {
          authorization: `Bearer ${agentToken}`,
        },
        payload: {
          reason: "contact_in_public_text",
          customMessage:
            "Merci de retirer votre numéro de téléphone de la description.",
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.profile.status).toBe("refuse");
      expect(data.profile.rejectionReason).toBe("contact_in_public_text");
    });
  });

  describe("Demande de badge Marque vérifiée (RG46, RG47, RG51)", () => {
    it("génère un code de preuve domaine unique et passe en pending", async () => {
      // S'assurer qu'un site web existe d'abord
      await app.inject({
        method: "PUT",
        url: "/api/profiles/brand/me",
        headers: {
          authorization: `Bearer ${advertiserToken}`,
        },
        payload: {
          website: "maisonsolene.fr",
        },
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/profiles/brand/me/badge-request",
        headers: {
          authorization: `Bearer ${advertiserToken}`,
        },
        payload: {
          legalName: "Maison Solène SAS",
          registrationCountry: "FR",
          registrationNumber: "89123456700012",
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.profile.badgeStatus).toBe("pending");
      expect(data.profile.badgeDomainProofCode).toMatch(/^INFLUX-VERIF-/);
      expect(data.profile.legalName).toBe("Maison Solène SAS");
    });
  });
});

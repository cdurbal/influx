import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import cookiePlugin from "@fastify/cookie";
import { creatorProfileRoutes } from "../src/routes/creator-profile-routes";
import { CreatorProfileService } from "../src/services/creator-profile-service";
import { AuthService } from "../src/services/auth-service";
import { MockStore } from "../src/mocks/mock-store";
import { SEED_IDS } from "../src/mocks/seed-data";

describe("Mission 2.3 : Contrats & Service profil Créateur (3 couches)", () => {
  let app: ReturnType<typeof Fastify>;
  let store: MockStore;
  let authService: AuthService;
  let profileService: CreatorProfileService;

  let creatorToken: string;
  let advertiserToken: string;
  let agentToken: string;

  beforeEach(async () => {
    store = MockStore.getInstance();
    store.reset();

    authService = new AuthService(store);
    profileService = new CreatorProfileService(store);

    // Initialisation des sessions pour les tests
    // 1. Session créateur (Lucas Tech - creator-1)
    await authService.sendOtp("lucas@lucastech.fr", "creator");
    const creatorAuth = await authService.verifyOtp({
      email: "lucas@lucastech.fr",
      code: "123456",
    });
    creatorToken = creatorAuth.token;

    // 2. Session annonceur (Maison Solène - advertiser-1)
    await authService.sendOtp("contact@maisonsolene.fr", "advertiser");
    const advAuth = await authService.verifyOtp({
      email: "contact@maisonsolene.fr",
      code: "123456",
    });
    advertiserToken = advAuth.token;

    // 3. Session agent (Alexandre)
    const agentAuth = await authService.loginBackoffice({
      email: "alexandre@influx.io",
      code: "123456",
    });
    agentToken = agentAuth.token;

    app = Fastify();
    await app.register(cookiePlugin);
    await app.register(creatorProfileRoutes, {
      profileService,
      authServiceInstance: authService,
    });
    await app.ready();
  });

  describe("CA1 & CA2 : Création automatique et pré-remplissage du profil", () => {
    it("crée automatiquement un profil créateur à l'état brouillon avec alias généré", async () => {
      // Nouveau créateur
      await authService.sendOtp("nouveau.createur@influx.dev", "creator");
      const newAuth = await authService.verifyOtp({
        email: "nouveau.createur@influx.dev",
        code: "123456",
      });

      const response = await app.inject({
        method: "GET",
        url: "/api/profiles/creator/me",
        headers: {
          authorization: `Bearer ${newAuth.token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.profile).toBeDefined();
      expect(data.profile.status).toBe("brouillon");
      expect(data.profile.alias).toMatch(/^Profil [2-9A-HJ-NP-Z]{4}$/);
      expect(data.profile.country).toBe("FR");
      expect(data.profile.languages).toContain("fr");
      expect(data.profile.declaredStatus).toBe("individual");
    });

    it("interdit l'accès à un annonceur sur le profil créateur (D41)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/profiles/creator/me",
        headers: {
          authorization: `Bearer ${advertiserToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().message).toContain("réservé aux créateurs");
    });
  });

  describe("Mise à jour, validation et recalcul de complétude", () => {
    it("met à jour les informations et recalcule le score de complétude (RG86, RG87)", async () => {
      const updatePayload = {
        shortTitle: "Créateur Vulgarisation Tech & Tests PC",
        bio: "Passionné d'informatique et de gaming, je réalise des tests poussés et impartiaux sur les composants et périphériques récents avec une ligne éditoriale axée sur l'analyse technique.",
        primaryTopic: "tech",
        secondaryTopics: ["gaming"],
        editorialTone: ["pedagogique", "expert_technique"],
        languages: ["fr", "en"],
        country: "FR",
        city: "Lyon",
        networks: [
          {
            network: "youtube",
            isPrimary: true,
            handle: "@lucastech",
            profileUrl: "https://youtube.com/@lucastech",
            followersCount: 120000,
            audienceBand: "macro",
            engagementRate: 3.8,
            engagementRateBand: "3_6",
            figuresSource: "declared",
            figuresUpdatedAt: new Date().toISOString(),
          },
        ],
        offers: [
          {
            format: "video_dediee",
            network: "youtube",
            priceBand: "1000_2000",
            currency: "EUR",
            deliveryLeadBand: "15_30d",
            includedUsageRights: ["digital_30d"],
          },
        ],
        availability: "lt_2w",
      };

      const response = await app.inject({
        method: "PUT",
        url: "/api/profiles/creator/me",
        headers: {
          authorization: `Bearer ${creatorToken}`,
        },
        payload: updatePayload,
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.profile.shortTitle).toBe(
        "Créateur Vulgarisation Tech & Tests PC",
      );
      expect(data.profile.city).toBe("Lyon");
      expect(data.completenessScore).toBeGreaterThan(0);
      // Net estimé calculé depuis le référentiel (65% sur 1000-2000 EUR -> 650-1300 EUR)
      expect(data.profile.offers[0].estimatedNetMinMinor).toBe(65000);
      expect(data.profile.offers[0].estimatedNetMaxMinor).toBe(130000);
    });

    it("rejette la mise à jour si le titre court contient des coordonnées directes (RG27, CA7)", async () => {
      const response = await app.inject({
        method: "PUT",
        url: "/api/profiles/creator/me",
        headers: {
          authorization: `Bearer ${creatorToken}`,
        },
        payload: {
          shortTitle: "Suivez @moncompte et écrivez à test@gmail.com",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain("coordonnées");
    });
  });

  describe("Soumission pour validation (RG4, RG5, CA8)", () => {
    it("refuse la soumission si le portfolio compte moins de 3 éléments (RG4, RG77)", async () => {
      // Créateur avec profil incomplet (0 visuels de portfolio)
      await authService.sendOtp("empty.creator@influx.dev", "creator");
      const emptyAuth = await authService.verifyOtp({
        email: "empty.creator@influx.dev",
        code: "123456",
      });

      const response = await app.inject({
        method: "POST",
        url: "/api/profiles/creator/me/submit",
        headers: {
          authorization: `Bearer ${emptyAuth.token}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const data = response.json();
      expect(data.error).toBe("Validation Failed");
      expect(data.missingFields).toContain("portfolio");
      expect(data.missingFields).toContain("shortTitle");
      expect(data.missingFields).toContain("bio");
    });

    it("soumet le profil avec succès si tous les prérequis sont remplis", async () => {
      const submitResponse = await app.inject({
        method: "POST",
        url: "/api/profiles/creator/me/submit",
        headers: {
          authorization: `Bearer ${creatorToken}`,
        },
      });

      expect(submitResponse.statusCode).toBe(200);
      expect(submitResponse.json().profile.status).toBe("en_attente");
    });
  });

  describe("Couche A (Anonyme) & Couche I (Révélée) : Séparation stricte (RG16, RG18, RG102)", () => {
    it("GET /api/creators/:id/anonymous ne renvoie AUCUN handle, URL, pseudo, contact direct ni chiffre exact (CA4, CA13, CA15)", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/creators/${SEED_IDS.CREATOR_1}/anonymous`,
        headers: {
          authorization: `Bearer ${advertiserToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      const profile = data.profile;

      // 1. Vitrine publique anonyme
      expect(profile.alias).toBeDefined();
      expect(profile.shortTitle).toBeDefined();
      expect(profile.bio).toBeDefined();
      expect(profile.primaryTopic).toBe("tech");

      // 2. Vérification d'absence totale des champs identifiants
      expect(profile.pseudonym).toBeUndefined();
      expect(profile.city).toBeUndefined();
      expect(profile.legalFirstName).toBeUndefined();
      expect(profile.legalLastName).toBeUndefined();
      expect(profile.phone).toBeUndefined();
      expect(profile.email).toBeUndefined();
      expect(profile.postalAddress).toBeUndefined();
      expect(profile.refusedSectors).toBeUndefined();
      expect(profile.completenessScore).toBeUndefined();

      // 3. Réseaux : aucun handle ni URL ni followers exacts
      expect(profile.networks).toBeDefined();
      expect(profile.networks.length).toBeGreaterThan(0);
      for (const net of profile.networks) {
        expect(net.handle).toBeUndefined();
        expect(net.profileUrl).toBeUndefined();
        expect(net.followersCount).toBeUndefined();
        expect(net.audienceBand).toBeDefined(); // Seule la tranche est présente
      }

      // 4. Offres : aucune valeur exacte ni net estimé
      for (const offer of profile.offers) {
        expect(offer.priceBand).toBeDefined();
        expect(offer.exactAmountMinor).toBeUndefined();
        expect(offer.estimatedNetMinMinor).toBeUndefined();
      }
    });

    it("GET /api/creators/:id/revealed révèle les pseudos, liens et chiffres exacts SANS exposer la couche N (CA14, CA56)", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/creators/${SEED_IDS.CREATOR_1}/revealed`,
        headers: {
          authorization: `Bearer ${advertiserToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      const profile = data.profile;

      // Révélés
      expect(profile.networks[0].handle).toBe("@lucastech");
      expect(profile.networks[0].profileUrl).toBe(
        "https://youtube.com/@lucastech",
      );
      expect(profile.networks[0].followersCount).toBeDefined();

      // STRICTEMENT INTERDITS (Couche N - RG20, RG103)
      expect(profile.legalFirstName).toBeUndefined();
      expect(profile.phone).toBeUndefined();
      expect(profile.email).toBeUndefined();
      expect(profile.postalAddress).toBeUndefined();
      expect(profile.refusedSectors).toBeUndefined();
      expect(profile.offers[0].exactAmountMinor).toBeUndefined();
      expect(profile.offers[0].estimatedNetMinMinor).toBeUndefined();
    });
  });

  describe("Backoffice : Validation, publication et refus motivé", () => {
    it("permet à un agent de publier un profil créateur (RG5, RG95)", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/backoffice/profiles/creator/${SEED_IDS.CREATOR_1}/publish`,
        headers: {
          authorization: `Bearer ${agentToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.profile.status).toBe("publie");
      expect(data.profile.publishedAt).toBeDefined();
    });

    it("permet à un agent de refuser un profil créateur avec motif typé (RG10, RG96, CA51)", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/backoffice/profiles/creator/${SEED_IDS.CREATOR_2}/reject`,
        headers: {
          authorization: `Bearer ${agentToken}`,
        },
        payload: {
          reason: "bio_too_short_or_unclear",
          customMessage: "Veuillez détailler vos formats de prédilection.",
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.profile.status).toBe("refuse");
      expect(data.profile.rejectionReason).toBe("bio_too_short_or_unclear");
      expect(data.profile.rejectionMessage).toBe(
        "Veuillez détailler vos formats de prédilection.",
      );
    });

    it("interdit les actions backoffice à un annonceur ou un créateur (403)", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/backoffice/profiles/creator/${SEED_IDS.CREATOR_1}/publish`,
        headers: {
          authorization: `Bearer ${creatorToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import cookiePlugin from "@fastify/cookie";
import { introductionRoutes } from "../src/routes/introduction-routes";
import { IntroductionService } from "../src/services/introduction-service";
import { AuthService } from "../src/services/auth-service";
import { MockStore } from "../src/mocks/mock-store";
import { SEED_IDS } from "../src/mocks/seed-data";

describe("Mission 4.1 : Service des 3 Déclencheurs de mise en relation", () => {
  let app: FastifyInstance;
  let store: MockStore;
  let authService: AuthService;
  let introService: IntroductionService;

  let advertiserToken: string;
  let advertiser2Token: string;
  let creatorToken: string;
  let creator2Token: string;
  let agentToken: string;

  beforeEach(async () => {
    store = MockStore.getInstance();
    store.reset(); // Charge le jeu de données seed avec campagnes et comptes

    authService = new AuthService(store);
    introService = new IntroductionService(store);

    // Initialisation des sessions pour les tests
    // 1. Annonceur 1 (Maison Solène)
    await authService.sendOtp("contact@maisonsolene.fr", "advertiser");
    const advAuth = await authService.verifyOtp({
      email: "contact@maisonsolene.fr",
      code: "123456",
    });
    advertiserToken = advAuth.token;

    // 2. Annonceur 2 (TechGear)
    await authService.sendOtp("partenariats@techgear.fr", "advertiser");
    const adv2Auth = await authService.verifyOtp({
      email: "partenariats@techgear.fr",
      code: "123456",
    });
    advertiser2Token = adv2Auth.token;

    // 3. Créateur 1 (Lucas Tech)
    await authService.sendOtp("lucas@lucastech.fr", "creator");
    const creatorAuth = await authService.verifyOtp({
      email: "lucas@lucastech.fr",
      code: "123456",
    });
    creatorToken = creatorAuth.token;

    // 4. Créateur 2 (Sophie Mode)
    await authService.sendOtp("sophie@sophiemode.fr", "creator");
    const creator2Auth = await authService.verifyOtp({
      email: "sophie@sophiemode.fr",
      code: "123456",
    });
    creator2Token = creator2Auth.token;

    // 5. Commercial INFLUX (Alexandre)
    const agentAuth = await authService.loginBackoffice({
      email: "alexandre@influx.io",
      code: "123456",
    });
    agentToken = agentAuth.token;

    app = Fastify();
    await app.register(cookiePlugin);
    await app.register(introductionRoutes, {
      introductionService: introService,
      authServiceInstance: authService,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // ==========================================================================
  // DÉCLENCHEUR 1 : DEMANDE DE CONTACT MARQUE (POST /api/introductions/brand-request)
  // ==========================================================================
  describe("Déclencheur 1 : Demande de contact marque (brand_contact_request)", () => {
    it("crée une mise en relation en attente dans la file (status = pending_review) avec pays historisés", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/introductions/brand-request",
        headers: {
          authorization: `Bearer ${advertiserToken}`,
        },
        payload: {
          creatorAccountId: SEED_IDS.CREATOR_1,
          campaignId: SEED_IDS.CAMPAIGN_1,
          message:
            "Nous aimerions collaborer avec vous pour le lancement de notre nouvelle gamme été.",
          termsAccepted: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.ok).toBe(true);
      expect(data.introduction).toBeDefined();

      const intro = data.introduction;
      expect(intro.origin).toBe("brand_contact_request");
      expect(intro.status).toBe("pending_review");
      expect(intro.reference).toMatch(/^MER-\d{4}-\d{6}$/);
      expect(intro.advertiserAccountId).toBe(SEED_IDS.ADVERTISER_1);
      expect(intro.creatorAccountId).toBe(SEED_IDS.CREATOR_1);
      expect(intro.campaignId).toBe(SEED_IDS.CAMPAIGN_1);

      // Invariants légaux et de preuve
      expect(intro.advertiserCountryAtIntro).toBe("FR");
      expect(intro.creatorCountryAtIntro).toBe("FR");
      expect(intro.advertiserAcceptedAt).toBeDefined();
      expect(intro.creatorAcceptedAt).toBeNull();
      expect(intro.identityRevealedAt).toBeNull(); // Rien n'est révélé à ce stade !
      expect(intro.ownerAgentId).toBeNull();
      expect(intro.slaDueAt).toBeDefined();
    });

    it("fonctionne également sans campagne rattachée", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/introductions/brand-request",
        headers: {
          authorization: `Bearer ${advertiserToken}`,
        },
        payload: {
          creatorAccountId: SEED_IDS.CREATOR_2,
          message: "Prise de contact exploratoire pour de futurs partenariats.",
          termsAccepted: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.introduction.campaignId).toBeNull();
      expect(data.introduction.origin).toBe("brand_contact_request");
    });

    it("refuse l'accès à un créateur tentant d'initier une demande de marque (403)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/introductions/brand-request",
        headers: {
          authorization: `Bearer ${creatorToken}`,
        },
        payload: {
          creatorAccountId: SEED_IDS.CREATOR_2,
          message: "Tentative non autorisée depuis un profil créateur.",
          termsAccepted: true,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("rejette la demande si l'acceptation des conditions est absente (400)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/introductions/brand-request",
        headers: {
          authorization: `Bearer ${advertiserToken}`,
        },
        payload: {
          creatorAccountId: SEED_IDS.CREATOR_1,
          message: "Message de test sans acceptation de clause.",
          termsAccepted: false,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("bloque la tentative de doublon d'introduction active (409)", async () => {
      // 1ère demande
      const res1 = await app.inject({
        method: "POST",
        url: "/api/introductions/brand-request",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: {
          creatorAccountId: SEED_IDS.CREATOR_1,
          campaignId: SEED_IDS.CAMPAIGN_1,
          message: "Première demande de mise en relation.",
          termsAccepted: true,
        },
      });
      expect(res1.statusCode).toBe(201);

      // 2ème demande identique -> 409
      const res2 = await app.inject({
        method: "POST",
        url: "/api/introductions/brand-request",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: {
          creatorAccountId: SEED_IDS.CREATOR_1,
          campaignId: SEED_IDS.CAMPAIGN_1,
          message: "Seconde demande redondante pour le même créateur.",
          termsAccepted: true,
        },
      });
      expect(res2.statusCode).toBe(409);
    });
  });

  // ==========================================================================
  // DÉCLENCHEUR 2 : CANDIDATURE CRÉATEUR (POST /api/introductions/creator-apply)
  // ==========================================================================
  describe("Déclencheur 2 : Candidature créateur (creator_application)", () => {
    it("permet à un créateur de postuler à une campagne publiée (status = pending_review)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/introductions/creator-apply",
        headers: {
          authorization: `Bearer ${creatorToken}`,
        },
        payload: {
          campaignId: SEED_IDS.CAMPAIGN_1,
          message:
            "Bonjour, mon audience tech correspond exactement à la cible de votre produit.",
          proposedFormats: ["post_instagram", "video_tiktok"],
          termsAccepted: true,
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.ok).toBe(true);

      const intro = data.introduction;
      expect(intro.origin).toBe("creator_application");
      expect(intro.status).toBe("pending_review");
      expect(intro.creatorAccountId).toBe(SEED_IDS.CREATOR_1);
      expect(intro.advertiserAccountId).toBe(SEED_IDS.ADVERTISER_1);
      expect(intro.campaignId).toBe(SEED_IDS.CAMPAIGN_1);

      // Acceptation du créateur historisée
      expect(intro.creatorAcceptedAt).toBeDefined();
      expect(intro.advertiserAcceptedAt).toBeNull();
      expect(intro.identityRevealedAt).toBeNull();
    });

    it("refuse l'accès à une marque tentant de postuler (403)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/introductions/creator-apply",
        headers: {
          authorization: `Bearer ${advertiserToken}`,
        },
        payload: {
          campaignId: SEED_IDS.CAMPAIGN_1,
          message: "Tentative d'une marque d'appeler creator-apply.",
          termsAccepted: true,
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("rejette la candidature si la campagne n'existe pas (404)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/introductions/creator-apply",
        headers: {
          authorization: `Bearer ${creatorToken}`,
        },
        payload: {
          campaignId: "00000000-0000-4000-8000-000000000000",
          message: "Candidature pour campagne imaginaire.",
          termsAccepted: true,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it("bloque la double candidature du même créateur sur la même campagne (409)", async () => {
      // 1ère candidature
      const res1 = await app.inject({
        method: "POST",
        url: "/api/introductions/creator-apply",
        headers: { authorization: `Bearer ${creatorToken}` },
        payload: {
          campaignId: SEED_IDS.CAMPAIGN_1,
          message: "Première candidature du créateur 1.",
          termsAccepted: true,
        },
      });
      expect(res1.statusCode).toBe(201);

      // 2ème candidature -> 409
      const res2 = await app.inject({
        method: "POST",
        url: "/api/introductions/creator-apply",
        headers: { authorization: `Bearer ${creatorToken}` },
        payload: {
          campaignId: SEED_IDS.CAMPAIGN_1,
          message: "Seconde candidature du même créateur.",
          termsAccepted: true,
        },
      });
      expect(res2.statusCode).toBe(409);
    });
  });

  // ==========================================================================
  // DÉCLENCHEUR 3 : PROPOSITION INFLUX (POST /api/backoffice/introductions/propose)
  // ==========================================================================
  describe("Déclencheur 3 : Proposition commerciale INFLUX (influx_proposal)", () => {
    it("court-circuite la file (status = approved), attribue le commercial et crée 1 objet par créateur sélectionné", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/backoffice/introductions/propose",
        headers: {
          authorization: `Bearer ${agentToken}`,
        },
        payload: {
          campaignId: SEED_IDS.CAMPAIGN_1,
          creatorAccountIds: [SEED_IDS.CREATOR_1, SEED_IDS.CREATOR_2],
          message:
            "Sélection commerciale INFLUX : ces deux créateurs possèdent l'engagement idéal pour votre brief.",
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.ok).toBe(true);
      expect(data.count).toBe(2);
      expect(data.introductions.length).toBe(2);

      const [intro1, intro2] = data.introductions;

      // 1. Deux objets distincts avec références différentes (Règle 1)
      expect(intro1.id).not.toBe(intro2.id);
      expect(intro1.reference).not.toBe(intro2.reference);

      // 2. Statut approved directement (file court-circuitée)
      expect(intro1.status).toBe("approved");
      expect(intro2.status).toBe("approved");

      // 3. Commercial titulaire assigné d'office
      expect(intro1.ownerAgentId).toBe(SEED_IDS.AGENT_1);
      expect(intro2.ownerAgentId).toBe(SEED_IDS.AGENT_1);

      // 4. INVARIANT : Le consentement n'est PAS court-circuité -> identité masquée tant que non validé par les parties
      expect(intro1.identityRevealedAt).toBeNull();
      expect(intro2.identityRevealedAt).toBeNull();
      expect(intro1.advertiserAcceptedAt).toBeNull();
      expect(intro1.creatorAcceptedAt).toBeNull();
    });

    it("refuse l'accès à un membre non agent (403)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/backoffice/introductions/propose",
        headers: {
          authorization: `Bearer ${advertiserToken}`,
        },
        payload: {
          campaignId: SEED_IDS.CAMPAIGN_1,
          creatorAccountIds: [SEED_IDS.CREATOR_1],
          message: "Tentative d'annonceur sur route commerciale.",
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it("rejette la requête si aucun créateur n'est sélectionné (400)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/backoffice/introductions/propose",
        headers: {
          authorization: `Bearer ${agentToken}`,
        },
        payload: {
          campaignId: SEED_IDS.CAMPAIGN_1,
          creatorAccountIds: [],
          message: "Proposition sans créateurs.",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ==========================================================================
  // CONSULTATION & FILE DE VALIDATION
  // ==========================================================================
  describe("Consultation et file de validation", () => {
    it("permet à l'annonceur de lister ses mises en relation sur /my", async () => {
      // Création d'une demande par l'annonceur
      await introService.createBrandContactRequest(
        store.accounts.get(SEED_IDS.ADVERTISER_1)!,
        {
          creatorAccountId: SEED_IDS.CREATOR_1,
          message: "Demande pour listing de test.",
          termsAccepted: true,
        },
      );

      const response = await app.inject({
        method: "GET",
        url: "/api/introductions/my",
        headers: {
          authorization: `Bearer ${advertiserToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.ok).toBe(true);
      expect(data.count).toBe(1);
      expect(data.introductions[0].advertiserAccountId).toBe(
        SEED_IDS.ADVERTISER_1,
      );
    });

    it("alimente la file de validation backoffice pour les demandes en pending_review", async () => {
      // 1. Demande marque -> pending_review
      await introService.createBrandContactRequest(
        store.accounts.get(SEED_IDS.ADVERTISER_1)!,
        {
          creatorAccountId: SEED_IDS.CREATOR_1,
          message: "Demande pour file commerciale.",
          termsAccepted: true,
        },
      );

      // 2. Consultation de la file par le commercial
      const response = await app.inject({
        method: "GET",
        url: "/api/backoffice/queues/introductions",
        headers: {
          authorization: `Bearer ${agentToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.ok).toBe(true);
      expect(data.count).toBeGreaterThanOrEqual(1);
      expect(data.items[0].status).toBe("pending_review");
    });
  });

  // ==========================================================================
  // VERROU D'AGENT & DÉCISIONS COMMERCIALES (Mission 4.2)
  // ==========================================================================
  describe("Mission 4.2 : Verrou d'agent & Décision commerciale", () => {
    let testIntroId: string;

    beforeEach(async () => {
      // Créer une demande initiale en attente (pending_review)
      const intro = await introService.createBrandContactRequest(
        store.accounts.get(SEED_IDS.ADVERTISER_1)!,
        {
          creatorAccountId: SEED_IDS.CREATOR_1,
          message: "Demande pour tester le verrou et la décision commerciale.",
          termsAccepted: true,
        },
      );
      testIntroId = intro.id;
    });

    it("permet à un commercial de poser un verrou (claim) sur une demande : pending_review -> in_review", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/backoffice/introductions/${testIntroId}/claim`,
        headers: {
          authorization: `Bearer ${agentToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.ok).toBe(true);
      expect(data.introduction.status).toBe("in_review");
      expect(data.introduction.claimedByAgentId).toBe(SEED_IDS.AGENT_1);
      expect(data.introduction.claimedAt).toBeDefined();
    });

    it("empêche le double-traitement en renvoyant une 409 si un second agent tente de claim une demande déjà in_review", async () => {
      // 1. Alexandre prend en charge
      await app.inject({
        method: "POST",
        url: `/api/backoffice/introductions/${testIntroId}/claim`,
        headers: { authorization: `Bearer ${agentToken}` },
      });

      // 2. Création d'un second agent
      const agent2Auth = await authService.loginBackoffice({
        email: "sarah.admin@influx.io",
        code: "123456",
      });

      // 3. Sarah tente de prendre la même demande
      const response = await app.inject({
        method: "POST",
        url: `/api/backoffice/introductions/${testIntroId}/claim`,
        headers: { authorization: `Bearer ${agent2Auth.token}` },
      });

      expect(response.statusCode).toBe(409);
      const data = JSON.parse(response.body);
      expect(data.error).toBe("ALREADY_CLAIMED");
      expect(data.message).toContain("alexandre@influx.io");
    });

    it("permet de libérer le verrou (release) : in_review -> pending_review", async () => {
      // 1. Claim
      await app.inject({
        method: "POST",
        url: `/api/backoffice/introductions/${testIntroId}/claim`,
        headers: { authorization: `Bearer ${agentToken}` },
      });

      // 2. Release
      const response = await app.inject({
        method: "POST",
        url: `/api/backoffice/introductions/${testIntroId}/release`,
        headers: { authorization: `Bearer ${agentToken}` },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.ok).toBe(true);
      expect(data.introduction.status).toBe("pending_review");
      expect(data.introduction.claimedByAgentId).toBeNull();
    });

    it("permet à l'agent de valider (approve) la mise en relation et de s'attribuer l'affaire", async () => {
      // Prise en charge
      await app.inject({
        method: "POST",
        url: `/api/backoffice/introductions/${testIntroId}/claim`,
        headers: { authorization: `Bearer ${agentToken}` },
      });

      // Décision d'approbation
      const response = await app.inject({
        method: "POST",
        url: `/api/backoffice/introductions/${testIntroId}/decide`,
        headers: { authorization: `Bearer ${agentToken}` },
        payload: {
          action: "approve",
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.ok).toBe(true);
      expect(data.introduction.status).toBe("approved");
      expect(data.introduction.ownerAgentId).toBe(SEED_IDS.AGENT_1);
      expect(data.introduction.decidedAt).toBeDefined();
    });

    it("permet à l'agent de refuser (reject) avec un motif typé fermé obligatoire", async () => {
      // Prise en charge
      await app.inject({
        method: "POST",
        url: `/api/backoffice/introductions/${testIntroId}/claim`,
        headers: { authorization: `Bearer ${agentToken}` },
      });

      // Décision de refus
      const response = await app.inject({
        method: "POST",
        url: `/api/backoffice/introductions/${testIntroId}/decide`,
        headers: { authorization: `Bearer ${agentToken}` },
        payload: {
          action: "reject",
          rejectionReasonCode: "budget_mismatch",
          rejectionReasonComment:
            "Écart de budget trop important entre le brief annonceur et la grille du créateur.",
        },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.ok).toBe(true);
      expect(data.introduction.status).toBe("rejected");
      expect(data.introduction.rejectionReasonCode).toBe("budget_mismatch");
      expect(data.introduction.ownerAgentId).toBe(SEED_IDS.AGENT_1);
    });

    it("rejette un refus sans motif typé (400)", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/backoffice/introductions/${testIntroId}/decide`,
        headers: { authorization: `Bearer ${agentToken}` },
        payload: {
          action: "reject",
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});

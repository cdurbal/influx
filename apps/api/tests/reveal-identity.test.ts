import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import cookiePlugin from "@fastify/cookie";
import { introductionRoutes } from "../src/routes/introduction-routes";
import { IntroductionService } from "../src/services/introduction-service";
import { RevealService } from "../src/services/reveal-service";
import { AuthService } from "../src/services/auth-service";
import { MockStore } from "../src/mocks/mock-store";
import { SEED_IDS } from "../src/mocks/seed-data";

describe("Mission 4.3 : Transaction atomique de révélation d'identité (RG-M2, D37, D38)", () => {
  let app: FastifyInstance;
  let store: MockStore;
  let authService: AuthService;
  let introService: IntroductionService;
  let revealService: RevealService;

  let advertiserToken: string;
  let advertiser2Token: string;
  let creatorToken: string;
  let creator2Token: string;
  let agentToken: string;

  beforeEach(async () => {
    store = MockStore.getInstance();
    store.reset(); // Charge le jeu de données seed avec comptes, campagnes, profils

    authService = new AuthService(store);
    introService = new IntroductionService(store);
    revealService = new RevealService(store);

    // Initialisation des tokens de session
    // 1. Annonceur 1 (Maison Solène)
    await authService.sendOtp("contact@maisonsolene.fr", "advertiser");
    const advAuth = await authService.verifyOtp({
      email: "contact@maisonsolene.fr",
      code: "123456",
    });
    advertiserToken = advAuth.token;

    // 2. Annonceur 2 (TechGear France)
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
      revealService: revealService,
      authServiceInstance: authService,
      store: store,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // ==========================================================================
  // 1. TESTS UNITAIRES / SERVICE DU PROTOCOLE DE RÉVÉLATION ATOMIQUE
  // ==========================================================================
  describe("Service RevealService.revealIdentity()", () => {
    it("échoue avec 400 si la mise en relation n'est pas encore approuvée par un agent", async () => {
      const advAccount = store.accounts.get(SEED_IDS.ADVERTISER_1)!;
      const intro = await introService.createBrandContactRequest(advAccount, {
        creatorAccountId: SEED_IDS.CREATOR_1,
        campaignId: SEED_IDS.CAMPAIGN_1,
        message: "Demande initiale de partenariat",
        termsAccepted: true,
      });

      // L'intro est en pending_review
      await expect(
        revealService.revealIdentity(intro.id),
      ).rejects.toMatchObject({
        status: 400,
        code: "NOT_APPROVED",
      });
    });

    it("échoue avec 400 si l'une des parties n'a pas encore donné son consentement", async () => {
      const advAccount = store.accounts.get(SEED_IDS.ADVERTISER_1)!;
      const agentAccount = store.accounts.get(SEED_IDS.AGENT_1)!;

      const intro = await introService.createBrandContactRequest(advAccount, {
        creatorAccountId: SEED_IDS.CREATOR_1,
        campaignId: SEED_IDS.CAMPAIGN_1,
        message: "Demande initiale de partenariat",
        termsAccepted: true,
      });

      // L'agent approuve l'intro (l'annonceur a déjà accepté lors de la demande, mais le créateur n'a pas encore accepté)
      await introService.decideIntroduction(intro.id, agentAccount, {
        action: "approve",
      });

      await expect(
        revealService.revealIdentity(intro.id),
      ).rejects.toMatchObject({
        status: 400,
        code: "CONSENT_MISSING",
      });
    });

    it("exécute la transaction atomique complète lorsque approuvée et consentie par les deux parties", async () => {
      const advAccount = store.accounts.get(SEED_IDS.ADVERTISER_1)!;
      const creatorAccount = store.accounts.get(SEED_IDS.CREATOR_1)!;
      const agentAccount = store.accounts.get(SEED_IDS.AGENT_1)!;

      // 1. Demande marque (advertiserAcceptedAt est renseigné)
      const intro = await introService.createBrandContactRequest(advAccount, {
        creatorAccountId: SEED_IDS.CREATOR_1,
        campaignId: SEED_IDS.CAMPAIGN_1,
        message: "Demande initiale de partenariat",
        termsAccepted: true,
      });

      // 2. Approbation par le commercial
      await introService.decideIntroduction(intro.id, agentAccount, {
        action: "approve",
      });

      // 3. Le créateur accepte via acceptIntroduction
      const acceptRes = await revealService.acceptIntroduction(
        intro.id,
        creatorAccount,
      );
      expect(acceptRes.revealed).toBe(true);
      expect(acceptRes.revealResult).toBeDefined();

      const result = acceptRes.revealResult!;

      // Invariant 1 : Date de révélation WRITE-ONCE figée
      expect(result.introduction.identityRevealedAt).toBeDefined();
      expect(typeof result.introduction.identityRevealedAt).toBe("string");
      expect(result.introduction.status).toBe("approved");

      // Invariant 2 : Conversation à trois participants
      expect(result.conversation).toBeDefined();
      expect(result.conversation.introductionId).toBe(intro.id);
      expect(result.conversation.status).toBe("active");
      expect(result.conversation.participants).toHaveLength(3);

      const roles = result.conversation.participants.map((p) => p.role);
      expect(roles).toContain("advertiser");
      expect(roles).toContain("creator");
      expect(roles).toContain("agent");

      // Vérifier les noms révélés
      const advParticipant = result.conversation.participants.find(
        (p) => p.role === "advertiser",
      );
      expect(advParticipant?.displayName).toBe("Maison Solène");

      const agentParticipant = result.conversation.participants.find(
        (p) => p.role === "agent",
      );
      expect(agentParticipant?.email).toBe("alexandre@influx.io");

      // Message d'ouverture de session
      const storedMessages = store.messages.get(result.conversation.id);
      expect(storedMessages).toBeDefined();
      expect(storedMessages!.length).toBeGreaterThanOrEqual(1);
      const firstMessage = storedMessages?.[0] as
        { content: string } | undefined;
      expect(firstMessage?.content).toContain(intro.reference);

      // Invariant 3 : Création automatique du Deal dans le pipeline (A1/A8)
      expect(result.deal).toBeDefined();
      expect(result.deal.introductionId).toBe(intro.id);
      expect(result.deal.status).toBe("open");
      expect(result.deal.currency).toBe("EUR");
      expect(result.deal.negotiatedAmountMinor).toBeNull(); // Pas de commission automatique
      expect(result.deal.agreedCommissionMinor).toBeNull();
      expect(result.deal.advertiserAccountId).toBe(advAccount.id);
      expect(result.deal.creatorAccountId).toBe(creatorAccount.id);

      // Invariant 4 : Événement d'audit chaîné
      const auditLog = store.auditEvents.find(
        (e) =>
          e.eventType === "identity_revealed" &&
          e.payload.introductionId === intro.id,
      );
      expect(auditLog).toBeDefined();
      expect(auditLog?.payload.reference).toBe(intro.reference);
      expect(auditLog?.payload.conversationId).toBe(result.conversation.id);
      expect(auditLog?.payload.dealId).toBe(result.deal.id);

      // Invariant 5 : Émission de 2 e-mails transactionnels (outbox)
      expect(result.emailsEmitted).toHaveLength(2);
      expect(result.emailsEmitted.some((e) => e.role === "advertiser")).toBe(
        true,
      );
      expect(result.emailsEmitted.some((e) => e.role === "creator")).toBe(true);

      const outboxAdv = store.outboxEvents.find(
        (e) =>
          e.eventType === "email.identity_revealed" &&
          e.payload.reference === intro.reference &&
          e.payload.recipientRole === "advertiser",
      );
      expect(outboxAdv).toBeDefined();
      expect(outboxAdv?.payload.messageId).toBeDefined();

      const outboxCreator = store.outboxEvents.find(
        (e) =>
          e.eventType === "email.identity_revealed" &&
          e.payload.reference === intro.reference &&
          e.payload.recipientRole === "creator",
      );
      expect(outboxCreator).toBeDefined();
      expect(outboxCreator?.payload.messageId).toBeDefined();
    });

    it("verrou WRITE-ONCE : rejette avec 409 toute seconde tentative de révélation d'identité", async () => {
      const advAccount = store.accounts.get(SEED_IDS.ADVERTISER_1)!;
      const creatorAccount = store.accounts.get(SEED_IDS.CREATOR_1)!;
      const agentAccount = store.accounts.get(SEED_IDS.AGENT_1)!;

      const intro = await introService.createBrandContactRequest(advAccount, {
        creatorAccountId: SEED_IDS.CREATOR_1,
        campaignId: SEED_IDS.CAMPAIGN_1,
        message: "Demande initiale",
        termsAccepted: true,
      });

      await introService.decideIntroduction(intro.id, agentAccount, {
        action: "approve",
      });
      await revealService.acceptIntroduction(intro.id, creatorAccount);

      // Deuxième tentative directe
      await expect(
        revealService.revealIdentity(intro.id),
      ).rejects.toMatchObject({
        status: 409,
        code: "ALREADY_REVEALED",
      });
    });
  });

  // ==========================================================================
  // 2. TESTS DU FLUX COMPLET VIA LES ENDPOINTS HTTP
  // ==========================================================================
  describe("Endpoints HTTP d'acceptation et de révélation", () => {
    it("Flux 1 (Brand Request) : Marque demande -> Agent approuve -> Créateur accepte -> Révélation déclenchée", async () => {
      // 1. Demande de contact marque
      const createRes = await app.inject({
        method: "POST",
        url: "/api/introductions/brand-request",
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: {
          creatorAccountId: SEED_IDS.CREATOR_1,
          campaignId: SEED_IDS.CAMPAIGN_1,
          message: "Bonjour, nous souhaitons échanger sur un partenariat.",
          termsAccepted: true,
        },
      });
      expect(createRes.statusCode).toBe(201);
      const introId = createRes.json().introduction.id;

      // 2. Décision commerciale : Validation
      const decideRes = await app.inject({
        method: "POST",
        url: `/api/backoffice/introductions/${introId}/decide`,
        headers: { authorization: `Bearer ${agentToken}` },
        payload: { action: "approve" },
      });
      expect(decideRes.statusCode).toBe(200);
      expect(decideRes.json().introduction.status).toBe("approved");
      expect(decideRes.json().introduction.identityRevealedAt).toBeNull();

      // 3. Le créateur accepte
      const acceptRes = await app.inject({
        method: "POST",
        url: `/api/introductions/${introId}/accept`,
        headers: { authorization: `Bearer ${creatorToken}` },
      });
      expect(acceptRes.statusCode).toBe(200);
      const acceptBody = acceptRes.json();
      expect(acceptBody.ok).toBe(true);
      expect(acceptBody.revealed).toBe(true);
      expect(acceptBody.introduction.identityRevealedAt).toBeDefined();
      expect(acceptBody.revealResult.deal.status).toBe("open");
      expect(acceptBody.revealResult.conversation.participants).toHaveLength(3);
    });

    it("Flux 2 (Proposition INFLUX) : Agent propose -> Marque accepte -> Créateur accepte -> Révélation déclenchée", async () => {
      // 1. Proposition INFLUX
      const proposeRes = await app.inject({
        method: "POST",
        url: "/api/backoffice/introductions/propose",
        headers: { authorization: `Bearer ${agentToken}` },
        payload: {
          campaignId: SEED_IDS.CAMPAIGN_1,
          creatorAccountId: SEED_IDS.CREATOR_1,
          message: "Match parfait identifié pour votre campagne bio.",
        },
      });
      expect(proposeRes.statusCode).toBe(201);
      const introId = proposeRes.json().introductions[0].id;

      // 2. La marque accepte en premier
      const advAcceptRes = await app.inject({
        method: "POST",
        url: `/api/introductions/${introId}/accept`,
        headers: { authorization: `Bearer ${advertiserToken}` },
      });
      expect(advAcceptRes.statusCode).toBe(200);
      expect(advAcceptRes.json().revealed).toBe(false); // En attente du créateur

      // 3. Le créateur accepte en second
      const creatorAcceptRes = await app.inject({
        method: "POST",
        url: `/api/introductions/${introId}/accept`,
        headers: { authorization: `Bearer ${creatorToken}` },
      });
      expect(creatorAcceptRes.statusCode).toBe(200);
      const body = creatorAcceptRes.json();
      expect(body.revealed).toBe(true);
      expect(body.revealResult).toBeDefined();
      expect(body.revealResult.conversation.participants).toHaveLength(3);
      expect(body.revealResult.deal.negotiatedAmountMinor).toBeNull();
    });

    it("Flux 3 (Candidature Créateur) : Créateur postule -> Agent approuve -> Marque accepte -> Révélation", async () => {
      // 1. Candidature créateur
      const applyRes = await app.inject({
        method: "POST",
        url: "/api/introductions/creator-apply",
        headers: { authorization: `Bearer ${creatorToken}` },
        payload: {
          campaignId: SEED_IDS.CAMPAIGN_1,
          message:
            "Je propose une vidéo dédiée pour tester votre nouveau sérum.",
          termsAccepted: true,
        },
      });
      expect(applyRes.statusCode).toBe(201);
      const introId = applyRes.json().introduction.id;

      // 2. Décision commerciale : Validation
      const decideRes = await app.inject({
        method: "POST",
        url: `/api/backoffice/introductions/${introId}/decide`,
        headers: { authorization: `Bearer ${agentToken}` },
        payload: { action: "approve" },
      });
      expect(decideRes.statusCode).toBe(200);

      // 3. La marque accepte
      const acceptRes = await app.inject({
        method: "POST",
        url: `/api/introductions/${introId}/accept`,
        headers: { authorization: `Bearer ${advertiserToken}` },
      });
      expect(acceptRes.statusCode).toBe(200);
      expect(acceptRes.json().revealed).toBe(true);
      expect(acceptRes.json().introduction.identityRevealedAt).toBeDefined();
    });

    it("Flux 4 (Refus / Déclinaison) : une partie décline l'introduction -> status passe à rejected", async () => {
      // 1. Proposition INFLUX
      const proposeRes = await app.inject({
        method: "POST",
        url: "/api/backoffice/introductions/propose",
        headers: { authorization: `Bearer ${agentToken}` },
        payload: {
          campaignId: SEED_IDS.CAMPAIGN_1,
          creatorAccountId: SEED_IDS.CREATOR_1,
          message: "Proposition ciblée.",
        },
      });
      const introId = proposeRes.json().introductions[0].id;

      // 2. Le créateur décline
      const declineRes = await app.inject({
        method: "POST",
        url: `/api/introductions/${introId}/decline`,
        headers: { authorization: `Bearer ${creatorToken}` },
      });
      expect(declineRes.statusCode).toBe(200);
      expect(declineRes.json().introduction.status).toBe("rejected");

      // 3. Vérification de l'événement d'audit
      const auditDeclined = store.auditEvents.find(
        (e) =>
          e.eventType === "introduction.declined_by_party" &&
          e.payload.introductionId === introId,
      );
      expect(auditDeclined).toBeDefined();

      // 4. Tentative d'acceptation postérieure rejetée
      const acceptRes = await app.inject({
        method: "POST",
        url: `/api/introductions/${introId}/accept`,
        headers: { authorization: `Bearer ${advertiserToken}` },
      });
      expect(acceptRes.statusCode).toBe(400);
    });

    it("sécurité : un compte tiers non partie prenante ne peut pas accepter l'introduction (403)", async () => {
      // Proposition pour Créateur 1 et Annonceur 1
      const proposeRes = await app.inject({
        method: "POST",
        url: "/api/backoffice/introductions/propose",
        headers: { authorization: `Bearer ${agentToken}` },
        payload: {
          campaignId: SEED_IDS.CAMPAIGN_1,
          creatorAccountId: SEED_IDS.CREATOR_1,
          message: "Proposition.",
        },
      });
      const introId = proposeRes.json().introductions[0].id;

      // Annonceur 2 tente d'accepter l'introduction de l'Annonceur 1
      const acceptRes = await app.inject({
        method: "POST",
        url: `/api/introductions/${introId}/accept`,
        headers: { authorization: `Bearer ${advertiser2Token}` },
      });
      expect(acceptRes.statusCode).toBe(403);
    });

    it("sécurité : un compte non authentifié est rejeté avec 401", async () => {
      const acceptRes = await app.inject({
        method: "POST",
        url: `/api/introductions/some-uuid/accept`,
      });
      expect(acceptRes.statusCode).toBe(401);
    });
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import cookiePlugin from "@fastify/cookie";
import { messagingRoutes } from "../src/routes/messaging-routes";
import { introductionRoutes } from "../src/routes/introduction-routes";
import { MessagingService } from "../src/services/messaging-service";
import { IntroductionService } from "../src/services/introduction-service";
import { RevealService } from "../src/services/reveal-service";
import { AuthService } from "../src/services/auth-service";
import { MockStore } from "../src/mocks/mock-store";
import { SEED_IDS } from "../src/mocks/seed-data";
import { randomUUID } from "node:crypto";

describe("Mission 4.5 : Journalisation des lectures agents externes (RG55 à RG61, A10)", () => {
  let app: FastifyInstance;
  let store: MockStore;
  let authService: AuthService;
  let introService: IntroductionService;
  let revealService: RevealService;
  let messagingService: MessagingService;

  let assignedAgentToken: string;
  let externalAgentToken: string;
  let adminToken: string;
  let advertiserToken: string;

  let conversationId: string;

  beforeEach(async () => {
    store = MockStore.getInstance();
    store.reset();

    authService = new AuthService(store);
    introService = new IntroductionService(store);
    revealService = new RevealService(store);
    messagingService = new MessagingService(store);

    // 1. Commercial titulaire (Alexandre - assigné par défaut)
    const assignedAuth = await authService.loginBackoffice({
      email: "alexandre@influx.io",
      code: "123456",
    });
    assignedAgentToken = assignedAuth.token;

    // 2. Commercial externe (Thomas - agent non participant à la conversation)
    const externalAgentId = randomUUID();
    store.accounts.set(externalAgentId, {
      id: externalAgentId,
      email: "thomas@influx.io",
      role: "agent",
      status: "active",
      preferredLanguage: "fr",
      countryCode: "FR",
      declaredStatus: "company",
      emailStatus: "verified",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const extAgentAuth = await authService.loginBackoffice({
      email: "thomas@influx.io",
      code: "123456",
    });
    externalAgentToken = extAgentAuth.token;

    // 3. Administrateur INFLUX (Admin)
    const adminAuth = await authService.loginBackoffice({
      email: "sarah.admin@influx.io",
      code: "123456",
    });
    adminToken = adminAuth.token;

    // 4. Annonceur (Maison Solène)
    await authService.sendOtp("contact@maisonsolene.fr", "advertiser");
    const advAuth = await authService.verifyOtp({
      email: "contact@maisonsolene.fr",
      code: "123456",
    });
    advertiserToken = advAuth.token;

    // Créer une mise en relation et révéler l'identité avec Alexandre comme commercial assigné
    const advAccount = store.accounts.get(SEED_IDS.ADVERTISER_1)!;
    const creatorAccount = store.accounts.get(SEED_IDS.CREATOR_1)!;
    const agentAccount = store.accounts.get(SEED_IDS.AGENT_1)!;

    const intro = await introService.createBrandContactRequest(advAccount, {
      creatorAccountId: SEED_IDS.CREATOR_1,
      campaignId: SEED_IDS.CAMPAIGN_1,
      message: "Bonjour Lucas, préparons notre collaboration.",
      termsAccepted: true,
    });

    await introService.decideIntroduction(intro.id, agentAccount, {
      action: "approve",
    });

    const revealRes = await revealService.acceptIntroduction(
      intro.id,
      creatorAccount,
    );
    expect(revealRes.revealed).toBe(true);
    conversationId = revealRes.revealResult!.conversation.id;

    // Ajouter un message initial pour tester le décompte
    await messagingService.sendMessage(conversationId, advAccount, {
      content: "Premier échange sur le brief de campagne.",
    });

    app = Fastify();
    await app.register(cookiePlugin);
    await app.register(introductionRoutes, {
      introductionService: introService,
      revealService: revealService,
      authServiceInstance: authService,
      store,
    });
    await app.register(messagingRoutes, {
      messagingService,
      authServiceInstance: authService,
      store,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // ==========================================================================
  // 1. LECTURE PAR L'AGENT PARTICIPANT ASSIGNÉ (RG56)
  // ==========================================================================
  describe("Agent titulaire / participant assigné", () => {
    it("consigne automatiquement le motif 'suivi_de_l_affaire' sans exiger de saisie préalable (RG56)", async () => {
      const initialLogsCount = store.conversationAccessLogs.size;

      const response = await app.inject({
        method: "GET",
        url: `/api/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${assignedAgentToken}` },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.ok).toBe(true);
      expect(data.count).toBeGreaterThanOrEqual(1);

      // Une ligne doit être écrite dans le journal d'accès
      expect(store.conversationAccessLogs.size).toBe(initialLogsCount + 1);

      const logs = Array.from(store.conversationAccessLogs.values()) as any[];
      const log = logs.find((l) => l.conversationId === conversationId);
      expect(log).toBeDefined();
      expect(log.role).toBe("agent");
      expect(log.accountId).toBe(SEED_IDS.AGENT_1);
      expect(log.isParticipant).toBe(true);
      expect(log.reason).toBe("suivi_de_l_affaire");
      expect(log.messagesCount).toBeGreaterThanOrEqual(1);

      // RG58 : Le contenu d'un message n'est JAMAIS stocké dans le journal d'accès
      expect(log.content).toBeUndefined();
      expect(log.messages).toBeUndefined();

      // Journal d'audit chaîné
      const audit = store.auditEvents.find(
        (e) =>
          e.eventType === "conversation.accessed" &&
          e.payload.conversationId === conversationId &&
          e.payload.agentId === SEED_IDS.AGENT_1,
      );
      expect(audit).toBeDefined();
    });
  });

  // ==========================================================================
  // 2. LECTURE PAR UN AGENT EXTERNE NON ASSIGNÉ (RG57, RG58)
  // ==========================================================================
  describe("Agent externe / non assigné (RG57, RG58)", () => {
    it("rejette avec 400 REASON_REQUIRED si aucun motif n'est fourni préalablement (RG57)", async () => {
      const initialLogsCount = store.conversationAccessLogs.size;

      const response = await app.inject({
        method: "GET",
        url: `/api/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${externalAgentToken}` },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe("REASON_REQUIRED");
      expect(response.json().message).toContain("motif d'accès préalable typé");

      // Aucun log d'accès n'est créé et aucun message n'est délivré
      expect(store.conversationAccessLogs.size).toBe(initialLogsCount);
    });

    it("rejette avec 400 COMMENT_REQUIRED si le motif est 'autre' sans commentaire d'au moins 5 caractères", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/conversations/${conversationId}/messages?reason=autre&comment=abc`,
        headers: { authorization: `Bearer ${externalAgentToken}` },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error).toBe("COMMENT_REQUIRED");
    });

    it("autorise l'accès et journalise obligatoirement la lecture avec motif typé (RG57, RG58)", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/conversations/${conversationId}/messages?reason=continuite_de_service&sourceScreen=backoffice_urgent_queue`,
        headers: { authorization: `Bearer ${externalAgentToken}` },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.ok).toBe(true);
      expect(data.count).toBeGreaterThanOrEqual(1);

      // Vérifier le log d'accès
      const logs = Array.from(store.conversationAccessLogs.values()) as any[];
      const extLog = logs.find(
        (l) =>
          l.conversationId === conversationId &&
          l.reason === "continuite_de_service",
      );
      expect(extLog).toBeDefined();
      expect(extLog.isParticipant).toBe(false);
      expect(extLog.sourceScreen).toBe("backoffice_urgent_queue");
      expect(extLog.messagesCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // 3. CONSULTATION DU REGISTRE DES LECTURES (RG59)
  // ==========================================================================
  describe("Consultation du registre des lectures (RG59)", () => {
    beforeEach(async () => {
      // Générer une lecture par l'agent titulaire
      await app.inject({
        method: "GET",
        url: `/api/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${assignedAgentToken}` },
      });

      // Générer une lecture par l'agent externe
      await app.inject({
        method: "GET",
        url: `/api/conversations/${conversationId}/messages?reason=instruction_signalement`,
        headers: { authorization: `Bearer ${externalAgentToken}` },
      });
    });

    it("l'agent voit UNIQUEMENT ses propres lectures dans le registre (RG59)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/backoffice/conversations/access-logs",
        headers: { authorization: `Bearer ${externalAgentToken}` },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.ok).toBe(true);
      // L'agent externe ne doit voir que son propre log
      expect(
        data.logs.every((l: any) => l.reason === "instruction_signalement"),
      ).toBe(true);
    });

    it("l'administrateur voit TOUTES les lectures de tous les agents (RG59)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/backoffice/conversations/access-logs",
        headers: { authorization: `Bearer ${adminToken}` },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.ok).toBe(true);
      expect(data.logs.length).toBeGreaterThanOrEqual(2);
      expect(
        data.logs.some((l: any) => l.reason === "suivi_de_l_affaire"),
      ).toBe(true);
      expect(
        data.logs.some((l: any) => l.reason === "instruction_signalement"),
      ).toBe(true);
    });

    it("un membre annonceur ou créateur est strictement rejeté avec 403 (RG59, RG63)", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/backoffice/conversations/access-logs",
        headers: { authorization: `Bearer ${advertiserToken}` },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error).toBe("FORBIDDEN");
    });
  });

  // ==========================================================================
  // 4. SEUIL D'ALERTE DES 40 CONVERSATIONS DISTINCTES SUR 24H (RG61)
  // ==========================================================================
  describe("Alerte d'accès anormal (RG61)", () => {
    it("lève un événement d'alerte lorsque le seuil de 40 conversations distinctes est dépassé", async () => {
      const agentAccount = store.accounts.get(SEED_IDS.AGENT_1)!;

      // Créer 41 logs d'accès pour 41 conversations distinctes sur les dernières 24h
      for (let i = 1; i <= 41; i++) {
        const dummyConvId = randomUUID();
        const dummyConv = {
          id: dummyConvId,
          introductionId: randomUUID(),
          reference: `MER-2026-0000${i.toString().padStart(2, "0")}`,
          status: "active" as const,
          participants: [
            {
              accountId: agentAccount.id,
              role: "agent" as const,
              displayName: "Alexandre — INFLUX",
              email: agentAccount.email,
              joinedAt: new Date().toISOString(),
            },
            {
              accountId: randomUUID(),
              role: "advertiser" as const,
              displayName: "Marque",
              email: "m@m.fr",
              joinedAt: new Date().toISOString(),
            },
            {
              accountId: randomUUID(),
              role: "creator" as const,
              displayName: "Créateur",
              email: "c@c.fr",
              joinedAt: new Date().toISOString(),
            },
          ],
          ownerAgentId: agentAccount.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        store.conversations.set(dummyConvId, dummyConv);
        await messagingService.recordAgentAccess(dummyConv, agentAccount, {
          reason: "suivi_de_l_affaire",
        });
      }

      // Vérification de l'alerte d'accès
      const alert = store.auditEvents.find(
        (e) => e.eventType === "conversation_access_alert.threshold_exceeded",
      );
      expect(alert).toBeDefined();
      expect(alert?.payload.distinctConversationsCount).toBeGreaterThanOrEqual(
        41,
      );
    });
  });
});

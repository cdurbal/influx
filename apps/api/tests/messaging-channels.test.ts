import { describe, it, expect, beforeEach } from "vitest";
import Fastify, { FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import { MockStore } from "../src/mocks/mock-store";
import { AuthService } from "../src/services/auth-service";
import { MessagingService } from "../src/services/messaging-service";
import { messagingRoutes } from "../src/routes/messaging-routes";
import { SEED_IDS } from "../src/mocks/seed-data";
import { SESSION_COOKIE_NAME } from "@influx/contracts";

describe("Canaux de discussion privés au sein de la messagerie à trois (RG_CHANNELS)", () => {
  let app: FastifyInstance;
  let store: MockStore;
  let authService: AuthService;
  let messagingService: MessagingService;

  let advertiserToken: string;
  let creatorToken: string;
  let agentToken: string;
  const conversationId = "aaaaaaaa-1111-4111-8111-111111111111";

  beforeEach(async () => {
    store = MockStore.getInstance();
    store.reset();

    authService = new AuthService(store);
    messagingService = new MessagingService(store);

    app = Fastify();
    await app.register(fastifyCookie);
    await app.register(messagingRoutes, {
      messagingService,
      authServiceInstance: authService,
      store,
    });
    await app.ready();

    // Authentifications pour les 3 rôles
    await authService.sendOtp("contact@maisonsolene.fr", "advertiser");
    const advLogin = await authService.verifyOtp({
      email: "contact@maisonsolene.fr",
      code: "123456",
    });
    advertiserToken = advLogin.token;

    await authService.sendOtp("lucas@lucastech.fr", "creator");
    const crtLogin = await authService.verifyOtp({
      email: "lucas@lucastech.fr",
      code: "123456",
    });
    creatorToken = crtLogin.token;

    const agtLogin = await authService.loginBackoffice({
      email: "alexandre@influx.io",
      code: "123456",
    });
    agentToken = agtLogin.token;

    // Créer une conversation tripartite active
    const now = new Date().toISOString();
    store.conversations.set(conversationId, {
      id: conversationId,
      introductionId: "intro-1111",
      campaignId: SEED_IDS.CAMPAIGN_1,
      reference: "MER-2026-TEST",
      status: "active",
      participants: [
        {
          accountId: SEED_IDS.ADVERTISER_1,
          role: "advertiser",
          displayName: "Maison Solène",
          email: "contact@maisonsolene.fr",
          joinedAt: now,
        },
        {
          accountId: SEED_IDS.CREATOR_1,
          role: "creator",
          displayName: "Lucas Tech",
          email: "lucas@lucastech.fr",
          joinedAt: now,
        },
        {
          accountId: SEED_IDS.AGENT_1,
          role: "agent",
          displayName: "Alexandre Martin",
          email: "alexandre@influx.io",
          joinedAt: now,
        },
      ],
      ownerAgentId: SEED_IDS.AGENT_1,
      createdAt: now,
      updatedAt: now,
    });
    store.messages.set(conversationId, []);
  });

  it("1. Par défaut, un message est envoyé sur le canal tripartite 'three_way'", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages`,
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${advertiserToken}`,
      },
      payload: {
        content: "Bonjour à tous, bienvenue dans ce projet !",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.message.channel).toBe("three_way");
    expect(body.message.content).toBe(
      "Bonjour à tous, bienvenue dans ce projet !",
    );
  });

  it("2. L'annonceur peut envoyer un message dans le canal privé 'agent_advertiser'", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages`,
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${advertiserToken}`,
      },
      payload: {
        content:
          "Alexandre, voici notre plafond de négociation confidentiel : 15 000 EUR.",
        channel: "agent_advertiser",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.message.channel).toBe("agent_advertiser");
  });

  it("3. Un créateur NE PEUT PAS envoyer de message dans le canal privé marque 'agent_advertiser' (403)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages`,
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${creatorToken}`,
      },
      payload: {
        content: "Tentative d'intrusion créateur dans le canal privé marque",
        channel: "agent_advertiser",
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error).toBe("FORBIDDEN_CHANNEL");
  });

  it("4. Le créateur peut envoyer un message dans le canal privé 'agent_creator'", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages`,
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${creatorToken}`,
      },
      payload: {
        content:
          "Alexandre, peux-tu me confirmer le net créateur que je vais toucher ?",
        channel: "agent_creator",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.message.channel).toBe("agent_creator");
  });

  it("5. Une marque NE PEUT PAS envoyer de message dans le canal privé créateur 'agent_creator' (403)", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages`,
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${advertiserToken}`,
      },
      payload: {
        content: "Tentative d'intrusion marque dans le canal privé créateur",
        channel: "agent_creator",
      },
    });

    expect(res.statusCode).toBe(403);
    const body = res.json();
    expect(body.error).toBe("FORBIDDEN_CHANNEL");
  });

  it("6. Le commercial INFLUX peut envoyer dans les 3 canaux", async () => {
    for (const ch of [
      "three_way",
      "agent_advertiser",
      "agent_creator",
    ] as const) {
      const res = await app.inject({
        method: "POST",
        url: `/api/conversations/${conversationId}/messages`,
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${agentToken}`,
        },
        payload: {
          content: `Message commercial sur canal ${ch}`,
          channel: ch,
        },
      });
      expect(res.statusCode).toBe(201);
      expect(res.json().message.channel).toBe(ch);
    }
  });

  it("7. ISOLATION STRICTE : Le créateur ne voit JAMAIS les messages du canal 'agent_advertiser'", async () => {
    // 1 message tripartite
    await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages`,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${advertiserToken}` },
      payload: { content: "Message tripartite 1", channel: "three_way" },
    });

    // 1 message secret marque <-> agent
    await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages`,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${advertiserToken}` },
      payload: {
        content: "Budget secret marque 20 000 EUR",
        channel: "agent_advertiser",
      },
    });

    // 1 message secret créateur <-> agent
    await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages`,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${creatorToken}` },
      payload: { content: "Question perso créateur", channel: "agent_creator" },
    });

    // Le créateur lit les messages
    const creatorRead = await app.inject({
      method: "GET",
      url: `/api/conversations/${conversationId}/messages`,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${creatorToken}` },
    });

    expect(creatorRead.statusCode).toBe(200);
    const creatorMsgs = creatorRead.json().messages;
    expect(creatorMsgs.length).toBe(2);
    expect(
      creatorMsgs.some(
        (m: any) => m.content === "Budget secret marque 20 000 EUR",
      ),
    ).toBe(false);
    expect(creatorMsgs.some((m: any) => m.channel === "agent_advertiser")).toBe(
      false,
    );
  });

  it("8. ISOLATION STRICTE : La marque ne voit JAMAIS les messages du canal 'agent_creator'", async () => {
    // 1 message tripartite
    await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages`,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${creatorToken}` },
      payload: { content: "Message tripartite créateur", channel: "three_way" },
    });

    // 1 message secret créateur <-> agent
    await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages`,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${creatorToken}` },
      payload: {
        content: "Rémunération créateur confidentielle",
        channel: "agent_creator",
      },
    });

    // La marque lit les messages
    const advRead = await app.inject({
      method: "GET",
      url: `/api/conversations/${conversationId}/messages`,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${advertiserToken}` },
    });

    expect(advRead.statusCode).toBe(200);
    const advMsgs = advRead.json().messages;
    expect(advMsgs.length).toBe(1);
    expect(
      advMsgs.some(
        (m: any) => m.content === "Rémunération créateur confidentielle",
      ),
    ).toBe(false);
    expect(advMsgs.some((m: any) => m.channel === "agent_creator")).toBe(false);
  });

  it("9. L'agent peut voir tous les messages ou filtrer par canal", async () => {
    await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages`,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${advertiserToken}` },
      payload: { content: "Tripartite", channel: "three_way" },
    });
    await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages`,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${advertiserToken}` },
      payload: { content: "Privé Marque", channel: "agent_advertiser" },
    });
    await app.inject({
      method: "POST",
      url: `/api/conversations/${conversationId}/messages`,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${creatorToken}` },
      payload: { content: "Privé Créateur", channel: "agent_creator" },
    });

    // L'agent lit tout
    const agentAll = await app.inject({
      method: "GET",
      url: `/api/conversations/${conversationId}/messages`,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${agentToken}` },
    });
    expect(agentAll.json().messages.length).toBe(3);

    // L'agent filtre par canal privé marque
    const agentMarqueOnly = await app.inject({
      method: "GET",
      url: `/api/conversations/${conversationId}/messages?channel=agent_advertiser`,
      headers: { cookie: `${SESSION_COOKIE_NAME}=${agentToken}` },
    });
    expect(agentMarqueOnly.json().messages.length).toBe(1);
    expect(agentMarqueOnly.json().messages[0].channel).toBe("agent_advertiser");
  });
});

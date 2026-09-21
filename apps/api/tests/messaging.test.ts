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

describe("Mission 4.4 : Service messagerie à trois & détection de coordonnées (RG40 à RG50)", () => {
  let app: FastifyInstance;
  let store: MockStore;
  let authService: AuthService;
  let introService: IntroductionService;
  let revealService: RevealService;
  let messagingService: MessagingService;

  let advertiserToken: string;
  let advertiser2Token: string;
  let creatorToken: string;
  let agentToken: string;

  let conversationId: string;

  beforeEach(async () => {
    store = MockStore.getInstance();
    store.reset();

    authService = new AuthService(store);
    introService = new IntroductionService(store);
    revealService = new RevealService(store);
    messagingService = new MessagingService(store);

    // Initialisation des tokens de session
    await authService.sendOtp("contact@maisonsolene.fr", "advertiser");
    const advAuth = await authService.verifyOtp({
      email: "contact@maisonsolene.fr",
      code: "123456",
    });
    advertiserToken = advAuth.token;

    await authService.sendOtp("partenariats@techgear.fr", "advertiser");
    const adv2Auth = await authService.verifyOtp({
      email: "partenariats@techgear.fr",
      code: "123456",
    });
    advertiser2Token = adv2Auth.token;

    await authService.sendOtp("lucas@lucastech.fr", "creator");
    const creatorAuth = await authService.verifyOtp({
      email: "lucas@lucastech.fr",
      code: "123456",
    });
    creatorToken = creatorAuth.token;

    const agentAuth = await authService.loginBackoffice({
      email: "alexandre@influx.io",
      code: "123456",
    });
    agentToken = agentAuth.token;

    // Créer une mise en relation approuvée et révélée pour initialiser la conversation
    const advAccount = store.accounts.get(SEED_IDS.ADVERTISER_1)!;
    const creatorAccount = store.accounts.get(SEED_IDS.CREATOR_1)!;
    const agentAccount = store.accounts.get(SEED_IDS.AGENT_1)!;

    const intro = await introService.createBrandContactRequest(advAccount, {
      creatorAccountId: SEED_IDS.CREATOR_1,
      campaignId: SEED_IDS.CAMPAIGN_1,
      message: "Bonjour Lucas, nous souhaitons collaborer avec vous.",
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
  // 1. DÉTECTION UNITAIRE DES MOTIFS DE COORDONNÉES
  // ==========================================================================
  describe("Détecteur de coordonnées (detectContactInfo)", () => {
    it("détecte les adresses e-mail standard et obfusquées", () => {
      const text1 =
        "Écrivez-moi sur lucas.partenariat@gmail.com pour échanger.";
      const res1 = messagingService.detectContactInfo(text1);
      expect(res1).toHaveLength(1);
      expect(res1[0]?.detectedType).toBe("email");

      const text2 = "Mon mail perso : lucas at domain dot com direct";
      const res2 = messagingService.detectContactInfo(text2);
      expect(res2).toHaveLength(1);
      expect(res2[0]?.detectedType).toBe("email");
    });

    it("détecte les numéros de téléphone français et internationaux", () => {
      const text1 = "Appelez-moi au 06 12 34 56 78 ce soir.";
      const res1 = messagingService.detectContactInfo(text1);
      expect(res1).toHaveLength(1);
      expect(res1[0]?.detectedType).toBe("phone");

      const text2 = "Ou sur mon WhatsApp international : +33 6 98 76 54 32";
      const res2 = messagingService.detectContactInfo(text2);
      expect(res2).toHaveLength(1);
      expect(res2[0]?.detectedType).toBe("phone");
    });

    it("détecte les liens de messageries tierces", () => {
      const text = "Rejoins mon canal t.me/lucastech ou wa.me/33612345678";
      const res = messagingService.detectContactInfo(text);
      expect(res.length).toBeGreaterThanOrEqual(2);
      expect(res.some((d) => d.detectedType === "messaging_link")).toBe(true);
    });

    it("détecte les identifiants et profils de réseaux sociaux", () => {
      const text =
        "Mon insta perso est @lucas_mode_officiel contacte-moi dessus";
      const res = messagingService.detectContactInfo(text);
      expect(res.length).toBeGreaterThanOrEqual(1);
      expect(res[0]?.detectedType).toBe("social_handle");
    });

    it("détecte les coordonnées bancaires (IBAN)", () => {
      const text =
        "Voici mon rib : FR7630006000011234567890189 pour le virement";
      const res = messagingService.detectContactInfo(text);
      expect(res.length).toBeGreaterThanOrEqual(1);
      expect(res[0]?.detectedType).toBe("iban");
    });

    it("ne lève aucune détection sur un texte contractuel neutre", () => {
      const text =
        "Parfait, nous sommes d'accord sur le format de 2 réels Instagram et 1 story dédiée.";
      const res = messagingService.detectContactInfo(text);
      expect(res).toHaveLength(0);
    });
  });

  // ==========================================================================
  // 2. PRÉ-CONTRÔLE NON BLOQUANT (POST /api/conversations/:id/messages/check)
  // ==========================================================================
  describe("Pré-contrôle non bloquant (RG42, RG43, RG44)", () => {
    it("signale les coordonnées détectées avec message d'avertissement bienveillant sans rien stocker", async () => {
      const initialDetectionsCount = store.contactDetections.size;

      const response = await app.inject({
        method: "POST",
        url: `/api/conversations/${conversationId}/messages/check`,
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: {
          content: "Voici mon téléphone 0612345678 pour nous caler plus vite.",
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.ok).toBe(true);
      expect(data.hasDetections).toBe(true);
      expect(data.detections).toHaveLength(1);
      expect(data.detections[0].detectedType).toBe("phone");
      expect(data.warningMessage).toContain("Les échanges se passent ici");

      // RG44 : Rien ne doit être persisté en base lors du pré-contrôle
      expect(store.contactDetections.size).toBe(initialDetectionsCount);
    });

    it("renvoie hasDetections = false pour un message sans coordonnées", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/conversations/${conversationId}/messages/check`,
        headers: { authorization: `Bearer ${creatorToken}` },
        payload: {
          content: "Bonjour Solène, j'ai bien reçu vos échantillons bio.",
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.hasDetections).toBe(false);
      expect(data.detections).toHaveLength(0);
      expect(data.warningMessage).toBeNull();
    });
  });

  // ==========================================================================
  // 3. ENVOI DE MESSAGES ET DÉTECTIONS À L'ENREGISTREMENT (POST /messages)
  // ==========================================================================
  describe("Envoi de messages (RG35 à RG50)", () => {
    it("envoie un message texte valide et active la conversation (RG16, RG35)", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: {
          content:
            "Bonjour Lucas, ravi d'échanger avec vous sur cette campagne !",
        },
      });

      expect(response.statusCode).toBe(201);
      const data = response.json();
      expect(data.ok).toBe(true);
      expect(data.message.content).toBe(
        "Bonjour Lucas, ravi d'échanger avec vous sur cette campagne !",
      );
      expect(data.message.senderRole).toBe("advertiser");
      expect(data.message.senderDisplayName).toBe("Maison Solène");
      expect(data.detectionsCount).toBe(0);

      // Vérifier le statut de la conversation
      const conv = store.conversations.get(conversationId) as any;
      expect(conv.status).toBe("active"); // RG16 : passage automatique à active
    });

    it("enregistre l'alerte de contournement sans bloquer l'envoi (RG45, RG46, RG48)", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/api/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${creatorToken}` },
        payload: {
          content:
            "Pour aller plus vite écrivez-moi sur contact@lucas.io ou au 06 11 22 33 44.",
          warnedBeforeSend: true,
          sentAnyway: true,
        },
      });

      // RG48 : Le message part tel quel (code 201)
      expect(response.statusCode).toBe(201);
      const data = response.json();
      expect(data.detectionsCount).toBe(2); // email + phone

      // RG45 : Deux enregistrements de détection créés
      const detections = Array.from(store.contactDetections.values()) as any[];
      const messageDetections = detections.filter(
        (d) => d.messageId === data.message.id,
      );
      expect(messageDetections).toHaveLength(2);

      const emailDet = messageDetections.find(
        (d) => d.detectedType === "email",
      );
      expect(emailDet).toBeDefined();
      expect(emailDet.warnedBeforeSend).toBe(true);
      expect(emailDet.sentAnyway).toBe(true);
      expect(emailDet.status).toBe("pending");

      // RG46 : Le texte détecté n'est JAMAIS recopié dans la détection
      expect((emailDet as any).detectedSnippet).toBeUndefined();
      expect((emailDet as any).rawText).toBeUndefined();

      // Journalisation d'audit
      const audit = store.auditEvents.find(
        (e) =>
          e.eventType === "contact_detection.flagged" &&
          e.payload.messageId === data.message.id,
      );
      expect(audit).toBeDefined();
      expect(audit?.payload.detectionsCount).toBe(2);
    });

    it("refuse un message vide ou dépassant 10 000 caractères (RG35)", async () => {
      const resEmpty = await app.inject({
        method: "POST",
        url: `/api/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { content: "   " },
      });
      expect(resEmpty.statusCode).toBe(400);

      const resTooLong = await app.inject({
        method: "POST",
        url: `/api/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { content: "a".repeat(10001) },
      });
      expect(resTooLong.statusCode).toBe(400);
    });
  });

  // ==========================================================================
  // 4. CYCLE DE VIE DU FIL : PAUSE ET CLÔTURE (RG18, RG20, RG39)
  // ==========================================================================
  describe("États et permissions d'écriture (RG18, RG20, RG39)", () => {
    it("en pause : bloque l'écriture des membres mais autorise l'agent (RG18)", async () => {
      // Mettre la conversation en pause
      const conv = store.conversations.get(conversationId) as any;
      conv.status = "en_pause";
      conv.pauseReason = "Médiation commerciale sur le budget";
      store.conversations.set(conversationId, conv);

      // L'annonceur tente d'écrire -> 400 CONVERSATION_PAUSED
      const advRes = await app.inject({
        method: "POST",
        url: `/api/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { content: "Tentative d'envoi en pause" },
      });
      expect(advRes.statusCode).toBe(400);
      expect(advRes.json().error).toBe("CONVERSATION_PAUSED");

      // Le commercial écrit -> autorisé (201)
      const agentRes = await app.inject({
        method: "POST",
        url: `/api/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${agentToken}` },
        payload: {
          content:
            "Bonjour, je reprends les échanges pour cadrer la proposition financière.",
        },
      });
      expect(agentRes.statusCode).toBe(201);
      expect(agentRes.json().message.senderRole).toBe("agent");
    });

    it("fil clos : bloque l'écriture pour tout le monde (RG20, RG39)", async () => {
      const conv = store.conversations.get(conversationId) as any;
      conv.status = "close";
      conv.closeReason = "affaire_signee";
      store.conversations.set(conversationId, conv);

      const res = await app.inject({
        method: "POST",
        url: `/api/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { content: "Message après clôture" },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe("CONVERSATION_CLOSED");
    });
  });

  // ==========================================================================
  // 5. CONSULTATION ET CURSEURS DE LECTURE (GET /messages & GET /detections)
  // ==========================================================================
  describe("Consultation et curseurs de lecture (RG51, RG52, RG50)", () => {
    it("avance le curseur de lecture du créateur lors de la consultation des messages", async () => {
      // 1. L'annonceur envoie un message
      await app.inject({
        method: "POST",
        url: `/api/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { content: "Nouveau message pour Lucas." },
      });

      // 2. Le créateur consulte les messages
      const getRes = await app.inject({
        method: "GET",
        url: `/api/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${creatorToken}` },
      });
      expect(getRes.statusCode).toBe(200);
      const body = getRes.json();
      expect(body.count).toBeGreaterThanOrEqual(1);

      // Vérification du curseur de lecture
      const updatedConv = store.conversations.get(conversationId) as any;
      const creatorParticipant = updatedConv.participants.find(
        (p: any) => p.accountId === SEED_IDS.CREATOR_1,
      );
      expect(creatorParticipant.lastReadMessageId).toBeDefined();
      expect(creatorParticipant.lastReadAt).toBeDefined();
    });

    it("seul un agent peut consulter la liste des détections du backoffice (RG49, RG50)", async () => {
      // Générer une détection
      await app.inject({
        method: "POST",
        url: `/api/conversations/${conversationId}/messages`,
        headers: { authorization: `Bearer ${advertiserToken}` },
        payload: { content: "Mon email perso est solene@perso.fr" },
      });

      // 1. Accès autorisé pour le commercial
      const agentRes = await app.inject({
        method: "GET",
        url: `/api/backoffice/conversations/${conversationId}/detections`,
        headers: { authorization: `Bearer ${agentToken}` },
      });
      expect(agentRes.statusCode).toBe(200);
      expect(agentRes.json().detections.length).toBeGreaterThanOrEqual(1);

      // 2. Accès refusé pour un annonceur (403)
      const advRes = await app.inject({
        method: "GET",
        url: `/api/backoffice/conversations/${conversationId}/detections`,
        headers: { authorization: `Bearer ${advertiserToken}` },
      });
      expect(advRes.statusCode).toBe(403);
    });
  });

  // ==========================================================================
  // 6. SÉCURITÉ ET CONTRÔLE D'ACCÈS
  // ==========================================================================
  describe("Sécurité et contrôle d'accès", () => {
    it("bloque l'accès aux personnes non participantes (403)", async () => {
      const otherRes = await app.inject({
        method: "GET",
        url: `/api/conversations/${conversationId}`,
        headers: { authorization: `Bearer ${advertiser2Token}` },
      });
      expect(otherRes.statusCode).toBe(403);
    });

    it("rejette les requêtes non authentifiées (401)", async () => {
      const noAuthRes = await app.inject({
        method: "POST",
        url: `/api/conversations/${conversationId}/messages`,
        payload: { content: "Non auth" },
      });
      expect(noAuthRes.statusCode).toBe(401);
    });
  });
});

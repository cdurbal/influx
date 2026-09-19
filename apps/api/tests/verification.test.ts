import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import cookiePlugin from "@fastify/cookie";
import { verificationRoutes } from "../src/routes/verification-routes";
import { VerificationService } from "../src/services/verification-service";
import { AuthService } from "../src/services/auth-service";
import { MockStore } from "../src/mocks/mock-store";
import { CreatorProfileService } from "../src/services/creator-profile-service";
import { SEED_IDS } from "../src/mocks/seed-data";
import { type Account } from "@influx/contracts";

describe("Mission 2.6 : Service d'attribution et péremption de badge", () => {
  let app: ReturnType<typeof Fastify>;
  let store: MockStore;
  let authService: AuthService;
  let verificationService: VerificationService;
  let creatorProfileService: CreatorProfileService;

  let creatorToken: string;
  let creatorAccount: Account;
  let advertiserToken: string;
  let agentToken: string;
  let agentAccount: Account;
  let agent2Token: string;

  beforeEach(async () => {
    store = MockStore.getInstance();
    store.reset();

    authService = new AuthService(store);
    verificationService = new VerificationService(store);
    creatorProfileService = new CreatorProfileService(store);

    // 1. Authentification Créateur Lucas
    await authService.sendOtp("lucas@lucastech.fr", "creator");
    const creatorAuth = await authService.verifyOtp({
      email: "lucas@lucastech.fr",
      code: "123456",
    });
    creatorToken = creatorAuth.token;
    creatorAccount = creatorAuth.account;

    // S'assurer que le profil créateur existe avec ses réseaux
    const profile = creatorProfileService.getOrCreateProfile(creatorAccount);
    profile.networks = [
      {
        network: "youtube",
        isPrimary: true,
        handle: "@LucasTechFR",
        profileUrl: "https://youtube.com/@LucasTechFR",
        followersCount: 85000,
        audienceBand: "mid",
        figuresSource: "declared",
        figuresUpdatedAt: new Date().toISOString(),
        hasVerifiedAccountBadge: false,
        hasVerifiedAudienceBadge: false,
        accountBadgeVerifiedAt: null,
        audienceBadgeVerifiedAt: null,
      },
      {
        network: "tiktok",
        isPrimary: false,
        handle: "@lucas_tech",
        profileUrl: "https://tiktok.com/@lucas_tech",
        followersCount: 140000,
        audienceBand: "macro",
        figuresSource: "declared",
        figuresUpdatedAt: new Date().toISOString(),
        hasVerifiedAccountBadge: false,
        hasVerifiedAudienceBadge: false,
        accountBadgeVerifiedAt: null,
        audienceBadgeVerifiedAt: null,
      },
    ];
    store.creatorProfiles.set(creatorAccount.id, profile as any);

    // 2. Authentification Annonceur Solene
    await authService.sendOtp("contact@maisonsolene.fr", "advertiser");
    const advAuth = await authService.verifyOtp({
      email: "contact@maisonsolene.fr",
      code: "123456",
    });
    advertiserToken = advAuth.token;

    // 3. Authentification Agent 1 Alexandre
    const agentAuth = await authService.loginBackoffice({
      email: "alexandre@influx.io",
      code: "123456",
    });
    agentToken = agentAuth.token;
    agentAccount = agentAuth.account;

    // 4. Authentification Agent 2 (Créé pour tests de verrouillage)
    const agent2Account: Account = {
      id: "77777777-7777-4777-8777-777777777777",
      email: "julie@influx.io",
      role: "agent",
      status: "active",
      preferredLanguage: "fr",
      countryCode: "FR",
      declaredStatus: "internal",
      emailStatus: "verified",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.accounts.set(agent2Account.id, agent2Account);
    const agent2Session = await authService.loginBackoffice({
      email: "julie@influx.io",
      code: "123456",
    });
    agent2Token = agent2Session.token;

    // Configuration de l'app Fastify avec les routes de vérification
    app = Fastify();
    await app.register(cookiePlugin);
    await app.register(verificationRoutes, {
      verificationService: verificationService,
      authServiceInstance: authService,
    });
    await app.ready();
  });

  // ==========================================================================
  // 1. DEMANDES DE VÉRIFICATION CRÉATEUR
  // ==========================================================================
  describe("Demandes de vérification créateur (POST /api/verification/request)", () => {
    it("permet à un créateur de demander la vérification de propriété de compte et génère un code INFLUX (RG21, RG22)", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/verification/request",
        headers: {
          authorization: `Bearer ${creatorToken}`,
        },
        payload: {
          network: "youtube",
          requestedLevel: "account_ownership",
        },
      });

      expect(res.statusCode).toBe(201);
      const data = res.json();
      expect(data.request).toBeDefined();
      expect(data.request.status).toBe("pending");
      expect(data.request.network).toBe("youtube");
      expect(data.request.requestedLevel).toBe("account_ownership");

      // Code de vérification RG21
      expect(data.ownershipCode).toBeDefined();
      expect(data.ownershipCode.code).toMatch(/^INFLUX-[A-Z0-9]{8}$/);

      // Expiration du code à 7 jours (RG22)
      const expiresAt = new Date(data.ownershipCode.expiresAt).getTime();
      const createdAt = new Date(data.ownershipCode.createdAt).getTime();
      const diffDays = Math.round(
        (expiresAt - createdAt) / (1000 * 60 * 60 * 24),
      );
      expect(diffDays).toBe(7);
    });

    it("refuse une demande si une autre demande est déjà active sur le même triplet (RG14)", async () => {
      // 1ère demande
      await app.inject({
        method: "POST",
        url: "/api/verification/request",
        headers: { authorization: `Bearer ${creatorToken}` },
        payload: { network: "youtube", requestedLevel: "account_ownership" },
      });

      // 2ème demande identique
      const res2 = await app.inject({
        method: "POST",
        url: "/api/verification/request",
        headers: { authorization: `Bearer ${creatorToken}` },
        payload: { network: "youtube", requestedLevel: "account_ownership" },
      });

      expect(res2.statusCode).toBe(400);
      expect(res2.json().message).toContain("déjà en cours");
    });

    it("refuse la vérification d'audience si le compte n'est pas encore vérifié sur ce réseau (RG12, RG44)", async () => {
      // Le profil TikTok de Lucas n'a pas encore le badge account_verified
      const res = await app.inject({
        method: "POST",
        url: "/api/verification/request",
        headers: { authorization: `Bearer ${creatorToken}` },
        payload: {
          network: "tiktok",
          requestedLevel: "audience",
          evidenceFileIds: ["a0000000-0000-4000-8000-000000000001"],
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain("RG12");
    });

    it("refuse la vérification d'audience si aucune pièce n'est jointe (RG31, RG57)", async () => {
      // Lucas a youtube avec compte vérifié dans le seed/setup
      // Modifions le profil pour que youtube ait hasVerifiedAccountBadge = true
      const profile = store.creatorProfiles.get(creatorAccount.id) as any;
      profile.networks = profile.networks.map((n: any) =>
        n.network === "youtube" ? { ...n, hasVerifiedAccountBadge: true } : n,
      );
      store.creatorProfiles.set(creatorAccount.id, profile);

      const res = await app.inject({
        method: "POST",
        url: "/api/verification/request",
        headers: { authorization: `Bearer ${creatorToken}` },
        payload: {
          network: "youtube",
          requestedLevel: "audience",
          evidenceFileIds: [], // Pièce absente
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain("RG31");
    });
  });

  // ==========================================================================
  // 2. FILE AGENT ET VERROUILLAGE NOMINATIF
  // ==========================================================================
  describe("File d'attente et Verrouillage agent (RG43, RG61, RG62, RG64)", () => {
    it("interdit l'accès à la file aux annonceurs et créateurs (403)", async () => {
      const resCreator = await app.inject({
        method: "GET",
        url: "/api/backoffice/queues/verification",
        headers: { authorization: `Bearer ${creatorToken}` },
      });
      expect(resCreator.statusCode).toBe(403);

      const resAdv = await app.inject({
        method: "GET",
        url: "/api/backoffice/queues/verification",
        headers: { authorization: `Bearer ${advertiserToken}` },
      });
      expect(resAdv.statusCode).toBe(403);
    });

    it("permet à un agent de consulter la file triée par ancienneté croissante (RG62)", async () => {
      // Créer une demande
      const { request } = await verificationService.requestVerification(
        creatorAccount,
        {
          network: "youtube",
          requestedLevel: "account_ownership",
        },
      );

      const res = await app.inject({
        method: "GET",
        url: "/api/backoffice/queues/verification",
        headers: { authorization: `Bearer ${agentToken}` },
      });

      expect(res.statusCode).toBe(200);
      const queue = res.json().queue;
      expect(queue.length).toBeGreaterThanOrEqual(1);

      // Vérifie que la file est triée par ancienneté croissante (RG62)
      for (let i = 0; i < queue.length - 1; i++) {
        const d1 = new Date(
          queue[i].createdAt || queue[i].submittedAt || 0,
        ).getTime();
        const d2 = new Date(
          queue[i + 1].createdAt || queue[i + 1].submittedAt || 0,
        ).getTime();
        expect(d1).toBeLessThanOrEqual(d2);
      }

      const found = queue.find((q: any) => q.id === request.id);
      expect(found).toBeDefined();
      expect(found.network).toBe("youtube");
    });

    it("permet à un agent de prendre en charge une demande avec verrou de 30 minutes (RG43, RG64)", async () => {
      const { request } = await verificationService.requestVerification(
        creatorAccount,
        {
          network: "youtube",
          requestedLevel: "account_ownership",
        },
      );

      const res = await app.inject({
        method: "POST",
        url: `/api/backoffice/verification/${request.id}/claim`,
        headers: { authorization: `Bearer ${agentToken}` },
      });

      expect(res.statusCode).toBe(200);
      const claimed = res.json().request;
      expect(claimed.status).toBe("in_review");
      expect(claimed.claimedByAgentId).toBe(agentAccount.id);

      const expiresAt = new Date(claimed.claimExpiresAt).getTime();
      const claimedAt = new Date(claimed.claimedAt).getTime();
      expect(Math.round((expiresAt - claimedAt) / (1000 * 60))).toBe(30);
    });

    it("interdit à un second agent de prendre en charge une demande déjà verrouillée (RG64)", async () => {
      const { request } = await verificationService.requestVerification(
        creatorAccount,
        {
          network: "youtube",
          requestedLevel: "account_ownership",
        },
      );

      // Agent 1 prend en charge
      await app.inject({
        method: "POST",
        url: `/api/backoffice/verification/${request.id}/claim`,
        headers: { authorization: `Bearer ${agentToken}` },
      });

      // Agent 2 tente de prendre en charge
      const resAgent2 = await app.inject({
        method: "POST",
        url: `/api/backoffice/verification/${request.id}/claim`,
        headers: { authorization: `Bearer ${agent2Token}` },
      });

      expect(resAgent2.statusCode).toBe(400);
      expect(resAgent2.json().message).toContain("autre agent");
    });
  });

  // ==========================================================================
  // 3. DÉCISION AGENT : REFUS ET RÉEXAMEN
  // ==========================================================================
  describe("Décision agent : Refus et Réexamen (RG50, RG56, RG57, RG94)", () => {
    it("exige un motif typé fermé en cas de refus (RG56, RG57)", async () => {
      const { request } = await verificationService.requestVerification(
        creatorAccount,
        {
          network: "youtube",
          requestedLevel: "account_ownership",
        },
      );

      const res = await app.inject({
        method: "POST",
        url: `/api/backoffice/verification/${request.id}/decide`,
        headers: { authorization: `Bearer ${agentToken}` },
        payload: {
          decision: "reject",
          // Manque rejectionReasonCode
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("rejette la demande avec motif typé et émet un événement outbox pour notification (RG52, RG94)", async () => {
      const { request } = await verificationService.requestVerification(
        creatorAccount,
        {
          network: "youtube",
          requestedLevel: "account_ownership",
        },
      );

      const res = await app.inject({
        method: "POST",
        url: `/api/backoffice/verification/${request.id}/decide`,
        headers: { authorization: `Bearer ${agentToken}` },
        payload: {
          decision: "reject",
          rejectionReasonCode: "ownership_not_proven",
          agentComment: "Code introuvable dans la description",
        },
      });

      expect(res.statusCode).toBe(200);
      const decided = res.json().request;
      expect(decided.status).toBe("rejected");
      expect(decided.rejectionReasonCode).toBe("ownership_not_proven");

      // Vérification événement outbox
      const outboxEvt = store.outboxEvents.find(
        (e) => e.eventType === "verification.decision_rejected",
      );
      expect(outboxEvt).toBeDefined();
      expect(outboxEvt?.payload.rejectionReasonCode).toBe(
        "ownership_not_proven",
      );
    });

    it("permet de remettre une demande à réexaminer dans la file sans la clore (RG50)", async () => {
      const { request } = await verificationService.requestVerification(
        creatorAccount,
        {
          network: "youtube",
          requestedLevel: "account_ownership",
        },
      );

      const res = await app.inject({
        method: "POST",
        url: `/api/backoffice/verification/${request.id}/decide`,
        headers: { authorization: `Bearer ${agentToken}` },
        payload: {
          decision: "reexamine",
          reexamineReason: "Plateforme YouTube temporairement inaccessible",
        },
      });

      expect(res.statusCode).toBe(200);
      const updated = res.json().request;
      expect(updated.status).toBe("pending"); // Retour en attente dans la file
      expect(updated.claimedByAgentId).toBeNull();
    });
  });

  // ==========================================================================
  // 4. APPROBATION : COMPTE VÉRIFIÉ (Niveau 1)
  // ==========================================================================
  describe("Approbation Compte vérifié (RG30, RG45, RG51)", () => {
    it("approuve la propriété du compte, crée le badge sans péremption calendrier et met à jour le profil créateur", async () => {
      const { request } = await verificationService.requestVerification(
        creatorAccount,
        {
          network: "youtube",
          requestedLevel: "account_ownership",
        },
      );

      const res = await app.inject({
        method: "POST",
        url: `/api/backoffice/verification/${request.id}/decide`,
        headers: { authorization: `Bearer ${agentToken}` },
        payload: {
          decision: "approve",
          observedHandle: "@LucasTechFR",
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.request.status).toBe("approved");

      // Badge créé
      expect(data.badge).toBeDefined();
      expect(data.badge.level).toBe("account_verified");
      expect(data.badge.expiresAt).toBeNull(); // RG30 : Pas de péremption calendrier pour la propriété
      expect(data.badge.state).toBe("active");
      expect(data.badge.grantedByAgentId).toBe(agentAccount.id);

      // Profil créateur mis à jour
      const profile = store.creatorProfiles.get(creatorAccount.id) as any;
      const yt = profile.networks.find((n: any) => n.network === "youtube");
      expect(yt.hasVerifiedAccountBadge).toBe(true);
      expect(yt.accountBadgeVerifiedAt).toBeDefined();
    });
  });

  // ==========================================================================
  // 5. APPROBATION : AUDIENCE VÉRIFIÉE (Niveau 2)
  // ==========================================================================
  describe("Approbation Audience vérifiée (RG20, RG31, RG36, RG41, RG42, RG69)", () => {
    beforeEach(async () => {
      // On s'assure d'abord que le niveau compte vérifié est posé
      const profile = store.creatorProfiles.get(creatorAccount.id) as any;
      profile.networks = profile.networks.map((n: any) =>
        n.network === "youtube" ? { ...n, hasVerifiedAccountBadge: true } : n,
      );
      store.creatorProfiles.set(creatorAccount.id, profile);
    });

    it("refuse l'approbation si la période constatée se termine il y a plus de 30 jours (RG31, RG36)", async () => {
      const { request } = await verificationService.requestVerification(
        creatorAccount,
        {
          network: "youtube",
          requestedLevel: "audience",
          evidenceFileIds: ["a0000000-0000-4000-8000-000000000001"],
        },
      );

      // Date il y a 45 jours
      const oldEndDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
        .toISOString()
        .substring(0, 10);
      const oldStartDate = new Date(Date.now() - 75 * 24 * 60 * 60 * 1000)
        .toISOString()
        .substring(0, 10);

      const res = await app.inject({
        method: "POST",
        url: `/api/backoffice/verification/${request.id}/decide`,
        headers: { authorization: `Bearer ${agentToken}` },
        payload: {
          decision: "approve",
          observedFollowers: 95000,
          observedPeriodStart: oldStartDate,
          observedPeriodEnd: oldEndDate,
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().message).toContain("30 jours");
    });

    it("approuve l'audience, pose une péremption à 90 jours et calcule la tranche d'audience (RG20, RG69)", async () => {
      const { request } = await verificationService.requestVerification(
        creatorAccount,
        {
          network: "youtube",
          requestedLevel: "audience",
          evidenceFileIds: ["a0000000-0000-4000-8000-000000000001"],
        },
      );

      const recentEndDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
        .toISOString()
        .substring(0, 10);
      const recentStartDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000)
        .toISOString()
        .substring(0, 10);

      const res = await app.inject({
        method: "POST",
        url: `/api/backoffice/verification/${request.id}/decide`,
        headers: { authorization: `Bearer ${agentToken}` },
        payload: {
          decision: "approve",
          observedFollowers: 95000, // 95k -> tranche "mid" (50k à 250k)
          observedPeriodStart: recentStartDate,
          observedPeriodEnd: recentEndDate,
          observedEngagement: 4.2, // tranche "3_6"
        },
      });

      expect(res.statusCode).toBe(200);
      const data = res.json();
      expect(data.badge.level).toBe("audience_verified");
      expect(data.badge.state).toBe("active");

      // Péremption à 90 jours (RG69)
      const expiresAt = new Date(data.badge.expiresAt).getTime();
      const grantedAt = new Date(data.badge.grantedAt).getTime();
      const diffDays = Math.round(
        (expiresAt - grantedAt) / (1000 * 60 * 60 * 24),
      );
      expect(diffDays).toBe(90);

      // Profil créateur actualisé
      const profile = store.creatorProfiles.get(creatorAccount.id) as any;
      const yt = profile.networks.find((n: any) => n.network === "youtube");
      expect(yt.hasVerifiedAudienceBadge).toBe(true);
      expect(yt.figuresSource).toBe("agent_observed");
      expect(yt.audienceBand).toBe("mid");
      expect(yt.engagementRateBand).toBe("3_6");
    });
  });

  // ==========================================================================
  // 6. CONSULTATION PUBLIQUE ET ANONYMISATION
  // ==========================================================================
  describe("Consultation publique des badges créateur (RG4, RG20, RG89, RG90)", () => {
    it("affiche les badges avec dates et tranches sans divulguer le chiffre exact ni le @ (RG20, RG89, RG90)", async () => {
      // Créer un badge audience vérifiée
      const badgeId = "b0000000-0000-4000-8000-000000000001";
      store.badges.set(badgeId, {
        id: badgeId,
        accountId: creatorAccount.id,
        socialAccountId: "youtube",
        network: "youtube",
        level: "audience_verified",
        grantedByAgentId: agentAccount.id,
        grantedAt: new Date().toISOString(),
        evidenceSource: "native_dashboard",
        observedFollowers: 87500, // Chiffre exact confidentiel
        expiresAt: new Date(
          Date.now() + 90 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        state: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await app.inject({
        method: "GET",
        url: `/api/creators/${creatorAccount.id}/badges`,
      });

      expect(res.statusCode).toBe(200);
      const badges = res.json().badges;
      expect(badges.length).toBe(1);

      const b = badges[0];
      expect(b.network).toBe("youtube");
      expect(b.level).toBe("audience_verified");
      expect(b.state).toBe("active");
      expect(b.audienceBand).toBe("mid");

      // Invariants stricts RG20, RG89, RG90
      expect(b.observedFollowers).toBeUndefined(); // Jamais le chiffre exact
      expect(b.handle).toBeUndefined(); // Jamais le @handle avant révélation
    });
  });

  // ==========================================================================
  // 7. RETRAIT DE BADGE
  // ==========================================================================
  describe("Retrait de badge (RG73, RG75, RG76)", () => {
    it("permet à un agent de retirer un badge avec un motif typé fermé et le masque immédiatement (RG73, RG76)", async () => {
      // Setup badge
      const badgeId = "b0000000-0000-4000-8000-000000000002";
      store.badges.set(badgeId, {
        id: badgeId,
        accountId: creatorAccount.id,
        socialAccountId: "youtube",
        network: "youtube",
        level: "account_verified",
        grantedByAgentId: agentAccount.id,
        grantedAt: new Date().toISOString(),
        evidenceSource: "native_dashboard",
        expiresAt: null,
        state: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await app.inject({
        method: "POST",
        url: `/api/backoffice/badges/${badgeId}/revoke`,
        headers: { authorization: `Bearer ${agentToken}` },
        payload: {
          revocationReasonCode: "account_closed",
          comment: "La chaîne a été supprimée",
        },
      });

      expect(res.statusCode).toBe(200);
      const revoked = res.json().badge;
      expect(revoked.state).toBe("revoked");
      expect(revoked.revocationReasonCode).toBe("account_closed");

      // Le badge ne doit plus apparaître dans la liste publique (RG76)
      const publicRes = await app.inject({
        method: "GET",
        url: `/api/creators/${creatorAccount.id}/badges`,
      });
      expect(publicRes.json().badges.length).toBe(0);
    });
  });

  // ==========================================================================
  // 8. CYCLE DE VIE ET PÉREMPTION DU BADGE (RG70)
  // ==========================================================================
  describe("Cycle de vie et Péremption du badge (RG70)", () => {
    it("fait passer un badge d'audience à to_refresh à J+90 et expired à J+120", async () => {
      const grantedAt = new Date("2026-01-01T00:00:00.000Z");
      const expiresAt = new Date("2026-04-01T00:00:00.000Z"); // +90 jours

      const badgeId = "b0000000-0000-4000-8000-000000000003";
      store.badges.set(badgeId, {
        id: badgeId,
        accountId: creatorAccount.id,
        socialAccountId: "youtube",
        network: "youtube",
        level: "audience_verified",
        grantedByAgentId: agentAccount.id,
        grantedAt: grantedAt.toISOString(),
        evidenceSource: "native_dashboard",
        observedFollowers: 50000,
        expiresAt: expiresAt.toISOString(),
        state: "active",
        createdAt: grantedAt.toISOString(),
        updatedAt: grantedAt.toISOString(),
      });

      // 1. Test à J+95 (dans le délai de grâce de 30 jours)
      const atDay95 = new Date("2026-04-06T00:00:00.000Z").toISOString();
      const stats1 = verificationService.refreshBadgeLifecycle(atDay95);
      expect(stats1.toRefreshCount).toBe(1);

      const badgeAfter95 = store.badges.get(badgeId) as any;
      expect(badgeAfter95.state).toBe("to_refresh");

      // 2. Test à J+130 (délai de grâce dépassé)
      const atDay130 = new Date("2026-05-11T00:00:00.000Z").toISOString();
      const stats2 = verificationService.refreshBadgeLifecycle(atDay130);
      expect(stats2.expiredCount).toBe(1);

      const badgeAfter130 = store.badges.get(badgeId) as any;
      expect(badgeAfter130.state).toBe("expired");

      // Le profil créateur repasse en chiffres déclarés
      const profile = store.creatorProfiles.get(creatorAccount.id) as any;
      const yt = profile.networks.find((n: any) => n.network === "youtube");
      expect(yt.hasVerifiedAudienceBadge).toBe(false);
      expect(yt.figuresSource).toBe("declared");
    });
  });
});

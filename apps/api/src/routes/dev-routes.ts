import { type FastifyInstance } from "fastify";
import { MockStore } from "../mocks/mock-store";
import { authService } from "../services/auth-service";
import { setSessionCookie, clearSessionCookie } from "./auth-routes";

export async function devRoutes(fastify: FastifyInstance): Promise<void> {
  const store = MockStore.getInstance();

  fastify.get("/api/dev/state", async (_request, reply) => {
    return reply.status(200).send({
      ok: true,
      state: store.dump(),
    });
  });

  fastify.post("/api/dev/switch-persona", async (request, reply) => {
    const body =
      (request.body as
        { email?: string | null; accountId?: string | null } | undefined) || {};
    const identifier = body.email || body.accountId;

    if (!identifier) {
      // Déconnexion -> mode Visiteur anonyme
      clearSessionCookie(reply);
      return reply.status(200).send({
        ok: true,
        account: null,
        user: null,
        message: "Déconnecté : Mode Visiteur anonyme",
      });
    }

    try {
      const session = await authService.createDevSession(identifier);
      const maxAge = session.isBackoffice ? 8 * 60 * 60 : 30 * 24 * 60 * 60;
      setSessionCookie(reply, session.token, maxAge, session.isBackoffice);

      return reply.status(200).send({
        ok: true,
        token: session.token,
        user: session.user,
        account: session.account,
        message: `Connecté en tant que ${session.user.displayName} (${session.account.role})`,
      });
    } catch (err: any) {
      return reply.status(404).send({
        ok: false,
        error: "PersonaNotFound",
        message: err.message || "Compte persona introuvable",
      });
    }
  });

  fastify.post("/api/dev/reset", async (request, reply) => {
    const body = request.body as
      | { empty?: boolean; snapshot?: Parameters<typeof store.reset>[0] }
      | undefined;
    if (body?.empty) {
      store.reset({ empty: true });
    } else if (body?.snapshot) {
      store.reset(body.snapshot);
    } else {
      store.reset();
    }
    authService.reset();

    return reply.status(200).send({
      ok: true,
      message: "Mock store reset successfully",
    });
  });

  fastify.post("/api/dev/seed-creators", async (_request, reply) => {
    const now = new Date().toISOString();
    const in90Days = new Date(
      Date.now() + 90 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const extraCreators = [
      {
        id: "66666666-6666-4666-8666-666666666666",
        email: "emma@emmaglow.fr",
        alias: "Profil 9X2L",
        title: "Créatrice Beauté Naturelle & Clean Care",
        topics: ["beaute", "lifestyle"],
        primaryNetwork: "instagram",
        networks: ["instagram", "tiktok"],
        audienceBand: "50k-100k",
        engagementBand: "3-5%",
        primaryCountry: "FR",
        formats: ["reel", "story", "post"],
        priceBand: "500-1000",
        badge: {
          level: 1,
          name: "Audience vérifiée",
          verifiedAt: now,
          expiresAt: in90Days,
        },
      },
      {
        id: "77777777-7777-4777-8777-777777777777",
        email: "antoine@chef-bistro.fr",
        alias: "Profil 4K8M",
        title: "Chef Cuisinier & Recettes Terroir",
        topics: ["food", "lifestyle"],
        primaryNetwork: "tiktok",
        networks: ["tiktok", "instagram"],
        audienceBand: "100k-250k",
        engagementBand: "5-8%",
        primaryCountry: "FR",
        formats: ["short_video", "reel"],
        priceBand: "1000-2500",
        badge: {
          level: 2,
          name: "Audience vérifiée - Certifié",
          verifiedAt: now,
          expiresAt: in90Days,
        },
      },
      {
        id: "a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1",
        email: "claire@green-deco.fr",
        alias: "Profil 2R5P",
        title: "Architecte d'Intérieur & Rénovation Éco",
        topics: ["lifestyle", "design"],
        primaryNetwork: "instagram",
        networks: ["instagram", "pinterest"],
        audienceBand: "10k-50k",
        engagementBand: "2-4%",
        primaryCountry: "FR",
        formats: ["post", "carousel", "story"],
        priceBand: "200-500",
        badge: null,
      },
      {
        id: "b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2",
        email: "julien@fit-outdoor.fr",
        alias: "Profil 8T1Q",
        title: "Coach Sportif & Nutrition Santé",
        topics: ["fitness", "sante", "lifestyle"],
        primaryNetwork: "youtube",
        networks: ["youtube", "instagram"],
        audienceBand: "50k-100k",
        engagementBand: "3-5%",
        primaryCountry: "FR",
        formats: ["video_dedicated", "short_video"],
        priceBand: "500-1000",
        badge: {
          level: 1,
          name: "Audience vérifiée",
          verifiedAt: now,
          expiresAt: in90Days,
        },
      },
    ];

    for (const c of extraCreators) {
      if (!store.accounts.has(c.id)) {
        store.accounts.set(c.id, {
          id: c.id,
          email: c.email,
          role: "creator",
          status: "active",
          preferredLanguage: "fr",
          countryCode: "FR",
          declaredStatus: "freelancer",
          emailStatus: "verified",
          createdAt: now,
          updatedAt: now,
        });
      }
      store.creatorProfiles.set(c.id, {
        accountId: c.id,
        anonymousAlias: c.alias,
        anonymousTitle: c.title,
        status: "publie",
        profileStatus: "publie",
        isPublished: true,
        searchVisibility: true,
        isMajor: true,
        topics: c.topics,
        primaryTopic: c.topics[0],
        secondaryTopics: c.topics.slice(1),
        primaryNetwork: c.primaryNetwork,
        networks: c.networks,
        audienceBand: c.audienceBand,
        engagementBand: c.engagementBand,
        primaryCountry: c.primaryCountry,
        formats: c.formats,
        priceBand: c.priceBand,
        badge: c.badge,
        createdAt: now,
        updatedAt: now,
      });
    }

    return reply.status(200).send({
      ok: true,
      message: `${extraCreators.length} extra creators seeded. Total creators: ${store.creatorProfiles.size}`,
      totalCreators: store.creatorProfiles.size,
    });
  });

  fastify.post("/api/dev/seed-conversations", async (_request, reply) => {
    const convId = "e1111111-e111-4111-8111-111111111111";
    const introId = "d1111111-d111-4111-8111-111111111111";
    const now = new Date().toISOString();
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const intro = {
      id: introId,
      reference: "MER-2026-000001",
      origin: "brand_contact_request",
      originReason:
        "Brief campagne Soin Botanique Bio - Collaboration Reels & Stories",
      campaignId: "c1111111-1111-4111-8111-111111111111",
      advertiserAccountId: "11111111-1111-4111-8111-111111111111",
      creatorAccountId: "33333333-3333-4333-8333-333333333333",
      ownerAgentId: "88888888-8888-4888-8888-888888888888",
      claimedByAgentId: "88888888-8888-4888-8888-888888888888",
      claimedAt: tenMinAgo,
      status: "approved",
      advertiserCountryAtIntro: "FR",
      creatorCountryAtIntro: "FR",
      advertiserAcceptedAt: tenMinAgo,
      creatorAcceptedAt: tenMinAgo,
      identityRevealedAt: tenMinAgo,
      conversationId: convId,
      dealId: "deal-00000001-0000-4000-8000-000000000001",
      slaDueAt: in24h,
      createdAt: tenMinAgo,
      updatedAt: now,
    };

    const conv = {
      id: convId,
      introductionId: introId,
      campaignId: "c1111111-1111-4111-8111-111111111111",
      reference: "MER-2026-000001",
      status: "active",
      ownerAgentId: "88888888-8888-4888-8888-888888888888",
      participants: [
        {
          accountId: "11111111-1111-4111-8111-111111111111",
          role: "advertiser",
          displayName: "Solène Dumas — Maison Solène",
          email: "contact@maisonsolene.fr",
          joinedAt: tenMinAgo,
        },
        {
          accountId: "33333333-3333-4333-8333-333333333333",
          role: "creator",
          displayName: "Lucas Tech (@lucastech)",
          email: "lucas@lucastech.fr",
          joinedAt: tenMinAgo,
        },
        {
          accountId: "88888888-8888-4888-8888-888888888888",
          role: "agent",
          displayName: "Alexandre — INFLUX",
          email: "alexandre.commercial@influx.test",
          joinedAt: tenMinAgo,
        },
      ],
      createdAt: tenMinAgo,
      updatedAt: now,
    };

    const messages = [
      {
        id: "f1111111-f111-4111-8111-111111111111",
        conversationId: convId,
        senderAccountId: "88888888-8888-4888-8888-888888888888",
        senderRole: "system",
        senderDisplayName: "Système INFLUX",
        content:
          "Mise en relation confirmée pour la campagne Soin Botanique Bio (Réf. MER-2026-000001). Identités révélées et commercial dédié assigné.",
        systemCode: "conversation.opened",
        createdAt: tenMinAgo,
      },
      {
        id: "f2222222-f222-4222-8222-222222222222",
        conversationId: convId,
        senderAccountId: "88888888-8888-4888-8888-888888888888",
        senderRole: "agent",
        senderDisplayName: "Alexandre — INFLUX",
        content:
          "Bonjour Solène et Lucas ! Je suis Alexandre, votre interlocuteur commercial dédié INFLUX. Je supervise cette négociation pour veiller au bon déroulement du partenariat, au respect du brief et au calendrier de publication. N'hésitez pas si vous avez la moindre question !",
        systemCode: null,
        createdAt: fiveMinAgo,
      },
      {
        id: "f3333333-f333-4333-8333-333333333333",
        conversationId: convId,
        senderAccountId: "11111111-1111-4111-8111-111111111111",
        senderRole: "advertiser",
        senderDisplayName: "Solène Dumas — Maison Solène",
        content:
          "Bonjour Alexandre, bonjour Lucas ! Nous sommes très heureux d'initier cette collaboration. Lucas, nous aimerions prévoir un reel Instagram de 45 à 60 secondes axé sur la routine matinale et l'application du sérum bio. Penses-tu pouvoir intégrer cela à ton planning de la première quinzaine du mois prochain ?",
        systemCode: null,
        createdAt: twoMinAgo,
      },
      {
        id: "f4444444-f444-4444-8444-444444444444",
        conversationId: convId,
        senderAccountId: "33333333-3333-4333-8333-333333333333",
        senderRole: "creator",
        senderDisplayName: "Lucas Tech (@lucastech)",
        content:
          "Bonjour Solène, bonjour Alexandre ! C'est tout à fait faisable. Le format routine s'intègre parfaitement à ma ligne éditoriale lifestyle clean. Je peux vous proposer un premier script et un moodboard de cadrage d'ici jeudi prochain.",
        systemCode: null,
        createdAt: now,
      },
    ];

    store.introductions.set(introId, intro);
    store.conversations.set(convId, conv);
    store.messages.set(convId, messages);

    return reply.status(200).send({
      ok: true,
      message: "Conversation démo seedée avec succès (MER-2026-000001).",
      conversation: conv,
      introduction: intro,
      messagesCount: messages.length,
    });
  });
}

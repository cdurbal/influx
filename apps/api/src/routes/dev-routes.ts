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
}

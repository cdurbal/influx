import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import {
  SESSION_COOKIE_NAME,
  CreateCampaignDraftSchema,
  UpdateCampaignSchema,
  CampaignRejectionReasonSchema,
  CampaignFeedFiltersSchema,
  type CampaignStatus,
} from "@influx/contracts";
import { authService, AuthService } from "../services/auth-service";
import { CampaignService } from "../services/campaign-service";

function extractSessionToken(request: FastifyRequest): string | undefined {
  if (request.cookies && request.cookies[SESSION_COOKIE_NAME]) {
    return request.cookies[SESSION_COOKIE_NAME];
  }
  const rawCookie = request.headers.cookie;
  if (rawCookie) {
    const match = rawCookie.match(
      new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`),
    );
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  return undefined;
}

export const campaignRoutes: FastifyPluginAsync<{
  campaignService?: CampaignService;
  authServiceInstance?: AuthService;
}> = async (fastify: FastifyInstance, opts) => {
  const campaignService = opts.campaignService || new CampaignService();
  const auth = opts.authServiceInstance || authService;

  // Helper d'authentification
  async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
    const token = extractSessionToken(request);
    if (!token) {
      reply.status(401).send({
        error: "Unauthorized",
        message: "Session requise",
      });
      return null;
    }
    const session = await auth.getSession(token);
    if (!session) {
      reply.status(401).send({
        error: "Unauthorized",
        message: "Session invalide ou expirée",
      });
      return null;
    }
    return session;
  }

  // ==========================================
  // Espace Annonceur (Marque)
  // ==========================================

  /**
   * POST /api/campaigns/draft
   * Enregistrement incrémental d'un brouillon de campagne (RG1, RG108, CA1)
   */
  fastify.post("/api/campaigns/draft", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    if (
      session.user.role !== "advertiser" &&
      session.user.role !== "agent" &&
      session.user.role !== "admin"
    ) {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Action réservée aux annonceurs ou agents autorisés",
      });
    }

    const parsed = CreateCampaignDraftSchema.safeParse(request.body || {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Format de brouillon invalide",
        issues: parsed.error.issues,
      });
    }

    const isAgent =
      session.user.role === "agent" || session.user.role === "admin";
    const brandAccountId = isAgent
      ? (request.query as { brandAccountId?: string }).brandAccountId ||
        session.account.id
      : session.account.id;

    try {
      const campaign = campaignService.createDraft(
        brandAccountId,
        parsed.data,
        isAgent ? session.account.id : undefined,
      );
      return reply.status(201).send({ campaign });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur création";
      return reply.status(400).send({ error: "Bad Request", message: msg });
    }
  });

  /**
   * PUT /api/campaigns/:id
   * Mise à jour des champs d'une campagne (RG7, RG14, CA6, CA7)
   */
  fastify.put<{ Params: { id: string } }>(
    "/api/campaigns/:id",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const parsed = UpdateCampaignSchema.safeParse(request.body || {});
      if (!parsed.success) {
        return reply.status(400).send({
          error: "Bad Request",
          message: "Format de mise à jour invalide",
          issues: parsed.error.issues,
        });
      }

      const isAgent =
        session.user.role === "agent" || session.user.role === "admin";

      try {
        const campaign = campaignService.updateCampaign(
          request.params.id,
          session.account.id,
          parsed.data,
          isAgent ? session.account.id : undefined,
        );
        return reply.status(200).send({ campaign });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erreur mise à jour";
        return reply.status(400).send({ error: "Bad Request", message: msg });
      }
    },
  );

  /**
   * POST /api/campaigns/:id/submit
   * Soumission pour validation commerciale (RG4, RG15, CA2, CA3, CA4, CA10)
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/campaigns/:id/submit",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const campaign = campaignService.submitCampaign(
          request.params.id,
          session.account.id,
        );
        return reply.status(200).send({ campaign });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erreur soumission";
        return reply.status(400).send({ error: "Bad Request", message: msg });
      }
    },
  );

  /**
   * GET /api/campaigns/my
   * Liste des campagnes de la marque connectée
   */
  fastify.get("/api/campaigns/my", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    if (session.user.role !== "advertiser" && session.user.role !== "admin") {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Accès réservé aux annonceurs",
      });
    }

    const campaigns = campaignService.listCampaignsForBrand(session.account.id);
    return reply.status(200).send({ campaigns });
  });

  /**
   * GET /api/campaigns/my/:id
   * Détail d'une campagne de la marque connectée (avec prévisualisation RG102)
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/campaigns/my/:id",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const campaign = campaignService.getCampaignForBrand(
          request.params.id,
          session.account.id,
        );
        return reply.status(200).send({ campaign });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Non trouvé";
        return reply.status(404).send({ error: "Not Found", message: msg });
      }
    },
  );

  /**
   * POST /api/campaigns/:id/pause
   * Mise en pause (RG8, CA8)
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/campaigns/:id/pause",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const isAgent =
        session.user.role === "agent" || session.user.role === "admin";
      try {
        const campaign = campaignService.pauseCampaign(request.params.id, {
          brandAccountId: isAgent ? undefined : session.account.id,
          agentId: isAgent ? session.account.id : undefined,
        });
        return reply.status(200).send({ campaign });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erreur pause";
        return reply.status(400).send({ error: "Bad Request", message: msg });
      }
    },
  );

  /**
   * POST /api/campaigns/:id/resume
   * Reprise après pause (RG8)
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/campaigns/:id/resume",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const isAgent =
        session.user.role === "agent" || session.user.role === "admin";
      try {
        const campaign = campaignService.resumeCampaign(request.params.id, {
          brandAccountId: isAgent ? undefined : session.account.id,
          agentId: isAgent ? session.account.id : undefined,
        });
        return reply.status(200).send({ campaign });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erreur reprise";
        return reply.status(400).send({ error: "Bad Request", message: msg });
      }
    },
  );

  /**
   * POST /api/campaigns/:id/close
   * Clôture définitive et irréversible (RG9, CA9)
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/campaigns/:id/close",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const isAgent =
        session.user.role === "agent" || session.user.role === "admin";
      try {
        const campaign = campaignService.closeCampaign(request.params.id, {
          brandAccountId: isAgent ? undefined : session.account.id,
          agentId: isAgent ? session.account.id : undefined,
        });
        return reply.status(200).send({ campaign });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erreur clôture";
        return reply.status(400).send({ error: "Bad Request", message: msg });
      }
    },
  );

  /**
   * POST /api/campaigns/:id/duplicate
   * Duplication vers un nouveau brouillon (RG9, CA9)
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/campaigns/:id/duplicate",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const campaign = campaignService.duplicateCampaign(
          request.params.id,
          session.account.id,
        );
        return reply.status(201).send({ campaign });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erreur duplication";
        return reply.status(400).send({ error: "Bad Request", message: msg });
      }
    },
  );

  // ==========================================
  // Espace Créateur (Vue Publique Sécurisée & Fil)
  // ==========================================

  /**
   * GET /api/campaigns/feed
   * Fil des campagnes ouvertes pour les créateurs authentifiés (RG13 à RG36, C5)
   */
  fastify.get("/api/campaigns/feed", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    // RG13: Accessible à tout compte créateur authentifié, ou agent/admin en consultation
    const isCreator = session.user.role === "creator";
    const isAgent =
      session.user.role === "agent" || session.user.role === "admin";
    if (!isCreator && !isAgent) {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Action réservée aux créateurs connectés",
      });
    }

    const query = (request.query as Record<string, unknown>) || {};
    const parseArray = (val: unknown): string[] | undefined => {
      if (!val) return undefined;
      if (Array.isArray(val)) return val.map(String);
      if (typeof val === "string")
        return val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
      return undefined;
    };

    const parsedFilters: Record<string, unknown> = {
      topics: parseArray(query.topics),
      networks: parseArray(query.networks),
      formats: parseArray(query.formats),
      targetCountries: parseArray(query.targetCountries),
      compensationNatures: parseArray(query.compensationNatures),
      minCompensationMinor: query.minCompensationMinor
        ? Number.parseInt(String(query.minCompensationMinor), 10)
        : undefined,
      currency: query.currency || undefined,
      onlyEligible:
        query.onlyEligible === "true" || query.onlyEligible === true,
      sortBy: query.sortBy || "recent",
      page: query.page ? Number.parseInt(String(query.page), 10) : 1,
      limit: query.limit ? Number.parseInt(String(query.limit), 10) : 12,
    };

    const validation = CampaignFeedFiltersSchema.safeParse(parsedFilters);
    if (!validation.success) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Filtres invalides",
        issues: validation.error.issues,
      });
    }

    const creatorAccountId = session.account.id;
    const feedResponse = campaignService.getCampaignFeed(
      creatorAccountId,
      validation.data,
    );

    return reply.status(200).send(feedResponse);
  });

  /**
   * GET /api/campaigns/public/:id
   * Consultation sécurisée d'une campagne publiée par un créateur (RG60, RG65, RG98, RG100, CA38, CA41, CA64, CA66)
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/campaigns/public/:id",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const creatorAccountId =
          session.user.role === "creator" ? session.account.id : undefined;

        const campaign = campaignService.getCampaignForCreator(
          request.params.id,
          creatorAccountId,
        );

        // Journalisation de la consultation par le créateur (RG22)
        if (creatorAccountId) {
          campaignService.recordCampaignView(
            creatorAccountId,
            request.params.id,
          );
        }

        return reply.status(200).send({ campaign });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Campagne non trouvée";
        return reply.status(404).send({ error: "Not Found", message: msg });
      }
    },
  );

  // ==========================================
  // Espace Backoffice (Agents & Admins)
  // ==========================================

  /**
   * GET /api/backoffice/campaigns
   * File des campagnes pour validation et suivi commercial (RG87, RG96, 17b §3.8)
   */
  fastify.get<{
    Querystring: {
      status?: CampaignStatus | "all";
      sensitiveOnly?: string;
      brandAccountId?: string;
      search?: string;
      page?: string;
      limit?: string;
    };
  }>("/api/backoffice/campaigns", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    if (session.user.role !== "agent" && session.user.role !== "admin") {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Accès réservé aux agents INFLUX",
      });
    }

    const { status, sensitiveOnly, brandAccountId, search, page, limit } =
      request.query;

    const queueResponse = campaignService.getBackofficeQueue({
      status: status || "all",
      sensitiveOnly: sensitiveOnly === "true",
      brandAccountId,
      search,
      page: page ? Number.parseInt(page, 10) : 1,
      limit: limit ? Number.parseInt(limit, 10) : 20,
    });

    return reply.status(200).send(queueResponse);
  });

  /**
   * GET /api/backoffice/campaigns/:id
   * Fiche détaillée backoffice (RG83, RG85)
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/backoffice/campaigns/:id",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      if (session.user.role !== "agent" && session.user.role !== "admin") {
        return reply.status(403).send({
          error: "Forbidden",
          message: "Accès réservé aux agents INFLUX",
        });
      }

      try {
        const campaign = campaignService.getCampaignForBackoffice(
          request.params.id,
          session.account.id,
        );
        return reply.status(200).send({ campaign });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Non trouvé";
        return reply.status(404).send({ error: "Not Found", message: msg });
      }
    },
  );

  /**
   * POST /api/backoffice/campaigns/:id/claim
   * Prise en charge avec verrou 30 minutes (RG88, CA58)
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/backoffice/campaigns/:id/claim",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      if (session.user.role !== "agent" && session.user.role !== "admin") {
        return reply.status(403).send({
          error: "Forbidden",
          message: "Accès réservé aux agents INFLUX",
        });
      }

      try {
        const campaign = campaignService.claimCampaign(
          request.params.id,
          session.account.id,
        );
        return reply.status(200).send({ campaign });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erreur verrou";
        return reply.status(409).send({ error: "Conflict", message: msg });
      }
    },
  );

  /**
   * POST /api/backoffice/campaigns/:id/release-claim
   * Libération du verrou d'agent
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/backoffice/campaigns/:id/release-claim",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      if (session.user.role !== "agent" && session.user.role !== "admin") {
        return reply.status(403).send({
          error: "Forbidden",
          message: "Accès réservé aux agents INFLUX",
        });
      }

      try {
        const campaign = campaignService.releaseClaim(
          request.params.id,
          session.account.id,
        );
        return reply.status(200).send({ campaign });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erreur libération";
        return reply.status(400).send({ error: "Bad Request", message: msg });
      }
    },
  );

  /**
   * POST /api/backoffice/campaigns/:id/publish
   * Décision de publication (RG5, RG85, CA5, CA56, CA57)
   */
  fastify.post<{
    Params: { id: string };
    Body: { secondAgentId?: string };
  }>("/api/backoffice/campaigns/:id/publish", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    if (session.user.role !== "agent" && session.user.role !== "admin") {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Accès réservé aux agents INFLUX",
      });
    }

    try {
      const campaign = campaignService.publishCampaign(
        request.params.id,
        session.account.id,
        {
          secondAgentId: request.body?.secondAgentId,
          isAdmin: session.user.role === "admin",
        },
      );
      return reply.status(200).send({ campaign });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur publication";
      return reply.status(400).send({ error: "Bad Request", message: msg });
    }
  });

  /**
   * POST /api/backoffice/campaigns/:id/reject
   * Refus motivé avec motif typé fermé (RG10, RG89, RG90, CA59)
   */
  fastify.post<{
    Params: { id: string };
    Body: { reason: string; comment?: string };
  }>("/api/backoffice/campaigns/:id/reject", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    if (session.user.role !== "agent" && session.user.role !== "admin") {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Accès réservé aux agents INFLUX",
      });
    }

    const reasonParse = CampaignRejectionReasonSchema.safeParse(
      request.body?.reason,
    );
    if (!reasonParse.success) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Motif de refus invalide ou non répertorié (RG90)",
      });
    }

    try {
      const campaign = campaignService.rejectCampaign(
        request.params.id,
        session.account.id,
        reasonParse.data,
        request.body?.comment,
      );
      return reply.status(200).send({ campaign });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur refus";
      return reply.status(400).send({ error: "Bad Request", message: msg });
    }
  });

  /**
   * POST /api/backoffice/campaigns/:id/moderate
   * Décision de modération unifiée (publier ou refuser) (RG89, RG90, 17b §3.8)
   */
  fastify.post<{
    Params: { id: string };
    Body: {
      decision: "publish" | "reject";
      reason?: string;
      comment?: string;
      secondAgentId?: string;
      responsibleAgentId?: string;
    };
  }>("/api/backoffice/campaigns/:id/moderate", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    if (session.user.role !== "agent" && session.user.role !== "admin") {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Accès réservé aux agents INFLUX",
      });
    }

    const { decision, reason, comment, secondAgentId, responsibleAgentId } =
      request.body || {};

    if (decision !== "publish" && decision !== "reject") {
      return reply.status(400).send({
        error: "Bad Request",
        message: "La décision doit être 'publish' ou 'reject' (RG89)",
      });
    }

    try {
      if (decision === "publish") {
        if (responsibleAgentId) {
          try {
            campaignService.updateCampaign(
              request.params.id,
              session.account.id,
              {},
              session.account.id,
            );
          } catch {
            // Pas bloquant
          }
        }
        const campaign = campaignService.publishCampaign(
          request.params.id,
          session.account.id,
          {
            secondAgentId,
            isAdmin: session.user.role === "admin",
          },
        );
        return reply.status(200).send({ campaign });
      } else {
        const reasonParse = CampaignRejectionReasonSchema.safeParse(reason);
        if (!reasonParse.success) {
          return reply.status(400).send({
            error: "Bad Request",
            message: "Motif de refus typé obligatoire et fermé (RG90)",
          });
        }
        const campaign = campaignService.rejectCampaign(
          request.params.id,
          session.account.id,
          reasonParse.data,
          comment,
        );
        return reply.status(200).send({ campaign });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur modération";
      return reply.status(400).send({ error: "Bad Request", message: msg });
    }
  });
};

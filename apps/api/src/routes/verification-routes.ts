import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import {
  SESSION_COOKIE_NAME,
  CreateVerificationRequestSchema,
  DecideVerificationRequestSchema,
  RevokeBadgeSchema,
  type VerificationLevel,
  type VerificationStatus,
  calculateAudienceBand,
} from "@influx/contracts";
import { authService, AuthService } from "../services/auth-service";
import { VerificationService } from "../services/verification-service";

export const verificationServiceInstance = new VerificationService();

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

export const verificationRoutes: FastifyPluginAsync<{
  verificationService?: VerificationService;
  authServiceInstance?: AuthService;
}> = async (fastify: FastifyInstance, opts) => {
  const service = opts.verificationService || verificationServiceInstance;
  const auth = opts.authServiceInstance || authService;

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

  // ==========================================================================
  // PARCOURS CRÉATEUR
  // ==========================================================================

  /**
   * POST /api/verification/request
   * Soumission d'une demande de vérification (Compte ou Audience)
   */
  fastify.post("/api/verification/request", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    if (session.user.role !== "creator" && session.user.role !== "admin") {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Accès réservé aux créateurs",
      });
    }

    try {
      const parsedBody = CreateVerificationRequestSchema.parse(request.body);
      const result = await service.requestVerification(
        session.account,
        parsedBody,
      );
      return reply.status(201).send(result);
    } catch (err: any) {
      return reply.status(400).send({
        error: "Bad Request",
        message: err.message || "Erreur de validation de la demande",
      });
    }
  });

  /**
   * GET /api/verification/my-requests
   * Liste des demandes de vérification du créateur connecté
   */
  fastify.get("/api/verification/my-requests", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    if (session.user.role !== "creator" && session.user.role !== "admin") {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Accès réservé aux créateurs",
      });
    }

    const requests = service.getCreatorRequests(session.account);
    return reply.status(200).send({ requests });
  });

  /**
   * GET /api/verification/my-badges
   * Liste des badges du créateur connecté
   */
  fastify.get("/api/verification/my-badges", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    if (session.user.role !== "creator" && session.user.role !== "admin") {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Accès réservé aux créateurs",
      });
    }

    const badges = service.getBadgesForAccount(session.account.id);
    return reply.status(200).send({ badges });
  });

  // ==========================================================================
  // CONSULTATION PUBLIQUE / ANNONCEURS (ANONYMISATION STRICTE - RG89, RG90)
  // ==========================================================================

  /**
   * GET /api/creators/:id/badges
   * Lecture des badges actifs pour un créateur (Anonymisé : pas de chiffres exacts, tranches seulement)
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/creators/:id/badges",
    async (request, reply) => {
      const { id } = request.params;
      const allBadges = service.getBadgesForAccount(id);

      // RG70, RG76 : Seuls les badges actifs ou à rafraîchir sont visibles
      // Les badges révoqués ou expirés ne sont JAMAIS montrés à un tiers
      const publicBadges = allBadges
        .filter((b) => b.state === "active" || b.state === "to_refresh")
        .map((b) => ({
          id: b.id,
          network: b.network,
          level: b.level,
          grantedAt: b.grantedAt,
          evidenceSource: b.evidenceSource,
          expiresAt: b.expiresAt,
          state: b.state,
          observedPeriodStart: b.observedPeriodStart,
          observedPeriodEnd: b.observedPeriodEnd,
          // RG20, RG89 : Jamais le chiffre exact, tranche d'audience uniquement
          audienceBand:
            b.observedFollowers !== undefined
              ? calculateAudienceBand(b.observedFollowers)
              : undefined,
          // RG90 : Jamais le handle @ avant révélation d'identité
        }));

      return reply.status(200).send({ badges: publicBadges });
    },
  );

  // ==========================================================================
  // PARCOURS BACKOFFICE / AGENTS INFLUX (RG43, RG47, RG51, RG73)
  // ==========================================================================

  /**
   * GET /api/backoffice/queues/verification
   * File des demandes de vérification pour les agents
   */
  fastify.get<{
    Querystring: {
      status?: VerificationStatus;
      network?: string;
      requestedLevel?: VerificationLevel;
      population?: "creators" | "brands";
      page?: number;
      limit?: number;
    };
  }>("/api/backoffice/queues/verification", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    if (session.user.role !== "agent" && session.user.role !== "admin") {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Accès réservé aux agents et administrateurs",
      });
    }

    const queueResponse = service.getVerificationQueue(
      session.account,
      request.query,
    );
    return reply.status(200).send(queueResponse);
  });

  /**
   * POST /api/backoffice/verification/:id/claim
   * Prise en charge d'une demande avec verrou nominatif (RG43, RG64)
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/backoffice/verification/:id/claim",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      if (session.user.role !== "agent" && session.user.role !== "admin") {
        return reply.status(403).send({
          error: "Forbidden",
          message: "Accès réservé aux agents et administrateurs",
        });
      }

      try {
        const updated = service.claimVerificationRequest(
          session.account,
          request.params.id,
        );
        return reply.status(200).send({ request: updated });
      } catch (err: any) {
        return reply.status(400).send({
          error: "Bad Request",
          message: err.message,
        });
      }
    },
  );

  /**
   * POST /api/backoffice/verification/:id/decide
   * Décision de l'agent sur la demande (RG47, RG49, RG50, RG51, RG56)
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/backoffice/verification/:id/decide",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      if (session.user.role !== "agent" && session.user.role !== "admin") {
        return reply.status(403).send({
          error: "Forbidden",
          message: "Accès réservé aux agents et administrateurs",
        });
      }

      try {
        const parsedBody = DecideVerificationRequestSchema.parse(request.body);
        const result = service.decideVerificationRequest(
          session.account,
          request.params.id,
          parsedBody,
        );
        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(400).send({
          error: "Bad Request",
          message: err.message,
        });
      }
    },
  );

  /**
   * POST /api/backoffice/badges/:id/revoke
   * Retrait immédiat d'un badge avec motif typé (RG73, RG75)
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/backoffice/badges/:id/revoke",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      if (session.user.role !== "agent" && session.user.role !== "admin") {
        return reply.status(403).send({
          error: "Forbidden",
          message: "Accès réservé aux agents et administrateurs",
        });
      }

      try {
        const parsedBody = RevokeBadgeSchema.parse(request.body);
        const badge = service.revokeBadge(
          session.account,
          request.params.id,
          parsedBody,
        );
        return reply.status(200).send({ badge });
      } catch (err: any) {
        return reply.status(400).send({
          error: "Bad Request",
          message: err.message,
        });
      }
    },
  );

  /**
   * POST /api/backoffice/verification/maintenance/refresh-lifecycle
   * Déclenchement de la maintenance du cycle de vie des badges (RG70)
   */
  fastify.post<{ Body: { nowIso?: string } }>(
    "/api/backoffice/verification/maintenance/refresh-lifecycle",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      if (session.user.role !== "agent" && session.user.role !== "admin") {
        return reply.status(403).send({
          error: "Forbidden",
          message: "Accès réservé aux agents et administrateurs",
        });
      }

      const body = (request.body as { nowIso?: string }) || {};
      const stats = service.refreshBadgeLifecycle(body.nowIso);
      return reply.status(200).send(stats);
    },
  );
};

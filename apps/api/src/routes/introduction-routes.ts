import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import {
  SESSION_COOKIE_NAME,
  BrandContactRequestSchema,
  CreatorApplyRequestSchema,
  InfluxProposalRequestSchema,
  IntroductionDecisionSchema,
} from "@influx/contracts";
import { authService, AuthService } from "../services/auth-service";
import {
  IntroductionService,
  type IntroductionServiceError,
} from "../services/introduction-service";
import { RevealService } from "../services/reveal-service";
import { MockStore } from "../mocks/mock-store";

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

export const introductionRoutes: FastifyPluginAsync<{
  introductionService?: IntroductionService;
  revealService?: RevealService;
  authServiceInstance?: AuthService;
  store?: MockStore;
}> = async (fastify: FastifyInstance, opts) => {
  const store = opts.store || MockStore.getInstance();
  const introService =
    opts.introductionService || new IntroductionService(store);
  const revealService = opts.revealService || new RevealService(store);
  const auth = opts.authServiceInstance || authService;

  // Helper d'authentification
  async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
    const token = extractSessionToken(request);
    if (!token) {
      reply.status(401).send({
        error: "Unauthorized",
        message: "Session requise pour cette action",
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
  // DÉCLENCHEUR 1 : Demande de contact Marque (sur profil créateur anonymisé)
  // ==========================================================================
  fastify.post("/api/introductions/brand-request", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const parseResult = BrandContactRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "BadRequest",
        message: "Données de demande de contact invalides",
        details: parseResult.error.issues,
      });
    }

    try {
      const introduction = await introService.createBrandContactRequest(
        session.account,
        parseResult.data,
      );
      return reply.status(201).send({
        ok: true,
        introduction,
      });
    } catch (err: unknown) {
      const serviceErr = err as IntroductionServiceError;
      if (serviceErr.status) {
        return reply.status(serviceErr.status).send({
          error: serviceErr.code,
          message: serviceErr.message,
        });
      }
      return reply.status(500).send({
        error: "InternalServerError",
        message: (err as Error).message || "Erreur interne",
      });
    }
  });

  // ==========================================================================
  // DÉCLENCHEUR 2 : Candidature Créateur (sur campagne publiée)
  // ==========================================================================
  fastify.post("/api/introductions/creator-apply", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const parseResult = CreatorApplyRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "BadRequest",
        message: "Données de candidature invalides",
        details: parseResult.error.issues,
      });
    }

    try {
      const introduction = await introService.createCreatorApplication(
        session.account,
        parseResult.data,
      );
      return reply.status(201).send({
        ok: true,
        introduction,
      });
    } catch (err: unknown) {
      const serviceErr = err as IntroductionServiceError;
      if (serviceErr.status) {
        return reply.status(serviceErr.status).send({
          error: serviceErr.code,
          message: serviceErr.message,
        });
      }
      return reply.status(500).send({
        error: "InternalServerError",
        message: (err as Error).message || "Erreur interne",
      });
    }
  });

  // ==========================================================================
  // DÉCLENCHEUR 3 : Proposition commerciale INFLUX (court-circuite la file)
  // ==========================================================================
  fastify.post(
    "/api/backoffice/introductions/propose",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const parseResult = InfluxProposalRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: "BadRequest",
          message: "Données de proposition INFLUX invalides",
          details: parseResult.error.issues,
        });
      }

      try {
        const introductions = await introService.createInfluxProposal(
          session.account,
          parseResult.data,
        );
        return reply.status(201).send({
          ok: true,
          count: introductions.length,
          introductions,
        });
      } catch (err: unknown) {
        const serviceErr = err as IntroductionServiceError;
        if (serviceErr.status) {
          return reply.status(serviceErr.status).send({
            error: serviceErr.code,
            message: serviceErr.message,
          });
        }
        return reply.status(500).send({
          error: "InternalServerError",
          message: (err as Error).message || "Erreur interne",
        });
      }
    },
  );

  // ==========================================================================
  // Consultation : Mes mises en relation
  // ==========================================================================
  fastify.get("/api/introductions/my", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    try {
      const list = await introService.getMyIntroductions(session.account);
      return reply.status(200).send({
        ok: true,
        count: list.length,
        introductions: list,
      });
    } catch (err: unknown) {
      return reply.status(500).send({
        error: "InternalServerError",
        message: (err as Error).message || "Erreur interne",
      });
    }
  });

  // ==========================================================================
  // Consultation d'une mise en relation par son identifiant
  // ==========================================================================
  fastify.get<{ Params: { id: string } }>(
    "/api/introductions/:id",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const introduction = await introService.getIntroductionById(
          request.params.id,
          session.account,
        );
        if (!introduction) {
          return reply.status(404).send({
            error: "NotFound",
            message: "Mise en relation introuvable",
          });
        }
        return reply.status(200).send({
          ok: true,
          introduction,
        });
      } catch (err: unknown) {
        const serviceErr = err as IntroductionServiceError;
        if (serviceErr.status) {
          return reply.status(serviceErr.status).send({
            error: serviceErr.code,
            message: serviceErr.message,
          });
        }
        return reply.status(500).send({
          error: "InternalServerError",
          message: (err as Error).message || "Erreur interne",
        });
      }
    },
  );

  // ==========================================================================
  // Backoffice : File de validation commerciale
  // ==========================================================================
  fastify.get(
    "/api/backoffice/queues/introductions",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      if (session.user.role !== "agent" && session.user.role !== "admin") {
        return reply.status(403).send({
          error: "Forbidden",
          message: "Accès réservé aux agents et administrateurs INFLUX",
        });
      }

      try {
        const queue = await introService.getValidationQueue();
        return reply.status(200).send({
          ok: true,
          count: queue.length,
          items: queue,
        });
      } catch (err: unknown) {
        return reply.status(500).send({
          error: "InternalServerError",
          message: (err as Error).message || "Erreur interne",
        });
      }
    },
  );

  // ==========================================================================
  // Backoffice : Prise en charge avec verrou d'agent (POST /claim)
  // ==========================================================================
  fastify.post<{ Params: { id: string } }>(
    "/api/backoffice/introductions/:id/claim",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const introduction = await introService.claimIntroduction(
          request.params.id,
          session.account,
        );
        return reply.status(200).send({
          ok: true,
          introduction,
        });
      } catch (err: unknown) {
        const serviceErr = err as IntroductionServiceError;
        if (serviceErr.status) {
          return reply.status(serviceErr.status).send({
            error: serviceErr.code,
            message: serviceErr.message,
          });
        }
        return reply.status(500).send({
          error: "InternalServerError",
          message: (err as Error).message || "Erreur interne",
        });
      }
    },
  );

  // ==========================================================================
  // Backoffice : Libération du verrou (POST /release)
  // ==========================================================================
  fastify.post<{ Params: { id: string } }>(
    "/api/backoffice/introductions/:id/release",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const introduction = await introService.releaseIntroduction(
          request.params.id,
          session.account,
        );
        return reply.status(200).send({
          ok: true,
          introduction,
        });
      } catch (err: unknown) {
        const serviceErr = err as IntroductionServiceError;
        if (serviceErr.status) {
          return reply.status(serviceErr.status).send({
            error: serviceErr.code,
            message: serviceErr.message,
          });
        }
        return reply.status(500).send({
          error: "InternalServerError",
          message: (err as Error).message || "Erreur interne",
        });
      }
    },
  );

  // ==========================================================================
  // Backoffice : Décision commerciale (POST /decide) : Approve ou Reject
  // ==========================================================================
  fastify.post<{ Params: { id: string } }>(
    "/api/backoffice/introductions/:id/decide",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const parseResult = IntroductionDecisionSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: "BadRequest",
          message: "Données de décision commerciale invalides",
          details: parseResult.error.issues,
        });
      }

      try {
        const introduction = await introService.decideIntroduction(
          request.params.id,
          session.account,
          parseResult.data,
        );
        return reply.status(200).send({
          ok: true,
          introduction,
        });
      } catch (err: unknown) {
        const serviceErr = err as IntroductionServiceError;
        if (serviceErr.status) {
          return reply.status(serviceErr.status).send({
            error: serviceErr.code,
            message: serviceErr.message,
          });
        }
        return reply.status(500).send({
          error: "InternalServerError",
          message: (err as Error).message || "Erreur interne",
        });
      }
    },
  );

  // ==========================================================================
  // Acceptation d'une mise en relation (Marque ou Créateur)
  // Déclenche atomiquement la révélation d'identité si les deux parties ont accepté
  // et que la mise en relation est approuvée (Mission 4.3 / RG-M2 / D37)
  // ==========================================================================
  fastify.post<{ Params: { id: string } }>(
    "/api/introductions/:id/accept",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const result = await revealService.acceptIntroduction(
          request.params.id,
          session.account,
        );
        return reply.status(200).send({
          ok: true,
          ...result,
        });
      } catch (err: unknown) {
        const serviceErr = err as {
          status?: number;
          code?: string;
          message?: string;
        };
        if (serviceErr.status) {
          return reply.status(serviceErr.status).send({
            error: serviceErr.code,
            message: serviceErr.message,
          });
        }
        return reply.status(500).send({
          error: "InternalServerError",
          message: (err as Error).message || "Erreur interne",
        });
      }
    },
  );

  // ==========================================================================
  // Refus / Déclinaison d'une mise en relation par une partie (Mission 4.3)
  // ==========================================================================
  fastify.post<{ Params: { id: string } }>(
    "/api/introductions/:id/decline",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const introduction = await revealService.declineIntroduction(
          request.params.id,
          session.account,
        );
        return reply.status(200).send({
          ok: true,
          introduction,
        });
      } catch (err: unknown) {
        const serviceErr = err as {
          status?: number;
          code?: string;
          message?: string;
        };
        if (serviceErr.status) {
          return reply.status(serviceErr.status).send({
            error: serviceErr.code,
            message: serviceErr.message,
          });
        }
        return reply.status(500).send({
          error: "InternalServerError",
          message: (err as Error).message || "Erreur interne",
        });
      }
    },
  );

  // ==========================================================================
  // Transaction atomique de révélation directe (Agent / Admin)
  // ==========================================================================
  fastify.post<{ Params: { id: string } }>(
    "/api/introductions/:id/reveal",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      if (
        session.account.role !== "agent" &&
        session.account.role !== "admin"
      ) {
        return reply.status(403).send({
          error: "Forbidden",
          message: "Accès réservé aux agents et administrateurs INFLUX",
        });
      }

      try {
        const result = await revealService.revealIdentity(request.params.id);
        return reply.status(200).send({
          ok: true,
          ...result,
        });
      } catch (err: unknown) {
        const serviceErr = err as {
          status?: number;
          code?: string;
          message?: string;
        };
        if (serviceErr.status) {
          return reply.status(serviceErr.status).send({
            error: serviceErr.code,
            message: serviceErr.message,
          });
        }
        return reply.status(500).send({
          error: "InternalServerError",
          message: (err as Error).message || "Erreur interne",
        });
      }
    },
  );
};

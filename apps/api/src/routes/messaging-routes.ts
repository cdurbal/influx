import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import {
  SESSION_COOKIE_NAME,
  SendMessageRequestSchema,
  CheckMessageRequestSchema,
  AccessConversationQuerySchema,
} from "@influx/contracts";
import { authService, AuthService } from "../services/auth-service";
import {
  MessagingService,
  type MessagingServiceError,
} from "../services/messaging-service";
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

export const messagingRoutes: FastifyPluginAsync<{
  messagingService?: MessagingService;
  authServiceInstance?: AuthService;
  store?: MockStore;
}> = async (fastify: FastifyInstance, opts) => {
  const store = opts.store || MockStore.getInstance();
  const messagingService = opts.messagingService || new MessagingService(store);
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
  // Consultation des conversations de l'utilisateur connecté (RG34)
  // ==========================================================================
  fastify.get("/api/conversations/my", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    try {
      const conversations = await messagingService.getMyConversations(
        session.account,
      );
      return reply.status(200).send({
        ok: true,
        count: conversations.length,
        conversations,
      });
    } catch (err: unknown) {
      return reply.status(500).send({
        error: "InternalServerError",
        message: (err as Error).message || "Erreur interne",
      });
    }
  });

  // ==========================================================================
  // Consultation des métadonnées d'une conversation (RG55 à RG58)
  // ==========================================================================
  fastify.get<{ Params: { id: string } }>(
    "/api/conversations/:id",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const accessQuery = AccessConversationQuerySchema.parse(
        request.query || {},
      );

      try {
        const conversation = await messagingService.getConversation(
          request.params.id,
          session.account,
          accessQuery,
        );
        return reply.status(200).send({
          ok: true,
          conversation,
        });
      } catch (err: unknown) {
        const serviceErr = err as MessagingServiceError;
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
  // Consultation des messages & actualisation du curseur de lecture (RG51, RG52, RG55 à RG58)
  // ==========================================================================
  fastify.get<{ Params: { id: string } }>(
    "/api/conversations/:id/messages",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const accessQuery = AccessConversationQuerySchema.parse(
        request.query || {},
      );

      try {
        const { conversation, messages, accessLog } =
          await messagingService.getMessages(
            request.params.id,
            session.account,
            accessQuery,
          );
        return reply.status(200).send({
          ok: true,
          count: messages.length,
          messages,
          conversation,
          accessLog,
        });
      } catch (err: unknown) {
        const serviceErr = err as MessagingServiceError;
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
  // Pré-contrôle non bloquant avant envoi (RG42, RG43, RG44)
  // ==========================================================================
  fastify.post<{ Params: { id: string } }>(
    "/api/conversations/:id/messages/check",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const parseResult = CheckMessageRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: "BadRequest",
          message: "Données de vérification invalides",
          details: parseResult.error.issues,
        });
      }

      const checkResponse = messagingService.checkMessage(
        parseResult.data.content,
      );
      return reply.status(200).send({
        ok: true,
        ...checkResponse,
      });
    },
  );

  // ==========================================================================
  // Envoi d'un message texte dans le fil à trois (RG35 à RG50)
  // ==========================================================================
  fastify.post<{ Params: { id: string } }>(
    "/api/conversations/:id/messages",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      const parseResult = SendMessageRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: "BadRequest",
          message: "Données de message invalides",
          details: parseResult.error.issues,
        });
      }

      try {
        const result = await messagingService.sendMessage(
          request.params.id,
          session.account,
          parseResult.data,
        );
        return reply.status(201).send({
          ok: true,
          ...result,
        });
      } catch (err: unknown) {
        const serviceErr = err as MessagingServiceError;
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
  // Backoffice : Consultation des détections de coordonnées (RG50)
  // ==========================================================================
  fastify.get<{ Params: { id: string } }>(
    "/api/backoffice/conversations/:id/detections",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const detections = await messagingService.getDetections(
          request.params.id,
          session.account,
        );
        return reply.status(200).send({
          ok: true,
          count: detections.length,
          detections,
        });
      } catch (err: unknown) {
        const serviceErr = err as MessagingServiceError;
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
  // Backoffice : Registre des lectures de conversations par les agents (RG59)
  // ==========================================================================
  fastify.get<{
    Querystring: { conversationId?: string; agentId?: string };
  }>("/api/backoffice/conversations/access-logs", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    try {
      const logs = await messagingService.getAccessLogs(
        session.account,
        request.query,
      );
      return reply.status(200).send({
        ok: true,
        count: logs.length,
        logs,
      });
    } catch (err: unknown) {
      const serviceErr = err as MessagingServiceError;
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

  fastify.get<{
    Params: { id: string };
  }>(
    "/api/backoffice/conversations/:id/access-logs",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const logs = await messagingService.getAccessLogs(session.account, {
          conversationId: request.params.id,
        });
        return reply.status(200).send({
          ok: true,
          count: logs.length,
          logs,
        });
      } catch (err: unknown) {
        const serviceErr = err as MessagingServiceError;
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

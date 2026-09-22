import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import {
  SESSION_COOKIE_NAME,
  UpdateDealSchema,
  CreateCommissionReceiptSchema,
  DealFilterSchema,
} from "@influx/contracts";
import { authService, AuthService } from "../services/auth-service";
import { DealService } from "../services/deal-service";
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

export const dealRoutes: FastifyPluginAsync<{
  dealService?: DealService;
  authServiceInstance?: AuthService;
  store?: MockStore;
}> = async (fastify: FastifyInstance, opts) => {
  const store = opts.store || MockStore.getInstance();
  const dealService = opts.dealService || new DealService(store);
  const auth = opts.authServiceInstance || authService;

  // Middleware d'authentification réservé au Backoffice (agent ou admin)
  async function requireAgentAuth(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
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

    const role = session.account?.role || (session as any).user?.role;
    if (role !== "agent" && role !== "admin") {
      reply.status(403).send({
        error: "Forbidden",
        message: "Accès réservé aux agents et administrateurs INFLUX",
      });
      return null;
    }

    return session;
  }

  // ==========================================================================
  // 1. Liste des affaires dans le pipeline commercial
  // ==========================================================================
  fastify.get("/api/backoffice/deals", async (request, reply) => {
    const session = await requireAgentAuth(request, reply);
    if (!session) return;

    const parsedQuery = DealFilterSchema.safeParse(request.query);
    const filters = parsedQuery.success ? parsedQuery.data : undefined;

    const deals = await dealService.listDeals(filters);
    return reply.status(200).send({
      deals,
      total: deals.length,
    });
  });

  // ==========================================================================
  // 2. Détail d'une affaire avec encaissements
  // ==========================================================================
  fastify.get<{ Params: { id: string } }>(
    "/api/backoffice/deals/:id",
    async (request, reply) => {
      const session = await requireAgentAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      try {
        const result = await dealService.getDealById(id);
        return reply.status(200).send(result);
      } catch (err: any) {
        return reply.status(404).send({
          error: "NotFound",
          message: err.message || "Affaire introuvable",
        });
      }
    },
  );

  // ==========================================================================
  // 3. Mise à jour d'une affaire (montants saisis, statuts, mode d'envoi)
  // ==========================================================================
  fastify.patch<{ Params: { id: string } }>(
    "/api/backoffice/deals/:id",
    async (request, reply) => {
      const session = await requireAgentAuth(request, reply);
      if (!session) return;

      const parseResult = UpdateDealSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: "BadRequest",
          message: "Données de mise à jour d'affaire invalides",
          details: parseResult.error.issues,
        });
      }

      const { id } = request.params;
      const agentId = session.account?.id || (session as any).user?.id;

      try {
        const updated = await dealService.updateDeal(
          id,
          parseResult.data,
          agentId,
        );
        return reply.status(200).send({ deal: updated });
      } catch (err: any) {
        return reply.status(400).send({
          error: "BadRequest",
          message: err.message || "Erreur lors de la mise à jour de l'affaire",
        });
      }
    },
  );

  // ==========================================================================
  // 4. Enregistrement d'un encaissement (billing.commission_receipts - E1)
  // ==========================================================================
  fastify.post<{ Params: { id: string } }>(
    "/api/backoffice/deals/:id/receipts",
    async (request, reply) => {
      const session = await requireAgentAuth(request, reply);
      if (!session) return;

      const parseResult = CreateCommissionReceiptSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: "BadRequest",
          message: "Données d'encaissement invalides",
          details: parseResult.error.issues,
        });
      }

      const { id } = request.params;
      const agentId = session.account?.id || (session as any).user?.id;

      try {
        const receipt = await dealService.addReceipt(
          id,
          parseResult.data,
          agentId,
        );
        const dealDetails = await dealService.getDealById(id);
        return reply.status(201).send({
          receipt,
          deal: dealDetails.deal,
          totalReceivedMinor: dealDetails.totalReceivedMinor,
          remainingDueMinor: dealDetails.remainingDueMinor,
        });
      } catch (err: any) {
        return reply.status(400).send({
          error: "BadRequest",
          message:
            err.message || "Erreur lors de l'enregistrement de l'encaissement",
        });
      }
    },
  );

  // ==========================================================================
  // 5. Liste des encaissements d'une affaire
  // ==========================================================================
  fastify.get<{ Params: { id: string } }>(
    "/api/backoffice/deals/:id/receipts",
    async (request, reply) => {
      const session = await requireAgentAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      try {
        const receipts = dealService.getDealReceipts(id);
        return reply.status(200).send({
          receipts,
          total: receipts.length,
        });
      } catch (err: any) {
        return reply.status(400).send({
          error: "BadRequest",
          message: err.message,
        });
      }
    },
  );
};

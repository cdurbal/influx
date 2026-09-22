import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import { SESSION_COOKIE_NAME } from "@influx/contracts";
import { authService, AuthService } from "../services/auth-service";
import { DashboardService } from "../services/dashboard-service";
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

export const dashboardRoutes: FastifyPluginAsync<{
  dashboardService?: DashboardService;
  authServiceInstance?: AuthService;
  store?: MockStore;
}> = async (fastify: FastifyInstance, opts) => {
  const store = opts.store || MockStore.getInstance();
  const dashboardService = opts.dashboardService || new DashboardService(store);
  const auth = opts.authServiceInstance || authService;

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
  // KPIs globaux et alertes SLA du backoffice (15 §Tableau de bord, RG18)
  // ==========================================================================
  fastify.get("/api/backoffice/dashboard/kpis", async (request, reply) => {
    const session = await requireAgentAuth(request, reply);
    if (!session) return;

    try {
      const kpis = await dashboardService.getKpis();
      return reply.status(200).send(kpis);
    } catch (err: any) {
      return reply.status(500).send({
        error: "InternalServerError",
        message: err.message || "Erreur lors du calcul des KPIs",
      });
    }
  });
};

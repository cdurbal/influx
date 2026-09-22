import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import {
  SESSION_COOKIE_NAME,
  EstimateAudienceSchema,
  SendBrevoCampaignSchema,
  z,
} from "@influx/contracts";
import { authService, AuthService } from "../services/auth-service";
import { BrevoCampaignService } from "../services/brevo-campaign-service";
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

export const brevoCampaignRoutes: FastifyPluginAsync<{
  campaignService?: BrevoCampaignService;
  authServiceInstance?: AuthService;
  store?: MockStore;
}> = async (fastify: FastifyInstance, opts) => {
  const store = opts.store || MockStore.getInstance();
  const campaignService =
    opts.campaignService || new BrevoCampaignService(store);
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
  // 1. Catalogue des templates validés
  // ==========================================================================
  fastify.get("/api/backoffice/emails/templates", async (request, reply) => {
    const session = await requireAgentAuth(request, reply);
    if (!session) return;

    const templates = campaignService.getTemplates();
    return reply.status(200).send({ templates });
  });

  // ==========================================================================
  // 2. Estimation d'audience
  // ==========================================================================
  fastify.post("/api/backoffice/emails/estimate", async (request, reply) => {
    const session = await requireAgentAuth(request, reply);
    if (!session) return;

    const parseResult = EstimateAudienceSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "BadRequest",
        message: "Critères d'estimation invalides",
        details: parseResult.error.issues,
      });
    }

    const estimation = campaignService.estimateAudience(parseResult.data);
    return reply.status(200).send(estimation);
  });

  // ==========================================================================
  // 3. Prévisualisation d'un modèle bilingue
  // ==========================================================================
  const PreviewQuerySchema = z.object({
    templateId: z.string(),
    lang: z.enum(["fr", "en"]).default("fr"),
  });

  fastify.post("/api/backoffice/emails/preview", async (request, reply) => {
    const session = await requireAgentAuth(request, reply);
    if (!session) return;

    const parseResult = PreviewQuerySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "BadRequest",
        message: "Paramètres de prévisualisation invalides",
      });
    }

    try {
      const preview = campaignService.previewTemplate(
        parseResult.data.templateId,
        parseResult.data.lang,
      );
      return reply.status(200).send(preview);
    } catch (err: any) {
      return reply.status(404).send({
        error: "NotFound",
        message: err.message,
      });
    }
  });

  // ==========================================================================
  // 4. Déclenchement d'un envoi simulé avec délai de grâce
  // ==========================================================================
  fastify.post("/api/backoffice/emails/send", async (request, reply) => {
    const session = await requireAgentAuth(request, reply);
    if (!session) return;

    const parseResult = SendBrevoCampaignSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "BadRequest",
        message: "Données d'envoi invalides",
        details: parseResult.error.issues,
      });
    }

    const agentId = session.account?.id || (session as any).user?.id;
    try {
      const campaign = await campaignService.sendCampaign(
        parseResult.data,
        agentId,
      );
      return reply.status(201).send({ campaign });
    } catch (err: any) {
      return reply.status(400).send({
        error: "BadRequest",
        message: err.message,
      });
    }
  });

  // ==========================================================================
  // 5. Annulation d'un envoi pendant les 15 minutes de grâce
  // ==========================================================================
  fastify.post<{ Params: { id: string } }>(
    "/api/backoffice/emails/:id/cancel",
    async (request, reply) => {
      const session = await requireAgentAuth(request, reply);
      if (!session) return;

      const { id } = request.params;
      const agentId = session.account?.id || (session as any).user?.id;

      try {
        const campaign = await campaignService.cancelCampaign(id, agentId);
        return reply.status(200).send({ campaign });
      } catch (err: any) {
        return reply.status(400).send({
          error: "BadRequest",
          message: err.message,
        });
      }
    },
  );

  // ==========================================================================
  // 6. Historique des campagnes
  // ==========================================================================
  fastify.get("/api/backoffice/emails/campaigns", async (request, reply) => {
    const session = await requireAgentAuth(request, reply);
    if (!session) return;

    const campaigns = await campaignService.listCampaigns();
    return reply.status(200).send({ campaigns, total: campaigns.length });
  });
};

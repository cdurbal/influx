import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import {
  SESSION_COOKIE_NAME,
  CreatorSearchRequestSchema,
  TeamSelectionRequestSchema,
  type Account,
} from "@influx/contracts";
import { authService, AuthService } from "../services/auth-service";
import { SearchService } from "../services/search-service";

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

export const searchRoutes: FastifyPluginAsync<{
  searchService?: SearchService;
  authServiceInstance?: AuthService;
}> = async (fastify: FastifyInstance, opts) => {
  const searchService = opts.searchService || new SearchService();
  const auth = opts.authServiceInstance || authService;

  async function requireAuth(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<Account | null> {
    const token = extractSessionToken(request);
    if (!token) {
      reply.status(401).send({
        error: "UNAUTHORIZED",
        message: "Session requise pour accéder à la recherche.",
      });
      return null;
    }
    const session = await auth.getSession(token);
    if (!session) {
      reply.status(401).send({
        error: "UNAUTHORIZED",
        message: "Session invalide ou expirée.",
      });
      return null;
    }
    return session.account;
  }

  // POST /api/search/creators
  fastify.post("/api/search/creators", async (request, reply) => {
    const account = await requireAuth(request, reply);
    if (!account) return;

    try {
      const parsedRequest = CreatorSearchRequestSchema.parse(
        request.body || {},
      );
      const result = await searchService.searchCreators(account, parsedRequest);
      return reply.status(200).send(result);
    } catch (err: any) {
      if (err.message?.startsWith("BRAND_PROFILE_NOT_PUBLISHED")) {
        return reply.status(403).send({
          error: "BRAND_PROFILE_NOT_PUBLISHED",
          message: err.message.split(": ")[1] || err.message,
        });
      }
      if (err.message?.startsWith("FORBIDDEN_ROLE")) {
        return reply.status(403).send({
          error: "FORBIDDEN_ROLE",
          message: err.message.split(": ")[1] || err.message,
        });
      }
      if (err.message?.startsWith("RATE_LIMIT_EXCEEDED")) {
        return reply.status(429).send({
          error: "RATE_LIMIT_EXCEEDED",
          message: err.message.split(": ")[1] || err.message,
        });
      }
      if (
        err.message?.startsWith("PAGINATION_LIMIT_EXCEEDED") ||
        err.issues?.some((i: any) => i.path?.includes("page"))
      ) {
        return reply.status(400).send({
          error: "PAGINATION_LIMIT_EXCEEDED",
          message:
            "La pagination est limitée à 5 pages maximum (60 résultats).",
        });
      }
      return reply.status(400).send({
        error: "BAD_REQUEST",
        message: err.message,
      });
    }
  });

  // GET /api/search/creators
  fastify.get("/api/search/creators", async (request, reply) => {
    const account = await requireAuth(request, reply);
    if (!account) return;

    try {
      const query = request.query as Record<string, any>;
      const parsedRequest = CreatorSearchRequestSchema.parse({
        filters: {
          primaryTopic: query.primaryTopic,
          networks: query.networks
            ? Array.isArray(query.networks)
              ? query.networks
              : [query.networks]
            : undefined,
          audienceBand: query.audienceBand,
          engagementBand: query.engagementBand,
          audienceCountry: query.audienceCountry,
          formats: query.formats
            ? Array.isArray(query.formats)
              ? query.formats
              : [query.formats]
            : undefined,
          priceBand: query.priceBand,
          currency: query.currency || "EUR",
          includeOtherCurrencies:
            query.includeOtherCurrencies === "true" ||
            query.includeOtherCurrencies === true,
          campaignId: query.campaignId,
        },
        sort: query.sort || "default",
        page: query.page ? Number(query.page) : 1,
        limit: query.limit ? Number(query.limit) : 12,
        viewMode: query.viewMode || "advertiser_anonymous",
      });

      const result = await searchService.searchCreators(account, parsedRequest);
      return reply.status(200).send(result);
    } catch (err: any) {
      if (err.message?.startsWith("BRAND_PROFILE_NOT_PUBLISHED")) {
        return reply.status(403).send({
          error: "BRAND_PROFILE_NOT_PUBLISHED",
          message: err.message.split(": ")[1] || err.message,
        });
      }
      if (err.message?.startsWith("FORBIDDEN_ROLE")) {
        return reply.status(403).send({
          error: "FORBIDDEN_ROLE",
          message: err.message.split(": ")[1] || err.message,
        });
      }
      if (err.message?.startsWith("RATE_LIMIT_EXCEEDED")) {
        return reply.status(429).send({
          error: "RATE_LIMIT_EXCEEDED",
          message: err.message.split(": ")[1] || err.message,
        });
      }
      if (
        err.message?.startsWith("PAGINATION_LIMIT_EXCEEDED") ||
        err.issues?.some((i: any) => i.path?.includes("page"))
      ) {
        return reply.status(400).send({
          error: "PAGINATION_LIMIT_EXCEEDED",
          message:
            "La pagination est limitée à 5 pages maximum (60 résultats).",
        });
      }
      return reply.status(400).send({
        error: "BAD_REQUEST",
        message: err.message,
      });
    }
  });

  // GET /api/search/campaign-bridge/:campaignId (RG73, RG75)
  fastify.get<{ Params: { campaignId: string } }>(
    "/api/search/campaign-bridge/:campaignId",
    async (request, reply) => {
      const account = await requireAuth(request, reply);
      if (!account) return;

      try {
        const filters = await searchService.getCampaignBridgeFilters(
          request.params.campaignId,
        );
        return reply.status(200).send(filters);
      } catch (err: any) {
        return reply.status(404).send({
          error: "CAMPAIGN_NOT_FOUND",
          message: err.message,
        });
      }
    },
  );

  // POST /api/search/creators/:creatorId/open (RG63, RG66)
  fastify.post<{
    Params: { creatorId: string };
    Body: { searchQueryId: string };
  }>("/api/search/creators/:creatorId/open", async (request, reply) => {
    const account = await requireAuth(request, reply);
    if (!account) return;

    try {
      const { searchQueryId } = request.body || {};
      if (!searchQueryId) {
        return reply.status(400).send({
          error: "MISSING_SEARCH_QUERY_ID",
          message: "searchQueryId est obligatoire.",
        });
      }

      const res = await searchService.recordProfileOpen(
        searchQueryId,
        request.params.creatorId,
        account.id,
      );
      return reply.status(200).send(res);
    } catch (err: any) {
      if (err.message?.startsWith("PROFILE_OPEN_LIMIT_EXCEEDED")) {
        return reply.status(429).send({
          error: "PROFILE_OPEN_LIMIT_EXCEEDED",
          message: err.message.split(": ")[1] || err.message,
        });
      }
      return reply.status(400).send({
        error: "BAD_REQUEST",
        message: err.message,
      });
    }
  });

  // POST /api/search/team-selection (RG61)
  fastify.post("/api/search/team-selection", async (request, reply) => {
    const account = await requireAuth(request, reply);
    if (!account) return;

    if (account.role !== "advertiser") {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Seule une marque peut demander une sélection par l'équipe.",
      });
    }

    try {
      const raw = request.body as any;
      const res = await searchService.createTeamSelectionRequest(account.id, {
        campaignId: raw.campaignId,
        filters: raw.filters || {},
        notes: raw.notes,
        locale: raw.locale,
      });
      return reply.status(201).send(res);
    } catch (err: any) {
      return reply.status(400).send({
        error: "BAD_REQUEST",
        message: err.message,
      });
    }
  });

  // GET /api/search/shortlists (RG51)
  fastify.get("/api/search/shortlists", async (request, reply) => {
    const account = await requireAuth(request, reply);
    if (!account) return;

    if (account.role !== "advertiser") {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Seule une marque peut gérer ses shortlists.",
      });
    }

    const shortlists = await searchService.getShortlists(account.id);
    return reply.status(200).send(shortlists);
  });

  // POST /api/search/shortlists (RG51)
  fastify.post("/api/search/shortlists", async (request, reply) => {
    const account = await requireAuth(request, reply);
    if (!account) return;

    if (account.role !== "advertiser") {
      return reply.status(403).send({
        error: "FORBIDDEN",
        message: "Seule une marque peut créer une shortlist.",
      });
    }

    try {
      const { name, campaignId } = (request.body as any) || {};
      if (!name) {
        return reply.status(400).send({
          error: "MISSING_NAME",
          message: "Le nom de la shortlist est obligatoire.",
        });
      }
      const created = await searchService.createShortlist(account.id, {
        name,
        campaignId,
      });
      return reply.status(201).send(created);
    } catch (err: any) {
      return reply.status(400).send({
        error: "BAD_REQUEST",
        message: err.message,
      });
    }
  });

  // GET /api/search/shortlists/:id/items
  fastify.get<{ Params: { id: string } }>(
    "/api/search/shortlists/:id/items",
    async (request, reply) => {
      const account = await requireAuth(request, reply);
      if (!account) return;

      try {
        const items = await searchService.getShortlistItems(
          request.params.id,
          account.id,
        );
        return reply.status(200).send(items);
      } catch (err: any) {
        return reply.status(404).send({
          error: "NOT_FOUND",
          message: err.message,
        });
      }
    },
  );

  // POST /api/search/shortlists/:id/items
  fastify.post<{
    Params: { id: string };
    Body: { creatorAccountId: string; note?: string | null };
  }>("/api/search/shortlists/:id/items", async (request, reply) => {
    const account = await requireAuth(request, reply);
    if (!account) return;

    try {
      const { creatorAccountId, note } = request.body || {};
      if (!creatorAccountId) {
        return reply.status(400).send({
          error: "MISSING_CREATOR_ACCOUNT_ID",
          message: "creatorAccountId est obligatoire.",
        });
      }
      const item = await searchService.addShortlistItem(
        request.params.id,
        account.id,
        creatorAccountId,
        note,
      );
      return reply.status(201).send(item);
    } catch (err: any) {
      return reply.status(400).send({
        error: "BAD_REQUEST",
        message: err.message,
      });
    }
  });

  // DELETE /api/search/shortlists/:id/items/:creatorId
  fastify.delete<{ Params: { id: string; creatorId: string } }>(
    "/api/search/shortlists/:id/items/:creatorId",
    async (request, reply) => {
      const account = await requireAuth(request, reply);
      if (!account) return;

      try {
        const res = await searchService.removeShortlistItem(
          request.params.id,
          account.id,
          request.params.creatorId,
        );
        return reply.status(200).send(res);
      } catch (err: any) {
        return reply.status(400).send({
          error: "BAD_REQUEST",
          message: err.message,
        });
      }
    },
  );
};

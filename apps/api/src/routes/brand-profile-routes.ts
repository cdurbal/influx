import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import {
  SESSION_COOKIE_NAME,
  UpdateBrandProfileRequestSchema,
  BadgeRequestSchema,
  RejectProfileRequestSchema,
} from "@influx/contracts";
import { authService, AuthService } from "../services/auth-service";
import {
  brandProfileService,
  BrandProfileService,
} from "../services/brand-profile-service";

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

export const brandProfileRoutes: FastifyPluginAsync<{
  profileService?: BrandProfileService;
  authServiceInstance?: AuthService;
}> = async (fastify: FastifyInstance, opts) => {
  const profileService = opts.profileService || brandProfileService;
  const auth = opts.authServiceInstance || authService;

  // Helper pour authentifier la requête
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

  /**
   * GET /api/profiles/brand/me
   * Récupère le profil de la marque connectée (crée un brouillon au besoin - RG1, CA1)
   */
  fastify.get("/api/profiles/brand/me", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    if (session.user.role !== "advertiser" && session.user.role !== "admin") {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Accès réservé aux annonceurs",
      });
    }

    const profile = profileService.getOrCreateProfile(session.account);
    return reply.status(200).send({
      profile,
      completenessScore: profile.completenessScore,
    });
  });

  /**
   * PUT /api/profiles/brand/me
   * Met à jour les champs du profil marque et recalcule la complétude (RG57, RG58)
   */
  fastify.put("/api/profiles/brand/me", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    if (session.user.role !== "advertiser" && session.user.role !== "admin") {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Accès réservé aux annonceurs",
      });
    }

    const parseResult = UpdateBrandProfileRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Paramètres de profil invalides",
        details: parseResult.error.flatten(),
      });
    }

    try {
      const updated = profileService.updateProfile(
        session.account.id,
        parseResult.data,
      );
      return reply.status(200).send({
        profile: updated,
        completenessScore: updated.completenessScore,
      });
    } catch (err: any) {
      return reply.status(400).send({
        error: "ProfileUpdateError",
        message: err.message || "Erreur lors de la mise à jour du profil",
      });
    }
  });

  /**
   * POST /api/profiles/brand/me/submit
   * Soumission du profil pour validation humaine (RG5, CA6, CA7)
   */
  fastify.post("/api/profiles/brand/me/submit", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    if (session.user.role !== "advertiser" && session.user.role !== "admin") {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Accès réservé aux annonceurs",
      });
    }

    const result = profileService.submitForValidation(session.account.id);
    if (!result.success) {
      return reply.status(400).send({
        error: "IncompleteProfileError",
        message: `Il manque des informations pour publier votre profil : ${result.missingFields?.join(", ")}`,
        missingFields: result.missingFields,
        profile: result.profile,
      });
    }

    return reply.status(200).send({
      success: true,
      message: "Profil soumis pour validation avec succès",
      profile: result.profile,
    });
  });

  /**
   * POST /api/profiles/brand/me/badge-request
   * Demande d'attribution du badge Marque vérifiée (RG46, RG47)
   */
  fastify.post(
    "/api/profiles/brand/me/badge-request",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      if (session.user.role !== "advertiser" && session.user.role !== "admin") {
        return reply.status(403).send({
          error: "Forbidden",
          message: "Accès réservé aux annonceurs",
        });
      }

      const parseResult = BadgeRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: "Informations d'immatriculation invalides",
          details: parseResult.error.flatten(),
        });
      }

      try {
        const updated = profileService.requestBadge(
          session.account.id,
          parseResult.data,
        );
        return reply.status(200).send({
          success: true,
          message: "Demande de badge enregistrée",
          profile: updated,
        });
      } catch (err: any) {
        return reply.status(400).send({
          error: "BadgeRequestError",
          message: err.message,
        });
      }
    },
  );

  /**
   * GET /api/profiles/brand/:id
   * Consultation d'un profil marque par ID (avec masquage D40 pour les créateurs - RG74)
   */
  fastify.get<{ Params: { id: string }; Querystring: { revealed?: string } }>(
    "/api/profiles/brand/:id",
    async (request, reply) => {
      const { id } = request.params;
      const isRevealedParam = request.query.revealed === "true";

      const token = extractSessionToken(request);
      let viewer: { id: string; role: string } | null = null;
      if (token) {
        const session = await auth.getSession(token);
        if (session) {
          viewer = { id: session.account.id, role: session.user.role };
        }
      }

      try {
        const view = profileService.getProfileView(id, viewer, {
          isRevealed: isRevealedParam,
        });
        return reply.status(200).send({ profile: view });
      } catch (err: any) {
        return reply.status(404).send({
          error: "NotFoundError",
          message: err.message || "Profil introuvable",
        });
      }
    },
  );

  /**
   * POST /api/backoffice/profiles/brand/:id/publish
   * Validation commerciale du profil (RG6, RG78)
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/backoffice/profiles/brand/:id/publish",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      if (session.user.role !== "agent" && session.user.role !== "admin") {
        return reply.status(403).send({
          error: "Forbidden",
          message: "Accès réservé à l'équipe INFLUX",
        });
      }

      try {
        const published = profileService.publishProfile(
          request.params.id,
          session.account.id,
        );
        return reply.status(200).send({
          success: true,
          profile: published,
        });
      } catch (err: any) {
        return reply.status(400).send({
          error: "PublicationError",
          message: err.message,
        });
      }
    },
  );

  /**
   * POST /api/backoffice/profiles/brand/:id/reject
   * Refus typé du profil par un agent (RG10, RG66)
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/backoffice/profiles/brand/:id/reject",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      if (session.user.role !== "agent" && session.user.role !== "admin") {
        return reply.status(403).send({
          error: "Forbidden",
          message: "Accès réservé à l'équipe INFLUX",
        });
      }

      const parseResult = RejectProfileRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: "ValidationError",
          message: "Motif de refus invalide",
          details: parseResult.error.flatten(),
        });
      }

      try {
        const rejected = profileService.rejectProfile(
          request.params.id,
          session.account.id,
          parseResult.data.reason,
          parseResult.data.customMessage,
        );
        return reply.status(200).send({
          success: true,
          profile: rejected,
        });
      } catch (err: any) {
        return reply.status(400).send({
          error: "RejectionError",
          message: err.message,
        });
      }
    },
  );
};

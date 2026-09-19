import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import {
  SESSION_COOKIE_NAME,
  UpdateCreatorProfileRequestSchema,
  RejectCreatorProfileRequestSchema,
} from "@influx/contracts";
import { authService, AuthService } from "../services/auth-service";
import {
  creatorProfileService,
  CreatorProfileService,
} from "../services/creator-profile-service";

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

export const creatorProfileRoutes: FastifyPluginAsync<{
  profileService?: CreatorProfileService;
  authServiceInstance?: AuthService;
}> = async (fastify: FastifyInstance, opts) => {
  const profileService = opts.profileService || creatorProfileService;
  const auth = opts.authServiceInstance || authService;

  // Helper pour authentifier la session
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
   * GET /api/profiles/creator/me
   * Récupère le profil du créateur connecté (crée un brouillon au besoin - RG1, CA1)
   */
  fastify.get("/api/profiles/creator/me", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    if (session.user.role !== "creator" && session.user.role !== "admin") {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Accès réservé aux créateurs",
      });
    }

    const profile = profileService.getOrCreateProfile(session.account);
    return reply.status(200).send({
      profile,
      completenessScore: profile.completenessScore,
    });
  });

  /**
   * PUT /api/profiles/creator/me
   * Met à jour les informations du profil créateur (RG9, RG86)
   */
  fastify.put("/api/profiles/creator/me", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    if (session.user.role !== "creator" && session.user.role !== "admin") {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Accès réservé aux créateurs",
      });
    }

    const parseResult = UpdateCreatorProfileRequestSchema.safeParse(
      request.body,
    );
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Bad Request",
        message: "Données de profil invalides",
        details: parseResult.error.format(),
      });
    }

    try {
      const updated = profileService.updateProfile(
        session.account.id,
        parseResult.data,
      );
      return reply.status(200).send({
        message: "Profil mis à jour",
        profile: updated,
        completenessScore: updated.completenessScore,
      });
    } catch (err: any) {
      return reply.status(400).send({
        error: "Bad Request",
        message: err.message || "Erreur lors de la mise à jour du profil",
      });
    }
  });

  /**
   * POST /api/profiles/creator/me/submit
   * Soumission du profil créateur pour validation commerciale (RG4, RG5, CA8)
   */
  fastify.post("/api/profiles/creator/me/submit", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    if (session.user.role !== "creator" && session.user.role !== "admin") {
      return reply.status(403).send({
        error: "Forbidden",
        message: "Accès réservé aux créateurs",
      });
    }

    const result = profileService.submitForValidation(session.account.id);
    if (!result.success) {
      return reply.status(400).send({
        error: "Validation Failed",
        message:
          "Certains champs obligatoires sont manquants pour publier votre profil",
        missingFields: result.missingFields,
      });
    }

    return reply.status(200).send({
      message: "Profil créateur soumis avec succès pour validation",
      profile: result.profile,
    });
  });

  /**
   * GET /api/creators/:id/anonymous
   * Récupère la Vue Publique Anonyme d'un créateur (Couche A)
   * Accessible aux marques authentifiées et aux internes (RG18, RG102, CA4, CA13)
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/creators/:id/anonymous",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      try {
        const publicProfile = profileService.getAnonymousView(
          request.params.id,
        );
        return reply.status(200).send({
          profile: publicProfile,
        });
      } catch {
        return reply.status(404).send({
          error: "Not Found",
          message: "Profil créateur introuvable",
        });
      }
    },
  );

  /**
   * GET /api/creators/:id/revealed
   * Récupère la Vue Révélée d'un créateur (Couche A + Couche I)
   * Accessible après ouverture d'une mise en relation (RG19, RG102, CA14, CA56)
   */
  fastify.get<{ Params: { id: string } }>(
    "/api/creators/:id/revealed",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      // Note : En MVP, vérifie les rôles autorisés (agent, admin, ou annonceur)
      try {
        const revealedProfile = profileService.getRevealedView(
          request.params.id,
          session.user.role,
        );
        return reply.status(200).send({
          profile: revealedProfile,
        });
      } catch {
        return reply.status(404).send({
          error: "Not Found",
          message: "Profil créateur introuvable",
        });
      }
    },
  );

  /**
   * POST /api/backoffice/profiles/creator/:id/publish
   * Validation commerciale et publication d'un profil créateur par un agent (RG5, RG95)
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/backoffice/profiles/creator/:id/publish",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      if (session.user.role !== "agent" && session.user.role !== "admin") {
        return reply.status(403).send({
          error: "Forbidden",
          message: "Action réservée aux agents INFLUX",
        });
      }

      try {
        const published = profileService.publishProfile(
          request.params.id,
          session.account.id,
        );
        return reply.status(200).send({
          message: "Profil créateur validé et publié avec succès",
          profile: published,
        });
      } catch {
        return reply.status(404).send({
          error: "Not Found",
          message: "Profil créateur introuvable",
        });
      }
    },
  );

  /**
   * POST /api/backoffice/profiles/creator/:id/reject
   * Refus motivé d'un profil créateur par un agent (RG10, RG95, RG96, CA51)
   */
  fastify.post<{ Params: { id: string } }>(
    "/api/backoffice/profiles/creator/:id/reject",
    async (request, reply) => {
      const session = await requireAuth(request, reply);
      if (!session) return;

      if (session.user.role !== "agent" && session.user.role !== "admin") {
        return reply.status(403).send({
          error: "Forbidden",
          message: "Action réservée aux agents INFLUX",
        });
      }

      const parseResult = RejectCreatorProfileRequestSchema.safeParse(
        request.body,
      );
      if (!parseResult.success) {
        return reply.status(400).send({
          error: "Bad Request",
          message: "Motif de refus invalide",
          details: parseResult.error.format(),
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
          message: "Profil créateur refusé avec motif typé",
          profile: rejected,
        });
      } catch {
        return reply.status(404).send({
          error: "Not Found",
          message: "Profil créateur introuvable",
        });
      }
    },
  );
};

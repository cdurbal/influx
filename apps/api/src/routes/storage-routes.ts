import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import {
  SESSION_COOKIE_NAME,
  SignedUploadUrlRequestSchema,
} from "@influx/contracts";
import { authService, AuthService } from "../services/auth-service";
import { storageService, StorageService } from "../services/storage-service";

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

export const storageRoutes: FastifyPluginAsync<{
  storageServiceInstance?: StorageService;
  authServiceInstance?: AuthService;
}> = async (fastify: FastifyInstance, opts) => {
  const service = opts.storageServiceInstance || storageService;
  const auth = opts.authServiceInstance || authService;

  // Helper pour authentifier la requête
  async function getSession(request: FastifyRequest) {
    const token = extractSessionToken(request);
    if (!token) return null;
    return auth.getSession(token);
  }

  async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
    const session = await getSession(request);
    if (!session) {
      reply.status(401).send({
        error: "Unauthorized",
        message: "Session requise pour cette action",
      });
      return null;
    }
    return session;
  }

  /**
   * POST /api/storage/signed-upload-url
   * Émet une URL signée pour le téléversement direct d'un fichier (E1)
   */
  fastify.post("/api/storage/signed-upload-url", async (request, reply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const parseResult = SignedUploadUrlRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      const firstIssueMessage = parseResult.error.issues[0]?.message;
      return reply.status(400).send({
        error: "Bad Request",
        message:
          firstIssueMessage ||
          "Paramètres de demande de téléversement invalides",
        details: parseResult.error.format(),
      });
    }

    try {
      const response = service.generateSignedUploadUrl(
        session.account,
        parseResult.data,
      );
      return reply.status(200).send(response);
    } catch (err: any) {
      return reply.status(400).send({
        error: "Bad Request",
        message: err.message || "Erreur lors de la génération de l'URL signée",
      });
    }
  });

  /**
   * PUT /api/storage/upload/:fileId
   * Simule la réception du fichier téléversé et la suppression des EXIF (E1, RG80)
   */
  fastify.put<{ Params: { fileId: string } }>(
    "/api/storage/upload/:fileId",
    async (request, reply) => {
      const body = (request.body as Record<string, unknown>) || {};
      try {
        const response = service.uploadFile(request.params.fileId, {
          data: (body.data as string) || undefined,
          contentType: (body.contentType as string) || undefined,
          sizeBytes: (body.sizeBytes as number) || undefined,
        });
        return reply.status(200).send(response);
      } catch (err: any) {
        return reply.status(400).send({
          error: "Bad Request",
          message: err.message || "Erreur lors du téléversement du fichier",
        });
      }
    },
  );

  /**
   * GET /api/storage/files/:fileId
   * Consultation d'un fichier avec contrôle de sécurité strict sur les pièces de vérification (E1, RG54)
   */
  fastify.get<{ Params: { fileId: string } }>(
    "/api/storage/files/:fileId",
    async (request, reply) => {
      const session = await getSession(request);

      try {
        const record = service.getFile(request.params.fileId, session?.account);
        return reply.status(200).send({
          fileId: record.id,
          storagePath: record.storagePath,
          bucket: record.bucket,
          contentType: record.contentType,
          data: record.data,
          exifStripped: record.exifStripped,
        });
      } catch (err: any) {
        const message = err.message || "Fichier introuvable";
        if (
          message.includes("strictement interdit") ||
          message.includes("Authentification requise")
        ) {
          return reply.status(403).send({
            error: "Forbidden",
            message,
          });
        }
        return reply.status(404).send({
          error: "Not Found",
          message,
        });
      }
    },
  );
};

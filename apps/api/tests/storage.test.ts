import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import cookiePlugin from "@fastify/cookie";
import { storageRoutes } from "../src/routes/storage-routes";
import { StorageService } from "../src/services/storage-service";
import { AuthService } from "../src/services/auth-service";
import { MockStore } from "../src/mocks/mock-store";

describe("Mission 2.4 : Mock Storage Service (téléversement de preuves et visuels)", () => {
  let app: ReturnType<typeof Fastify>;
  let store: MockStore;
  let authService: AuthService;
  let storageService: StorageService;

  let creatorToken: string;
  let advertiserToken: string;
  let agentToken: string;

  beforeEach(async () => {
    store = MockStore.getInstance();
    store.reset();

    authService = new AuthService(store);
    storageService = new StorageService(store);

    // Initialisation des sessions
    // 1. Créateur
    await authService.sendOtp("lucas@lucastech.fr", "creator");
    const creatorAuth = await authService.verifyOtp({
      email: "lucas@lucastech.fr",
      code: "123456",
    });
    creatorToken = creatorAuth.token;

    // 2. Annonceur
    await authService.sendOtp("contact@maisonsolene.fr", "advertiser");
    const advAuth = await authService.verifyOtp({
      email: "contact@maisonsolene.fr",
      code: "123456",
    });
    advertiserToken = advAuth.token;

    // 3. Agent backoffice
    const agentAuth = await authService.loginBackoffice({
      email: "alexandre@influx.io",
      code: "123456",
    });
    agentToken = agentAuth.token;

    app = Fastify();
    await app.register(cookiePlugin);
    await app.register(storageRoutes, {
      storageServiceInstance: storageService,
      authServiceInstance: authService,
    });
    await app.ready();
  });

  describe("Génération d'URL signée de téléversement (POST /api/storage/signed-upload-url)", () => {
    it("génère une URL signée avec un chemin calculé par le serveur SANS le nom de fichier d'origine (E1, RG80)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/storage/signed-upload-url",
        headers: {
          authorization: `Bearer ${creatorToken}`,
        },
        payload: {
          filename: "lucas-martinez-story-instagram.png", // Nom identifiant à masquer impérativement
          bucket: "portfolio",
          contentType: "image/png",
          sizeBytes: 150000,
        },
      });

      expect(response.statusCode).toBe(200);
      const data = response.json();
      expect(data.fileId).toBeDefined();
      expect(data.uploadUrl).toBe(`/api/storage/upload/${data.fileId}`);
      expect(data.expiresInSeconds).toBe(300);

      // Invariant E1 : Le nom d'origine ne doit JAMAIS se trouver dans le storagePath
      expect(data.storagePath).not.toContain("lucas-martinez");
      expect(data.storagePath).not.toContain("instagram");
      expect(data.storagePath).toMatch(/^portfolio\/[a-f0-9-]+\.png$/);

      // Journalisation d'audit
      const auditLog = store.auditEvents.find(
        (e) => e.eventType === "storage.signed_upload_url_generated",
      );
      expect(auditLog).toBeDefined();
      expect(auditLog?.payload.fileId).toBe(data.fileId);
    });

    it("refuse une requête non authentifiée (401)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/storage/signed-upload-url",
        payload: {
          filename: "test.png",
          bucket: "portfolio",
          contentType: "image/png",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("refuse un fichier dont la taille déclarée dépasse 5 Mo (RG77, E1)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/storage/signed-upload-url",
        headers: {
          authorization: `Bearer ${creatorToken}`,
        },
        payload: {
          filename: "gros-fichier.png",
          bucket: "portfolio",
          contentType: "image/png",
          sizeBytes: 6 * 1024 * 1024, // 6 Mo > 5 Mo
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain("5 Mo");
    });

    it("refuse le format WebP pour les pièces de vérification (PNG et JPEG uniquement - E1-9, RG34)", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/storage/signed-upload-url",
        headers: {
          authorization: `Bearer ${creatorToken}`,
        },
        payload: {
          filename: "capture-stats.webp",
          bucket: "verification",
          contentType: "image/webp",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().message).toContain("PNG et JPEG");
    });
  });

  describe("Téléversement et ré-encodage sans EXIF (PUT /api/storage/upload/:fileId)", () => {
    it("simule la réception du fichier et confirme la suppression des EXIF (RG80, E1)", async () => {
      // 1. Demande d'URL signée
      const signRes = await app.inject({
        method: "POST",
        url: "/api/storage/signed-upload-url",
        headers: {
          authorization: `Bearer ${creatorToken}`,
        },
        payload: {
          filename: "photo-portfolio.jpeg",
          bucket: "portfolio",
          contentType: "image/jpeg",
        },
      });
      const { fileId, uploadUrl } = signRes.json();

      // 2. Téléversement
      const uploadRes = await app.inject({
        method: "PUT",
        url: uploadUrl,
        payload: {
          data: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBD...",
          sizeBytes: 250000,
        },
      });

      expect(uploadRes.statusCode).toBe(200);
      const result = uploadRes.json();
      expect(result.fileId).toBe(fileId);
      expect(result.exifStripped).toBe(true);
      expect(result.publicUrl).toBe(`/api/storage/files/${fileId}`);

      // Journalisation d'audit
      const uploadLog = store.auditEvents.find(
        (e) => e.eventType === "storage.file_uploaded",
      );
      expect(uploadLog).toBeDefined();
      expect(uploadLog?.payload.fileId).toBe(fileId);
    });

    it("rejette le téléversement si l'identifiant est inconnu", async () => {
      const uploadRes = await app.inject({
        method: "PUT",
        url: "/api/storage/upload/00000000-0000-0000-0000-000000000000",
        payload: {
          data: "mock",
        },
      });

      expect(uploadRes.statusCode).toBe(400);
      expect(uploadRes.json().message).toContain("introuvable");
    });
  });

  describe("Consultation et contrôle de sécurité des pièces de vérification (GET /api/storage/files/:fileId)", () => {
    it("permet l'accès public aux visuels du portfolio une fois téléversés", async () => {
      const signRes = await app.inject({
        method: "POST",
        url: "/api/storage/signed-upload-url",
        headers: {
          authorization: `Bearer ${creatorToken}`,
        },
        payload: {
          filename: "sample.png",
          bucket: "portfolio",
          contentType: "image/png",
        },
      });
      const { fileId } = signRes.json();

      await app.inject({
        method: "PUT",
        url: `/api/storage/upload/${fileId}`,
        payload: { data: "base64portfolio" },
      });

      // Consultation sans token (public)
      const getRes = await app.inject({
        method: "GET",
        url: `/api/storage/files/${fileId}`,
      });

      expect(getRes.statusCode).toBe(200);
      expect(getRes.json().fileId).toBe(fileId);
      expect(getRes.json().bucket).toBe("portfolio");
    });

    it("INTERDIT formellement l'accès à une pièce de vérification par un annonceur (RG54, E1)", async () => {
      // 1. Créateur dépose une capture de stats
      const signRes = await app.inject({
        method: "POST",
        url: "/api/storage/signed-upload-url",
        headers: {
          authorization: `Bearer ${creatorToken}`,
        },
        payload: {
          filename: "analytics-screenshot.png",
          bucket: "verification",
          contentType: "image/png",
        },
      });
      const { fileId } = signRes.json();

      await app.inject({
        method: "PUT",
        url: `/api/storage/upload/${fileId}`,
        payload: { data: "privateScreenshotData" },
      });

      // 2. Une marque tente de consulter la pièce
      const advAttempt = await app.inject({
        method: "GET",
        url: `/api/storage/files/${fileId}`,
        headers: {
          authorization: `Bearer ${advertiserToken}`,
        },
      });

      expect(advAttempt.statusCode).toBe(403);
      expect(advAttempt.json().message).toContain("strictement interdit");
    });

    it("autorise un agent à consulter une pièce de vérification ET journalise nominativement la consultation (E1, 04 §5.3)", async () => {
      const signRes = await app.inject({
        method: "POST",
        url: "/api/storage/signed-upload-url",
        headers: {
          authorization: `Bearer ${creatorToken}`,
        },
        payload: {
          filename: "stats.png",
          bucket: "verification",
          contentType: "image/png",
        },
      });
      const { fileId } = signRes.json();

      await app.inject({
        method: "PUT",
        url: `/api/storage/upload/${fileId}`,
        payload: { data: "verifiedData" },
      });

      // Agent consulte la pièce
      const agentRes = await app.inject({
        method: "GET",
        url: `/api/storage/files/${fileId}`,
        headers: {
          authorization: `Bearer ${agentToken}`,
        },
      });

      expect(agentRes.statusCode).toBe(200);
      expect(agentRes.json().fileId).toBe(fileId);

      // Traçabilité obligatoire : verification.evidence_viewed
      const auditLog = store.auditEvents.find(
        (e) => e.eventType === "verification.evidence_viewed",
      );
      expect(auditLog).toBeDefined();
      expect(auditLog?.payload.fileId).toBe(fileId);
    });
  });
});

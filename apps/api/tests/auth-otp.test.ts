import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import cookiePlugin from "@fastify/cookie";
import { authService, AuthService } from "../src/services/auth-service";
import { authRoutes } from "../src/routes/auth-routes";
import { MockStore } from "../src/mocks/mock-store";

describe("Mission 1.1 : Auth OTP Membre (D37)", () => {
  let app: ReturnType<typeof Fastify>;
  let customService: AuthService;
  let store: MockStore;

  beforeEach(async () => {
    // Réinitialisation du store et du service avant chaque test
    store = MockStore.getInstance();
    store.reset();
    customService = new AuthService(store);
    authService.reset();

    app = Fastify();
    await app.register(cookiePlugin);
    await app.register(authRoutes, { service: customService });
    await app.ready();
  });

  describe("Service AuthService", () => {
    it("génère et stocke un code OTP à 6 chiffres valide 10 minutes", async () => {
      const res = await customService.sendOtp(
        "test-marque@influx.dev",
        "advertiser",
      );
      expect(res.success).toBe(true);
      expect(res.expiresInSeconds).toBe(600);
    });

    it("refuse l'envoi d'un OTP pour un rôle non-membre", async () => {
      await expect(
        customService.sendOtp("admin@influx.dev", "admin" as any),
      ).rejects.toThrow("Rôle invalide");
    });

    it("valide le code OTP correct et crée un nouveau compte si inexistant", async () => {
      const email = "nouveau-createur@influx.dev";
      await customService.sendOtp(email, "creator");

      const result = await customService.verifyOtp({
        email,
        code: "123456",
        termsVersion: "2026-09-v1",
        hasNonCircumventionAcknowledged: true,
      });

      expect(result.token).toBeDefined();
      expect(result.token).toContain("influx_sess_");
      expect(result.user.email).toBe(email);
      expect(result.user.role).toBe("creator");
      expect(result.account.emailStatus).toBe("verified");

      // Vérifie l'enregistrement des CGU
      const terms = customService.getTermsAcceptances();
      expect(terms.length).toBe(1);
      expect(terms[0]!.termsVersion).toBe("2026-09-v1");
      expect(terms[0]!.hasNonCircumventionAcknowledged).toBe(true);
    });

    it("rejette un mauvais code et incrémente le compteur d'échecs", async () => {
      const email = "marque-erreur@influx.dev";
      await customService.sendOtp(email, "advertiser");

      await expect(
        customService.verifyOtp({
          email,
          code: "000000",
        }),
      ).rejects.toThrow("Code OTP incorrect");
    });

    it("bloque et invalide le code après 5 tentatives échouées (D37)", async () => {
      const email = "bruteforce@influx.dev";
      await customService.sendOtp(email, "creator");

      // 4 tentatives erronées
      for (let i = 0; i < 4; i++) {
        await expect(
          customService.verifyOtp({ email, code: "999999" }),
        ).rejects.toThrow("Code OTP incorrect");
      }

      // 5ème tentative échouée -> blocage
      await expect(
        customService.verifyOtp({ email, code: "999999" }),
      ).rejects.toThrow("Nombre maximal de tentatives dépassé");

      // Même avec le bon code après 5 échecs, l'OTP a été invalidé
      await expect(
        customService.verifyOtp({ email, code: "123456" }),
      ).rejects.toThrow("Aucun code OTP en attente");
    });

    it("invalide immédiatement le code après une utilisation réussie (D37)", async () => {
      const email = "rejeu@influx.dev";
      await customService.sendOtp(email, "advertiser");

      // Première validation réussie
      await customService.verifyOtp({ email, code: "123456" });

      // Seconde validation avec le même code échoue
      await expect(
        customService.verifyOtp({ email, code: "123456" }),
      ).rejects.toThrow("Aucun code OTP en attente");
    });

    it("maintient la session avec prolongation glissante et permet la déconnexion", async () => {
      const email = "session-test@influx.dev";
      await customService.sendOtp(email, "creator");
      const { token } = await customService.verifyOtp({
        email,
        code: "123456",
      });

      const session = await customService.getSession(token);
      expect(session).not.toBeNull();
      expect(session?.user.email).toBe(email);

      await customService.logout(token);
      const afterLogout = await customService.getSession(token);
      expect(afterLogout).toBeNull();
    });
  });

  describe("Routes HTTP Fastify /api/auth", () => {
    it("POST /api/auth/otp/send avec e-mail et rôle valide renvoie 200", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/otp/send",
        payload: {
          email: "contact@marque.fr",
          role: "advertiser",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.expiresInSeconds).toBe(600);
    });

    it("POST /api/auth/otp/send avec e-mail invalide renvoie 400", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/otp/send",
        payload: {
          email: "not-an-email",
          role: "advertiser",
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe("ValidationError");
    });

    it("POST /api/auth/otp/verify pose le cookie influx_session et renvoie le token", async () => {
      const email = "lucas@creator.fr";
      await customService.sendOtp(email, "creator");

      const res = await app.inject({
        method: "POST",
        url: "/api/auth/otp/verify",
        payload: {
          email,
          code: "123456",
          termsVersion: "2026-09-v1",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.token).toBeDefined();
      expect(body.user.email).toBe(email);

      // Vérification de la présence du cookie influx_session
      const setCookie = res.headers["set-cookie"];
      expect(setCookie).toBeDefined();
      const cookieStr = Array.isArray(setCookie)
        ? setCookie.join("; ")
        : (setCookie as string);
      expect(cookieStr).toContain("influx_session=");
      expect(cookieStr.toLowerCase()).toContain("httponly");
      expect(cookieStr.toLowerCase()).toContain("samesite=lax");
    });

    it("GET /api/auth/me sans cookie renvoie 401 Unauthorized", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/auth/me",
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe("Unauthorized");
    });

    it("GET /api/auth/me avec le cookie de session renvoie l'utilisateur connecté", async () => {
      const email = "lucas-session@creator.fr";
      await customService.sendOtp(email, "creator");

      const verifyRes = await app.inject({
        method: "POST",
        url: "/api/auth/otp/verify",
        payload: {
          email,
          code: "123456",
        },
      });
      const cookieHeader = verifyRes.headers["set-cookie"];

      const meRes = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          cookie: Array.isArray(cookieHeader)
            ? cookieHeader.join("; ")
            : cookieHeader,
        },
      });

      expect(meRes.statusCode).toBe(200);
      const meBody = JSON.parse(meRes.payload);
      expect(meBody.user.email).toBe(email);
      expect(meBody.user.role).toBe("creator");
    });

    it("GET /api/auth/me avec header Authorization: Bearer <token> renvoie l'utilisateur", async () => {
      const email = "bearer-auth@marque.fr";
      await customService.sendOtp(email, "advertiser");

      const verifyRes = await app.inject({
        method: "POST",
        url: "/api/auth/otp/verify",
        payload: {
          email,
          code: "123456",
        },
      });
      const { token } = JSON.parse(verifyRes.payload);

      const meRes = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(meRes.statusCode).toBe(200);
      const meBody = JSON.parse(meRes.payload);
      expect(meBody.user.email).toBe(email);
    });

    it("POST /api/auth/logout invalide la session et supprime le cookie", async () => {
      const email = "logout-test@creator.fr";
      await customService.sendOtp(email, "creator");

      const verifyRes = await app.inject({
        method: "POST",
        url: "/api/auth/otp/verify",
        payload: {
          email,
          code: "123456",
        },
      });
      const cookieHeader = verifyRes.headers["set-cookie"];

      // Déconnexion
      const logoutRes = await app.inject({
        method: "POST",
        url: "/api/auth/logout",
        headers: {
          cookie: Array.isArray(cookieHeader)
            ? cookieHeader.join("; ")
            : cookieHeader,
        },
      });
      expect(logoutRes.statusCode).toBe(200);

      // Vérifie que /api/auth/me est désormais non autorisé
      const meRes = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          cookie: Array.isArray(cookieHeader)
            ? cookieHeader.join("; ")
            : cookieHeader,
        },
      });
      expect(meRes.statusCode).toBe(401);
    });
  });
});

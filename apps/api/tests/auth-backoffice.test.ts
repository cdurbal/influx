import { describe, it, expect, beforeEach } from "vitest";
import Fastify from "fastify";
import cookiePlugin from "@fastify/cookie";
import { authService, AuthService } from "../src/services/auth-service";
import { authRoutes } from "../src/routes/auth-routes";
import { MockStore } from "../src/mocks/mock-store";

describe("Mission 1.2 : Auth Backoffice TOTP (D37)", () => {
  let app: ReturnType<typeof Fastify>;
  let customService: AuthService;
  let store: MockStore;

  beforeEach(async () => {
    store = MockStore.getInstance();
    store.reset();
    customService = new AuthService(store);
    authService.reset();

    app = Fastify();
    await app.register(cookiePlugin);
    await app.register(authRoutes, { service: customService });
    await app.ready();
  });

  describe("Service AuthService - loginBackoffice", () => {
    it("connecte un agent avec mot de passe et code TOTP 123456", async () => {
      const result = await customService.loginBackoffice({
        email: "alexandre@influx.io",
        password: "securepassword123",
        code: "123456",
      });

      expect(result.token).toBeDefined();
      expect(result.token).toContain("influx_bo_");
      expect(result.user.role).toBe("agent");
      expect(result.user.email).toBe("alexandre@influx.io");
      expect(result.account.role).toBe("agent");
    });

    it("connecte un administrateur avec code TOTP 000000", async () => {
      const result = await customService.loginBackoffice({
        email: "sarah.admin@influx.io",
        password: "adminpassword",
        code: "000000",
      });

      expect(result.token).toBeDefined();
      expect(result.user.role).toBe("admin");
      expect(result.user.email).toBe("sarah.admin@influx.io");
    });

    it("rejette un compte membre (annonceur / créateur) avec refus d'accès", async () => {
      // contact@maisonsolene.fr est un compte annonceur du seed
      await expect(
        customService.loginBackoffice({
          email: "contact@maisonsolene.fr",
          password: "password",
          code: "123456",
        }),
      ).rejects.toThrow("Accès refusé");
    });

    it("rejette un code TOTP erroné", async () => {
      await expect(
        customService.loginBackoffice({
          email: "alexandre@influx.io",
          password: "password",
          code: "999999",
        }),
      ).rejects.toThrow("Code TOTP invalide");
    });

    it("rejette un e-mail inconnu", async () => {
      await expect(
        customService.loginBackoffice({
          email: "inconnu@influx.io",
          password: "password",
          code: "123456",
        }),
      ).rejects.toThrow("Compte backoffice introuvable");
    });

    it("permet de retrouver la session backoffice via getSession", async () => {
      const { token } = await customService.loginBackoffice({
        email: "alexandre@influx.io",
        password: "password",
        code: "123456",
      });

      const session = await customService.getSession(token);
      expect(session).not.toBeNull();
      expect(session?.user.email).toBe("alexandre@influx.io");
      expect(session?.user.role).toBe("agent");
    });
  });

  describe("Routes HTTP Fastify - POST /api/auth/backoffice/login", () => {
    it("connecte un agent avec 200 OK et pose le cookie de session influx_session", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/backoffice/login",
        payload: {
          email: "alexandre@influx.io",
          password: "mypassword",
          code: "123456",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.success).toBe(true);
      expect(body.token).toBeDefined();
      expect(body.user.email).toBe("alexandre@influx.io");
      expect(body.user.role).toBe("agent");

      // Vérification du cookie HTTP
      const setCookie = res.headers["set-cookie"];
      expect(setCookie).toBeDefined();
      const cookieStr = Array.isArray(setCookie)
        ? setCookie.join("; ")
        : (setCookie as string);
      expect(cookieStr).toContain("influx_session=");
      expect(cookieStr.toLowerCase()).toContain("httponly");
    });

    it("connecte un administrateur avec le code TOTP 000000", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/backoffice/login",
        payload: {
          email: "sarah.admin@influx.io",
          password: "mypassword",
          code: "000000",
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.user.role).toBe("admin");
    });

    it("renvoie 403 Forbidden si un annonceur tente de se connecter au backoffice", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/backoffice/login",
        payload: {
          email: "contact@maisonsolene.fr",
          password: "mypassword",
          code: "123456",
        },
      });

      expect(res.statusCode).toBe(403);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe("Forbidden");
    });

    it("renvoie 401 si le code TOTP est erroné", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/backoffice/login",
        payload: {
          email: "alexandre@influx.io",
          password: "mypassword",
          code: "888888",
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe("BackofficeAuthError");
      expect(body.message).toContain("Code TOTP invalide");
    });

    it("renvoie 400 si les paramètres sont invalides", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/auth/backoffice/login",
        payload: {
          email: "notanemail",
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.error).toBe("ValidationError");
    });

    it("GET /api/auth/me avec le cookie backoffice renvoie les informations de l'agent", async () => {
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/auth/backoffice/login",
        payload: {
          email: "alexandre@influx.io",
          password: "mypassword",
          code: "123456",
        },
      });
      const cookieHeader = loginRes.headers["set-cookie"];

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
      expect(meBody.user.email).toBe("alexandre@influx.io");
      expect(meBody.user.role).toBe("agent");
    });

    it("POST /api/auth/logout révoque la session backoffice", async () => {
      const loginRes = await app.inject({
        method: "POST",
        url: "/api/auth/backoffice/login",
        payload: {
          email: "alexandre@influx.io",
          password: "mypassword",
          code: "123456",
        },
      });
      const cookieHeader = loginRes.headers["set-cookie"];

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

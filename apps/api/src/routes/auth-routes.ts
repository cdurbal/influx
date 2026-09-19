import {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyRequest,
  FastifyReply,
} from "fastify";
import {
  SendOtpRequestSchema,
  VerifyOtpRequestSchema,
  SESSION_COOKIE_NAME,
} from "../../../../packages/contracts/src/auth";
import { authService, AuthService } from "../services/auth-service";

function extractSessionToken(request: FastifyRequest): string | undefined {
  // 1. Depuis les cookies Fastify si le plugin @fastify/cookie est chargé
  if (request.cookies && request.cookies[SESSION_COOKIE_NAME]) {
    return request.cookies[SESSION_COOKIE_NAME];
  }

  // 2. Depuis l'en-tête Cookie brut (fallback robuste)
  const rawCookie = request.headers.cookie;
  if (rawCookie) {
    const match = rawCookie.match(
      new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`),
    );
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  // 3. Depuis l'en-tête Authorization Bearer
  const authHeader = request.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  return undefined;
}

function setSessionCookie(
  reply: FastifyReply,
  token: string,
  maxAgeSeconds: number = 30 * 24 * 60 * 60,
): void {
  const isProd = process.env.NODE_ENV === "production";

  if (typeof (reply as any).setCookie === "function") {
    (reply as any).setCookie(SESSION_COOKIE_NAME, token, {
      path: "/",
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      maxAge: maxAgeSeconds,
    });
  } else {
    // Fallback manuel si @fastify/cookie n'est pas actif
    const cookieParts = [
      `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${maxAgeSeconds}`,
    ];
    if (isProd) {
      cookieParts.push("Secure");
    }
    reply.header("Set-Cookie", cookieParts.join("; "));
  }
}

function clearSessionCookie(reply: FastifyReply): void {
  if (typeof (reply as any).clearCookie === "function") {
    (reply as any).clearCookie(SESSION_COOKIE_NAME, {
      path: "/",
    });
  } else {
    reply.header(
      "Set-Cookie",
      `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
    );
  }
}

export const authRoutes: FastifyPluginAsync<{
  service?: AuthService;
}> = async (fastify: FastifyInstance, opts) => {
  const service = opts.service || authService;

  // Gestion intelligente du préfixe pour supporter fastify.register(authRoutes)
  // ou fastify.register(authRoutes, { prefix: "/api/auth" })
  const isPrefixed = fastify.prefix.includes("/auth");
  const p = isPrefixed ? "" : "/api/auth";

  /**
   * POST /api/auth/otp/send
   * Reçoit email + rôle (advertiser | creator)
   */
  fastify.post(`${p}/otp/send`, async (request, reply) => {
    const parseResult = SendOtpRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Paramètres invalides",
        details: parseResult.error.flatten(),
      });
    }

    const { email, role } = parseResult.data;

    try {
      const response = await service.sendOtp(email, role);
      return reply.status(200).send(response);
    } catch (err: any) {
      return reply.status(400).send({
        error: "OtpSendError",
        message: err.message || "Impossible d'envoyer le code OTP",
      });
    }
  });

  /**
   * POST /api/auth/otp/verify
   * Vérifie le code. Si valide, renvoie le token et pose le cookie influx_session
   */
  fastify.post(`${p}/otp/verify`, async (request, reply) => {
    const parseResult = VerifyOtpRequestSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Paramètres invalides pour la vérification OTP",
        details: parseResult.error.flatten(),
      });
    }

    try {
      const result = await service.verifyOtp(parseResult.data);

      // Pose du cookie de session (D37 : influx_session, httpOnly, sameSite=lax)
      setSessionCookie(reply, result.token);

      return reply.status(200).send({
        success: true,
        token: result.token,
        user: result.user,
        account: result.account,
      });
    } catch (err: any) {
      return reply.status(400).send({
        error: "OtpVerificationError",
        message: err.message || "Code invalide ou expiré",
      });
    }
  });

  /**
   * GET /api/auth/me
   * Renvoie l'utilisateur connecté depuis le cookie de session
   */
  fastify.get(`${p}/me`, async (request, reply) => {
    const token = extractSessionToken(request);

    if (!token) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Non authentifié : cookie de session manquant",
      });
    }

    const session = await service.getSession(token);
    if (!session) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Session invalide ou expirée",
      });
    }

    return reply.status(200).send({
      user: session.user,
      account: session.account,
    });
  });

  /**
   * POST /api/auth/backoffice/login
   * Connexion Backoffice : email, mot de passe, code TOTP (000000 ou 123456)
   * Rôle agent ou admin obligatoire
   */
  fastify.post(`${p}/backoffice/login`, async (request, reply) => {
    const body = (request.body as any) || {};
    const email = body.email;
    const password = body.password;
    const code = body.code || body.totpCode || body.totp;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Adresse e-mail invalide",
      });
    }

    if (!code || typeof code !== "string") {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Code TOTP manquant ou invalide",
      });
    }

    try {
      const result = await service.loginBackoffice({
        email,
        password,
        code,
      });

      // Pose du cookie de session backoffice (D37 : 8h max, httpOnly, sameSite)
      setSessionCookie(reply, result.token, 8 * 60 * 60);

      return reply.status(200).send({
        success: true,
        token: result.token,
        user: result.user,
        account: result.account,
      });
    } catch (err: any) {
      const message = err.message || "Échec de l'authentification backoffice";
      const isForbidden = message.includes("Accès refusé");
      return reply.status(isForbidden ? 403 : 401).send({
        error: isForbidden ? "Forbidden" : "BackofficeAuthError",
        message,
      });
    }
  });

  /**
   * POST /api/auth/logout
   * Déconnexion et révocation de session
   */
  fastify.post(`${p}/logout`, async (request, reply) => {
    const token = extractSessionToken(request);
    if (token) {
      await service.logout(token);
    }
    clearSessionCookie(reply);
    return reply
      .status(200)
      .send({ success: true, message: "Déconnexion réussie" });
  });
};

export default authRoutes;

import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastify, { type FastifyInstance } from "fastify";
import { devRoutes } from "./routes/dev-routes";
import { authRoutes } from "./routes/auth-routes";
import { leadRoutes } from "./routes/lead-routes";
import { brandProfileRoutes } from "./routes/brand-profile-routes";
import { creatorProfileRoutes } from "./routes/creator-profile-routes";
import { storageRoutes } from "./routes/storage-routes";
import { verificationRoutes } from "./routes/verification-routes";
import { campaignRoutes } from "./routes/campaign-routes";
import { searchRoutes } from "./routes/search-routes";

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "@influx/contracts";

// Auto-chargement du fichier .env local (règles 9 & 10 de la skill env-secrets)
try {
  if (typeof process.loadEnvFile === "function") {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const candidatePaths = [
      path.resolve(process.cwd(), ".env"),
      path.resolve(process.cwd(), "../../.env"),
      path.resolve(currentDir, "../../.env"),
      path.resolve(currentDir, "../../../.env"),
    ];
    for (const envPath of candidatePaths) {
      if (existsSync(envPath)) {
        process.loadEnvFile(envPath);
        break;
      }
    }
  }
} catch {
  // Ignorer si les variables sont déjà injectées par l'environnement d'exécution (Railway, CI, etc.)
}

const EnvSchema = z.object({
  INFLUX_ENV: z
    .enum(["development", "test", "staging", "production"])
    .default("development"),
  SESSION_COOKIE_SECRET: z
    .string()
    .min(32, "SESSION_COOKIE_SECRET must be at least 32 characters long"),
  PORT: z.coerce.number().default(4000),
  ALLOWED_ORIGINS: z.string().optional(),
});

export function getValidatedEnv() {
  const env = {
    INFLUX_ENV:
      process.env.INFLUX_ENV ||
      (process.env.NODE_ENV === "production" ? "production" : "development"),
    SESSION_COOKIE_SECRET:
      process.env.SESSION_COOKIE_SECRET ||
      "influx-default-cookie-secret-min-32-chars-long!",
    PORT: process.env.PORT || 4000,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  };

  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues.map((i) => i.message).join(", ");
    throw new Error(
      `[FATAL] Configuration environnement invalide (env-secrets) : ${errorDetails}`,
    );
  }
  return parsed.data;
}

export interface ServerOptions {
  logger?: boolean;
}

export function createApp(options: ServerOptions = {}): FastifyInstance {
  const validatedEnv = getValidatedEnv();

  const app = fastify({
    logger: options.logger ?? false,
  });

  // CORS config for frontend apps (Web on 3000/3001, Backoffice on 3002, or Railway domains)
  const allowedOrigins = validatedEnv.ALLOWED_ORIGINS
    ? validatedEnv.ALLOWED_ORIGINS.split(",").map((s) => s.trim())
    : true;

  app.register(fastifyCors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // Cookie plugin for session handling (A1, A1b)
  app.register(fastifyCookie, {
    secret: validatedEnv.SESSION_COOKIE_SECRET,
    hook: "onRequest",
  });

  // Health check
  app.get("/health", async (_request, reply) => {
    return reply.status(200).send({
      status: "ok",
      service: "influx-api",
      timestamp: new Date().toISOString(),
    });
  });

  // Root route for sanity check
  app.get("/", async (_request, reply) => {
    return reply.status(200).send({
      status: "ok",
      service: "influx-api",
      message: "INFLUX API Mock Server is running",
      timestamp: new Date().toISOString(),
    });
  });

  // Register routes
  app.register(devRoutes);
  app.register(authRoutes);
  app.register(leadRoutes);
  app.register(brandProfileRoutes);
  app.register(creatorProfileRoutes);
  app.register(storageRoutes);
  app.register(verificationRoutes);
  app.register(campaignRoutes);
  app.register(searchRoutes);

  return app;
}

// Auto-start when executed directly
if (
  process.argv[1]?.endsWith("server.ts") ||
  process.argv[1]?.endsWith("server.js")
) {
  const port = Number(process.env.PORT) || 4000;
  const app = createApp({ logger: true });

  app.listen({ port, host: "0.0.0.0" }, (err, address) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    console.log(`[INFLUX API] Mock server running at ${address}`);
  });
}

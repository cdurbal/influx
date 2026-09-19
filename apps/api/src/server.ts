import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastify, { type FastifyInstance } from "fastify";
import { devRoutes } from "./routes/dev-routes";

export interface ServerOptions {
  logger?: boolean;
}

export function createApp(options: ServerOptions = {}): FastifyInstance {
  const app = fastify({
    logger: options.logger ?? false,
  });

  // CORS config for frontend apps
  app.register(fastifyCors, {
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  // Cookie plugin for session handling
  app.register(fastifyCookie, {
    secret:
      process.env.COOKIE_SECRET ||
      "influx-mock-cookie-secret-min-32-chars-long!",
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

  // Register dev control routes
  app.register(devRoutes);

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

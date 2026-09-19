import { type FastifyInstance } from "fastify";
import { MockStore } from "../mocks/mock-store";

export async function devRoutes(fastify: FastifyInstance): Promise<void> {
  const store = MockStore.getInstance();

  fastify.get("/api/dev/state", async (_request, reply) => {
    return reply.status(200).send({
      ok: true,
      state: store.dump(),
    });
  });

  fastify.post("/api/dev/reset", async (request, reply) => {
    const body = request.body as
      | { empty?: boolean; snapshot?: Parameters<typeof store.reset>[0] }
      | undefined;
    if (body?.empty) {
      store.reset({ empty: true });
    } else if (body?.snapshot) {
      store.reset(body.snapshot);
    } else {
      store.reset();
    }

    return reply.status(200).send({
      ok: true,
      message: "Mock store reset successfully",
    });
  });
}

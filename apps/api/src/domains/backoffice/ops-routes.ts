// Read routes of the "Santé technique" screen of the backoffice (docs/mvp/02 §20.5, "Écran « Santé
// technique »"; 15 RG165; 21 §J9 point 9, EC-J9-5; 03 §6.2; migration 0148). Backoffice surface; the
// aal2 guard of server.ts runs first, then each handler reads through withBackofficeSession().
// ADMINS ONLY, READ ONLY: an agent's attempt is refused AND journaled (backoffice.action_refused
// {ops.read_health}, 05 CA63) and answers 403 like every admin screen; the masking of the screen is
// never the control, and the database holds the same line (EXECUTE of influx_admin alone on the
// functions it calls). No route writes anything: classifying an error group is not part of J9.
// - GET /v1/bo/ops/status: the probe and its availability, the worker, the periodic tasks, the open
//   technical alerts (15 RG165);
// - GET /v1/bo/ops/errors?state=&source=: the error groups of one state (open by default);
// - GET /v1/bo/ops/errors/:id: one group and its kept occurrences; unknown: 404;
// - GET /v1/bo/ops/traffic?window=: calls per minute, p95 and 5xx per route over an hour, a day or a
//   week, the histograms added up over every instance (02 §20.5);
// - GET /v1/bo/ops/processes: the processes and the connections of the base.
// Every answer is `Cache-Control: no-store`. Nothing of 02 §20.8 is in an answer: route models,
// normalised messages, cleaned stacks, replica identifiers, account uuids.
import {
  opsErrorDetailResponseSchema,
  opsErrorParamsSchema,
  opsErrorsQuerySchema,
  opsErrorsResponseSchema,
  opsProcessesResponseSchema,
  opsStatusResponseSchema,
  opsTrafficQuerySchema,
  opsTrafficResponseSchema,
  type OpsErrorDetailResponse,
  type OpsErrorParams,
  type OpsErrorsQuery,
  type OpsErrorsResponse,
  type OpsProcessesResponse,
  type OpsStatusResponse,
  type OpsTrafficQuery,
  type OpsTrafficResponse,
} from "@influx/contracts/backoffice-ops";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../db/index.ts";
import { ApiError } from "../../platform/errors.ts";
import { withBackofficeSession } from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import { adminOnly, unlessRefused } from "./actions-routes.ts";
import {
  readErrorGroup,
  readErrorGroups,
  readOpsStatus,
  readProcesses,
  readTraffic,
} from "./ops-health.ts";

export type BackofficeOpsDependencies = { database: ApiDatabase };

export function registerBackofficeOpsRoutes(
  app: IdentityApp,
  dependencies: BackofficeOpsDependencies,
): void {
  const { database } = dependencies;

  /** The read of an admin, in the session of the request; an agent is refused and journaled. */
  async function asAdmin<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    read: (tx: Transaction) => Promise<T>,
  ): Promise<T> {
    void reply.header("cache-control", "no-store");
    return unlessRefused(
      await withBackofficeSession(database, request, reply, (tx, context) =>
        adminOnly(tx, context, "ops.read_health", () => read(tx)),
      ),
    );
  }

  app.get(
    "/v1/bo/ops/status",
    { schema: { response: { 200: opsStatusResponseSchema } } },
    (request, reply): Promise<OpsStatusResponse> =>
      asAdmin(request, reply, readOpsStatus),
  );

  app.get(
    "/v1/bo/ops/errors",
    {
      schema: {
        querystring: opsErrorsQuerySchema,
        response: { 200: opsErrorsResponseSchema },
      },
    },
    (request, reply): Promise<OpsErrorsResponse> => {
      const { state, source } = request.query as OpsErrorsQuery;
      return asAdmin(request, reply, (tx) =>
        readErrorGroups(tx, state, source ?? null),
      );
    },
  );

  app.get(
    "/v1/bo/ops/errors/:id",
    {
      schema: {
        params: opsErrorParamsSchema,
        response: { 200: opsErrorDetailResponseSchema },
      },
    },
    async (request, reply): Promise<OpsErrorDetailResponse> => {
      const groupId = (request.params as OpsErrorParams).id.toLowerCase();
      const detail = await asAdmin(request, reply, (tx) =>
        readErrorGroup(tx, groupId),
      );
      if (detail === null) {
        throw new ApiError("not_found");
      }
      return detail;
    },
  );

  app.get(
    "/v1/bo/ops/traffic",
    {
      schema: {
        querystring: opsTrafficQuerySchema,
        response: { 200: opsTrafficResponseSchema },
      },
    },
    (request, reply): Promise<OpsTrafficResponse> => {
      const { window } = request.query as OpsTrafficQuery;
      return asAdmin(request, reply, (tx) => readTraffic(tx, window));
    },
  );

  app.get(
    "/v1/bo/ops/processes",
    { schema: { response: { 200: opsProcessesResponseSchema } } },
    (request, reply): Promise<OpsProcessesResponse> =>
      asAdmin(request, reply, readProcesses),
  );
}

// Routes of the registry sources of the brand's registration (docs/mvp/06 RG52, RG101; D79 (12);
// 15 RG110; 18 T14; jalons/l2e/modele.md §6; l2e/registres.md; commit 15). Backoffice surface; the aal2
// guard of server.ts runs first, then each handler reads and writes through withBackofficeSession().
// - GET /v1/bo/verification/registry-sources        every source, the inactive ones too: agent and admin
//                                                   (an agent reads the register he consults by hand)
// - PUT /v1/bo/verification/registry-sources/:id    an administrator only: name, `https` page, day of the
//                                                   check by hand, activation; the former and the new
//                                                   value are journaled by the database (RG101)
// The write is the database's (0224): it refuses an agent and an unknown source alike (42501), so the API
// asks the role to tell them apart. The agent's attempt is refused 403 and NOT journaled: the closed
// list of `backoffice.record_refused_action()` has no code for it (EC-L2E-15-3). One active source per
// country (409 `active_source_exists`: deactivate the first one before). Every answer is
// `Cache-Control: no-store`. Nothing is logged here.
import {
  updateVerificationRegistrySourceBodySchema,
  updateVerificationRegistrySourceResponseSchema,
  verificationRegistrySourceParamsSchema,
  verificationRegistrySourcesResponseSchema,
  type UpdateVerificationRegistrySourceBody,
  type UpdateVerificationRegistrySourceResponse,
  type VerificationRegistrySourceParams,
  type VerificationRegistrySourcesResponse,
} from "@influx/contracts/verification";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiDatabase, Transaction } from "../../db/index.ts";
import { sqlConstraintOf, sqlStateOf } from "../../db/sql-state.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import {
  withBackofficeSession,
  type BackofficeContext,
} from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import { isForbidden } from "./action-guards.ts";
import {
  listRegistrySources,
  readRegistrySourceById,
  setRegistrySource,
} from "./verification-registry/repository.ts";

export const REGISTRY_SOURCES_ROUTE = "/v1/bo/verification/registry-sources";

export type VerificationRegistryRoutesDependencies = {
  database: ApiDatabase;
};

/** The field of the body each check constraint of 0221 guards. */
const FIELD_OF_CONSTRAINT: Readonly<Record<string, string>> = {
  registry_sources_name: "name",
  registry_sources_url: "url",
};

/** The refusal of the door as the API answers it; anything else, unchanged (a 500). */
function refusalOf(error: unknown, role: BackofficeContext["role"]): unknown {
  if (isForbidden(error)) {
    // an agent is refused the write; an unknown source is an unknown address for an administrator
    return new ApiError(role === "admin" ? "not_found" : "forbidden");
  }
  switch (sqlStateOf(error)) {
    case "22023":
      return new RequestValidationError([
        { path: "checkedOn", issue: "invalid_checked_on" },
      ]);
    case "23514": {
      const constraint = sqlConstraintOf(error);
      const field =
        constraint === null ? undefined : FIELD_OF_CONSTRAINT[constraint];
      return field === undefined
        ? error
        : new RequestValidationError([{ path: field, issue: "invalid" }]);
    }
    case "23505":
      return new ApiError("conflict", [
        { path: "source", issue: "active_source_exists" },
      ]);
    default:
      return error;
  }
}

export function registerVerificationRegistryRoutes(
  app: IdentityApp,
  dependencies: VerificationRegistryRoutesDependencies,
): void {
  const { database } = dependencies;

  function inSession<T>(
    request: FastifyRequest,
    reply: FastifyReply,
    work: (tx: Transaction, context: BackofficeContext) => Promise<T>,
  ): Promise<T> {
    void reply.header("cache-control", "no-store");
    return withBackofficeSession(database, request, reply, work);
  }

  app.get(
    REGISTRY_SOURCES_ROUTE,
    {
      schema: { response: { 200: verificationRegistrySourcesResponseSchema } },
    },
    async (request, reply): Promise<VerificationRegistrySourcesResponse> =>
      inSession(request, reply, async (tx) =>
        verificationRegistrySourcesResponseSchema.parse({
          sources: await listRegistrySources(tx),
        }),
      ),
  );

  app.put(
    `${REGISTRY_SOURCES_ROUTE}/:id`,
    {
      schema: {
        params: verificationRegistrySourceParamsSchema,
        body: updateVerificationRegistrySourceBodySchema,
        response: { 200: updateVerificationRegistrySourceResponseSchema },
      },
    },
    async (
      request,
      reply,
    ): Promise<UpdateVerificationRegistrySourceResponse> => {
      const id = (
        request.params as VerificationRegistrySourceParams
      ).id.toLowerCase();
      const body = request.body as UpdateVerificationRegistrySourceBody;
      return inSession(request, reply, async (tx, context) => {
        try {
          // a savepoint: the refusal of the door leaves the transaction readable
          await tx.transaction((savepoint) =>
            setRegistrySource(savepoint, id, body),
          );
        } catch (error) {
          throw refusalOf(error, context.role);
        }
        const source = await readRegistrySourceById(tx, id);
        if (source === null) {
          throw new ApiError("not_found");
        }
        return updateVerificationRegistrySourceResponseSchema.parse({ source });
      });
    },
  );
}

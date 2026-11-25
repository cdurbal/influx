// Account correction route of the backoffice v0 (docs/mvp/05 §K RG108; 15 §F, RG110; 03 §3.1).
// Backoffice surface; the aal2 guard of server.ts runs first. The rules are the database's (0132):
// - POST /v1/bo/accounts/:id/corrections (RG108): status, country, language. Agent and admin.
// Unknown, internal, own and inactive targets answer the same 404 (18 T14.3, T14.4). `Cache-Control:
// no-store`.
import {
  accountActionParamsSchema,
  correctionRequestSchema,
  correctionResponseSchema,
  type AccountActionParams,
  type CorrectionRequest,
  type CorrectionResponse,
} from "@influx/contracts/backoffice-actions";
import { sqlStateOf } from "../../db/sql-state.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import { withBackofficeSession } from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import { correctMemberAccount } from "./sync-replay/repository.ts";
import {
  isForbidden,
  type BackofficeActionsDependencies,
} from "./action-guards.ts";

export function registerCorrectionRoutes(
  app: IdentityApp,
  dependencies: BackofficeActionsDependencies,
): void {
  const { database } = dependencies;

  app.post(
    "/v1/bo/accounts/:id/corrections",
    {
      schema: {
        params: accountActionParamsSchema,
        body: correctionRequestSchema,
        response: { 200: correctionResponseSchema },
      },
    },
    async (request, reply): Promise<CorrectionResponse> => {
      void reply.header("cache-control", "no-store");
      const accountId = (
        request.params as AccountActionParams
      ).id.toLowerCase();
      const body = request.body as CorrectionRequest;
      try {
        const changed = await withBackofficeSession(
          database,
          request,
          reply,
          (tx) =>
            correctMemberAccount(tx, accountId, {
              reasonCode: body.reasonCode,
              declaredStatus: body.declaredStatus ?? null,
              countryCode: body.countryCode ?? null,
              preferredLanguage: body.preferredLanguage ?? null,
              comment: body.comment ?? null,
            }),
        );
        return { changed };
      } catch (error) {
        if (isForbidden(error)) {
          // unknown, internal, own or inactive: the same answer (T14.3, T14.4)
          throw new ApiError("not_found");
        }
        switch (sqlStateOf(error)) {
          case "23514":
            // a blocked country (RG8), an individual advertiser (RG22)
            throw new ApiError("conflict");
          case "23503":
            throw new RequestValidationError([
              { path: "", issue: "unknown_reference" },
            ]);
          default:
            throw error;
        }
      }
    },
  );
}

// Apollo settings route of the backoffice v0 (docs/mvp/05 §K RG84; 15 §F, RG110; 03 §3.1).
// Backoffice surface; the aal2 guard of server.ts runs first.
// - GET /v1/bo/settings/apollo: admin only, an agent's attempt refused AND journaled (CA63,
//   backoffice.action_refused). `Cache-Control: no-store`.
import {
  apolloSettingsResponseSchema,
  type ApolloSettingsResponse,
} from "@influx/contracts/backoffice-actions";
import { withBackofficeSession } from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import { readApolloSettings } from "./alerts/repository.ts";
import { apolloSettingOf } from "./apollo-settings.ts";
import {
  adminOnly,
  unlessRefused,
  type BackofficeActionsDependencies,
} from "./action-guards.ts";

export function registerApolloSettingsRoutes(
  app: IdentityApp,
  dependencies: BackofficeActionsDependencies,
): void {
  const { database } = dependencies;

  app.get(
    "/v1/bo/settings/apollo",
    { schema: { response: { 200: apolloSettingsResponseSchema } } },
    async (request, reply): Promise<ApolloSettingsResponse> => {
      void reply.header("cache-control", "no-store");
      const rows = unlessRefused(
        await withBackofficeSession(database, request, reply, (tx, context) =>
          adminOnly(tx, context, "leads.read_apollo_settings", () =>
            readApolloSettings(tx),
          ),
        ),
      );
      return {
        settings: rows.flatMap((row) => {
          const setting = apolloSettingOf(row.key, row.value);
          return setting === null
            ? []
            : [
                {
                  setting,
                  updatedAt: row.updatedAt,
                  updatedBy: row.updatedBy,
                },
              ];
        }),
      };
    },
  );
}

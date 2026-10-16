// "Mes données": the export downloaded in the member space (runbook demandes-rgpd §4, delivery decided
// by expert-cybersecurite on 2026-10-14; 15 RG82; 21 §J8 point 6, commit 8). Web surface only,
// member session required; the account is always the session's (no account id in a path). Exempt
// from the terms gate, as the deposit (A3: a right of the person survives a refused version).
// - GET /v1/me/data-export: the latest export, its deadline and the downloads left, or null.
// - POST /v1/me/data-export/:id/download: one download, after a fresh code for data_export consumed
//   by THIS download (403 reauthentication_required otherwise); 3 downloads at most, 7 days at most
//   (410 export_unavailable beyond); an export that is not the member's answers 404. The file is
//   the database's text, carried as is in a JSON envelope (the relay of web forwards no
//   Content-Disposition, 03 PP-10): the screen saves exactly these characters. `no-store`,
//   `nosniff`, and `attachment` for any other client.
import {
  dataExportDownloadResponseSchema,
  dataExportIdParamsSchema,
  dataExportStateResponseSchema,
  type DataExportDownloadResponse,
  type DataExportIdParams,
  type DataExportStateResponse,
} from "@influx/contracts/account";
import type { ApiDatabase } from "../../../db/index.ts";
import { sqlStateOf } from "../../../db/sql-state.ts";
import { ApiError } from "../../../platform/errors.ts";
import { withMemberSession } from "../../identity/member-session.ts";
import { requireFreshCode } from "../../identity/reauthentication.ts";
import type { IdentityApp } from "../../identity/routes.ts";
import {
  downloadOwnExport,
  EXPORT_UNAVAILABLE,
  readOwnExport,
} from "./repository.ts";

export type DataExportRoutesDependencies = {
  database: ApiDatabase;
  now: () => Date;
};

/** The name the screen saves the file under: the day of the download, UTC. */
export function exportFileName(at: Date): string {
  return `influx-data-export-${at.toISOString().slice(0, 10)}.json`;
}

export function registerDataExportRoutes(
  app: IdentityApp,
  dependencies: DataExportRoutesDependencies,
): void {
  const { database, now } = dependencies;

  app.get(
    "/v1/me/data-export",
    { schema: { response: { 200: dataExportStateResponseSchema } } },
    async (request, reply): Promise<DataExportStateResponse> => {
      void reply.header("cache-control", "no-store");
      return withMemberSession(
        database,
        request,
        reply,
        now,
        async (tx) => {
          const row = await readOwnExport(tx);
          return {
            export:
              row === null
                ? null
                : {
                    id: row.exportId,
                    requestId: row.requestId,
                    publishedAt: row.publishedAt,
                    expiresAt: row.expiresAt,
                    downloadsLeft: row.downloadsLeft,
                    available: row.available,
                  },
          };
        },
        { terms: "exempt" },
      );
    },
  );

  app.post(
    "/v1/me/data-export/:id/download",
    {
      schema: {
        params: dataExportIdParamsSchema,
        response: { 200: dataExportDownloadResponseSchema },
      },
    },
    async (request, reply): Promise<DataExportDownloadResponse> => {
      void reply.header("cache-control", "no-store");
      void reply.header("x-content-type-options", "nosniff");
      const exportId = (request.params as DataExportIdParams).id.toLowerCase();
      const at = now();
      let downloaded;
      try {
        downloaded = await withMemberSession(
          database,
          request,
          reply,
          now,
          (tx, context) =>
            requireFreshCode(() =>
              downloadOwnExport(tx, context.sessionId, exportId),
            ),
          { terms: "exempt" },
        );
      } catch (error) {
        if (sqlStateOf(error) === EXPORT_UNAVAILABLE) {
          throw new ApiError("export_unavailable");
        }
        throw error;
      }
      if (downloaded === null) {
        throw new ApiError("not_found");
      }
      const fileName = exportFileName(at);
      void reply.header(
        "content-disposition",
        `attachment; filename="${fileName}"`,
      );
      return {
        export: {
          id: exportId,
          fileName,
          content: downloaded.content,
          sha256: downloaded.sha256,
          sizeBytes: downloaded.sizeBytes,
          downloadsLeft: downloaded.downloadsLeft,
        },
      };
    },
  );
}

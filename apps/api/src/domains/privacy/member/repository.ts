// The member's own export, read and downloaded under the member's role (runbook demandes-rgpd §4,
// expert-cybersecurite 2026-10-14; J8 commit 8; migration 0136). privacy.data_exports grants NOTHING
// to a member role: two SECURITY DEFINER functions check that the export is the session account's,
// and the download consumes a fresh code for data_export each time (05 RG57).
import { sql } from "drizzle-orm";
import type { Transaction } from "../../../db/index.ts";

const ISO_UTC = 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';

export type OwnExportRow = {
  exportId: string;
  requestId: string;
  publishedAt: string;
  expiresAt: string;
  downloadsLeft: number;
  available: boolean;
};

/** The session account's latest export, or null. */
export async function readOwnExport(
  tx: Transaction,
): Promise<OwnExportRow | null> {
  const rows = await tx.execute<{
    export_id: string;
    request_id: string;
    published_at: string;
    expires_at: string;
    downloads_left: number;
    available: boolean;
  }>(
    sql`select export_id::text as export_id, request_id::text as request_id,
               to_char(published_at at time zone 'UTC', ${ISO_UTC}) as published_at,
               to_char(expires_at at time zone 'UTC', ${ISO_UTC}) as expires_at,
               downloads_left, available
          from privacy.read_own_export()`,
  );
  const row = rows[0];
  return row === undefined
    ? null
    : {
        exportId: row.export_id,
        requestId: row.request_id,
        publishedAt: row.published_at,
        expiresAt: row.expires_at,
        downloadsLeft: Number(row.downloads_left),
        available: row.available,
      };
}

export type DownloadedExport = {
  content: string;
  sha256: string;
  sizeBytes: number;
  downloadsLeft: number;
};

/** SQLSTATE of an export no longer downloadable: expired, purged or downloaded three times (0136). */
export const EXPORT_UNAVAILABLE = "P0002";

/**
 * One download of an export of the session account (0136): null when it is not one; P0002 once it
 * is no longer downloadable; 55000 without a fresh code for data_export on this session, consumed
 * otherwise. The register line is written by the function.
 */
export async function downloadOwnExport(
  tx: Transaction,
  sessionId: string,
  exportId: string,
): Promise<DownloadedExport | null> {
  const rows = await tx.execute<{
    content: string;
    sha256: string;
    size_bytes: number;
    downloads_left: number;
  }>(
    sql`select content, encode(sha256, 'hex') as sha256, size_bytes, downloads_left
          from privacy.download_own_export(${sessionId}::uuid, ${exportId}::uuid)`,
  );
  const row = rows[0];
  return row === undefined
    ? null
    : {
        content: row.content,
        sha256: row.sha256,
        sizeBytes: Number(row.size_bytes),
        downloadsLeft: Number(row.downloads_left),
      };
}

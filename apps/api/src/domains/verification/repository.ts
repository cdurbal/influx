// SQL of the creator's own verification requests (docs/mvp/08 RG11 to RG14, RG21 to RG23, RG56, RG60;
// jalons/l2e/modele.md §3, §4 "Créateur"; 0221, 0222; jalons/l2e commit 12). Every statement runs in
// the member's transaction, as influx_creator: the account is the one of the transaction context
// (`influx.current_account_id()`), never a parameter, and the policies of 0221 bind each read to it.
// - The reads select the COLUMNS the creator is granted (0221 §12): no lock, no agent, no deadline, no
//   internal comment, no re-examination, no escalation, no finding, no key and no checksum of a piece.
// - The writes are the four doors of 0222 (`verification.open_own_request()`, `renew_own_code()`,
//   `submit_own_request()`, `cancel_own_request()`): RG14, RG60 and RG23 live there, once. A refusal
//   of a door is a database error, said by its SQLSTATE, message and DETAIL (service.ts reads it).
// Nothing is logged here, and nothing typed by an agent is read.
import { sql } from "drizzle-orm";
import type { Transaction } from "../../db/index.ts";

const ISO_UTC = 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';

/** The network lines of the creator that can be verified: one per network (EC-L2E-12-1). */
export type OwnVerifiableLine = { id: string; networkCode: string };

export type OwnBadgeRow = {
  socialAccountId: string;
  level: string;
  networkCode: string;
  state: string;
  grantedAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  evidenceSource: string;
  expiresAt: string | null;
};

export type OwnRequestRow = {
  id: string;
  socialAccountId: string | null;
  networkCode: string;
  level: string;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  decidedAt: string | null;
  rejectionReasonCode: string | null;
  memberMessage: string | null;
};

export type OwnCodeRow = { requestId: string; code: string; expiresAt: string };

export type OwnEvidenceRow = {
  id: string;
  requestId: string;
  state: string;
  createdAt: string;
  width: number | null;
  height: number | null;
  byteSize: number | null;
};

/** The instant the answer is as of: the database's, the one the codes are judged by. */
export async function readVerificationInstant(
  tx: Transaction,
): Promise<string> {
  const rows = await tx.execute<{ as_of: string }>(
    sql`select to_char(now() at time zone 'UTC', ${ISO_UTC}) as as_of`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("the database answered no instant");
  }
  return row.as_of;
}

/**
 * The lines the creator can ask a verification on: one per network. Two lines of one network are
 * allowed (07 RG42) but the member contract names a line by its network (never by an identifier), so
 * the main line of the network answers for it, else the oldest (EC-L2E-12-1).
 */
export async function readOwnVerifiableLines(
  tx: Transaction,
): Promise<OwnVerifiableLine[]> {
  const rows = await tx.execute<{ id: string; network_code: string }>(
    sql`select distinct on (l.network_code) l.id::text as id, l.network_code::text as network_code
          from profiles.creator_social_accounts l
         where l.account_id = (select influx.current_account_id())
         order by l.network_code, l.is_primary desc, l.created_at, l.id`,
  );
  return rows.map((row) => ({ id: row.id, networkCode: row.network_code }));
}

/** The badges the creator reads on his lines: the displayed states only (08 RG70, RG76). */
export async function readOwnBadges(tx: Transaction): Promise<OwnBadgeRow[]> {
  const rows = await tx.execute<{
    social_account_id: string;
    level: string;
    network_code: string;
    state: string;
    granted_at: string;
    period_start: string | null;
    period_end: string | null;
    evidence_source: string;
    expires_at: string | null;
  }>(
    sql`select b.social_account_id::text as social_account_id, b.level::text as level,
               b.network_code::text as network_code, b.state::text as state,
               to_char(b.granted_at at time zone 'UTC', ${ISO_UTC}) as granted_at,
               to_char(b.observed_period_start, 'YYYY-MM-DD') as period_start,
               to_char(b.observed_period_end, 'YYYY-MM-DD') as period_end,
               b.evidence_source,
               to_char(b.expires_at at time zone 'UTC', ${ISO_UTC}) as expires_at
          from verification.badges b
         where b.account_id = (select influx.current_account_id())
           and b.social_account_id is not null
           and b.state in ('active', 'to_refresh', 'to_reconfirm')
         order by b.network_code, b.level, b.granted_at desc`,
  );
  return rows.map((row) => ({
    socialAccountId: row.social_account_id,
    level: row.level,
    networkCode: row.network_code,
    state: row.state,
    grantedAt: row.granted_at,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    evidenceSource: row.evidence_source,
    expiresAt: row.expires_at,
  }));
}

type RequestSqlRow = {
  id: string;
  social_account_id: string | null;
  network_code: string;
  level: string;
  status: string;
  created_at: string;
  submitted_at: string | null;
  decided_at: string | null;
  rejection_reason_code: string | null;
  member_message: string | null;
};

function requestRowOf(row: RequestSqlRow): OwnRequestRow {
  return {
    id: row.id,
    socialAccountId: row.social_account_id,
    networkCode: row.network_code,
    level: row.level,
    status: row.status,
    createdAt: row.created_at,
    submittedAt: row.submitted_at,
    decidedAt: row.decided_at,
    rejectionReasonCode: row.rejection_reason_code,
    memberMessage: row.member_message,
  };
}

/**
 * The request of the creator the screen shows on each (line, level): the latest one that was not
 * withdrawn, unless it was granted (the badge says so). An open one is always the latest. A withdrawn
 * request is never shown; an older refusal stays visible, since the delay of RG60 runs from it.
 */
export async function readOwnCurrentRequests(
  tx: Transaction,
): Promise<OwnRequestRow[]> {
  const rows = await tx.execute<RequestSqlRow>(
    sql`select * from (
          select distinct on (r.social_account_id, r.level)
                 r.id::text as id, r.social_account_id::text as social_account_id,
                 r.network_code::text as network_code, r.level::text as level,
                 r.status::text as status,
                 to_char(r.created_at at time zone 'UTC', ${ISO_UTC}) as created_at,
                 to_char(r.submitted_at at time zone 'UTC', ${ISO_UTC}) as submitted_at,
                 to_char(r.decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at,
                 r.rejection_reason_code, r.member_message
            from verification.verification_requests r
           where r.account_id = (select influx.current_account_id())
             and r.population = 'creator' and r.status <> 'cancelled'
           order by r.social_account_id, r.level, r.created_at desc, r.id desc
        ) latest
         where latest.status <> 'approved'
         order by latest.network_code, latest.level`,
  );
  return rows.map(requestRowOf);
}

/** One request of the creator, whatever its status: what a write answers. Null: not his, or unknown. */
export async function readOwnRequest(
  tx: Transaction,
  requestId: string,
): Promise<OwnRequestRow | null> {
  const rows = await tx.execute<RequestSqlRow>(
    sql`select r.id::text as id, r.social_account_id::text as social_account_id,
               r.network_code::text as network_code, r.level::text as level,
               r.status::text as status,
               to_char(r.created_at at time zone 'UTC', ${ISO_UTC}) as created_at,
               to_char(r.submitted_at at time zone 'UTC', ${ISO_UTC}) as submitted_at,
               to_char(r.decided_at at time zone 'UTC', ${ISO_UTC}) as decided_at,
               r.rejection_reason_code, r.member_message
          from verification.verification_requests r
         where r.id = ${requestId}::uuid
           and r.account_id = (select influx.current_account_id())
           and r.population = 'creator'`,
  );
  const row = rows[0];
  return row === undefined ? null : requestRowOf(row);
}

/** The live codes of the creator's own requests: not revoked, not expired (08 RG22, RG23). */
export async function readOwnLiveCodes(tx: Transaction): Promise<OwnCodeRow[]> {
  const rows = await tx.execute<{
    request_id: string;
    code: string;
    expires_at: string;
  }>(
    sql`select c.request_id::text as request_id, c.code,
               to_char(c.expires_at at time zone 'UTC', ${ISO_UTC}) as expires_at
          from verification.ownership_codes c
         where c.account_id = (select influx.current_account_id())
           and c.kind = 'network' and c.revoked_at is null and c.expires_at > now()`,
  );
  return rows.map((row) => ({
    requestId: row.request_id,
    code: row.code,
    expiresAt: row.expires_at,
  }));
}

/** The metadata of the creator's own pieces still held (EC-L2E-7): never a key, never the bytes. */
export async function readOwnEvidence(
  tx: Transaction,
): Promise<OwnEvidenceRow[]> {
  const rows = await tx.execute<{
    id: string;
    request_id: string;
    state: string;
    created_at: string;
    width: number | null;
    height: number | null;
    byte_size: string | number | null;
  }>(
    sql`select e.id::text as id, e.request_id::text as request_id, e.state::text as state,
               to_char(e.created_at at time zone 'UTC', ${ISO_UTC}) as created_at,
               e.width, e.height, e.byte_size
          from verification.evidence_files e
         where e.account_id = (select influx.current_account_id())
           and e.state in ('pending', 'active')
         order by e.created_at, e.id`,
  );
  return rows.map((row) => ({
    id: row.id,
    requestId: row.request_id,
    state: row.state,
    createdAt: row.created_at,
    width: row.width,
    height: row.height,
    byteSize: row.byte_size === null ? null : Number(row.byte_size),
  }));
}

// --- The four doors (0222) -----------------------------------------------------------------------

/** `verification.open_own_request()`: the request of the (line, level), a draft, created or as it was. */
export async function openOwnRequest(
  tx: Transaction,
  socialAccountId: string,
  level: "account_verified" | "audience_verified",
): Promise<{ requestId: string; created: boolean }> {
  const rows = await tx.execute<{ request_id: string; created: boolean }>(
    sql`select request_id::text as request_id, created
          from verification.open_own_request(
                 ${socialAccountId}::uuid, ${level}::verification.badge_level)`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("open_own_request answered no row");
  }
  return { requestId: row.request_id, created: row.created };
}

/** `verification.renew_own_code()`: a new code on a draft account request, the former one revoked. */
export async function renewOwnCode(
  tx: Transaction,
  requestId: string,
): Promise<void> {
  await tx.execute(
    sql`select code_id from verification.renew_own_code(${requestId}::uuid)`,
  );
}

/** `verification.submit_own_request()`: draft to pending; already pending, nothing is written. */
export async function submitOwnRequest(
  tx: Transaction,
  requestId: string,
): Promise<void> {
  await tx.execute(
    sql`select status from verification.submit_own_request(${requestId}::uuid)`,
  );
}

/** `verification.cancel_own_request()`: draft or pending to cancelled; already cancelled, nothing. */
export async function cancelOwnRequest(
  tx: Transaction,
  requestId: string,
): Promise<void> {
  await tx.execute(
    sql`select status from verification.cancel_own_request(${requestId}::uuid)`,
  );
}

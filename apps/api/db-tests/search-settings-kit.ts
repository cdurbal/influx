// L3G commit 08 — the dual control of the search settings in the database tests (0332; jalons/l3g/08.md;
// l3g/modele.md §7; D84, D38 Q2). The two writers of 0316 now consume a 2V confirmed by ANOTHER admin,
// executed by that confirmer with a fresh second factor (03 PD3 to PD7). These helpers write the 2V
// the way the backoffice will (request_dual_control() by one admin, confirm_dual_control() by the
// other) inside the rolled-back transaction of a test; the writers are then called by the confirmer
// with the session of the request. Used by search-journal-settings.test.ts and
// search-settings-dual-control.test.ts. The test kits that open the switch keep writing the setting
// as the migration role (modele §7): nothing here touches them.
import { accountIdOf } from "@influx/test-kit/db";
import type postgres from "postgres";
import { actAsInternal } from "./support.ts";

type Tx = postgres.TransactionSql;

export const SETTING_ACTION = "search.change_setting";
export const FACET_ACTION = "search.change_facet";
/** One of the four reasons of the writers (modele §7). */
export const SETTING_REASON = "founder_decision";

export const WRITE_SETTING =
  "select search.write_search_setting($1::uuid, $2::uuid, $3::text, $4::text::jsonb, $5::text)::int as version";
export const WRITE_FACET =
  "select search.write_facet_setting($1::uuid, $2::uuid, $3::text, $4::boolean, $5::integer, $6::text, $7::text)::int as version";

const REQUEST =
  "select backoffice.request_dual_control($1::text, $2::text::jsonb, $3::text) as id";
const CONFIRM =
  "select backoffice.confirm_dual_control($1::uuid, $2::uuid, $3::text) as mode";

export const adminA = accountIdOf("admin", "a");
export const adminB = accountIdOf("admin", "b");

/** A fresh backoffice session of an internal account: TOTP proven now (0012 trigger). */
export async function freshSession(tx: Tx, account: string): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (sha256(gen_random_uuid()::text::bytea), ${account}, 'backoffice', 'totp',
            'firefox.linux')
    returning id::text`;
  if (row === undefined) throw new Error("no session");
  return row.id;
}

/** Runs `fn` as admin `account` (aal2 unless said), bound to `session` when given (R, J8S-3). */
export function asAdminOf<T>(
  tx: Tx,
  account: string,
  fn: () => Promise<T>,
  options: { session?: string; aal?: "aal1" | "aal2" } = {},
): Promise<T> {
  return actAsInternal(
    tx,
    "influx_admin",
    {
      accountId: account,
      role: "admin",
      aal: options.aal ?? "aal2",
      ...(options.session === undefined ? {} : { sessionId: options.session }),
    },
    fn,
  );
}

/** Admin `requester` requests the 2V `action` for `payload`; returns its id (throws on a refusal). */
export async function requestChange(
  tx: Tx,
  requester: string,
  action: string,
  payload: Record<string, unknown>,
  reason: string = SETTING_REASON,
): Promise<string> {
  const [row] = await asAdminOf(tx, requester, () =>
    tx.unsafe<{ id: string }[]>(REQUEST, [
      action,
      JSON.stringify(payload),
      reason,
    ]),
  );
  if (row === undefined) throw new Error("no request");
  return row.id;
}

/** Admin `confirmer` confirms `request` with `session` (fresh TOTP); returns the mode. */
export async function confirmChange(
  tx: Tx,
  confirmer: string,
  request: string,
  session: string,
  justification: string | null = null,
): Promise<string> {
  const [row] = await asAdminOf(
    tx,
    confirmer,
    () =>
      tx.unsafe<{ mode: string }[]>(CONFIRM, [session, request, justification]),
    { session },
  );
  if (row === undefined) throw new Error("no confirmation");
  return row.mode;
}

/**
 * A 2V of `action` for `payload`, requested by `requester` (admin B by default) and confirmed by its
 * future executor `confirmer` (admin A by default, the peer). Returns the request and the fresh
 * session of the confirmer, the one the writer is then called with.
 */
export async function approvedChange(
  tx: Tx,
  action: string,
  payload: Record<string, unknown>,
  options: { requester?: string; confirmer?: string; reason?: string } = {},
): Promise<{ request: string; session: string }> {
  const confirmer = options.confirmer ?? adminA;
  const request = await requestChange(
    tx,
    options.requester ?? adminB,
    action,
    payload,
    options.reason ?? SETTING_REASON,
  );
  const session = await freshSession(tx, confirmer);
  await confirmChange(tx, confirmer, request, session);
  return { request, session };
}

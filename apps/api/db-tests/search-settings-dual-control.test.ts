// L3G commit 08 — the search settings under a peer's control, 0332 (jalons/l3g/08.md; l3g-fiche.md
// invariant 10; jalons/l3g/modele.md §7; D84, D38 Q2; 03 §1.3 PD3 to PD7; L3ES-2). L3G-T8: the two
// writers of the settings write only by consuming a dual control confirmed by ANOTHER admin, executed
// by that confirmer with a fresh second factor: without a request, with the requester's own
// confirmation, with a request consumed, cancelled or expired, with another payload or reason, in
// aal1, as an agent or a member: refused; the peer: written, versioned, journaled with its 2V. A
// peer only: no request while no other admin can confirm, and the degraded form refused at the
// write. Each case runs in a rolled-back transaction of the local superuser, which acts as the
// admins exactly as apps/api takes the role.
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  adminA,
  adminB,
  approvedChange,
  asAdminOf,
  confirmChange,
  FACET_ACTION,
  freshSession,
  requestChange,
  SETTING_ACTION,
  SETTING_REASON,
  WRITE_FACET,
  WRITE_SETTING,
} from "./search-settings-kit.ts";
import {
  actAsInternal,
  actAsMember,
  localSuperuser,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;

const INSUFFICIENT_PRIVILEGE = "42501";
const INVALID_PARAMETER = "22023";

const agentA = accountIdOf("agent", "a");
const brandA = accountIdOf("advertiser", "a");

const JUSTIFICATION =
  "Single administrator left after the request, change reviewed alone.";

type Parameter = postgres.ParameterOrJSON<never> | null | undefined;
type Outcome<T> =
  | { outcome: "rows"; rows: T[] }
  | { outcome: "error"; code: string; detail: string | undefined };

/** One statement in a savepoint of `tx`: its rows, or its SQLSTATE and detail. */
async function run<T = Record<string, unknown>>(
  tx: Tx,
  statement: string,
  parameters: readonly Parameter[] = [],
): Promise<Outcome<T>> {
  try {
    const rows = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters.map(
          (value) => value ?? null,
        ) as postgres.ParameterOrJSON<never>[],
      ),
    );
    return { outcome: "rows", rows: [...rows] as T[] };
  } catch (error) {
    const found = error as { code?: string; detail?: string };
    return {
      outcome: "error",
      code: found.code ?? "unknown",
      detail: found.detail,
    };
  }
}

function codeOf(outcome: Outcome<unknown>): string {
  return outcome.outcome === "error" ? outcome.code : "ok";
}

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

/** `account` writes setting `key` = `value` with `request`, bound to `session` (aal2 unless said). */
function writeSetting(
  tx: Tx,
  account: string,
  session: string,
  request: string,
  key: string,
  value: unknown,
  options: { reason?: string; aal?: "aal1" | "aal2" } = {},
): Promise<Outcome<{ version: number }>> {
  return asAdminOf(
    tx,
    account,
    () =>
      run<{ version: number }>(tx, WRITE_SETTING, [
        session,
        request,
        key,
        JSON.stringify(value),
        options.reason ?? SETTING_REASON,
      ]),
    { session, aal: options.aal ?? "aal2" },
  );
}

async function valueOf(tx: Tx, key: string): Promise<unknown> {
  const [row] = await tx<{ value: unknown }[]>`
    select value from search.search_settings where key = ${key}`;
  return row?.value;
}

async function consumedAt(tx: Tx, request: string): Promise<string | null> {
  const [row] = await tx<{ consumed: string | null }[]>`
    select consumed_at::text as consumed from backoffice.dual_control_requests where id = ${request}`;
  return row?.consumed ?? null;
}

async function settingsLineCount(tx: Tx): Promise<number> {
  const [row] = await tx<{ n: number }[]>`
    select count(*)::int as n from audit.audit_events where event_type = 'search.settings_changed'`;
  return row?.n ?? 0;
}

/** PD7: deactivates every admin but `account` (no peer left). */
async function onlyAdmin(tx: Tx, account: string): Promise<void> {
  await tx`
    update identity.agent_profiles p
       set is_active = false, deactivated_at = now(), deactivated_by_account_id = ${account}
     where p.account_id <> ${account}
       and p.is_active
       and exists (select 1 from identity.account_roles r
                    where r.account_id = p.account_id and r.role = 'admin')`;
}

/** Moves a 2V request back in time (its guard refuses it: disabled here). */
async function ageRequest(
  tx: Tx,
  request: string,
  seconds: number,
): Promise<void> {
  await tx`alter table backoffice.dual_control_requests disable trigger dual_control_requests_guard_update`;
  await tx`
    update backoffice.dual_control_requests
       set requested_at = requested_at - make_interval(secs => ${seconds}),
           expires_at   = expires_at   - make_interval(secs => ${seconds}),
           created_at   = created_at   - make_interval(secs => ${seconds}),
           confirmed_at = confirmed_at - make_interval(secs => ${seconds})
     where id = ${request}`;
  await tx`alter table backoffice.dual_control_requests enable trigger dual_control_requests_guard_update`;
}

beforeAll(async () => {
  await testDataSet();
});

describe("L3G-T8 the writers of the settings consume a peer's 2V (fiche invariant 10; D84, L3ES-2)", () => {
  it("L3G-T8 refuses both writers without a request (an unknown id), 42501, nothing written", async () => {
    const outcome = await scenario(async (tx) => {
      const lines = await settingsLineCount(tx);
      const session = await freshSession(tx, adminA);
      const setting = await writeSetting(
        tx,
        adminA,
        session,
        randomUUID(),
        "is_open_to_advertisers",
        true,
      );
      const facet = await asAdminOf(
        tx,
        adminA,
        () =>
          run(tx, WRITE_FACET, [
            session,
            randomUUID(),
            "F17",
            false,
            8,
            SETTING_REASON,
            null,
          ]),
        { session },
      );
      return {
        setting: codeOf(setting),
        facet: codeOf(facet),
        open: await valueOf(tx, "is_open_to_advertisers"),
        lines: (await settingsLineCount(tx)) - lines,
      };
    });
    expect(outcome).toEqual({
      setting: INSUFFICIENT_PRIVILEGE,
      facet: INSUFFICIENT_PRIVILEGE,
      open: false,
      lines: 0,
    });
  });

  it("L3G-T8 refuses the same admin: his own confirmation while a peer exists, and his own pending request executed by himself", async () => {
    const outcome = await scenario(async (tx) => {
      const payload = { key: "is_open_to_advertisers", value: true };
      const request = await requestChange(tx, adminA, SETTING_ACTION, payload);
      const session = await freshSession(tx, adminA);
      let confirmation = "ok";
      try {
        await tx.savepoint((savepoint) =>
          confirmChange(savepoint, adminA, request, session, JUSTIFICATION),
        );
      } catch (error) {
        confirmation = (error as { code?: string }).code ?? "unknown";
      }
      const write = await writeSetting(
        tx,
        adminA,
        session,
        request,
        "is_open_to_advertisers",
        true,
      );
      return {
        confirmation,
        write: codeOf(write),
        open: await valueOf(tx, "is_open_to_advertisers"),
        consumed: await consumedAt(tx, request),
      };
    });
    expect(outcome).toEqual({
      confirmation: INSUFFICIENT_PRIVILEGE,
      write: INSUFFICIENT_PRIVILEGE,
      open: false,
      consumed: null,
    });
  });

  it("L3G-T8 writes when the peer confirms and executes: the value, the version of k, the line with its 2V and the peer mode; the request consumed", async () => {
    const outcome = await scenario(async (tx) => {
      const [before] = await tx<{ version: number }[]>`
        select max(version)::int as version from search.facet_config_versions`;
      const { request, session } = await approvedChange(tx, SETTING_ACTION, {
        key: "k_anonymity_threshold",
        value: 7,
      });
      const write = await writeSetting(
        tx,
        adminA,
        session,
        request,
        "k_anonymity_threshold",
        7,
      );
      const [version] = await tx<
        { version: number; k: unknown; author: string }[]
      >`
        select version::int as version, snapshot -> 'k_anonymity_threshold' as k,
               changed_by_account_id::text as author
          from search.facet_config_versions order by version desc limit 1`;
      const [line] = await tx<
        { actor: string; payload: Record<string, unknown> }[]
      >`
        select actor_account_id::text as actor, payload from audit.audit_events
         where event_type = 'search.settings_changed' order by seq desc limit 1`;
      return {
        before: before?.version ?? 0,
        write,
        version,
        line,
        k: await valueOf(tx, "k_anonymity_threshold"),
        consumed: (await consumedAt(tx, request)) !== null,
        request,
      };
    });
    expect(outcome.version?.version).toBeGreaterThan(outcome.before);
    expect(outcome.write).toEqual({
      outcome: "rows",
      rows: [{ version: outcome.version?.version }],
    });
    expect(outcome.version).toMatchObject({ k: 7, author: adminA });
    expect(outcome.k).toBe(7);
    expect(outcome.consumed).toBe(true);
    expect(outcome.line).toEqual({
      actor: adminA,
      payload: {
        table: "search_settings",
        key: "k_anonymity_threshold",
        before: 5,
        after: 7,
        facet_config_version: outcome.version?.version,
        dual_control_request_id: outcome.request,
        dual_control: "peer",
      },
    });
  });

  it("L3G-T8 writes a facet under its own 2V, the note in the version; the same request refused for another order", async () => {
    const outcome = await scenario(async (tx) => {
      const { request, session } = await approvedChange(tx, FACET_ACTION, {
        facet_code: "F17",
        is_open: false,
        display_order: 8,
      });
      const write = (order: number, note: string | null) =>
        asAdminOf(
          tx,
          adminA,
          () =>
            run<{ version: number }>(tx, WRITE_FACET, [
              session,
              request,
              "F17",
              false,
              order,
              SETTING_REASON,
              note,
            ]),
          { session },
        );
      const other = await write(3, null);
      const done = await write(8, "  after review  ");
      const [version] = await tx<{ version: number; note: string | null }[]>`
        select version::int as version, note
          from search.facet_config_versions order by version desc limit 1`;
      const [facet] = await tx<{ is_open: boolean; display_order: number }[]>`
        select is_open, display_order::int as display_order
          from search.facet_settings where facet_code = 'F17'`;
      return { other: codeOf(other), done, version, facet };
    });
    expect(outcome.other).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.done).toEqual({
      outcome: "rows",
      rows: [{ version: outcome.version?.version }],
    });
    expect(outcome.version?.note).toBe("after review");
    expect(outcome.facet).toEqual({ is_open: false, display_order: 8 });
  });

  it("L3G-T8 refuses a request already consumed, cancelled or expired", async () => {
    const outcome = await scenario(async (tx) => {
      const payload = { key: "page_size", value: 10 };
      const consumed = await approvedChange(tx, SETTING_ACTION, payload);
      const first = await writeSetting(
        tx,
        adminA,
        consumed.session,
        consumed.request,
        "page_size",
        10,
      );
      const again = await writeSetting(
        tx,
        adminA,
        consumed.session,
        consumed.request,
        "page_size",
        10,
      );

      // abandoned by its requester while pending (cancel_dual_control(), 0130)
      const cancelled = await requestChange(tx, adminB, SETTING_ACTION, {
        key: "page_size",
        value: 11,
      });
      await asAdminOf(tx, adminB, () =>
        tx.unsafe("select backoffice.cancel_dual_control($1::uuid)", [
          cancelled,
        ]),
      );
      const [state] = await tx<{ state: string }[]>`
        select state::text from backoffice.dual_control_requests where id = ${cancelled}`;
      const cancelSession = await freshSession(tx, adminA);
      const afterCancel = await writeSetting(
        tx,
        adminA,
        cancelSession,
        cancelled,
        "page_size",
        11,
      );

      const expired = await approvedChange(tx, SETTING_ACTION, {
        key: "page_size",
        value: 12,
      });
      await ageRequest(tx, expired.request, 3 * 86_400);
      const afterExpiry = await writeSetting(
        tx,
        adminA,
        expired.session,
        expired.request,
        "page_size",
        12,
      );
      return {
        first: codeOf(first),
        again: codeOf(again),
        cancelledState: state?.state,
        afterCancel: codeOf(afterCancel),
        afterExpiry: codeOf(afterExpiry),
        pageSize: await valueOf(tx, "page_size"),
      };
    });
    expect(outcome).toEqual({
      first: "ok",
      again: INSUFFICIENT_PRIVILEGE,
      cancelledState: "cancelled",
      afterCancel: INSUFFICIENT_PRIVILEGE,
      afterExpiry: INSUFFICIENT_PRIVILEGE,
      pageSize: 10,
    });
  });

  it("L3G-T8 refuses the requester as executor, another value, another reason (22023 outside the four, 42501 another of the four)", async () => {
    const outcome = await scenario(async (tx) => {
      const { request, session } = await approvedChange(tx, SETTING_ACTION, {
        key: "page_size",
        value: 10,
      });
      const requesterSession = await freshSession(tx, adminB);
      const requester = await writeSetting(
        tx,
        adminB,
        requesterSession,
        request,
        "page_size",
        10,
      );
      const otherValue = await writeSetting(
        tx,
        adminA,
        session,
        request,
        "page_size",
        11,
      );
      const unknownReason = await writeSetting(
        tx,
        adminA,
        session,
        request,
        "page_size",
        10,
        { reason: "because" },
      );
      const otherReason = await writeSetting(
        tx,
        adminA,
        session,
        request,
        "page_size",
        10,
        { reason: "abuse_response" },
      );
      // the session of another account: R refused
      const otherSession = await writeSetting(
        tx,
        adminA,
        requesterSession,
        request,
        "page_size",
        10,
      );
      return {
        requester: codeOf(requester),
        otherValue: codeOf(otherValue),
        unknownReason,
        otherReason: codeOf(otherReason),
        otherSession: codeOf(otherSession),
        pageSize: await valueOf(tx, "page_size"),
        consumed: await consumedAt(tx, request),
      };
    });
    expect(outcome).toMatchObject({
      requester: INSUFFICIENT_PRIVILEGE,
      otherValue: INSUFFICIENT_PRIVILEGE,
      unknownReason: {
        outcome: "error",
        code: INVALID_PARAMETER,
        detail: "reason",
      },
      otherReason: INSUFFICIENT_PRIVILEGE,
      otherSession: INSUFFICIENT_PRIVILEGE,
      pageSize: 12,
      consumed: null,
    });
  });

  it("L3G-T8 refuses an admin in aal1, an agent and a brand, even with a confirmed request", async () => {
    const outcome = await scenario(async (tx) => {
      const { request, session } = await approvedChange(tx, SETTING_ACTION, {
        key: "is_open_to_advertisers",
        value: true,
      });
      const aal1 = await writeSetting(
        tx,
        adminA,
        session,
        request,
        "is_open_to_advertisers",
        true,
        { aal: "aal1" },
      );
      const parameters = [
        session,
        request,
        "is_open_to_advertisers",
        "true",
        SETTING_REASON,
      ];
      const agent = await actAsInternal(
        tx,
        "influx_agent",
        { accountId: agentA, role: "agent", aal: "aal2" },
        () => run(tx, WRITE_SETTING, parameters),
      );
      const brand = await actAsMember(
        tx,
        "influx_advertiser",
        { accountId: brandA, role: "advertiser", aal: "aal1" },
        () => run(tx, WRITE_SETTING, parameters),
      );
      return {
        aal1: codeOf(aal1),
        agent: codeOf(agent),
        brand: codeOf(brand),
        open: await valueOf(tx, "is_open_to_advertisers"),
        consumed: await consumedAt(tx, request),
      };
    });
    expect(outcome).toEqual({
      aal1: INSUFFICIENT_PRIVILEGE,
      agent: INSUFFICIENT_PRIVILEGE,
      brand: INSUFFICIENT_PRIVILEGE,
      open: false,
      consumed: null,
    });
  });

  it("L3G-T8 holds a peer only (D38 Q2): no request while no other admin can confirm, and a degraded confirmation refused at the write, the request left unconsumed", async () => {
    const outcome = await scenario(async (tx) => {
      // a request opened while admin B is there, then admin B leaves: the degraded form
      const request = await requestChange(tx, adminA, SETTING_ACTION, {
        key: "is_open_to_advertisers",
        value: true,
      });
      await onlyAdmin(tx, adminA);
      let refusedRequest = "ok";
      try {
        await tx.savepoint((savepoint) =>
          requestChange(savepoint, adminA, FACET_ACTION, {
            facet_code: "F17",
            is_open: false,
            display_order: 8,
          }),
        );
      } catch (error) {
        refusedRequest = (error as { code?: string }).code ?? "unknown";
      }
      await ageRequest(tx, request, 61);
      const session = await freshSession(tx, adminA);
      const mode = await confirmChange(
        tx,
        adminA,
        request,
        session,
        JUSTIFICATION,
      );
      const write = await writeSetting(
        tx,
        adminA,
        session,
        request,
        "is_open_to_advertisers",
        true,
      );
      return {
        refusedRequest,
        mode,
        write: codeOf(write),
        open: await valueOf(tx, "is_open_to_advertisers"),
        consumed: await consumedAt(tx, request),
      };
    });
    expect(outcome).toEqual({
      refusedRequest: INSUFFICIENT_PRIVILEGE,
      mode: "degraded_single_operator",
      write: INSUFFICIENT_PRIVILEGE,
      open: false,
      consumed: null,
    });
  });

  it("L3G-T8 gives the writers to influx_admin alone, removes the signatures of 0316, and lets only the two owners consume a 2V for another schema", async () => {
    const outcome = await scenario(async (tx) => {
      const [old] = await tx<
        { setting: string | null; facet: string | null }[]
      >`
        select to_regprocedure('search.write_search_setting(text, jsonb)')::text as setting,
               to_regprocedure('search.write_facet_setting(text, boolean, integer, text)')::text
                 as facet`;
      const callers = await tx<{ name: string; callers: string[] }[]>`
        select p.oid::regprocedure::text as name,
               array(select a.grantee::regrole::text
                       from pg_catalog.aclexplode(p.proacl) a
                      where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                      order by 1) as callers
          from pg_catalog.pg_proc p
         where p.oid in ('search.write_search_setting(uuid, uuid, text, jsonb, text)'::regprocedure,
                         'search.write_facet_setting(uuid, uuid, text, boolean, integer, text, text)'::regprocedure,
                         'backoffice.consume_dual_control_for(uuid, uuid, text, jsonb, text)'::regprocedure)
         order by 1`;
      const [check] = await tx<{ def: string }[]>`
        select pg_get_constraintdef(c.oid) as def from pg_constraint c
         where c.conname = 'dual_control_action_code_closed'`;
      return { old, callers, check: check?.def ?? "" };
    });
    expect(outcome.old).toEqual({ setting: null, facet: null });
    expect(outcome.callers).toEqual([
      {
        name: "backoffice.consume_dual_control_for(uuid,uuid,text,jsonb,text)",
        callers: ["influx_search_admin_definer", "influx_verification_definer"],
      },
      {
        name: "search.write_facet_setting(uuid,uuid,text,boolean,integer,text,text)",
        callers: ["influx_admin"],
      },
      {
        name: "search.write_search_setting(uuid,uuid,text,jsonb,text)",
        callers: ["influx_admin"],
      },
    ]);
    expect(outcome.check).toContain("search.change_setting");
    expect(outcome.check).toContain("search.change_facet");
  });
});

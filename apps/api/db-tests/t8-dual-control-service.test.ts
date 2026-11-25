// T8 (J8, commit 4) — the guard of the B-5 actions and the dual control service of apps/api, on
// the API's own pools (docs/mvp/03 §1.3 PD1 to PD7, §6.1 B-5; 17b §3.13.c; 21 J3S-4). The rules
// are the database's (0130 to 0132, t8-dual-control): here, what apps/api makes of them —
//   J3S-4  a B-5 action without a fresh R is refused, and said so (403 reauthentication_required);
//          any other refusal is 403 forbidden;
//   PD1 to PD7  the request, the view (who may do what now), the confirmation and the action in ONE
//          transaction, the mark of the register line, the weekly list, and the switch of PD7
//          with no code path of its own.
// The fixtures (admins, sessions, targets) are committed by the migration role: the API commits.
// PD7 needs ONE admin able to confirm: the other admins are deactivated for those cases only and
// restored after them (files of the db project run one after the other).
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { localRoleUrl, type LoginRole } from "@influx/test-kit/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createApiDatabase,
  withUserTransaction,
  type ApiDatabase,
} from "../src/db/index.ts";
import {
  confirmAndExecute,
  degradedConfirmationsByWeek,
  dualControlExecutor,
  dualControlView,
  requestDualControl,
  type RequestableDualControlAction,
} from "../src/domains/backoffice/dual-control.ts";
import { peerAdminExists } from "../src/domains/backoffice/dual-control/repository.ts";
import {
  assertBackofficeContext,
  runSensitiveAction,
  type BackofficeTransaction,
} from "../src/domains/identity/backoffice-session.ts";
import { REAUTHENTICATION_FRESHNESS_SECONDS } from "../src/domains/identity/settings.ts";
import { localSuperuser, migrationRole } from "./support.ts";

const JUSTIFICATION =
  "Single administrator during the launch phase, action reviewed alone.";

let database: ApiDatabase;
/** Admin profiles of this file, deactivated at its end: they never stay peers of other files. */
const created: string[] = [];
/** Admin profiles deactivated by onlyAdmin(), until restored. */
const deactivated = new Set<string>();

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

function sha256(bytes: Buffer): Buffer {
  return createHash("sha256").update(bytes).digest();
}

/** An active admin: account, role, active profile with a pinned TOTP factor (C6-2). */
async function newAdmin(label: string): Promise<string> {
  const id = randomUUID();
  await migrationRole().begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         display_name, is_adult_attested, adult_attested_at, declared_status)
      values (${id}, ${randomUUID()}, ${`t8-2v-svc-${label}-${id}@example.test`}, now(), 'FR',
              'fr', 'T8 2V service', true, now(), 'business')`;
    await tx`insert into identity.account_roles (account_id, role) values (${id}, 'admin')`;
    await tx`
      insert into identity.agent_profiles
        (account_id, first_name, activated_at, mfa_enrolled_at, mfa_factor_id)
      values (${id}, 'T8', now(), now(), ${randomUUID()})`;
  });
  created.push(id);
  return id;
}

/** An active account without any role: the target of a grant. */
async function newTarget(): Promise<string> {
  const id = randomUUID();
  await migrationRole()`
    insert into identity.accounts
      (id, auth_user_id, email, country_code, preferred_language, declared_status)
    values (${id}, ${randomUUID()}, ${`t8-2v-svc-target-${id}@example.test`}, 'FR', 'en',
            'individual')`;
  return id;
}

/**
 * A backoffice session proven by TOTP now (0012 trigger), its raw token; `stale`: everything moved
 * back past the freshness of R (the guard trigger refuses it: disabled for that one statement).
 */
async function newSession(
  accountId: string,
  options: { stale?: boolean } = {},
): Promise<Buffer> {
  const token = randomBytes(32);
  await migrationRole().begin(async (tx) => {
    const [row] = await tx<{ id: string }[]>`
      insert into identity.sessions
        (token_hash, account_id, surface, mfa_method, user_agent_summary)
      values (${sha256(token)}, ${accountId}, 'backoffice', 'totp', 'firefox.linux')
      returning id::text`;
    if (options.stale === true) {
      const seconds = REAUTHENTICATION_FRESHNESS_SECONDS + 60;
      await tx`alter table identity.sessions disable trigger sessions_guard_update`;
      await tx`
        update identity.sessions
           set created_at          = created_at          - make_interval(secs => ${seconds}),
               last_activity_at    = last_activity_at    - make_interval(secs => ${seconds}),
               idle_expires_at     = idle_expires_at     - make_interval(secs => ${seconds}),
               absolute_expires_at = absolute_expires_at - make_interval(secs => ${seconds}),
               mfa_verified_at     = mfa_verified_at     - make_interval(secs => ${seconds})
         where id = ${row?.id ?? ""}`;
      await tx`alter table identity.sessions enable trigger sessions_guard_update`;
    }
  });
  return token;
}

/** The transaction of a backoffice session, as withBackofficeSession() opens it for a route. */
function inSession(token: Buffer): BackofficeTransaction {
  return (fn) =>
    withUserTransaction(
      database,
      { sessionTokenHash: sha256(token), requestId: randomUUID() },
      async (tx, context) => {
        assertBackofficeContext(context);
        return fn(tx, context);
      },
    );
}

/** A B-5 confirmation of `requestId` by the holder of `token`, through the guard of J3S-4. */
function confirm(
  token: Buffer,
  requestId: string,
  degradedJustification: string | null = null,
) {
  return runSensitiveAction(
    database,
    randomUUID(),
    inSession(token),
    (tx, context) =>
      confirmAndExecute(
        tx,
        context,
        { requestId, degradedJustification },
        dualControlExecutor(),
      ),
  );
}

function grantOf(accountId: string): RequestableDualControlAction {
  return { code: "identity.grant_role", accountId, role: "advertiser" };
}

function request(
  token: Buffer,
  action: RequestableDualControlAction,
): Promise<string> {
  return inSession(token)((tx) =>
    requestDualControl(tx, { action, reasonCode: "test_j8", reasonNote: null }),
  );
}

function viewOf(token: Buffer, requestId: string) {
  return inSession(token)((tx, context) =>
    dualControlView(tx, context, requestId),
  );
}

/** Moves a request back past the 60 seconds of PD2 (the guard refuses it: disabled here). */
async function pastTheDelay(requestId: string): Promise<void> {
  await migrationRole().begin(async (tx) => {
    await tx`alter table backoffice.dual_control_requests disable trigger dual_control_requests_guard_update`;
    await tx`
      update backoffice.dual_control_requests
         set requested_at = requested_at - interval '61 seconds',
             expires_at   = expires_at   - interval '61 seconds',
             created_at   = created_at   - interval '61 seconds'
       where id = ${requestId}`;
    await tx`alter table backoffice.dual_control_requests enable trigger dual_control_requests_guard_update`;
  });
}

/** PD7: deactivates every other active admin profile, until restoreAdmins(). */
async function onlyAdmin(accountId: string): Promise<void> {
  const rows = await migrationRole()<{ account_id: string }[]>`
    update identity.agent_profiles p
       set is_active = false, deactivated_at = now(), deactivated_by_account_id = ${accountId}
     where p.account_id <> ${accountId}
       and p.is_active
       and exists (select 1 from identity.account_roles r
                    where r.account_id = p.account_id and r.role = 'admin')
     returning p.account_id::text as account_id`;
  for (const row of rows) {
    deactivated.add(row.account_id);
  }
}

async function restoreAdmins(only?: string): Promise<void> {
  const ids = only === undefined ? [...deactivated] : [only];
  if (ids.length === 0) {
    return;
  }
  await migrationRole()`
    update identity.agent_profiles
       set is_active = true, deactivated_at = null, deactivated_by_account_id = null
     where account_id = any(${ids}::uuid[])`;
  for (const id of ids) {
    deactivated.delete(id);
  }
}

/** The database's own reading of PD7 (0130), which decides at every confirmation. */
async function hasPeerAdmin(accountId: string): Promise<boolean> {
  const [row] = await localSuperuser()<{ peer: boolean }[]>`
    select backoffice.has_peer_admin(${accountId}::uuid) as peer`;
  return row?.peer === true;
}

async function rolesOf(accountId: string): Promise<string[]> {
  const rows = await migrationRole()<{ role: string }[]>`
    select role::text as role from identity.account_roles where account_id = ${accountId}`;
  return rows.map((row) => row.role);
}

async function grantLinesOf(accountId: string) {
  return migrationRole()<{ actor: string; payload: Record<string, unknown> }[]>`
    select actor_account_id::text as actor, payload
      from audit.audit_events
     where event_type = 'account.role_granted' and subject_id = ${accountId}
     order by seq`;
}

async function requestRow(requestId: string) {
  const [row] = await migrationRole()<
    {
      state: string;
      consumed: boolean;
      confirmed_by: string | null;
      degraded: boolean;
    }[]
  >`
    select state::text as state, consumed_at is not null as consumed,
           confirmed_by_account_id::text as confirmed_by,
           degraded_confirmed_at is not null as degraded
      from backoffice.dual_control_requests where id = ${requestId}`;
  return row;
}

beforeAll(() => {
  database = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
});

afterAll(async () => {
  await restoreAdmins();
  if (created.length > 0) {
    await migrationRole()`
      update identity.agent_profiles
         set is_active = false, deactivated_at = now(), deactivated_by_account_id = account_id
       where account_id = any(${created}::uuid[]) and is_active`;
  }
  await closeDatabase(database);
});

describe("J3S-4, B-5: R is checked in the transaction of the action, and its absence is said", () => {
  it("refuses a confirmation and an execution without a fresh R (403 reauthentication_required); nothing is written", async () => {
    const requester = await newAdmin("requester");
    const peer = await newAdmin("peer");
    const target = await newTarget();
    const requested = await request(
      await newSession(requester),
      grantOf(target),
    );
    const stale = await newSession(peer, { stale: true });

    await expect(confirm(stale, requested)).rejects.toMatchObject({
      code: "reauthentication_required",
    });
    expect(await requestRow(requested)).toEqual({
      state: "pending",
      consumed: false,
      confirmed_by: null,
      degraded: false,
    });
    expect(await rolesOf(target)).toEqual([]);

    // The same admin, with R: confirmed by its peer and executed in the same transaction.
    const outcome = await confirm(await newSession(peer), requested);
    expect(outcome.mode).toBe("peer");
    expect(await rolesOf(target)).toEqual(["advertiser"]);
    expect(await requestRow(requested)).toEqual({
      state: "confirmed",
      consumed: true,
      confirmed_by: peer,
      degraded: false,
    });
    expect(await grantLinesOf(target)).toEqual([
      {
        actor: peer,
        payload: {
          role: "advertiser",
          reason_code: "test_j8",
          dual_control_request_id: requested,
          dual_control: "peer",
        },
      },
    ]);
  });

  it("tells another refusal from a missing R (403 forbidden): the requester alone while a peer exists", async () => {
    const requester = await newAdmin("alone");
    await newAdmin("other");
    const session = await newSession(requester);
    const requested = await request(session, grantOf(await newTarget()));
    await pastTheDelay(requested);
    await expect(
      confirm(session, requested, JUSTIFICATION),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect((await requestRow(requested))?.state).toBe("pending");
  });

  it("answers 409 to a request no longer pending, and 404 to an unknown one (15 edge case 4)", async () => {
    const requester = await newAdmin("twice");
    const peer = await newAdmin("twice-peer");
    const requested = await request(
      await newSession(requester),
      grantOf(await newTarget()),
    );
    const session = await newSession(peer);
    await confirm(session, requested);
    await expect(confirm(session, requested)).rejects.toMatchObject({
      code: "conflict",
    });
    await expect(confirm(session, randomUUID())).rejects.toMatchObject({
      code: "not_found",
    });
    const view = await viewOf(session, requested);
    expect(view?.confirmation).toMatchObject({ mode: "peer", by: peer });
    expect(view?.executed).toBe(true);
    expect(view?.next).toEqual({ kind: "none" });
  });
});

describe("PD1 to PD7: the degraded form, and the switch to the target form without code", () => {
  it("PD1, PD2, PD5, PD6: alone, the requester waits 60 s, justifies, confirms; the line is marked and listed", async () => {
    const solo = await newAdmin("solo");
    const session = await newSession(solo);
    try {
      await onlyAdmin(solo);
      expect(
        await inSession(session)((tx, context) =>
          peerAdminExists(tx, context.accountId),
        ),
      ).toBe(false);
      expect(await hasPeerAdmin(solo)).toBe(false);

      const target = await newTarget();
      const requested = await request(session, grantOf(target));
      const view = await viewOf(session, requested);
      expect(view?.recap).toEqual({
        scope: { kind: "account", count: 1 },
        consequences: ["role_granted"],
        reversible: false,
      });
      expect(view?.state).toBe("pending");
      expect(view?.next.kind).toBe("confirm_degraded");
      if (view?.next.kind === "confirm_degraded") {
        expect(view.next.secondsLeft).toBeGreaterThan(50);
        expect(view.next.secondsLeft).toBeLessThanOrEqual(60);
        expect(Date.parse(view.next.confirmableAt)).toBe(
          Date.parse(view.requestedAt) + 60_000,
        );
      }

      // PD2: before the 60 seconds, refused — R is fresh, so this is no R refusal.
      await expect(
        confirm(session, requested, JUSTIFICATION),
      ).rejects.toMatchObject({ code: "forbidden" });

      await pastTheDelay(requested);
      const counted = await viewOf(session, requested);
      expect(counted?.next).toMatchObject({
        kind: "confirm_degraded",
        secondsLeft: 0,
      });
      // 0130: a written justification of 20 characters at least.
      await expect(
        confirm(session, requested, "too short"),
      ).rejects.toMatchObject({ code: "forbidden" });
      const outcome = await confirm(session, requested, JUSTIFICATION);
      expect(outcome.mode).toBe("degraded_single_operator");
      expect(await rolesOf(target)).toEqual(["advertiser"]);
      expect(await requestRow(requested)).toEqual({
        state: "degraded",
        consumed: true,
        confirmed_by: null,
        degraded: true,
      });
      expect((await grantLinesOf(target))[0]?.payload).toMatchObject({
        dual_control: "degraded_single_operator",
        dual_control_request_id: requested,
      });

      // PD6: in the list of the current week.
      const weeks = await inSession(session)((tx) =>
        degradedConfirmationsByWeek(tx, 1),
      );
      expect(weeks).toHaveLength(1);
      expect(weeks[0]?.week).toMatch(/^\d{4}-W\d{2}$/);
      expect(weeks[0]?.confirmations).toContainEqual(
        expect.objectContaining({
          id: requested,
          actionCode: "identity.grant_role",
          requestedBy: solo,
          executed: true,
        }),
      );
    } finally {
      await restoreAdmins();
    }
  });

  it("PD7: a second admin arrives — the same code now waits for the peer, who confirms", async () => {
    const solo = await newAdmin("switch");
    const second = await newAdmin("switch-second");
    const session = await newSession(solo);
    try {
      await onlyAdmin(solo);
      const alone = await request(session, grantOf(await newTarget()));
      expect((await viewOf(session, alone))?.next.kind).toBe(
        "confirm_degraded",
      );

      // The second admin is there: no flag, no setting, the next reading changes.
      await restoreAdmins(second);
      expect(
        await inSession(session)((tx, context) =>
          peerAdminExists(tx, context.accountId),
        ),
      ).toBe(true);
      expect(await hasPeerAdmin(solo)).toBe(true);
      expect((await viewOf(session, alone))?.next).toEqual({
        kind: "await_peer",
      });
      await pastTheDelay(alone);
      await expect(
        confirm(session, alone, JUSTIFICATION),
      ).rejects.toMatchObject({ code: "forbidden" });

      const secondSession = await newSession(second);
      expect((await viewOf(secondSession, alone))?.next).toEqual({
        kind: "confirm_as_peer",
      });
      expect((await confirm(secondSession, alone)).mode).toBe("peer");
    } finally {
      await restoreAdmins();
    }
  });
});

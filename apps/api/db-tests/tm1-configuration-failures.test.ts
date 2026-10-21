// TM1.11, TM1.12, TM1.15 (J9 D67-b; 05 RG160, RG161, CA82 to CA84, CA87) — the database half of a
// missing setting: a configuration failure is a failed line that blocks nothing behind it, and the
// take-back step of E-3 (leads.recover_stale_outbox_lines, 0146) re-queues it by itself once the
// setting in cause is corrected after the START of its attempt (60 s of margin), or, for
// credentials_missing, once a worker process started after that attempt: the same line, the same
// idempotency key, at most 200 a call, contact lines only, never a normal case. The connectors and
// the drain (the failure itself, the order of RG164) are in tests/brevo-connector, apollo-connector
// and leads-drain; the start check of RG162 in tests/leads-start-check and the start step in
// tm1-brevo-ids-from-environment.
//
// Each case runs in ONE rolled-back transaction of the local superuser, the take-back under the
// session_user / current_user pair of the worker (actAs). The settings are corrected the way an
// operator does it, by SQL (05 RG161 "quel que soit le chemin"), by a value change only: an id once
// set never goes back to null (RG163, 0145), so a "missing" list is the line's own cause, not the
// state of the base.
import { inRolledBackTransaction, probe } from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { actAs, localSuperuser } from "./support.ts";

const INVALID_PARAMETER = "22023";

function scenario<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

type Destination = "brevo_contact" | "apollo_contact" | "brevo_transactional";

type LineSpec = {
  code: string;
  destination?: Destination;
  subject?: string;
  /** Seconds between the start of the failed attempt and now() (negative: after now()). */
  startedSecondsAgo?: number;
  /** A line of before 0146: no start recorded. */
  noStart?: boolean;
};

type Line = { id: string; key: string; subject: string };

/** A FAILED line of a configuration code (or any code), one attempt used. */
async function failedLine(
  tx: postgres.TransactionSql,
  spec: LineSpec,
): Promise<Line> {
  const subject = spec.subject ?? `account:${randomUUID()}`;
  const event = randomUUID();
  const key = `tm1-d67:${event}`;
  const [row] = await tx<{ id: string }[]>`
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, payload, idempotency_key, status,
       attempts, last_error_code, last_error_message, attempt_started_at, completed_at)
    values (${event}, 'lead.created',
            ${spec.destination ?? "brevo_contact"}::leads.outbox_destination, ${subject},
            ${JSON.stringify({ event_id: event })}::text::jsonb, ${key}, 'failed', 1,
            ${spec.code}, 'settings missing: brevo_list_ids.creators',
            case when ${spec.noStart ?? false} then null
                 else now() - make_interval(secs => ${spec.startedSecondsAgo ?? 600}::double precision)
            end,
            now())
    returning id::text as id`;
  if (row === undefined) {
    throw new Error("the queue line was not inserted");
  }
  return { id: row.id, key, subject };
}

type Recovered = {
  id: string;
  written_status: string;
  reason: string;
  error_code: string | null;
};

/** The take-back step as the worker calls it, with the start of its process when given. */
function recoverAsWorker(
  tx: postgres.TransactionSql,
  own: readonly Line[],
  startedAt?: string,
): Promise<Recovered[]> {
  return actAs(tx, "worker", async () => {
    if (startedAt !== undefined) {
      await tx`select pg_catalog.set_config('influx.worker_started_at', ${startedAt}, true)`;
    }
    const rows = await tx<Recovered[]>`
      select outbox_id::text as id, written_status::text as written_status, reason, error_code
        from leads.recover_stale_outbox_lines()`;
    // lines of other files may come back too, in this rolled-back transaction: keep this case's
    const ids = new Set(own.map((line) => line.id));
    return rows
      .filter((row) => ids.has(row.id))
      .sort((a, b) => Number(a.id) - Number(b.id));
  });
}

type LineState = {
  status: string;
  attempts: number;
  completed: boolean;
  locked: boolean;
  idempotency_key: string;
  last_error_code: string | null;
  last_error_message: string | null;
  /** available_at - the date of the setting given (read in the base: microseconds), in seconds. */
  waits_after_setting: number | null;
};

async function stateOf(
  tx: postgres.TransactionSql,
  line: Line,
  settingKey: string | null = null,
): Promise<LineState | undefined> {
  const [row] = await tx<LineState[]>`
    select status::text as status, attempts, completed_at is not null as completed,
           locked_by is not null as locked, idempotency_key, last_error_code, last_error_message,
           extract(epoch from available_at - (
             select updated_at from leads.sync_settings where key = ${settingKey}))::float
             as waits_after_setting
      from leads.outbox_events where id = ${line.id}`;
  return row;
}

/**
 * The start of the line's attempt set 61 s after the latest committed date of these keys: no
 * modification of them comes after it, whatever another file of the stack committed just before
 * (a backoffice route of t14 writes an Apollo key for real).
 */
async function startAfterKeys(
  tx: postgres.TransactionSql,
  line: Line,
  keys: readonly string[],
): Promise<void> {
  await tx`
    update leads.outbox_events
       set attempt_started_at = (
             select max(updated_at) + interval '61 seconds'
               from leads.sync_settings where key = any (${keys}::text[]))
     where id = ${line.id}`;
}

const APOLLO_KEYS = [
  "apollo_scope",
  "apollo_legal_basis",
  "apollo_excluded_countries",
] as const;

/** An operator's SQL correction of a Brevo list id (a positive integer, never a null). */
async function correctBrevoLists(tx: postgres.TransactionSql): Promise<void> {
  await tx`
    update leads.sync_settings
       set value = value || jsonb_build_object(
             'creators', 700000 + floor(random() * 99999)::int)
     where key = 'brevo_list_ids'`;
}

/** A change of one Apollo key, as an admin would make it (another valid value). */
async function changeApolloCountries(
  tx: postgres.TransactionSql,
): Promise<void> {
  await tx`
    update leads.sync_settings
       set value = case when value = '["FR"]'::jsonb then '["DE"]'::jsonb
                        else '["FR"]'::jsonb end
     where key = 'apollo_excluded_countries'`;
}

/** A change of a key that is the cause of no configuration failure. */
async function changeRateLimits(tx: postgres.TransactionSql): Promise<void> {
  await tx`
    update leads.sync_settings
       set value = jsonb_set(value, '{brevo_contact_per_minute}',
                             to_jsonb(coalesce((value ->> 'brevo_contact_per_minute')::int, 60) + 1))
     where key = 'rate_limits'`;
}

describe("TM1.11, 05 CA82, CA84: a configuration failure holds nothing back", () => {
  it("a failed lead.created never holds back the consent.revoked of the same account (RG92)", async () => {
    await scenario(async (tx) => {
      const failed = await failedLine(tx, { code: "list_not_configured" });
      const event = randomUUID();
      const [revoked] = await tx<{ id: string }[]>`
        insert into leads.outbox_events
          (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
        values (${event}, 'consent.revoked', 'brevo_contact', ${failed.subject}, 0,
                ${JSON.stringify({ event_id: event })}::text::jsonb, ${`tm1-d67:${event}`})
        returning id::text as id`;
      const claimed = await actAs(
        tx,
        "worker",
        () =>
          tx<{ id: string }[]>`
          select outbox_id::text as id
            from leads.claim_outbox_batch('tm1-d67-worker', 50)`,
      );
      expect(claimed.map((row) => row.id)).toContain(revoked?.id);
      expect((await stateOf(tx, failed))?.status).toBe("failed");
    });
  });

  it("the start of an attempt is kept after its outcome; the lock is not (0146)", async () => {
    await scenario(async (tx) => {
      const event = randomUUID();
      const [line] = await tx<{ id: string }[]>`
        insert into leads.outbox_events
          (event_id, event_type, destination, subject_key, payload, idempotency_key, status,
           locked_by, locked_at)
        values (${event}, 'lead.created', 'brevo_contact', ${`account:${randomUUID()}`},
                ${JSON.stringify({ event_id: event })}::text::jsonb, ${`tm1-d67:${event}`},
                'processing', 'tm1-d67-worker', now())
        returning id::text as id`;
      const id = line?.id ?? "0";
      await actAs(tx, "worker", async () => {
        await tx`select attempt from leads.begin_outbox_attempt(${id}::bigint, 'tm1-d67-worker')`;
        await tx`
          select written_status from leads.complete_outbox_attempt(
            p_outbox_id => ${id}::bigint, p_worker => 'tm1-d67-worker',
            p_status => 'failed', p_dry_run => false,
            p_error_code => 'list_not_configured',
            p_error_message => 'settings missing: brevo_list_ids.creators')`;
      });
      const [row] = await tx<
        { status: string; started_now: boolean; locked: boolean }[]
      >`
        select status::text as status, attempt_started_at = now() as started_now,
               locked_at is not null as locked
          from leads.outbox_events where id = ${id}`;
      expect(row).toEqual({
        status: "failed",
        started_now: true,
        locked: false,
      });
    });
  });
});

describe("TM1.12, 05 RG161, CA83: re-queued by itself once the setting is corrected", () => {
  it("list_not_configured: back to pending once brevo_list_ids is corrected by SQL, the same line and key", async () => {
    await scenario(async (tx) => {
      const line = await failedLine(tx, { code: "list_not_configured" });
      await correctBrevoLists(tx);
      expect(await recoverAsWorker(tx, [line])).toEqual([
        {
          id: line.id,
          written_status: "pending",
          reason: "configuration_restored",
          error_code: "list_not_configured",
        },
      ]);
      const state = await stateOf(tx, line, "brevo_list_ids");
      expect(state).toMatchObject({
        status: "pending",
        attempts: 0,
        completed: false,
        locked: false,
        // RG102, RG76: the same line and idempotency key, never a duplicate at Brevo
        idempotency_key: line.key,
        last_error_code: "list_not_configured",
      });
      // the trace on the line names the setting and the motif, never a value
      expect(state?.last_error_message).toBe(
        "Re-queued by the worker (configuration_restored): brevo_list_ids changed since " +
          "the failed attempt.",
      );
      // the line waits until 60 s after the date of the correction (EC-J9-D67b-3)
      expect(state?.waits_after_setting).toBe(60);
    });
  });

  it("a correction made DURING the failed attempt is caught: compared with its start, not its failure", async () => {
    await scenario(async (tx) => {
      const line = await failedLine(tx, {
        code: "list_not_configured",
        startedSecondsAgo: 5,
      });
      await correctBrevoLists(tx);
      // the failure is recorded after the correction
      await tx`
        update leads.outbox_events set completed_at = clock_timestamp() where id = ${line.id}`;
      expect(await recoverAsWorker(tx, [line])).toHaveLength(1);
    });
  });

  it("the margin: a correction written up to 60 s before the start still re-queues, never beyond", async () => {
    await scenario(async (tx) => {
      // the correction is dated now; the attempts start 30 s and 90 s after it
      const within = await failedLine(tx, {
        code: "list_not_configured",
        startedSecondsAgo: -30,
      });
      const beyond = await failedLine(tx, {
        code: "list_not_configured",
        startedSecondsAgo: -90,
      });
      await correctBrevoLists(tx);
      expect(
        (await recoverAsWorker(tx, [within, beyond])).map((row) => row.id),
      ).toEqual([within.id]);
    });
  });

  it("a modification that does not correct gives at most one new failure per line (RG161)", async () => {
    await scenario(async (tx) => {
      const line = await failedLine(tx, { code: "list_not_configured" });
      await correctBrevoLists(tx);
      expect(await recoverAsWorker(tx, [line])).toHaveLength(1);
      // its next attempt starts when it becomes available, and fails again for the same cause
      await tx`
        update leads.outbox_events
           set status = 'failed', attempts = 1, completed_at = now(),
               attempt_started_at = available_at
         where id = ${line.id}`;
      expect((await stateOf(tx, line))?.status).toBe("failed");
      expect(await recoverAsWorker(tx, [line])).toEqual([]);
    });
  });

  it("a modification of another key re-queues nothing; nor does an Apollo key for a list, nor a list for Apollo", async () => {
    await scenario(async (tx) => {
      const list = await failedLine(tx, { code: "list_not_configured" });
      await startAfterKeys(tx, list, ["brevo_list_ids"]);
      const apollo = await failedLine(tx, {
        code: "apollo_settings_invalid",
        destination: "apollo_contact",
      });
      await startAfterKeys(tx, apollo, APOLLO_KEYS);
      await changeRateLimits(tx);
      expect(await recoverAsWorker(tx, [list, apollo])).toEqual([]);
      // an attempt of the Apollo line began before this change of an Apollo key
      await tx`
        update leads.outbox_events
           set attempt_started_at = now() - interval '5 seconds'
         where id = ${apollo.id}`;
      await changeApolloCountries(tx);
      expect(
        (await recoverAsWorker(tx, [list, apollo])).map((row) => row.id),
      ).toEqual([apollo.id]);
    });
  });

  it("apollo_settings_invalid: back to pending once one of the three Apollo keys is modified", async () => {
    await scenario(async (tx) => {
      const line = await failedLine(tx, {
        code: "apollo_settings_invalid",
        destination: "apollo_contact",
      });
      await changeApolloCountries(tx);
      expect(await recoverAsWorker(tx, [line])).toEqual([
        {
          id: line.id,
          written_status: "pending",
          reason: "configuration_restored",
          error_code: "apollo_settings_invalid",
        },
      ]);
      expect((await stateOf(tx, line))?.last_error_message).toBe(
        "Re-queued by the worker (configuration_restored): the Apollo settings changed " +
          "since the failed attempt.",
      );
    });
  });

  it("never a normal case, another failure, a transactional line, nor a line without a recorded start", async () => {
    await scenario(async (tx) => {
      const others = [
        await failedLine(tx, { code: "output_check_rejected" }),
        await failedLine(tx, { code: "brevo.rejected" }),
        await failedLine(tx, {
          code: "credentials_missing",
          destination: "brevo_transactional",
        }),
        await failedLine(tx, { code: "list_not_configured", noStart: true }),
      ];
      const event = randomUUID();
      const [skipped] = await tx<{ id: string }[]>`
        insert into leads.outbox_events
          (event_id, event_type, destination, subject_key, payload, idempotency_key, status,
           skip_reason, completed_at)
        values (${event}, 'lead.created', 'brevo_contact', ${`account:${randomUUID()}`},
                ${JSON.stringify({ event_id: event })}::text::jsonb, ${`tm1-d67:${event}`},
                'skipped', 'no_consent', now())
        returning id::text as id`;
      const noConsent = {
        id: skipped?.id ?? "0",
        key: `tm1-d67:${event}`,
        subject: "",
      };
      await correctBrevoLists(tx);
      // a process started after every attempt (by the database clock, never in its future)
      const [start] = await tx<{ at: string }[]>`
        select (now() - interval '1 second')::text as at`;
      expect(
        await recoverAsWorker(tx, [...others, noConsent], start?.at),
      ).toEqual([]);
      expect((await stateOf(tx, noConsent))?.status).toBe("skipped");
    });
  });

  it("at most 200 lines a call (RG101), the rest at the next call", async () => {
    await scenario(async (tx) => {
      const own: Line[] = [];
      for (let index = 0; index < 201; index += 1) {
        own.push(await failedLine(tx, { code: "list_not_configured" }));
      }
      await correctBrevoLists(tx);
      const first = await recoverAsWorker(tx, own);
      const second = await recoverAsWorker(tx, own);
      // other files' failed lines of the local stack may take a share of the first batch
      expect(first.length + second.length).toBe(201);
      expect(first.length).toBeLessThanOrEqual(200);
    });
  });
});

describe("TM1.15, 05 RG161, CA87: credentials_missing goes back once a new process starts", () => {
  it("re-queued when the calling process started after the attempt, never when it started before", async () => {
    await scenario(async (tx) => {
      const earlier = await failedLine(tx, {
        code: "credentials_missing",
        destination: "apollo_contact",
        startedSecondsAgo: 600,
      });
      const later = await failedLine(tx, {
        code: "credentials_missing",
        destination: "apollo_contact",
        startedSecondsAgo: 60,
      });
      const [start] = await tx<{ at: string }[]>`
        select (now() - interval '300 seconds')::text as at`;
      expect(await recoverAsWorker(tx, [earlier, later], start?.at)).toEqual([
        {
          id: earlier.id,
          written_status: "pending",
          reason: "configuration_restored",
          error_code: "credentials_missing",
        },
      ]);
      expect((await stateOf(tx, earlier))?.last_error_message).toBe(
        "Re-queued by the worker (configuration_restored): a new worker process changed " +
          "since the failed attempt.",
      );
      expect((await stateOf(tx, later))?.status).toBe("failed");
    });
  });

  it("without the start of the process, nothing; the start is for one call only", async () => {
    await scenario(async (tx) => {
      const line = await failedLine(tx, {
        code: "credentials_missing",
        destination: "apollo_contact",
      });
      expect(await recoverAsWorker(tx, [line])).toEqual([]);
      const [now] = await tx<{ at: string }[]>`select now()::text as at`;
      // set, then read and cleared by a call that finds nothing of this case's
      await actAs(tx, "worker", async () => {
        await tx`select pg_catalog.set_config('influx.worker_started_at', ${now?.at ?? ""}, true)`;
        await tx`select count(*) from leads.recover_stale_outbox_lines()`;
      });
      const [cleared] = await tx<{ value: string | null }[]>`
        select nullif(current_setting('influx.worker_started_at', true), '') as value`;
      expect(cleared?.value).toBeNull();
    });
  });

  it.each([
    ["a text that is no instant", "yesterday at noon"],
    ["an instant in the future", "2999-01-01T00:00:00Z"],
  ])("refuses %s (22023), and re-queues nothing", async (_case, value) => {
    await scenario(async (tx) => {
      const outcome = await actAs(tx, "worker", async () => {
        await tx`select pg_catalog.set_config('influx.worker_started_at', ${value}, true)`;
        return probe(tx, "select * from leads.recover_stale_outbox_lines()");
      });
      expect(outcome).toEqual({ outcome: "error", code: INVALID_PARAMETER });
    });
  });
});

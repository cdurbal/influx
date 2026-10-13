// TM1 (J7, commit 2) — what comes back from Brevo, the database half (migration 0116, decision 2
// of the J7 start; 16 RG105 to RG108, RG146, RG147; 05 RG89, RG93; D37, D60, M6-6):
// leads.record_brevo_event() (E-1, influx_auth), leads.record_brevo_reconciliation_event() (E-4,
// influx_worker), leads.process_brevo_inbound_event() (E-3, influx_worker),
// identity.record_transactional_hard_bounce() (reached from the leads owner only), and the guards
// of the two raw tables.
//
// The raw table is append-only and the processing takes "the oldest line without an outcome": no
// case may commit a line. Each case runs in ONE rolled-back transaction of the local superuser
// (loopback only, like V1 of t3-audit-chain): the fixtures are written first, then the function
// runs under `SET LOCAL SESSION AUTHORIZATION <login role>` + `SET LOCAL ROLE <role>`, exactly the
// session_user / current_user pair of apps/api, then the superuser reads the effects back. The
// refusals of the other roles go through the ordinary harness (influx_app, the login roles).
import {
  inRolledBackTransaction,
  probe,
  takeRole,
  type DataSet,
  type ProbeResult,
} from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { actAs, localSuperuser, loginRole, testDataSet } from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const INVALID_PARAMETER = "22023";

const RECORD =
  "leads.record_brevo_event($1, $2::timestamptz, $3, $4, $5, $6, $7)";
const RECONCILE =
  "leads.record_brevo_reconciliation_event($1, $2::timestamptz, $3, $4, $5::uuid, $6, $7, $8)";

let dataSet: DataSet;

beforeAll(async () => {
  dataSet = await testDataSet();
});

// ---------------------------------------------------------------------------------------------
// Fixtures and actors, inside the superuser's transaction
// ---------------------------------------------------------------------------------------------

function scenario<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

/** E-1 as influx_auth: the id of the raw line, or null for a duplicate. */
async function receive(
  tx: postgres.TransactionSql,
  event: string,
  options: {
    occurredAt?: string;
    messageId?: string | null;
    email?: string | null;
    reason?: string | null;
  } = {},
): Promise<string | null> {
  return actAs(tx, "auth", async () => {
    const [row] = await tx.unsafe<{ id: string | null }[]>(
      `select ${RECORD}::text as id`,
      [
        event,
        options.occurredAt ?? new Date().toISOString(),
        options.messageId ?? null,
        options.email ?? null,
        null,
        null,
        options.reason ?? null,
      ],
    );
    return row?.id ?? null;
  });
}

type Processed = {
  inbound_event_id: string;
  outcome: string;
  audit_subject: string | null;
};

/** E-3 as influx_worker: the processed line, or undefined when nothing waits. */
function processNext(
  tx: postgres.TransactionSql,
): Promise<Processed | undefined> {
  return actAs(tx, "worker", async () => {
    const [row] = await tx<Processed[]>`
      select inbound_event_id::text, outcome::text, audit_subject::text
        from leads.process_brevo_inbound_event()`;
    return row;
  });
}

/** The current address of a data set account. */
async function emailOf(
  tx: postgres.TransactionSql,
  account: string,
): Promise<string> {
  const [row] = await tx<{ email: string }[]>`
    select email from identity.accounts where id = ${account}`;
  if (row === undefined) {
    throw new Error("unknown account");
  }
  return row.email;
}

/** Pins the marketing consent in force (a second ago, so the processing's own line is later). */
async function setConsent(
  tx: postgres.TransactionSql,
  account: string,
  granted: boolean,
): Promise<void> {
  await tx`
    insert into identity.consent_events (account_id, purpose, granted, source, occurred_at)
    values (${account}, 'marketing_email', ${granted}, 'account_settings',
            now() - interval '1 second')`;
}

/** A sent transactional e-mail of the journal, with its Brevo message-id. */
async function journalLine(
  tx: postgres.TransactionSql,
  account: string,
): Promise<string> {
  const messageId = `<${randomUUID()}@smtp-relay.mailin.fr>`;
  await tx`
    insert into leads.transactional_sends
      (email_code, priority, account_id, locale, provider_message_id, status, sent_at)
    values ('auth.login_code', 'p0', ${account}, 'fr', ${messageId}, 'sent', now())`;
  return messageId;
}

async function effectsOn(tx: postgres.TransactionSql, account: string) {
  const consents = await tx<
    { granted: boolean; source: string; evidence: Record<string, unknown> }[]
  >`
    select granted, source::text, evidence from identity.consent_events
     where account_id = ${account} and source = 'brevo_webhook'`;
  const queue = await tx<
    {
      event_type: string;
      destination: string;
      priority: number;
      payload: Record<string, unknown>;
    }[]
  >`
    select event_type, destination::text, priority, payload from leads.outbox_events
     where subject_key = ${`account:${account}`} and event_type = 'consent.revoked'
     order by destination`;
  const [state] = await tx<
    { unsubscribed_at: Date | null; suppressed_reason: string | null }[]
  >`
    select unsubscribed_at, suppressed_reason::text from leads.contact_sync_states
     where account_id = ${account} and destination = 'brevo_contact'`;
  const incidents = await tx<{ channel: string; incident_type: string }[]>`
    select channel::text, incident_type::text from identity.email_delivery_incidents
     where account_id = ${account} and provider_event_id ~ '^[0-9a-f]{64}$'`;
  const [status] = await tx<{ email_status: string }[]>`
    select email_status::text from identity.accounts where id = ${account}`;
  return {
    consents,
    queue,
    state,
    incidents,
    emailStatus: status?.email_status,
  };
}

async function rawLine(tx: postgres.TransactionSql, id: string) {
  const [row] = await tx<
    {
      origin: string;
      event: string;
      email: string | null;
      reason: string | null;
      account_ref: string | null;
      dedup_bytes: number;
      fresh: boolean;
    }[]
  >`
    select origin::text, event, email, reason, account_ref::text,
           octet_length(dedup_key) as dedup_bytes, received_at = now() as fresh
      from leads.brevo_inbound_events where id = ${id}`;
  return row;
}

async function outcomeOf(tx: postgres.TransactionSql, id: string) {
  const [row] = await tx<{ outcome: string; account_id: string | null }[]>`
    select outcome::text, account_id::text from leads.brevo_inbound_outcomes
     where event_id = ${id}`;
  return row;
}

function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

// ---------------------------------------------------------------------------------------------

describe("leads.record_brevo_event() (E-1, influx_auth only)", () => {
  it("writes one raw webhook line: lower-case address, cleaned reason, 32-byte key, no effect", async () => {
    const account = dataSet.accounts.creator.a.id;
    const result = await scenario(async (tx) => {
      const email = await emailOf(tx, account);
      const id = await receive(tx, "hard_bounce", {
        email: `  ${email.toUpperCase()} `,
        messageId: "<abc@smtp-relay.mailin.fr>",
        reason: `550 5.1.1 <${email}> unknown\r\nuser`,
      });
      if (id === null) {
        throw new Error("no line");
      }
      return {
        email,
        line: await rawLine(tx, id),
        outcome: await outcomeOf(tx, id),
        effects: await effectsOn(tx, account),
      };
    });
    expect(result.line).toEqual({
      origin: "webhook",
      event: "hard_bounce",
      email: result.email,
      reason: "550 5.1.1 <[address]> unknown user",
      account_ref: null,
      dedup_bytes: 32,
      fresh: true,
    });
    // RG147: the route writes and answers; nothing is processed here
    expect(result.outcome).toBeUndefined();
    expect(result.effects.consents).toEqual([]);
    expect(result.effects.queue).toEqual([]);
  });

  it("ignores a duplicate silently: NULL, one line (RG146-5)", async () => {
    const outcome = await scenario(async (tx) => {
      const occurredAt = new Date().toISOString();
      const first = await receive(tx, "unsubscribed", {
        occurredAt,
        email: "someone@example.test",
      });
      const second = await receive(tx, "unsubscribed", {
        occurredAt,
        email: "SOMEONE@example.test",
      });
      const [count] = await tx<{ n: number }[]>`
        select count(*)::int as n from leads.brevo_inbound_events
         where email = 'someone@example.test'`;
      return { first, second, count: count?.n };
    });
    expect(outcome.first).not.toBeNull();
    expect(outcome.second).toBeNull();
    expect(outcome.count).toBe(1);
  });

  it.each([
    ["an event name out of format", ["Unsubscribed", null, null, null]],
    [
      "an instant 21 minutes ahead",
      ["unsubscribed", minutesFromNow(21), null, null],
    ],
    [
      "an instant 21 minutes old",
      ["unsubscribed", minutesFromNow(-21), null, null],
    ],
    ["a message-id with a space", ["delivered", null, "<a b@x>", null]],
    [
      "an address without a local part",
      ["delivered", null, null, "@example.test"],
    ],
  ] as const)("refuses %s (22023)", async (_label, values) => {
    const [event, occurredAt, messageId, email] = values;
    const result = await scenario((tx) =>
      actAs(tx, "auth", () =>
        probe(tx, `select ${RECORD}`, [
          event,
          occurredAt ?? new Date().toISOString(),
          messageId,
          email,
          null,
          null,
          null,
        ]),
      ),
    );
    expect(result).toEqual({ outcome: "error", code: INVALID_PARAMETER });
  });

  it("is refused to influx_worker and to the business roles (42501)", async () => {
    const parameters = [
      "delivered",
      new Date().toISOString(),
      null,
      null,
      null,
      null,
      null,
    ];
    const worker = await inRolledBackTransaction(
      loginRole("influx_worker_login"),
      async (tx) => {
        await takeRole(tx, "influx_worker");
        return probe(tx, `select ${RECORD}`, parameters);
      },
    );
    const member = await inRolledBackTransaction(
      loginRole("influx_app"),
      async (tx) => {
        await takeRole(tx, "influx_creator", {
          accountId: dataSet.accounts.creator.a.id,
          role: "creator",
          aal: "aal1",
        });
        return probe(tx, `select ${RECORD}`, parameters);
      },
    );
    const denied: ProbeResult = {
      outcome: "error",
      code: INSUFFICIENT_PRIVILEGE,
    };
    expect(worker).toEqual(denied);
    expect(member).toEqual(denied);
  });
});

describe("leads.record_brevo_reconciliation_event() (E-4, influx_worker only)", () => {
  it("writes a reconciliation line with its INFLUX_ACCOUNT_ID, 47 hours back", async () => {
    const account = dataSet.accounts.advertiser.a.id;
    const line = await scenario(async (tx) => {
      const id = await actAs(tx, "worker", async () => {
        const [row] = await tx.unsafe<{ id: string }[]>(
          `select ${RECONCILE}::text as id`,
          [
            "unsubscribed",
            minutesFromNow(-47 * 60),
            null,
            "x@example.test",
            account,
            null,
            null,
            null,
          ],
        );
        return row?.id;
      });
      return id === undefined ? undefined : rawLine(tx, id);
    });
    expect(line).toMatchObject({
      origin: "reconciliation",
      event: "unsubscribed",
      account_ref: account,
    });
  });

  it("refuses an instant older than 168 hours (22023)", async () => {
    const result = await scenario((tx) =>
      actAs(tx, "worker", () =>
        probe(tx, `select ${RECONCILE}`, [
          "unsubscribed",
          minutesFromNow(-169 * 60),
          null,
          "x@example.test",
          null,
          null,
          null,
          null,
        ]),
      ),
    );
    expect(result).toEqual({ outcome: "error", code: INVALID_PARAMETER });
  });

  it("is refused to influx_auth (42501)", async () => {
    const result = await inRolledBackTransaction(
      loginRole("influx_auth_login"),
      async (tx) => {
        await takeRole(tx, "influx_auth");
        return probe(tx, `select ${RECONCILE}`, [
          "unsubscribed",
          new Date().toISOString(),
          null,
          null,
          null,
          null,
          null,
          null,
        ]);
      },
    );
    expect(result).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
  });
});

describe("leads.process_brevo_inbound_event() (E-3, influx_worker only)", () => {
  it("returns no row when no line waits", async () => {
    expect(await scenario((tx) => processNext(tx))).toBeUndefined();
  });

  it("withdraws a granted consent on the current address: consent, P0 to both contacts, contact state, address cleared", async () => {
    const account = dataSet.accounts.creator.b.id;
    const result = await scenario(async (tx) => {
      await setConsent(tx, account, true);
      const id = await receive(tx, "unsubscribed", {
        email: await emailOf(tx, account),
      });
      const processed = await processNext(tx);
      return {
        id,
        processed,
        outcome: id === null ? undefined : await outcomeOf(tx, id),
        line: id === null ? undefined : await rawLine(tx, id),
        effects: await effectsOn(tx, account),
      };
    });
    expect(result.processed).toEqual({
      inbound_event_id: result.id,
      outcome: "rights_withdrawn",
      audit_subject: account,
    });
    expect(result.outcome).toEqual({
      outcome: "rights_withdrawn",
      account_id: account,
    });
    expect(result.line?.email).toBeNull();
    expect(result.effects.consents).toEqual([
      {
        granted: false,
        source: "brevo_webhook",
        evidence: {
          inbound_event_id: result.id,
          event: "unsubscribed",
          origin: "webhook",
        },
      },
    ]);
    // RG78, RG74: priority 0, identifiers only
    expect(
      result.effects.queue.map((line) => [line.destination, line.priority]),
    ).toEqual([
      ["apollo_contact", 0],
      ["brevo_contact", 0],
    ]);
    for (const line of result.effects.queue) {
      expect(Object.keys(line.payload).sort()).toEqual([
        "account_id",
        "event_id",
        "purpose",
      ]);
    }
    expect(result.effects.state?.unsubscribed_at).not.toBeNull();
    expect(result.effects.state?.suppressed_reason).toBeNull();
    // a marketing event never closes the address (D37)
    expect(result.effects.incidents).toEqual([]);
    expect(result.effects.emailStatus).not.toBe("undeliverable");
  });

  it("changes nothing a second time: consent already refused and contact already unsubscribed => no_change", async () => {
    const account = dataSet.accounts.advertiser.b.id;
    const result = await scenario(async (tx) => {
      await setConsent(tx, account, false);
      await tx`
        insert into leads.contact_sync_states (account_id, destination, unsubscribed_at)
        values (${account}, 'brevo_contact', now() - interval '1 day')
        on conflict (account_id, destination)
        do update set unsubscribed_at = coalesce(leads.contact_sync_states.unsubscribed_at,
                                                 excluded.unsubscribed_at)`;
      await receive(tx, "unsubscribed", { email: await emailOf(tx, account) });
      return {
        processed: await processNext(tx),
        effects: await effectsOn(tx, account),
      };
    });
    expect(result.processed).toMatchObject({
      outcome: "no_change",
      audit_subject: null,
    });
    expect(result.effects.consents).toEqual([]);
    expect(result.effects.queue).toEqual([]);
  });

  it("records a complaint as a definitive suppression (RG93)", async () => {
    const account = dataSet.accounts.creator.a.id;
    const effects = await scenario(async (tx) => {
      await setConsent(tx, account, true);
      await receive(tx, "spam", { email: await emailOf(tx, account) });
      await processNext(tx);
      return effectsOn(tx, account);
    });
    expect(effects.state?.suppressed_reason).toBe("spam_complaint");
    expect(effects.consents).toHaveLength(1);
  });

  it("closes the address on a TRANSACTIONAL hard bounce (message-id of the journal): incident + undeliverable (D37)", async () => {
    const account = dataSet.accounts.advertiser.a.id;
    const effects = await scenario(async (tx) => {
      const messageId = await journalLine(tx, account);
      await receive(tx, "hard_bounce", {
        messageId,
        email: await emailOf(tx, account),
        reason: "550 mailbox unavailable",
      });
      const processed = await processNext(tx);
      return { processed, ...(await effectsOn(tx, account)) };
    });
    expect(effects.processed).toMatchObject({
      outcome: "rights_withdrawn",
      audit_subject: account,
    });
    expect(effects.incidents).toEqual([
      { channel: "transactional", incident_type: "hard_bounce" },
    ]);
    expect(effects.emailStatus).toBe("undeliverable");
  });

  it("never closes the address on a MARKETING hard bounce", async () => {
    const account = dataSet.accounts.advertiser.a.id;
    const effects = await scenario(async (tx) => {
      await receive(tx, "hard_bounce", { email: await emailOf(tx, account) });
      await processNext(tx);
      return effectsOn(tx, account);
    });
    expect(effects.incidents).toEqual([]);
    expect(effects.emailStatus).not.toBe("undeliverable");
    expect(effects.state?.unsubscribed_at).not.toBeNull();
  });

  it("applies nothing when the event's address is not the current one: address_mismatch", async () => {
    const account = dataSet.accounts.creator.b.id;
    const result = await scenario(async (tx) => {
      await setConsent(tx, account, true);
      const messageId = await journalLine(tx, account);
      const id = await receive(tx, "hard_bounce", {
        messageId,
        email: "former-address@example.test",
      });
      return {
        processed: await processNext(tx),
        outcome: id === null ? undefined : await outcomeOf(tx, id),
        effects: await effectsOn(tx, account),
      };
    });
    expect(result.processed).toMatchObject({
      outcome: "address_mismatch",
      audit_subject: null,
    });
    expect(result.outcome).toEqual({
      outcome: "address_mismatch",
      account_id: account,
    });
    expect(result.effects.consents).toEqual([]);
    expect(result.effects.incidents).toEqual([]);
    expect(result.effects.emailStatus).not.toBe("undeliverable");
  });

  it("attaches a reconciliation line by its INFLUX_ACCOUNT_ID", async () => {
    const account = dataSet.accounts.advertiser.b.id;
    const processed = await scenario(async (tx) => {
      await setConsent(tx, account, true);
      const email = await emailOf(tx, account);
      await actAs(tx, "worker", () =>
        tx.unsafe(`select ${RECONCILE}`, [
          "unsubscribed",
          minutesFromNow(-60),
          null,
          email,
          account,
          null,
          null,
          null,
        ]),
      );
      return processNext(tx);
    });
    expect(processed).toMatchObject({
      outcome: "rights_withdrawn",
      audit_subject: account,
    });
  });

  it.each([
    ["an unknown address", "unsubscribed", "unmatched"],
    ["an open (RG107: never nominative)", "opened", "informative"],
    ["a click", "click", "informative"],
    ["an event unknown to RG105", "list_teleported", "unknown_event"],
  ])(
    "records %s without an account, address cleared",
    async (_label, event, expected) => {
      const account = dataSet.accounts.creator.a.id;
      const result = await scenario(async (tx) => {
        const email =
          expected === "unmatched"
            ? "nobody@example.test"
            : await emailOf(tx, account);
        const id = await receive(tx, event, { email });
        return {
          processed: await processNext(tx),
          outcome: id === null ? undefined : await outcomeOf(tx, id),
          line: id === null ? undefined : await rawLine(tx, id),
          effects: await effectsOn(tx, account),
        };
      });
      expect(result.processed).toMatchObject({
        outcome: expected,
        audit_subject: null,
      });
      expect(result.outcome).toEqual({ outcome: expected, account_id: null });
      expect(result.line?.email).toBeNull();
      expect(result.effects.consents).toEqual([]);
    },
  );

  it("takes the oldest line first, one per call", async () => {
    const result = await scenario(async (tx) => {
      // both lines carry the transaction time as received_at: the id breaks the tie
      const first = await receive(tx, "delivered", { email: "a@example.test" });
      const second = await receive(tx, "delivered", {
        email: "b@example.test",
      });
      const one = await processNext(tx);
      const two = await processNext(tx);
      const three = await processNext(tx);
      return {
        ids: [first, second].sort(),
        taken: [one?.inbound_event_id, two?.inbound_event_id],
        three,
      };
    });
    expect([...result.taken].sort()).toEqual(result.ids);
    expect(result.three).toBeUndefined();
  });

  it("is refused to influx_auth (42501)", async () => {
    const result = await inRolledBackTransaction(
      loginRole("influx_auth_login"),
      async (tx) => {
        await takeRole(tx, "influx_auth");
        return probe(tx, "select * from leads.process_brevo_inbound_event()");
      },
    );
    expect(result).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
  });
});

describe("identity.record_transactional_hard_bounce() (reached from the leads owner only)", () => {
  it.each([
    ["influx_auth_login", "influx_auth"],
    ["influx_worker_login", "influx_worker"],
  ] as const)("is refused to %s (42501)", async (login, role) => {
    const result = await inRolledBackTransaction(
      loginRole(login),
      async (tx) => {
        await takeRole(tx, role);
        return probe(
          tx,
          "select identity.record_transactional_hard_bounce($1::uuid, $2, $3, now(), null)",
          [dataSet.accounts.creator.a.id, "x@example.test", "t-event"],
        );
      },
    );
    expect(result).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
  });

  it("counts a bounce notified twice once (provider_event_id), the status already closed", async () => {
    const account = dataSet.accounts.creator.a.id;
    const incidents = await scenario(async (tx) => {
      const messageId = await journalLine(tx, account);
      const email = await emailOf(tx, account);
      // the same Brevo event through the webhook and the reconciliation: two keys, two lines,
      // but the second finds the address already closed and its incident written once each
      await receive(tx, "hard_bounce", { messageId, email });
      await processNext(tx);
      const [again] = await tx<{ wrote: boolean }[]>`
        select identity.record_transactional_hard_bounce(${account}::uuid, ${email},
                 (select encode(dedup_key, 'hex') from leads.brevo_inbound_events
                   where provider_message_id = ${messageId}), now(), null) as wrote`;
      const rows = await effectsOn(tx, account);
      return {
        again: again?.wrote,
        count: rows.incidents.length,
        status: rows.emailStatus,
      };
    });
    expect(incidents).toEqual({
      again: false,
      count: 1,
      status: "undeliverable",
    });
  });
});

describe("guards of the raw tables (append-only, address cleared, 30 days)", () => {
  async function guarded(
    statement: (id: string) => string,
    withOutcome: boolean,
  ): Promise<ProbeResult> {
    return scenario(async (tx) => {
      const id = await receive(tx, "delivered", {
        email: "guard@example.test",
      });
      if (id === null) {
        throw new Error("no line");
      }
      if (withOutcome) {
        await tx`
          insert into leads.brevo_inbound_outcomes (event_id, outcome)
          values (${id}, 'informative')`;
      }
      return probe(tx, statement(id));
    });
  }

  it.each([
    [
      "changes the event",
      (id: string) =>
        `update leads.brevo_inbound_events set event = 'spam' where id = '${id}'`,
      true,
    ],
    [
      "clears the address without an outcome",
      (id: string) =>
        `update leads.brevo_inbound_events set email = null where id = '${id}'`,
      false,
    ],
    [
      "deletes a line processed today",
      (id: string) =>
        `delete from leads.brevo_inbound_events where id = '${id}'`,
      true,
    ],
    [
      "deletes a line without an outcome",
      (id: string) =>
        `delete from leads.brevo_inbound_events where id = '${id}'`,
      false,
    ],
    [
      "changes an outcome",
      (id: string) =>
        `update leads.brevo_inbound_outcomes set outcome = 'unmatched' where event_id = '${id}'`,
      true,
    ],
    [
      "truncates the raw lines",
      () => "truncate leads.brevo_inbound_events cascade",
      true,
    ],
  ] as const)(
    "stops even the superuser when it %s (42501)",
    async (_label, statement, withOutcome) => {
      expect(await guarded(statement, withOutcome)).toEqual({
        outcome: "error",
        code: INSUFFICIENT_PRIVILEGE,
      });
    },
  );

  it("lets the address be cleared once the outcome exists", async () => {
    expect(
      await guarded(
        (id) =>
          `update leads.brevo_inbound_events set email = null where id = '${id}'`,
        true,
      ),
    ).toEqual({ outcome: "rows", count: 1 });
  });
});

// TM1 (J7, commit 4) — what Brevo reports back, processed by the worker (decisions 1, 2 and 5 of the
// J7 start; 16 §I RG105 to RG108; 05 §J RG89, RG90, RG93; 18 TM1.5; 05 CA52, CA54, CA55; 16 RG148
// scenario 7). Real database, the worker's module and pool (influx_worker_login, E-3
// inbound/processing.ts), the webhook route of the api (E-1, influx_auth) and the Brevo double on
// the loopback, which also writes the bodies Brevo posts (16 RG148: no test reaches Brevo). The
// rules of leads.process_brevo_inbound_event() are tm1-brevo-inbound; the connectors alone,
// tests/brevo-connector; the loop, tests/leads-drain.
// Accounts, queue lines and raw lines are COMMITTED (the route and the worker write in their own
// transactions). The processing takes "the oldest raw line without an outcome": every waiting line
// is processed before and after each case; the pending queue lines of other files are held while
// the drain claims, as in tm1-brevo-connector.
import {
  startBrevoDouble,
  type BrevoDouble,
} from "@influx/test-kit/brevo-double";
import { WITHDRAWING_EVENTS } from "@influx/contracts/brevo-webhook";
import { inRolledBackTransaction, localRoleUrl } from "@influx/test-kit/db";
import { captureLogStream, valuesFoundIn } from "@influx/test-kit/logs";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  closeDatabase,
  createApiDatabase,
  createWorkerDatabase,
  type ApiDatabase,
  type WorkerDatabase,
} from "../src/db/index.ts";
import { createBrevoConnectors } from "../src/domains/leads/connectors/brevo/index.ts";
import { createOutboxDrain } from "../src/domains/leads/drain.ts";
import {
  createInboundProcessor,
  processInboundEvent,
} from "../src/domains/leads/inbound/processing.ts";
import {
  createWorkerQueue,
  readBrevoErasureSubjectOf,
  readBrevoSubjectOf,
} from "../src/domains/leads/queue.ts";
import type { ClaimedLine } from "../src/domains/leads/repository.ts";
import { createLogger } from "../src/platform/logger.ts";
import { buildServer } from "../src/server.ts";
import { captureLogs, testApiConfig, WEB_SECRET } from "../tests/helpers.ts";
import {
  actAs,
  actAsMember,
  localSuperuser,
  migrationRole,
} from "./support.ts";

const PATH_TOKEN = "Cq4-_y8RzS6kLmN2pV8wYt4uHc6eJf1oGs5iDn0aB_d";
const HEADER_TOKEN = "hT5-header-token-worker-0123456789abcdefghi";
const BREVO_ADDRESS = "1.179.112.40";
const LISTS = { advertisers: 2, creators: 3 };
const SUPPRESSION_LIST = 7;

let migration: postgres.Sql;
let double: BrevoDouble;
let worker: WorkerDatabase;
let api: ApiDatabase;
const logs = captureLogStream();

const accounts: string[] = [];
const emails: string[] = [];

function workerLogger() {
  return createLogger(
    { service: "worker", environment: "staging", version: "test" },
    logs.destination,
  );
}

/** Every waiting raw line processed by the worker's module: the stack is left clean. */
async function processWaiting(): Promise<number> {
  let processed = 0;
  while ((await processInboundEvent(worker, randomUUID())) !== null) {
    processed += 1;
  }
  return processed;
}

beforeAll(async () => {
  migration = migrationRole();
  double = await startBrevoDouble();
  // left as set after the file: a Brevo id never goes back to null (05 RG163 (1), 0145)
  await migration`
    update leads.sync_settings set value = ${JSON.stringify(LISTS)}::text::jsonb
     where key = 'brevo_list_ids'`;
  worker = createWorkerDatabase(
    {
      worker: {
        url: localRoleUrl("influx_worker_login"),
        role: "influx_worker_login",
        tls: false,
      },
    },
    workerLogger(),
  );
  api = createApiDatabase(
    {
      app: {
        url: localRoleUrl("influx_app"),
        role: "influx_app",
        tls: false,
      },
      auth: {
        url: localRoleUrl("influx_auth_login"),
        role: "influx_auth_login",
        tls: false,
      },
      ops: {
        url: localRoleUrl("influx_ops_login"),
        role: "influx_ops_login",
        tls: false,
      },
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
  await processWaiting();
});

afterAll(async () => {
  await processWaiting();
  await closeDatabase(worker);
  await closeDatabase(api);
  await double.close();
});

beforeEach(async () => {
  double.reset();
  await processWaiting();
});

afterEach(async () => {
  await processWaiting();
  const subjects = accounts.splice(0).map((id) => `account:${id}`);
  emails.length = 0;
  if (subjects.length > 0) {
    await migration`
      delete from leads.transactional_sends
       where outbox_event_id in (select id from leads.outbox_events
                                  where subject_key = any (${subjects}::text[]))`;
    await migration`
      delete from leads.outbox_events where subject_key = any (${subjects}::text[])`;
    await migration`
      delete from leads.contact_sync_states
       where account_id = any (${subjects.map((subject) => subject.slice("account:".length))}::uuid[])`;
  }
});

type Account = { id: string; email: string };

/** A committed creator as the sign-up leaves it, its marketing consent given or refused. */
async function createAccount(
  consent = true,
  email = `tm1-inbound-${randomUUID()}@example.test`,
): Promise<Account> {
  const id = randomUUID();
  await migration.begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         declared_status, is_adult_attested, adult_attested_at)
      values (${id}, ${randomUUID()}, ${email}, now(), 'BE', 'fr',
              'individual'::identity.declared_status, true, now())`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${id}, 'creator'::identity.account_role)`;
    await tx`
      insert into identity.consent_events (account_id, purpose, granted, source)
      values (${id}, 'marketing_email', ${consent}, 'signup_form'),
             (${id}, 'commercial_prospection', ${consent}, 'signup_form')`;
  });
  accounts.push(id);
  emails.push(email);
  return { id, email };
}

/** A queue line of the account for brevo_contact, keyed as the emitters key it. */
async function insertContactLine(
  account: string,
  eventType: "lead.created" | "lead.updated" | "email.changed",
  extra: Record<string, unknown> = {},
): Promise<string> {
  const event = randomUUID();
  const [row] = await migration<{ id: string }[]>`
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    values (${event}, ${eventType}, 'brevo_contact', ${`account:${account}`}, 100,
            ${JSON.stringify({ event_id: event, account_id: account, ...extra })}::text::jsonb,
            ${`${eventType}:${event}`})
    returning id::text as id`;
  if (row === undefined) {
    throw new Error("the queue line was not inserted");
  }
  return row.id;
}

/** One turn of the worker as worker.ts builds it: the raw lines, then the queue, live. */
async function turn(): Promise<number> {
  const name = `tm1-inbound-${randomUUID().slice(0, 8)}`;
  const logger = workerLogger();
  const brevo = createBrevoConnectors(
    {
      mode: "redirect",
      testRecipients: [...emails],
      apiKey: "local-double-key",
      baseUrl: double.baseUrl,
      senderTransactional: "no-reply@tx.influx.example",
      suppressionListId: SUPPRESSION_LIST,
    },
    {
      readSubject: (line) =>
        readBrevoSubjectOf(worker, randomUUID(), line, name),
      readErasureSubject: (line) =>
        readBrevoErasureSubjectOf(worker, randomUUID(), line, name),
      readErasureNotificationSubject: () => Promise.resolve(null),
      readProfileDecision: () => Promise.resolve(null),
      readBrandProfile: () => Promise.resolve(null),
      readVerificationEmail: () => Promise.resolve(null),
      readBadgeEmail: () => Promise.resolve(null),
      readVerifiedBadge: () => Promise.resolve(null),
      logger,
    },
  );
  const drain = createOutboxDrain({
    queue: createWorkerQueue(worker),
    connectors: { brevo_contact: brevo.contact },
    inbound: createInboundProcessor({
      process: (requestId) => processInboundEvent(worker, requestId),
      logger,
    }),
    worker: name,
    startedAt: "2026-01-01T00:00:00.000Z",
    sync: {
      mode: "live",
      recipientFilter: { kind: "allowlist", domains: ["example.test"] },
      keyRequired: false,
    },
    logger,
    now: () => Date.now(),
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
  });
  const subjects = accounts.map((id) => `account:${id}`);
  return inRolledBackTransaction(migration, async (blocker) => {
    await blocker`
      select id from leads.outbox_events
       where status = 'pending' and not (subject_key = any (${subjects}::text[]))
         for update`;
    return drain.turn(new AbortController().signal);
  });
}

function app() {
  const captured = captureLogs();
  const server = buildServer(
    {
      ...testApiConfig(),
      brevoWebhook: { pathTokens: [PATH_TOKEN], headerTokens: [HEADER_TOKEN] },
    },
    { logDestination: captured.destination, database: api },
  );
  return server;
}

/** Brevo posts the body to the webhook of staging (decision 1: both tokens, a Brevo address). */
async function post(body: unknown): Promise<number> {
  const server = app();
  try {
    const response = await server.inject({
      method: "POST",
      url: `/v1/webhooks/brevo/${PATH_TOKEN}`,
      headers: {
        "x-influx-internal": WEB_SECRET,
        "content-type": "application/json",
        "x-real-ip": BREVO_ADDRESS,
        "brevo-webhook-token": HEADER_TOKEN,
      },
      payload: JSON.stringify(body),
    });
    return response.statusCode;
  } finally {
    await server.close();
  }
}

async function rawLinesOf(email: string) {
  // The address is cleared once processed: the waiting lines are found by it, the others by
  // the outcome's account.
  return migration<{ id: string }[]>`
    select id::text as id from leads.brevo_inbound_events where email = ${email}`;
}

type Consent = { granted: boolean; source: string };

async function consentsOf(account: string): Promise<Consent[]> {
  return migration<Consent[]>`
    select granted, source::text as source from identity.consent_events
     where account_id = ${account} and purpose = 'marketing_email'
     order by occurred_at, granted desc`;
}

async function contactStateOf(account: string) {
  const [row] = await migration<
    { unsubscribed: boolean; suppressed_reason: string | null }[]
  >`
    select unsubscribed_at is not null as unsubscribed, suppressed_reason
      from leads.contact_sync_states
     where account_id = ${account} and destination = 'brevo_contact'`;
  return row ?? null;
}

async function registerOf(requestId: string) {
  return migration<{ event_type: string; subject_id: string }[]>`
    select event_type, subject_id::text as subject_id
      from audit.audit_events where request_id = ${requestId}`;
}

describe("18 TM1.5, 05 CA52, RG89: an unsubscription reported by Brevo", () => {
  it("writes identity.consent_events (brevo_webhook) AND unsubscribed_at, propagates at priority 0, one register line", async () => {
    const { id, email } = await createAccount();
    expect(
      await post(
        double.webhookEvent("unsubscribed", email, { campaignId: 54 }),
      ),
    ).toBe(200);
    expect(await rawLinesOf(email)).toHaveLength(1);

    const requestId = randomUUID();
    const processed = await processInboundEvent(worker, requestId);

    expect(processed).toMatchObject({
      outcome: "rights_withdrawn",
      auditSubject: id,
    });
    expect(await consentsOf(id)).toEqual([
      { granted: true, source: "signup_form" },
      { granted: false, source: "brevo_webhook" },
    ]);
    expect(await contactStateOf(id)).toEqual({
      unsubscribed: true,
      suppressed_reason: null,
    });
    // RG78, TM1.9: consent.revoked ahead of the whole queue, to both contacts, ids only
    const lines = await migration<
      {
        destination: string;
        priority: number;
        payload: Record<string, unknown>;
      }[]
    >`
      select destination::text as destination, priority, payload
        from leads.outbox_events
       where subject_key = ${`account:${id}`} and event_type = 'consent.revoked'
       order by destination`;
    expect(
      lines.map(({ destination, priority }) => [destination, priority]),
    ).toEqual([
      ["apollo_contact", 0],
      ["brevo_contact", 0],
    ]);
    expect(Object.keys(lines[0]?.payload ?? {}).sort()).toEqual([
      "account_id",
      "event_id",
      "purpose",
    ]);
    // Decision 1: one elevated line for one effective change, on the account
    expect(await registerOf(requestId)).toEqual([
      { event_type: "elevated.leads.drain_outbox", subject_id: id },
    ]);
    // Decision 2: the address of the raw line is gone once its outcome is written
    expect(await rawLinesOf(email)).toEqual([]);
  });

  it("CA52: the member reads the withdrawal as the consent in force, with its origin (RG95)", async () => {
    const { id, email } = await createAccount();
    await post(double.webhookEvent("unsubscribed", email));
    await processWaiting();
    const [inForce] = await localSuperuser().begin((tx) =>
      actAsMember(
        tx,
        "influx_creator",
        { accountId: id, role: "creator", aal: "aal1" },
        () => tx<Consent[]>`
          select granted, source::text as source from identity.consent_events
           where purpose = 'marketing_email'
           order by occurred_at desc, granted
           limit 1`,
      ),
    );
    expect(inForce).toEqual({ granted: false, source: "brevo_webhook" });
  });

  it("RG90: Brevo is right even when INFLUX thought the consent refused: nothing to withdraw, the contact state set", async () => {
    const { id, email } = await createAccount(false);
    await post(double.webhookEvent("unsubscribed", email));
    const processed = await processInboundEvent(worker, randomUUID());
    expect(processed?.outcome).toBe("rights_withdrawn");
    expect(await consentsOf(id)).toEqual([
      { granted: false, source: "signup_form" },
    ]);
    expect((await contactStateOf(id))?.unsubscribed).toBe(true);
  });
});

describe("16 RG106: every event the webhook subscribes to withdraws a right", () => {
  it("unsubscribed, spam, hard_bounce, invalid_email, blocked: each one withdraws the consent", async () => {
    const outcomes: Record<string, string | undefined> = {};
    for (const event of WITHDRAWING_EVENTS) {
      const { id, email } = await createAccount();
      expect(
        await post({ ...double.webhookEvent("hard_bounce", email), event }),
      ).toBe(200);
      outcomes[event] = (await processInboundEvent(worker, randomUUID()))
        ?.outcome;
      expect((await consentsOf(id)).at(-1)).toEqual({
        granted: false,
        source: "brevo_webhook",
      });
    }
    expect(outcomes).toEqual(
      Object.fromEntries(
        WITHDRAWING_EVENTS.map((event) => [event, "rights_withdrawn"]),
      ),
    );
  });
});

describe("05 CA54: the same unsubscription received twice records one consent event", () => {
  it("the identical body twice, then found again by the reconciliation: one raw line, one withdrawal", async () => {
    const { id, email } = await createAccount();
    const body = double.webhookEvent("unsubscribed", email, { campaignId: 54 });
    expect(await post(body)).toBe(200);
    expect(await post(body)).toBe(200);
    expect(await rawLinesOf(email)).toHaveLength(1);
    await processWaiting();

    // the same event, found by the reconciliation of the next day (E-4, commit 5): already known
    const [found] = await localSuperuser().begin((tx) =>
      actAs(
        tx,
        "worker",
        () => tx<{ id: string | null }[]>`
          select leads.record_brevo_reconciliation_event(
                   'unsubscribed', to_timestamp(${body.ts_event as number}), null, ${email},
                   ${id}::uuid, 54, null, null)::text as id`,
      ),
    );
    expect(found?.id).toBeNull();
    expect(
      (await consentsOf(id)).filter(({ source }) => source === "brevo_webhook"),
    ).toHaveLength(1);
  });

  it("a second, distinct unsubscription changes nothing: no_change, no consent event, no register line", async () => {
    const { id, email } = await createAccount();
    await post(double.webhookEvent("unsubscribed", email, { campaignId: 54 }));
    await processWaiting();
    await post(
      double.webhookEvent("unsubscribed", email, {
        campaignId: 55,
        tsEvent: Math.floor(Date.now() / 1000) - 60,
      }),
    );
    const requestId = randomUUID();
    expect(await processInboundEvent(worker, requestId)).toMatchObject({
      outcome: "no_change",
      auditSubject: null,
    });
    expect(await registerOf(requestId)).toEqual([]);
    expect(
      (await consentsOf(id)).filter(({ source }) => source === "brevo_webhook"),
    ).toHaveLength(1);
  });
});

describe("05 CA55, RG93: a complaint is a definitive suppression", () => {
  it("the contact suppressed; a replay after a new consent never resynchronises it", async () => {
    const { id, email } = await createAccount();
    await insertContactLine(id, "lead.created");
    await turn();
    expect(double.contacts.get(email)?.emailBlacklisted).toBe(false);

    // the person marks a newsletter as spam; Brevo blacklists the contact and reports it
    expect(
      await post(double.webhookEvent("spam", email, { campaignId: 54 })),
    ).toBe(200);
    await turn();
    expect(await contactStateOf(id)).toEqual({
      unsubscribed: true,
      suppressed_reason: "spam_complaint",
    });
    expect(double.lists.get(SUPPRESSION_LIST)?.has(email)).toBe(true);

    // later, a new consent given in the member space, then an ordinary replay
    await migration`
      insert into identity.consent_events (account_id, purpose, granted, source)
      values (${id}, 'marketing_email', true, 'account_settings')`;
    const replayed = await insertContactLine(id, "lead.updated");
    const before = double.requests.length;
    await turn();

    const [line] = await migration<{ status: string }[]>`
      select status::text as status from leads.outbox_events where id = ${replayed}`;
    expect(line?.status).toBe("succeeded");
    expect(
      double.requests
        .slice(before)
        .map((request) => `${request.method} ${request.path}`),
    ).toEqual([
      `PUT /v3/contacts/${encodeURIComponent(email)}`,
      `POST /v3/contacts/lists/${SUPPRESSION_LIST}/contacts/add`,
    ]);
    expect(double.contacts.get(email)?.emailBlacklisted).toBe(true);
  });

  it("only the leads owner sets the suppression, and the admin's lift (0134) only clears it: no member, agent, admin nor execution role", async () => {
    const writers = await migration<{ grantee: string }[]>`
      select distinct grantee::text as grantee
        from information_schema.column_privileges
       where table_schema = 'leads' and table_name = 'contact_sync_states'
         and column_name = 'suppressed_reason'
         and privilege_type in ('INSERT', 'UPDATE')
         and grantee <> (select tableowner from pg_catalog.pg_tables
                          where schemaname = 'leads' and tablename = 'contact_sync_states')
       order by 1`;
    expect(writers).toEqual([
      { grantee: "influx_identity_definer" },
      { grantee: "influx_leads_definer" },
    ]);
    // 0134 backoffice.lift_brevo_suppression(): UPDATE only, to NULL only, on Brevo's state only
    const policies = await migration<
      { cmd: string; qual: string; with_check: string }[]
    >`
      select cmd, qual, with_check
        from pg_catalog.pg_policies
       where schemaname = 'leads' and tablename = 'contact_sync_states'
         and 'influx_identity_definer' = any (roles) and cmd <> 'SELECT'`;
    expect(policies).toHaveLength(1);
    expect(policies[0]?.cmd).toBe("UPDATE");
    expect(policies[0]?.with_check).toContain("suppressed_reason IS NULL");
    expect(policies[0]?.with_check).toContain("brevo_contact");
  });
});

describe("D37, 04 §5.1: a hard bounce of a transactional e-mail closes the address", () => {
  it("incident + undeliverable on the current address, the e-mail's message-id from the journal", async () => {
    const { id, email } = await createAccount();
    const messageId = `<${randomUUID()}@smtp-relay.mailin.fr>`;
    await migration`
      insert into leads.transactional_sends
        (email_code, priority, account_id, locale, provider_message_id, status, sent_at)
      values ('auth.login_code', 'p0', ${id}, 'fr', ${messageId}, 'sent', now())`;
    await post(double.webhookEvent("hard_bounce", email, { messageId }));
    expect((await processInboundEvent(worker, randomUUID()))?.outcome).toBe(
      "rights_withdrawn",
    );
    const incidents = await migration<
      { channel: string; incident_type: string }[]
    >`
      select channel::text as channel, incident_type::text as incident_type
        from identity.email_delivery_incidents where account_id = ${id}`;
    expect(incidents).toEqual([
      { channel: "transactional", incident_type: "hard_bounce" },
    ]);
    const [account] = await migration<{ email_status: string }[]>`
      select email_status::text as email_status from identity.accounts where id = ${id}`;
    expect(account?.email_status).toBe("undeliverable");
    await migration`delete from leads.transactional_sends where provider_message_id = ${messageId}`;
  });
});

describe("16 RG105, RG107: what informs and what is unknown changes nothing and names no one", () => {
  it("an unknown event: accepted, journaled by its line id, ignored", async () => {
    const { id, email } = await createAccount();
    const before = logs.lines().length;
    await post(double.webhookEvent("unknown", email));
    await turn();
    const [outcome] = await migration<
      { outcome: string; account_id: string | null }[]
    >`
      select o.outcome::text as outcome, o.account_id::text as account_id
        from leads.brevo_inbound_outcomes o
       order by o.processed_at desc limit 1`;
    expect(outcome).toEqual({ outcome: "unknown_event", account_id: null });
    expect(await consentsOf(id)).toEqual([
      { granted: true, source: "signup_form" },
    ]);
    const written = logs.lines().slice(before).join("\n");
    expect(written).toContain("leads.brevo_inbound.unknown_event");
    expect(valuesFoundIn(written, [email, id, "contact_merged"])).toEqual([]);
  });

  it("an open: informative, no account on the outcome, no register line", async () => {
    const { email } = await createAccount();
    await post(double.webhookEvent("opened", email, { campaignId: 54 }));
    const requestId = randomUUID();
    expect(await processInboundEvent(worker, requestId)).toMatchObject({
      outcome: "informative",
      auditSubject: null,
    });
    expect(await registerOf(requestId)).toEqual([]);
  });
});

describe("16 RG148 scenario 7: an unsubscription by webhook, withdrawn in the database and propagated", () => {
  it("the contact at Brevo, the link clicked, the webhook: one turn withdraws, then unsubscribes and excludes", async () => {
    const { id, email } = await createAccount();
    await insertContactLine(id, "lead.created");
    await turn();
    double.requests.length = 0;

    expect(await post(double.webhookEvent("unsubscribed", email))).toBe(200);
    await turn();

    expect((await consentsOf(id)).at(-1)).toEqual({
      granted: false,
      source: "brevo_webhook",
    });
    const lines = await migration<{ destination: string; status: string }[]>`
      select destination::text as destination, status::text as status
        from leads.outbox_events
       where subject_key = ${`account:${id}`} and event_type = 'consent.revoked'
       order by destination`;
    // Apollo has no connector in this process: its line waits (Apollo unchanged at J7)
    expect(lines).toEqual([
      { destination: "apollo_contact", status: "pending" },
      { destination: "brevo_contact", status: "succeeded" },
    ]);
    expect(
      double.requests.map((request) => `${request.method} ${request.path}`),
    ).toEqual([
      `PUT /v3/contacts/${encodeURIComponent(email)}`,
      `POST /v3/contacts/lists/${SUPPRESSION_LIST}/contacts/add`,
    ]);
    expect(double.lists.get(SUPPRESSION_LIST)?.has(email)).toBe(true);
  });
});

describe("0121, 05 RG58, J7 decision 5: email.changed moves the contact by its Brevo id", () => {
  /** A completed request from `oldEmail` to the account's current address. */
  async function completedRequest(
    account: string,
    oldEmail: string,
    newEmail: string,
  ) {
    const [row] = await migration<{ id: string }[]>`
      insert into identity.email_change_requests
        (account_id, old_email, new_email, old_code_hash, new_code_hash)
      values (${account}, ${oldEmail}, ${newEmail}, decode(repeat('ab', 32), 'hex'),
              decode(repeat('cd', 32), 'hex'))
      returning id::text as id`;
    if (row === undefined) {
      throw new Error("the request was not inserted");
    }
    await migration`
      update identity.email_change_requests
         set old_confirmed_at = now(), new_confirmed_at = now(), completed_at = now(),
             old_code_hash = null, new_code_hash = null
       where id = ${row.id}`;
    return row.id;
  }

  it("reads the old address of the completed request, the Brevo id and the suppression", async () => {
    const oldEmail = `tm1-inbound-old-${randomUUID()}@example.test`;
    const { id, email } = await createAccount();
    const request = await completedRequest(id, oldEmail, email);
    await migration`
      insert into leads.contact_sync_states
        (account_id, destination, external_contact_id, last_status, suppressed_reason)
      values (${id}, 'brevo_contact', '4242', 'succeeded', 'spam_complaint')`;
    const lineId = await insertContactLine(id, "email.changed", {
      request_id: request,
    });
    const name = "tm1-inbound-reader";
    await migration`
      update leads.outbox_events
         set status = 'processing', locked_by = ${name}, locked_at = now()
       where id = ${lineId}`;
    const claimed: ClaimedLine = {
      id: lineId,
      eventId: randomUUID(),
      eventType: "email.changed",
      destination: "brevo_contact",
      subjectKey: `account:${id}`,
      priority: 100,
      payload: {},
      idempotencyKey: "unused",
    };
    expect(
      await readBrevoSubjectOf(worker, randomUUID(), claimed, name),
    ).toMatchObject({
      email,
      previousEmail: oldEmail,
      externalContactId: "4242",
      suppressed: true,
    });
  });

  it("an open request is never read, nor another account's: previousEmail null", async () => {
    const other = await createAccount();
    const { id } = await createAccount();
    const foreign = await completedRequest(
      other.id,
      `tm1-inbound-old-${randomUUID()}@example.test`,
      other.email,
    );
    const lineId = await insertContactLine(id, "email.changed", {
      request_id: foreign,
    });
    const name = "tm1-inbound-reader";
    await migration`
      update leads.outbox_events
         set status = 'processing', locked_by = ${name}, locked_at = now()
       where id = ${lineId}`;
    const subject = await readBrevoSubjectOf(
      worker,
      randomUUID(),
      {
        id: lineId,
        eventId: randomUUID(),
        eventType: "email.changed",
        destination: "brevo_contact",
        subjectKey: `account:${id}`,
        priority: 100,
        payload: {},
        idempotencyKey: "unused",
      },
      name,
    );
    expect(subject).toMatchObject({
      previousEmail: null,
      externalContactId: null,
      suppressed: false,
    });
  });

  it("through the queue: one contact at Brevo, moved to the new address, never a second one", async () => {
    const oldEmail = `tm1-inbound-old-${randomUUID()}@example.test`;
    const { id } = await createAccount(true, oldEmail);
    await insertContactLine(id, "lead.created");
    await turn();
    expect(double.contacts.get(oldEmail)?.id).toBe(1);

    // the change completed (commit 7): the account carries the new address
    const newEmail = `tm1-inbound-new-${randomUUID()}@example.test`;
    emails.push(newEmail);
    const request = await completedRequest(id, oldEmail, newEmail);
    await migration`update identity.accounts set email = ${newEmail} where id = ${id}`;
    const lineId = await insertContactLine(id, "email.changed", {
      request_id: request,
    });
    await turn();

    const [line] = await migration<{ status: string }[]>`
      select status::text as status from leads.outbox_events where id = ${lineId}`;
    expect(line?.status).toBe("succeeded");
    expect(double.requests.at(-1)?.path).toBe(
      "/v3/contacts/1?identifierType=contact_id",
    );
    expect([...double.contacts.keys()]).toEqual([newEmail]);
    expect(double.contacts.get(newEmail)?.attributes.INFLUX_ACCOUNT_ID).toBe(
      id,
    );
  });
});

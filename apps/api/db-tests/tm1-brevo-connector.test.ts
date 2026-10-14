// TM1 (J6, commit 4) — the Brevo connectors on the real queue: the worker's module and pool
// (influx_worker_login), its own read leads.read_brevo_subject() (0112) and the Brevo double on
// the loopback (16 RG148: no test reaches Brevo). 05 CA38 to CA41 with the contact state and the
// journal written by the database, RG142 on the attributes read back from the double, the local
// belt of 16 RG90 (one welcome per account, replay included), the guards of the read (a line of
// this worker, a Brevo line only), and the notice of a changed address to both addresses (RG58,
// J7 commit 7), and the e-mail auth.new_device written by INFLUX from the session named by its line
// (05 RG142, 16 RG157, J7 commit 8). The connectors alone are tested in tests/brevo-connector.
// Accounts and lines are COMMITTED by the migration role (the worker reads in its own
// transactions); the other pending lines of the stack are held while the worker claims, as in
// tm1-worker-loop. The settings brevo_list_ids and brevo_template_ids are set for the file and
// restored after it.
import {
  startBrevoDouble,
  type BrevoDouble,
} from "@influx/test-kit/brevo-double";
import { inRolledBackTransaction, localRoleUrl } from "@influx/test-kit/db";
import { captureLogStream, valuesFoundIn } from "@influx/test-kit/logs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
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
  createWorkerDatabase,
  type WorkerDatabase,
} from "../src/db/index.ts";
import { createBrevoConnectors } from "../src/domains/leads/connectors/brevo/index.ts";
import { createOutboxDrain } from "../src/domains/leads/drain.ts";
import {
  createWorkerQueue,
  LineTakenBackError,
  readBrevoSubjectOf,
} from "../src/domains/leads/queue.ts";
import type { ClaimedLine } from "../src/domains/leads/repository.ts";
import { createLogger } from "../src/platform/logger.ts";
import { localSuperuser, migrationRole } from "./support.ts";

const INVALID_PARAMETER = "22023";
const UNIQUE_VIOLATION = "23505";
const LEGAL_NAME = "Maison Verbeke-Lambrecht";
const LISTS = { advertisers: 2, creators: 3 };
const TEMPLATES = {
  "account.welcome_advertiser": 11,
  "account.welcome_creator": 12,
  "auth.email_changed_notice": 21,
};

let migration: postgres.Sql;
let double: BrevoDouble;
let database: WorkerDatabase;
let savedSettings: { key: string; value: unknown }[];
const logs = captureLogStream();

const lines: string[] = [];
const accounts: string[] = [];
const emails: string[] = [];

beforeAll(async () => {
  migration = migrationRole();
  double = await startBrevoDouble();
  savedSettings = await migration<{ key: string; value: unknown }[]>`
    select key, value from leads.sync_settings
     where key in ('brevo_list_ids', 'brevo_template_ids')`;
  await migration`
    update leads.sync_settings set value = ${JSON.stringify(LISTS)}::text::jsonb
     where key = 'brevo_list_ids'`;
  await migration`
    update leads.sync_settings set value = ${JSON.stringify(TEMPLATES)}::text::jsonb
     where key = 'brevo_template_ids'`;
  database = createWorkerDatabase(
    {
      worker: {
        url: localRoleUrl("influx_worker_login"),
        role: "influx_worker_login",
        tls: false,
      },
    },
    createLogger(
      { service: "worker", environment: "staging", version: "test" },
      logs.destination,
    ),
  );
});

afterAll(async () => {
  for (const { key, value } of savedSettings) {
    await migration`
      update leads.sync_settings set value = ${JSON.stringify(value)}::text::jsonb
       where key = ${key}`;
  }
  await closeDatabase(database);
  await double.close();
});

beforeEach(() => {
  double.reset();
});

afterEach(async () => {
  const lineIds = lines.splice(0);
  const accountIds = accounts.splice(0);
  emails.length = 0;
  if (lineIds.length > 0) {
    await migration`
      delete from leads.transactional_sends where outbox_event_id = any (${lineIds}::bigint[])`;
    await migration`
      delete from leads.outbox_events where id = any (${lineIds}::bigint[])`;
  }
  if (accountIds.length > 0) {
    await migration`
      delete from leads.contact_sync_states where account_id = any (${accountIds}::uuid[])`;
  }
});

type AccountSpec = {
  role: "advertiser" | "creator";
  consent?: boolean;
  language?: "fr" | "en";
};

/** A committed account as the sign-up leaves it (0109): role, consents, acquisition source. */
async function createAccount(spec: AccountSpec): Promise<string> {
  const id = randomUUID();
  const email = `tm1-brevo-${id}@example.test`;
  const creator = spec.role === "creator";
  await migration.begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         declared_status, is_adult_attested, adult_attested_at, signup_utm_source,
         signup_heard_from)
      values (${id}, ${randomUUID()}, ${email}, now(), 'BE', ${spec.language ?? "fr"},
              ${creator ? "individual" : "business"}::identity.declared_status,
              ${creator}, case when ${creator} then now() end, 'newsletter',
              'social_media'::identity.heard_from)`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${id}, ${spec.role}::identity.account_role)`;
    await tx`
      insert into identity.consent_events (account_id, purpose, granted, source)
      values (${id}, 'marketing_email', ${spec.consent ?? true}, 'signup_form'),
             (${id}, 'commercial_prospection', ${spec.consent ?? true}, 'signup_form')`;
    if (!creator) {
      await tx`
        insert into profiles.advertiser_profiles (account_id, legal_name)
        values (${id}, ${LEGAL_NAME})`;
    }
  });
  accounts.push(id);
  emails.push(email);
  return id;
}

/** The two Brevo lines of lead.created (EC-10), keyed as identity.provision_account() keys them. */
async function insertSignupLines(
  account: string,
  role: AccountSpec["role"],
): Promise<{ contact: string; welcome: string }> {
  const event = randomUUID();
  const rows = await migration<{ id: string; destination: string }[]>`
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
    values
      (${event}, 'lead.created', 'brevo_contact', ${`account:${account}`}, 100,
       ${JSON.stringify({ event_id: event, account_id: account })}::text::jsonb,
       ${`lead.created:${event}`}),
      (${event}, 'lead.created', 'brevo_transactional', ${`account:${account}`}, 100,
       ${JSON.stringify({ event_id: event, account_id: account, email_code: `account.welcome_${role}` })}::text::jsonb,
       ${`account.welcome:${account}`})
    returning id::text as id, destination::text as destination`;
  lines.push(...rows.map((row) => row.id));
  const contact = rows.find((row) => row.destination === "brevo_contact");
  const welcome = rows.find((row) => row.destination === "brevo_transactional");
  if (contact === undefined || welcome === undefined) {
    throw new Error("the queue lines were not inserted");
  }
  return { contact: contact.id, welcome: welcome.id };
}

/** A J8 replay, by hand: the closed line back to pending, its attempts given back. */
async function replay(id: string): Promise<void> {
  await migration`
    update leads.outbox_events
       set status = 'pending', attempts = 0, skip_reason = null, completed_at = null,
           provider_message_id = null, provider_contact_id = null, available_at = now()
     where id = ${id}`;
}

type LineRow = {
  status: string;
  skip_reason: string | null;
  last_error_code: string | null;
  provider_message_id: string | null;
  provider_contact_id: string | null;
};

async function lineRow(id: string): Promise<LineRow> {
  const [row] = await migration<LineRow[]>`
    select status::text as status, skip_reason, last_error_code, provider_message_id,
           provider_contact_id
      from leads.outbox_events where id = ${id}`;
  if (row === undefined) {
    throw new Error("the queue line was not found");
  }
  return row;
}

/** One turn of the drain on the worker's pool, live, redirect to this case's addresses. */
async function turn(): Promise<number> {
  const worker = `tm1-brevo-${randomUUID().slice(0, 8)}`;
  const logger = createLogger(
    { service: "worker", environment: "staging", version: "test" },
    logs.destination,
  );
  const brevo = createBrevoConnectors(
    {
      mode: "redirect",
      testRecipients: [...emails],
      apiKey: "local-double-key",
      baseUrl: double.baseUrl,
      senderTransactional: "no-reply@tx.influx.example",
      suppressionListId: null,
    },
    {
      readSubject: (line) =>
        readBrevoSubjectOf(database, randomUUID(), line, worker),
      logger,
    },
  );
  const drain = createOutboxDrain({
    queue: createWorkerQueue(database),
    connectors: {
      brevo_contact: brevo.contact,
      brevo_transactional: brevo.transactional,
    },
    worker,
    sync: {
      mode: "live",
      environment: "staging",
      nonProductionRecipientAllowlist: ["example.test"],
    },
    logger,
    now: () => Date.now(),
    sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
  });
  const own = [...lines];
  return inRolledBackTransaction(migration, async (blocker) => {
    await blocker`
      select id from leads.outbox_events
       where status = 'pending' and not (id = any (${own}::bigint[]))
         for update`;
    return drain.turn(new AbortController().signal);
  });
}

describe("05 CA38, CA40, 16 RG142: a sign-up reaches Brevo through the real queue", () => {
  it("a consenting creator: contact synchronised with its state, COMPANY empty; the welcome left and is journaled", async () => {
    const account = await createAccount({ role: "creator" });
    const { contact, welcome } = await insertSignupLines(account, "creator");

    expect(await turn()).toBe(2);

    const contactLine = await lineRow(contact);
    expect(contactLine).toMatchObject({
      status: "succeeded",
      provider_contact_id: "1",
    });
    const [state] = await migration<
      { last_status: string; external_contact_id: string | null }[]
    >`
      select last_status::text as last_status, external_contact_id
        from leads.contact_sync_states
       where account_id = ${account} and destination = 'brevo_contact'`;
    expect(state).toEqual({
      last_status: "succeeded",
      external_contact_id: "1",
    });
    const stored = double.contacts.get(emails[0] ?? "");
    expect(stored?.listIds).toEqual([LISTS.creators]);
    expect(stored?.attributes).toMatchObject({
      INFLUX_ACCOUNT_ID: account,
      PROFILE_TYPE: "creator",
      DECLARED_STATUS: "individual",
      LANGUAGE: "fr",
      COUNTRY: "BE",
      COMPANY: "",
      MARKETING_CONSENT: true,
      CONSENT_SOURCE: "signup_form",
      UTM_SOURCE: "newsletter",
      UTM_MEDIUM: "",
      HEARD_FROM: "social_media",
    });
    expect(String(stored?.attributes.SIGNED_UP_AT)).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );

    const welcomeLine = await lineRow(welcome);
    expect(welcomeLine.status).toBe("succeeded");
    expect(double.delivered).toHaveLength(1);
    expect(double.delivered[0]?.body.templateId).toBe(
      TEMPLATES["account.welcome_creator"],
    );
    const journal = await migration<
      { priority: string; locale: string; provider_message_id: string }[]
    >`
      select priority::text as priority, locale, provider_message_id
        from leads.transactional_sends where outbox_event_id = ${welcome}`;
    expect(journal).toEqual([
      {
        priority: "p1",
        locale: "fr",
        provider_message_id: welcomeLine.provider_message_id,
      },
    ]);
  });

  it("an advertiser: its company name, the advertisers list and the advertiser's welcome in English", async () => {
    const account = await createAccount({ role: "advertiser", language: "en" });
    await insertSignupLines(account, "advertiser");
    await turn();
    const stored = double.contacts.get(emails[0] ?? "");
    expect(stored?.attributes.COMPANY).toBe(LEGAL_NAME);
    expect(stored?.listIds).toEqual([LISTS.advertisers]);
    expect(double.delivered[0]?.body).toMatchObject({
      templateId: TEMPLATES["account.welcome_advertiser"],
      params: { LANGUAGE: "en" },
    });
  });

  it("CA39, CA40: without consent, no contact (skipped no_consent, no state, no failure), the welcome all the same", async () => {
    const account = await createAccount({ role: "creator", consent: false });
    const { contact, welcome } = await insertSignupLines(account, "creator");
    await turn();
    expect(await lineRow(contact)).toMatchObject({
      status: "skipped",
      skip_reason: "no_consent",
      last_error_code: null,
    });
    expect(double.contacts.size).toBe(0);
    expect((await lineRow(welcome)).status).toBe("succeeded");
    expect(double.delivered).toHaveLength(1);
  });

  it("writes no address, no account and no attribute value in the log lines (D60)", async () => {
    const account = await createAccount({ role: "advertiser" });
    await insertSignupLines(account, "advertiser");
    const before = logs.lines().length;
    await turn();
    const written = logs.lines().slice(before).join("\n");
    expect(written).toContain("leads.line.completed");
    expect(valuesFoundIn(written, [emails[0] ?? "", LEGAL_NAME])).toEqual([]);
  });
});

describe("05 CA41, RG76, 16 RG90: one welcome per account, replay included", () => {
  it("a replayed sign-up sends no second e-mail and creates no second contact", async () => {
    const account = await createAccount({ role: "creator" });
    const { contact, welcome } = await insertSignupLines(account, "creator");
    await turn();
    await replay(contact);
    await replay(welcome);

    await turn();

    expect(await lineRow(welcome)).toMatchObject({
      status: "skipped",
      skip_reason: "already_sent",
    });
    expect(double.delivered).toHaveLength(1);
    expect(double.messages).toHaveLength(1);
    expect((await lineRow(contact)).status).toBe("succeeded");
    expect(double.contacts.size).toBe(1);
    const [{ count } = { count: -1 }] = await migration<{ count: number }[]>`
      select count(*)::int as count from leads.transactional_sends where account_id = ${account}`;
    expect(count).toBe(1);
  });

  it("the database refuses a second welcome journal line for the account (0112)", async () => {
    const account = await createAccount({ role: "creator" });
    const { welcome } = await insertSignupLines(account, "creator");
    await turn();
    const error = await migration`
      insert into leads.transactional_sends
        (email_code, priority, account_id, locale, outbox_event_id, provider_message_id, status,
         sent_at)
      values ('account.welcome_creator', 'p1', ${account}, 'fr', ${welcome},
              ${`<${randomUUID()}@double.brevo.test>`}, 'sent', now())`.catch(
      (caught: unknown) => caught,
    );
    expect((error as { code?: string }).code).toBe(UNIQUE_VIOLATION);
  });
});

describe("0112: leads.read_brevo_subject(), a Brevo line in processing for this worker only", () => {
  function claimed(id: string, account: string): ClaimedLine {
    return {
      id,
      eventId: randomUUID(),
      eventType: "lead.created",
      destination: "brevo_contact",
      subjectKey: `account:${account}`,
      priority: 100,
      payload: {},
      idempotencyKey: "unused",
    };
  }

  async function processing(id: string, worker: string): Promise<void> {
    await migration`
      update leads.outbox_events
         set status = 'processing', locked_by = ${worker}, locked_at = now()
       where id = ${id}`;
  }

  it("reads the subject of a line this worker holds, and journals the read on the account", async () => {
    const account = await createAccount({ role: "advertiser" });
    const { contact } = await insertSignupLines(account, "advertiser");
    await processing(contact, "tm1-brevo-reader");
    const requestId = `tm1-brevo-${randomUUID()}`;
    const subject = await readBrevoSubjectOf(
      database,
      requestId,
      claimed(contact, account),
      "tm1-brevo-reader",
    );
    expect(subject).toMatchObject({
      email: emails[0],
      company: LEGAL_NAME,
      utmSource: "newsletter",
      heardFrom: "social_media",
      consentSource: "signup_form",
      welcomeSent: false,
    });
    const register = await migration<
      { event_type: string; subject_id: string }[]
    >`
      select event_type, subject_id::text as subject_id
        from audit.audit_events where request_id = ${requestId}`;
    expect(register).toEqual([
      { event_type: "elevated.leads.drain_outbox", subject_id: account },
    ]);
  });

  it("refuses a line of another worker, or not in processing (55000)", async () => {
    const account = await createAccount({ role: "creator" });
    const { contact } = await insertSignupLines(account, "creator");
    await expect(
      readBrevoSubjectOf(
        database,
        randomUUID(),
        claimed(contact, account),
        "tm1-brevo-reader",
      ),
    ).rejects.toBeInstanceOf(LineTakenBackError);
    await processing(contact, "tm1-brevo-other");
    await expect(
      readBrevoSubjectOf(
        database,
        randomUUID(),
        claimed(contact, account),
        "tm1-brevo-reader",
      ),
    ).rejects.toBeInstanceOf(LineTakenBackError);
  });

  it("refuses an Apollo line: Apollo reads by its own function (22023)", async () => {
    const account = await createAccount({ role: "creator" });
    const event = randomUUID();
    const [row] = await migration<{ id: string }[]>`
      insert into leads.outbox_events
        (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
      values (${event}, 'lead.created', 'apollo_contact', ${`account:${account}`}, 100,
              ${JSON.stringify({ event_id: event, account_id: account })}::text::jsonb,
              ${`lead.created:${event}`})
      returning id::text as id`;
    if (row === undefined) {
      throw new Error("the queue line was not inserted");
    }
    lines.push(row.id);
    await processing(row.id, "tm1-brevo-reader");
    const error = await readBrevoSubjectOf(
      database,
      randomUUID(),
      claimed(row.id, account),
      "tm1-brevo-reader",
    ).catch((caught: unknown) => caught);
    let cause: unknown = error;
    while (
      cause instanceof Error &&
      (cause as { code?: string }).code === undefined
    ) {
      cause = cause.cause;
    }
    expect((cause as { code?: string }).code).toBe(INVALID_PARAMETER);
  });
});

describe("05 RG58, J7 commit 7: the notice of a changed address leaves to both addresses through the real queue", () => {
  it("previous: the old address read from the completed request; current: the account's; journaled P1 on the account", async () => {
    const account = await createAccount({ role: "creator" });
    const current = emails[0] ?? "";
    const previous = `tm1-brevo-old-${randomUUID()}@example.test`;
    emails.push(previous);
    const request = randomUUID();
    // a completed request (written by the local superuser: its dates come from the database
    // functions, which the route test drives end to end)
    const superuser = localSuperuser();
    try {
      await superuser.begin(async (tx) => {
        await tx`set local session_replication_role = replica`;
        await tx`
          insert into identity.email_change_requests
            (id, account_id, old_email, new_email, created_at, expires_at, old_confirmed_at,
             new_confirmed_at, completed_at)
          values (${request}, ${account}, ${previous}, ${current}, now(),
                  now() + interval '24 hours', now(), now(), now())`;
      });
    } finally {
      await superuser.end({ timeout: 1 });
    }
    const event = randomUUID();
    const rows = await migration<{ id: string }[]>`
      insert into leads.outbox_events
        (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
      select ${event}, 'email.changed', 'brevo_transactional', ${`account:${account}`}, 0,
             jsonb_build_object('event_id', ${event}::text, 'account_id', ${account}::text,
                                'request_id', ${request}::text,
                                'email_code', 'auth.email_changed_notice', 'recipient', side),
             'auth.email_changed_notice:' || ${request}::text || ':' || side
        from unnest(array['previous', 'current']) side
      returning id::text as id`;
    lines.push(...rows.map((row) => row.id));

    // one line of a subject per turn (the order of a subject is kept)
    expect([await turn(), await turn()]).toEqual([1, 1]);

    for (const row of rows) {
      expect((await lineRow(row.id)).status).toBe("succeeded");
    }
    expect(
      double.messages
        .map((message) => [
          message.body.to?.[0]?.email,
          message.body.templateId,
        ])
        .sort(),
    ).toEqual(
      [
        [previous, TEMPLATES["auth.email_changed_notice"]],
        [current, TEMPLATES["auth.email_changed_notice"]],
      ].sort(),
    );
    const journal = await migration<
      { email_code: string; priority: string; account_id: string }[]
    >`
      select email_code, priority::text as priority, account_id::text as account_id
        from leads.transactional_sends
       where outbox_event_id = any (${rows.map((row) => row.id)}::bigint[])`;
    expect(journal).toEqual([
      {
        email_code: "auth.email_changed_notice",
        priority: "p1",
        account_id: account,
      },
      {
        email_code: "auth.email_changed_notice",
        priority: "p1",
        account_id: account,
      },
    ]);
    expect(valuesFoundIn(logs.text(), [previous, current])).toEqual([]);
  });
});

describe("05 RG142, 16 RG157, J7 commit 8: auth.new_device, written from the session of its line (0126)", () => {
  /** A committed member session of `account` with this summary; its id. */
  async function openSession(
    account: string,
    summary: string,
  ): Promise<string> {
    const [row] = await migration<{ id: string }[]>`
      insert into identity.sessions
        (token_hash, account_id, surface, mfa_method, user_agent_summary)
      values (${createHash("sha256").update(randomBytes(32)).digest()}, ${account}, 'member',
              null, ${summary})
      returning id::text as id`;
    return row?.id ?? "";
  }

  async function signalLine(account: string, session: string): Promise<string> {
    const event = randomUUID();
    const [row] = await migration<{ id: string }[]>`
      insert into leads.outbox_events
        (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
      values (${event}, 'auth.new_device', 'brevo_transactional', ${`account:${account}`}, 100,
              jsonb_build_object('event_id', ${event}::text, 'account_id', ${account}::text,
                                 'session_id', ${session}::text,
                                 'email_code', 'auth.new_device'),
              ${`auth.new_device:${account}:${randomUUID()}`})
      returning id::text as id`;
    lines.push(row?.id ?? "");
    return row?.id ?? "";
  }

  it("names the browser and the opening of the session, without any link; journaled P1 without a template", async () => {
    const account = await createAccount({ role: "creator", consent: false });
    const session = await openSession(account, "safari.ios");
    const line = await signalLine(account, session);

    expect(await turn()).toBe(1);
    expect((await lineRow(line)).status).toBe("succeeded");
    const [message] = double.messages;
    expect(message?.body.to).toEqual([{ email: emails[0] }]);
    expect(message?.body.templateId).toBeUndefined();
    expect(message?.body.textContent).toContain("depuis Safari sur iOS.");
    expect(
      `${message?.body.htmlContent ?? ""}${message?.body.textContent ?? ""}`,
    ).not.toMatch(/href|https?:|www\./i);
    const journal = await migration<
      { email_code: string; priority: string; template_ref: string | null }[]
    >`
      select email_code, priority::text as priority, template_ref
        from leads.transactional_sends where outbox_event_id = ${line}`;
    expect(journal).toEqual([
      { email_code: "auth.new_device", priority: "p1", template_ref: null },
    ]);
  });

  it("a session of ANOTHER account named by the line is never read: failed session_not_found, nothing sent", async () => {
    const account = await createAccount({ role: "creator" });
    const other = await createAccount({ role: "creator" });
    const foreign = await openSession(other, "chrome.android");
    const line = await signalLine(account, foreign);

    expect(await turn()).toBe(1);
    expect(await lineRow(line)).toMatchObject({
      status: "failed",
      last_error_code: "session_not_found",
    });
    expect(double.requests).toHaveLength(0);
  });
});

// TM1 (J6, commit 4) — the Brevo connectors on the real queue: the worker's module and pool
// (influx_worker_login), its own read leads.read_brevo_subject() (0112) and the Brevo double on
// the loopback (16 RG148: no test reaches Brevo). 05 CA38 to CA41 with the contact state and the
// journal written by the database, RG142 on the attributes read back from the double, the local
// belt of 16 RG90 (one welcome per account, replay included), the guards of the read (a line of
// this worker, a Brevo line only), and the notice of a changed address to both addresses (RG58,
// J7 commit 7), and the e-mail auth.new_device written by INFLUX from the session named by its line
// (05 RG142, 16 RG157, J7 commit 8), and the acknowledgement privacy.request_received written from
// the request named by its line (16 RG160, 0128). The connectors alone are in tests/brevo-connector.
// Accounts and lines are COMMITTED by the migration role (the worker reads in its own
// transactions); the other pending lines of the stack are held while the worker claims, as in
// tm1-worker-loop. The setting brevo_list_ids is set for the file and LEFT in place: since 0145 a
// Brevo id once set never goes back to null (05 RG163 (1)), and every file that needs list ids sets
// its own (a replacement). No template id is written (D69: every queue e-mail is written by INFLUX,
// 16 RG67; the guard of brevo_template_ids is tm1-sync-settings-guard-journal).
import {
  startBrevoDouble,
  type BrevoDouble,
} from "@influx/test-kit/brevo-double";
import {
  connectAsLocalSuperuser,
  inRolledBackTransaction,
  localRoleUrl,
} from "@influx/test-kit/db";
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
  readBrandProfileAttributesOf,
  readBrevoErasureSubjectOf,
  readBrevoProfileDecisionOf,
  readBrevoSubjectOf,
  readBrevoVerificationEmailOf,
  readVerifiedBadgeOf,
} from "../src/domains/leads/queue.ts";
import type { ClaimedLine } from "../src/domains/leads/repository.ts";
import english from "../src/locales/en/email.json" with { type: "json" };
import french from "../src/locales/fr/email.json" with { type: "json" };
import { createLogger } from "../src/platform/logger.ts";
import { localSuperuser, migrationRole } from "./support.ts";

const INVALID_PARAMETER = "22023";
const UNIQUE_VIOLATION = "23505";
const LEGAL_NAME = "Maison Verbeke-Lambrecht";
const LISTS = { advertisers: 2, creators: 3 };

let migration: postgres.Sql;
let double: BrevoDouble;
let database: WorkerDatabase;
const logs = captureLogStream();

const lines: string[] = [];
const accounts: string[] = [];
const emails: string[] = [];

beforeAll(async () => {
  migration = migrationRole();
  double = await startBrevoDouble();
  await migration`
    update leads.sync_settings set value = ${JSON.stringify(LISTS)}::text::jsonb
     where key = 'brevo_list_ids'`;
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
  // brevo_list_ids is left as set: never back to null (05 RG163 (1), 0145)
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
      delete from profiles.advertiser_topics where account_id = any (${accountIds}::uuid[])`;
    await migration`
      delete from profiles.advertiser_target_markets where account_id = any (${accountIds}::uuid[])`;
    await migration`
      delete from profiles.advertiser_review_entries where account_id = any (${accountIds}::uuid[])`;
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
      readErasureSubject: (line) =>
        readBrevoErasureSubjectOf(database, randomUUID(), line, worker),
      readErasureNotificationSubject: () => Promise.resolve(null),
      readProfileDecision: (line) =>
        readBrevoProfileDecisionOf(database, randomUUID(), line, worker),
      readBrandProfile: (line) =>
        readBrandProfileAttributesOf(database, randomUUID(), line, worker),
      readVerificationEmail: (line) =>
        readBrevoVerificationEmailOf(database, randomUUID(), line, worker),
      readVerifiedBadge: (line) =>
        readVerifiedBadgeOf(database, randomUUID(), line, worker),
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
    expect(double.delivered[0]?.body.templateId).toBeUndefined();
    expect(double.delivered[0]?.body.subject).toBe("Bienvenue sur INFLUX");
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
      subject: "Welcome to INFLUX",
      tags: ["account.welcome_advertiser"],
    });
    expect(double.delivered[0]?.body.templateId).toBeUndefined();
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

  it("TM1.1: Brevo alone answers 500, the account stays and both lines go back to pending, retried later (J6T-1)", async () => {
    const account = await createAccount({ role: "creator" });
    const { contact, welcome } = await insertSignupLines(account, "creator");
    double.queue(
      { status: 500, body: { code: "internal_error" } },
      { status: 500, body: { code: "internal_error" } },
    );
    await turn();
    for (const id of [contact, welcome]) {
      const [line] = await migration<
        { status: string; attempts: number; later: boolean }[]
      >`
        select status::text as status, attempts, available_at > now() as later
          from leads.outbox_events where id = ${id}`;
      expect(line).toEqual({ status: "pending", attempts: 1, later: true });
      expect((await lineRow(id)).last_error_code).not.toBeNull();
    }
    expect(double.contacts.size).toBe(0);
    expect(double.delivered).toHaveLength(0);
    const [kept] = await migration<{ deleted: boolean }[]>`
      select deleted_at is not null as deleted from identity.accounts where id = ${account}`;
    expect(kept).toEqual({ deleted: false });
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
      viaInvitation: false,
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
          message.body.templateId ?? null,
          message.body.tags?.[0],
        ])
        .sort(),
    ).toEqual(
      [
        [previous, null, "auth.email_changed_notice"],
        [current, null, "auth.email_changed_notice"],
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

describe("16 RG160, CA117: privacy.request_received, written from the request of its line (0128)", () => {
  /** A committed request of `account`, as the deposit leaves it (dates from the trigger); its id. */
  async function depositRequest(
    account: string,
    type: "access" | "erasure",
  ): Promise<string> {
    const [row] = await migration<{ id: string }[]>`
      insert into backoffice.data_subject_requests (request_type, requester_account_id)
      values (${type}::backoffice.data_request_type, ${account})
      returning id::text as id`;
    return row?.id ?? "";
  }

  async function acknowledgementLine(
    account: string,
    request: string,
  ): Promise<string> {
    const event = randomUUID();
    const [row] = await migration<{ id: string }[]>`
      insert into leads.outbox_events
        (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
      values (${event}, 'privacy.request_received', 'brevo_transactional',
              ${`account:${account}`}, 100,
              jsonb_build_object('event_id', ${event}::text, 'account_id', ${account}::text,
                                 'request_id', ${request}::text,
                                 'email_code', 'privacy.request_received'),
              ${`privacy.request_received:${request}`})
      returning id::text as id`;
    lines.push(row?.id ?? "");
    return row?.id ?? "";
  }

  it("an export in English, in the account's time zone, without any link nor template; journaled P1", async () => {
    // no template id for this code (0128), nor for any other (D69)
    const account = await createAccount({
      role: "creator",
      consent: false,
      language: "en",
    });
    await migration`
      update identity.accounts set timezone = 'America/Toronto' where id = ${account}`;
    const request = await depositRequest(account, "access");
    const line = await acknowledgementLine(account, request);

    expect(await turn()).toBe(1);
    expect((await lineRow(line)).status).toBe("succeeded");
    const [message] = double.messages;
    expect(message?.body.to).toEqual([{ email: emails[0] }]);
    expect(message?.body.templateId).toBeUndefined();
    expect(message?.body.subject).toBe(
      "Your INFLUX data export request has been received",
    );
    expect(message?.body.textContent).toMatch(/\((EDT|EST)\)\./);
    expect(message?.body.textContent).toContain(
      "Nothing is sent automatically",
    );
    expect(
      `${message?.body.htmlContent ?? ""}${message?.body.textContent ?? ""}`,
    ).not.toMatch(/href|https?:|www\.|@/i);
    const journal = await migration<
      { email_code: string; priority: string; template_ref: string | null }[]
    >`
      select email_code, priority::text as priority, template_ref
        from leads.transactional_sends where outbox_event_id = ${line}`;
    expect(journal).toEqual([
      {
        email_code: "privacy.request_received",
        priority: "p1",
        template_ref: null,
      },
    ]);
  });

  it("D72: an erasure is no longer acknowledged: failed unsupported_request_type, nothing sent", async () => {
    const account = await createAccount({ role: "creator" });
    const request = await depositRequest(account, "erasure");
    const line = await acknowledgementLine(account, request);

    expect(await turn()).toBe(1);
    expect(await lineRow(line)).toMatchObject({
      status: "failed",
      last_error_code: "unsupported_request_type",
    });
    expect(double.requests).toHaveLength(0);
  });

  it("a request of ANOTHER account named by the line is never read: failed request_not_found, nothing sent", async () => {
    const account = await createAccount({ role: "creator" });
    const other = await createAccount({ role: "creator" });
    const foreign = await depositRequest(other, "access");
    const line = await acknowledgementLine(account, foreign);

    expect(await turn()).toBe(1);
    expect(await lineRow(line)).toMatchObject({
      status: "failed",
      last_error_code: "request_not_found",
    });
    expect(double.requests).toHaveLength(0);
  });
});

describe("06 RG66, RG69, L2C commit 09: profile.decision, written from the decision read at consumption (0211)", () => {
  const REASONS = [
    "contact_in_public_field",
    "presentation_insufficient",
    "logo_non_compliant",
    "misleading_brand_name",
    "sector_inconsistent",
    "illicit_content",
    "duplicate_brand",
    "other",
  ] as const;
  const OTHER_MESSAGE =
    "Votre numéro de TVA ne correspond à aucune entreprise connue de nos équipes.";

  /** A committed decided entry of `account`, as the decision of 0210 leaves it; its id. */
  async function decidedEntry(
    account: string,
    decider: string,
    outcome:
      | { state: "published" }
      | { state: "rejected"; reason: string; message?: string },
  ): Promise<string> {
    const [row] = await migration<{ id: string }[]>`
      insert into profiles.advertiser_review_entries
        (account_id, kind, state, decided_by_account_id, decided_at, closed_at,
         rejection_reason_code, member_message, internal_comment)
      values (${account}, 'submission', ${outcome.state}::profiles.review_entry_state, ${decider},
              now(), now(),
              ${outcome.state === "rejected" ? outcome.reason : null},
              ${outcome.state === "rejected" ? (outcome.message ?? null) : null},
              ${outcome.state === "rejected" ? "Internal: never in an e-mail." : null})
      returning id::text as id`;
    return row?.id ?? "";
  }

  /** The profile.decision line of an entry, shaped as the decision functions queue it (0211). */
  async function decisionLine(account: string, entry: string): Promise<string> {
    const event = randomUUID();
    const [row] = await migration<{ id: string }[]>`
      insert into leads.outbox_events
        (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
      values (${event}, 'profile.decision', 'brevo_transactional', ${`account:${account}`}, 100,
              jsonb_build_object('event_id', ${event}::text, 'account_id', ${account}::text,
                                 'entry_id', ${entry}::text, 'email_code', 'profile.decision'),
              ${`profile.decision:${entry}`})
      returning id::text as id`;
    lines.push(row?.id ?? "");
    return row?.id ?? "";
  }

  /** An advertiser account and the agent-like account that decided its entry. */
  async function brandWithDecider(language: "fr" | "en"): Promise<{
    brand: string;
    address: string;
    decider: string;
  }> {
    const brand = await createAccount({ role: "advertiser", language });
    const address = emails[emails.length - 1] ?? "";
    const decider = await createAccount({ role: "creator" });
    return { brand, address, decider };
  }

  function messageTo(address: string | undefined) {
    return double.delivered.find((sent) =>
      JSON.stringify(sent.body.to).includes(address ?? "-"),
    );
  }

  for (const language of ["fr", "en"] as const) {
    it(`${language}: a publication, and a refusal for each of the eight reasons, each e-mail with its code, written by INFLUX, journaled P1`, async () => {
      const texts = (language === "fr" ? french : english).email
        .profileDecision;
      const cases: {
        outcome:
          | { state: "published" }
          | { state: "rejected"; reason: string; message?: string };
        subject: string;
        body: string;
      }[] = [
        {
          outcome: { state: "published" },
          subject: texts.published.subject,
          body: texts.published.body,
        },
        ...REASONS.map((reason) => ({
          outcome:
            reason === "other"
              ? { state: "rejected" as const, reason, message: OTHER_MESSAGE }
              : { state: "rejected" as const, reason },
          subject: texts.rejected.subject,
          body: reason === "other" ? OTHER_MESSAGE : texts.reason[reason],
        })),
      ];
      const sentLines: string[] = [];
      for (const item of cases) {
        // one line per turn: the client of the connector paces its calls (16 RG, rate_limited)
        const { brand, address, decider } = await brandWithDecider(language);
        const entry = await decidedEntry(brand, decider, item.outcome);
        const line = await decisionLine(brand, entry);
        sentLines.push(line);

        expect(await turn()).toBe(1);

        expect(await lineRow(line)).toMatchObject({ status: "succeeded" });
        const sent = messageTo(address);
        expect(sent?.body.subject).toBe(item.subject);
        expect(sent?.body.templateId).toBeUndefined();
        expect(sent?.body.tags).toEqual(["profile.decision"]);
        expect(sent?.body.textContent).toContain(item.body);
        const written = `${String(sent?.body.htmlContent)}${String(sent?.body.textContent)}`;
        // the internal comment of the agent never leaves (0211); no link, no domain, no address
        expect(written).not.toContain("Internal");
        expect(written).not.toMatch(/href|https?:|www\.|@/i);
      }
      expect(double.delivered).toHaveLength(cases.length);
      const journal = await migration<
        { email_code: string; priority: string; locale: string }[]
      >`
        select distinct email_code, priority::text as priority, locale
          from leads.transactional_sends
         where outbox_event_id = any (${sentLines}::bigint[])`;
      expect(journal).toEqual([
        { email_code: "profile.decision", priority: "p1", locale: language },
      ]);
    });
  }

  it("a message of the agent that looks like a link is refused by the output check: failed, nothing sent", async () => {
    const { brand, decider } = await brandWithDecider("fr");
    const entry = await decidedEntry(brand, decider, {
      state: "rejected",
      reason: "other",
      message: "Écrivez-nous à contact@exemple.invalid pour en discuter ici.",
    });
    const line = await decisionLine(brand, entry);

    expect(await turn()).toBe(1);

    expect(await lineRow(line)).toMatchObject({
      status: "failed",
      last_error_code: "output_check_rejected",
    });
    expect(double.requests).toHaveLength(0);
  });

  it("a replay sends no second e-mail: the key of the decision is the entry's", async () => {
    const { brand, decider } = await brandWithDecider("en");
    const entry = await decidedEntry(brand, decider, { state: "published" });
    const line = await decisionLine(brand, entry);
    await turn();
    expect(double.delivered).toHaveLength(1);
    const [first] = double.messages;
    expect(first?.headers["idempotency-key"]).toBe(`profile.decision:${entry}`);

    await replay(line);
    await turn();

    // Brevo answers the same message for the same key: delivered once, the journal holds one line
    expect(double.delivered).toHaveLength(1);
    expect(
      double.messages.map((sent) => sent.headers["idempotency-key"]),
    ).toEqual([`profile.decision:${entry}`, `profile.decision:${entry}`]);
    const [{ count } = { count: -1 }] = await migration<{ count: number }[]>`
      select count(*)::int as count from leads.transactional_sends where account_id = ${brand}`;
    expect(count).toBe(1);
  });

  it("an account erased since the decision gets nothing: skipped, the decision is not read", async () => {
    const { brand, decider } = await brandWithDecider("fr");
    const entry = await decidedEntry(brand, decider, {
      state: "rejected",
      reason: "duplicate_brand",
    });
    const line = await decisionLine(brand, entry);
    await migration`
      update identity.accounts set status = 'deleted', deleted_at = now() where id = ${brand}`;

    expect(await turn()).toBe(1);

    expect((await lineRow(line)).status).toBe("skipped");
    expect(double.requests).toHaveLength(0);
  });

  it("an entry of ANOTHER account named by the line is never read: failed decision_not_found, nothing sent", async () => {
    const { brand, decider } = await brandWithDecider("fr");
    const other = await createAccount({ role: "advertiser" });
    const foreign = await decidedEntry(other, decider, { state: "published" });
    const line = await decisionLine(brand, foreign);

    expect(await turn()).toBe(1);

    expect(await lineRow(line)).toMatchObject({
      status: "failed",
      last_error_code: "decision_not_found",
    });
    expect(double.requests).toHaveLength(0);
  });
});

describe("L2C commit 10, 06 RG78, RG79, CA40, CA41: profile.completed reaches Brevo through the real queue", () => {
  async function publishedBrand(consent = true): Promise<string> {
    const account = await createAccount({ role: "advertiser", consent });
    await migration.begin(async (tx) => {
      await tx`
        update profiles.advertiser_profiles
           set status = 'published', primary_sector_code = 'travel_tourism',
               company_size_band = '51_250', website_domain = 'voyages-verbeke.example',
               completeness_percent = 92, first_published_at = now()
         where account_id = ${account}`;
      await tx`
        insert into profiles.advertiser_topics (account_id, slot, topic_code)
        values (${account}, 1, 'travel'), (${account}, 2, 'food')`;
      await tx`
        insert into profiles.advertiser_target_markets (account_id, slot, country_code)
        values (${account}, 1, 'FR'), (${account}, 2, 'BE')`;
    });
    return account;
  }

  async function completedLine(account: string): Promise<string> {
    const event = randomUUID();
    const [row] = await migration<{ id: string }[]>`
      insert into leads.outbox_events
        (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
      values (${event}, 'profile.completed', 'brevo_contact', ${`account:${account}`}, 100,
              ${JSON.stringify({ event_id: event, account_id: account })}::text::jsonb,
              ${`profile.completed:${account}`})
      returning id::text as id`;
    if (row === undefined) {
      throw new Error("the queue line was not inserted");
    }
    lines.push(row.id);
    return row.id;
  }

  it("CA40: the contact carries the real attributes of the live profile, in the advertisers list, nothing else of the profile", async () => {
    const account = await publishedBrand();
    const line = await completedLine(account);
    expect(await turn()).toBe(1);
    expect((await lineRow(line)).status).toBe("succeeded");
    const stored = double.contacts.get(emails[0] ?? "");
    expect(stored?.listIds).toEqual([LISTS.advertisers]);
    expect(stored?.attributes).toMatchObject({
      INFLUX_ACCOUNT_ID: account,
      PROFILE_TYPE: "advertiser",
      COMPANY: LEGAL_NAME,
      FUNNEL_STAGE: "profile_completed",
      PROFILE_COMPLETENESS: 92,
      MAIN_TOPIC: "travel",
      SECTOR: "travel_tourism",
      COMPANY_SIZE: "51_250",
      TARGET_MARKETS: "FR,BE",
      PROFILE_STATUS: "published",
      VERIFIED_LEVEL: "none",
      MARKETING_CONSENT: true,
    });
    // the website domain is an Apollo field, never a Brevo attribute (16 §M4)
    expect(double.requests[0]?.raw).not.toContain("voyages-verbeke.example");
  });

  it("CA41: without consent the line is skipped no_consent, not a failure, nothing sent", async () => {
    const account = await publishedBrand(false);
    const line = await completedLine(account);
    await turn();
    expect(await lineRow(line)).toMatchObject({
      status: "skipped",
      skip_reason: "no_consent",
      last_error_code: null,
    });
    expect(double.requests).toHaveLength(0);
  });
});

describe("L2E commit 16, 08 RG92, RG94, fiche invariants 14 and 17: the verification e-mails and the badge level, through the real queue (0227)", () => {
  const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const FIGURES = `47300, 14, 35, current_date - 30, current_date - 2, 14, 35`;
  const verified = new Set<string>();
  // its own superuser connection: an earlier case of the file ends the shared one
  let admin: postgres.Sql;

  beforeAll(() => {
    admin = connectAsLocalSuperuser({ max: 1 });
  });

  afterAll(async () => {
    await admin.end({ timeout: 1 });
  });

  afterEach(async () => {
    const ids = [...verified];
    verified.clear();
    if (ids.length === 0) {
      return;
    }
    // the fixtures of this block only; replica: no foreign key trigger, no no-delete trigger
    await admin.begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`delete from verification.badges where account_id = any (${ids}::uuid[])`;
      await tx`delete from verification.ownership_codes where account_id = any (${ids}::uuid[])`;
      await tx`delete from verification.verification_requests where account_id = any (${ids}::uuid[])`;
      await tx`delete from profiles.advertiser_internal_details where account_id = any (${ids}::uuid[])`;
    });
  });

  type Level = "account_verified" | "audience_verified" | "brand_verified";
  type RequestSpec = {
    account: string;
    level: Level;
    status:
      "draft" | "approved" | "rejected" | "closed" | "expired" | "cancelled";
    reason?: string;
    memberMessage?: string;
    code?: { kind: "network" | "domain"; revoked?: boolean; inDays?: number };
    badge?: {
      state?: string;
      expiresInDays?: number | null;
      grantedAt?: string;
    };
  };

  function newCode(): string {
    const bytes = randomBytes(8);
    return `INFLUX-${Array.from(bytes, (byte) => CODE_ALPHABET[byte % 31]).join("")}`;
  }

  /** A request, its code and its badge, committed as the doors and decisions of 0222-0224 leave them. */
  async function fixture(
    spec: RequestSpec,
  ): Promise<{ request: string; code: string | null; badge: string | null }> {
    verified.add(spec.account);
    const brand = spec.level === "brand_verified";
    const request = randomUUID();
    const code = spec.code === undefined ? null : randomUUID();
    const badge = spec.badge === undefined ? null : randomUUID();
    const decided = spec.status === "approved" || spec.status === "rejected";
    const open = spec.status === "draft";
    const [decider] = await migration<{ id: string }[]>`
      select account_id::text as id from identity.agent_profiles limit 1`;
    await admin.begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      const decidedBy =
        decided || spec.status === "closed" ? (decider?.id ?? null) : null;
      await tx`
        insert into verification.verification_requests
          (id, account_id, social_account_id, network_code, level, status, created_at,
           submitted_at, sla_due_at, escalate_at, decided_by_account_id, decided_at, closed_at,
           cancelled_at, rejection_reason_code, member_message)
        values (${request}, ${spec.account}, ${brand ? null : randomUUID()},
                ${brand ? null : "instagram"}, ${spec.level}::verification.badge_level,
                ${spec.status}::verification.request_status, now() - interval '3 days',
                case when ${open} then null else now() - interval '3 days' end,
                case when ${open} then null else now() - interval '2 days' end,
                case when ${open} then null else now() - interval '1 day' end,
                ${decidedBy}::uuid,
                case when ${decidedBy !== null} then now() - interval '2 days' end,
                case when ${open} then null else now() - interval '2 days' end,
                case when ${spec.status === "cancelled"} then now() - interval '2 days' end,
                ${spec.reason ?? null}, ${spec.memberMessage ?? null})`;
      if (spec.code !== undefined && code !== null) {
        await tx`
          insert into verification.ownership_codes
            (id, request_id, account_id, kind, code, expires_at, revoked_at)
          values (${code}, ${request}, ${spec.account}, ${spec.code.kind}, ${newCode()},
                  now() + make_interval(days => ${spec.code.inDays ?? 7}),
                  case when ${spec.code.revoked === true} then now() end)`;
      }
      if (spec.badge !== undefined && badge !== null) {
        const expires =
          spec.badge.expiresInDays === null
            ? null
            : (spec.badge.expiresInDays ?? 60);
        const audience = spec.level === "audience_verified";
        await tx.unsafe(
          `insert into verification.badges
             (id, account_id, social_account_id, network_code, request_id, level,
              granted_by_account_id, granted_at, evidence_source, registry_source_id, expires_at,
              observed_handle_at_decision, state, revoked_at, revocation_reason_code, ended_at ${audience ? ", observed_followers, observed_posts_last_30_days, observed_avg_comments, observed_period_start, observed_period_end, declared_posts_at_decision, declared_comments_at_decision" : ""})
           select '${badge}', '${spec.account}', ${brand ? "null" : `'${randomUUID()}'`},
                  ${brand ? "null" : "'instagram'"}, '${request}', '${spec.level}',
                  '${decider?.id ?? ""}', '${spec.badge.grantedAt ?? "2026-11-03T10:00:00Z"}',
                  '${audience ? "native_dashboard" : brand ? "domain_and_registry" : "public_profile"}',
                  ${brand ? "(select id from verification.registry_sources limit 1)" : "null"},
                  ${expires === null ? "null" : `now() + interval '${expires} days'`},
                  ${brand ? "null" : "'tm1_fixture_handle'"}, '${spec.badge.state ?? "active"}', ${spec.badge.state === "revoked" ? "now(), 'account_closed'" : "null, null"},
                  ${["expired", "revoked", "replaced"].includes(spec.badge.state ?? "active") ? "now()" : "null"}${audience ? `, ${FIGURES}` : ""}`,
        );
      }
    });
    return { request, code, badge };
  }

  /** The queue line as the emitters of 0222-0224 shape it (ids and the e-mail code only). */
  async function emailLine(
    account: string,
    eventType: string,
    request: string,
    keyOf: string,
  ): Promise<string> {
    const event = randomUUID();
    const [row] = await migration<{ id: string }[]>`
      insert into leads.outbox_events
        (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
      values (${event}, ${eventType}, 'brevo_transactional', ${`account:${account}`}, 100,
              jsonb_build_object('event_id', ${event}::text, 'account_id', ${account}::text,
                                 'request_id', ${request}::text, 'email_code', ${eventType}::text),
              ${`${eventType}:${keyOf}`})
      returning id::text as id`;
    lines.push(row?.id ?? "");
    return row?.id ?? "";
  }

  async function contactLine(
    account: string,
    eventType: string,
  ): Promise<string> {
    const event = randomUUID();
    const [row] = await migration<{ id: string }[]>`
      insert into leads.outbox_events
        (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
      values (${event}, ${eventType}, 'brevo_contact', ${`account:${account}`}, 100,
              ${JSON.stringify({ event_id: event, account_id: account })}::text::jsonb,
              ${`${eventType}:${event}`})
      returning id::text as id`;
    lines.push(row?.id ?? "");
    return row?.id ?? "";
  }

  function claimed(
    id: string,
    account: string,
    eventType: string,
  ): ClaimedLine {
    return {
      id,
      eventId: randomUUID(),
      eventType,
      destination: "brevo_transactional",
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

  function messageTo(address: string | undefined) {
    return double.delivered.find((sent) =>
      JSON.stringify(sent.body.to).includes(address ?? "-"),
    );
  }

  function sqlCode(error: unknown): string | undefined {
    let cause: unknown = error;
    while (
      cause instanceof Error &&
      (cause as { code?: string }).code === undefined
    ) {
      cause = cause.cause;
    }
    return (cause as { code?: string } | undefined)?.code;
  }

  describe("leads.read_brevo_verification_email(), the facts of the e-mail of a line this worker holds", () => {
    it("reads the decision, the badge date and the language; never the code, a figure nor a handle; journals the read on the account", async () => {
      const account = await createAccount({ role: "creator", language: "en" });
      const { request } = await fixture({
        account,
        level: "audience_verified",
        status: "approved",
        badge: {},
      });
      const line = await emailLine(
        account,
        "verification.decision",
        request,
        request,
      );
      await processing(line, "tm1-verif-reader");
      const requestId = `tm1-verif-${randomUUID()}`;
      const facts = await readBrevoVerificationEmailOf(
        database,
        requestId,
        claimed(line, account, "verification.decision"),
        "tm1-verif-reader",
      );
      expect(facts).toEqual({
        level: "audience_verified",
        networkCode: "instagram",
        requestStatus: "approved",
        reasonCode: null,
        memberMessage: null,
        grantedAt: "2026-11-03T10:00:00.000Z",
        badgeExpiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        codeKind: null,
        codeExpiresAt: null,
        codeRevoked: false,
        preferredLanguage: "en",
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

    it("a code_issued line reads ITS code (named by its key): kind, expiry and revocation, never the code", async () => {
      const account = await createAccount({ role: "creator" });
      const { request, code } = await fixture({
        account,
        level: "account_verified",
        status: "draft",
        code: { kind: "network", revoked: true },
      });
      const line = await emailLine(
        account,
        "verification.code_issued",
        request,
        code ?? "",
      );
      await processing(line, "tm1-verif-reader");
      const facts = await readBrevoVerificationEmailOf(
        database,
        randomUUID(),
        claimed(line, account, "verification.code_issued"),
        "tm1-verif-reader",
      );
      expect(facts).toMatchObject({
        requestStatus: "draft",
        codeKind: "network",
        codeRevoked: true,
        codeExpiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      });
      expect(JSON.stringify(facts)).not.toMatch(/INFLUX-[A-Z0-9]{8}/);
      // a key that names the code of ANOTHER request gives nothing (EC-L2E-16-2)
      const other = await createAccount({ role: "creator" });
      const stranger = await fixture({
        account: other,
        level: "account_verified",
        status: "draft",
        code: { kind: "network" },
      });
      const crossed = await emailLine(
        account,
        "verification.code_issued",
        request,
        stranger.code ?? "",
      );
      await processing(crossed, "tm1-verif-reader");
      expect(
        await readBrevoVerificationEmailOf(
          database,
          randomUUID(),
          claimed(crossed, account, "verification.code_issued"),
          "tm1-verif-reader",
        ),
      ).toBeNull();
    });

    it("the owner of the read cannot read the code, a figure, a handle, the evidence nor the internal block", async () => {
      const rows = await migration<{ reached: boolean; what: string }[]>`
        select has_column_privilege('influx_leads_definer', 'verification.ownership_codes', 'code', 'SELECT') as reached, 'code' as what
        union all select has_column_privilege('influx_leads_definer', 'verification.ownership_codes', 'observed_handle', 'SELECT'), 'observed_handle'
        union all select has_column_privilege('influx_leads_definer', 'verification.badges', 'observed_followers', 'SELECT'), 'observed_followers'
        union all select has_column_privilege('influx_leads_definer', 'verification.badges', 'observed_handle_at_decision', 'SELECT'), 'observed_handle_at_decision'
        union all select has_column_privilege('influx_leads_definer', 'verification.badges', 'granted_by_account_id', 'SELECT'), 'granted_by_account_id'
        union all select has_column_privilege('influx_leads_definer', 'verification.verification_requests', 'internal_comment', 'SELECT'), 'internal_comment'
        union all select has_column_privilege('influx_leads_definer', 'verification.verification_requests', 'decided_by_account_id', 'SELECT'), 'decided_by_account_id'
        union all select has_any_column_privilege('influx_leads_definer', 'verification.evidence_files', 'SELECT'), 'evidence_files'
        union all select has_any_column_privilege('influx_leads_definer', 'profiles.advertiser_internal_details', 'SELECT'), 'advertiser_internal_details'`;
      expect(rows.filter((row) => row.reached)).toEqual([]);
      expect(rows).toHaveLength(9);
    });

    it("refuses a line of another worker or not in processing (55000), and any other event or destination (22023)", async () => {
      const account = await createAccount({ role: "creator" });
      const { request } = await fixture({
        account,
        level: "account_verified",
        status: "approved",
        badge: { expiresInDays: null },
      });
      const line = await emailLine(
        account,
        "verification.decision",
        request,
        request,
      );
      await expect(
        readBrevoVerificationEmailOf(
          database,
          randomUUID(),
          claimed(line, account, "verification.decision"),
          "tm1-verif-reader",
        ),
      ).rejects.toBeInstanceOf(LineTakenBackError);
      await processing(line, "tm1-verif-other");
      await expect(
        readBrevoVerificationEmailOf(
          database,
          randomUUID(),
          claimed(line, account, "verification.decision"),
          "tm1-verif-reader",
        ),
      ).rejects.toBeInstanceOf(LineTakenBackError);
      // a profile.decision line is read by its own function, a contact line by none of these
      const [wrong] = await migration<{ id: string }[]>`
        insert into leads.outbox_events
          (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
        select e, 'profile.decision', 'brevo_transactional', ${`account:${account}`}, 100,
               jsonb_build_object('event_id', e::text, 'account_id', ${account}::text,
                                  'request_id', ${request}::text, 'email_code', 'profile.decision'),
               ${`profile.decision:${randomUUID()}`}
          from (select gen_random_uuid() as e) s
        returning id::text as id`;
      lines.push(wrong?.id ?? "");
      await processing(wrong?.id ?? "", "tm1-verif-reader");
      const error = await readBrevoVerificationEmailOf(
        database,
        randomUUID(),
        claimed(wrong?.id ?? "", account, "profile.decision"),
        "tm1-verif-reader",
      ).catch((caught: unknown) => caught);
      expect(sqlCode(error)).toBe(INVALID_PARAMETER);
      const contact = await contactLine(account, "lead.updated");
      await processing(contact, "tm1-verif-reader");
      const contactError = await readBrevoVerificationEmailOf(
        database,
        randomUUID(),
        {
          ...claimed(contact, account, "lead.updated"),
          destination: "brevo_contact",
        },
        "tm1-verif-reader",
      ).catch((caught: unknown) => caught);
      expect(sqlCode(contactError)).toBe(INVALID_PARAMETER);
    });

    it("a request of ANOTHER account named by the payload, and an account erased since, give nothing (T14)", async () => {
      const mine = await createAccount({ role: "creator" });
      const theirs = await createAccount({ role: "creator" });
      const stranger = await fixture({
        account: theirs,
        level: "account_verified",
        status: "approved",
        badge: { expiresInDays: null },
      });
      const crossed = await emailLine(
        mine,
        "verification.decision",
        stranger.request,
        stranger.request,
      );
      await processing(crossed, "tm1-verif-reader");
      expect(
        await readBrevoVerificationEmailOf(
          database,
          randomUUID(),
          claimed(crossed, mine, "verification.decision"),
          "tm1-verif-reader",
        ),
      ).toBeNull();
      // the same line for the account that owns the request reads it
      const own = await emailLine(
        theirs,
        "verification.decision",
        stranger.request,
        `${stranger.request}-own`,
      );
      await processing(own, "tm1-verif-reader");
      expect(
        await readBrevoVerificationEmailOf(
          database,
          randomUUID(),
          claimed(own, theirs, "verification.decision"),
          "tm1-verif-reader",
        ),
      ).toMatchObject({ requestStatus: "approved" });
      await migration`
        update identity.accounts set status = 'deleted', deleted_at = now() where id = ${theirs}`;
      const gone = await emailLine(
        theirs,
        "verification.decision",
        stranger.request,
        `${stranger.request}-gone`,
      );
      await processing(gone, "tm1-verif-reader");
      expect(
        await readBrevoVerificationEmailOf(
          database,
          randomUUID(),
          claimed(gone, theirs, "verification.decision"),
          "tm1-verif-reader",
        ),
      ).toBeNull();
    });
  });

  describe("leads.read_verified_badge(), the level of the badges an account holds", () => {
    async function levelOf(account: string): Promise<unknown> {
      const line = await contactLine(account, "lead.updated");
      await processing(line, "tm1-verif-reader");
      return readVerifiedBadgeOf(
        database,
        randomUUID(),
        {
          ...claimed(line, account, "lead.updated"),
          destination: "brevo_contact",
        },
        "tm1-verif-reader",
      );
    }

    it("none without a badge; n1 for an account badge or a brand badge; n2 beats n1 and carries the date of the badge that fixes it", async () => {
      const none = await createAccount({ role: "creator" });
      expect(await levelOf(none)).toEqual({ level: "none", at: null });

      const account = await createAccount({ role: "creator" });
      await fixture({
        account,
        level: "account_verified",
        status: "approved",
        badge: { expiresInDays: null, grantedAt: "2026-10-01T08:00:00Z" },
      });
      expect(await levelOf(account)).toEqual({
        level: "n1",
        at: "2026-10-01T08:00:00.000Z",
      });
      await fixture({
        account,
        level: "audience_verified",
        status: "approved",
        badge: { grantedAt: "2026-11-03T10:00:00Z" },
      });
      expect(await levelOf(account)).toEqual({
        level: "n2",
        at: "2026-11-03T10:00:00.000Z",
      });

      const brand = await createAccount({ role: "advertiser" });
      await fixture({
        account: brand,
        level: "brand_verified",
        status: "approved",
        badge: { grantedAt: "2026-10-20T09:30:00Z", expiresInDays: 300 },
      });
      expect(await levelOf(brand)).toEqual({
        level: "n1",
        at: "2026-10-20T09:30:00.000Z",
      });
    });

    it("a badge holds while it is displayed, whatever its date (0230): active and to_refresh hold, to_reconfirm, revoked, replaced and expired do not", async () => {
      const refresh = await createAccount({ role: "creator" });
      await fixture({
        account: refresh,
        level: "audience_verified",
        status: "approved",
        badge: { state: "to_refresh" },
      });
      expect(await levelOf(refresh)).toMatchObject({ level: "n2" });
      const reconfirm = await createAccount({ role: "creator" });
      await fixture({
        account: reconfirm,
        level: "account_verified",
        status: "approved",
        badge: { state: "to_reconfirm", expiresInDays: null },
      });
      // l2f/modele.md §3: to_reconfirm never counts
      expect(await levelOf(reconfirm)).toEqual({ level: "none", at: null });
      for (const state of ["revoked", "replaced", "expired"]) {
        const ended = await createAccount({ role: "creator" });
        await fixture({
          account: ended,
          level: "account_verified",
          status: "approved",
          badge: { state, expiresInDays: null },
        });
        // a revoked or expired badge carries its own columns: the fixture is checked by the base
        expect(await levelOf(ended)).toEqual({ level: "none", at: null });
      }
      const lapsed = await createAccount({ role: "creator" });
      await fixture({
        account: lapsed,
        level: "audience_verified",
        status: "approved",
        badge: { expiresInDays: -1 },
      });
      // no date filter: the task badge_lifecycle ends a badge, the read follows its state
      expect(await levelOf(lapsed)).toMatchObject({ level: "n2" });
    });

    it("refuses an Apollo line (22023): nothing of the badge leaves for Apollo, a line of another worker is 55000", async () => {
      const account = await createAccount({ role: "creator" });
      const event = randomUUID();
      const [row] = await migration<{ id: string }[]>`
        insert into leads.outbox_events
          (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
        values (${event}, 'lead.updated', 'apollo_contact', ${`account:${account}`}, 100,
                ${JSON.stringify({ event_id: event, account_id: account })}::text::jsonb,
                ${`lead.updated:${event}`})
        returning id::text as id`;
      lines.push(row?.id ?? "");
      await expect(
        readVerifiedBadgeOf(
          database,
          randomUUID(),
          {
            ...claimed(row?.id ?? "", account, "lead.updated"),
            destination: "apollo_contact",
          },
          "tm1-verif-reader",
        ),
      ).rejects.toBeInstanceOf(LineTakenBackError);
      await processing(row?.id ?? "", "tm1-verif-reader");
      const error = await readVerifiedBadgeOf(
        database,
        randomUUID(),
        {
          ...claimed(row?.id ?? "", account, "lead.updated"),
          destination: "apollo_contact",
        },
        "tm1-verif-reader",
      ).catch((caught: unknown) => caught);
      expect(sqlCode(error)).toBe(INVALID_PARAMETER);
    });
  });

  describe("the contact, through the real queue", () => {
    it("a rewrite of the contact carries the level and the date of its badge, from the base, whatever the event", async () => {
      const account = await createAccount({ role: "creator" });
      await fixture({
        account,
        level: "audience_verified",
        status: "approved",
        badge: { grantedAt: "2026-11-03T10:00:00Z" },
      });
      const line = await contactLine(account, "lead.created");
      expect(await turn()).toBe(1);
      expect((await lineRow(line)).status).toBe("succeeded");
      expect(double.contacts.get(emails[0] ?? "")?.attributes).toMatchObject({
        VERIFIED_LEVEL: "n2",
        VERIFIED_AT: "2026-11-03T10:00:00.000Z",
      });
    });

    it("without marketing consent nothing about the badge leaves: the contact is unsubscribed, never described", async () => {
      const account = await createAccount({ role: "creator", consent: false });
      await fixture({
        account,
        level: "account_verified",
        status: "approved",
        badge: { expiresInDays: null },
      });
      await contactLine(account, "lead.updated");
      await turn();
      expect(
        valuesFoundIn(double.requests.map((r) => r.raw).join(" "), [
          "VERIFIED_LEVEL",
        ]),
      ).toEqual([]);
    });

    it("L2CT-8, RG80, 06 RG48: with the real raison sociale and number in the base, none reaches the raw body, the trading name does", async () => {
      const brand = await createAccount({ role: "advertiser" });
      const raison = "Verbeke-Lambrecht Holding SA";
      const number = "BE0123456789";
      const forbidden = [raison, number];
      verified.add(brand);
      await migration`
        insert into profiles.advertiser_internal_details
          (account_id, legal_name, registration_country_code, registration_number)
        values (${brand}, ${raison}, 'BE', ${number})`;
      await fixture({
        account: brand,
        level: "brand_verified",
        status: "approved",
        badge: { grantedAt: "2026-10-20T09:30:00Z", expiresInDays: 300 },
      });
      await contactLine(brand, "lead.updated");
      expect(await turn()).toBe(1);
      const raw = double.requests.map((request) => request.raw).join(" ");
      expect(raw).toContain(LEGAL_NAME);
      expect(valuesFoundIn(raw, forbidden)).toEqual([]);
      expect(double.contacts.get(emails[0] ?? "")?.attributes).toMatchObject({
        COMPANY: LEGAL_NAME,
        VERIFIED_LEVEL: "n1",
        VERIFIED_AT: "2026-10-20T09:30:00.000Z",
      });
      // the subject read the worker holds returns the trading name, never the raison sociale (L2CS-8)
      const line = await contactLine(brand, "lead.updated");
      await processing(line, "tm1-verif-reader");
      const subject = await readBrevoSubjectOf(
        database,
        randomUUID(),
        {
          ...claimed(line, brand, "lead.updated"),
          destination: "brevo_contact",
        },
        "tm1-verif-reader",
      );
      expect(subject?.company).toBe(LEGAL_NAME);
    });
  });

  describe("the five e-mails, written by INFLUX and journaled P1, with their own code", () => {
    it("CA34, CA61: a granted audience badge in French, an account badge, a brand badge in English: date and source, no figure, no handle, no link", async () => {
      const creator = await createAccount({ role: "creator", language: "fr" });
      const creatorAddress = emails[emails.length - 1];
      const audience = await fixture({
        account: creator,
        level: "audience_verified",
        status: "approved",
        badge: {},
      });
      const brand = await createAccount({ role: "advertiser", language: "en" });
      const brandAddress = emails[emails.length - 1];
      const brandBadge = await fixture({
        account: brand,
        level: "brand_verified",
        status: "approved",
        badge: { grantedAt: "2026-10-20T09:30:00Z", expiresInDays: 300 },
      });
      const first = await emailLine(
        creator,
        "verification.decision",
        audience.request,
        audience.request,
      );
      expect(await turn()).toBe(1);
      const second = await emailLine(
        brand,
        "verification.decision",
        brandBadge.request,
        brandBadge.request,
      );
      expect(await turn()).toBe(1);

      expect(await lineRow(first)).toMatchObject({ status: "succeeded" });
      expect(await lineRow(second)).toMatchObject({ status: "succeeded" });
      const fr = messageTo(creatorAddress);
      expect(fr?.body.subject).toBe("Votre badge INFLUX est accordé");
      expect(fr?.body.tags).toEqual(["verification.decision"]);
      expect(fr?.body.templateId).toBeUndefined();
      expect(String(fr?.body.textContent)).toContain(
        "Audience vérifiée — Instagram",
      );
      expect(String(fr?.body.textContent)).toContain("3 novembre 2026");
      expect(String(fr?.body.textContent)).toContain(
        "INFLUX ne se prononce pas sur l'authenticité des abonnés.",
      );
      const en = messageTo(brandAddress);
      expect(en?.body.subject).toBe("Your INFLUX badge is granted");
      expect(String(en?.body.textContent)).toContain("Brand verified");
      expect(String(en?.body.textContent)).toContain("October 20, 2026");
      for (const sent of [fr, en]) {
        const written = `${String(sent?.body.htmlContent)}${String(sent?.body.textContent)}`;
        // RG92, invariant 14: no figure, no handle, no link, no network account
        expect(written).not.toMatch(
          /47\s?300|t2_creator|@|href|https?:|www\./i,
        );
      }
      const journal = await migration<
        { email_code: string; priority: string; locale: string }[]
      >`
        select email_code, priority::text as priority, locale
          from leads.transactional_sends
         where outbox_event_id = any (${[first, second]}::bigint[])
         order by locale`;
      expect(journal).toEqual([
        { email_code: "verification.decision", priority: "p1", locale: "en" },
        { email_code: "verification.decision", priority: "p1", locale: "fr" },
      ]);
    });

    it("CA62: a refusal for each reason of both lists leaves with the message of its reason (the agent's text for other and terms_breach only)", async () => {
      const reasons = await migration<
        { population: string; code: string; requires: boolean }[]
      >`select population, code, requires_member_message as requires
          from verification.rejection_reasons order by population, position`;
      expect(reasons).toHaveLength(22);
      for (const { population, code, requires } of reasons) {
        const language = code.length % 2 === 0 ? "fr" : "en";
        const account = await createAccount({
          role: population === "brand" ? "advertiser" : "creator",
          language,
        });
        const address = emails[emails.length - 1];
        const level: Level =
          population === "brand" ? "brand_verified" : "audience_verified";
        const { request } = await fixture({
          account,
          level,
          status: code === "account_unavailable" ? "closed" : "rejected",
          reason: code,
          ...(requires
            ? { memberMessage: "Merci de préciser votre activité." }
            : {}),
        });
        const line = await emailLine(
          account,
          "verification.decision",
          request,
          request,
        );
        expect(await turn()).toBe(1);
        expect(await lineRow(line)).toMatchObject({ status: "succeeded" });
        const texts = (language === "fr" ? french : english).email
          .verificationDecision;
        const expected =
          population === "brand"
            ? texts.reason.brand[code as keyof typeof texts.reason.brand]
            : texts.reason.creator[code as keyof typeof texts.reason.creator];
        const sent = messageTo(address);
        expect(sent?.body.subject).toBe(texts.rejected.subject);
        expect(String(sent?.body.textContent)).toContain(expected);
        expect(
          String(sent?.body.textContent).includes(
            "Merci de préciser votre activité.",
          ),
        ).toBe(requires);
        // the internal comment of the agent is not even readable here: no column, no row
        expect(String(sent?.body.htmlContent)).not.toMatch(
          /href|https?:|www\.|@/i,
        );
      }
    });

    it("a refusal whose reason belongs to the other list is a visible failure: failed rejection_reason_unknown, nothing sent", async () => {
      const brand = await createAccount({ role: "advertiser" });
      const { request } = await fixture({
        account: brand,
        level: "brand_verified",
        status: "rejected",
        reason: "other",
        memberMessage: "Merci de préciser votre activité.",
      });
      // tamper: a creator reason on a brand request cannot be written (composite key), the line says so
      await admin.begin(async (tx) => {
        await tx`set local session_replication_role = replica`;
        await tx`update verification.verification_requests set rejection_reason_code = 'evidence_too_wide' where id = ${request}`;
      });
      const line = await emailLine(
        brand,
        "verification.decision",
        request,
        request,
      );
      expect(await turn()).toBe(1);
      expect(await lineRow(line)).toMatchObject({
        status: "failed",
        last_error_code: "rejection_reason_unknown",
      });
      expect(double.requests).toHaveLength(0);
    });

    it("an agent's text that looks like a link is refused by the output check: failed, nothing sent", async () => {
      const creator = await createAccount({ role: "creator" });
      const { request } = await fixture({
        account: creator,
        level: "account_verified",
        status: "rejected",
        reason: "other",
        memberMessage:
          "Écrivez-nous à contact@exemple.invalid pour en discuter ici.",
      });
      const line = await emailLine(
        creator,
        "verification.decision",
        request,
        request,
      );
      expect(await turn()).toBe(1);
      expect(await lineRow(line)).toMatchObject({
        status: "failed",
        last_error_code: "output_check_rejected",
      });
      expect(double.requests).toHaveLength(0);
    });

    it("received, code generated (never the code) and expired: written from the request and ITS code, journaled P1", async () => {
      const creator = await createAccount({ role: "creator", language: "en" });
      const address = emails[emails.length - 1];
      const open = await fixture({
        account: creator,
        level: "account_verified",
        status: "draft",
        code: { kind: "network" },
      });
      const submitted = await fixture({
        account: creator,
        level: "audience_verified",
        status: "approved",
        badge: {},
      });
      const expired = await fixture({
        account: creator,
        level: "account_verified",
        status: "expired",
      });
      const codeLine = await emailLine(
        creator,
        "verification.code_issued",
        open.request,
        open.code ?? "",
      );
      const receivedLine = await emailLine(
        creator,
        "verification.received",
        submitted.request,
        submitted.request,
      );
      const expiredLine = await emailLine(
        creator,
        "verification.request_expired",
        expired.request,
        expired.request,
      );
      const sentTexts: string[] = [];
      for (const line of [codeLine, receivedLine, expiredLine]) {
        // one line per turn: the client of the connector paces its calls
        await migration`update leads.outbox_events set available_at = now() where id = ${line}`;
        await turn();
        expect(await lineRow(line)).toMatchObject({ status: "succeeded" });
      }
      for (const sent of double.delivered) {
        expect(JSON.stringify(sent.body.to)).toContain(address ?? "-");
        sentTexts.push(String(sent.body.textContent));
      }
      expect(double.delivered).toHaveLength(3);
      const [codeText] = sentTexts.filter((text) =>
        text.includes("verification code"),
      );
      expect(codeText).toContain("Instagram");
      const [stored] = await migration<{ code: string }[]>`
        select code from verification.ownership_codes where id = ${open.code}`;
      expect(
        valuesFoundIn(sentTexts.join(" "), [stored?.code ?? "unknown-code"]),
      ).toEqual([]);
      // RG29, where it matters
      expect(sentTexts.join(" ")).toContain("will never ask for your password");
      const journal = await migration<{ email_code: string }[]>`
        select email_code from leads.transactional_sends
         where outbox_event_id = any (${[codeLine, receivedLine, expiredLine]}::bigint[])
         order by email_code`;
      expect(journal.map((row) => row.email_code)).toEqual([
        "verification.code_issued",
        "verification.received",
        "verification.request_expired",
      ]);
    });

    it("a request cancelled, a code revoked, an account erased since: skipped, never announced", async () => {
      const creator = await createAccount({ role: "creator" });
      const cancelled = await fixture({
        account: creator,
        level: "account_verified",
        status: "cancelled",
      });
      const revoked = await fixture({
        account: creator,
        level: "audience_verified",
        status: "draft",
        code: { kind: "network", revoked: true },
      });
      const received = await emailLine(
        creator,
        "verification.received",
        cancelled.request,
        cancelled.request,
      );
      const code = await emailLine(
        creator,
        "verification.code_issued",
        revoked.request,
        revoked.code ?? "",
      );
      await turn();
      expect(await lineRow(received)).toMatchObject({
        status: "skipped",
        skip_reason: "request_closed",
      });
      await turn();
      expect(await lineRow(code)).toMatchObject({
        status: "skipped",
        skip_reason: "code_obsolete",
      });
      expect(double.requests).toHaveLength(0);
    });
  });

  describe("the translation files and the database hold the same closed lists", () => {
    it("every message_key of verification.rejection_reasons resolves in both languages, and every network has its name", async () => {
      const keys = await migration<
        { population: string; code: string; message_key: string }[]
      >`
        select population, code, message_key from verification.rejection_reasons`;
      expect(keys).toHaveLength(22);
      for (const messages of [french, english]) {
        for (const { message_key: key } of keys) {
          expect(key.startsWith("verificationDecision.reason.")).toBe(true);
          const path = key.split(".").slice(1);
          let node: unknown = messages.email.verificationDecision;
          for (const part of path) {
            node = (node as Record<string, unknown> | undefined)?.[part];
          }
          expect(typeof node, key).toBe("string");
        }
        const networks = await migration<{ code: string }[]>`
          select code from reference.networks order by code`;
        for (const { code } of networks) {
          expect(
            Object.keys(messages.email.verificationNotice.network),
          ).toContain(code);
        }
      }
    });
  });

  describe("the payload of the emitters carries the code of its e-mail (EC-L2E-16-1)", () => {
    it("the four queue lines of the doors and decisions name it, so that the worker can record the send", async () => {
      const sources = await migration<{ fn: string; ok: boolean }[]>`
        select p.oid::regprocedure::text as fn,
               p.prosrc ~ '''email_code'', ''verification\\.[a-z_]+''' as ok
          from pg_proc p
         where p.oid = any (array[
           'verification.issue_ownership_code(uuid,uuid,text)'::regprocedure,
           'verification.submit_request_of(uuid,uuid)'::regprocedure,
           'ops.expire_verification_requests(uuid,smallint)'::regprocedure,
           'verification.queue_decision(uuid,uuid,boolean)'::regprocedure])`;
      expect(sources).toHaveLength(4);
      expect(sources.filter((row) => !row.ok)).toEqual([]);
    });
  });
});

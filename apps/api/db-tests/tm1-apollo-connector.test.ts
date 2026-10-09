// TM1 (J6, commit 5) — the Apollo connector on the real queue: the worker's module and pool
// (influx_worker_login), its own read leads.read_apollo_subject() (0113), and the Apollo and Brevo
// doubles on the loopback (16 RG148: no test reaches either). 05 CA42 to CA45 with the settings
// written directly (the screens come with J8, the replay of a skipped line by hand), TM1.2 (a
// failing Apollo leaves the line pending and the account untouched), TM1.6 (the switch by category,
// no restart), lead-pipeline T6 (Apollo down has no effect on Brevo), RG85 (nothing of Apollo's own
// data in the database), the empty list of prospecting countries of staging (skipped, in dry_run as
// in live) and the guards of the read. The connector alone is tested in tests/apollo-connector.
// Accounts and lines are COMMITTED by the migration role; the other pending lines of the stack are
// held while the worker claims, as in tm1-brevo-connector. The five settings touched are restored
// after the file.
import {
  startApolloDouble,
  type ApolloDouble,
} from "@influx/test-kit/apollo-double";
import { ENRICHED_FIELDS } from "@influx/test-kit/apollo-exchanges";
import {
  startBrevoDouble,
  type BrevoDouble,
} from "@influx/test-kit/brevo-double";
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
  createWorkerDatabase,
  type WorkerDatabase,
} from "../src/db/index.ts";
import type { Connector } from "../src/domains/leads/connector.ts";
import { createApolloConnector } from "../src/domains/leads/connectors/apollo/index.ts";
import { createBrevoConnectors } from "../src/domains/leads/connectors/brevo/index.ts";
import { createOutboxDrain } from "../src/domains/leads/drain.ts";
import {
  createWorkerQueue,
  LineTakenBackError,
  readApolloSubjectOf,
  readBrevoSubjectOf,
} from "../src/domains/leads/queue.ts";
import type {
  ClaimedLine,
  OutboxDestination,
} from "../src/domains/leads/repository.ts";
import { createLogger } from "../src/platform/logger.ts";
import { migrationRole } from "./support.ts";

const INVALID_PARAMETER = "22023";
const LEGAL_NAME = "Atelier Vandenbroucke";
const SETTING_KEYS = [
  "apollo_scope",
  "apollo_legal_basis",
  "apollo_prospecting_countries",
  "brevo_list_ids",
  "brevo_template_ids",
];
const CONSENT_REQUIRED = { default: "consentement_requis", by_country: {} };
const LEGITIMATE_INTEREST = {
  default: "interet_legitime_avec_opposition",
  by_country: {},
};

let migration: postgres.Sql;
let apollo: ApolloDouble;
let brevo: BrevoDouble;
let database: WorkerDatabase;
let savedSettings: { key: string; value: unknown }[];
const logs = captureLogStream();

const lines: string[] = [];
const accounts: string[] = [];
const emails: string[] = [];

async function setting(key: string, value: unknown): Promise<void> {
  await migration`
    update leads.sync_settings set value = ${JSON.stringify(value)}::text::jsonb
     where key = ${key}`;
}

beforeAll(async () => {
  migration = migrationRole();
  apollo = await startApolloDouble();
  brevo = await startBrevoDouble();
  savedSettings = await migration<{ key: string; value: unknown }[]>`
    select key, value from leads.sync_settings where key = any (${SETTING_KEYS})`;
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
    await setting(key, value);
  }
  await closeDatabase(database);
  await apollo.close();
  await brevo.close();
});

beforeEach(async () => {
  apollo.reset();
  brevo.reset();
  // The settings of 0103, Belgium validated for prospection: each case changes what it tests.
  await setting("apollo_scope", "annonceurs_et_createurs_pro");
  await setting("apollo_legal_basis", CONSENT_REQUIRED);
  await setting("apollo_prospecting_countries", ["BE"]);
  await setting("brevo_list_ids", { advertisers: 2, creators: 3 });
  await setting("brevo_template_ids", {
    "account.welcome_advertiser": 11,
    "account.welcome_creator": 12,
  });
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
  status?: "individual" | "business";
  consent?: boolean;
};

/** A committed account as the sign-up leaves it: role, consents, company of an advertiser. */
async function createAccount(spec: AccountSpec): Promise<string> {
  const id = randomUUID();
  const email = `tm1-apollo-${id}@example.test`;
  const creator = spec.role === "creator";
  await migration.begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         declared_status, is_adult_attested, adult_attested_at)
      values (${id}, ${randomUUID()}, ${email}, now(), 'BE', 'fr',
              ${spec.status ?? (creator ? "individual" : "business")}::identity.declared_status,
              ${creator}, case when ${creator} then now() end)`;
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

/** The lines of one event of an account, keyed as identity.provision_account() keys them. */
async function insertLines(
  account: string,
  destinations: readonly OutboxDestination[],
  role: AccountSpec["role"] = "advertiser",
  eventType = "lead.created",
): Promise<Record<OutboxDestination, string>> {
  const event = randomUUID();
  const ids: Partial<Record<OutboxDestination, string>> = {};
  for (const destination of destinations) {
    const welcome = destination === "brevo_transactional";
    const [row] = await migration<{ id: string }[]>`
      insert into leads.outbox_events
        (event_id, event_type, destination, subject_key, priority, payload, idempotency_key)
      values
        (${event}, ${eventType}, ${destination}::leads.outbox_destination,
         ${`account:${account}`}, 100,
         ${JSON.stringify(
           welcome
             ? {
                 event_id: event,
                 account_id: account,
                 email_code: `account.welcome_${role}`,
               }
             : { event_id: event, account_id: account },
         )}::text::jsonb,
         ${welcome ? `account.welcome:${account}` : `${eventType}:${event}`})
      returning id::text as id`;
    if (row === undefined) {
      throw new Error("the queue line was not inserted");
    }
    lines.push(row.id);
    ids[destination] = row.id;
  }
  return ids as Record<OutboxDestination, string>;
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
  dry_run: boolean;
  skip_reason: string | null;
  last_error_code: string | null;
  provider_contact_id: string | null;
};

async function lineRow(id: string): Promise<LineRow> {
  const [row] = await migration<LineRow[]>`
    select status::text as status, dry_run, skip_reason, last_error_code, provider_contact_id
      from leads.outbox_events where id = ${id}`;
  if (row === undefined) {
    throw new Error("the queue line was not found");
  }
  return row;
}

async function apolloState(
  account: string,
): Promise<
  { last_status: string; external_contact_id: string | null } | undefined
> {
  const [row] = await migration<
    { last_status: string; external_contact_id: string | null }[]
  >`
    select last_status::text as last_status, external_contact_id
      from leads.contact_sync_states
     where account_id = ${account} and destination = 'apollo_contact'`;
  return row;
}

type TurnOptions = {
  mode?: "live" | "dry_run";
  apolloTimeoutMs?: number;
  apolloKey?: string | null;
};

/** One turn of the drain on the worker's pool, the three connectors on their doubles. */
async function turn(options: TurnOptions = {}): Promise<number> {
  const worker = `tm1-apollo-${randomUUID().slice(0, 8)}`;
  const logger = createLogger(
    { service: "worker", environment: "staging", version: "test" },
    logs.destination,
  );
  const brevoConnectors = createBrevoConnectors(
    {
      mode: "redirect",
      testRecipients: [...emails],
      apiKey: "local-double-key",
      baseUrl: brevo.baseUrl,
      senderTransactional: "no-reply@tx.influx.example",
      suppressionListId: null,
    },
    {
      readSubject: (line) =>
        readBrevoSubjectOf(database, randomUUID(), line, worker),
      logger,
    },
  );
  const apolloConnector: Connector = createApolloConnector(
    {
      apiKey:
        options.apolloKey === undefined
          ? "local-double-key"
          : options.apolloKey,
      baseUrl: apollo.baseUrl,
    },
    {
      readSubject: (line) =>
        readApolloSubjectOf(database, randomUUID(), line, worker),
      logger,
      ...(options.apolloTimeoutMs === undefined
        ? {}
        : { timeoutMs: options.apolloTimeoutMs }),
    },
  );
  const drain = createOutboxDrain({
    queue: createWorkerQueue(database),
    connectors: {
      brevo_contact: brevoConnectors.contact,
      brevo_transactional: brevoConnectors.transactional,
      apollo_contact: apolloConnector,
    },
    worker,
    sync: {
      mode: options.mode ?? "live",
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

describe("a qualified lead reaches Apollo through the real queue, once", () => {
  it("an advertiser: a contact created, its Apollo id kept as the contact state, nothing enriched kept (05 RG85)", async () => {
    const account = await createAccount({ role: "advertiser" });
    const { apollo_contact: line } = await insertLines(account, [
      "apollo_contact",
    ]);
    expect(await turn()).toBe(1);

    const [contact] = [...apollo.contacts.values()];
    expect(contact?.email).toBe(emails[0]);
    expect(contact?.fields.organization_name).toBe(LEGAL_NAME);
    const row = await lineRow(line);
    expect(row).toMatchObject({
      status: "succeeded",
      dry_run: false,
      provider_contact_id: contact?.id,
    });
    expect(await apolloState(account)).toEqual({
      last_status: "succeeded",
      external_contact_id: contact?.id,
    });

    const stored = await migration`
      select to_jsonb(o) as line from leads.outbox_events o where o.id = ${line}
      union all
      select to_jsonb(s) from leads.contact_sync_states s
       where s.account_id = ${account} and s.destination = 'apollo_contact'`;
    expect(
      valuesFoundIn(JSON.stringify(stored), [
        ENRICHED_FIELDS.title,
        ENRICHED_FIELDS.linkedin_url,
        ENRICHED_FIELDS.organization.name,
        ENRICHED_FIELDS.phone_numbers[0].raw_number,
      ]),
    ).toEqual([]);
  });

  it("a later event of the same account updates the contact by its Apollo id, never a duplicate", async () => {
    const account = await createAccount({ role: "advertiser" });
    await insertLines(account, ["apollo_contact"]);
    await turn();
    const { apollo_contact: update } = await insertLines(
      account,
      ["apollo_contact"],
      "advertiser",
      "lead.updated",
    );
    await turn();
    expect(apollo.requests.map((request) => request.method)).toEqual([
      "POST",
      "PUT",
    ]);
    expect(apollo.contacts.size).toBe(1);
    const [known] = [...apollo.contacts.keys()];
    expect((await lineRow(update)).provider_contact_id).toBe(known);
  });
});

describe("05 CA42 to CA45, TM1.6: the settings of each consumption, without a restart", () => {
  it("CA44: an empty list of prospecting countries skips country_not_validated, nothing sent", async () => {
    await setting("apollo_prospecting_countries", []);
    const account = await createAccount({ role: "advertiser" });
    const { apollo_contact: line } = await insertLines(account, [
      "apollo_contact",
    ]);
    await turn();
    expect(await lineRow(line)).toMatchObject({
      status: "skipped",
      skip_reason: "country_not_validated",
    });
    expect(apollo.requests).toEqual([]);
  });

  it("staging as it is: empty countries in dry_run, the line is skipped (the dry_run marker is for a success only), never a dry success", async () => {
    await setting("apollo_prospecting_countries", []);
    const account = await createAccount({ role: "advertiser" });
    const { apollo_contact: line } = await insertLines(account, [
      "apollo_contact",
    ]);
    await turn({ mode: "dry_run", apolloKey: null });
    expect(await lineRow(line)).toMatchObject({
      status: "skipped",
      dry_run: false,
      skip_reason: "country_not_validated",
    });
    expect(apollo.requests).toEqual([]);
    expect(await apolloState(account)).toBeUndefined();
  });

  it("CA42 then CA43, TM1.6: an individual creator is out of scope, then synchronised once the scope is switched", async () => {
    const account = await createAccount({ role: "creator" });
    const { apollo_contact: line } = await insertLines(
      account,
      ["apollo_contact"],
      "creator",
    );
    await turn();
    expect(await lineRow(line)).toMatchObject({
      status: "skipped",
      skip_reason: "out_of_apollo_scope_individual",
    });
    expect(apollo.requests).toEqual([]);

    await setting("apollo_scope", "tous_les_inscrits");
    await replay(line);
    await turn();
    expect((await lineRow(line)).status).toBe("succeeded");
    const [contact] = [...apollo.contacts.values()];
    expect(contact?.fields).not.toHaveProperty("organization_name");
    expect(contact?.fields.label_names).toContain(
      "influx_scope_tous_les_inscrits",
    );
  });

  it("TM1.6: annonceurs_seuls cuts every creator, a business one included", async () => {
    await setting("apollo_scope", "annonceurs_seuls");
    const account = await createAccount({
      role: "creator",
      status: "business",
    });
    const { apollo_contact: line } = await insertLines(
      account,
      ["apollo_contact"],
      "creator",
    );
    await turn();
    expect(await lineRow(line)).toMatchObject({
      status: "skipped",
      skip_reason: "out_of_apollo_scope",
    });
  });

  it("CA45: without consent nothing leaves under consentement_requis; the same profile is eligible under interet_legitime_avec_opposition", async () => {
    const account = await createAccount({ role: "advertiser", consent: false });
    const { apollo_contact: line } = await insertLines(account, [
      "apollo_contact",
    ]);
    await turn();
    expect(await lineRow(line)).toMatchObject({
      status: "skipped",
      skip_reason: "no_consent",
    });
    expect(apollo.requests).toEqual([]);

    await setting("apollo_legal_basis", LEGITIMATE_INTEREST);
    await replay(line);
    await turn();
    expect((await lineRow(line)).status).toBe("succeeded");
    expect(apollo.contacts.size).toBe(1);
  });

  it("RG83: an opposition recorded after the sign-up excludes for good under interet_legitime_avec_opposition", async () => {
    await setting("apollo_legal_basis", LEGITIMATE_INTEREST);
    const account = await createAccount({ role: "advertiser" });
    await migration`
      insert into identity.consent_events (account_id, purpose, granted, source)
      values (${account}, 'commercial_prospection', false, 'account_settings')`;
    await migration`
      insert into identity.consent_events (account_id, purpose, granted, source)
      values (${account}, 'commercial_prospection', true, 'account_settings')`;
    const { apollo_contact: line } = await insertLines(account, [
      "apollo_contact",
    ]);
    await turn();
    expect(await lineRow(line)).toMatchObject({
      status: "skipped",
      skip_reason: "prospection_opposed",
    });
    expect(apollo.requests).toEqual([]);
  });
});

describe("TM1.2, lead-pipeline T6: a failing Apollo changes nothing elsewhere", () => {
  it("TM1.2: Apollo answers 500, the line stays pending, the account is untouched", async () => {
    const account = await createAccount({ role: "advertiser" });
    const { apollo_contact: line } = await insertLines(account, [
      "apollo_contact",
    ]);
    apollo.queue({ status: 500 });
    await turn();
    expect(await lineRow(line)).toMatchObject({
      status: "pending",
      last_error_code: "apollo.unavailable",
    });
    const [kept] = await migration`
      select status::text as status from identity.accounts where id = ${account}`;
    expect(kept).toEqual({ status: "active" });
  });

  it("TM1.2: Brevo and Apollo both failing, the three lines of the sign-up stay pending", async () => {
    const account = await createAccount({ role: "advertiser" });
    const ids = await insertLines(account, [
      "brevo_contact",
      "brevo_transactional",
      "apollo_contact",
    ]);
    apollo.queue({ status: 500 });
    brevo.queue({ status: 500 }, { status: 500 });
    expect(await turn()).toBe(3);
    for (const id of Object.values(ids)) {
      expect((await lineRow(id)).status).toBe("pending");
    }
  });

  it("T6: Apollo down to its time-out, the Brevo lines of the same turn leave without waiting for it", async () => {
    const account = await createAccount({ role: "advertiser" });
    const ids = await insertLines(account, [
      "brevo_contact",
      "brevo_transactional",
      "apollo_contact",
    ]);
    apollo.setDefaultDelay(2_000);
    const [start] = await migration<
      { at: Date }[]
    >`select clock_timestamp() as at`;
    await turn({ apolloTimeoutMs: 1_000 });

    expect(await lineRow(ids.apollo_contact)).toMatchObject({
      status: "pending",
      last_error_code: "apollo.unreachable",
    });
    const brevoLines = await migration<{ status: string; elapsed: number }[]>`
      select status::text as status,
             extract(epoch from completed_at - ${start?.at ?? new Date()}::timestamptz)::float8
               as elapsed
        from leads.outbox_events
       where id in (${ids.brevo_contact}, ${ids.brevo_transactional})`;
    expect(brevoLines.map((row) => row.status)).toEqual([
      "succeeded",
      "succeeded",
    ]);
    for (const row of brevoLines) {
      expect(row.elapsed).toBeLessThan(1);
    }
    expect(brevo.delivered).toHaveLength(1);
  });
});

describe("0113: leads.read_apollo_subject(), an Apollo line in processing for this worker only", () => {
  function claimed(id: string, account: string): ClaimedLine {
    return {
      id,
      eventId: randomUUID(),
      eventType: "lead.created",
      destination: "apollo_contact",
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
    const { apollo_contact: line } = await insertLines(account, [
      "apollo_contact",
    ]);
    await processing(line, "tm1-apollo-reader");
    const requestId = `tm1-apollo-${randomUUID()}`;
    const subject = await readApolloSubjectOf(
      database,
      requestId,
      claimed(line, account),
      "tm1-apollo-reader",
    );
    expect(subject).toEqual({
      email: emails[0],
      company: LEGAL_NAME,
      prospectionOpposed: false,
      externalContactId: null,
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
    const account = await createAccount({ role: "advertiser" });
    const { apollo_contact: line } = await insertLines(account, [
      "apollo_contact",
    ]);
    await expect(
      readApolloSubjectOf(
        database,
        randomUUID(),
        claimed(line, account),
        "tm1-apollo-reader",
      ),
    ).rejects.toBeInstanceOf(LineTakenBackError);
    await processing(line, "tm1-apollo-other");
    await expect(
      readApolloSubjectOf(
        database,
        randomUUID(),
        claimed(line, account),
        "tm1-apollo-reader",
      ),
    ).rejects.toBeInstanceOf(LineTakenBackError);
  });

  it("refuses a Brevo line: Brevo reads by its own function (22023)", async () => {
    const account = await createAccount({ role: "advertiser" });
    const { brevo_contact: line } = await insertLines(account, [
      "brevo_contact",
    ]);
    await processing(line, "tm1-apollo-reader");
    const error = await readApolloSubjectOf(
      database,
      randomUUID(),
      claimed(line, account),
      "tm1-apollo-reader",
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

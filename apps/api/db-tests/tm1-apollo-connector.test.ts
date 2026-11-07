// TM1 (J6, commit 5) — the Apollo connector on the real queue: the worker's module and pool
// (influx_worker_login), its own read leads.read_apollo_subject() (0113), and the Apollo and Brevo
// doubles on the loopback (16 RG148: no test reaches either). 05 CA42 to CA45 with the settings
// written directly (the screens come with J8, the replay of a skipped line by hand), TM1.2 (a
// failing Apollo leaves the line pending and the account untouched), TM1.6 (the switch by category,
// no restart), lead-pipeline T6 (Apollo down has no effect on Brevo), RG85 (nothing of Apollo's own
// data in the database), the empty list of prospecting countries of staging (skipped, in dry_run as
// in live) and the guards of the read. The connector alone is tested in tests/apollo-connector.
// J8T-3 (J9 commit 10): CA58 end to end, the answer of a create lost after Apollo kept the contact,
// the line failed, replayed by leads.replay_outbox_lines() as an agent, then the worker: one contact.
// Accounts and lines are COMMITTED by the migration role; the other pending lines of the stack are
// held while the worker claims, as in tm1-brevo-connector. The three Apollo settings touched are
// restored after the file; brevo_list_ids is set and left as set (0145: a Brevo id never goes back
// to null, 05 RG163 (1)); no template id is written (D69).
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
  readBrandProfileAttributesOf,
  readBrevoErasureSubjectOf,
  readBrevoSubjectOf,
  readVerifiedBadgeOf,
} from "../src/domains/leads/queue.ts";
import type {
  ClaimedLine,
  OutboxDestination,
} from "../src/domains/leads/repository.ts";
import { createLogger } from "../src/platform/logger.ts";
import { actAsInternal, localSuperuser, migrationRole } from "./support.ts";

const INVALID_PARAMETER = "22023";
const LEGAL_NAME = "Atelier Vandenbroucke";
const SETTING_KEYS = [
  "apollo_scope",
  "apollo_legal_basis",
  "apollo_excluded_countries",
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
  // The settings of 0103, no country excluded (0141): each case changes what it tests.
  await setting("apollo_scope", "annonceurs_et_createurs_pro");
  await setting("apollo_legal_basis", CONSENT_REQUIRED);
  await setting("apollo_excluded_countries", []);
  await setting("brevo_list_ids", { advertisers: 2, creators: 3 });
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
      delete from profiles.advertiser_contact_details where account_id = any (${accountIds}::uuid[])`;
    await migration`
      delete from profiles.advertiser_topics where account_id = any (${accountIds}::uuid[])`;
    await migration`
      delete from profiles.advertiser_target_markets where account_id = any (${accountIds}::uuid[])`;
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
      readErasureSubject: (line) =>
        readBrevoErasureSubjectOf(database, randomUUID(), line, worker),
      readErasureNotificationSubject: () => Promise.resolve(null),
      readProfileDecision: () => Promise.resolve(null),
      readBrandProfile: (line) =>
        readBrandProfileAttributesOf(database, randomUUID(), line, worker),
      readVerificationEmail: () => Promise.resolve(null),
      readVerifiedBadge: (line) =>
        readVerifiedBadgeOf(database, randomUUID(), line, worker),
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
      readBrandProfile: (line) =>
        readBrandProfileAttributesOf(database, randomUUID(), line, worker),
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
    startedAt: "2026-01-01T00:00:00.000Z",
    sync: {
      mode: options.mode ?? "live",
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
  it("RG84 (0141): an excluded country skips country_excluded, nothing sent", async () => {
    await setting("apollo_excluded_countries", ["BE"]);
    const account = await createAccount({ role: "advertiser" });
    const { apollo_contact: line } = await insertLines(account, [
      "apollo_contact",
    ]);
    await turn();
    expect(await lineRow(line)).toMatchObject({
      status: "skipped",
      skip_reason: "country_excluded",
    });
    expect(apollo.requests).toEqual([]);
  });

  it("an excluded country in dry_run: the line is skipped (the dry_run marker is for a success only), never a dry success", async () => {
    await setting("apollo_excluded_countries", ["BE"]);
    const account = await createAccount({ role: "advertiser" });
    const { apollo_contact: line } = await insertLines(account, [
      "apollo_contact",
    ]);
    await turn({ mode: "dry_run", apolloKey: null });
    expect(await lineRow(line)).toMatchObject({
      status: "skipped",
      dry_run: false,
      skip_reason: "country_excluded",
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

describe("05 CA58 (J8T-3): a replayed line creates no duplicate at Apollo", () => {
  /** An active agent (0132: the replay requires one, in aal2), deactivated after the case. */
  async function newAgent(): Promise<string> {
    const id = randomUUID();
    await migration.begin(async (tx) => {
      await tx`
        insert into identity.accounts
          (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
           display_name, is_adult_attested, adult_attested_at, declared_status)
        values (${id}, ${randomUUID()}, ${`tm1-apollo-agent-${id}@example.test`}, now(), 'FR',
                'fr', 'Camille', true, now(), 'business')`;
      await tx`
        insert into identity.account_roles (account_id, role) values (${id}, 'agent')`;
      await tx`
        insert into identity.agent_profiles
          (account_id, first_name, activated_at, mfa_enrolled_at, mfa_factor_id)
        values (${id}, 'Camille', now(), now(), ${randomUUID()})`;
    });
    return id;
  }

  it("the create answered too late: the line fails, the agent replays it, the worker finds the same contact", async () => {
    const account = await createAccount({ role: "advertiser" });
    const { apollo_contact: line } = await insertLines(account, [
      "apollo_contact",
    ]);
    // Apollo keeps the contact, its answer never reaches the worker (time-out).
    apollo.setDefaultDelay(2_000);
    await turn({ apolloTimeoutMs: 500 });
    apollo.setDefaultDelay(0);
    expect(apollo.contacts.size).toBe(1);
    expect(await lineRow(line)).toMatchObject({
      status: "pending",
      provider_contact_id: null,
    });
    // The series of attempts exhausted (RG79), as the drain closes it.
    await migration`
      update leads.outbox_events
         set status = 'failed', attempts = 10, completed_at = now()
       where id = ${line}`;

    const agent = await newAgent();
    try {
      const outcomes = await localSuperuser().begin((tx) =>
        actAsInternal(
          tx,
          "influx_agent",
          { accountId: agent, role: "agent", aal: "aal2" },
          () => tx<{ outcome: string }[]>`
            select outcome from leads.replay_outbox_lines(
              ${[line]}::bigint[], 'provider_recovered')`,
        ),
      );
      expect(outcomes.map((row) => row.outcome)).toEqual(["requeued"]);
      expect(await turn()).toBe(1);
    } finally {
      await migration`
        update identity.agent_profiles
           set is_active = false, deactivated_at = now(), deactivated_by_account_id = account_id
         where account_id = ${agent}`;
    }

    // Two creates, deduplicated by address (run_dedupe): one contact, its id now kept.
    expect(
      apollo.requests.map((request) => `${request.method} ${request.path}`),
    ).toEqual(["POST /api/v1/contacts", "POST /api/v1/contacts"]);
    expect(apollo.contacts.size).toBe(1);
    const [known] = [...apollo.contacts.keys()];
    expect(await lineRow(line)).toMatchObject({
      status: "succeeded",
      provider_contact_id: known,
    });
    expect(await apolloState(account)).toEqual({
      last_status: "succeeded",
      external_contact_id: known,
    });
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

// L2C commit 10, 0212: profile.completed and lead.updated carry the live brand profile to Brevo and
// Apollo (06 RG78 to RG81, CA40 to CA43), read by the worker's own function.
const BRAND = {
  sector: "food_beverages",
  size: "11_50",
  domain: "maison-verbeke.example",
  completeness: 85,
  topics: ["food", "travel"],
  markets: ["BE", "FR", "NL"],
  // what RG80 keeps out of both providers
  contactFirstName: "Hildegarde",
  contactEmail: "hildegarde.contact@maison-verbeke.example",
  contactPhone: "+3225550123",
  contactUrl: "https://maison-verbeke.example/contactez-nous",
  presentation:
    "Confiserie artisanale de Bruges, fondee en 1921, six boutiques.",
};

/** The profile of a committed advertiser, as a publication leaves it (the migration role writes). */
async function fillPublishedProfile(
  account: string,
  status = "published",
): Promise<void> {
  await migration.begin(async (tx) => {
    await tx`
      update profiles.advertiser_profiles
         set status = ${status}::profiles.advertiser_profile_status,
             primary_sector_code = ${BRAND.sector}, company_size_band = ${BRAND.size},
             website_domain = ${BRAND.domain}, completeness_percent = ${BRAND.completeness},
             presentation = ${BRAND.presentation},
             first_published_at = case when ${status} = 'published' then now() end
       where account_id = ${account}`;
    for (const [index, topic] of BRAND.topics.entries()) {
      await tx`
        insert into profiles.advertiser_topics (account_id, slot, topic_code)
        values (${account}, ${index + 1}, ${topic})`;
    }
    for (const [index, country] of BRAND.markets.entries()) {
      await tx`
        insert into profiles.advertiser_target_markets (account_id, slot, country_code)
        values (${account}, ${index + 1}, ${country})`;
    }
    await tx`
      insert into profiles.advertiser_contact_details
        (account_id, contact_first_name, contact_email, contact_phone, contact_url)
      values (${account}, ${BRAND.contactFirstName}, ${BRAND.contactEmail},
              ${BRAND.contactPhone}, ${BRAND.contactUrl})`;
  });
}

describe("L2C commit 10, 06 RG78 to RG81, CA40 to CA43: profile.completed on the real queue", () => {
  function claimed(
    id: string,
    account: string,
    destination: OutboxDestination,
  ): ClaimedLine {
    return {
      id,
      eventId: randomUUID(),
      eventType: "profile.completed",
      destination,
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

  async function code(error: unknown): Promise<string | undefined> {
    let cause: unknown = error;
    while (
      cause instanceof Error &&
      (cause as { code?: string }).code === undefined
    ) {
      cause = cause.cause;
    }
    return (cause as { code?: string }).code;
  }

  it("CA40, RG79: the first publication reaches Brevo and Apollo with the real attributes of the live profile", async () => {
    const account = await createAccount({ role: "advertiser" });
    await fillPublishedProfile(account);
    const ids = await insertLines(
      account,
      ["brevo_contact", "apollo_contact"],
      "advertiser",
      "profile.completed",
    );
    expect(await turn()).toBe(2);

    expect(await lineRow(ids.brevo_contact)).toMatchObject({
      status: "succeeded",
    });
    expect(await lineRow(ids.apollo_contact)).toMatchObject({
      status: "succeeded",
    });
    expect(brevo.contacts.get(emails[0] ?? "")?.attributes).toMatchObject({
      PROFILE_TYPE: "advertiser",
      COMPANY: LEGAL_NAME,
      FUNNEL_STAGE: "profile_completed",
      PROFILE_COMPLETENESS: BRAND.completeness,
      MAIN_TOPIC: "food",
      SECTOR: BRAND.sector,
      COMPANY_SIZE: BRAND.size,
      TARGET_MARKETS: "BE,FR,NL",
      PROFILE_STATUS: "published",
      VERIFIED_LEVEL: "none",
    });
    const [contact] = [...apollo.contacts.values()];
    expect(contact?.fields).toMatchObject({
      organization_name: LEGAL_NAME,
      website_url: `https://${BRAND.domain}`,
    });
    expect(contact?.fields.label_names).toEqual(
      expect.arrayContaining([
        "influx_sector_food_beverages",
        "influx_size_11_50",
        "influx_country_be",
      ]),
    );
  });

  it("CA42, RG80: nothing the brand gave as its contact person, its presentation or the internal note leaves, raw bodies searched", async () => {
    const account = await createAccount({ role: "advertiser" });
    await fillPublishedProfile(account);
    await insertLines(
      account,
      ["brevo_contact", "apollo_contact"],
      "advertiser",
      "profile.completed",
    );
    await turn();
    expect(brevo.requests.length).toBeGreaterThan(0);
    expect(apollo.requests.length).toBeGreaterThan(0);
    const raw = [
      ...brevo.requests.map((request) => request.raw),
      ...apollo.requests.map((request) => JSON.stringify(request.body)),
    ].join("\n");
    expect(
      valuesFoundIn(raw, [
        BRAND.contactFirstName,
        BRAND.contactEmail,
        BRAND.contactPhone,
        BRAND.contactUrl,
        BRAND.presentation,
        "BE0123456789",
      ]),
    ).toEqual([]);
  });

  it("L2CS-8, RG80: with the REAL raison sociale and number of the internal block in the base, organization_name is the trading name and neither value reaches Brevo nor Apollo", async () => {
    const account = await createAccount({ role: "advertiser" });
    await fillPublishedProfile(account);
    const raison = "Vandenbroucke Holding Belgium SA";
    const number = "BE0987654321";
    await migration`
      insert into profiles.advertiser_internal_details
        (account_id, legal_name, registration_country_code, registration_number)
      values (${account}, ${raison}, 'BE', ${number})`;
    try {
      await insertLines(
        account,
        ["brevo_contact", "apollo_contact"],
        "advertiser",
        "profile.completed",
      );
      expect(await turn()).toBe(2);
      expect(
        (apollo.requests[0]?.body as { organization_name?: string })
          .organization_name,
      ).toBe(LEGAL_NAME);
      expect(brevo.contacts.get(emails[0] ?? "")?.attributes.COMPANY).toBe(
        LEGAL_NAME,
      );
      const raw = [
        ...brevo.requests.map((request) => request.raw),
        ...apollo.requests.map((request) => JSON.stringify(request.body)),
      ].join("\n");
      expect(valuesFoundIn(raw, [raison, number])).toEqual([]);
      // the worker's reads cannot reach the block at all (06 RG48): the owner has no right on it
      const [reach] = await migration<{ reached: boolean }[]>`
        select has_any_column_privilege('influx_leads_definer',
                                        'profiles.advertiser_internal_details',
                                        'SELECT') as reached`;
      expect(reach?.reached).toBe(false);
    } finally {
      await migration`
        delete from profiles.advertiser_internal_details where account_id = ${account}`;
    }
  });

  it("RG81: a draft brand is registered with its real completeness, the fields not filled sent empty", async () => {
    const account = await createAccount({ role: "advertiser" });
    await migration`
      update profiles.advertiser_profiles set completeness_percent = 30
       where account_id = ${account}`;
    await insertLines(account, ["brevo_contact"], "advertiser", "lead.updated");
    await turn();
    expect(brevo.contacts.get(emails[0] ?? "")?.attributes).toMatchObject({
      FUNNEL_STAGE: "registered",
      PROFILE_COMPLETENESS: 30,
      MAIN_TOPIC: "",
      SECTOR: "",
      COMPANY_SIZE: "",
      TARGET_MARKETS: "",
      PROFILE_STATUS: "draft",
    });
  });

  it("CA41: without consent the first publication is skipped no_consent at both providers, never a failure", async () => {
    const account = await createAccount({ role: "advertiser", consent: false });
    await fillPublishedProfile(account);
    const ids = await insertLines(
      account,
      ["brevo_contact", "apollo_contact"],
      "advertiser",
      "profile.completed",
    );
    await turn();
    expect(await lineRow(ids.brevo_contact)).toMatchObject({
      status: "skipped",
      skip_reason: "no_consent",
      last_error_code: null,
    });
    expect(await lineRow(ids.apollo_contact)).toMatchObject({
      status: "skipped",
      skip_reason: "no_consent",
      last_error_code: null,
    });
    expect(brevo.requests).toEqual([]);
    expect(apollo.requests).toEqual([]);
  });

  it("CA43: with Brevo and Apollo unavailable the lines wait, and the profile stays published", async () => {
    const account = await createAccount({ role: "advertiser" });
    await fillPublishedProfile(account);
    const ids = await insertLines(
      account,
      ["brevo_contact", "apollo_contact"],
      "advertiser",
      "profile.completed",
    );
    brevo.queue({ status: 503 });
    apollo.queue({ status: 503 });
    await turn();
    expect(await lineRow(ids.brevo_contact)).toMatchObject({
      status: "pending",
    });
    expect(await lineRow(ids.apollo_contact)).toMatchObject({
      status: "pending",
    });
    const [profile] = await migration<{ status: string }[]>`
      select status::text as status from profiles.advertiser_profiles
       where account_id = ${account}`;
    expect(profile?.status).toBe("published");
  });

  it("0212: the read serves the live row of a line this worker holds, and journals the read on the account", async () => {
    const account = await createAccount({ role: "advertiser" });
    await fillPublishedProfile(account);
    const { brevo_contact: line } = await insertLines(
      account,
      ["brevo_contact"],
      "advertiser",
      "profile.completed",
    );
    await processing(line, "tm1-brand-reader");
    const requestId = `tm1-brand-${randomUUID()}`;
    const attributes = await readBrandProfileAttributesOf(
      database,
      requestId,
      claimed(line, account, "brevo_contact"),
      "tm1-brand-reader",
    );
    expect(attributes).toEqual({
      status: "published",
      completenessPercent: BRAND.completeness,
      primarySector: BRAND.sector,
      companySizeBand: BRAND.size,
      websiteDomain: BRAND.domain,
      mainTopic: "food",
      targetMarkets: ["BE", "FR", "NL"],
      everPublished: true,
    });
    expect(Object.keys(attributes ?? {}).sort()).toEqual(
      [
        "companySizeBand",
        "completenessPercent",
        "everPublished",
        "mainTopic",
        "primarySector",
        "status",
        "targetMarkets",
        "websiteDomain",
      ].sort(),
    );
    const register = await migration<
      { event_type: string; subject_id: string }[]
    >`
      select event_type, subject_id::text as subject_id
        from audit.audit_events where request_id = ${requestId}`;
    expect(register).toEqual([
      { event_type: "elevated.leads.drain_outbox", subject_id: account },
    ]);
  });

  it("0212: a line of another worker, or not in processing, is refused (55000), a transactional line too (22023)", async () => {
    const account = await createAccount({ role: "advertiser" });
    await fillPublishedProfile(account);
    const ids = await insertLines(
      account,
      ["brevo_contact", "brevo_transactional"],
      "advertiser",
      "profile.completed",
    );
    await expect(
      readBrandProfileAttributesOf(
        database,
        randomUUID(),
        claimed(ids.brevo_contact, account, "brevo_contact"),
        "tm1-brand-reader",
      ),
    ).rejects.toBeInstanceOf(LineTakenBackError);
    await processing(ids.brevo_contact, "tm1-brand-other");
    await expect(
      readBrandProfileAttributesOf(
        database,
        randomUUID(),
        claimed(ids.brevo_contact, account, "brevo_contact"),
        "tm1-brand-reader",
      ),
    ).rejects.toBeInstanceOf(LineTakenBackError);
    await processing(ids.brevo_transactional, "tm1-brand-reader");
    const error = await readBrandProfileAttributesOf(
      database,
      randomUUID(),
      claimed(ids.brevo_transactional, account, "brevo_transactional"),
      "tm1-brand-reader",
    ).catch((caught: unknown) => caught);
    expect(await code(error)).toBe(INVALID_PARAMETER);
  });

  it("0212: no row for a creator, and none for an erased account", async () => {
    const creator = await createAccount({ role: "creator" });
    const { apollo_contact: creatorLine } = await insertLines(
      creator,
      ["apollo_contact"],
      "creator",
      "lead.updated",
    );
    await processing(creatorLine, "tm1-brand-reader");
    expect(
      await readBrandProfileAttributesOf(
        database,
        randomUUID(),
        claimed(creatorLine, creator, "apollo_contact"),
        "tm1-brand-reader",
      ),
    ).toBeNull();

    const brand = await createAccount({ role: "advertiser" });
    await fillPublishedProfile(brand);
    const { apollo_contact: brandLine } = await insertLines(
      brand,
      ["apollo_contact"],
      "advertiser",
      "lead.updated",
    );
    await processing(brandLine, "tm1-brand-reader");
    await migration`
      update identity.accounts set status = 'deleted', deleted_at = now() where id = ${brand}`;
    try {
      expect(
        await readBrandProfileAttributesOf(
          database,
          randomUUID(),
          claimed(brandLine, brand, "apollo_contact"),
          "tm1-brand-reader",
        ),
      ).toBeNull();
    } finally {
      await migration`
        update identity.accounts set status = 'active', deleted_at = null where id = ${brand}`;
    }
  });

  it("0212, 03 P7: the worker holds no right on the profile tables, only the function", async () => {
    const [rights] = await migration<
      {
        profile: boolean;
        topics: boolean;
        markets: boolean;
        contact: boolean;
      }[]
    >`
      select has_any_column_privilege('influx_worker', 'profiles.advertiser_profiles', 'SELECT') as profile,
             has_any_column_privilege('influx_worker', 'profiles.advertiser_topics', 'SELECT') as topics,
             has_any_column_privilege('influx_worker', 'profiles.advertiser_target_markets', 'SELECT') as markets,
             has_any_column_privilege('influx_leads_definer', 'profiles.advertiser_contact_details', 'SELECT') as contact`;
    expect(rights).toEqual({
      profile: false,
      topics: false,
      markets: false,
      contact: false,
    });
  });
});

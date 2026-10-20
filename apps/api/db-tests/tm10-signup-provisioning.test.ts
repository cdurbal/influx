// TM10 and TM1 (J5, commit 2) — the database half of the sign-up, migrations 0101 to 0106:
// identity.provision_account() (EC-30, 05 RG5 to RG8, RG22, RG32, RG33, RG110, D63), the three
// queue lines of lead.created (EC-10), the queue constraints (RG35, 05 RG74 / TM1.9), the
// foreign key of the transactional journal (EC-37), the shape of leads.sync_settings (EC-8),
// identity.set_declared_status() and identity.correct_email() (04 §5.1) and the immutable
// acquisition source (EC-11, 05 RG120).
// influx_auth_login can only be influx_auth, which reads none of what the function writes: the
// sign-ups are therefore COMMITTED (random identifiers, disposable local stack, like the committed
// fixtures of T8) and read back by the migration role. The other cases run in rolled-back
// transactions and read back as the administrator (influx_app may take any business role).
import {
  inRolledBackTransaction,
  probe,
  takeRole,
  type DataSet,
  type UserContext,
} from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { loginRole, migrationRole, testDataSet } from "./support.ts";

const INSUFFICIENT_PRIVILEGE = "42501";
const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";
const INVALID_PARAMETER = "22023";

/** A country nobody signs up from in the tests: the blocked-country case commits it. */
const BLOCKED_COUNTRY = "AQ";

let dataSet: DataSet;
let migration: postgres.Sql;
/** The terms of service in force in French, whatever file published it. */
let termsInForce: string;

type Signup = {
  authUserId: string;
  email: string;
  role: string;
  country: string;
  declaredStatus: string | null;
  adultAttested: boolean | null;
  legalName: string | null;
  /** null: the version in force, resolved at the call (it.each tables are built before beforeAll). */
  termsVersionId: string | null;
  consent: boolean | null;
  utmSource: string | null;
  heardFrom: string | null;
};

function creatorSignup(overrides: Partial<Signup> = {}): Signup {
  const authUserId = randomUUID();
  return {
    authUserId,
    email: `  TM10-${authUserId}@Example.test `,
    role: "creator",
    country: "FR",
    declaredStatus: "individual",
    adultAttested: true,
    legalName: null,
    termsVersionId: null,
    consent: true,
    utmSource: "newsletter",
    heardFrom: "social_media",
    ...overrides,
  };
}

function advertiserSignup(overrides: Partial<Signup> = {}): Signup {
  return creatorSignup({
    role: "advertiser",
    declaredStatus: null,
    adultAttested: false,
    legalName: "Maison Test",
    ...overrides,
  });
}

const PROVISION =
  "select provisioned_account_id, outcome from identity.provision_account(" +
  "$1::uuid, $2, $3::identity.account_role, $4, 'fr', $5::identity.declared_status, $6, $7, " +
  "$8::uuid, $9, 'signup.consent.marketing', 'I agree to receive news from INFLUX.', 'fr', $10, " +
  "null, null, null, $11::identity.heard_from)";

function parametersOf(s: Signup): postgres.ParameterOrJSON<never>[] {
  return [
    s.authUserId,
    s.email,
    s.role,
    s.country,
    s.declaredStatus,
    s.adultAttested,
    s.legalName,
    s.termsVersionId ?? termsInForce,
    s.consent,
    s.utmSource,
    s.heardFrom,
  ] as postgres.ParameterOrJSON<never>[];
}

type Provisioned = { provisioned_account_id: string | null; outcome: string };

async function provision(
  tx: postgres.TransactionSql,
  signup: Signup,
): Promise<Provisioned> {
  const rows = await tx.unsafe<Provisioned[]>(PROVISION, parametersOf(signup));
  const [row] = rows;
  if (row === undefined) {
    throw new Error("provision_account returned no row");
  }
  return row;
}

function asAuth<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(loginRole("influx_auth_login"), async (tx) => {
    await takeRole(tx, "influx_auth");
    return fn(tx);
  });
}

const TAKEN = {
  advertiser: "influx_advertiser",
  creator: "influx_creator",
  agent: "influx_agent",
  admin: "influx_admin",
} as const;

function contextOf(
  role: UserContext["role"],
  side: "a" | "b" = "a",
): UserContext {
  return {
    accountId: dataSet.accounts[role][side].id,
    role,
    aal: role === "agent" || role === "admin" ? "aal2" : "aal1",
  };
}

function asMember<T>(
  context: UserContext,
  fn: (tx: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return inRolledBackTransaction(loginRole("influx_app"), async (tx) => {
    await takeRole(tx, TAKEN[context.role], context);
    return fn(tx);
  });
}

/** Committed sign-up, as E-2 does it (influx_auth, no business context). */
function provisionCommitted(signup: Signup): Promise<Provisioned> {
  return loginRole("influx_auth_login").begin(async (tx) => {
    await takeRole(tx, "influx_auth");
    return provision(tx, signup);
  });
}

/** Switches the transaction to the administrator in aal2, to read back what it wrote. */
async function readAsAdmin(tx: postgres.TransactionSql): Promise<void> {
  await takeRole(tx, "influx_admin", contextOf("admin"));
}

beforeAll(async () => {
  migration = migrationRole();
  dataSet = await testDataSet();
  // 0109: only a version whose text is stored can be accepted
  const [terms] = await migration<{ id: string }[]>`
    select id from identity.terms_versions
     where document_kind = 'terms_of_service' and locale = 'fr'
       and effective_to is null and effective_from <= now() and content is not null`;
  if (terms === undefined) {
    throw new Error(
      "no terms of service in force in French WITH its text (data set of T2; on a workstation, " +
        "a version published before 0109 must be filled by db:publish-terms, 21 EC-62 (B))",
    );
  }
  termsInForce = terms.id;
});

describe("EC-30: identity.provision_account() creates a member account, all or nothing", () => {
  it("creates a creator: account, role, acceptance, two consents, three queue lines (EC-10)", async () => {
    const signup = creatorSignup();
    const result = await provisionCommitted(signup);
    const written = await migration.begin(async (tx) => {
      const id = result.provisioned_account_id;
      const [account] = await tx`
        select email, declared_status, is_adult_attested, adult_attested_at is not null as dated,
               email_verified_at is not null as verified, signup_utm_source, signup_heard_from,
               status
          from identity.accounts where id = ${id}`;
      const roles =
        await tx`select role from identity.account_roles where account_id = ${id}`;
      const profiles = await tx`
        select 1 from profiles.advertiser_profiles where account_id = ${id}`;
      const acceptances = await tx`
        select terms_version_id, locale, channel, nature,
               content_hash = (select content_hash from identity.terms_versions
                                where id = terms_version_id) as hash_copied
          from identity.terms_acceptances where account_id = ${id}`;
      const consents = await tx`
        select purpose, granted, source, evidence from identity.consent_events
         where account_id = ${id} order by purpose`;
      const queue = await tx`
        select event_id, event_type, destination, subject_key, payload, idempotency_key, status,
               priority
          from leads.outbox_events where subject_key = ${`account:${id}`}
         order by destination`;
      return { result, account, roles, profiles, acceptances, consents, queue };
    });
    const id = written.result.provisioned_account_id;
    expect(written.result.outcome).toBe("created");
    expect(written.account).toMatchObject({
      email: signup.email.trim().toLowerCase(),
      declared_status: "individual",
      is_adult_attested: true,
      dated: true,
      verified: true,
      signup_utm_source: "newsletter",
      signup_heard_from: "social_media",
      status: "active",
    });
    expect(written.roles).toEqual([{ role: "creator" }]);
    expect(written.profiles).toEqual([]);
    expect(written.acceptances).toEqual([
      {
        terms_version_id: termsInForce,
        locale: "fr",
        channel: "signup",
        nature: "acceptance",
        hash_copied: true,
      },
    ]);
    // RG32, RG33: one checkbox, two purposes, the exact wording presented
    const evidence = {
      form: "signup_creator",
      wording_key: "signup.consent.marketing",
      wording: "I agree to receive news from INFLUX.",
      locale: "fr",
    };
    expect(written.consents).toEqual([
      {
        purpose: "marketing_email",
        granted: true,
        source: "signup_form",
        evidence,
      },
      {
        purpose: "commercial_prospection",
        granted: true,
        source: "signup_form",
        evidence,
      },
    ]);
    expect(
      written.queue.map((line) => [
        line.destination,
        line.event_type,
        line.status,
      ]),
    ).toEqual([
      ["brevo_contact", "lead.created", "pending"],
      ["apollo_contact", "lead.created", "pending"],
      ["brevo_transactional", "lead.created", "pending"],
    ]);
    // one fact, three destinations; identifiers only (TM1.9)
    expect(new Set(written.queue.map((line) => line.event_id)).size).toBe(1);
    for (const line of written.queue) {
      expect(JSON.stringify(line.payload)).not.toContain("@");
      expect(line.payload).toMatchObject({ account_id: id });
    }
    // RG76: the welcome is unique by nature, keyed on the account only
    expect(written.queue[2]).toMatchObject({
      idempotency_key: `account.welcome:${id}`,
      payload: { email_code: "account.welcome_creator" },
    });
  });

  it("creates an advertiser: business imposed (RG22), the profile with its company name", async () => {
    const result = await provisionCommitted(advertiserSignup());
    const written = await migration.begin(async (tx) => {
      const id = result.provisioned_account_id;
      const [account] = await tx`
        select declared_status, is_adult_attested, adult_attested_at
          from identity.accounts where id = ${id}`;
      const profiles = await tx`
        select legal_name, status from profiles.advertiser_profiles where account_id = ${id}`;
      const [welcome] = await tx`
        select payload from leads.outbox_events
         where subject_key = ${`account:${id}`} and destination = 'brevo_transactional'`;
      return { result, account, profiles, welcome };
    });
    expect(written.result.outcome).toBe("created");
    expect(written.account).toEqual({
      declared_status: "business",
      is_adult_attested: false,
      adult_attested_at: null,
    });
    expect(written.profiles).toEqual([
      { legal_name: "Maison Test", status: "draft" },
    ]);
    expect(written.welcome?.payload).toMatchObject({
      email_code: "account.welcome_advertiser",
    });
  });

  it("is idempotent on auth_user_id (RG110): a second call writes nothing", async () => {
    const signup = creatorSignup();
    const first = await provisionCommitted(signup);
    const second = await provisionCommitted({ ...signup, role: "advertiser" });
    const [lines] = await migration<{ count: number }[]>`
      select count(*)::int as count from leads.outbox_events
       where subject_key = ${`account:${first.provisioned_account_id}`}`;
    const outcome = { first, second, lines: lines?.count };
    expect(outcome.second).toEqual({
      provisioned_account_id: outcome.first.provisioned_account_id,
      outcome: "existing",
    });
    expect(outcome.lines).toBe(3);
  });

  it("creates nothing for a blocked country (RG8), from the setting read at the call", async () => {
    const signup = creatorSignup({ country: BLOCKED_COUNTRY });
    await migration`
      update leads.sync_settings set value = jsonb_build_array(${BLOCKED_COUNTRY}::text)
       where key = 'signup_blocked_countries'`;
    try {
      const result = await provisionCommitted(signup);
      const accounts = await migration`
        select 1 from identity.accounts where auth_user_id = ${signup.authUserId}`;
      const outcome = { result, accounts };
      expect(outcome.result).toEqual({
        provisioned_account_id: null,
        outcome: "country_blocked",
      });
      expect(outcome.accounts).toEqual([]);
    } finally {
      await migration`
        update leads.sync_settings set value = '[]'::jsonb
         where key = 'signup_blocked_countries'`;
    }
  });

  it.each([
    ["an agent role", creatorSignup({ role: "agent" }), INSUFFICIENT_PRIVILEGE],
    ["an admin role", creatorSignup({ role: "admin" }), INSUFFICIENT_PRIVILEGE],
    [
      "an individual advertiser (RG22)",
      advertiserSignup({ declaredStatus: "individual" }),
      INVALID_PARAMETER,
    ],
    [
      "an advertiser without company name",
      advertiserSignup({ legalName: " " }),
      INVALID_PARAMETER,
    ],
    [
      "a creator without the adult attestation (D15, RG19)",
      creatorSignup({ adultAttested: false }),
      INVALID_PARAMETER,
    ],
    [
      "a creator without declared status (RG18)",
      creatorSignup({ declaredStatus: null }),
      INVALID_PARAMETER,
    ],
    [
      "a refused marketing consent while required (D63)",
      creatorSignup({ consent: false }),
      INVALID_PARAMETER,
    ],
    [
      "an unknown terms version (RG25)",
      creatorSignup({ termsVersionId: randomUUID() }),
      FOREIGN_KEY_VIOLATION,
    ],
  ])("refuses %s", async (_label, signup, code) => {
    expect(
      await asAuth((tx) => probe(tx, PROVISION, parametersOf(signup))),
    ).toEqual({ outcome: "error", code });
  });

  it("refuses a terms version in force without its text (0109, 21 EC-62)", async () => {
    // An inherited version, published without text before 0109, can no longer be inserted: the
    // migration role drops the NOT VALID constraint for the insert and puts it back, then takes
    // influx_auth through a membership granted inside the same ROLLED-BACK transaction (as in
    // tm10-terms-in-force.test.ts): nothing survives, not even after an interrupted run.
    const outcome = await inRolledBackTransaction(migration, async (tx) => {
      await tx`
        update identity.terms_versions
           set effective_to = greatest(effective_from + interval '1 second', now())
         where document_kind = 'terms_of_service' and locale = 'fr' and effective_to is null`;
      await tx`alter table identity.terms_versions
                 drop constraint terms_versions_content_required`;
      const [inherited] = await tx<{ id: string }[]>`
        insert into identity.terms_versions
          (document_kind, locale, version_label, content_uri, content_hash, requires_acceptance,
           published_at, effective_from)
        values ('terms_of_service', 'fr', 'tm10-no-text', 'legal/terms_of_service/fr/tm10.md',
                sha256('tm10-no-text'::bytea), true, now(), now())
        returning id::text`;
      if (inherited === undefined) {
        throw new Error("inherited terms version not inserted");
      }
      await tx`alter table identity.terms_versions
                 add constraint terms_versions_content_required
                 check (content is not null or effective_to is not null) not valid`;
      await tx`grant influx_auth to current_user with inherit false, set true`;
      await tx`set local role influx_auth`;
      return probe(
        tx,
        PROVISION,
        parametersOf(creatorSignup({ termsVersionId: inherited.id })),
      );
    });
    expect(outcome).toEqual({
      outcome: "error",
      code: FOREIGN_KEY_VIOLATION,
    });
  });

  it.each(["advertiser", "creator", "agent", "admin"] as const)(
    "is not executable by %s (EXECUTE to influx_auth only)",
    async (role) => {
      expect(
        await asMember(contextOf(role), (tx) =>
          probe(tx, PROVISION, parametersOf(creatorSignup())),
        ),
      ).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
    },
  );
});

describe("0101: the queue constraints", () => {
  async function insertLine(
    tx: postgres.TransactionSql,
    columns: {
      destination: string;
      status?: string;
      skip?: string;
      /** jsonb parameter: postgres.js serialises the object itself. */
      payload?: Record<string, string>;
    },
  ) {
    const event = randomUUID();
    return probe(
      tx,
      `insert into leads.outbox_events
         (event_id, event_type, destination, subject_key, payload, idempotency_key, status,
          skip_reason, completed_at)
       values ($1, 'lead.created', $2::leads.outbox_destination, $3, $4::jsonb, $5,
               $6::leads.outbox_status, $7, case when $6 = 'pending' then null else now() end)`,
      [
        event,
        columns.destination,
        `account:${dataSet.accounts.creator.a.id}`,
        columns.payload ?? { event_id: event },
        `tm10:${event}`,
        columns.status ?? "pending",
        columns.skip ?? null,
      ],
    );
  }

  it("never skips a transactional line for lack of marketing consent (RG35)", async () => {
    const results = await inRolledBackTransaction(migration, async (tx) => [
      await insertLine(tx, {
        destination: "brevo_transactional",
        status: "skipped",
        skip: "no_consent",
      }),
      await insertLine(tx, {
        destination: "brevo_contact",
        status: "skipped",
        skip: "no_consent",
      }),
    ]);
    expect(results).toEqual([
      { outcome: "error", code: CHECK_VIOLATION },
      { outcome: "rows", count: 1 },
    ]);
  });

  it("refuses an address in a payload (05 RG74, TM1.9)", async () => {
    expect(
      await inRolledBackTransaction(migration, (tx) =>
        insertLine(tx, {
          destination: "brevo_contact",
          payload: { email: "someone@example.test" },
        }),
      ),
    ).toEqual({ outcome: "error", code: CHECK_VIOLATION });
  });

  it("keeps the description of a line immutable, only its processing moves", async () => {
    const results = await inRolledBackTransaction(migration, async (tx) => {
      await insertLine(tx, { destination: "brevo_contact" });
      return [
        await probe(
          tx,
          "update leads.outbox_events set payload = '{}' where idempotency_key like 'tm10:%'",
        ),
        await probe(
          tx,
          "update leads.outbox_events set attempts = 1, available_at = now() + interval '1 minute' " +
            "where idempotency_key like 'tm10:%'",
        ),
      ];
    });
    expect(results).toEqual([
      { outcome: "error", code: INSUFFICIENT_PRIVILEGE },
      { outcome: "rows", count: 1 },
    ]);
  });

  it("links a transactional journal line to an existing queue line only (EC-37)", async () => {
    expect(
      await inRolledBackTransaction(migration, (tx) =>
        probe(
          tx,
          "insert into leads.transactional_sends (email_code, priority, account_id, locale, " +
            "outbox_event_id) values ('account.welcome_creator', 'p1', $1, 'fr', -1)",
          [dataSet.accounts.creator.a.id],
        ),
      ),
    ).toEqual({ outcome: "error", code: FOREIGN_KEY_VIOLATION });
  });
});

describe("0103 (EC-8): the shape of leads.sync_settings", () => {
  it("holds the ten keys with their starting values (0131: signup_invitation_validity_days)", async () => {
    const rows = await migration<{ key: string; value: unknown }[]>`
      select key, value from leads.sync_settings order by key`;
    expect(
      Object.fromEntries(rows.map((row) => [row.key, row.value])),
    ).toMatchObject({
      apollo_scope: "annonceurs_et_createurs_pro",
      apollo_legal_basis: { default: "consentement_requis", by_country: {} },
      apollo_excluded_countries: [],
      signup_blocked_countries: [],
      signup_consent_required: true,
      signup_invitation_validity_days: 30,
    });
    expect(rows).toHaveLength(10);
  });

  it.each([
    [
      "an unknown key",
      "insert into leads.sync_settings (key, value) values ('other', 'true')",
      CHECK_VIOLATION,
    ],
    [
      "a scope outside the three values of RG81",
      "update leads.sync_settings set value = '\"everyone\"' where key = 'apollo_scope'",
      CHECK_VIOLATION,
    ],
    [
      // a malformed code ("fr") is refused too, by the BEFORE trigger first (unknown country)
      "a legal basis outside the two values of RG83",
      "update leads.sync_settings set value = " +
        '\'{"default": "consentement_requis", "by_country": {"FR": "other"}}\' ' +
        "where key = 'apollo_legal_basis'",
      CHECK_VIOLATION,
    ],
    [
      "a malformed country code (refused by the trigger, before the CHECK)",
      "update leads.sync_settings set value = '[\"fr\"]' where key = 'apollo_excluded_countries'",
      FOREIGN_KEY_VIOLATION,
    ],
    [
      "an unknown country",
      "update leads.sync_settings set value = '[\"ZZ\"]' where key = 'signup_blocked_countries'",
      FOREIGN_KEY_VIOLATION,
    ],
    [
      "a decreasing retry schedule",
      "update leads.sync_settings set value = '[60, 0]' where key = 'retry_schedule'",
      CHECK_VIOLATION,
    ],
  ])("refuses %s", async (_label, statement, code) => {
    expect(
      await inRolledBackTransaction(migration, (tx) => probe(tx, statement)),
    ).toEqual({ outcome: "error", code });
  });
});

describe("04 §5.1: identity.set_declared_status()", () => {
  const CALL =
    "select identity.set_declared_status($1::uuid, $2::identity.declared_status, 'member_request')";

  it("lets a creator change their own status: column, two queue lines, register line", async () => {
    const creator = dataSet.accounts.creator.a.id;
    const outcome = await asMember(contextOf("creator"), async (tx) => {
      const [changed] = await tx.unsafe<{ set_declared_status: boolean }[]>(
        CALL,
        [creator, "business"],
      );
      await readAsAdmin(tx);
      const [account] = await tx`
        select declared_status from identity.accounts where id = ${creator}`;
      const queue = await tx`
        select destination from leads.outbox_events
         where subject_key = ${`account:${creator}`} and event_type = 'lead.updated'
         order by destination`;
      const [line] = await tx`
        select payload from audit.audit_events
         where event_type = 'account.declared_status_changed' and subject_id = ${creator}
         order by seq desc limit 1`;
      return { changed: changed?.set_declared_status, account, queue, line };
    });
    expect(outcome.changed).toBe(true);
    expect(outcome.account).toEqual({ declared_status: "business" });
    expect(outcome.queue).toEqual([
      { destination: "brevo_contact" },
      { destination: "apollo_contact" },
    ]);
    expect(outcome.line?.payload).toMatchObject({
      from: "individual",
      to: "business",
      reason_code: "member_request",
    });
  });

  it("returns false and writes nothing when the status does not change", async () => {
    const creator = dataSet.accounts.creator.a.id;
    expect(
      await asMember(contextOf("creator"), async (tx) => {
        const [row] = await tx.unsafe<{ set_declared_status: boolean }[]>(
          CALL,
          [creator, "individual"],
        );
        return row?.set_declared_status;
      }),
    ).toBe(false);
  });

  it.each([
    [
      "a creator for another account",
      contextOf.bind(null, "creator", "a"),
      "creator",
      "b",
      "business",
      INSUFFICIENT_PRIVILEGE,
    ],
    [
      "an advertiser (no EXECUTE)",
      contextOf.bind(null, "advertiser", "a"),
      "advertiser",
      "a",
      "business",
      INSUFFICIENT_PRIVILEGE,
    ],
    [
      "an agent on an advertiser set to individual (RG22)",
      contextOf.bind(null, "agent", "a"),
      "advertiser",
      "a",
      "individual",
      CHECK_VIOLATION,
    ],
    [
      "an agent on an internal account",
      contextOf.bind(null, "agent", "a"),
      "admin",
      "a",
      "business",
      INSUFFICIENT_PRIVILEGE,
    ],
  ] as const)(
    "refuses %s",
    async (_label, context, targetRole, side, status, code) => {
      expect(
        await asMember(context(), (tx) =>
          probe(tx, CALL, [dataSet.accounts[targetRole][side].id, status]),
        ),
      ).toEqual({ outcome: "error", code });
    },
  );

  it("lets an agent in aal2 change a member's status", async () => {
    expect(
      await asMember(contextOf("agent"), (tx) =>
        probe(tx, CALL, [dataSet.accounts.creator.b.id, "business"]),
      ),
    ).toEqual({ outcome: "rows", count: 1 });
  });
});

describe("04 §5.1: identity.correct_email(), administrators only, R in base (0132)", () => {
  const CALL =
    "select identity.correct_email($1::uuid, $2::uuid, $3, 'identity_checked_by_phone')";

  /** A fresh backoffice session of admin A, committed: its TOTP proof is now (R, 0132). */
  async function freshAdminSession(): Promise<string> {
    const [row] = await migration<{ id: string }[]>`
      insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
      values (sha256(gen_random_uuid()::text::bytea), ${dataSet.accounts.admin.a.id}, 'backoffice',
              'totp', 'firefox.linux')
      returning id::text`;
    if (row === undefined) {
      throw new Error("no session");
    }
    return row.id;
  }

  it("changes the address, resets its health and proof, queues the notices and the contacts", async () => {
    const creator = dataSet.accounts.creator.b.id;
    const session = await freshAdminSession();
    // the session of the request is the one R is given (J8S-3, 0142), as in apps/api
    const outcome = await asMember(
      { ...contextOf("admin"), sessionId: session },
      async (tx) => {
        await tx.unsafe(CALL, [session, creator, " New-Address@Example.test "]);
        await readAsAdmin(tx);
        const [account] = await tx`
        select email, email_status, email_verified_at from identity.accounts where id = ${creator}`;
        const queue = await tx`
        select event_type, destination, priority, payload ->> 'recipient' as recipient
          from leads.outbox_events where subject_key = ${`account:${creator}`}
           and event_type in ('account.email_corrected', 'lead.updated')
         order by event_type, destination, recipient`;
        const [line] = await tx`
        select payload from audit.audit_events
         where event_type = 'account.email_corrected' and subject_id = ${creator}
         order by seq desc limit 1`;
        return { account, queue, line };
      },
    );
    expect(outcome.account).toEqual({
      email: "new-address@example.test",
      email_status: "unknown",
      email_verified_at: null,
    });
    expect(outcome.queue).toEqual([
      {
        event_type: "account.email_corrected",
        destination: "brevo_transactional",
        priority: 0,
        recipient: "current",
      },
      {
        event_type: "account.email_corrected",
        destination: "brevo_transactional",
        priority: 0,
        recipient: "previous",
      },
      {
        event_type: "lead.updated",
        destination: "brevo_contact",
        priority: 100,
        recipient: null,
      },
      {
        event_type: "lead.updated",
        destination: "apollo_contact",
        priority: 100,
        recipient: null,
      },
    ]);
    expect(outcome.line?.payload).toMatchObject({
      previous_email: "t2-creator-b@example.test",
      reason_code: "identity_checked_by_phone",
    });
  });

  it.each(["advertiser", "creator", "agent"] as const)(
    "is not executable by %s",
    async (role) => {
      expect(
        await asMember(contextOf(role), (tx) =>
          probe(tx, CALL, [
            randomUUID(),
            dataSet.accounts.creator.b.id,
            "other@example.test",
          ]),
        ),
      ).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
    },
  );
});

describe("EC-11, 05 RG120: the acquisition source is written once", () => {
  it("refuses any later change, whoever writes", async () => {
    expect(
      await inRolledBackTransaction(migration, (tx) =>
        probe(
          tx,
          "update identity.accounts set signup_utm_source = 'changed' where id = $1",
          [dataSet.accounts.creator.a.id],
        ),
      ),
    ).toEqual({ outcome: "error", code: INSUFFICIENT_PRIVILEGE });
  });

  it("refuses a full address as the referring domain", async () => {
    expect(
      await asAuth(async (tx) =>
        probe(
          tx,
          PROVISION.replace(
            "null, null, null,",
            "null, null, 'https://example.test/page',",
          ),
          parametersOf(creatorSignup()),
        ),
      ),
    ).toEqual({ outcome: "error", code: CHECK_VIOLATION });
  });

  it("refuses an IP literal as the referring domain (0110)", async () => {
    expect(
      await asAuth(async (tx) =>
        probe(
          tx,
          PROVISION.replace("null, null, null,", "null, null, '127.0.0.1',"),
          parametersOf(creatorSignup()),
        ),
      ),
    ).toEqual({ outcome: "error", code: CHECK_VIOLATION });
  });
});

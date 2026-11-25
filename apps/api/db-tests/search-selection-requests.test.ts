// L3F commit 05 — the request for a selection by the INFLUX team, 0325 (jalons/l3f/05.md; l3f-fiche.md
// invariants 4, 6, 10, 11, 15; jalons/l3f/modele.md §1, §6; 10 RG61, CA39, CA64; 15 queue 9; D45).
//   L3F-T5  the door in the catalogue (EXECUTE for the brand alone, nothing of the outbox, matching nor
//           a campaign table), the rights of its owner and of the erasure, none for a member (T2,
//           42501 direct); the gate (42501, RG1); CA39 (every criterion, the campaign, the language,
//           the deadline of queue 9, the register); the switch closed and the threshold not reached
//           accepted (RG61); the campaign (admitted, otherwise P0002 campaign byte for byte); the
//           filters and the message (22023); the bound requestsPerDay; D45 and CA64 (nothing to the
//           creator, the outbox, matching nor messaging); the export and the erasure (04 §9).
// Each case runs in a rolled-back transaction of the local superuser, which writes its fixtures outside
// the guards and acts as apps/api does (influx_app, then the brand's role and context).
import { inRolledBackTransaction } from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  putCampaignInState,
  type CampaignState,
} from "./campaign-publication-kit.ts";
import {
  actAs,
  actAsInternal,
  actAsMember,
  bindRequestSession,
  localSuperuser,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;
type Parameter = postgres.ParameterOrJSON<never> | null | undefined;

const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_IN_PREREQUISITE_STATE = "55000";

const OWNER = "influx_creator_search_definer";
const PRIVACY_OWNER = "influx_privacy_definer";
const DOOR_SIGNATURE = "search.request_team_selection(jsonb,uuid,text)";
const REQUEST =
  "select search.request_team_selection($1::text::jsonb, $2::uuid, $3::text) as answer";

/** The criteria of a search as the brand entered them (10 RG61: every criterion). */
const FILTERS = {
  F1: "pets",
  F6: { country: "CY", shareBands: ["ge_80"] },
  F11: ["fr"],
};

let adminA: string;
let adminB: string;
let agentA: string;

beforeAll(async () => {
  const dataSet = await testDataSet();
  adminA = dataSet.accounts.admin.a.id;
  adminB = dataSet.accounts.admin.b.id;
  agentA = dataSet.accounts.agent.a.id;
});

type Outcome<T> =
  | { outcome: "rows"; rows: T[] }
  | {
      outcome: "error";
      code: string;
      detail: string | undefined;
      message: string;
    };

type Answer = {
  state: string;
  answerBy?: string;
  retryAfterSeconds?: number;
};

/** One statement in a savepoint of `tx`: its rows, or its SQLSTATE, detail and message. */
async function run<T = Row>(
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
    const found = error as { code?: string; detail?: string; message?: string };
    if (found.code === undefined) throw error;
    return {
      outcome: "error",
      code: found.code,
      detail: found.detail,
      message: found.message ?? "",
    };
  }
}

function errorOf(outcome: Outcome<unknown>): string {
  return outcome.outcome === "error"
    ? `${outcome.code} ${outcome.detail ?? ""}`.trim()
    : "ok";
}

/** An answer as the API would read it, every byte of it (T14). */
function bytesOf(outcome: Outcome<unknown>): string {
  return outcome.outcome === "error"
    ? JSON.stringify({
        code: outcome.code,
        detail: outcome.detail,
        message: outcome.message,
      })
    : JSON.stringify(outcome.rows);
}

function rowsOf<T>(outcome: Outcome<T>): T[] {
  if (outcome.outcome === "error") {
    throw new Error(`${outcome.code} ${outcome.message}`);
  }
  return outcome.rows;
}

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

// the fixtures ------------------------------------------------------------------------------------

async function setting(tx: Tx, key: string, value: unknown): Promise<void> {
  await tx`update search.search_settings set value = ${JSON.stringify(value)}::text::jsonb
            where key = ${key}`;
}

async function newAccount(
  tx: Tx,
  role: "creator" | "advertiser",
  options: { language?: "fr" | "en"; status?: "active" | "suspended" } = {},
): Promise<string> {
  const id = randomUUID();
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language, display_name,
       is_adult_attested, adult_attested_at, declared_status)
    values (${id}, ${randomUUID()}, ${`l3f-t5-${id}@example.test`}, now(), 'FR',
            ${options.language ?? "fr"}, 'L3F T5 Person', true, now(),
            ${role === "creator" ? "individual" : "business"})`;
  await tx`insert into identity.account_roles (account_id, role) values (${id}, ${role})`;
  if (options.status === "suspended") {
    await tx`update identity.accounts set status = 'suspended', suspended_at = now()
              where id = ${id}`;
  }
  return id;
}

type BrandSpec = {
  status?: "draft" | "pending_review" | "published" | "rejected" | "suspended";
  account?: "active" | "suspended";
  language?: "fr" | "en";
};

/** A brand whose profile is published by default (10 RG1). */
async function newBrand(tx: Tx, spec: BrandSpec = {}): Promise<string> {
  const id = await newAccount(tx, "advertiser", {
    status: spec.account,
    language: spec.language,
  });
  await tx`
    insert into profiles.advertiser_profiles
      (account_id, legal_name, primary_sector_code, company_size_band, website_domain, presentation,
       exclusivity_band, collaboration_rhythm, offers_non_monetary, contact_role)
    values (${id}, 'L3F T5 Brand', 'sports_leisure', '11_50',
            ${`l3f-t5-${id.slice(0, 8)}.example`},
            'A brand of the L3F tests, which writes its own words.', 'le_3m', 'recurring', true,
            'partnerships_influence')`;
  const status = spec.status ?? "published";
  if (status !== "draft") {
    await tx`update profiles.advertiser_profiles
                set status = ${status}::profiles.advertiser_profile_status
              where account_id = ${id}`;
  }
  return id;
}

/** A campaign of `brand` in `state`, by its title. */
async function newCampaign(
  tx: Tx,
  brand: string,
  state: CampaignState = "published",
  title = "L3F T5 campaign",
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into campaigns.campaigns (advertiser_account_id, sector_code, title)
    values (${brand}, 'real_estate', ${title}) returning id::text`;
  if (row === undefined) throw new Error("no campaign");
  await putCampaignInState(tx, row.id, state);
  return row.id;
}

/** A creator with its storefront (an opening names it). */
async function newCreator(tx: Tx): Promise<string> {
  const id = await newAccount(tx, "creator");
  await tx`
    insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
    values (${id}, profiles.new_creator_alias(), 'FR')`;
  return id;
}

/** An opening of a profile served to `brand`, written outside the door. */
async function giveOpening(
  tx: Tx,
  brand: string,
  creator: string,
): Promise<void> {
  await tx`insert into search.profile_openings (account_id, outcome, creator_account_id)
           values (${brand}, 'served', ${creator})`;
}

// the door ----------------------------------------------------------------------------------------

function asBrand<T>(tx: Tx, brand: string, fn: () => Promise<T>): Promise<T> {
  return actAsMember(
    tx,
    "influx_advertiser",
    { accountId: brand, role: "advertiser", aal: "aal1" },
    fn,
  );
}

function call(
  tx: Tx,
  brand: string,
  filters: unknown = FILTERS,
  campaign: string | null = null,
  message: string | null = null,
): Promise<Outcome<{ answer: Answer }>> {
  return asBrand(tx, brand, () =>
    run<{ answer: Answer }>(tx, REQUEST, [
      filters === null ? null : JSON.stringify(filters),
      campaign,
      message,
    ]),
  );
}

async function request(
  tx: Tx,
  brand: string,
  filters: unknown = FILTERS,
  campaign: string | null = null,
  message: string | null = null,
): Promise<Answer> {
  const outcome = await call(tx, brand, filters, campaign, message);
  return outcome.outcome === "rows"
    ? (outcome.rows[0]?.answer ?? { state: "none" })
    : { state: `error ${errorOf(outcome)}` };
}

async function requestsOf(tx: Tx, brand: string): Promise<Row[]> {
  return tx<Row[]>`
    select campaign_id::text as campaign_id, filters, language, message, state,
           sla_due_at = backoffice.business_deadline('team_selection', created_at, 480) as on_time,
           to_char(timezone('UTC', sla_due_at), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as due
      from search.selection_requests
     where advertiser_account_id = ${brand}
     order by created_at, id`;
}

async function countOf(tx: Tx, brand: string): Promise<number> {
  const [row] = await tx<{ n: number }[]>`
    select count(*)::int as n from search.selection_requests
     where advertiser_account_id = ${brand}`;
  return row?.n ?? -1;
}

// the export and the erasure, as E-5 runs them (the helpers of t8-privacy-execution) --------------

async function deposit(
  tx: Tx,
  account: string,
  type: "access" | "erasure",
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into backoffice.data_subject_requests (request_type, requester_account_id)
    values (${type}::backoffice.data_request_type, ${account})
    returning id::text`;
  if (row === undefined) throw new Error("no request");
  return row.id;
}

function asAdmin<T>(tx: Tx, account: string, fn: () => Promise<T>): Promise<T> {
  return actAsInternal(
    tx,
    "influx_admin",
    { accountId: account, role: "admin", aal: "aal2" },
    fn,
  );
}

async function inSession<T>(
  tx: Tx,
  statement: string,
  parameters: readonly Parameter[],
): Promise<Outcome<T>> {
  await bindRequestSession(tx, String(parameters[0]));
  return run<T>(tx, statement, parameters);
}

/** The whole approval: the dual control requested by B, confirmed and consumed by A with R. */
async function approve(
  tx: Tx,
  dataRequest: string,
  type: "access" | "erasure",
): Promise<void> {
  const payload = JSON.stringify({
    request_id: dataRequest,
    request_type: type,
  });
  const requested = await asAdmin(tx, adminB, () =>
    run<{ id: string }>(
      tx,
      "select backoffice.request_dual_control('privacy.approve_data_request', $1::text::jsonb, $2)::text as id",
      [payload, "request_instructed"],
    ),
  );
  const dualControl = String(rowsOf(requested)[0]?.id);
  const [session] = await tx<{ id: string }[]>`
    insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (sha256(gen_random_uuid()::text::bytea), ${adminA}, 'backoffice', 'totp', 'firefox.linux')
    returning id::text`;
  const sessionId = String(session?.id);
  rowsOf(
    await asAdmin(tx, adminA, () =>
      inSession(
        tx,
        "select backoffice.confirm_dual_control($1::uuid, $2::uuid, $3) as mode",
        [sessionId, dualControl, null],
      ),
    ),
  );
  rowsOf(
    await asAdmin(tx, adminA, () =>
      inSession(
        tx,
        "select backoffice.approve_data_request_execution($1::uuid, $2::uuid, $3::uuid, " +
          "$4::backoffice.data_request_type, $5)",
        [sessionId, dualControl, dataRequest, type, "request_instructed"],
      ),
    ),
  );
}

async function execute(
  tx: Tx,
  dataRequest: string,
  notice: unknown,
): Promise<void> {
  rowsOf(
    await actAs(tx, "privacy", () =>
      run(
        tx,
        "select request_type from privacy.execute_request($1::uuid, $2::text::jsonb)",
        [dataRequest, notice === null ? null : JSON.stringify(notice)],
      ),
    ),
  );
}

const CATEGORIES = [
  "account",
  "advertiser_profile",
  "creator_profile",
  "consents",
  "terms_acceptances",
  "sessions",
  "transactional_emails",
  "email_changes",
  "email_delivery_incidents",
  "delivery_reports",
  "brevo_events",
  "activity_log",
  "error_reports",
  "data_requests",
  "recipients",
] as const;

const NOTICE = {
  language: "en",
  title: "Your data held by INFLUX",
  categories: Object.fromEntries(
    CATEGORIES.map((key) => [key, `Purpose and retention of ${key}`]),
  ),
};

async function exportOf(tx: Tx, account: string): Promise<string> {
  const dataRequest = await deposit(tx, account, "access");
  await approve(tx, dataRequest, "access");
  await execute(tx, dataRequest, NOTICE);
  const [stored] = await tx<{ content: string }[]>`
    select content from privacy.data_exports where request_id = ${dataRequest}`;
  return String(stored?.content);
}

async function eraseOf(tx: Tx, account: string): Promise<void> {
  const dataRequest = await deposit(tx, account, "erasure");
  await approve(tx, dataRequest, "erasure");
  await execute(tx, dataRequest, null);
}

async function tracesOf(tx: Tx, account: string): Promise<Row> {
  const [row] = await tx<Row[]>`
    select (select count(*)::int from search.selection_requests
             where advertiser_account_id = ${account}) as requests,
           (select count(*)::int from search.profile_openings
             where account_id = ${account}) as opened,
           (select count(*)::int from search.profile_openings
             where creator_account_id = ${account}) as openings_of`;
  return row ?? {};
}

// the cases ---------------------------------------------------------------------------------------

describe("L3F-T5 the door, its queue and the rights in the catalogue (03 P7; fiche invariants 4, 6)", () => {
  it("L3F-T5 makes the door SECURITY DEFINER of the owner, executable by influx_advertiser alone, empty search_path, no dynamic statement, nothing of the outbox, matching, messaging nor a campaign table; queue 9 holds its provisional policy and the code is exported", async () => {
    const outcome = await scenario(async (tx) => {
      const [door] = await tx<Row[]>`
        select pg_catalog.pg_get_userbyid(p.proowner) as owner, p.prosecdef as definer,
               p.proconfig as config,
               array(select a.grantee::regrole::text
                       from pg_catalog.aclexplode(coalesce(p.proacl,
                              pg_catalog.acldefault('f', p.proowner))) a
                      where a.privilege_type = 'EXECUTE' and a.grantee <> p.proowner
                      order by 1) as callers,
               p.prosrc ~* '\\mexecute\\M|query_to_xml|dblink' as dynamic,
               p.prosrc ~* '\\m(leads|matching|messaging|campaigns)\\s*\\.|outbox|notification'
                 as forbidden
          from pg_catalog.pg_proc p
         where p.oid = ${DOOR_SIGNATURE}::regprocedure`;
      const [queue] = await tx<Row[]>`
        select q.handled_by_roles::text[] as roles, q.allows_bulk_action as bulk, q.has_lock as lock,
               p.target_claim_minutes as claim, p.target_decision_minutes as decision,
               p.is_provisional as provisional, p.is_active as active
          from backoffice.queues q
          join backoffice.sla_policies p on p.queue_code = q.code
         where q.code = 'team_selection'`;
      const [code] = await tx<Row[]>`
        select domain, subject_type, export_class from audit.event_types
         where code = 'search.selection_requested'`;
      return { door, queue, code };
    });
    expect(outcome.door).toEqual({
      owner: OWNER,
      definer: true,
      config: ['search_path=""'],
      callers: ["influx_advertiser"],
      dynamic: false,
      forbidden: false,
    });
    expect(outcome.queue).toEqual({
      roles: ["agent", "admin"],
      bulk: false,
      lock: true,
      claim: 240,
      decision: 480,
      provisional: true,
      active: true,
    });
    expect(outcome.code).toEqual({
      domain: "search",
      subject_type: "selection_request",
      export_class: "exported",
    });
  });

  it("L3F-T5 T2: the owner reads the deposit columns and inserts, never updates nor deletes; the erasure reads and deletes; no execution role holds a right; the brand reaches neither the table nor the bucket (42501)", async () => {
    const outcome = await scenario(async (tx) => {
      const columns = async (role: string) =>
        (
          await tx<{ name: string }[]>`
            select at.attname || ' ' ||
                   case when has_column_privilege(${role}, at.attrelid, at.attnum, 'SELECT')
                        then 'S' else '' end ||
                   case when has_column_privilege(${role}, at.attrelid, at.attnum, 'INSERT')
                        then 'I' else '' end ||
                   case when has_column_privilege(${role}, at.attrelid, at.attnum, 'UPDATE')
                        then 'U' else '' end as name
              from pg_catalog.pg_attribute at
             where at.attrelid = 'search.selection_requests'::regclass
               and at.attnum > 0 and not at.attisdropped
             order by 1`
        ).map((row) => row.name);
      const [deletes] = await tx<Row[]>`
        select has_table_privilege(${OWNER}, 'search.selection_requests', 'DELETE') as owner,
               has_table_privilege(${PRIVACY_OWNER}, 'search.selection_requests', 'DELETE')
                 as privacy,
               has_table_privilege(${PRIVACY_OWNER}, 'search.profile_openings', 'DELETE')
                 as openings,
               has_column_privilege(${OWNER}, 'identity.accounts', 'preferred_language', 'SELECT')
                 as language`;
      const rights = await tx<{ name: string }[]>`
        select r.rolname as name
          from pg_catalog.pg_roles r
         where r.rolname in ('influx_app', 'influx_advertiser', 'influx_creator', 'influx_agent',
                             'influx_admin', 'influx_auth', 'influx_worker', 'influx_ops',
                             'influx_privacy', 'anon', 'authenticated', 'service_role')
           and (has_table_privilege(r.oid, 'search.selection_requests',
                                    'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
                or has_any_column_privilege(r.oid, 'search.selection_requests',
                                            'SELECT, INSERT, UPDATE'))`;
      const brand = await newBrand(tx);
      const tried = await asBrand(tx, brand, async () => ({
        read: errorOf(
          await run(tx, "select count(*) from search.selection_requests"),
        ),
        insert: errorOf(
          await run(
            tx,
            "insert into search.selection_requests (advertiser_account_id, language, sla_due_at) " +
              "values ($1::uuid, 'fr', now())",
            [brand],
          ),
        ),
        limit: errorOf(
          await run(tx, "select search.selection_limit('requestsPerDay')"),
        ),
      }));
      return {
        owner: await columns(OWNER),
        privacy: await columns(PRIVACY_OWNER),
        deletes,
        rights: rights.map((row) => row.name),
        tried,
      };
    });
    expect(outcome.owner).toEqual([
      "advertiser_account_id SI",
      "campaign_id I",
      // 0330 (L3G-06): the claim and the closure of queue 9, never this owner's
      "claim_expires_at ",
      "claimed_at ",
      "claimed_by_account_id ",
      "close_note ",
      "close_reason_code ",
      "closed_at ",
      "closed_by_account_id ",
      "created_at S",
      "filters I",
      "id S",
      "language I",
      "message I",
      "sla_due_at SI",
      "state ",
    ]);
    expect(outcome.privacy).toEqual([
      "advertiser_account_id S",
      "campaign_id S",
      // 0330 (L3G-06): the claim and the closure of queue 9, neither exported nor read by the erasure
      "claim_expires_at ",
      "claimed_at ",
      "claimed_by_account_id ",
      "close_note ",
      "close_reason_code ",
      "closed_at ",
      "closed_by_account_id ",
      "created_at S",
      "filters S",
      "id S",
      "language S",
      "message S",
      "sla_due_at ",
      "state S",
    ]);
    expect(outcome.deletes).toEqual({
      owner: false,
      privacy: true,
      openings: true,
      language: true,
    });
    // 0330 (L3G-06, l3g/modele §5): agent and admin read queue 9; no member, no other role
    expect([...outcome.rights].sort()).toEqual([
      "influx_admin",
      "influx_agent",
    ]);
    expect(outcome.tried).toEqual({
      read: INSUFFICIENT_PRIVILEGE,
      insert: INSUFFICIENT_PRIVILEGE,
      limit: INSUFFICIENT_PRIVILEGE,
    });
  });
});

describe("L3F-T5 the gate (10 RG1, RG61; D38, CA59; T14)", () => {
  it("L3F-T5 refuses a creator, an agent and a brand whose account is not active (42501); a brand not published answers {state: brand_not_published}; nothing written", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await newCreator(tx);
      const suspended = await newBrand(tx, { account: "suspended" });
      const draft = await newBrand(tx, { status: "draft" });
      const unpublished = await newBrand(tx, { status: "suspended" });
      const parameters = [JSON.stringify(FILTERS), null, null];
      const asCreator = await actAsMember(
        tx,
        "influx_creator",
        { accountId: creator, role: "creator", aal: "aal1" },
        async () => errorOf(await run(tx, REQUEST, parameters)),
      );
      const asAgent = await actAsInternal(
        tx,
        "influx_agent",
        { accountId: agentA, role: "agent", aal: "aal2" },
        async () => errorOf(await run(tx, REQUEST, parameters)),
      );
      return {
        asCreator,
        asAgent,
        asSuspended: errorOf(await call(tx, suspended)),
        draft: (await request(tx, draft)).state,
        unpublished: (await request(tx, unpublished)).state,
        rows: [
          await countOf(tx, suspended),
          await countOf(tx, draft),
          await countOf(tx, unpublished),
        ],
      };
    });
    expect(outcome.asCreator).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.asAgent).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.asSuspended).toBe(INSUFFICIENT_PRIVILEGE);
    expect(outcome.draft).toBe("brand_not_published");
    expect(outcome.unpublished).toBe("brand_not_published");
    expect(outcome.rows).toEqual([0, 0, 0]);
  });

  it("L3F-T5 RG61, CA59: the switch closed and a search below the threshold are no obstacle: the request is accepted, the button permanent", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      await setting(tx, "is_open_to_advertisers", false);
      const closed = (await request(tx, brand)).state;
      await tx`delete from search.search_settings where key = 'is_open_to_advertisers'`;
      const missing = (await request(tx, brand)).state;
      await setting(tx, "k_anonymity_threshold", 50);
      const below = (
        await request(tx, brand, {
          F6: { country: "AQ" },
        })
      ).state;
      return { closed, missing, below, rows: await countOf(tx, brand) };
    });
    expect(outcome).toEqual({
      closed: "requested",
      missing: "requested",
      below: "requested",
      rows: 3,
    });
  });
});

describe("L3F-T5 CA39: every criterion, the campaign and the language (10 RG61; modele §1, §6)", () => {
  it("L3F-T5 CA39 writes one open line with the filters as entered, the admitted campaign, the brand's language and its message trimmed, its deadline frozen by queue 9; answers {state: requested, answerBy} and one register line by the brand", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx, { language: "en" });
      const campaign = await newCampaign(tx, brand, "paused");
      const answer = await request(
        tx,
        brand,
        FILTERS,
        campaign,
        "  Twelve creators, please.\nPets first.  ",
      );
      const [audit] = await tx<Row[]>`
        select e.actor_type::text as actor, e.actor_account_id::text as actor_id,
               e.subject_type, e.payload,
               e.subject_id = (select r.id from search.selection_requests r
                                where r.advertiser_account_id = ${brand}) as subject
          from audit.audit_events e
         where e.event_type = 'search.selection_requested'
           and e.actor_account_id = ${brand}`;
      return {
        answer,
        lines: await requestsOf(tx, brand),
        audit,
        brand,
        campaign,
      };
    });
    expect(outcome.answer).toEqual({
      state: "requested",
      answerBy: outcome.lines[0]?.due,
    });
    expect(outcome.lines).toEqual([
      {
        campaign_id: outcome.campaign,
        filters: FILTERS,
        language: "en",
        message: "Twelve creators, please.\nPets first.",
        state: "open",
        on_time: true,
        due: expect.stringMatching(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/),
      },
    ]);
    expect(outcome.audit).toEqual({
      actor: "member",
      actor_id: outcome.brand,
      subject_type: "selection_request",
      payload: { campaign_id: outcome.campaign },
      subject: true,
    });
  });

  it("L3F-T5 a campaign in draft, refused, of another brand or unknown answers the same bytes (P0002 campaign), nothing written; no campaign is accepted", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const other = await newBrand(tx);
      const campaigns = {
        draft: await newCampaign(tx, brand, "draft"),
        rejected: await newCampaign(tx, brand, "rejected"),
        other: await newCampaign(tx, other, "published"),
        unknown: randomUUID(),
      };
      const refused: Record<string, string> = {};
      for (const [label, campaign] of Object.entries(campaigns)) {
        refused[label] = bytesOf(await call(tx, brand, FILTERS, campaign));
      }
      const before = await countOf(tx, brand);
      return {
        refused,
        before,
        none: (await request(tx, brand, FILTERS, null)).state,
        lines: await requestsOf(tx, brand),
      };
    });
    const unknown = outcome.refused["unknown"];
    expect(JSON.parse(unknown ?? "{}")).toEqual({
      code: "P0002",
      detail: "campaign",
      message: "campaign_not_found",
    });
    expect(Object.values(outcome.refused)).toEqual(Array(4).fill(unknown));
    expect(outcome.before).toBe(0);
    expect(outcome.none).toBe("requested");
    expect(outcome.lines.map((line) => line.campaign_id)).toEqual([null]);
  });

  it("L3F-T5 refuses filters outside the closed entry of the search (22023 filters) and a message empty, blank or beyond 1 000 characters (22023 message); 1 000 characters and no message pass", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const filters: string[] = [];
      for (const value of [
        null,
        [],
        "pets",
        { F99: ["x"] },
        { F12: ["band"] },
        { F6: { country: "fr" } },
        { F3: [] },
      ]) {
        filters.push(errorOf(await call(tx, brand, value)));
      }
      const messages: string[] = [];
      for (const value of ["", "   ", "m".repeat(1001)]) {
        messages.push(errorOf(await call(tx, brand, FILTERS, null, value)));
      }
      const refused = await countOf(tx, brand);
      return {
        filters,
        messages,
        refused,
        thousand: (await request(tx, brand, {}, null, "m".repeat(1000))).state,
        none: (await request(tx, brand, {}, null, null)).state,
        // one transaction, one now(): the two lines in any order
        lines: (await requestsOf(tx, brand))
          .map((line) => [
            line.filters,
            (line.message as string | null)?.length ?? null,
          ])
          .sort((a, b) => Number(b[1] ?? -1) - Number(a[1] ?? -1)),
      };
    });
    expect(outcome.filters).toEqual(Array(7).fill("22023 filters"));
    expect(outcome.messages).toEqual(Array(3).fill("22023 message"));
    expect(outcome.refused).toBe(0);
    expect(outcome.thousand).toBe("requested");
    expect(outcome.none).toBe("requested");
    expect(outcome.lines).toEqual([
      [{}, 1000],
      [{}, null],
    ]);
  });
});

describe("L3F-T5 the bound and D45 (10 RG63; modele §5, §6; CA64)", () => {
  it("L3F-T5 bounds the requests of an account by requestsPerDay on 24 h sliding: {state: rate_limited, retryAfterSeconds}, nothing written; an older request no longer counts; another brand untouched; selection_limits missing answers 55000", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const other = await newBrand(tx);
      await setting(tx, "selection_limits", {
        listsPerAccount: 10,
        itemsPerList: 25,
        requestsPerDay: 2,
      });
      // one request 25 h ago (outside), one 20 h ago (inside: it leaves the window in 4 h)
      for (const ago of ["25 hours", "20 hours"]) {
        await tx`
          insert into search.selection_requests
            (advertiser_account_id, filters, language, sla_due_at, created_at)
          values (${brand}, '{}', 'fr', now(), now() - ${ago}::interval)`;
      }
      const states = [
        await request(tx, brand),
        await request(tx, brand),
        await request(tx, other),
      ];
      const counts = [await countOf(tx, brand), await countOf(tx, other)];
      await tx`delete from search.search_settings where key = 'selection_limits'`;
      return {
        states,
        counts,
        missing: errorOf(await call(tx, other)),
      };
    });
    expect(outcome.states[0]?.state).toBe("requested");
    expect(outcome.states[1]?.state).toBe("rate_limited");
    expect(Object.keys(outcome.states[1] ?? {}).sort()).toEqual([
      "retryAfterSeconds",
      "state",
    ]);
    const retry = outcome.states[1]?.retryAfterSeconds ?? 0;
    expect(retry).toBeGreaterThan(4 * 3600 - 120);
    expect(retry).toBeLessThanOrEqual(4 * 3600);
    expect(outcome.states[2]?.state).toBe("requested");
    expect(outcome.counts).toEqual([3, 1]);
    expect(outcome.missing).toBe(
      `${NOT_IN_PREREQUISITE_STATE} creator_search_settings`,
    );
  });

  it("L3F-T5 D45, CA64: a request writes nothing to leads.outbox_events, matching, messaging nor a creator's account; one register line", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const creator = await newCreator(tx);
      await giveOpening(tx, brand, creator);
      // every table of matching and messaging (the introductions, the conversations to come)
      const [names] = await tx<{ tables: string[] }[]>`
        select coalesce(array_agg(c.oid::regclass::text order by c.oid), '{}') as tables
          from pg_catalog.pg_class c
          join pg_catalog.pg_namespace n on n.oid = c.relnamespace
         where n.nspname in ('matching', 'messaging') and c.relkind in ('r', 'p')`;
      const counts = async () => {
        const [row] = await tx<Row[]>`
          select (select count(*)::int from leads.outbox_events) as outbox,
                 (select count(*)::int from audit.audit_events) as audit,
                 (select md5(a::text) from identity.accounts a where a.id = ${creator}) as account,
                 (select md5(p::text) from profiles.creator_public_profiles p
                   where p.account_id = ${creator}) as storefront`;
        const tables: Record<string, number> = {};
        for (const table of names?.tables ?? []) {
          const [counted] = await tx.unsafe<{ n: number }[]>(
            `select count(*)::int as n from ${table}`,
          );
          tables[table] = counted?.n ?? -1;
        }
        return { ...(row ?? {}), tables } as Row & {
          tables: Record<string, number>;
        };
      };
      const before = await counts();
      const state = (
        await request(tx, brand, FILTERS, null, "Creators like this one")
      ).state;
      return { state, before, after: await counts(), names: names?.tables };
    });
    expect(outcome.state).toBe("requested");
    expect(outcome.names).toContain("matching.party_blocks");
    expect(outcome.after).toEqual({
      ...outcome.before,
      audit: Number(outcome.before.audit) + 1,
    });
  });
});

describe("L3F-T5 the export and the erasure (04 §9; modele §6, -7)", () => {
  it("L3F-T5 exports the brand's requests (instant, filters, title of the campaign, language, message, state), never their id nor their deadline; another brand's never", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx, { language: "en" });
      const stranger = await newBrand(tx);
      const campaign = await newCampaign(
        tx,
        brand,
        "published",
        "t5 export campaign",
      );
      await request(tx, brand, FILTERS, campaign, "t5 brand message");
      await request(tx, stranger, {}, null, "t5 stranger message");
      const [ids] = await tx<{ id: string; due: string }[]>`
        select id::text as id, sla_due_at::text as due from search.selection_requests
         where advertiser_account_id = ${brand}`;
      const content = await exportOf(tx, brand);
      return { content, ids };
    });
    const file = JSON.parse(outcome.content) as {
      data: { advertiser_profile?: { selection_requests: Row[] } };
    };
    expect(file.data.advertiser_profile?.selection_requests).toEqual([
      {
        requested_at: expect.stringMatching(/Z$/),
        filters: FILTERS,
        campaign_title: "t5 export campaign",
        language: "en",
        message: "t5 brand message",
        state: "open",
      },
    ]);
    expect(outcome.content).not.toContain(outcome.ids?.id);
    expect(outcome.content).not.toContain("t5 stranger message");
    expect(outcome.content).toContain("search.selection_requested");
  });

  it("L3F-T5 erases a brand: its requests and its openings deleted; a creator: the openings of it deleted; another brand's requests and openings kept; nothing of an active account deleted by the owner of the erasure", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const stranger = await newBrand(tx);
      const creator = await newCreator(tx);
      const kept = await newCreator(tx);
      await request(tx, brand);
      await request(tx, stranger);
      await giveOpening(tx, brand, kept);
      await giveOpening(tx, stranger, creator);
      await giveOpening(tx, stranger, kept);
      // the owner of the erasure deletes nothing of an active account, never updates
      await tx.unsafe(`set local role ${PRIVACY_OWNER}`);
      const early = {
        requests: rowsOf(
          await run(
            tx,
            "delete from search.selection_requests where advertiser_account_id = $1 returning 1",
            [brand],
          ),
        ).length,
        openings: rowsOf(
          await run(
            tx,
            "delete from search.profile_openings where account_id = $1 returning 1",
            [brand],
          ),
        ).length,
        update: errorOf(
          await run(
            tx,
            "update search.selection_requests set message = 'x' where advertiser_account_id = $1",
            [brand],
          ),
        ),
      };
      await tx.unsafe("reset role");
      await eraseOf(tx, brand);
      await eraseOf(tx, creator);
      return {
        early,
        brand: await tracesOf(tx, brand),
        creator: await tracesOf(tx, creator),
        stranger: await tracesOf(tx, stranger),
        kept: await tracesOf(tx, kept),
      };
    });
    expect(outcome.early).toEqual({
      requests: 0,
      openings: 0,
      update: INSUFFICIENT_PRIVILEGE,
    });
    expect(outcome.brand).toEqual({ requests: 0, opened: 0, openings_of: 0 });
    expect(outcome.creator).toEqual({
      requests: 0,
      opened: 0,
      openings_of: 0,
    });
    expect(outcome.stranger).toEqual({
      requests: 1,
      opened: 1,
      openings_of: 0,
    });
    expect(outcome.kept).toEqual({ requests: 0, opened: 0, openings_of: 1 });
  });

  it("L3F-T5 lets the guard of the journal pass the erasure of the openings (EC-L3F-03-7) and nothing else: a DELETE by another influx_% role holding the right is refused 55000", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newBrand(tx);
      const creator = await newCreator(tx);
      await giveOpening(tx, brand, creator);
      await tx`update identity.accounts set status = 'deleted', deleted_at = now()
                where id = ${creator}`;
      // a right written by mistake to the owner of the door: the guard still refuses (second line)
      await tx.unsafe(
        `grant delete on search.profile_openings to ${OWNER}; ` +
          `create policy t5_owner_delete on search.profile_openings for delete to ${OWNER} using (true)`,
      );
      await tx.unsafe(`set local role ${OWNER}`);
      // its read policy shows the caller's own openings
      await tx`select pg_catalog.set_config('influx.account', ${brand}, true)`;
      const byOwner = errorOf(
        await run(
          tx,
          "delete from search.profile_openings where creator_account_id = $1",
          [creator],
        ),
      );
      await tx.unsafe("reset role");
      await tx.unsafe(`set local role ${PRIVACY_OWNER}`);
      const byErasure = rowsOf(
        await run(
          tx,
          "delete from search.profile_openings where creator_account_id = $1 returning 1",
          [creator],
        ),
      ).length;
      await tx.unsafe("reset role");
      return { byOwner, byErasure };
    });
    expect(outcome.byOwner).toBe(
      `${NOT_IN_PREREQUISITE_STATE} search_journal_immutable`,
    );
    expect(outcome.byErasure).toBe(1);
  });
});

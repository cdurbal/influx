// L2E commit 10 — the verification in the export and the erasure, 0226 (jalons/l2e/10.md;
// l2e/modele.md §3; fiche invariants 4, 16; 04 §9.1; 08 §8 « Le compte est supprimé », Q2; 15 RG81):
// L2E-D23 the export (creator requests and network badges in creator_profile, brand requests, badge
// and internal block in advertiser_profile; never an evidence, a code, an observed handle, an agent,
// an internal comment nor a declared value at the decision), L2E-D24 the erasure (open requests
// withdrawn, codes deleted, badges revoked and emptied, evidence to purging, internal block deleted,
// history agent_observed deleted, no marker left in any table), and the bounds of
// influx_privacy_definer on the verification. The badges are granted by agent A through the
// functions of 0224 and 0225, as apps/api calls them; the approval of a request runs as in
// t8-privacy-execution. Each case runs in ONE rolled-back transaction of the local superuser.
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import { OUR_SCHEMAS } from "@influx/test-kit/rights";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { DATA_EXPORT_CATEGORIES } from "../src/domains/privacy/notice.ts";
import {
  actAs,
  actAsInternal,
  actAsMember,
  bindRequestSession,
  letterName,
  localSuperuser,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;
type Parameter = postgres.ParameterOrJSON<never> | null;

const INSUFFICIENT_PRIVILEGE = "42501";

const adminA = accountIdOf("admin", "a");
const adminB = accountIdOf("admin", "b");
const agentA = accountIdOf("agent", "a");

const NOTICE = {
  language: "en",
  title: "Your data held by INFLUX",
  categories: Object.fromEntries(
    DATA_EXPORT_CATEGORIES.map((key) => [key, `Purpose of ${key}`]),
  ),
};

beforeAll(async () => {
  await testDataSet();
});

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

type Attempt =
  | { outcome: "rows"; rows: Row[]; count: number }
  | { outcome: "error"; code: string; message: string };

async function attempt(
  tx: Tx,
  statement: string,
  parameters: readonly Parameter[] = [],
): Promise<Attempt> {
  try {
    const result = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters as postgres.ParameterOrJSON<never>[],
      ),
    );
    return {
      outcome: "rows",
      rows: [...result] as Row[],
      count: Math.max(result.count, result.length),
    };
  } catch (error) {
    const failure = error as { code?: string; message?: string };
    return {
      outcome: "error",
      code: failure.code ?? "unknown",
      message: failure.message ?? "",
    };
  }
}

function rowsOf(result: Attempt): Row[] {
  if (result.outcome === "error") {
    throw new Error(`${result.code} ${result.message}`);
  }
  return result.rows;
}

function asAgent<T>(tx: Tx, fn: () => Promise<T>): Promise<T> {
  return actAsInternal(
    tx,
    "influx_agent",
    { accountId: agentA, role: "agent", aal: "aal2" },
    fn,
  );
}

function asAdmin<T>(tx: Tx, account: string, fn: () => Promise<T>): Promise<T> {
  return actAsInternal(
    tx,
    "influx_admin",
    { accountId: account, role: "admin", aal: "aal2" },
    fn,
  );
}

/** The UTC date `days` days from today, as the agent types it. */
function day(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/** A fresh code of the shape of RG22 (8 signs of the alphabet without ambiguity). */
function newCode(): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const bytes = randomUUID().replace(/-/g, "");
  let code = "INFLUX-";
  for (let i = 0; i < 8; i += 1) {
    code += alphabet[Number.parseInt(bytes.slice(i * 2, i * 2 + 2), 16) % 31];
  }
  return code;
}

// ---------------------------------------------------------------------------------------------
// The fixtures: a verified creator and a verified brand, through the functions
// ---------------------------------------------------------------------------------------------

type Creator = {
  id: string;
  tag: string;
  lineA: string;
  lineB: string;
  codes: string[];
  requests: string[];
};

/** An active creator with two network lines (instagram, tiktok) entered in his own session. */
async function newCreator(tx: Tx): Promise<Creator> {
  const id = randomUUID();
  const tag = letterName(id.slice(0, 8));
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language, display_name,
       is_adult_attested, adult_attested_at, declared_status)
    values (${id}, ${randomUUID()}, ${`l2e-privacy-${id}@example.test`}, now(), 'FR', 'en',
            'L2E Privacy Creator', true, now(), 'individual')`;
  await tx`insert into identity.account_roles (account_id, role) values (${id}, 'creator')`;
  await tx`
    insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
    values (${id}, profiles.new_creator_alias(), 'FR')`;
  // L2ES-2 (0228): the agent reads `${tag}_seen` on the instagram line, which declares it in capitals
  // (the same handle once normalised; a raw string of its own, so the markers below stay distinct)
  const lines = await actAsMember(
    tx,
    "influx_creator",
    { accountId: id, role: "creator", aal: "aal1" },
    async () =>
      tx<{ id: string; network_code: string }[]>`
        insert into profiles.creator_social_accounts
          (account_id, network_code, is_primary, handle, followers_count, posts_last_30_days,
           avg_comments_per_post)
        values (${id}, 'instagram', true, ${`${tag.toUpperCase()}_SEEN`}, 120000, 14, 35),
               (${id}, 'tiktok', false, ${`${tag}_tok`}, 9000, 20, 12)
        returning id::text, network_code`,
  );
  const lineOf = (network: string): string => {
    const line = lines.find((row) => row.network_code === network);
    if (line === undefined) throw new Error(`no ${network} line`);
    return line.id;
  };
  return {
    id,
    tag,
    lineA: lineOf("instagram"),
    lineB: lineOf("tiktok"),
    codes: [],
    requests: [],
  };
}

/** A request of `account` in `status` (as the doors leave it), with its live code when given. */
async function request(
  tx: Tx,
  account: string,
  target: { line: string; network: string } | null,
  level: "account_verified" | "audience_verified" | "brand_verified",
  status: "draft" | "pending",
  code?: string,
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status)
    values (${account}, ${target?.line ?? null}, ${target?.network ?? null},
            ${level}::verification.badge_level, ${status}::verification.request_status)
    returning id::text`;
  if (row === undefined) throw new Error("no request");
  if (code !== undefined) {
    await tx`
      insert into verification.ownership_codes (request_id, account_id, kind, code, expires_at)
      values (${row.id}, ${account}, ${target === null ? "domain" : "network"}, ${code},
              now() + interval '7 days')`;
  }
  return row.id;
}

async function evidence(
  tx: Tx,
  account: string,
  requestId: string,
  state: "pending" | "active",
): Promise<void> {
  if (state === "active") {
    await tx`
      insert into verification.evidence_files
        (request_id, account_id, state, received_bytes, byte_size, width, height, checksum,
         activated_at, retention_due_at)
      values (${requestId}, ${account}, 'active', 500000, 400000, 1290, 2796,
              sha256(${randomUUID()}::bytea), now(), now() + interval '45 days')`;
  } else {
    await tx`
      insert into verification.evidence_files
        (request_id, account_id, received_bytes, retention_due_at)
      values (${requestId}, ${account}, 500000, now() + interval '45 days')`;
  }
}

/** Agent A opens `requestId` and returns its review token. */
async function claim(tx: Tx, requestId: string): Promise<string> {
  const [opened] = rowsOf(
    await asAgent(tx, () =>
      attempt(tx, "select * from verification.open_request($1::uuid)", [
        requestId,
      ]),
    ),
  );
  if (opened?.review_token == null)
    throw new Error(`not claimed: ${String(opened?.outcome)}`);
  return String(opened.review_token);
}

/**
 * « Compte vérifié » and « Audience vérifiée » granted on instagram, a refreshed audience request
 * refused (other, with a message); still open: a pending ownership request on tiktok claimed by
 * agent A, a draft audience request on tiktok with an evidence being uploaded.
 */
async function verifiedCreator(tx: Tx): Promise<Creator> {
  const creator = await newCreator(tx);
  const { id, tag } = creator;
  const insta = { line: creator.lineA, network: "instagram" };
  const tok = { line: creator.lineB, network: "tiktok" };

  const ownershipCode = newCode();
  const ownership = await request(
    tx,
    id,
    insta,
    "account_verified",
    "pending",
    ownershipCode,
  );
  const ownershipToken = await claim(tx, ownership);
  rowsOf(
    await asAgent(tx, () =>
      attempt(
        tx,
        "select * from verification.grant_account_verified($1::uuid, $2, $3, $4, $5, $6)",
        [
          ownership,
          ownershipToken,
          ownershipCode,
          `${tag}_seen`,
          `${tag}ref`,
          `${tag} ownership note`,
        ],
      ),
    ),
  );

  const audience = await request(tx, id, insta, "audience_verified", "pending");
  await evidence(tx, id, audience, "active");
  const audienceToken = await claim(tx, audience);
  const [granted] = rowsOf(
    await asAgent(tx, () =>
      attempt(
        tx,
        "select * from verification.grant_audience_verified($1::uuid, $2, $3::bigint, $4::integer, " +
          "$5::bigint, $6::integer, $7::date, $8::date, $9, $10)",
        [
          audience,
          audienceToken,
          47300,
          3,
          250,
          350,
          day(-20),
          day(-1),
          `${tag}_seen`,
          `${tag} audience note`,
        ],
      ),
    ),
  );
  if (granted?.badge_id == null)
    throw new Error(`not granted: ${String(granted?.outcome)}`);

  const refresh = await request(tx, id, insta, "audience_verified", "pending");
  await evidence(tx, id, refresh, "active");
  const refreshToken = await claim(tx, refresh);
  rowsOf(
    await asAgent(tx, () =>
      attempt(
        tx,
        "select * from verification.reject_request($1::uuid, $2, $3, $4, $5)",
        [
          refresh,
          refreshToken,
          "other",
          `Please send the capture again, ${tag} cannot be read.`,
          `${tag} refusal note`,
        ],
      ),
    ),
  );

  const openCode = newCode();
  const open = await request(
    tx,
    id,
    tok,
    "account_verified",
    "pending",
    openCode,
  );
  await claim(tx, open);
  const draft = await request(tx, id, tok, "audience_verified", "draft");
  await evidence(tx, id, draft, "pending");

  return {
    ...creator,
    codes: [ownershipCode, openCode],
    requests: [ownership, audience, refresh, open, draft],
  };
}

type Brand = { id: string; tag: string; codes: string[]; requests: string[] };

/** An advertiser whose domain and registration agent A observed; a refreshed request still draft. */
async function verifiedBrand(tx: Tx): Promise<Brand> {
  const id = randomUUID();
  const tag = letterName(id.slice(0, 8));
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
       declared_status)
    values (${id}, ${randomUUID()}, ${`l2e-privacy-${id}@example.test`}, now(), 'FR', 'en',
            'business')`;
  await tx`insert into identity.account_roles (account_id, role) values (${id}, 'advertiser')`;
  await tx`insert into profiles.advertiser_profiles (account_id, legal_name, website_domain)
           values (${id}, ${`${tag} Trade`}, ${`${tag}.example`})`;
  await tx`
    insert into profiles.advertiser_internal_details
      (account_id, legal_name, registration_country_code, registration_number)
    values (${id}, ${`${tag} Holding SAS`}, 'FR', ${`RCS ${tag}`})`;
  const [source] = await tx<{ id: string }[]>`
    select id::text from verification.registry_sources where country_code = 'FR' and is_active`;
  const code = newCode();
  const granted = await request(
    tx,
    id,
    null,
    "brand_verified",
    "pending",
    code,
  );
  const token = await claim(tx, granted);
  rowsOf(
    await asAgent(tx, () =>
      attempt(
        tx,
        "select * from verification.grant_brand_verified($1::uuid, $2, $3, $4, $5, $6::uuid, $7)",
        [
          granted,
          token,
          code,
          `www.${tag}.example`,
          "dns_txt",
          String(source?.id),
          `${tag} brand note`,
        ],
      ),
    ),
  );
  const draftCode = newCode();
  const draft = await request(
    tx,
    id,
    null,
    "brand_verified",
    "draft",
    draftCode,
  );
  return { id, tag, codes: [code, draftCode], requests: [granted, draft] };
}

// ---------------------------------------------------------------------------------------------
// The data subject request (as t8-privacy-execution)
// ---------------------------------------------------------------------------------------------

async function adminSession(tx: Tx, account: string): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (sha256(gen_random_uuid()::text::bytea), ${account}, 'backoffice', 'totp', 'firefox.linux')
    returning id::text`;
  if (row === undefined) throw new Error("no session");
  return row.id;
}

async function execute(
  tx: Tx,
  account: string,
  type: "access" | "erasure",
): Promise<string> {
  const [deposited] = await tx<{ id: string }[]>`
    insert into backoffice.data_subject_requests (request_type, requester_account_id)
    values (${type}::backoffice.data_request_type, ${account})
    returning id::text`;
  const requestId = String(deposited?.id);
  const payload = JSON.stringify({ request_id: requestId, request_type: type });
  const requested = await asAdmin(tx, adminB, () =>
    attempt(
      tx,
      "select backoffice.request_dual_control('privacy.approve_data_request', $1::text::jsonb, $2)::text as id",
      [payload, "request_instructed"],
    ),
  );
  const dualControl = String(rowsOf(requested)[0]?.id);
  const session = await adminSession(tx, adminA);
  await asAdmin(tx, adminA, async () => {
    await bindRequestSession(tx, session);
    rowsOf(
      await attempt(
        tx,
        "select backoffice.confirm_dual_control($1::uuid, $2::uuid, $3) as mode",
        [session, dualControl, null],
      ),
    );
    await bindRequestSession(tx, session);
    rowsOf(
      await attempt(
        tx,
        "select backoffice.approve_data_request_execution($1::uuid, $2::uuid, $3::uuid, " +
          "$4::backoffice.data_request_type, $5)",
        [session, dualControl, requestId, type, "request_instructed"],
      ),
    );
  });
  rowsOf(
    await actAs(tx, "privacy", () =>
      attempt(
        tx,
        "select request_type from privacy.execute_request($1::uuid, $2::text::jsonb)",
        [requestId, type === "access" ? JSON.stringify(NOTICE) : null],
      ),
    ),
  );
  return requestId;
}

type ExportFile = { categories: string[]; data: Record<string, unknown> };

async function exportOf(
  tx: Tx,
  account: string,
): Promise<{ content: string; file: ExportFile }> {
  const requestId = await execute(tx, account, "access");
  const [stored] = await tx<{ content: string }[]>`
    select content from privacy.data_exports where request_id = ${requestId}`;
  const content = String(stored?.content);
  return { content, file: JSON.parse(content) as ExportFile };
}

/** For each marker, the tables of our schemas holding a row whose text carries it, in any column. */
async function tablesCarrying(
  tx: Tx,
  markers: readonly string[],
): Promise<Record<string, string[]>> {
  const tables = await tx<{ name: string }[]>`
    select format('%I.%I', n.nspname, c.relname) as name
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where c.relkind in ('r', 'p')
       and n.nspname = any (${OUR_SCHEMAS as unknown as string[]})
     order by 1`;
  const found: Record<string, string[]> = Object.fromEntries(
    markers.map((marker) => [marker, [] as string[]]),
  );
  for (const { name } of tables) {
    const [row] = await tx.unsafe<{ hits: string[] }[]>(
      `with d as materialized (select lower(to_jsonb(t)::text) as doc from ${name} t)
       select coalesce(array_agg(m.marker), '{}') as hits
         from unnest($1::text[]) as m (marker)
        where exists (select 1 from d where strpos(d.doc, lower(m.marker)) > 0)`,
      [markers as string[]],
    );
    for (const marker of row?.hits ?? []) found[marker]?.push(name);
  }
  return found;
}

/** `rows` sorted by the text of `keys`, for rows written in one transaction (one created_at). */
function sortedBy(rows: readonly Row[], keys: readonly string[]): Row[] {
  const key = (row: Row): string => keys.map((k) => String(row[k])).join("|");
  return [...rows].sort((a, b) => key(a).localeCompare(key(b)));
}

// ---------------------------------------------------------------------------------------------
// L2E-D23: the export
// ---------------------------------------------------------------------------------------------

const ISO = expect.stringMatching(/Z$/);

describe("L2E-D23: the verification in the export (art. 15, fiche invariant 16)", () => {
  it("exports the creator requests and network badges: level, network, dates, source, period, observed figures, refusal reason and message", async () => {
    const { creator, file } = await scenario(async (tx) => {
      const found = await verifiedCreator(tx);
      return { creator: found, ...(await exportOf(tx, found.id)) };
    });
    expect(file.categories).toEqual([...DATA_EXPORT_CATEGORIES]);
    const verification = (file.data.creator_profile as Row).verification as {
      requests: Row[];
      badges: Row[];
    };
    // one transaction, one created_at: compared in a fixed order
    expect(
      sortedBy(verification.requests, ["network", "level", "status"]),
    ).toEqual([
      expect.objectContaining({
        network: "instagram",
        level: "account_verified",
        status: "approved",
      }),
      expect.objectContaining({
        network: "instagram",
        level: "audience_verified",
        status: "approved",
      }),
      {
        network: "instagram",
        level: "audience_verified",
        status: "rejected",
        created_at: ISO,
        submitted_at: ISO,
        decided_at: ISO,
        rejection_reason: "other",
        member_message: `Please send the capture again, ${creator.tag} cannot be read.`,
        cancelled_at: null,
        closed_at: ISO,
      },
      expect.objectContaining({
        network: "tiktok",
        level: "account_verified",
        status: "pending",
      }),
      expect.objectContaining({
        network: "tiktok",
        level: "audience_verified",
        status: "draft",
      }),
    ]);
    expect(sortedBy(verification.badges, ["level"])).toEqual([
      {
        network: "instagram",
        level: "account_verified",
        state: "active",
        granted_at: ISO,
        source: "public_profile",
        period_start: null,
        period_end: null,
        observed_followers: null,
        observed_posts_last_30_days: null,
        observed_avg_comments: null,
        observed_engagement_bp: null,
        expires_at: null,
        revoked_at: null,
        revocation_reason: null,
      },
      {
        network: "instagram",
        level: "audience_verified",
        state: "active",
        granted_at: ISO,
        source: "native_dashboard",
        period_start: day(-20),
        period_end: day(-1),
        observed_followers: 47300,
        observed_posts_last_30_days: 3,
        observed_avg_comments: 250,
        observed_engagement_bp: 350,
        expires_at: ISO,
        revoked_at: null,
        revocation_reason: null,
      },
    ]);
    // the history row agent_observed of the decision (0225), its author shown as INFLUX
    expect((file.data.creator_profile as Row).metrics_history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          followers_count: 47300,
          figures_source: "agent_observed",
          recorded_by: "INFLUX",
        }),
      ]),
    );
    expect(file.data.advertiser_profile).toBeNull();
  });

  it("never exports an evidence, a code, the observed handle or reference, an agent, an internal comment nor a declared value at the decision", async () => {
    const { creator, content, evidenceIds } = await scenario(async (tx) => {
      const found = await verifiedCreator(tx);
      const ids = await tx<{ id: string }[]>`
        select id::text from verification.evidence_files where account_id = ${found.id}`;
      return {
        creator: found,
        evidenceIds: ids.map((row) => row.id),
        ...(await exportOf(tx, found.id)),
      };
    });
    const { tag } = creator;
    for (const forbidden of [
      ...creator.codes,
      ...evidenceIds,
      ...creator.requests,
      `${tag}_seen`,
      `${tag}ref`,
      "note",
      agentA,
      "evidence_",
      "checksum",
      "object_key",
      "_at_decision",
      "internal_comment",
      "claimed",
    ]) {
      expect(content.includes(forbidden), forbidden).toBe(false);
    }
  });

  it("exports the internal block, the brand requests and the brand badge in advertiser_profile, never the code, the domain observed nor the internal comment", async () => {
    const { brand, file, content } = await scenario(async (tx) => {
      const found = await verifiedBrand(tx);
      return { brand: found, ...(await exportOf(tx, found.id)) };
    });
    const exported = (file.data.advertiser_profile as Row).verification as Row;
    const verification = {
      ...exported,
      requests: sortedBy(exported.requests as Row[], ["status"]),
    };
    expect(verification).toEqual({
      internal_details: {
        legal_name: `${brand.tag} Holding SAS`,
        registration_country_code: "FR",
        registration_number: `RCS ${brand.tag}`,
        created_at: ISO,
        updated_at: ISO,
      },
      requests: [
        {
          level: "brand_verified",
          status: "approved",
          created_at: ISO,
          submitted_at: ISO,
          decided_at: ISO,
          rejection_reason: null,
          member_message: null,
          cancelled_at: null,
          closed_at: ISO,
        },
        expect.objectContaining({
          level: "brand_verified",
          status: "draft",
          submitted_at: null,
        }),
      ],
      badges: [
        {
          level: "brand_verified",
          state: "active",
          granted_at: ISO,
          source: "domain_and_registry",
          expires_at: ISO,
          revoked_at: null,
          revocation_reason: null,
        },
      ],
    });
    expect(file.data.creator_profile).toBeNull();
    for (const forbidden of [
      ...brand.codes,
      `www.${brand.tag}`,
      "note",
      agentA,
    ]) {
      expect(content.includes(forbidden), forbidden).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// L2E-D24: the erasure
// ---------------------------------------------------------------------------------------------

async function verificationStateOf(tx: Tx, account: string): Promise<Row> {
  const requests = await tx<Row[]>`
    select level::text, status::text, network_code, cancelled_at is not null as cancelled,
           closed_at is not null as closed, decided_by_account_id::text as decided_by,
           rejection_reason_code, member_message, internal_comment,
           claimed_by_account_id, claimed_at, claim_expires_at
      from verification.verification_requests where account_id = ${account}
     order by level::text, status::text, network_code`;
  const badges = await tx<Row[]>`
    select level::text, state::text, revocation_reason_code, revoked_at is not null as revoked,
           observed_handle_at_decision, observed_platform_account_ref,
           observed_followers::text, granted_by_account_id::text as granted_by
      from verification.badges where account_id = ${account} order by level::text, state::text`;
  const [counts] = await tx<Row[]>`
    select (select count(*)::int from verification.ownership_codes
             where account_id = ${account}) as codes,
           (select count(*)::int from verification.evidence_files
             where account_id = ${account} and state in ('pending', 'active')) as live_evidence,
           (select count(*)::int from verification.evidence_files
             where account_id = ${account} and state = 'purging') as purging_evidence,
           (select count(*)::int from profiles.advertiser_internal_details
             where account_id = ${account}) as internal_details,
           (select count(*)::int from profiles.creator_network_metrics_history
             where account_id = ${account} and figures_source = 'agent_observed') as observed_history,
           (select count(*)::int from profiles.creator_public_networks
             where account_id = ${account}) as public_networks`;
  return { requests, badges, counts };
}

describe("L2E-D24: the verification in the erasure (04 §9.1, 08 §8, Q2)", () => {
  it("withdraws the open creator requests, empties every request, deletes the codes, revokes and empties the badges, purges the evidence and the observed history", async () => {
    const { before, after } = await scenario(async (tx) => {
      const creator = await verifiedCreator(tx);
      const first = await verificationStateOf(tx, creator.id);
      await execute(tx, creator.id, "erasure");
      return {
        before: first,
        after: await verificationStateOf(tx, creator.id),
      };
    });
    // the témoin: everything was there before
    expect(before.counts).toMatchObject({
      codes: 2,
      live_evidence: 3,
      observed_history: 1,
      public_networks: 2,
    });
    expect(before.badges).toHaveLength(2);
    expect(after.counts).toEqual({
      codes: 0,
      live_evidence: 0,
      purging_evidence: 3,
      internal_details: 0,
      observed_history: 0,
      public_networks: 0,
    });
    const emptied = {
      member_message: null,
      internal_comment: null,
      claimed_by_account_id: null,
      claimed_at: null,
      claim_expires_at: null,
    };
    expect(after.requests).toEqual([
      {
        level: "account_verified",
        status: "approved",
        network_code: "instagram",
        cancelled: false,
        closed: true,
        decided_by: agentA,
        rejection_reason_code: null,
        ...emptied,
      },
      {
        level: "account_verified",
        status: "cancelled",
        network_code: "tiktok",
        cancelled: true,
        closed: true,
        decided_by: null,
        rejection_reason_code: null,
        ...emptied,
      },
      {
        level: "audience_verified",
        status: "approved",
        network_code: "instagram",
        cancelled: false,
        closed: true,
        decided_by: agentA,
        rejection_reason_code: null,
        ...emptied,
      },
      {
        level: "audience_verified",
        status: "cancelled",
        network_code: "tiktok",
        cancelled: true,
        closed: true,
        decided_by: null,
        rejection_reason_code: null,
        ...emptied,
      },
      {
        level: "audience_verified",
        status: "rejected",
        network_code: "instagram",
        cancelled: false,
        closed: true,
        decided_by: agentA,
        rejection_reason_code: "other",
        ...emptied,
      },
    ]);
    // the decisions kept, pseudonymous: the badges revoked account_closed, their finding kept,
    // nothing that names the creator
    expect(after.badges).toEqual([
      {
        level: "account_verified",
        state: "revoked",
        revocation_reason_code: "account_closed",
        revoked: true,
        observed_handle_at_decision: "[deleted]",
        observed_platform_account_ref: null,
        observed_followers: null,
        granted_by: agentA,
      },
      {
        level: "audience_verified",
        state: "revoked",
        revocation_reason_code: "account_closed",
        revoked: true,
        observed_handle_at_decision: "[deleted]",
        observed_platform_account_ref: null,
        observed_followers: "47300",
        granted_by: agentA,
      },
    ]);
  });

  it("deletes the internal block and the codes of a brand, withdraws its draft and revokes its badge", async () => {
    const { after } = await scenario(async (tx) => {
      const brand = await verifiedBrand(tx);
      await execute(tx, brand.id, "erasure");
      return { after: await verificationStateOf(tx, brand.id) };
    });
    expect(after.counts).toMatchObject({ codes: 0, internal_details: 0 });
    expect(after.requests).toEqual([
      expect.objectContaining({
        status: "approved",
        cancelled: false,
        decided_by: agentA,
      }),
      expect.objectContaining({
        status: "cancelled",
        cancelled: true,
        closed: true,
      }),
    ]);
    expect(after.badges).toEqual([
      {
        level: "brand_verified",
        state: "revoked",
        revocation_reason_code: "account_closed",
        revoked: true,
        observed_handle_at_decision: null,
        observed_platform_account_ref: null,
        observed_followers: null,
        granted_by: agentA,
      },
    ]);
  });

  it("leaves no handle, code, legal name nor registration number in any table of the base, where it found them before", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await verifiedCreator(tx);
      const brand = await verifiedBrand(tx);
      const markers = [
        `${creator.tag}_seen`,
        `${creator.tag}ref`,
        creator.tag,
        ...creator.codes,
        `${brand.tag} Holding`,
        `RCS ${brand.tag}`,
        brand.tag,
        ...brand.codes,
      ];
      const before = await tablesCarrying(tx, markers);
      await execute(tx, creator.id, "erasure");
      await execute(tx, brand.id, "erasure");
      const after = await tablesCarrying(tx, markers);
      return { creator, brand, before, after };
    });
    const { creator, brand, before, after } = outcome;
    expect(before[`${creator.tag}_seen`]).toEqual(
      expect.arrayContaining([
        "verification.badges",
        "verification.ownership_codes",
      ]),
    );
    expect(before[creator.codes[0] ?? ""]).toEqual([
      "verification.ownership_codes",
    ]);
    expect(before[`${brand.tag} Holding`]).toEqual([
      "profiles.advertiser_internal_details",
    ]);
    expect(before[`RCS ${brand.tag}`]).toEqual([
      "profiles.advertiser_internal_details",
    ]);
    expect(before[creator.tag]).toEqual(
      expect.arrayContaining(["verification.verification_requests"]),
    );
    for (const [marker, tables] of Object.entries(after)) {
      expect(tables, marker).toEqual([]);
    }
  });

  it("writes in the register no verification line, and touches no other account", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await verifiedCreator(tx);
      const stranger = await verifiedCreator(tx);
      const strangerBefore = await verificationStateOf(tx, stranger.id);
      const [mark] = await tx<{ seq: string }[]>`
        select coalesce(max(seq), 0)::text as seq from audit.audit_events`;
      await execute(tx, creator.id, "erasure");
      const lines = await tx<{ event_type: string }[]>`
        select event_type from audit.audit_events
         where seq > ${String(mark?.seq)}::bigint and subject_type = 'verification_request'`;
      return {
        lines,
        strangerBefore,
        strangerAfter: await verificationStateOf(tx, stranger.id),
      };
    });
    expect(outcome.lines).toEqual([]);
    expect(outcome.strangerAfter).toEqual(outcome.strangerBefore);
  });
});

// ---------------------------------------------------------------------------------------------
// The bounds of influx_privacy_definer (03 P7 clause « L2E »)
// ---------------------------------------------------------------------------------------------

describe("influx_privacy_definer on the verification (0226 §1)", () => {
  it("empties, revokes and deletes nothing of an account that is not erased", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await verifiedCreator(tx);
      const brand = await verifiedBrand(tx);
      const before = await verificationStateOf(tx, creator.id);
      await tx.unsafe("set local role influx_privacy_definer");
      const results = [
        await attempt(
          tx,
          "update verification.verification_requests set member_message = null, " +
            "internal_comment = null, status = 'cancelled', cancelled_at = now(), " +
            "closed_at = now() where account_id = $1",
          [creator.id],
        ),
        await attempt(
          tx,
          "delete from verification.ownership_codes where account_id = $1",
          [creator.id],
        ),
        await attempt(
          tx,
          "update verification.badges set state = 'revoked', revoked_at = now(), " +
            "revocation_reason_code = 'account_closed', observed_handle_at_decision = '[deleted]', " +
            "observed_platform_account_ref = null where account_id = $1",
          [creator.id],
        ),
        await attempt(
          tx,
          "update verification.evidence_files set state = 'purging', purge_requested_at = now() " +
            "where account_id = $1",
          [creator.id],
        ),
        await attempt(
          tx,
          "delete from profiles.advertiser_internal_details where account_id = $1",
          [brand.id],
        ),
      ];
      await tx.unsafe("reset role");
      return {
        results,
        before,
        after: await verificationStateOf(tx, creator.id),
      };
    });
    for (const result of outcome.results) {
      expect(result).toMatchObject({ outcome: "rows", count: 0 });
    }
    expect(outcome.after).toEqual(outcome.before);
  });

  it("refuses on an erased account any write that does not empty the row (42501)", async () => {
    const outcome = await scenario(async (tx) => {
      const creator = await verifiedCreator(tx);
      await execute(tx, creator.id, "erasure");
      await tx.unsafe("set local role influx_privacy_definer");
      const results = [
        await attempt(
          tx,
          "update verification.badges set state = 'active', revoked_at = null, " +
            "revocation_reason_code = null where account_id = $1",
          [creator.id],
        ),
        await attempt(
          tx,
          "update verification.badges set observed_handle_at_decision = 'kept_handle' " +
            "where account_id = $1",
          [creator.id],
        ),
        await attempt(
          tx,
          "update verification.verification_requests " +
            "set member_message = 'A message kept after the erasure.' where account_id = $1",
          [creator.id],
        ),
      ];
      await tx.unsafe("reset role");
      return results;
    });
    for (const result of outcome) {
      expect(result).toMatchObject({
        outcome: "error",
        code: INSUFFICIENT_PRIVILEGE,
      });
    }
  });
});

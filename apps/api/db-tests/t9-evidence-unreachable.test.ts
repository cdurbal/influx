// T9.6 — a piece of verification is reachable by no route and no schema object of the advertiser
// role, an identifier guessed included (docs/mvp/18 T9.6, B6 of §10; 08 RG82; 03 C(13); fiche L2E
// invariant 1 as jalons/l2e/modele.md EC-L2E-18 tightens it). Blocking on its own.
//   T9.6-R  rights: influx_advertiser holds nothing on the schema `verification`, USAGE included,
//           nor on any of its relations, columns, sequences, functions, policies or default
//           privileges; nothing on the schema `storage` and its tables (the bucket stays private);
//           it is a member of no role. Read in the catalogue, then tried: every relation and the
//           piece's own row answer 42501.
//   T9.6-F  functions, ALL schemas: none the advertiser can execute (EXECUTE and USAGE on its schema)
//           names `evidence_files` or `storage.` (prosrc, or a SQL-standard body), depends on a
//           relation of either (pg_depend), or builds a dynamic statement; the `verification.`
//           tables it names are the requests, the codes and the badges only (the brand's doors,
//           RG61); no relation it can read is a view over the piece or Storage (pg_rewrite).
//   T9.6-O  owners: the roles reached from influx_advertiser through SECURITY DEFINER functions, to a
//           fixed point (the owner of a door, then the owners of what that owner can execute in
//           turn), hold no right on `evidence_files`, `storage` or its objects, and no function any
//           of them can execute names the piece or Storage. USAGE on `verification` stays allowed
//           to them (EC-L2E-18: influx_identity_definer reads requests, codes, badges), and to the
//           roles out of that reach (influx_privacy_definer of 0226, influx_leads_definer of 0227):
//           the invariant is "no right on the piece along any path the advertiser opens", not a
//           list of roles. Triggers fired by those roles' writes are not followed: a trigger
//           returns nothing to the session (the value side of the rule is T9.6-A and T1).
//   T9.6-A  routes: a REAL piece (deposited through PUT …/evidence, its request submitted) has its
//           identifier, its request's and its object key carried in EVERY route of the server's
//           inventory, as an advertiser: no byte, no field of it, no read of its bucket, and the
//           same status and body as an identifier never issued (uuids and times normalised).
//   T9.6-W  witnesses: a USAGE granted, a definer door naming the piece, a door relaying to another
//           owner's function, and a route that serves the piece each make the check fail.
//   L2F     (commit 16, fiche L2F invariant 10) the seven tables of 0231 to 0234 named one by one in
//           T9.6-R; the routes of L2F (contests, queues 5 and 6, badges, opening) join T9.6-A by the
//           inventory, and profiles.read_badge_grace_days() (0237) joins T9.6-F and T9.6-O by itself.
// "After the reveal of identities" (18 T9.6) waits for Lot 4, where no reveal exists yet: this file
// is replayed then. Fixtures are COMMITTED through the routes (random identifiers, disposable local
// stack); the piece's row, the open requests and the usage are removed after the file. Storage is a
// double that keeps the bytes the deposit wrote and records every read.
import {
  accountIdOf,
  inRolledBackTransaction,
  localRoleUrl,
  probe,
  takeRole,
  type LoginRole,
} from "@influx/test-kit/db";
import { valuesFoundIn } from "@influx/test-kit/logs";
import type { LightMyRequestResponse } from "fastify";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { crc32, deflateSync } from "node:zlib";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as z from "zod";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import {
  ensureInForce,
  LOCAL_SEED_DRAFTS,
} from "../scripts/terms-publication.ts";
import type { ObjectStore, StorageBucket } from "../src/platform/storage.ts";
import {
  buildServer,
  routeInventoryOf,
  type InventoriedRoute,
} from "../src/server.ts";
import {
  BACKOFFICE_ORIGIN,
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
  WEB_ORIGIN,
  WEB_SECRET,
} from "../tests/helpers.ts";
import {
  requestsOf,
  type Method,
  type SweepRequest,
} from "./route-requests.ts";
import {
  localSuperuser,
  loginRole,
  retireBrandFixtures,
  sharedMigrationRole,
  testDataSet,
} from "./support.ts";

const BUCKET: StorageBucket = "verification-evidence";
const REQUESTS = "/v1/me/verification/requests";
const HEALTH = "GET /health";
const agentA = accountIdOf("agent", "a");
/** The tables of `verification` a door of the brand may name (EC-L2E-18, RG61). */
const BRAND_DOOR_TABLES = [
  "badges",
  "ownership_codes",
  "verification_requests",
];
/** The tables of `verification` the L2F migrations add (0231 to 0234): fiche L2F invariant 10. */
const L2F_TABLES = [
  "badge_revocation_requests",
  "consumer_email_domains",
  "dispute_outcome_reasons",
  "dispute_reasons",
  "disputes",
  "identifier_change_reviews",
  "opening_reasons",
];

let database: ApiDatabase;
let migration: postgres.Sql;
let termsId: string;
const accounts: string[] = [];

type Member = { accountId: string };

/** The real piece: its row, its request, its object and the bytes the deposit wrote. */
let piece: {
  creator: string;
  evidenceId: string;
  requestId: string;
  objectKey: string;
  checksum: string;
  bytes: Buffer;
};
/** The advertiser who guesses. */
let brand: Member;

// ---------------------------------------------------------------------------------------------
// Doubles
// ---------------------------------------------------------------------------------------------

const objects = new Map<string, Buffer>();
/** Every read of the store, `bucket/key`. */
const reads: string[] = [];

const store: ObjectStore = {
  write: async (bucket, key, bytes) => {
    objects.set(`${bucket}/${key}`, Buffer.from(bytes));
    return { ok: true, value: null };
  },
  read: async (bucket, key) => {
    reads.push(`${bucket}/${key}`);
    return { ok: true, value: objects.get(`${bucket}/${key}`) ?? null };
  },
  remove: async (bucket, key) => {
    objects.delete(`${bucket}/${key}`);
    return { ok: true, value: null };
  },
};

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

function app() {
  return buildServer(testApiConfig(), {
    logDestination: captureLogs().destination,
    database,
    storage: store,
  });
}

type Server = ReturnType<typeof app>;

async function newMember(role: "advertiser" | "creator"): Promise<Member> {
  const accountId = randomUUID();
  const email = `t9-${role}-${accountId}@example.test`;
  await migration.begin(async (tx) => {
    await tx`
      insert into identity.accounts
        (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
         is_adult_attested, adult_attested_at, declared_status)
      values (${accountId}, ${randomUUID()}, ${email}, now(), 'FR', 'fr', true, now(),
              ${role === "advertiser" ? "business" : "individual"}::identity.declared_status)`;
    await tx`
      insert into identity.account_roles (account_id, role)
      values (${accountId}, ${role}::identity.account_role)`;
    if (role === "advertiser") {
      await tx`
        insert into profiles.advertiser_profiles (account_id, legal_name)
        values (${accountId}, ${`Maison ${accountId.slice(0, 8)}`})`;
    } else {
      await tx`
        insert into profiles.creator_public_profiles (account_id, alias, residence_country_code)
        values (${accountId}, profiles.new_creator_alias(), 'FR')`;
      await tx`
        insert into profiles.creator_social_accounts (account_id, network_code, is_primary, handle)
        values (${accountId}, 'instagram', true, ${`handle_${accountId.slice(0, 8)}`})`;
    }
    await tx`
      insert into identity.terms_acceptances (account_id, terms_version_id, nature, channel, locale)
      values (${accountId}, ${termsId}, 'acceptance', 'signup', 'fr')`;
  });
  accounts.push(accountId);
  return { accountId };
}

/** A fresh member session: a route of the sweep may end the one it was given (logout). */
async function newSession(accountId: string): Promise<string> {
  const token = randomBytes(32);
  await migration`
    insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (${createHash("sha256").update(token).digest()}, ${accountId}, 'member', null,
            'firefox.windows')`;
  return token.toString("base64url");
}

type Body = { json: unknown } | { bytes: Buffer; type: string };

async function call(
  server: Server,
  method: Method,
  url: string,
  session: string | null,
  body?: Body,
  surface: "web" | "backoffice" = "web",
): Promise<LightMyRequestResponse> {
  const payload =
    body === undefined
      ? undefined
      : "json" in body
        ? { type: "application/json", data: JSON.stringify(body.json) }
        : { type: body.type, data: body.bytes };
  return server.inject({
    method,
    url,
    headers: {
      "x-influx-internal": surface === "web" ? WEB_SECRET : BACKOFFICE_SECRET,
      "x-request-id": randomUUID(),
      origin: surface === "web" ? WEB_ORIGIN : BACKOFFICE_ORIGIN,
      "sec-fetch-site": "same-origin",
      ...(payload === undefined ? {} : { "content-type": payload.type }),
      ...(session === null
        ? {}
        : { cookie: `__Host-influx-session=${session}` }),
    },
    ...(payload === undefined ? {} : { payload: payload.data }),
  });
}

async function asCreator(
  server: Server,
  method: Method,
  url: string,
  body?: Body,
): Promise<LightMyRequestResponse> {
  const response = await call(
    server,
    method,
    url,
    await newSession(piece.creator),
    body,
  );
  expect(response.statusCode, `${method} ${url}: ${response.body}`).toBe(200);
  return response;
}

/** A PNG written byte for byte, of incompressible noise (a distinct piece at every run). */
function noisePng(width: number, height: number): Buffer {
  const stride = 1 + width * 3;
  const raw = randomBytes(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0; // filter: none
  }
  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typed = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typed));
    return Buffer.concat([length, typed, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 0 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** An active « Compte vérifié » on the creator's line: the prerequisite of the submission (RG12). */
async function grantAccountBadge(creator: string): Promise<void> {
  const [line] = await migration<{ id: string }[]>`
    select id::text from profiles.creator_social_accounts where account_id = ${creator}`;
  const [request] = await migration<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status, created_at, submitted_at,
       sla_due_at, escalate_at, decided_by_account_id, decided_at, closed_at)
    values (${creator}, ${line?.id ?? null}, 'instagram', 'account_verified', 'approved',
            now() - interval '3 hours', now() - interval '3 hours',
            now() - interval '1 hour', now() - interval '1 hour',
            ${agentA}, now() - interval '2 hours', now() - interval '2 hours')
    returning id::text`;
  await migration`
    insert into verification.badges
      (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
       granted_at, evidence_source, observed_handle_at_decision, state)
    values (${creator}, ${line?.id ?? null}, 'instagram', ${request?.id ?? null},
            'account_verified', ${agentA}, now() - interval '2 hours', 'public_profile',
            ${`handle_${creator.slice(0, 8)}`}, 'active')`;
}

// ---------------------------------------------------------------------------------------------
// The catalogue checks: each returns its findings, empty when the rule holds. They take the
// connection they read, so that a witness runs them inside its own rolled-back transaction.
// ---------------------------------------------------------------------------------------------

type Sql = postgres.Sql | postgres.TransactionSql;

/** T9.6-R in the catalogue: every right influx_advertiser holds on `verification` and `storage`. */
async function advertiserRightsFindings(sql: Sql): Promise<string[]> {
  const rows = await sql<{ finding: string }[]>`
    with adv as (select 'influx_advertiser'::regrole::oid as r),
    targets as (
      select c.oid, c.relkind from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where n.nspname in ('verification', 'storage')
    )
    select 'schema ' || s || ' ' || p as finding
      from adv, unnest(array['verification', 'storage']) s, unnest(array['USAGE', 'CREATE']) p
     where pg_catalog.has_schema_privilege(adv.r, s, p)
    union all
    select t.oid::regclass::text || ' ' || p
      from adv, targets t,
           unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
     where t.relkind in ('r', 'p', 'v', 'm', 'f')
       and pg_catalog.has_table_privilege(adv.r, t.oid, p)
    union all
    select t.oid::regclass::text || ' column ' || p
      from adv, targets t, unnest(array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']) p
     where t.relkind in ('r', 'p', 'v', 'm', 'f')
       and pg_catalog.has_any_column_privilege(adv.r, t.oid, p)
    union all
    select t.oid::regclass::text || ' sequence ' || p
      from adv, targets t, unnest(array['USAGE', 'SELECT', 'UPDATE']) p
     where t.relkind = 'S' and pg_catalog.has_sequence_privilege(adv.r, t.oid, p)
    union all
    select 'function ' || f.oid::regprocedure::text
      from adv, pg_catalog.pg_proc f
      join pg_catalog.pg_namespace n on n.oid = f.pronamespace
     where n.nspname = 'verification'
       and pg_catalog.has_function_privilege(adv.r, f.oid, 'EXECUTE')
    union all
    select 'policy ' || pol.schemaname || '.' || pol.tablename || ' ' || pol.policyname
      from pg_catalog.pg_policies pol
     where pol.schemaname in ('verification', 'storage')
       and pol.roles && array['influx_advertiser', 'public']::name[]
    union all
    select 'default privileges of ' || d.defaclrole::regrole::text || ' on '
           || d.defaclobjtype::text || ' in ' || coalesce(d.defaclnamespace::regnamespace::text, 'every schema')
      from adv, pg_catalog.pg_default_acl d, pg_catalog.aclexplode(d.defaclacl) a
     where a.grantee = adv.r
        or (a.grantee = 0 and d.defaclnamespace in (0, 'verification'::regnamespace::oid))
    union all
    select 'member of ' || m.roleid::regrole::text
      from adv, pg_catalog.pg_auth_members m where m.member = adv.r
    union all
    select 'attribute ' || a.attr
      from adv, pg_catalog.pg_roles r
      cross join lateral (values ('superuser', r.rolsuper), ('bypassrls', r.rolbypassrls),
                                 ('createrole', r.rolcreaterole)) a(attr, held)
     where r.oid = adv.r and a.held
    union all
    select 'public bucket ' || b.id from storage.buckets b where b.public
    order by 1`;
  return rows.map((row) => row.finding);
}

/** What the catalogue checks look at, so that a check that sees nothing proves nothing. */
async function catalogueReach(sql: Sql): Promise<{
  verificationRelations: number;
  verificationFunctions: number;
  executable: number;
  brandDoors: string[];
}> {
  const [row] = await sql<
    {
      relations: number;
      functions: number;
      executable: number;
      doors: string[];
    }[]
  >`
    select
      (select count(*)::int from pg_catalog.pg_class c
         join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'verification' and c.relkind = 'r') as relations,
      (select count(*)::int from pg_catalog.pg_proc f
         join pg_catalog.pg_namespace n on n.oid = f.pronamespace
        where n.nspname = 'verification') as functions,
      (select count(*)::int from pg_catalog.pg_proc f
        where pg_catalog.has_function_privilege('influx_advertiser', f.oid, 'EXECUTE')
          and pg_catalog.has_schema_privilege('influx_advertiser', f.pronamespace, 'USAGE')
          and f.pronamespace not in ('pg_catalog'::regnamespace, 'information_schema'::regnamespace))
        as executable,
      (select coalesce(array_agg(f.oid::regproc::text order by 1), '{}')
         from pg_catalog.pg_proc f
        where pg_catalog.has_function_privilege('influx_advertiser', f.oid, 'EXECUTE')
          and pg_catalog.has_schema_privilege('influx_advertiser', f.pronamespace, 'USAGE')
          and f.prosrc ~* '\\mverification\\s*\\.\\s*verification_requests\\M') as doors`;
  if (row === undefined) {
    throw new Error("no catalogue row");
  }
  return {
    verificationRelations: row.relations,
    verificationFunctions: row.functions,
    executable: row.executable,
    brandDoors: row.doors,
  };
}

/**
 * The SQL of the functions the roles of the array expression `roles` can run: EXECUTE on the function AND USAGE on its schema (a
 * function of a schema the role cannot use is no door), every schema, pg_catalog included.
 */
function executableBy(roles: string): string {
  return `
    select distinct f.oid, f.prolang,
           f.prosrc || coalesce(pg_catalog.pg_get_function_sqlbody(f.oid), '') as body
      from pg_catalog.pg_proc f, unnest(${roles}) r(role)
     where pg_catalog.has_function_privilege(r.role, f.oid, 'EXECUTE')
       and pg_catalog.has_schema_privilege(r.role, f.pronamespace, 'USAGE')`;
}

/** The relations the piece and Storage live in: `verification.evidence_files` and `storage.*`. */
const PIECE_RELATIONS = `
  select c.oid from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
   where (n.nspname = 'verification' and c.relname = 'evidence_files')
      or n.nspname = 'storage'`;

/**
 * What a function among those `roles` can run says or depends on: the piece's table or Storage by
 * name (prosrc, or the parsed body of a SQL-standard function), a dependency on either
 * (pg_depend: SQL-standard bodies), a dynamic statement (plpgsql EXECUTE, which no catalogue can
 * read).
 */
async function functionFindings(sql: Sql, roles: string[]): Promise<string[]> {
  const rows = await sql.unsafe<{ finding: string }[]>(
    `with executable as (${executableBy("(select array_agg(r::regrole::oid) from unnest($1::text[]) r)")}),
     piece as (${PIECE_RELATIONS})
     select e.oid::regprocedure::text || ' names evidence_files' as finding
       from executable e where e.body ~* '\\mevidence_files\\M'
     union all
     select e.oid::regprocedure::text || ' names storage.'
       from executable e where e.body ~* '\\m"?storage"?\\s*\\.'
     union all
     select e.oid::regprocedure::text || ' builds a dynamic statement'
       from executable e join pg_catalog.pg_language l on l.oid = e.prolang
      where l.lanname = 'plpgsql' and e.body ~* '\\mexecute\\M'
     union all
     select e.oid::regprocedure::text || ' depends on ' || d.refobjid::regclass::text
       from executable e
       join pg_catalog.pg_depend d
         on d.classid = 'pg_catalog.pg_proc'::regclass and d.objid = e.oid
        and d.refclassid = 'pg_catalog.pg_class'::regclass
      where d.refobjid in (select oid from piece)
     order by 1`,
    [roles] as postgres.ParameterOrJSON<never>[],
  );
  return rows.map((row) => row.finding);
}

/**
 * T9.6-F, the part proper to the advertiser: the `verification.` relations its functions name are
 * the brand doors' three (EC-L2E-18), and no relation it can read is a view over the piece or
 * Storage.
 */
async function advertiserNamesFindings(sql: Sql): Promise<string[]> {
  const rows = await sql.unsafe<{ finding: string }[]>(
    `with executable as (${executableBy("array['influx_advertiser'::regrole::oid]")}),
     named as (
       select e.oid, lower(m[1]) as name
         from executable e,
              regexp_matches(e.body, '\\m"?verification"?\\s*\\.\\s*"?([a-z_0-9]+)', 'gi') m
     ),
     piece as (${PIECE_RELATIONS})
     select distinct nm.oid::regprocedure::text || ' names verification.' || nm.name as finding
       from named nm
       join pg_catalog.pg_class c on c.relname = nm.name
        and c.relnamespace = 'verification'::regnamespace
      where nm.name <> all ($1::text[])
     union all
     select distinct c.oid::regclass::text || ' reads ' || d.refobjid::regclass::text
       from pg_catalog.pg_class c
       join pg_catalog.pg_rewrite w on w.ev_class = c.oid
       join pg_catalog.pg_depend d
         on d.classid = 'pg_catalog.pg_rewrite'::regclass and d.objid = w.oid
        and d.refclassid = 'pg_catalog.pg_class'::regclass
      where d.refobjid in (select oid from piece)
        and pg_catalog.has_schema_privilege('influx_advertiser', c.relnamespace, 'USAGE')
        and pg_catalog.has_any_column_privilege('influx_advertiser', c.oid, 'SELECT')
     order by 1`,
    [BRAND_DOOR_TABLES] as postgres.ParameterOrJSON<never>[],
  );
  return rows.map((row) => row.finding);
}

/**
 * The roles reached from influx_advertiser, to a fixed point: the owner of every SECURITY DEFINER
 * function a reached role can execute, and every role a reached role is a member of.
 */
async function reachedRoles(sql: Sql): Promise<string[]> {
  const rows = await sql<{ role: string }[]>`
    with recursive reach (role) as (
      select 'influx_advertiser'::regrole::oid
      union
      select step.role from reach cross join lateral (
        select f.proowner as role from pg_catalog.pg_proc f
         where f.prosecdef
           and pg_catalog.has_function_privilege(reach.role, f.oid, 'EXECUTE')
           and pg_catalog.has_schema_privilege(reach.role, f.pronamespace, 'USAGE')
        union all
        select m.roleid from pg_catalog.pg_auth_members m where m.member = reach.role
      ) step
    )
    select pg_catalog.pg_get_userbyid(role) as role from reach order by 1`;
  return rows.map((row) => row.role);
}

/** T9.6-O: every right of a reached role on the piece's table, on Storage, and its attributes. */
async function reachedRightsFindings(
  sql: Sql,
  roles: string[],
): Promise<string[]> {
  const rows = await sql<{ finding: string }[]>`
    with reach as (select r::regrole::oid as r from unnest(${roles}::text[]) r),
    piece as (
      select c.oid from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
       where (n.nspname = 'verification' and c.relname = 'evidence_files')
          or (n.nspname = 'storage' and c.relkind in ('r', 'p', 'v', 'm', 'f'))
    )
    select reach.r::regrole::text || ' ' || p || ' on ' || piece.oid::regclass::text as finding
      from reach, piece,
           unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
     where pg_catalog.has_table_privilege(reach.r, piece.oid, p)
    union all
    select reach.r::regrole::text || ' column ' || p || ' on ' || piece.oid::regclass::text
      from reach, piece, unnest(array['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']) p
     where pg_catalog.has_any_column_privilege(reach.r, piece.oid, p)
    union all
    select reach.r::regrole::text || ' USAGE on storage'
      from reach where pg_catalog.has_schema_privilege(reach.r, 'storage', 'USAGE')
    union all
    select reach.r::regrole::text || ' ' || a.attr
      from reach join pg_catalog.pg_roles ro on ro.oid = reach.r
      cross join lateral (values ('superuser', ro.rolsuper), ('bypassrls', ro.rolbypassrls)) a(attr, held)
     where a.held
    order by 1`;
  return rows.map((row) => row.finding);
}

/** Every catalogue check of T9.6, as the witnesses replay them. */
async function catalogueFindings(sql: Sql): Promise<string[]> {
  const reached = await reachedRoles(sql);
  return [
    ...(await advertiserRightsFindings(sql)),
    ...(await functionFindings(sql, ["influx_advertiser"])),
    ...(await advertiserNamesFindings(sql)),
    ...(await reachedRightsFindings(sql, reached)),
    ...(await functionFindings(sql, reached)).map(
      (found) => `reached: ${found}`,
    ),
  ];
}

// ---------------------------------------------------------------------------------------------
// The sweep of the routes
// ---------------------------------------------------------------------------------------------

function routeName(route: InventoriedRoute): string {
  return `${route.method} ${route.url}`;
}

async function sweptRoutes(server: Server): Promise<InventoriedRoute[]> {
  await server.ready();
  return routeInventoryOf(server).filter(
    (route) => routeName(route) !== HEALTH,
  );
}

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const TIME = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})/g;

/** A body as compared: the value carried and its control as one placeholder, uuids and times too. */
function normalised(text: string, carried: readonly string[]): string {
  let out = text;
  for (const value of carried) {
    for (const form of [value, encodeURIComponent(value)]) {
      out = out.split(form).join("<carried>");
    }
  }
  return out.replace(UUID, "<uuid>").replace(TIME, "<time>");
}

/** The request with `value` carried in its query as well, when neither its path nor its body has it. */
function carrying(request: SweepRequest, value: string): SweepRequest {
  const inBody =
    request.body !== undefined && JSON.stringify(request.body).includes(value);
  if (request.url.includes(encodeURIComponent(value)) || inBody) {
    return request;
  }
  const separator = request.url.includes("?") ? "&" : "?";
  return {
    ...request,
    url: `${request.url}${separator}evidenceId=${encodeURIComponent(value)}`,
  };
}

/** Each path parameter in turn: the first takes the request, the others the piece. */
function positional(route: InventoriedRoute, ids: readonly string[]): string {
  let index = 0;
  return route.url.replace(/:[A-Za-z]+/g, () => {
    const id = ids[Math.min(index, ids.length - 1)] ?? "";
    index += 1;
    return encodeURIComponent(id);
  });
}

/**
 * `compared`: the value fills a slot of the route (a path parameter, a field of its query or body),
 * so the two answers must match. A value only appended to the query reaches no handler as data: its
 * answers are searched for the piece, not compared (a stateful route, the sessions list or a fresh
 * domain code, answers twice differently whatever the value).
 */
type Pair = {
  real: SweepRequest;
  control: SweepRequest;
  carried: string[];
  compared: boolean;
};

/**
 * The pairs of one route: for each real value (the piece, its request, its object key), every
 * request synthesised with it, and the same requests with a value never issued; for a route of two
 * parameters or more, the request and the piece together, against two unknown identifiers.
 */
function pairsOf(route: InventoriedRoute): Pair[] {
  const pairs: Pair[] = [];
  const fakeKey = `${randomUUID()}/${randomUUID()}/${randomUUID()}.webp`;
  for (const [value, control] of [
    [piece.evidenceId, randomUUID()],
    [piece.requestId, randomUUID()],
    [piece.objectKey, fakeKey],
  ] as const) {
    const real = requestsOf(route, [value]);
    const controls = requestsOf(route, [control]);
    real.forEach((request, index) => {
      const twin = controls[index];
      if (twin !== undefined) {
        const carried = carrying(request, value);
        pairs.push({
          real: carried,
          control: carrying(twin, control),
          carried: [value, control],
          compared: carried === request,
        });
      }
    });
  }
  if ((route.url.match(/:[A-Za-z]+/g) ?? []).length >= 2) {
    const [first] = requestsOf(route, [piece.evidenceId]);
    const unknown = [randomUUID(), randomUUID()];
    if (first !== undefined) {
      const query = first.url.includes("?")
        ? first.url.slice(first.url.indexOf("?"))
        : "";
      pairs.push({
        real: {
          ...first,
          url: `${positional(route, [piece.requestId, piece.evidenceId])}${query}`,
        },
        control: { ...first, url: `${positional(route, unknown)}${query}` },
        carried: [piece.requestId, piece.evidenceId, ...unknown],
        compared: true,
      });
    }
  }
  return pairs;
}

/** What the piece is, searched by value in every answer (the value the request carried apart). */
function pieceMarkers(): { name: string; value: string }[] {
  return [
    { name: "piece identifier", value: piece.evidenceId },
    { name: "request identifier", value: piece.requestId },
    { name: "object key", value: piece.objectKey },
    { name: "checksum", value: piece.checksum },
    { name: "creator account", value: piece.creator },
    // a slice of the bytes, base64 from an offset that is a multiple of 3, so that any base64 of
    // the whole object carries it
    {
      name: "piece bytes (base64)",
      value: piece.bytes.subarray(300, 360).toString("base64"),
    },
  ];
}

type SweepResult = {
  findings: string[];
  differences: string[];
  statuses: Map<string, number[]>;
  pairs: number;
  /** Routes whose answers were compared at least once. */
  compared: Set<string>;
};

async function sweep(
  server: Server,
  caller: Member,
  only: (route: InventoriedRoute) => boolean = () => true,
): Promise<SweepResult> {
  const findings: string[] = [];
  const differences: string[] = [];
  const statuses = new Map<string, number[]>();
  const rawSlice = piece.bytes.subarray(400, 464);
  let pairs = 0;
  const compared = new Set<string>();
  for (const route of (await sweptRoutes(server)).filter(only)) {
    const seen: number[] = [];
    statuses.set(routeName(route), seen);
    for (const pair of pairsOf(route)) {
      const answers: LightMyRequestResponse[] = [];
      for (const request of [pair.real, pair.control]) {
        answers.push(
          await call(
            server,
            request.method as Method,
            request.url,
            await newSession(caller.accountId),
            request.body === undefined ? undefined : { json: request.body },
          ),
        );
      }
      pairs += 1;
      const [real, control] = answers as [
        LightMyRequestResponse,
        LightMyRequestResponse,
      ];
      seen.push(real.statusCode);
      const raw = `${real.body}\n${JSON.stringify(real.headers)}`;
      for (const marker of pieceMarkers()) {
        if (
          !pair.carried.includes(marker.value) &&
          valuesFoundIn(raw, [marker.value]).length > 0
        ) {
          findings.push(
            `${routeName(route)} (${real.statusCode}): ${marker.name}`,
          );
        }
      }
      if (real.rawPayload.includes(rawSlice)) {
        findings.push(`${routeName(route)} (${real.statusCode}): piece bytes`);
      }
      if (!pair.compared) {
        continue;
      }
      compared.add(routeName(route));
      const left = `${real.statusCode} ${normalised(real.body, pair.carried)}`;
      const right = `${control.statusCode} ${normalised(control.body, pair.carried)}`;
      if (left !== right) {
        differences.push(
          `${pair.real.method} ${pair.real.url}: ${left} | ${right}`,
        );
      }
    }
  }
  return { findings, differences, statuses, pairs, compared };
}

function readsOfTheBucket(): string[] {
  return reads.filter((read) => read.startsWith(`${BUCKET}/`));
}

// ---------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------

beforeAll(async () => {
  migration = sharedMigrationRole();
  await testDataSet();
  for (const draft of LOCAL_SEED_DRAFTS) {
    await ensureInForce(migration, draft);
  }
  const [fr] = await migration<{ id: string }[]>`
    select id::text from identity.terms_versions
     where document_kind = 'terms_of_service' and locale = 'fr'
       and effective_to is null and effective_from <= now() and content is not null`;
  if (fr === undefined) {
    throw new Error(
      "no terms of service in force in French (run db:publish-terms)",
    );
  }
  termsId = fr.id;
  database = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );

  // the creator's real piece: an audience request, a deposit through the route, the submission
  const creator = await newMember("creator");
  await grantAccountBadge(creator.accountId);
  piece = {
    creator: creator.accountId,
    evidenceId: "",
    requestId: "",
    objectKey: "",
    checksum: "",
    bytes: Buffer.alloc(0),
  };
  const server = app();
  const opened = await asCreator(server, "POST", REQUESTS, {
    json: { networkCode: "instagram", level: "audience_verified" },
  });
  const requestId = (opened.json() as { request: { id: string } }).request.id;
  await asCreator(server, "PUT", `${REQUESTS}/${requestId}/evidence`, {
    bytes: noisePng(640, 480),
    type: "application/octet-stream",
  });
  await asCreator(server, "POST", `${REQUESTS}/${requestId}/submit`);
  const [row] = await migration<
    { id: string; object_key: string; checksum: string; status: string }[]
  >`
    select e.id::text, e.object_key, encode(e.checksum, 'hex') as checksum, r.status::text
      from verification.evidence_files e
      join verification.verification_requests r on r.id = e.request_id
     where e.request_id = ${requestId} and e.state = 'active'`;
  if (row === undefined) {
    throw new Error("the deposit left no active piece");
  }
  expect(row.status).toBe("pending");
  const bytes = objects.get(`${BUCKET}/${row.object_key}`);
  if (bytes === undefined) {
    throw new Error("the deposit wrote no object");
  }
  piece = {
    creator: creator.accountId,
    evidenceId: row.id,
    requestId,
    objectKey: row.object_key,
    checksum: row.checksum,
    bytes,
  };
  brand = await newMember("advertiser");
  reads.length = 0;
});

afterAll(async () => {
  await closeDatabase(database);
  if (accounts.length > 0) {
    await migration`
      delete from verification.evidence_files where account_id = any (${accounts}::uuid[])`;
    // no open request of this file stays in queue 4 of the shared stack
    await migration`
      update verification.verification_requests
         set status = 'cancelled', cancelled_at = now(), closed_at = now()
       where account_id = any (${accounts}::uuid[]) and status in ('draft', 'pending')`;
    await migration`
      delete from profiles.storage_daily_usage where account_id = any (${accounts}::uuid[])`;
    await migration`
      delete from leads.outbox_events
       where subject_key = any (${accounts.map((id) => `account:${id}`)}::text[])`;
    await retireBrandFixtures(migration, [brand.accountId]);
  }
});

// ---------------------------------------------------------------------------------------------

describe("T9.6-R influx_advertiser holds no right on `verification` nor on Storage", () => {
  it("holds nothing in the catalogue: schemas, relations, columns, sequences, functions, policies, default privileges, memberships", async () => {
    const sql = localSuperuser();
    expect(await advertiserRightsFindings(sql)).toEqual([]);
    // the check sees the schema it guards: seven tables, the doors of 0221 to 0227, a private bucket
    const reach = await catalogueReach(sql);
    expect(reach.verificationRelations).toBeGreaterThanOrEqual(7);
    expect(reach.verificationFunctions).toBeGreaterThanOrEqual(30);
    const [bucket] = await sql<{ public: boolean }[]>`
      select public from storage.buckets where id = ${BUCKET}`;
    expect(bucket).toEqual({ public: false });
  });

  it("is refused with 42501 on every relation of `verification`, on Storage, on the piece's row and on the agent's read", async () => {
    const attempts = await inRolledBackTransaction(
      loginRole("influx_app"),
      async (tx) => {
        await takeRole(tx, "influx_advertiser", {
          accountId: brand.accountId,
          role: "advertiser",
          aal: "aal1",
        });
        const [relations] = await tx<{ names: string[] }[]>`
          select array_agg(c.oid::regclass::text order by 1) as names
            from pg_catalog.pg_class c
           where c.relnamespace in ('verification'::regnamespace, 'storage'::regnamespace)
             and c.relkind in ('r', 'p', 'v', 'm')`;
        const results: Record<string, string> = {};
        const outcome = (result: Awaited<ReturnType<typeof probe>>) =>
          result.outcome === "error" ? result.code : `${result.count} rows`;
        for (const name of relations?.names ?? []) {
          results[name] = outcome(
            await probe(tx, `select 1 from ${name} limit 1`),
          );
        }
        const id = [piece.evidenceId] as postgres.ParameterOrJSON<never>[];
        results["the piece's row"] = outcome(
          await probe(
            tx,
            "select object_key, checksum from verification.evidence_files where id = $1",
            id,
          ),
        );
        results["its object"] = outcome(
          await probe(
            tx,
            "select name from storage.objects where bucket_id = 'verification-evidence' and name = $1",
            [piece.objectKey] as postgres.ParameterOrJSON<never>[],
          ),
        );
        results["verification.read_evidence()"] = outcome(
          await probe(tx, "select verification.read_evidence($1::uuid)", id),
        );
        return results;
      },
    );
    expect(Object.keys(attempts).length).toBeGreaterThanOrEqual(10);
    expect(
      Object.entries(attempts).filter(([, code]) => code !== "42501"),
    ).toEqual([]);
    expect(Object.keys(attempts)).toContain("verification.evidence_files");
    expect(Object.keys(attempts)).toContain("storage.objects");
  });

  // L2F commit 16 (fiche L2F invariant 10, EC-L2E-18): the tables of 0231 to 0234 are in the sweeps
  // above by their schema; this case names them, so that a sweep that misses one cannot pass.
  it("names the tables of L2F: each one is swept, holds no right of the advertiser, and answers 42501", async () => {
    const sql = localSuperuser();
    const [catalogue] = await sql<
      { tables: string[]; rights: string[]; grace: boolean }[]
    >`
      select
        coalesce((select array_agg(c.relname::text order by 1) from pg_catalog.pg_class c
                   where c.relnamespace = 'verification'::regnamespace
                     and c.relname = any (${L2F_TABLES}::text[]) and c.relkind = 'r'), '{}')
          as tables,
        coalesce((select array_agg(t || ' ' || p order by 1)
                    from unnest(${L2F_TABLES}::text[]) t,
                         unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES',
                                      'TRIGGER']) p
                   where to_regclass('verification.' || t) is not null
                     and (pg_catalog.has_table_privilege('influx_advertiser',
                            ('verification.' || t)::regclass, p)
                          or (p in ('SELECT','INSERT','UPDATE','REFERENCES')
                              and pg_catalog.has_any_column_privilege('influx_advertiser',
                                    ('verification.' || t)::regclass, p)))), '{}')
          as rights,
        -- the one function of L2F the advertiser executes (0237) is among those T9.6-F reads
        pg_catalog.has_function_privilege('influx_advertiser',
          'profiles.read_badge_grace_days()', 'EXECUTE') as grace`;
    expect(catalogue?.tables).toEqual([...L2F_TABLES].sort());
    expect(catalogue?.rights).toEqual([]);
    expect(catalogue?.grace).toBe(true);
    const attempts = await inRolledBackTransaction(
      loginRole("influx_app"),
      async (tx) => {
        await takeRole(tx, "influx_advertiser", {
          accountId: brand.accountId,
          role: "advertiser",
          aal: "aal1",
        });
        const results: Record<string, string> = {};
        for (const table of L2F_TABLES) {
          const found = await probe(
            tx,
            `select 1 from verification.${table} limit 1`,
          );
          results[table] = found.outcome === "error" ? found.code : "read";
        }
        return results;
      },
    );
    expect(attempts).toEqual(
      Object.fromEntries(L2F_TABLES.map((table) => [table, "42501"])),
    );
  });
});

describe("T9.6-F every function the advertiser can execute, every schema: neither the piece nor Storage", () => {
  it("names neither evidence_files nor storage., depends on neither, builds no dynamic statement", async () => {
    const sql = localSuperuser();
    expect(await functionFindings(sql, ["influx_advertiser"])).toEqual([]);
    const reach = await catalogueReach(sql);
    expect(reach.executable).toBeGreaterThanOrEqual(30);
  });

  it("names of `verification` the requests, the codes and the badges only (EC-L2E-18), and reads no view over the piece", async () => {
    const sql = localSuperuser();
    expect(await advertiserNamesFindings(sql)).toEqual([]);
    // the brand's doors are seen, and do name the requests: the reading of the bodies works
    expect((await catalogueReach(sql)).brandDoors).toEqual(
      expect.arrayContaining([
        "profiles.open_own_brand_verification",
        "profiles.read_own_brand_verification",
        "profiles.submit_own_brand_verification",
      ]),
    );
  });
});

describe("T9.6-O the owners the advertiser reaches hold no right on the piece", () => {
  it("reaches, door after door, only roles without any right on evidence_files nor Storage", async () => {
    const sql = localSuperuser();
    const reached = await reachedRoles(sql);
    expect(reached).toContain("influx_advertiser");
    // the brand's doors (0222) and the registry they write (audit.append)
    expect(reached).toContain("influx_identity_definer");
    expect(reached).toContain("influx_audit_writer");
    expect(await reachedRightsFindings(sql, reached)).toEqual([]);
    expect(await functionFindings(sql, reached)).toEqual([]);
  });

  it("leaves USAGE on `verification` to the roles that need it, the piece only to those out of reach", async () => {
    const sql = localSuperuser();
    const reached = new Set(await reachedRoles(sql));
    const holders = await sql<{ role: string; piece: boolean }[]>`
      select r.rolname as role,
             pg_catalog.has_any_column_privilege(r.oid, 'verification.evidence_files', 'SELECT')
               or pg_catalog.has_table_privilege(r.oid, 'verification.evidence_files',
                    'SELECT, INSERT, UPDATE, DELETE, TRUNCATE') as piece
        from pg_catalog.pg_roles r
       where pg_catalog.has_schema_privilege(r.oid, 'verification', 'USAGE')
         and r.rolname like 'influx%'
       order by 1`;
    const usage = holders.map((holder) => holder.role);
    // EC-L2E-18: the brand doors' owner, 0226's and 0227's owners hold USAGE, and the test admits it
    expect(usage).toEqual(
      expect.arrayContaining([
        "influx_identity_definer",
        "influx_privacy_definer",
        "influx_leads_definer",
      ]),
    );
    expect(usage).not.toContain("influx_advertiser");
    // whoever holds a right on the piece is out of the advertiser's reach
    const pieceHolders = holders.filter((holder) => holder.piece);
    expect(pieceHolders.map((holder) => holder.role)).toContain(
      "influx_privacy_definer",
    );
    expect(pieceHolders.filter((holder) => reached.has(holder.role))).toEqual(
      [],
    );
  });
});

describe("T9.6-A every route, as an advertiser: the real piece answers as an identifier never issued", () => {
  it("carries its identifier, its request's and its key in every route: no byte, no field, no read, the same answer", async () => {
    const server = app();
    const result = await sweep(server, brand);
    expect(result.findings).toEqual([]);
    expect(result.differences).toEqual([]);
    expect(readsOfTheBucket()).toEqual([]);
    // the sweep reached the handlers, the routes of the piece among them
    const statuses = [...result.statuses.values()].flat();
    expect(statuses).toContain(200);
    expect(statuses).toContain(400);
    expect(statuses).toContain(404);
    expect(result.pairs).toBeGreaterThan(result.statuses.size * 3);
    // every route of a path parameter compared its answers to an identifier never issued
    const withParameter = [...result.statuses.keys()].filter((route) =>
      route.includes("/:"),
    );
    expect(withParameter.length).toBeGreaterThanOrEqual(20);
    expect(
      withParameter.filter((route) => !result.compared.has(route)),
    ).toEqual([]);
    for (const route of [
      `GET /v1/me/verification`,
      `POST ${REQUESTS}/:id/submit`,
      `PUT ${REQUESTS}/:id/evidence`,
      `DELETE ${REQUESTS}/:id/evidence/:evidenceId`,
      "GET /v1/bo/queues/verification-creators/entries/:id/evidence/:evidenceId",
    ]) {
      expect(result.statuses.get(route), route).toBeDefined();
      expect(result.statuses.get(route), route).not.toContain(200);
    }
    // nothing moved: the piece is still the creator's, active, of a pending request
    const [row] = await migration<{ state: string; status: string }[]>`
      select e.state::text, r.status::text
        from verification.evidence_files e
        join verification.verification_requests r on r.id = e.request_id
       where e.id = ${piece.evidenceId}`;
    expect(row).toEqual({ state: "active", status: "pending" });
  });

  it("answers a deposit of bytes into the creator's request, and the agent's read on the backoffice surface, as for an unknown request", async () => {
    const server = app();
    const bytes = noisePng(64, 64);
    const answers: string[] = [];
    for (const id of [piece.requestId, randomUUID()]) {
      const response = await call(
        server,
        "PUT",
        `${REQUESTS}/${id}/evidence`,
        await newSession(brand.accountId),
        { bytes, type: "application/octet-stream" },
      );
      answers.push(`${response.statusCode} ${normalised(response.body, [id])}`);
    }
    for (const [request, evidence] of [
      [piece.requestId, piece.evidenceId],
      [randomUUID(), randomUUID()],
    ] as const) {
      const response = await call(
        server,
        "GET",
        `/v1/bo/queues/verification-creators/entries/${request}/evidence/${evidence}`,
        await newSession(brand.accountId),
        undefined,
        "backoffice",
      );
      answers.push(
        `${response.statusCode} ${normalised(response.body, [request, evidence])}`,
      );
    }
    expect(answers[0]).toBe(answers[1]);
    expect(answers[2]).toBe(answers[3]);
    expect(answers[0]?.startsWith("404 ")).toBe(true);
    expect(answers[2]?.startsWith("2")).toBe(false);
    expect(readsOfTheBucket()).toEqual([]);
    const [count] = await migration<{ n: number }[]>`
      select count(*)::int as n from verification.evidence_files
       where request_id = ${piece.requestId}`;
    expect(count).toEqual({ n: 1 });
  });
});

describe("T9.6-W witnesses: a leak makes the check fail", () => {
  it("sees a USAGE granted to the advertiser", async () => {
    const findings = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        await tx.unsafe(
          "grant usage on schema verification to influx_advertiser",
        );
        return catalogueFindings(tx);
      },
    );
    expect(findings).toContain("schema verification USAGE");
  });

  it("sees a definer door of the advertiser that names the piece, by its text, its dependency and its owner", async () => {
    const findings = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        await tx.unsafe(`
        create function profiles.t9_witness_count() returns bigint
          language sql security definer set search_path = ''
          begin atomic select count(*) from verification.evidence_files; end`);
        await tx.unsafe(
          "alter function profiles.t9_witness_count() owner to influx_creator_verification_definer",
        );
        await tx.unsafe(
          "grant execute on function profiles.t9_witness_count() to influx_advertiser",
        );
        return catalogueFindings(tx);
      },
    );
    expect(findings).toEqual(
      expect.arrayContaining([
        "profiles.t9_witness_count() names evidence_files",
        "profiles.t9_witness_count() depends on verification.evidence_files",
        "influx_creator_verification_definer DELETE on verification.evidence_files",
      ]),
    );
  });

  it("sees a door that names nothing but relays to another owner's function reading the piece", async () => {
    const findings = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        await tx.unsafe(`
        create function verification.t9_witness_inner() returns bigint
          language plpgsql security definer set search_path = ''
          as $$ begin return (select count(*) from verification.evidence_files); end $$`);
        await tx.unsafe(
          "alter function verification.t9_witness_inner() owner to influx_maintenance_definer",
        );
        await tx.unsafe(
          "revoke all on function verification.t9_witness_inner() from public",
        );
        await tx.unsafe(
          "grant execute on function verification.t9_witness_inner() to influx_identity_definer",
        );
        await tx.unsafe(`
        create function profiles.t9_witness_relay() returns bigint
          language plpgsql security definer set search_path = ''
          as $$ begin return verification.t9_witness_inner(); end $$`);
        await tx.unsafe(
          "alter function profiles.t9_witness_relay() owner to influx_identity_definer",
        );
        await tx.unsafe(
          "grant execute on function profiles.t9_witness_relay() to influx_advertiser",
        );
        const direct = await functionFindings(tx, ["influx_advertiser"]);
        return { direct, all: await catalogueFindings(tx) };
      },
    );
    // the door alone says nothing: only the reach finds the owner and the function behind it
    expect(findings.direct).toEqual([]);
    expect(findings.all).toEqual(
      expect.arrayContaining([
        "influx_maintenance_definer column SELECT on verification.evidence_files",
        "reached: verification.t9_witness_inner() names evidence_files",
      ]),
    );
  });

  it("finds the piece served by a route added to the server, its bytes, its difference and its read", async () => {
    const server = app();
    server.get(
      "/v1/me/t9-witness-leaks/:id",
      {
        schema: {
          params: z.strictObject({ id: z.string() }),
          response: {
            200: z.strictObject({ piece: z.string() }),
          },
        },
      },
      async (request) => {
        const { id } = request.params as { id: string };
        if (id !== piece.evidenceId) {
          return { piece: "" };
        }
        const read = await store.read(BUCKET, piece.objectKey);
        const bytes =
          read.ok && read.value !== null ? read.value : new Uint8Array();
        return { piece: Buffer.from(bytes).toString("base64") };
      },
    );
    const before = readsOfTheBucket().length;
    const result = await sweep(server, brand, (route) =>
      route.url.startsWith("/v1/me/t9-witness-leaks"),
    );
    expect([...result.statuses.keys()]).toEqual([
      "GET /v1/me/t9-witness-leaks/:id",
    ]);
    expect(result.findings).toContain(
      "GET /v1/me/t9-witness-leaks/:id (200): piece bytes (base64)",
    );
    expect(result.differences.length).toBeGreaterThan(0);
    expect(readsOfTheBucket().length).toBeGreaterThan(before);
    reads.length = before;
  });
});

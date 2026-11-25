// L2B commit 09 — the logo of the brand through apps/api, the local stack and its REAL Supabase
// Storage (D80, jalons/l2b/stockage.md §1 to §7; 06 RG15, edge cases 3 and 6; 18 T9.2 as D80 amends
// it, T9.4, T9.5, T9.8, T9.9, T14): PUT, GET and DELETE of /v1/me/brand-profile/logo. The bytes read
// back from Storage are searched for metadata (T9.5: never a flag). Accounts are COMMITTED with their
// sessions (random identifiers, disposable local stack, as profiles-brand-route); their logo rows
// and objects are removed after the file. Every log stream is searched BY VALUE (D60): no company
// name, account id nor object key.
import {
  brandLogoResponseSchema,
  brandLogoUploadResponseSchema,
  type BrandLogoUploadResponse,
} from "@influx/contracts/brand-profile";
import {
  localRoleUrl,
  requireLocalAuth,
  type LoginRole,
} from "@influx/test-kit/db";
import { valuesFoundIn } from "@influx/test-kit/logs";
import type { LightMyRequestResponse } from "fastify";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import {
  ensureInForce,
  LOCAL_SEED_DRAFTS,
} from "../scripts/terms-publication.ts";
import { secondsUntilNextUtcMidnight } from "../src/domains/profiles/brand-logo.ts";
import { buildServer } from "../src/server.ts";
import {
  createObjectStore,
  type ObjectStore,
} from "../src/platform/storage.ts";
import { captureLogs, testApiConfig, WEB_SECRET } from "../tests/helpers.ts";
import { migrationRole, retireBrandFixtures } from "./support.ts";

const FIXTURES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../tests/fixtures",
);
const GEOTAGGED = readFileSync(path.join(FIXTURES, "logo-geotagged.jpg"));
const PNG = readFileSync(path.join(FIXTURES, "logo-metadata.png"));
const WEBP = readFileSync(path.join(FIXTURES, "logo-metadata.webp"));
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
  "latin1",
);

const URL_LOGO = "/v1/me/brand-profile/logo";
const OCTETS = "application/octet-stream";

let database: ApiDatabase;
let migration: postgres.Sql;
let store: ObjectStore;
let termsId: string;
const accounts: string[] = [];
const watchedValues: string[] = [];
const logStreams: (() => string)[] = [];

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

type Member = { accountId: string; session: string };

async function newMember(role: "advertiser" | "creator"): Promise<Member> {
  const accountId = randomUUID();
  const email = `l2b-logo-${role}-${accountId}@example.test`;
  const name = `Maison ${accountId.slice(0, 8)}`;
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
        values (${accountId}, ${name})`;
    }
    await tx`
      insert into identity.terms_acceptances (account_id, terms_version_id, nature, channel, locale)
      values (${accountId}, ${termsId}, 'acceptance', 'signup', 'fr')`;
  });
  accounts.push(accountId);
  watchedValues.push(email, name, accountId);
  const token = randomBytes(32);
  await migration`
    insert into identity.sessions (token_hash, account_id, surface, mfa_method, user_agent_summary)
    values (${createHash("sha256").update(token).digest()}, ${accountId}, 'member', null,
            'firefox.windows')`;
  return { accountId, session: token.toString("base64url") };
}

function app(storage: ObjectStore = store) {
  const logs = captureLogs();
  logStreams.push(() => logs.text());
  return buildServer(testApiConfig(), {
    logDestination: logs.destination,
    database,
    storage,
  });
}

type Server = ReturnType<typeof app>;

async function call(
  server: Server,
  method: "GET" | "PUT" | "DELETE",
  url: string,
  session: string | null,
  body?: { bytes: Buffer; type?: string },
): Promise<LightMyRequestResponse> {
  return server.inject({
    method,
    url,
    headers: {
      "x-influx-internal": WEB_SECRET,
      "x-request-id": randomUUID(),
      "sec-fetch-site": "same-origin",
      ...(body === undefined ? {} : { "content-type": body.type ?? OCTETS }),
      ...(session === null
        ? {}
        : { cookie: `__Host-influx-session=${session}` }),
    },
    ...(body === undefined ? {} : { payload: body.bytes }),
  });
}

function put(server: Server, member: Member, bytes: Buffer, type?: string) {
  return call(server, "PUT", URL_LOGO, member.session, {
    bytes,
    ...(type === undefined ? {} : { type }),
  });
}

function errorOf(response: LightMyRequestResponse) {
  const { error } = response.json() as {
    error: {
      code: string;
      message: string;
      details?: { path: string; issue: string }[];
    };
  };
  return {
    status: response.statusCode,
    code: error.code,
    message: error.message,
    details: error.details,
  };
}

type LogoRow = {
  id: string;
  object_key: string;
  state: string;
  byte_size: number | null;
  width: number | null;
  height: number | null;
};

async function rowsOf(accountId: string): Promise<LogoRow[]> {
  return migration<LogoRow[]>`
    select id::text as id, object_key, state::text as state, byte_size, width, height
      from profiles.brand_logo_objects
     where account_id = ${accountId}
     order by created_at`;
}

async function usageOf(
  accountId: string,
): Promise<{ upload_count: number; received_bytes: number } | undefined> {
  const [row] = await migration<
    { upload_count: number; received_bytes: number }[]
  >`
    select upload_count, received_bytes::integer as received_bytes
      from profiles.storage_daily_usage
     where account_id = ${accountId} and bucket_id = 'brand-logo'
       and usage_day = (now() at time zone 'UTC')::date`;
  return row;
}

/** T9.5 on bytes: a RIFF WebP of image chunks only, and nothing the fixtures carry in clear. */
function expectBareWebp(bytes: Buffer): void {
  expect(bytes.subarray(0, 4).toString("latin1")).toBe("RIFF");
  expect(bytes.subarray(8, 12).toString("latin1")).toBe("WEBP");
  expect(bytes.readUInt32LE(4) + 8).toBe(bytes.length);
  let offset = 12;
  while (offset < bytes.length) {
    const fourcc = bytes.subarray(offset, offset + 4).toString("latin1");
    expect(["VP8X", "VP8 ", "VP8L", "ALPH"]).toContain(fourcc);
    if (fourcc === "VP8X") {
      expect((bytes[offset + 8] ?? 0) & (0x20 | 0x08 | 0x04)).toBe(0);
    }
    const size = bytes.readUInt32LE(offset + 4);
    offset += 8 + size + (size % 2);
  }
  const text = bytes.toString("latin1");
  for (const value of [
    "Exif",
    "GPS",
    "xmpmeta",
    "INFLUX-TEST",
    "48.858233",
    "48,51.494N",
  ]) {
    expect(text.includes(value), value).toBe(false);
  }
}

beforeAll(async () => {
  migration = migrationRole();
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
  const local = await requireLocalAuth();
  store = createObjectStore({ url: local.apiUrl, secretKey: local.secretKey });
  database = createApiDatabase(
    {
      app: localConnection("influx_app"),
      auth: localConnection("influx_auth_login"),
      ops: localConnection("influx_ops_login"),
    },
    { info: () => undefined, warn: () => undefined, error: () => undefined },
  );
});

afterAll(async () => {
  await closeDatabase(database);
  // L2CT-7: no open entry and no published profile of this file stays in the shared stack
  await retireBrandFixtures(migration, accounts);
  if (accounts.length > 0) {
    const rows = await migration<{ object_key: string }[]>`
      select object_key from profiles.brand_logo_objects where account_id = any (${accounts}::uuid[])`;
    for (const row of rows) {
      await store.remove("brand-logo", row.object_key);
    }
    await migration`
      delete from profiles.brand_logo_objects where account_id = any (${accounts}::uuid[])`;
    await migration`
      delete from profiles.storage_daily_usage where account_id = any (${accounts}::uuid[])`;
    await migration`
      delete from leads.outbox_events
       where subject_key = any (${accounts.map((id) => `account:${id}`)}::text[])`;
  }
});

describe("PUT /v1/me/brand-profile/logo: the deposit (stockage.md §3; T9.5, T9.9)", () => {
  it("stores a 512 × 512 WebP without any metadata, under the key of the base, and counts the logo (RG58)", async () => {
    const server = app();
    const member = await newMember("advertiser");
    const response = await put(server, member, GEOTAGGED);
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const body = brandLogoUploadResponseSchema.parse(response.json());
    expect(body.logo).toMatchObject({
      contentType: "image/webp",
      width: 512,
      height: 512,
    });
    const answered = Buffer.from(body.logo.data, "base64");
    expect(answered.length).toBe(body.logo.byteSize);
    expectBareWebp(answered);
    const logo = body.completeness.blocks
      .flatMap((block) => block.criteria)
      .find((criterion) => criterion.code === "logo");
    expect(logo?.earned).toBe(true);

    // T9.9: the key is the base's, <account>/<row id>.webp, never a name of the client
    const [row] = await rowsOf(member.accountId);
    expect(row).toMatchObject({
      state: "active",
      object_key: `${member.accountId}/${row?.id}.webp`,
      byte_size: answered.length,
      width: 512,
      height: 512,
    });
    // T9.5: the object read back from Storage, byte for byte, holds no metadata
    const stored = await store.read("brand-logo", row?.object_key ?? "");
    expect(stored.ok).toBe(true);
    if (stored.ok && stored.value !== null) {
      expect(Buffer.from(stored.value).equals(answered)).toBe(true);
      expectBareWebp(Buffer.from(stored.value));
    } else {
      expect.fail("the object is not in Storage");
    }
    const [profile] = await migration<{ completeness_percent: number }[]>`
      select completeness_percent from profiles.advertiser_profiles
       where account_id = ${member.accountId}`;
    expect(profile?.completeness_percent).toBe(body.completeness.score);
    expect(await usageOf(member.accountId)).toEqual({
      upload_count: 1,
      received_bytes: GEOTAGGED.length,
    });
  });

  it("replaces the logo: the previous row purging, its object removed at once (06 edge case 3)", async () => {
    const server = app();
    const member = await newMember("advertiser");
    expect((await put(server, member, GEOTAGGED)).statusCode).toBe(200);
    const [first] = await rowsOf(member.accountId);
    expect((await put(server, member, PNG)).statusCode).toBe(200);
    const rows = await rowsOf(member.accountId);
    expect(rows.map((row) => [row.id, row.state])).toEqual([
      [first?.id, "purging"],
      [rows[1]?.id, "active"],
    ]);
    expect(await store.read("brand-logo", first?.object_key ?? "")).toEqual({
      ok: true,
      value: null,
    });
  });

  it("refuses a PDF and bytes contradicting their signature, 422 with the reason, the row forgotten, the attempt counted (T9.4, E1-9)", async () => {
    const server = app();
    const member = await newMember("advertiser");
    const pdf = await put(server, member, PDF);
    expect(errorOf(pdf)).toEqual({
      status: 422,
      code: "image_rejected",
      message: "The image is refused",
      details: [{ path: "logo", issue: "unsupported_type" }],
    });
    const contrary = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      GEOTAGGED,
    ]);
    const refused = await put(server, member, contrary);
    expect(refused.statusCode).toBe(422);
    expect(errorOf(refused).code).toBe("image_rejected");
    expect(await rowsOf(member.accountId)).toEqual([]);
    expect(await usageOf(member.accountId)).toEqual({
      upload_count: 2,
      received_bytes: PDF.length + contrary.length,
    });
  });

  it("reads the raw bytes only: a declared JSON or image type is refused, an empty body named so", async () => {
    const server = app();
    const member = await newMember("advertiser");
    for (const type of [
      "application/json",
      "image/jpeg",
      "multipart/form-data; boundary=x",
    ]) {
      const response = await put(server, member, GEOTAGGED, type);
      expect(response.statusCode, type).toBe(400);
      expect(errorOf(response).code).toBe("validation_failed");
    }
    const empty = await call(server, "PUT", URL_LOGO, member.session);
    expect(errorOf(empty)).toMatchObject({
      status: 422,
      code: "image_rejected",
      details: [{ path: "logo", issue: "empty" }],
    });
    expect(await usageOf(member.accountId)).toBeUndefined();
  });

  it("refuses a body over 2 MiB with 413 before any count (PP-9 amended by D80)", async () => {
    const server = app();
    const member = await newMember("advertiser");
    const response = await put(server, member, Buffer.alloc(2_097_153, 0x61));
    expect(errorOf(response).status).toBe(413);
    expect(errorOf(response).code).toBe("payload_too_large");
    expect(await usageOf(member.accountId)).toBeUndefined();
  });

  it("keeps the row purging and answers 503 when Storage refuses the write (06 edge case 6)", async () => {
    const failing: ObjectStore = {
      ...store,
      async write() {
        return {
          ok: false,
          reason: "unavailable",
          status: 503,
          errorCode: null,
        };
      },
    };
    const server = app(failing);
    const member = await newMember("advertiser");
    const response = await put(server, member, GEOTAGGED);
    expect(errorOf(response)).toMatchObject({
      status: 503,
      code: "service_unavailable",
    });
    expect((await rowsOf(member.accountId)).map((row) => row.state)).toEqual([
      "purging",
    ]);
  });

  it("refuses a change of the logo of a suspended profile (409): nothing stored, nothing counted", async () => {
    const server = app();
    const member = await newMember("advertiser");
    await migration`
      update profiles.advertiser_profiles set status = 'suspended'
       where account_id = ${member.accountId}`;
    expect(errorOf(await put(server, member, GEOTAGGED)).status).toBe(409);
    expect(
      errorOf(await call(server, "DELETE", URL_LOGO, member.session)).status,
    ).toBe(409);
    expect(await rowsOf(member.accountId)).toEqual([]);
    expect(await usageOf(member.accountId)).toBeUndefined();
  });
});

async function publish(accountId: string): Promise<void> {
  await migration`
    update profiles.advertiser_profiles set status = 'published'
     where account_id = ${accountId}`;
}

async function logoRevisions(
  accountId: string,
): Promise<{ status: string; proposed: unknown }[]> {
  return migration<{ status: string; proposed: unknown }[]>`
    select status::text as status, proposed_value as proposed
      from profiles.profile_field_revisions
     where account_id = ${accountId} and field_code = 'advertiser.logo'
     order by submitted_at`;
}

async function pendingChangesOf(
  server: Server,
  member: Member,
): Promise<{ field: string; change: string; value: string | null }[]> {
  const response = await call(
    server,
    "GET",
    "/v1/me/brand-profile",
    member.session,
  );
  expect(response.statusCode).toBe(200);
  return (
    response.json() as {
      pendingChanges: { field: string; change: string; value: string | null }[];
    }
  ).pendingChanges;
}

describe("the logo of a PUBLISHED profile goes through review (06 RG9, CA15; jalons/l2c/file.md A4)", () => {
  it("keeps the logo in force served while the new one waits, replaces a waiting one and purges its object (never before the decision)", async () => {
    const server = app();
    const member = await newMember("advertiser");
    const validated = brandLogoUploadResponseSchema.parse(
      (await put(server, member, GEOTAGGED)).json(),
    );
    expect(validated.state).toBe("active");
    await publish(member.accountId);
    const [activeRow] = await rowsOf(member.accountId);

    const proposed = brandLogoUploadResponseSchema.parse(
      (await put(server, member, PNG)).json(),
    );
    expect(proposed.state).toBe("in_review");
    expect(proposed.logo.data).not.toBe(validated.logo.data);
    const rows = await rowsOf(member.accountId);
    expect(rows.map((row) => row.state)).toEqual(["active", "in_review"]);
    // the active object is untouched: not purged before the decision
    expect(rows[0]?.id).toBe(activeRow?.id);
    expect((await store.read("brand-logo", rows[0]?.object_key ?? "")).ok).toBe(
      true,
    );

    // the read serves the validated logo, and the waiting one apart
    const read = brandLogoResponseSchema.parse(
      (await call(server, "GET", URL_LOGO, member.session)).json(),
    );
    expect(read.logo?.data).toBe(validated.logo.data);
    expect(read.pendingLogo?.data).toBe(proposed.logo.data);
    expect(await pendingChangesOf(server, member)).toEqual([
      {
        field: "logo",
        change: "set",
        value: null,
        submittedAt: expect.any(String),
      },
    ]);
    expect(await logoRevisions(member.accountId)).toEqual([
      { status: "pending_review", proposed: { logo_object_id: rows[1]?.id } },
    ]);
    // the completeness is the one of the validated profile (the logo in force counts)
    const earned = proposed.completeness.blocks
      .flatMap((block) => block.criteria)
      .find((criterion) => criterion.code === "logo");
    expect(earned?.earned).toBe(true);

    // a second deposit replaces the waiting one: its row purging, its object removed at once
    const replaced = brandLogoUploadResponseSchema.parse(
      (await put(server, member, WEBP)).json(),
    );
    expect(replaced.state).toBe("in_review");
    const after = await rowsOf(member.accountId);
    expect(after.map((row) => row.state)).toEqual([
      "active",
      "purging",
      "in_review",
    ]);
    const gone = await store.read("brand-logo", after[1]?.object_key ?? "");
    expect(gone.ok ? gone.value : "storage error").toBeNull();
    expect(
      (await logoRevisions(member.accountId)).map((row) => row.status),
    ).toEqual(["superseded", "pending_review"]);
    const entries = await migration<{ kind: string; state: string }[]>`
      select kind::text as kind, state::text as state
        from profiles.advertiser_review_entries where account_id = ${member.accountId}`;
    expect(entries).toEqual([{ kind: "revision", state: "open" }]);
    // no lead.updated: nothing validated changed
    const [leads] = await migration<{ n: number }[]>`
      select count(*)::int as n from leads.outbox_events
       where subject_key = ${`account:${member.accountId}`} and event_type = 'lead.updated'`;
    expect(leads?.n).toBe(0);
  });

  it("proposes the removal of the logo in force without removing it; a waiting replacement is purged, and a return to the validated state withdraws the proposal", async () => {
    const server = app();
    const member = await newMember("advertiser");
    await put(server, member, GEOTAGGED);
    await publish(member.accountId);
    const [activeRow] = await rowsOf(member.accountId);

    const removal = await call(server, "DELETE", URL_LOGO, member.session);
    expect(removal.statusCode).toBe(200);
    expect(removal.json()).toMatchObject({ removed: false, inReview: true });
    // the logo stays served, its row active and its object in place
    expect((await rowsOf(member.accountId)).map((row) => row.state)).toEqual([
      "active",
    ]);
    expect(
      (await store.read("brand-logo", activeRow?.object_key ?? "")).ok,
    ).toBe(true);
    expect(
      brandLogoResponseSchema.parse(
        (await call(server, "GET", URL_LOGO, member.session)).json(),
      ).logo,
    ).not.toBeNull();
    expect(await pendingChangesOf(server, member)).toEqual([
      {
        field: "logo",
        change: "clear",
        value: null,
        submittedAt: expect.any(String),
      },
    ]);
    expect(await logoRevisions(member.accountId)).toEqual([
      { status: "pending_review", proposed: { logo_object_id: null } },
    ]);

    // a replacement replaces the proposed removal; withdrawing the replacement proposes the removal
    // of the same logo, so deposit then remove leaves the removal pending
    await put(server, member, PNG);
    expect((await pendingChangesOf(server, member))[0]).toMatchObject({
      field: "logo",
      change: "set",
    });
    const again = await call(server, "DELETE", URL_LOGO, member.session);
    expect(again.json()).toMatchObject({ removed: false, inReview: true });
    expect((await rowsOf(member.accountId)).map((row) => row.state)).toEqual([
      "active",
      "purging",
    ]);
  });

  it("proposes a first logo on a published profile that has none, and the removal of that proposal leaves nothing waiting", async () => {
    const server = app();
    const member = await newMember("advertiser");
    await publish(member.accountId);
    const proposed = brandLogoUploadResponseSchema.parse(
      (await put(server, member, GEOTAGGED)).json(),
    );
    expect(proposed.state).toBe("in_review");
    // nothing is served yet: the validated profile has no logo
    const read = brandLogoResponseSchema.parse(
      (await call(server, "GET", URL_LOGO, member.session)).json(),
    );
    expect(read.logo).toBeNull();
    expect(read.pendingLogo?.data).toBe(proposed.logo.data);
    const removal = await call(server, "DELETE", URL_LOGO, member.session);
    expect(removal.json()).toMatchObject({ removed: false, inReview: false });
    expect(await pendingChangesOf(server, member)).toEqual([]);
    expect((await rowsOf(member.accountId)).map((row) => row.state)).toEqual([
      "purging",
    ]);
    expect(
      (await logoRevisions(member.accountId)).map((row) => row.status),
    ).toEqual(["withdrawn"]);
  });
});

describe("T9.8: the daily quota, at its exact frontier (stockage.md §6)", () => {
  async function setUsage(accountId: string, count: number, bytes: number) {
    await migration`
      insert into profiles.storage_daily_usage
        (account_id, bucket_id, usage_day, upload_count, received_bytes)
      values (${accountId}, 'brand-logo', (now() at time zone 'UTC')::date, ${count}, ${bytes})
      on conflict (account_id, bucket_id, usage_day)
        do update set upload_count = excluded.upload_count,
                      received_bytes = excluded.received_bytes`;
  }

  it("accepts the 10th upload of the day, answers 429 to the 11th with Retry-After until UTC midnight", async () => {
    const server = app();
    const member = await newMember("advertiser");
    await setUsage(member.accountId, 9, 0);
    expect((await put(server, member, WEBP)).statusCode).toBe(200);
    const before = secondsUntilNextUtcMidnight(new Date());
    const refused = await put(server, member, WEBP);
    expect(errorOf(refused)).toMatchObject({
      status: 429,
      code: "upload_quota_exceeded",
    });
    const retryAfter = Number(refused.headers["retry-after"]);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(Math.abs(retryAfter - before)).toBeLessThanOrEqual(5);
    expect(await usageOf(member.accountId)).toEqual({
      upload_count: 10,
      received_bytes: WEBP.length,
    });
    expect((await rowsOf(member.accountId)).length).toBe(1);
  });

  it("accepts the bytes up to 20 MiB exactly, refuses one byte beyond", async () => {
    const server = app();
    const member = await newMember("advertiser");
    await setUsage(member.accountId, 0, 20_971_520 - WEBP.length);
    expect((await put(server, member, WEBP)).statusCode).toBe(200);
    const refused = await put(server, member, WEBP);
    expect(errorOf(refused).code).toBe("upload_quota_exceeded");
    expect(await usageOf(member.accountId)).toEqual({
      upload_count: 1,
      received_bytes: 20_971_520,
    });
  });
});

describe("GET and DELETE /v1/me/brand-profile/logo (stockage.md §4; T9.2 as amended by D80)", () => {
  it("relays the logo as JSON, without any host of Supabase, address nor token", async () => {
    const server = app();
    const member = await newMember("advertiser");
    const none = await call(server, "GET", URL_LOGO, member.session);
    expect(none.statusCode).toBe(200);
    expect(none.json()).toEqual({ logo: null });
    const uploaded = (
      await put(server, member, GEOTAGGED)
    ).json() as BrandLogoUploadResponse;
    const response = await call(server, "GET", URL_LOGO, member.session);
    expect(response.statusCode).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const body = brandLogoResponseSchema.parse(response.json());
    expect(body.logo?.data).toBe(uploaded.logo.data);
    const text = response.body;
    for (const forbidden of [
      "http",
      "supabase",
      "54321",
      "storage/v1",
      "token",
      "sign",
      member.accountId,
    ]) {
      expect(text.includes(forbidden), forbidden).toBe(false);
    }
  });

  it("removes the logo: the row purging, the object gone, the criterion lost; a second removal finds none", async () => {
    const server = app();
    const member = await newMember("advertiser");
    expect((await put(server, member, GEOTAGGED)).statusCode).toBe(200);
    const [row] = await rowsOf(member.accountId);
    const removal = await call(server, "DELETE", URL_LOGO, member.session);
    expect(removal.statusCode).toBe(200);
    const body = removal.json() as {
      removed: boolean;
      completeness: BrandLogoUploadResponse["completeness"];
    };
    expect(body.removed).toBe(true);
    expect(
      body.completeness.blocks
        .flatMap((block) => block.criteria)
        .find((criterion) => criterion.code === "logo")?.earned,
    ).toBe(false);
    expect((await rowsOf(member.accountId)).map((r) => r.state)).toEqual([
      "purging",
    ]);
    expect(await store.read("brand-logo", row?.object_key ?? "")).toEqual({
      ok: true,
      value: null,
    });
    expect(
      (await call(server, "GET", URL_LOGO, member.session)).json(),
    ).toEqual({ logo: null });
    const again = await call(server, "DELETE", URL_LOGO, member.session);
    expect((again.json() as { removed: boolean }).removed).toBe(false);
  });
});

describe("T14: the logo of another account is unreachable, a creator meets no route", () => {
  it("leaves brand A's logo out of brand B's reach (read and removal)", async () => {
    const server = app();
    const brandA = await newMember("advertiser");
    const brandB = await newMember("advertiser");
    expect((await put(server, brandA, GEOTAGGED)).statusCode).toBe(200);
    expect(
      (await call(server, "GET", URL_LOGO, brandB.session)).json(),
    ).toEqual({ logo: null });
    const removal = await call(server, "DELETE", URL_LOGO, brandB.session);
    expect((removal.json() as { removed: boolean }).removed).toBe(false);
    expect((await rowsOf(brandA.accountId)).map((r) => r.state)).toEqual([
      "active",
    ]);
  });

  it("answers a creator exactly as an unknown route, for each method (T14.3, T14.4)", async () => {
    const server = app();
    const creator = await newMember("creator");
    const unknown = errorOf(
      await call(
        server,
        "GET",
        "/v1/me/brand-profile/unknown",
        creator.session,
      ),
    );
    for (const response of [
      await call(server, "GET", URL_LOGO, creator.session),
      await put(server, creator, GEOTAGGED),
      await call(server, "DELETE", URL_LOGO, creator.session),
    ]) {
      expect(errorOf(response)).toEqual(unknown);
    }
    expect(await usageOf(creator.accountId)).toBeUndefined();
  });

  it("answers 401 without a session, before reading anything", async () => {
    const server = app();
    for (const response of [
      await call(server, "GET", URL_LOGO, null),
      await call(server, "PUT", URL_LOGO, null, { bytes: GEOTAGGED }),
      await call(server, "DELETE", URL_LOGO, null),
    ]) {
      expect(errorOf(response).status).toBe(401);
    }
  });
});

describe("D60: what the logs keep of a deposit", () => {
  it("names outcomes and sizes, never an account, a key, a name nor an address", () => {
    const text = logStreams.map((read) => read()).join("\n");
    expect(text).toContain("profiles.logo.upload");
    expect(valuesFoundIn(text, watchedValues)).toEqual([]);
    expect(text).not.toMatch(/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp/);
    expect(text.includes("logo-geotagged")).toBe(false);
  });
});

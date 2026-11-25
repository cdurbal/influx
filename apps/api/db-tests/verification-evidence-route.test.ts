// L2E commit 13 — the pieces of a creator's audience request through apps/api, the local stack and its
// REAL Supabase Storage (D82 (1) to (4), (6); docs/mvp/08 RG34, RG35, RG85, CA21, CA22, CA67; 18 T9.2
// as D82 amends it, T9.4, T9.5, T9.8, T9.9, T14; jalons/l2e/modele.md §4, §6): PUT
// /v1/me/verification/requests/:id/evidence and DELETE …/evidence/:evidenceId. The bytes read back
// from Storage are searched for metadata (T9.5: never a flag). Accounts are COMMITTED with their
// sessions (random identifiers, disposable local stack, as verification-route); their pieces, objects
// and open requests are removed after the file. Every log stream is searched BY VALUE (D60): no
// email, handle, account id nor object key.
// L2E-E1 the deposit (T9.5, T9.9, CA22), L2E-E2 refusals of the bytes (T9.4, CA21) and of the body,
// L2E-E3 Storage failing (CA67) and a request leaving draft meanwhile, L2E-E4 the quotas (T9.8), L2E-E5
// the removal, L2E-E6 who may reach the routes (T14), L2E-E7 what an answer and a log carry (T9.2, D60).
import {
  creatorVerificationResponseSchema,
  verificationEvidenceResponseSchema,
  verificationRequestResponseSchema,
  type VerificationEvidenceResponse,
} from "@influx/contracts/verification";
import {
  accountIdOf,
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
import { crc32, deflateSync } from "node:zlib";
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
import { migrationRole, testDataSet } from "./support.ts";

const FIXTURES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../tests/fixtures",
);
/** 600 × 300, EXIF orientation 6, GPS 48°51'29.64"N, device, XMP (tests/images.test.ts). */
const GEOTAGGED = readFileSync(path.join(FIXTURES, "logo-geotagged.jpg"));
/** 400 × 300, EXIF with GPS, XMP, ICC. */
const WEBP = readFileSync(path.join(FIXTURES, "logo-metadata.webp"));
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
  "latin1",
);

const BUCKET = "verification-evidence";
const URL_STATE = "/v1/me/verification";
const URL_REQUESTS = `${URL_STATE}/requests`;
const OCTETS = "application/octet-stream";
const DAILY_BYTES = 67_108_864;
const agentA = accountIdOf("agent", "a");

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
  const email = `l2e-evidence-${role}-${accountId}@example.test`;
  const handle = `handle_${accountId.slice(0, 8)}`;
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
        values (${accountId}, 'instagram', true, ${handle})`;
    }
    await tx`
      insert into identity.terms_acceptances (account_id, terms_version_id, nature, channel, locale)
      values (${accountId}, ${termsId}, 'acceptance', 'signup', 'fr')`;
  });
  accounts.push(accountId);
  watchedValues.push(email, handle, accountId);
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
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  session: string | null,
  body?: { bytes: Buffer; type: string },
): Promise<LightMyRequestResponse> {
  return server.inject({
    method,
    url,
    headers: {
      "x-influx-internal": WEB_SECRET,
      "x-request-id": randomUUID(),
      "sec-fetch-site": "same-origin",
      ...(body === undefined ? {} : { "content-type": body.type }),
      ...(session === null
        ? {}
        : { cookie: `__Host-influx-session=${session}` }),
    },
    ...(body === undefined ? {} : { payload: body.bytes }),
  });
}

function evidenceUrl(requestId: string): string {
  return `${URL_REQUESTS}/${requestId}/evidence`;
}

function put(
  server: Server,
  member: Member,
  requestId: string,
  bytes: Buffer,
  type: string = OCTETS,
) {
  return call(server, "PUT", evidenceUrl(requestId), member.session, {
    bytes,
    type,
  });
}

async function deposit(
  server: Server,
  member: Member,
  requestId: string,
  bytes: Buffer,
): Promise<VerificationEvidenceResponse["evidence"]> {
  const response = await put(server, member, requestId, bytes);
  expect(response.statusCode, response.body).toBe(200);
  return verificationEvidenceResponseSchema.parse(response.json()).evidence;
}

function remove(
  server: Server,
  member: Member,
  requestId: string,
  evidenceId: string,
) {
  return call(
    server,
    "DELETE",
    `${evidenceUrl(requestId)}/${evidenceId}`,
    member.session,
  );
}

/** A draft request of the creator on his Instagram line, through the route. */
async function openRequest(
  server: Server,
  member: Member,
  level: "audience_verified" | "account_verified" = "audience_verified",
): Promise<string> {
  const opened = await server.inject({
    method: "POST",
    url: URL_REQUESTS,
    headers: {
      "x-influx-internal": WEB_SECRET,
      "x-request-id": randomUUID(),
      "sec-fetch-site": "same-origin",
      "content-type": "application/json",
      cookie: `__Host-influx-session=${member.session}`,
    },
    payload: JSON.stringify({ networkCode: "instagram", level }),
  });
  expect(opened.statusCode, opened.body).toBe(200);
  return verificationRequestResponseSchema.parse(opened.json()).request.id;
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

/** The status and body of an error, without its request id (T14.4: the same body). */
function errorBody(response: LightMyRequestResponse) {
  const { status, code, message } = errorOf(response);
  return { status, code, message };
}

type EvidenceRow = {
  id: string;
  request_id: string;
  object_key: string;
  state: string;
  byte_size: number | null;
  width: number | null;
  height: number | null;
};

async function rowsOf(accountId: string): Promise<EvidenceRow[]> {
  return migration<EvidenceRow[]>`
    select id::text as id, request_id::text as request_id, object_key, state::text as state,
           byte_size, width, height
      from verification.evidence_files
     where account_id = ${accountId}
     order by created_at, id`;
}

async function usageOf(
  accountId: string,
): Promise<{ upload_count: number; received_bytes: number } | undefined> {
  const [row] = await migration<
    { upload_count: number; received_bytes: number }[]
  >`
    select upload_count, received_bytes::integer as received_bytes
      from profiles.storage_daily_usage
     where account_id = ${accountId} and bucket_id = ${BUCKET}
       and usage_day = (now() at time zone 'UTC')::date`;
  return row;
}

async function setUsage(accountId: string, count: number, bytes: number) {
  await migration`
    insert into profiles.storage_daily_usage
      (account_id, bucket_id, usage_day, upload_count, received_bytes)
    values (${accountId}, ${BUCKET}, (now() at time zone 'UTC')::date, ${count}, ${bytes})
    on conflict (account_id, bucket_id, usage_day)
      do update set upload_count = excluded.upload_count,
                    received_bytes = excluded.received_bytes`;
}

/**
 * A PNG written byte for byte (sharp is the adapter's only, D80): one colour (distinct shades,
 * distinct checksums), or incompressible noise stored without compression.
 */
async function png(
  width: number,
  height: number,
  shade: number | "noise" = 90,
): Promise<Buffer> {
  const stride = 1 + width * 3;
  const raw =
    shade === "noise"
      ? randomBytes(stride * height)
      : Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0; // filter: none
    if (shade !== "noise") {
      for (let x = 0; x < width; x += 1) {
        raw.set([40, shade, 160], y * stride + 1 + x * 3);
      }
    }
  }
  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits, RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: shade === "noise" ? 0 : 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
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

/** An active « Compte vérifié » of the creator on his line: the prerequisite of a submission (RG12). */
async function grantAccountBadge(member: Member): Promise<void> {
  const [line] = await migration<{ id: string }[]>`
    select id::text from profiles.creator_social_accounts where account_id = ${member.accountId}`;
  const [request] = await migration<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status, created_at, submitted_at,
       sla_due_at, escalate_at, decided_by_account_id, decided_at, closed_at)
    values (${member.accountId}, ${line?.id ?? null}, 'instagram', 'account_verified', 'approved',
            now() - interval '3 hours', now() - interval '3 hours',
            now() - interval '1 hour', now() - interval '1 hour',
            ${agentA}, now() - interval '2 hours', now() - interval '2 hours')
    returning id::text`;
  await migration`
    insert into verification.badges
      (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
       granted_at, evidence_source, observed_handle_at_decision, state)
    values (${member.accountId}, ${line?.id ?? null}, 'instagram', ${request?.id ?? null},
            'account_verified', ${agentA}, now() - interval '2 hours', 'public_profile',
            ${`handle_${member.accountId.slice(0, 8)}`}, 'active')`;
}

beforeAll(async () => {
  migration = migrationRole();
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
  if (accounts.length > 0) {
    const rows = await migration<{ object_key: string }[]>`
      select object_key from verification.evidence_files
       where account_id = any (${accounts}::uuid[])`;
    for (const row of rows) {
      await store.remove(BUCKET, row.object_key);
    }
    await migration`
      delete from verification.evidence_files where account_id = any (${accounts}::uuid[])`;
    // no open request of this file stays in the queue of the shared stack
    await migration`
      update verification.verification_requests
         set status = 'cancelled', cancelled_at = now(), closed_at = now()
       where account_id = any (${accounts}::uuid[]) and status in ('draft', 'pending')`;
    await migration`
      delete from profiles.storage_daily_usage where account_id = any (${accounts}::uuid[])`;
    await migration`
      delete from leads.outbox_events
       where subject_key = any (${accounts.map((id) => `account:${id}`)}::text[])`;
  }
});

describe("L2E-E1 PUT …/evidence: the deposit (D82 (1) to (3); T9.5, T9.9, CA22)", () => {
  it("stores a WebP of the same pixels without any metadata, under the key of the base, never cached", async () => {
    const server = app();
    const member = await newMember("creator");
    const requestId = await openRequest(server, member);
    const response = await put(server, member, requestId, GEOTAGGED);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const { evidence } = verificationEvidenceResponseSchema.parse(
      response.json(),
    );
    // orientation 6 applied, never resized nor cropped
    expect(evidence).toMatchObject({
      state: "active",
      width: 300,
      height: 600,
    });

    // T9.9: the key is the base's, <account>/<request>/<id>.webp, never a name of the client
    const [row] = await rowsOf(member.accountId);
    expect(row).toMatchObject({
      id: evidence.id,
      state: "active",
      object_key: `${member.accountId}/${requestId}/${evidence.id}.webp`,
      byte_size: evidence.byteSize,
      width: 300,
      height: 600,
    });
    // T9.5, CA22: the object read back from Storage, byte for byte, holds no metadata
    const stored = await store.read(BUCKET, row?.object_key ?? "");
    if (!(stored.ok && stored.value !== null)) {
      expect.fail("the object is not in Storage");
    }
    const bytes = Buffer.from(stored.value);
    expect(bytes.length).toBe(evidence.byteSize);
    expectBareWebp(bytes);
    const [checksum] = await migration<{ hex: string }[]>`
      select encode(checksum, 'hex') as hex from verification.evidence_files
       where id = ${evidence.id}`;
    expect(checksum?.hex).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
    expect(await usageOf(member.accountId)).toEqual({
      upload_count: 1,
      received_bytes: GEOTAGGED.length,
    });

    // the owner reads the metadata of his piece on his line, never its key nor its bytes
    const state = await call(server, "GET", URL_STATE, member.session);
    const lines = creatorVerificationResponseSchema.parse(state.json()).lines;
    expect(lines[0]?.requests[0]?.evidence).toEqual([evidence]);
  });

  it("reads more than the 2 MiB of every other deposit, up to 8 MiB (D82 (1))", async () => {
    const server = app();
    const member = await newMember("creator");
    const requestId = await openRequest(server, member);
    // incompressible pixels: a PNG of about 7.8 MiB
    const noise = await png(1700, 1600, "noise");
    expect(noise.length).toBeGreaterThan(2_097_152);
    expect(noise.length).toBeLessThanOrEqual(8_388_608);
    const evidence = await deposit(server, member, requestId, noise);
    expect([evidence.width, evidence.height]).toEqual([1700, 1600]);
  });

  it("replaces the same piece deposited again: the former one purging, its object removed at once", async () => {
    const server = app();
    const member = await newMember("creator");
    const requestId = await openRequest(server, member);
    const first = await deposit(server, member, requestId, WEBP);
    const [former] = await rowsOf(member.accountId);
    const second = await deposit(server, member, requestId, WEBP);
    const other = await deposit(server, member, requestId, GEOTAGGED);
    expect(
      (await rowsOf(member.accountId)).map((row) => [row.id, row.state]),
    ).toEqual([
      [first.id, "purging"],
      [second.id, "active"],
      [other.id, "active"],
    ]);
    expect(await store.read(BUCKET, former?.object_key ?? "")).toEqual({
      ok: true,
      value: null,
    });
  });
});

describe("L2E-E2 what is refused before anything is stored (T9.4, CA21; D82 (1), (2))", () => {
  it("refuses a PDF and bytes contradicting their signature, 422 with the reason, the row forgotten, the attempt counted (T9.4, CA21)", async () => {
    const server = app();
    const member = await newMember("creator");
    const requestId = await openRequest(server, member);
    expect(errorOf(await put(server, member, requestId, PDF))).toEqual({
      status: 422,
      code: "image_rejected",
      message: "The image is refused",
      details: [{ path: "evidence", issue: "unsupported_type" }],
    });
    const contrary = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      GEOTAGGED,
    ]);
    expect(errorOf(await put(server, member, requestId, contrary)).code).toBe(
      "image_rejected",
    );
    expect(
      errorOf(await put(server, member, requestId, await png(319, 200)))
        .details,
    ).toEqual([{ path: "evidence", issue: "too_small" }]);
    expect(await rowsOf(member.accountId)).toEqual([]);
    expect(await usageOf(member.accountId)).toEqual({
      upload_count: 3,
      received_bytes:
        PDF.length + contrary.length + (await png(319, 200)).length,
    });
  });

  it("reads the raw bytes only: a declared JSON, image or form type is refused, an empty body named so", async () => {
    const server = app();
    const member = await newMember("creator");
    const requestId = await openRequest(server, member);
    for (const type of [
      "application/json",
      "image/jpeg",
      "multipart/form-data; boundary=x",
    ]) {
      const response = await put(server, member, requestId, GEOTAGGED, type);
      expect(response.statusCode, type).toBe(400);
      expect(errorOf(response).code).toBe("validation_failed");
    }
    const empty = await call(
      server,
      "PUT",
      evidenceUrl(requestId),
      member.session,
    );
    expect(errorOf(empty)).toMatchObject({
      status: 422,
      code: "image_rejected",
      details: [{ path: "evidence", issue: "empty" }],
    });
    expect(await usageOf(member.accountId)).toBeUndefined();
  });

  it("refuses a body over 8 MiB with 413 before any count, and a piece on an account request", async () => {
    const server = app();
    const member = await newMember("creator");
    const requestId = await openRequest(server, member);
    const over = await put(
      server,
      member,
      requestId,
      Buffer.alloc(8_388_609, 0x61),
    );
    expect(errorOf(over)).toMatchObject({
      status: 413,
      code: "payload_too_large",
    });
    const account = await openRequest(server, member, "account_verified");
    const refused = await put(server, member, account, GEOTAGGED);
    expect(errorOf(refused)).toMatchObject({
      status: 400,
      code: "validation_failed",
      details: [{ path: "level", issue: "invalid_level" }],
    });
    expect(await usageOf(member.accountId)).toBeUndefined();
  });
});

describe("L2E-E3 a deposit that fails loses nothing else (CA67; 08 edge case 5; EC-L2E-07-4)", () => {
  it("keeps the row purging and answers 503 when Storage refuses the write; the other piece and the request stay (CA67)", async () => {
    const server = app();
    const member = await newMember("creator");
    const requestId = await openRequest(server, member);
    const kept = await deposit(server, member, requestId, WEBP);
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
    const response = await put(app(failing), member, requestId, GEOTAGGED);
    expect(errorOf(response)).toMatchObject({
      status: 503,
      code: "service_unavailable",
    });
    expect((await rowsOf(member.accountId)).map((row) => row.state)).toEqual([
      "active",
      "purging",
    ]);
    const state = await call(server, "GET", URL_STATE, member.session);
    const request = creatorVerificationResponseSchema.parse(state.json())
      .lines[0]?.requests[0];
    expect(request).toMatchObject({ id: requestId, status: "draft" });
    expect(request?.evidence).toEqual([kept]);
  });

  it("fails a deposit whose request left draft meanwhile: 409, the row purging, the object gone", async () => {
    const member = await newMember("creator");
    const requestId = await openRequest(app(), member);
    let writtenKey = "";
    const cancelling: ObjectStore = {
      ...store,
      async write(bucket, key, bytes, contentType) {
        writtenKey = key;
        const written = await store.write(bucket, key, bytes, contentType);
        await migration`
          update verification.verification_requests
             set status = 'cancelled', cancelled_at = now(), closed_at = now()
           where id = ${requestId}`;
        return written;
      },
    };
    const response = await put(app(cancelling), member, requestId, GEOTAGGED);
    expect(errorOf(response)).toMatchObject({
      status: 409,
      code: "conflict",
      details: [{ path: "request", issue: "request_not_draft" }],
    });
    expect((await rowsOf(member.accountId)).map((row) => row.state)).toEqual([
      "purging",
    ]);
    expect(writtenKey).not.toBe("");
    expect(await store.read(BUCKET, writtenKey)).toEqual({
      ok: true,
      value: null,
    });
  });
});

describe("L2E-E4 the quotas, at their exact frontiers (T9.8; 08 RG34; D82 (4))", () => {
  it("accepts the sixth piece of a request, refuses a seventh with evidence_cap and no delay", async () => {
    const server = app();
    const member = await newMember("creator");
    const requestId = await openRequest(server, member);
    for (let index = 0; index < 6; index += 1) {
      await deposit(
        server,
        member,
        requestId,
        await png(400, 400, 10 + index * 40),
      );
    }
    const refused = await put(
      server,
      member,
      requestId,
      await png(400, 400, 255),
    );
    expect(errorOf(refused)).toMatchObject({
      status: 409,
      code: "conflict",
      details: [{ path: "request", issue: "evidence_cap" }],
    });
    expect(refused.headers["retry-after"]).toBeUndefined();
    expect((await rowsOf(member.accountId)).length).toBe(6);
  });

  it("accepts the 18th deposit of the day, answers 429 to the 19th with Retry-After until UTC midnight", async () => {
    const server = app();
    const member = await newMember("creator");
    const requestId = await openRequest(server, member);
    await setUsage(member.accountId, 17, 0);
    await deposit(server, member, requestId, WEBP);
    const before = secondsUntilNextUtcMidnight(new Date());
    const refused = await put(server, member, requestId, GEOTAGGED);
    expect(errorOf(refused)).toMatchObject({
      status: 429,
      code: "upload_quota_exceeded",
    });
    const retryAfter = Number(refused.headers["retry-after"]);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(Math.abs(retryAfter - before)).toBeLessThanOrEqual(5);
    expect(await usageOf(member.accountId)).toEqual({
      upload_count: 18,
      received_bytes: WEBP.length,
    });
  });

  it("accepts the bytes up to 64 MiB exactly, refuses one byte beyond", async () => {
    const server = app();
    const member = await newMember("creator");
    const requestId = await openRequest(server, member);
    await setUsage(member.accountId, 0, DAILY_BYTES - WEBP.length);
    await deposit(server, member, requestId, WEBP);
    const refused = await put(server, member, requestId, WEBP);
    expect(errorOf(refused).code).toBe("upload_quota_exceeded");
    expect(await usageOf(member.accountId)).toEqual({
      upload_count: 1,
      received_bytes: DAILY_BYTES,
    });
  });
});

describe("L2E-E5 DELETE …/evidence/:evidenceId: a piece withdrawn before the submission", () => {
  it("withdraws the piece: the row purging, the object gone, the request answered without it; a second removal writes nothing", async () => {
    const server = app();
    const member = await newMember("creator");
    const requestId = await openRequest(server, member);
    const kept = await deposit(server, member, requestId, WEBP);
    const withdrawn = await deposit(server, member, requestId, GEOTAGGED);
    const [, row] = await rowsOf(member.accountId);
    const response = await remove(server, member, requestId, withdrawn.id);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const body = verificationRequestResponseSchema.parse(response.json());
    expect(body.created).toBe(false);
    expect(body.request.evidence).toEqual([kept]);
    expect(await store.read(BUCKET, row?.object_key ?? "")).toEqual({
      ok: true,
      value: null,
    });
    const again = await remove(server, member, requestId, withdrawn.id);
    expect(again.statusCode).toBe(200);
    expect((await rowsOf(member.accountId)).map((r) => r.state)).toEqual([
      "active",
      "purging",
    ]);
  });

  it("refuses to deposit or withdraw once the request is submitted (EC-L2E-07-4: the pieces are fixed)", async () => {
    const server = app();
    const member = await newMember("creator");
    await grantAccountBadge(member);
    const requestId = await openRequest(server, member);
    const piece = await deposit(server, member, requestId, WEBP);
    const submitted = await call(
      server,
      "POST",
      `${URL_REQUESTS}/${requestId}/submit`,
      member.session,
    );
    expect(submitted.statusCode, submitted.body).toBe(200);
    for (const response of [
      await remove(server, member, requestId, piece.id),
      await put(server, member, requestId, GEOTAGGED),
    ]) {
      expect(errorOf(response)).toMatchObject({
        status: 409,
        details: [{ path: "request", issue: "request_not_draft" }],
      });
    }
    expect((await rowsOf(member.accountId)).map((r) => r.state)).toEqual([
      "active",
    ]);
  });
});

describe("L2E-E6 who may reach the routes (18 T14.1 to T14.4)", () => {
  it("answers another creator's request and piece, and a piece of another request, as an unknown address", async () => {
    const server = app();
    const owner = await newMember("creator");
    const stranger = await newMember("creator");
    const ownerRequest = await openRequest(server, owner);
    const piece = await deposit(server, owner, ownerRequest, WEBP);
    const strangerRequest = await openRequest(server, stranger);
    const unknown = errorBody(
      await call(server, "GET", `${URL_STATE}/unknown`, stranger.session),
    );
    for (const response of [
      await put(server, stranger, ownerRequest, GEOTAGGED),
      await put(server, stranger, randomUUID(), GEOTAGGED),
      await remove(server, stranger, ownerRequest, piece.id),
      await remove(server, stranger, strangerRequest, piece.id),
      await remove(server, owner, ownerRequest, randomUUID()),
    ]) {
      expect(errorBody(response)).toEqual(unknown);
    }
    // the owner's piece, named under another of his requests: unknown too
    const otherRequest = await openRequest(server, owner, "account_verified");
    expect(
      errorBody(await remove(server, owner, otherRequest, piece.id)),
    ).toEqual(unknown);
    expect((await rowsOf(owner.accountId)).map((r) => r.state)).toEqual([
      "active",
    ]);
    expect(await usageOf(stranger.accountId)).toBeUndefined();
  });

  it("answers a brand exactly as an unknown route, for each method (T14.3, T14.4), and 401 without a session", async () => {
    const server = app();
    const brand = await newMember("advertiser");
    const unknown = errorBody(
      await call(server, "GET", `${URL_STATE}/unknown`, brand.session),
    );
    const requestId = randomUUID();
    for (const response of [
      await put(server, brand, requestId, GEOTAGGED),
      await remove(server, brand, requestId, randomUUID()),
    ]) {
      expect(errorBody(response)).toEqual(unknown);
    }
    expect(await usageOf(brand.accountId)).toBeUndefined();
    for (const response of [
      await call(server, "PUT", evidenceUrl(requestId), null, {
        bytes: GEOTAGGED,
        type: OCTETS,
      }),
      await call(
        server,
        "DELETE",
        `${evidenceUrl(requestId)}/${randomUUID()}`,
        null,
      ),
    ]) {
      expect(errorOf(response).status).toBe(401);
    }
  });
});

describe("L2E-E7 what an answer and a log carry (T9.2 as D82 amends it; D60, invariant 17)", () => {
  it("answers the deposit, the removal and the state without any key, host of Supabase, address nor token", async () => {
    const server = app();
    const member = await newMember("creator");
    const requestId = await openRequest(server, member);
    const deposited = await put(server, member, requestId, GEOTAGGED);
    const { evidence } = verificationEvidenceResponseSchema.parse(
      deposited.json(),
    );
    const state = await call(server, "GET", URL_STATE, member.session);
    const removed = await remove(server, member, requestId, evidence.id);
    for (const response of [deposited, state, removed]) {
      for (const forbidden of [
        "http",
        "supabase",
        "54321",
        "storage/v1",
        "token",
        "sign",
        ".webp",
        "checksum",
        member.accountId,
      ]) {
        expect(response.body.includes(forbidden), forbidden).toBe(false);
      }
    }
  });

  it("names outcomes and sizes in the logs, never an account, a key, a handle nor a name", () => {
    const text = logStreams.map((read) => read()).join("\n");
    expect(text).toContain("verification.evidence.upload");
    expect(text).toContain("verification.evidence.remove");
    expect(valuesFoundIn(text, watchedValues)).toEqual([]);
    expect(text).not.toMatch(
      /[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp/,
    );
    expect(text.includes("logo-geotagged")).toBe(false);
  });
});

// L2G commit 07 — the portfolio of a creator through apps/api, the local stack and its REAL Supabase
// Storage (D82 (7); docs/mvp/07 RG77 to RG84, RG9, CA44; 18 T9.2 as D82 amends it, T9.3, T9.4, T9.5,
// T9.8, T9.9, T14; jalons/l2g/modele.md points 3, 4, 10): GET, PUT /v1/me/creator-profile/portfolio
// (?replaces=<uuid>), PUT …/order, PATCH and DELETE …/:id, GET …/:id/image. The bytes read back from
// Storage are searched for metadata (T9.5: never a flag). Accounts are COMMITTED with their sessions
// (random identifiers, disposable local stack, as verification-evidence-route); their visuals are
// withdrawn and their objects removed after the file. Every log stream is searched BY VALUE (D60):
// no email, handle, account id, object key nor caption.
// L2G-P1 the deposit and the replacement (T9.5, T9.9, RG81), L2G-P2 refusals of the bytes (T9.4) and of
// the body, L2G-P3 Storage failing, L2G-P4 the places and the quotas (RG77, T9.8), L2G-P5 caption,
// RG83, order and removal (RG82 to RG84, RG9), L2G-P6 who may reach the routes (T14.1 to T14.4),
// L2G-P7 what an answer and a log carry (T9.2, D60).
import {
  portfolioCaptionResponseSchema,
  portfolioImageResponseSchema,
  portfolioRemovalResponseSchema,
  portfolioResponseSchema,
  portfolioUploadResponseSchema,
  type PortfolioUploadResponse,
} from "@influx/contracts/creator-portfolio";
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

const BUCKET = "portfolio";
const URL_PORTFOLIO = "/v1/me/creator-profile/portfolio";
const OCTETS = "application/octet-stream";
const DAILY_BYTES = 67_108_864;
const CAPTION = "Shooting d'automne, lumière naturelle (L2G-07-légende)";
const agentA = accountIdOf("agent", "a");

let database: ApiDatabase;
let migration: postgres.Sql;
let store: ObjectStore;
let termsId: string;
const accounts: string[] = [];
const watchedValues: string[] = [CAPTION];
const logStreams: (() => string)[] = [];

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

type Member = { accountId: string; session: string };

async function newMember(role: "advertiser" | "creator"): Promise<Member> {
  const accountId = randomUUID();
  const email = `l2g-portfolio-${role}-${accountId}@example.test`;
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
  method: "GET" | "PUT" | "PATCH" | "DELETE",
  url: string,
  session: string | null,
  body?: { bytes: Buffer | string; type: string },
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

function json(value: unknown) {
  return { bytes: JSON.stringify(value), type: "application/json" };
}

function put(
  server: Server,
  member: Member,
  bytes: Buffer,
  options: { replaces?: string; type?: string } = {},
) {
  const query =
    options.replaces === undefined ? "" : `?replaces=${options.replaces}`;
  return call(server, "PUT", `${URL_PORTFOLIO}${query}`, member.session, {
    bytes,
    type: options.type ?? OCTETS,
  });
}

async function deposit(
  server: Server,
  member: Member,
  bytes: Buffer,
  replaces?: string,
): Promise<PortfolioUploadResponse> {
  const response = await put(
    server,
    member,
    bytes,
    replaces === undefined ? {} : { replaces },
  );
  expect(response.statusCode, response.body).toBe(200);
  return portfolioUploadResponseSchema.parse(response.json());
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

type ItemRow = {
  id: string;
  object_key: string;
  state: string;
  display_order: number | null;
  byte_size: number | null;
  width: number | null;
  height: number | null;
  checksum: string | null;
  exif_stripped: boolean;
};

async function rowsOf(accountId: string): Promise<ItemRow[]> {
  return migration<ItemRow[]>`
    select id::text as id, object_key, state::text as state, display_order, byte_size, width,
           height, checksum, exif_stripped
      from profiles.portfolio_items
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

/** The decision of 0244, written directly: approved (or refused) by agent A. */
async function decide(
  itemId: string,
  decision: "approved" | "rejected" = "approved",
): Promise<void> {
  await migration`
    update profiles.portfolio_items
       set state = ${decision}::profiles.portfolio_item_state,
           decided_by_account_id = ${agentA}, decided_at = now(),
           rejection_reason_code = ${decision === "rejected" ? "watermark" : null}
     where id = ${itemId}`;
}

/** The decision of 0244 on the profile, written directly. */
async function publish(member: Member): Promise<void> {
  await migration`
    update profiles.creator_public_profiles set status = 'published', published_at = now()
     where account_id = ${member.accountId}`;
}

/**
 * A PNG written byte for byte (sharp is the adapter's only, D80): one colour (distinct shades,
 * distinct checksums), or incompressible noise stored without compression.
 */
function png(
  width: number,
  height: number,
  shade: number | "noise" = 90,
): Buffer {
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
      select object_key from profiles.portfolio_items
       where account_id = any (${accounts}::uuid[])`;
    for (const row of rows) {
      await store.remove(BUCKET, row.object_key);
    }
    // no visual of this file stays in queue 3 of the shared stack, no entry in queue 2
    await migration`
      update profiles.portfolio_items set state = 'purging'
       where account_id = any (${accounts}::uuid[]) and state = 'uploading'`;
    await migration`
      update profiles.portfolio_items set state = 'withdrawn'
       where account_id = any (${accounts}::uuid[]) and state in ('pending', 'approved')`;
    await migration`
      update profiles.creator_review_entries set state = 'withdrawn', closed_at = now()
       where account_id = any (${accounts}::uuid[]) and state = 'open'`;
    await migration`
      delete from profiles.storage_daily_usage where account_id = any (${accounts}::uuid[])`;
    await migration`
      delete from leads.outbox_events
       where subject_key = any (${accounts.map((id) => `account:${id}`)}::text[])`;
  }
});

describe("L2G-P1 PUT …/portfolio: the deposit and the replacement (D82 (7); RG80, RG81; T9.5, T9.9)", () => {
  it("stores a WebP of the same pixels without any metadata, under the key of the base, pending and placed, never cached", async () => {
    const server = app();
    const member = await newMember("creator");
    const response = await put(server, member, GEOTAGGED);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const answer = portfolioUploadResponseSchema.parse(response.json());
    // orientation 6 applied, never resized nor cropped
    expect(answer.item).toMatchObject({
      state: "pending",
      displayOrder: 1,
      caption: null,
      brandDeclared: false,
      width: 300,
      height: 600,
      replacesItemId: null,
      replacementPending: false,
      captionPending: false,
      reasonCode: null,
      deleteAfter: null,
      decidedAt: null,
    });
    expect(answer.deposited).toBe(1);

    // T9.9: the key is the base's, <account>/<id>.webp, never a name of the client
    const [row] = await rowsOf(member.accountId);
    expect(row).toMatchObject({
      id: answer.item.id,
      state: "pending",
      object_key: `${member.accountId}/${answer.item.id}.webp`,
      byte_size: answer.item.byteSize,
      exif_stripped: true,
    });
    // T9.5: the object read back from Storage, byte for byte, holds no metadata
    const stored = await store.read(BUCKET, row?.object_key ?? "");
    if (!(stored.ok && stored.value !== null)) {
      expect.fail("the object is not in Storage");
    }
    const bytes = Buffer.from(stored.value);
    expect(bytes.length).toBe(answer.item.byteSize);
    expectBareWebp(bytes);
    expect(row?.checksum).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
    expect(await usageOf(member.accountId)).toEqual({
      upload_count: 1,
      received_bytes: GEOTAGGED.length,
    });

    // the owner lists it and reads its bytes back through the route, the same ones (T9.5)
    const listed = portfolioResponseSchema.parse(
      (await call(server, "GET", URL_PORTFOLIO, member.session)).json(),
    );
    expect(listed).toEqual({ items: [answer.item], deposited: 1 });
    const image = await call(
      server,
      "GET",
      `${URL_PORTFOLIO}/${answer.item.id}/image`,
      member.session,
    );
    expect(image.statusCode, image.body).toBe(200);
    expect(image.headers["cache-control"]).toBe("no-store");
    const relayed = portfolioImageResponseSchema.parse(image.json());
    expect(relayed).toMatchObject({
      contentType: "image/webp",
      width: 300,
      height: 600,
      byteSize: bytes.length,
    });
    expect(Buffer.from(relayed.data, "base64").equals(bytes)).toBe(true);
  });

  it("reads more than the 2 MiB of every other deposit, up to 8 MiB (D82 (7))", async () => {
    const server = app();
    const member = await newMember("creator");
    // incompressible pixels: a PNG of about 7.8 MiB
    const noise = png(1700, 1600, "noise");
    expect(noise.length).toBeGreaterThan(2_097_152);
    expect(noise.length).toBeLessThanOrEqual(8_388_608);
    const { item } = await deposit(server, member, noise);
    expect([item.width, item.height]).toEqual([1700, 1600]);
  });

  it("replaces an approved visual: the new one pending in its place, the original served until the decision (RG81, CA44)", async () => {
    const server = app();
    const member = await newMember("creator");
    const original = await deposit(server, member, WEBP);
    await decide(original.item.id);
    const replacement = await deposit(
      server,
      member,
      GEOTAGGED,
      original.item.id.toUpperCase(),
    );
    expect(replacement.item).toMatchObject({
      state: "pending",
      displayOrder: null,
      replacesItemId: original.item.id,
    });
    // a replacement shares the place of its original (RG4, RG88)
    expect(replacement.deposited).toBe(1);
    const listed = portfolioResponseSchema.parse(
      (await call(server, "GET", URL_PORTFOLIO, member.session)).json(),
    );
    expect(listed.items.map((item) => [item.id, item.state])).toEqual([
      [original.item.id, "approved"],
      [replacement.item.id, "pending"],
    ]);
    expect(listed.items[0]).toMatchObject({
      displayOrder: 1,
      replacementPending: true,
    });

    // one replacement at a time; a pending visual is not replaceable; another's is unknown
    const again = await put(server, member, WEBP, {
      replaces: original.item.id,
    });
    expect(errorOf(again)).toMatchObject({
      status: 409,
      code: "conflict",
      details: [{ path: "replaces", issue: "replacement_pending" }],
    });
    const pending = await put(server, member, WEBP, {
      replaces: replacement.item.id,
    });
    expect(errorOf(pending)).toMatchObject({
      status: 409,
      details: [{ path: "replaces", issue: "not_replaceable" }],
    });
    expect((await rowsOf(member.accountId)).length).toBe(2);
  });
});

describe("L2G-P2 what is refused before anything is stored (T9.4; D82 (7))", () => {
  it("refuses a PDF, bytes contradicting their signature and a visual under 320 px, 422 with the reason, the row forgotten, the attempt counted", async () => {
    const server = app();
    const member = await newMember("creator");
    expect(errorOf(await put(server, member, PDF))).toEqual({
      status: 422,
      code: "image_rejected",
      message: "The image is refused",
      details: [{ path: "portfolio", issue: "unsupported_type" }],
    });
    const contrary = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      GEOTAGGED,
    ]);
    expect(errorOf(await put(server, member, contrary)).code).toBe(
      "image_rejected",
    );
    const small = png(319, 200);
    expect(errorOf(await put(server, member, small)).details).toEqual([
      { path: "portfolio", issue: "too_small" },
    ]);
    expect(await rowsOf(member.accountId)).toEqual([]);
    expect(await usageOf(member.accountId)).toEqual({
      upload_count: 3,
      received_bytes: PDF.length + contrary.length + small.length,
    });
  });

  it("reads the raw bytes only: a declared JSON, image or form type is refused, an empty body named so, an unknown query refused", async () => {
    const server = app();
    const member = await newMember("creator");
    for (const type of [
      "application/json",
      "image/jpeg",
      "multipart/form-data; boundary=x",
    ]) {
      const response = await put(server, member, GEOTAGGED, { type });
      expect(response.statusCode, type).toBe(400);
      expect(errorOf(response).code).toBe("validation_failed");
    }
    const empty = await call(server, "PUT", URL_PORTFOLIO, member.session);
    expect(errorOf(empty)).toMatchObject({
      status: 422,
      code: "image_rejected",
      details: [{ path: "portfolio", issue: "empty" }],
    });
    for (const query of ["?name=photo.jpg", "?replaces=photo.jpg"]) {
      const refused = await call(
        server,
        "PUT",
        `${URL_PORTFOLIO}${query}`,
        member.session,
        { bytes: GEOTAGGED, type: OCTETS },
      );
      expect(errorOf(refused).status, query).toBe(400);
    }
    expect(await usageOf(member.accountId)).toBeUndefined();
  });

  it("refuses a body over 8 MiB with 413 before any count", async () => {
    const server = app();
    const member = await newMember("creator");
    const over = await put(server, member, Buffer.alloc(8_388_609, 0x61));
    expect(errorOf(over)).toMatchObject({
      status: 413,
      code: "payload_too_large",
    });
    expect(await usageOf(member.accountId)).toBeUndefined();
  });
});

describe("L2G-P3 a deposit that fails loses nothing else (D80 (5))", () => {
  it("keeps the row purging and answers 503 when Storage refuses the write; the other visual stays, the failed one is not listed", async () => {
    const server = app();
    const member = await newMember("creator");
    const kept = await deposit(server, member, WEBP);
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
    const response = await put(app(failing), member, GEOTAGGED);
    expect(errorOf(response)).toMatchObject({
      status: 503,
      code: "service_unavailable",
    });
    expect((await rowsOf(member.accountId)).map((row) => row.state)).toEqual([
      "pending",
      "purging",
    ]);
    const listed = portfolioResponseSchema.parse(
      (await call(server, "GET", URL_PORTFOLIO, member.session)).json(),
    );
    expect(listed).toEqual({ items: [kept.item], deposited: 1 });
  });

  it("fails a replacement whose original was withdrawn meanwhile: 409, the row purging, the object gone", async () => {
    const member = await newMember("creator");
    const original = await deposit(app(), member, WEBP);
    await decide(original.item.id);
    let writtenKey = "";
    const withdrawing: ObjectStore = {
      ...store,
      async write(bucket, key, bytes, contentType) {
        writtenKey = key;
        const written = await store.write(bucket, key, bytes, contentType);
        await migration`
          update profiles.portfolio_items set state = 'withdrawn' where id = ${original.item.id}`;
        return written;
      },
    };
    const response = await put(app(withdrawing), member, GEOTAGGED, {
      replaces: original.item.id,
    });
    expect(errorOf(response)).toMatchObject({
      status: 409,
      code: "conflict",
      details: [{ path: "replaces", issue: "not_replaceable" }],
    });
    expect((await rowsOf(member.accountId)).map((row) => row.state)).toEqual([
      "withdrawn",
      "purging",
    ]);
    expect(writtenKey).not.toBe("");
    expect(await store.read(BUCKET, writtenKey)).toEqual({
      ok: true,
      value: null,
    });
  });
});

describe("L2G-P4 the places and the quotas, at their exact frontiers (RG77; T9.8; modele point 4)", () => {
  it("accepts the eighth visual, refuses a ninth with portfolio_full and no delay", async () => {
    const server = app();
    const member = await newMember("creator");
    for (let index = 0; index < 8; index += 1) {
      const { item, deposited } = await deposit(
        server,
        member,
        png(400, 400, 10 + index * 30),
      );
      expect([item.displayOrder, deposited]).toEqual([index + 1, index + 1]);
    }
    const refused = await put(server, member, png(400, 400, 255));
    expect(errorOf(refused)).toMatchObject({
      status: 409,
      code: "conflict",
      details: [{ path: "portfolio", issue: "portfolio_full" }],
    });
    expect(refused.headers["retry-after"]).toBeUndefined();
    expect((await rowsOf(member.accountId)).length).toBe(8);
  });

  it("accepts the 16th deposit of the day, answers 429 to the 17th with Retry-After until UTC midnight", async () => {
    const server = app();
    const member = await newMember("creator");
    await setUsage(member.accountId, 15, 0);
    await deposit(server, member, WEBP);
    const before = secondsUntilNextUtcMidnight(new Date());
    const refused = await put(server, member, GEOTAGGED);
    expect(errorOf(refused)).toMatchObject({
      status: 429,
      code: "upload_quota_exceeded",
    });
    const retryAfter = Number(refused.headers["retry-after"]);
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(Math.abs(retryAfter - before)).toBeLessThanOrEqual(5);
    expect(await usageOf(member.accountId)).toEqual({
      upload_count: 16,
      received_bytes: WEBP.length,
    });
  });

  it("accepts the bytes up to 64 MiB exactly, refuses one byte beyond", async () => {
    const server = app();
    const member = await newMember("creator");
    await setUsage(member.accountId, 0, DAILY_BYTES - WEBP.length);
    await deposit(server, member, WEBP);
    const refused = await put(server, member, WEBP);
    expect(errorOf(refused).code).toBe("upload_quota_exceeded");
    expect(await usageOf(member.accountId)).toEqual({
      upload_count: 1,
      received_bytes: DAILY_BYTES,
    });
  });
});

describe("L2G-P5 caption, RG83, order and removal (RG82 to RG84, RG9, RG77; Q9)", () => {
  it("sets a caption and its declaration, dated and kept; refuses a box without caption, 201 characters, a control character", async () => {
    const server = app();
    const member = await newMember("creator");
    const { item } = await deposit(server, member, WEBP);
    const url = `${URL_PORTFOLIO}/${item.id}`;
    const response = await call(
      server,
      "PATCH",
      url,
      member.session,
      json({ caption: CAPTION, brandDeclared: true }),
    );
    expect(response.statusCode, response.body).toBe(200);
    const answer = portfolioCaptionResponseSchema.parse(response.json());
    expect(answer).toMatchObject({
      revisionStatus: "applied",
      item: { id: item.id, caption: CAPTION, brandDeclared: true },
    });
    const declarations = await migration<
      { caption: string; statement_key: string }[]
    >`
      select caption, statement_key from profiles.portfolio_brand_declarations
       where portfolio_item_id = ${item.id}`;
    expect(declarations).toEqual([
      {
        caption: CAPTION,
        statement_key: "creatorProfile.portfolio.brandConsent",
      },
    ]);
    for (const body of [
      { caption: null, brandDeclared: true },
      { caption: "x".repeat(201), brandDeclared: false },
      { caption: "ligne\u0007", brandDeclared: false },
      { caption: "   ", brandDeclared: false },
    ]) {
      const refused = await call(
        server,
        "PATCH",
        url,
        member.session,
        json(body),
      );
      expect(errorOf(refused).status, JSON.stringify(body)).toBe(400);
    }
    // removed: no caption, no declaration in force (the statement made stays kept)
    const cleared = portfolioCaptionResponseSchema.parse(
      (
        await call(
          server,
          "PATCH",
          url,
          member.session,
          json({ caption: null, brandDeclared: false }),
        )
      ).json(),
    );
    expect(cleared.item).toMatchObject({ caption: null, brandDeclared: false });
  });

  it("on a published profile, the caption of an approved visual waits in a revision, the validated one shown (RG9, CA48)", async () => {
    const server = app();
    const member = await newMember("creator");
    const { item } = await deposit(server, member, WEBP);
    const url = `${URL_PORTFOLIO}/${item.id}`;
    await call(
      server,
      "PATCH",
      url,
      member.session,
      json({ caption: "Première légende", brandDeclared: false }),
    );
    await decide(item.id);
    await publish(member);
    const revised = portfolioCaptionResponseSchema.parse(
      (
        await call(
          server,
          "PATCH",
          url,
          member.session,
          json({ caption: CAPTION, brandDeclared: false }),
        )
      ).json(),
    );
    expect(revised).toMatchObject({
      revisionStatus: "pending_review",
      item: { caption: "Première légende", captionPending: true },
    });
    // back to the validated caption: the revision withdrawn, nothing pending
    const back = portfolioCaptionResponseSchema.parse(
      (
        await call(
          server,
          "PATCH",
          url,
          member.session,
          json({ caption: "Première légende", brandDeclared: false }),
        )
      ).json(),
    );
    expect(back).toMatchObject({
      revisionStatus: "applied",
      item: { caption: "Première légende", captionPending: false },
    });
  });

  it("orders the placed visuals as given, each once; refuses a list missing one or naming another's", async () => {
    const server = app();
    const member = await newMember("creator");
    const stranger = await newMember("creator");
    const ids: string[] = [];
    for (const shade of [20, 120, 220]) {
      ids.push((await deposit(server, member, png(400, 400, shade))).item.id);
    }
    const foreign = (await deposit(server, stranger, WEBP)).item.id;
    const reversed = [...ids].reverse();
    const response = await call(
      server,
      "PUT",
      `${URL_PORTFOLIO}/order`,
      member.session,
      json({ itemIds: reversed }),
    );
    expect(response.statusCode, response.body).toBe(200);
    const answer = portfolioResponseSchema.parse(response.json());
    expect(answer.items.map((item) => [item.id, item.displayOrder])).toEqual(
      reversed.map((id, index) => [id, index + 1]),
    );
    for (const itemIds of [
      ids.slice(0, 2),
      [ids[0], ids[1], foreign],
      [ids[0], ids[0], ids[1]],
    ]) {
      const refused = await call(
        server,
        "PUT",
        `${URL_PORTFOLIO}/order`,
        member.session,
        json({ itemIds }),
      );
      expect(errorOf(refused).status).toBe(400);
    }
  });

  it("withdraws a visual, its object kept 30 days; a second removal writes nothing; a published profile keeps three (RG77, Q9)", async () => {
    const server = app();
    const member = await newMember("creator");
    const ids: string[] = [];
    for (const shade of [30, 130, 230, 60]) {
      ids.push((await deposit(server, member, png(400, 400, shade))).item.id);
    }
    const removed = await call(
      server,
      "DELETE",
      `${URL_PORTFOLIO}/${ids[3]}`,
      member.session,
    );
    expect(removed.statusCode, removed.body).toBe(200);
    expect(portfolioRemovalResponseSchema.parse(removed.json())).toMatchObject({
      deposited: 3,
      profileStatus: "draft",
    });
    const rows = await rowsOf(member.accountId);
    expect(rows.map((row) => row.state)).toEqual([
      "pending",
      "pending",
      "pending",
      "withdrawn",
    ]);
    // never purged at once (07 Q9): the object stays until its date
    const kept = await store.read(BUCKET, rows[3]?.object_key ?? "");
    expect(kept.ok && kept.value !== null).toBe(true);
    const again = await call(
      server,
      "DELETE",
      `${URL_PORTFOLIO}/${ids[3]}`,
      member.session,
    );
    expect(again.statusCode).toBe(200);

    // the withdrawn and the refused are listed with their date of deletion, the reason on a refusal
    await decide(ids[2] ?? "", "rejected");
    const listed = portfolioResponseSchema.parse(
      (await call(server, "GET", URL_PORTFOLIO, member.session)).json(),
    );
    expect(listed.deposited).toBe(2);
    const refused = listed.items.find((item) => item.id === ids[2]);
    expect(refused).toMatchObject({
      state: "rejected",
      reasonCode: "watermark",
      displayOrder: null,
    });
    const withdrawn = listed.items.find((item) => item.id === ids[3]);
    expect(withdrawn).toMatchObject({ state: "withdrawn", reasonCode: null });
    const due = Date.parse(withdrawn?.deleteAfter ?? "");
    expect(Math.abs(due - (Date.now() + 30 * 86_400_000))).toBeLessThan(
      120_000,
    );

    // published with three deposited: the third one stays
    await deposit(server, member, png(400, 400, 160));
    await publish(member);
    expect(
      errorOf(
        await call(
          server,
          "DELETE",
          `${URL_PORTFOLIO}/${ids[0]}`,
          member.session,
        ),
      ),
    ).toMatchObject({
      status: 409,
      details: [{ path: "portfolio", issue: "portfolio_minimum" }],
    });
  });
});

describe("L2G-P6 who may reach the routes (18 T14.1 to T14.4)", () => {
  it("answers another creator's visual exactly as an unknown address, on each route", async () => {
    const server = app();
    const owner = await newMember("creator");
    const stranger = await newMember("creator");
    const { item } = await deposit(server, owner, WEBP);
    await decide(item.id);
    const unknown = errorBody(
      await call(server, "GET", `${URL_PORTFOLIO}/unknown`, stranger.session),
    );
    expect(unknown).toEqual({
      status: 404,
      code: "not_found",
      message: "Not found",
    });
    const url = `${URL_PORTFOLIO}/${item.id}`;
    for (const response of [
      await call(server, "GET", `${url}/image`, stranger.session),
      await call(
        server,
        "PATCH",
        url,
        stranger.session,
        json({ caption: CAPTION, brandDeclared: false }),
      ),
      await call(server, "DELETE", url, stranger.session),
      await put(server, stranger, GEOTAGGED, { replaces: item.id }),
      await call(
        server,
        "GET",
        `${URL_PORTFOLIO}/${randomUUID()}/image`,
        owner.session,
      ),
      await call(
        server,
        "DELETE",
        `${URL_PORTFOLIO}/${randomUUID()}`,
        owner.session,
      ),
    ]) {
      expect(errorBody(response)).toEqual(unknown);
    }
    // the stranger's own list knows nothing of it
    expect(
      portfolioResponseSchema.parse(
        (await call(server, "GET", URL_PORTFOLIO, stranger.session)).json(),
      ),
    ).toEqual({ items: [], deposited: 0 });
    expect((await rowsOf(owner.accountId)).map((row) => row.state)).toEqual([
      "approved",
    ]);
    expect(await usageOf(stranger.accountId)).toBeUndefined();
  });

  it("answers a brand exactly as an unknown route, for each route (T14.3, T14.4), and 401 without a session", async () => {
    const server = app();
    const brand = await newMember("advertiser");
    const unknown = errorBody(
      await call(server, "GET", `${URL_PORTFOLIO}/unknown`, brand.session),
    );
    const id = randomUUID();
    const requests = (session: string | null) => [
      call(server, "GET", URL_PORTFOLIO, session),
      call(server, "PUT", URL_PORTFOLIO, session, {
        bytes: GEOTAGGED,
        type: OCTETS,
      }),
      call(server, "PUT", URL_PORTFOLIO, session),
      call(
        server,
        "PUT",
        `${URL_PORTFOLIO}/order`,
        session,
        json({ itemIds: [id] }),
      ),
      call(
        server,
        "PATCH",
        `${URL_PORTFOLIO}/${id}`,
        session,
        json({ caption: null, brandDeclared: false }),
      ),
      call(server, "DELETE", `${URL_PORTFOLIO}/${id}`, session),
      call(server, "GET", `${URL_PORTFOLIO}/${id}/image`, session),
    ];
    for (const response of await Promise.all(requests(brand.session))) {
      expect(errorBody(response)).toEqual(unknown);
    }
    expect(await usageOf(brand.accountId)).toBeUndefined();
    for (const response of await Promise.all(requests(null))) {
      expect(errorOf(response).status).toBe(401);
    }
  });
});

describe("L2G-P7 what an answer and a log carry (T9.2 as D82 amends it; D60, fiche invariant 13)", () => {
  it("answers every route without any key, host of Supabase, address, checksum nor token", async () => {
    const server = app();
    const member = await newMember("creator");
    const deposited = await put(server, member, GEOTAGGED);
    const { item } = portfolioUploadResponseSchema.parse(deposited.json());
    const url = `${URL_PORTFOLIO}/${item.id}`;
    const responses = [
      deposited,
      await call(
        server,
        "PATCH",
        url,
        member.session,
        json({ caption: CAPTION, brandDeclared: true }),
      ),
      await call(
        server,
        "PUT",
        `${URL_PORTFOLIO}/order`,
        member.session,
        json({ itemIds: [item.id] }),
      ),
      await call(server, "GET", URL_PORTFOLIO, member.session),
      await call(server, "GET", `${url}/image`, member.session),
      await call(server, "DELETE", url, member.session),
    ];
    const [row] = await rowsOf(member.accountId);
    for (const response of responses) {
      expect(response.statusCode, response.body).toBe(200);
      for (const forbidden of [
        "http",
        "supabase",
        "54321",
        "storage/v1",
        "token",
        ".webp",
        "checksum",
        "objectKey",
        row?.checksum ?? "",
        member.accountId,
      ]) {
        expect(response.body.includes(forbidden), forbidden).toBe(false);
      }
    }
  });

  it("names outcomes and sizes in the logs, never an account, a key, a handle, a caption nor a name", () => {
    const text = logStreams.map((read) => read()).join("\n");
    for (const line of [
      "profiles.portfolio.upload",
      "profiles.portfolio.caption",
      "profiles.portfolio.order",
      "profiles.portfolio.remove",
    ]) {
      expect(text).toContain(line);
    }
    expect(valuesFoundIn(text, watchedValues)).toEqual([]);
    expect(text).not.toMatch(/[0-9a-f-]{36}\/[0-9a-f-]{36}\.webp/);
    expect(text.includes("logo-geotagged")).toBe(false);
  });
});

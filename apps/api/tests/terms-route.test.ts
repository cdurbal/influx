// GET /v1/terms/current (docs/mvp/21 EC-62; 05 RG25, RG27): the route and the content check,
// with the database replaced by a fake lookup and the legal folder by a temporary one. The
// database half (identity.terms_in_force(), 0108) is db-tests/tm10-terms-in-force.test.ts; the
// whole path on the local stack, db-tests/tm10-terms-route.test.ts.
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { TermsVersionRow } from "../src/domains/identity/repository.ts";
import {
  matchesEntityTag,
  TERMS_READ_RATE,
} from "../src/domains/identity/routes.ts";
import type { TermsLookup } from "../src/domains/identity/terms.ts";
import { buildServer, type ApiServer } from "../src/server.ts";
import {
  BACKOFFICE_SECRET,
  captureLogs,
  testApiConfig,
  WEB_SECRET,
} from "./helpers.ts";

const FR_TEXT =
  "**Projet non contractuel / Draft, not contractual**\n\n# CGU\n";
const EN_TEXT =
  "**Projet non contractuel / Draft, not contractual**\n\n# Terms\n";

let root: string;
let app: ApiServer | undefined;

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function writeLegal(uri: string, text: string): void {
  const file = path.join(root, ...uri.split("/"));
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text, "utf8");
}

function row(overrides: Partial<TermsVersionRow> = {}): TermsVersionRow {
  return {
    id: randomUUID(),
    documentKind: "terms_of_service",
    locale: "fr",
    versionLabel: "draft-1",
    contentUri: "legal/terms_of_service/fr/draft-1.md",
    contentSha256: sha256(FR_TEXT),
    requiresAcceptance: true,
    effectiveFrom: "2026-10-08T09:00:00.000Z",
    ...overrides,
  };
}

/** A lookup that answers `answer` and counts its calls. */
function lookupOf(answer: TermsVersionRow | null) {
  const calls: string[] = [];
  const lookup: TermsLookup = async (document, locale) => {
    calls.push(`${document}/${locale}`);
    return answer;
  };
  return { lookup, calls };
}

function server(lookup: TermsLookup) {
  const logs = captureLogs();
  app = buildServer(testApiConfig(), {
    logDestination: logs.destination,
    identity: { termsLookup: lookup, legalContentRoot: root },
  });
  return { api: app, logs };
}

function get(
  api: ApiServer,
  query: string,
  headers: Record<string, string> = {},
) {
  return api.inject({
    method: "GET",
    url: `/v1/terms/current${query}`,
    headers: {
      "x-influx-internal": WEB_SECRET,
      "x-real-ip": "203.0.113.7",
      ...headers,
    },
  });
}

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "influx-legal-"));
  writeLegal("legal/terms_of_service/fr/draft-1.md", FR_TEXT);
  writeLegal("legal/terms_of_service/en/draft-1.md", EN_TEXT);
});

afterEach(async () => {
  await app?.close();
  app = undefined;
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("GET /v1/terms/current: nominal (RG27)", () => {
  it("serves the version in force, its fingerprint and its text, revalidated at each use", async () => {
    const version = row();
    const { api } = server(lookupOf(version).lookup);
    const response = await get(api, "?document=terms_of_service&locale=fr");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: version.id,
      document: "terms_of_service",
      locale: "fr",
      isFallback: false,
      versionLabel: "draft-1",
      effectiveFrom: "2026-10-08T09:00:00.000Z",
      requiresAcceptance: true,
      contentSha256: sha256(FR_TEXT),
      content: FR_TEXT,
    });
    expect(response.headers["cache-control"]).toBe("no-cache");
    expect(response.headers.etag).toBe(`"${version.id}"`);
  });

  it("serves the English version for French when none is in force in French (RG25)", async () => {
    const version = row({
      locale: "en",
      contentUri: "legal/terms_of_service/en/draft-1.md",
      contentSha256: sha256(EN_TEXT),
    });
    const { api } = server(lookupOf(version).lookup);
    const response = await get(api, "?document=terms_of_service&locale=fr");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      locale: "en",
      isFallback: true,
      content: EN_TEXT,
    });
  });

  it("answers 304 without a body when the version is the one the client holds", async () => {
    const version = row();
    const { api } = server(lookupOf(version).lookup);
    for (const ifNoneMatch of [
      `"${version.id}"`,
      `W/"${version.id}"`,
      `"other", "${version.id}"`,
    ]) {
      const response = await get(api, "?document=terms_of_service&locale=fr", {
        "if-none-match": ifNoneMatch,
      });
      expect(response.statusCode, ifNoneMatch).toBe(304);
      expect(response.body).toBe("");
      expect(response.headers.etag).toBe(`"${version.id}"`);
    }
    const replaced = await get(api, "?document=terms_of_service&locale=fr", {
      "if-none-match": `"${randomUUID()}"`,
    });
    expect(replaced.statusCode).toBe(200);
  });

  it("asks the database at each request: a version replaced in between is never kept", async () => {
    const { lookup, calls } = lookupOf(row());
    const { api } = server(lookup);
    await get(api, "?document=terms_of_service&locale=fr");
    await get(api, "?document=terms_of_service&locale=fr");
    expect(calls).toEqual(["terms_of_service/fr", "terms_of_service/fr"]);
  });
});

describe("GET /v1/terms/current: refusals", () => {
  it.each([
    "?document=supervision_notice&locale=fr",
    "?document=terms_of_service&locale=de",
    "?document=terms_of_service",
    "?locale=fr",
    "?document=terms_of_service&locale=fr&extra=1",
    "?document=terms_of_service&document=privacy_policy&locale=fr",
    "",
  ])("answers 400 to %j, before any read", async (query) => {
    const { lookup, calls } = lookupOf(row());
    const { api } = server(lookup);
    const response = await get(api, query);
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("validation_failed");
    expect(calls).toEqual([]);
  });

  it("answers 404 terms_not_published when no version is in force", async () => {
    const { api } = server(lookupOf(null).lookup);
    const response = await get(api, "?document=cookie_policy&locale=en");
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("terms_not_published");
  });

  it("is a route of the web surface only", async () => {
    const { api } = server(lookupOf(row()).lookup);
    const response = await get(api, "?document=terms_of_service&locale=fr", {
      "x-influx-internal": BACKOFFICE_SECRET,
    });
    expect(response.statusCode).toBe(404);
  });

  it("bounds the reads of one address per minute", async () => {
    const { api } = server(lookupOf(row()).lookup);
    const statuses: number[] = [];
    for (let index = 0; index <= TERMS_READ_RATE.address; index += 1) {
      statuses.push(
        (await get(api, "?document=terms_of_service&locale=fr")).statusCode,
      );
    }
    expect(statuses.slice(0, -1).every((status) => status === 200)).toBe(true);
    expect(statuses.at(-1)).toBe(429);
    const other = await get(api, "?document=terms_of_service&locale=fr", {
      "x-real-ip": "203.0.113.8",
    });
    expect(other.statusCode).toBe(200);
  });
});

describe("GET /v1/terms/current: fails closed (EC-62)", () => {
  async function failsClosed(version: TermsVersionRow, reason: string) {
    const { api, logs } = server(lookupOf(version).lookup);
    const response = await get(api, "?document=terms_of_service&locale=fr");
    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe("internal_error");
    expect(response.body).not.toContain("Projet");
    expect(response.headers.etag).toBeUndefined();
    const line = logs
      .lines()
      .map((text) => JSON.parse(text) as Record<string, unknown>)
      .find((entry) => String(entry.msg).includes("content check"));
    expect(line).toMatchObject({ level: "error", reason });
  }

  it("refuses a text whose SHA-256 differs from the published one", async () => {
    await failsClosed(
      row({ contentSha256: sha256(`${FR_TEXT} `) }),
      "content_hash_mismatch",
    );
  });

  it("refuses a content_uri other than the path rebuilt from the version (no traversal)", async () => {
    for (const contentUri of [
      "legal/terms_of_service/fr/../../../package.json",
      "legal/terms_of_service/en/draft-1.md",
      "/etc/passwd",
    ]) {
      await failsClosed(row({ contentUri }), "content_uri_mismatch");
      await app?.close();
    }
  });

  it("refuses a version whose file is missing", async () => {
    await failsClosed(
      row({
        versionLabel: "draft-9",
        contentUri: "legal/terms_of_service/fr/draft-9.md",
      }),
      "content_missing",
    );
  });

  it("refuses a row of another document or of a third language", async () => {
    await failsClosed(
      row({ documentKind: "privacy_policy" }),
      "unexpected_row",
    );
    await app?.close();
    await failsClosed(row({ locale: "de" }), "unexpected_row");
  });
});

describe("If-None-Match (RFC 9110 §13.1.2)", () => {
  it("matches the tag, its weak form, a list and the wildcard; nothing else", () => {
    expect(matchesEntityTag('"a"', '"a"')).toBe(true);
    expect(matchesEntityTag('W/"a"', '"a"')).toBe(true);
    expect(matchesEntityTag('"b" , "a"', '"a"')).toBe(true);
    expect(matchesEntityTag("*", '"a"')).toBe(true);
    expect(matchesEntityTag(undefined, '"a"')).toBe(false);
    expect(matchesEntityTag("a", '"a"')).toBe(false);
    expect(matchesEntityTag('"ab"', '"a"')).toBe(false);
  });
});

// GET /v1/terms/current (docs/mvp/21 EC-62 and its amendment; 05 RG25, RG27): the route and the
// check of the text read from the database, with the database replaced by a fake lookup (or by a
// pool that reaches nothing). No file is read. The database half (identity.terms_in_force(),
// 0108, 0109) is db-tests/tm10-terms-in-force.test.ts; the whole path on the local stack,
// db-tests/tm10-terms-route.test.ts. EC-62 (D): never a 500 on this route.
import { createHash, randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createApiDatabase } from "../src/db/index.ts";
import type { TermsVersionRow } from "../src/domains/identity/repository.ts";
import {
  matchesEntityTag,
  TERMS_READ_RATE,
  TERMS_RETRY_AFTER_SECONDS,
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
  "**Projet non contractuel / Draft, not contractual**\n\n# CGU\n\nÉtat « brouillon ».\n";
const EN_TEXT =
  "**Projet non contractuel / Draft, not contractual**\n\n# Terms\n";

let app: ApiServer | undefined;

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function row(overrides: Partial<TermsVersionRow> = {}): TermsVersionRow {
  return {
    id: randomUUID(),
    documentKind: "terms_of_service",
    locale: "fr",
    versionLabel: "draft-2",
    contentUri: "legal/terms_of_service/fr/draft-2.md",
    contentSha256: sha256(FR_TEXT),
    requiresAcceptance: true,
    effectiveFrom: "2026-10-08T09:00:00.000Z",
    content: FR_TEXT,
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
    identity: { termsLookup: lookup },
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

afterEach(async () => {
  await app?.close();
  app = undefined;
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
      versionLabel: "draft-2",
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
      contentUri: "legal/terms_of_service/en/draft-2.md",
      contentSha256: sha256(EN_TEXT),
      content: EN_TEXT,
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

  it("answers 404 terms_not_published when nothing is in force with its text (0109: a row without text is not returned)", async () => {
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

describe("GET /v1/terms/current: 503 terms_unavailable, never 500 (EC-62 (D))", () => {
  /** The answer is a 503 with Retry-After, no text, and one error line naming the reason. */
  async function unavailable(lookup: TermsLookup, reason: string) {
    const { api, logs } = server(lookup);
    const response = await get(api, "?document=terms_of_service&locale=fr");
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("terms_unavailable");
    expect(response.headers["retry-after"]).toBe(
      String(TERMS_RETRY_AFTER_SECONDS),
    );
    expect(response.headers.etag).toBeUndefined();
    expect(response.body).not.toContain("Projet");
    const lines = logs
      .lines()
      .map((text) => JSON.parse(text) as Record<string, unknown>);
    const line = lines.find((entry) =>
      String(entry.msg).includes("terms_unavailable"),
    );
    expect(line).toMatchObject({ level: "error", reason });
    expect(logs.lines().join("\n")).not.toContain("Projet non contractuel");
    await app?.close();
    app = undefined;
  }

  it("refuses a text whose SHA-256 differs from the published one", async () => {
    await unavailable(
      lookupOf(row({ content: `${FR_TEXT} ` })).lookup,
      "content_hash_mismatch",
    );
  });

  it("refuses a row of another document, of a third language, or with a malformed label", async () => {
    for (const overrides of [
      { documentKind: "privacy_policy" },
      { locale: "de" },
      { versionLabel: "../draft-2" },
    ]) {
      await unavailable(lookupOf(row(overrides)).lookup, "unexpected_row");
    }
  });

  it("refuses a row the response schema refuses, instead of failing at serialisation", async () => {
    for (const overrides of [
      { effectiveFrom: "yesterday" },
      { id: "not-a-uuid" },
      { content: "", contentSha256: sha256("") },
    ]) {
      await unavailable(lookupOf(row(overrides)).lookup, "response_invalid");
    }
  });

  it("answers 503 when the lookup throws, whatever it throws", async () => {
    for (const thrown of [
      new Error("connect ECONNREFUSED"),
      Object.assign(new Error("terminating connection"), { code: "57P01" }),
      "a string",
      undefined,
    ]) {
      await unavailable(async () => {
        throw thrown;
      }, "lookup_failed");
    }
  });

  it("answers 503 when the database cannot be reached", async () => {
    const unreachable = (
      role: "influx_app" | "influx_auth_login" | "influx_ops_login",
    ) => ({
      url: `postgresql://${role}:x@127.0.0.1:1/postgres`,
      role,
      tls: false,
    });
    const database = createApiDatabase(
      {
        app: unreachable("influx_app"),
        auth: unreachable("influx_auth_login"),
        ops: unreachable("influx_ops_login"),
      },
      { info: () => undefined, warn: () => undefined, error: () => undefined },
    );
    const logs = captureLogs();
    app = buildServer(testApiConfig(), {
      logDestination: logs.destination,
      database,
    });
    const response = await get(app, "?document=terms_of_service&locale=fr");
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("terms_unavailable");
    expect(response.headers["retry-after"]).toBeDefined();
  });

  it("never answers 500, whatever the lookup returns or throws", async () => {
    const answers: (() => Promise<TermsVersionRow | null>)[] = [
      async () => row(),
      async () => null,
      async () => row({ content: "x" }),
      async () => row({ contentSha256: "zz" }),
      async () => row({ requiresAcceptance: "yes" as unknown as boolean }),
      async () => ({}) as TermsVersionRow,
      async () => {
        throw new TypeError("boom");
      },
      () => Promise.reject(new RangeError("late")),
    ];
    for (const answer of answers) {
      const { api } = server(answer);
      const response = await get(api, "?document=terms_of_service&locale=fr");
      expect(response.statusCode).not.toBe(500);
      expect([200, 404, 503]).toContain(response.statusCode);
      await app?.close();
      app = undefined;
    }
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

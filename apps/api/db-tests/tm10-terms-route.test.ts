// TM10 (J5, commit 3) — GET /v1/terms/current on the local stack (21 EC-62; 05 RG25, RG27): the
// route reads the version in force through identity.terms_in_force() under influx_auth (E-1,
// identity.read_published_terms), rebuilds the path of its text, recomputes its SHA-256 and serves
// the exact bytes of apps/api/legal. The refusals and the fail-closed cases are unit tests
// (tests/terms-route.test.ts); the SQL function alone, tm10-terms-in-force.test.ts.
//
// The six drafts are published when no version of their document is in force in their language
// (ensureInForce): a version published on the workstation is never replaced.
import { localRoleUrl, type LoginRole } from "@influx/test-kit/db";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ensureInForce,
  LOCAL_SEED_DRAFTS,
} from "../scripts/terms-publication.ts";
import {
  closeDatabase,
  createApiDatabase,
  type ApiDatabase,
} from "../src/db/index.ts";
import { LEGAL_CONTENT_ROOT } from "../src/domains/identity/terms.ts";
import { buildServer } from "../src/server.ts";
import { captureLogs, testApiConfig, WEB_SECRET } from "../tests/helpers.ts";
import { migrationRole } from "./support.ts";

type InForce = {
  id: string;
  locale: string;
  content_uri: string;
  content_sha256: string;
  requires_acceptance: boolean;
};

let database: ApiDatabase;

function localConnection(role: LoginRole) {
  return { url: localRoleUrl(role), role, tls: false };
}

beforeAll(async () => {
  for (const draft of LOCAL_SEED_DRAFTS) {
    await ensureInForce(migrationRole(), draft);
  }
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
});

async function inForce(document: string, locale: string): Promise<InForce> {
  const [row] = await migrationRole()<InForce[]>`
    select id::text, locale::text, content_uri, encode(content_hash, 'hex') as content_sha256,
           requires_acceptance
      from identity.terms_versions
     where document_kind = ${document}::identity.document_kind and locale = ${locale}
       and effective_to is null and effective_from <= now()`;
  if (row === undefined) {
    throw new Error(`no version in force for ${document}/${locale}`);
  }
  return row;
}

describe("GET /v1/terms/current on the local stack (EC-62)", () => {
  it.each(LOCAL_SEED_DRAFTS.map((draft) => [draft.document, draft.locale]))(
    "serves %s in %s: the version in force, its exact bytes and their SHA-256",
    async (document, locale) => {
      const expected = await inForce(document, locale);
      const logs = captureLogs();
      const server = buildServer(testApiConfig(), {
        logDestination: logs.destination,
        database,
      });
      try {
        const response = await server.inject({
          method: "GET",
          url: `/v1/terms/current?document=${document}&locale=${locale}`,
          headers: {
            "x-influx-internal": WEB_SECRET,
            "x-real-ip": "203.0.113.9",
          },
        });
        expect(response.statusCode, response.body).toBe(200);
        const body = response.json();
        expect(body).toMatchObject({
          id: expected.id,
          document,
          locale,
          isFallback: false,
          requiresAcceptance: expected.requires_acceptance,
          contentSha256: expected.content_sha256,
        });
        expect(body.content).toBe(
          readFileSync(
            path.join(LEGAL_CONTENT_ROOT, ...expected.content_uri.split("/")),
            "utf8",
          ),
        );
        expect(response.headers.etag).toBe(`"${expected.id}"`);
      } finally {
        await server.close();
      }
    },
  );

  it("requires an acceptance for the terms of service only (0005)", async () => {
    expect((await inForce("terms_of_service", "fr")).requires_acceptance).toBe(
      true,
    );
    expect((await inForce("privacy_policy", "fr")).requires_acceptance).toBe(
      false,
    );
  });
});

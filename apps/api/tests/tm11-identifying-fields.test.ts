// 18 TM11.1 and TM11.2: no contract and no response schema served to a brand declares a field that
// identifies a creator (07 RG18, matching-spec A3; jalons/l2d commit 11). The list is DERIVED from
// the Drizzle declaration of the identifying objects (0217: creator_identities,
// creator_social_accounts, the exact audience, the refused sectors, the metric history), plus the
// names of RG18 that no table holds; a column added to one of them joins the list by itself.
//   TM11.1  every zod schema exported by packages/contracts, but the module served to the creator
//           alone (creator-profile) and the contracts of the backoffice (agents read identities);
//   TM11.2  every response schema of the router's own inventory (routeInventoryOf), web surface,
//           but /v1/me/creator-profile*, which T14 (db-tests/profiles-creator-*) proves unreachable
//           by a brand, and T1 (db-tests/t1-anonymisation) sweeps by value;
//   witnesses: a `handle` added to a schema fails the check, whatever its depth.
//   TM11.3  (L2E 17, T9.6) the columns of `verification.*` and of the brand's internal block, DERIVED
//           from their Drizzle declaration (an object key, a checksum, a handle or a figure observed
//           by the agent, an internal comment, a registration number…), are declared by no contract
//           but the verification module and the backoffice's, and by no response schema of the web
//           surface but the verification routes; generic names (status, code, width…) apart.
// The allowances below are the member's OWN contact details in their own contracts (a brand's
// e-mail on its account, a visitor's address on the support form). Each is checked to still be
// declared, so that none outlives its field.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import * as z from "zod";
import {
  routeInventoryOf,
  buildServer,
  type ApiServer,
} from "../src/server.ts";
import { creatorIdentityColumns } from "../src/db/schema/introspection.ts";
import { captureLogs, testApiConfig } from "./helpers.ts";
import {
  declaresField,
  declaredFields,
  derivedColumnNames,
  derivedVerificationColumnNames,
  forbiddenFieldsOf,
  forbiddenNames,
  forbiddenVerificationNames,
  isZodSchema,
  normalisedName,
  STRUCTURAL_COLUMNS,
  VERIFICATION_GENERIC_COLUMNS,
} from "./zod-fields.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTRACTS = path.resolve(HERE, "../../../packages/contracts");
const WEB_CREATOR_PREFIX = "/v1/me/creator-profile";
const BACKOFFICE_PREFIX = "/v1/bo/";
/** The member's own verification routes (L2E 12, 13, 15): T14 keeps every other role off them. */
const WEB_VERIFICATION_PREFIXES = [
  "/v1/me/verification",
  "/v1/me/brand-verification",
] as const;

function isVerificationModule(name: string): boolean {
  return name === "verification" || name.startsWith("backoffice-");
}

function isWebVerificationRoute(url: string): boolean {
  return WEB_VERIFICATION_PREFIXES.some(
    (prefix) => url === prefix || url.startsWith(`${prefix}/`),
  );
}

/**
 * Modules left out of TM11.1: served to the creator alone, or to the agents of the backoffice.
 * `creator-portfolio` and `creator-projection` (L2G 06) are the creator's own routes under
 * /v1/me/creator-profile (T14 keeps every other role off them): the second one is his PREVIEW, whose
 * `after` tab holds layer I by design. The search of Lot 3 serves a brand the layer A alone from a
 * module of its own, covered by this test, which will name the lines without the identifying names.
 * `verification` (L2E): the creator's own requests, the agent's decisions (the handle and the three
 * figures are typed by the agent) and the brand's own internal block; the public badge it holds
 * names a network by design (08 RG89) and is held free of handle, URL, agent and gap by
 * packages/contracts/tests/verification.test.ts, which walks every member answer.
 */
function isExcludedModule(name: string): boolean {
  return (
    name === "creator-profile" ||
    name === "creator-portfolio" ||
    name === "creator-projection" ||
    name === "verification" ||
    name.startsWith("backoffice-")
  );
}

/** Contact details a member's own contract may carry, by module (name of the export). */
const OWN_CONTACT_BY_MODULE: Readonly<Record<string, readonly string[]>> = {
  auth: ["email"],
  account: ["email", "companyName"],
  "brand-profile": ["companyName", "firstName", "email", "phone"],
  signup: ["companyName"],
  support: ["contactEmail"],
  "brevo-webhook": ["email"],
};

/** The same, by route (path as registered), for the response schemas of the web surface. */
const OWN_CONTACT_BY_ROUTE: Readonly<Record<string, readonly string[]>> = {
  "/v1/auth/journey": ["email"],
  "/v1/me": ["email", "companyName"],
  "/v1/me/brand-profile": ["companyName", "firstName", "email", "phone"],
  "/v1/me/brand-profile/submit": ["companyName", "firstName", "email", "phone"],
  // The creator's own verification (L2E 12): the network of HIS line, which a request and a badge
  // name. A brand never reaches these routes (T14, db-tests/verification-route.test.ts); the public
  // badge an advertiser will read names a network by design (08 RG89) and is held free of handle, URL,
  // agent and gap by packages/contracts/tests/verification.test.ts.
  "/v1/me/verification": ["networkCode"],
  "/v1/me/verification/requests": ["networkCode"],
  "/v1/me/verification/requests/:id/code": ["networkCode"],
  "/v1/me/verification/requests/:id/submit": ["networkCode"],
  "/v1/me/verification/requests/:id/cancel": ["networkCode"],
  // L2F 14: the contests of HIS own decisions name the network of the line they concern.
  "/v1/me/verification/disputes": ["networkCode"],
  // L2E 13: the removal of a piece answers the request as it now stands; the deposit answers the
  // piece alone (metadata, no network).
  "/v1/me/verification/requests/:id/evidence/:evidenceId": ["networkCode"],
  // The brand's own verification (L2E 15): the registered name of HIS internal block (06 RG46), to him
  // alone (no creator, no Brevo, no Apollo, no log); `networkCode` is the shared schema of a request,
  // always null for a brand. The agent's constat (domain observed, comment) is in no answer.
  "/v1/me/brand-verification": ["networkCode", "legalName"],
  "/v1/me/brand-verification/internal-details": ["networkCode", "legalName"],
  "/v1/me/brand-verification/request": ["networkCode"],
  "/v1/me/brand-verification/request/code": ["networkCode"],
  "/v1/me/brand-verification/request/submit": ["networkCode"],
  "/v1/me/brand-verification/request/cancel": ["networkCode"],
};

type ContractModule = { name: string; schemas: [string, z.ZodType][] };

async function contractModules(): Promise<ContractModule[]> {
  const manifest = JSON.parse(
    readFileSync(path.join(CONTRACTS, "package.json"), "utf8"),
  ) as { exports: Record<string, string> };
  const modules: ContractModule[] = [];
  for (const key of Object.keys(manifest.exports)) {
    const name = key.replace(/^\.\//, "");
    const specifier = `@influx/contracts/${name}`;
    const loaded = (await import(/* @vite-ignore */ specifier)) as Record<
      string,
      unknown
    >;
    modules.push({
      name,
      schemas: Object.entries(loaded).filter(
        (entry): entry is [string, z.ZodType] => isZodSchema(entry[1]),
      ),
    });
  }
  return modules;
}

type WebResponse = { route: string; url: string; schemas: z.ZodType[] };

/** The response schemas of the web surface, one entry per method and path. */
function webResponses(server: ApiServer): WebResponse[] {
  return routeInventoryOf(server)
    .filter(
      (route) =>
        route.url.startsWith("/v1/") &&
        !route.url.startsWith(BACKOFFICE_PREFIX),
    )
    .map((route) => ({
      route: `${route.method} ${route.url}`,
      url: route.url,
      schemas: Object.values(
        (route.schema.response ?? {}) as Record<string, unknown>,
      ).filter(isZodSchema),
    }));
}

/** TM11.2 over a server's inventory: the fields found, as `METHOD /path path (origin)`. */
function responseFindings(server: ApiServer): string[] {
  return webResponses(server)
    .filter((entry) => !entry.url.startsWith(WEB_CREATOR_PREFIX))
    .flatMap((entry) =>
      entry.schemas.flatMap((schema) =>
        forbiddenFieldsOf(schema, OWN_CONTACT_BY_ROUTE[entry.url] ?? []).map(
          (found) => `${entry.route} ${found}`,
        ),
      ),
    );
}

let app: ApiServer | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function readyServer(): Promise<ApiServer> {
  app = buildServer(testApiConfig(), {
    logDestination: captureLogs().destination,
  });
  await app.ready();
  return app;
}

describe("the list of identifying names, derived from Drizzle", () => {
  it("holds a column of every identifying table, beyond the structural ones", () => {
    const tables = creatorIdentityColumns();
    expect(Object.keys(tables).sort()).toEqual([
      "creator_audience_ages",
      "creator_audience_countries",
      "creator_audience_genders",
      "creator_identities",
      "creator_network_metrics_history",
      "creator_refused_sectors",
      "creator_social_accounts",
    ]);
    const forbidden = forbiddenNames();
    for (const name of [
      "legal_first_name",
      "contact_email",
      "city",
      "handle",
      "pseudonym",
      "profile_url",
      "followers_count",
      "engagement_rate_bp",
      "sector_code",
      "share_percent",
    ]) {
      expect(forbidden.has(normalisedName(name)), name).toBe(true);
    }
    // RG18 names no table holds.
    for (const name of ["avatar", "dateOfBirth", "pastBrands", "price"]) {
      expect(forbidden.get(normalisedName(name)), name).toBe("07 RG18");
    }
  });

  it("exempts only structural columns that exist, and nothing that identifies", () => {
    const derived = derivedColumnNames();
    for (const column of STRUCTURAL_COLUMNS) {
      expect(derived.has(normalisedName(column)), column).toBe(true);
    }
    expect([...STRUCTURAL_COLUMNS].sort()).toEqual([
      "account_id",
      "country_code",
      "created_at",
      "id",
      "updated_at",
    ]);
  });

  it("walks every wrapper: array, union, optional, lazy, pipe, record, tuple", () => {
    const leaf = z.strictObject({ handle: z.string() });
    const lazy = z.lazy(() => leaf);
    const walked = (schema: z.ZodType) =>
      declaredFields(schema).map((field) => field.name);
    for (const schema of [
      leaf,
      z.array(leaf),
      z.union([z.string(), leaf]),
      leaf.optional(),
      leaf.nullable(),
      lazy,
      z
        .string()
        .pipe(z.transform((value) => value))
        .or(leaf),
      z.record(z.string(), leaf),
      z.tuple([leaf]),
      z.strictObject({ deep: z.strictObject({ deeper: z.array(leaf) }) }),
    ]) {
      expect(walked(schema)).toContain("handle");
    }
  });
});

describe("TM11.1: no contract of packages/contracts declares an identifying field", () => {
  it("covers every module that is neither the creator's nor the backoffice's", async () => {
    const modules = await contractModules();
    const covered = modules.filter(({ name }) => !isExcludedModule(name));
    // Floor: the exports of the package at L2D; a module added is covered without edit.
    expect(covered.length).toBeGreaterThanOrEqual(13);
    expect(covered.flatMap((entry) => entry.schemas).length).toBeGreaterThan(
      90,
    );
    expect(modules.map(({ name }) => name)).toContain("creator-profile");
    expect(
      modules
        .filter(({ name }) => isExcludedModule(name))
        .map(({ name }) => name),
    ).toContain("backoffice-queues");
  });

  it("finds no forbidden field name, the member's own contact details apart", async () => {
    const findings: string[] = [];
    for (const { name, schemas } of await contractModules()) {
      if (isExcludedModule(name)) {
        continue;
      }
      for (const [exported, schema] of schemas) {
        for (const found of forbiddenFieldsOf(
          schema,
          OWN_CONTACT_BY_MODULE[name] ?? [],
        )) {
          findings.push(`${name}/${exported} ${found}`);
        }
      }
    }
    expect(findings).toEqual([]);
  });

  it("keeps each allowance on a field its module still declares", async () => {
    const modules = new Map(
      (await contractModules()).map((entry) => [entry.name, entry]),
    );
    for (const [name, fields] of Object.entries(OWN_CONTACT_BY_MODULE)) {
      const entry = modules.get(name);
      expect(entry, name).toBeDefined();
      for (const field of fields) {
        expect(
          entry?.schemas.some(([, schema]) => declaresField(schema, field)),
          `${name}.${field}`,
        ).toBe(true);
      }
    }
  });

  it("sees the creator's own module hold the identifying fields (the exclusion is real)", async () => {
    const creator = (await contractModules()).find(
      ({ name }) => name === "creator-profile",
    );
    const names = new Set(
      (creator?.schemas ?? []).flatMap(([, schema]) =>
        forbiddenFieldsOf(schema).map((found) => found.split(" ")[0]),
      ),
    );
    expect(names.size).toBeGreaterThan(5);
  });
});

describe("TM11.2: no response schema of the web routes declares an identifying field", () => {
  it("finds no forbidden field name in the router's own inventory", async () => {
    expect(responseFindings(await readyServer())).toEqual([]);
  });

  it("covers the whole web surface and exempts only the creator's own routes", async () => {
    const entries = webResponses(await readyServer());
    const exempt = entries.filter((entry) =>
      entry.url.startsWith(WEB_CREATOR_PREFIX),
    );
    const covered = entries.filter(
      (entry) => !entry.url.startsWith(WEB_CREATOR_PREFIX),
    );
    expect(covered.length).toBeGreaterThan(30);
    expect(covered.every((entry) => entry.schemas.length > 0)).toBe(true);
    // The exempted routes are the L2D ones: profile (2) and networks (6); and the portfolio (6, L2G 07).
    expect(exempt.map((entry) => entry.route).sort()).toEqual([
      "DELETE /v1/me/creator-profile/networks/:id",
      "DELETE /v1/me/creator-profile/portfolio/:id",
      "GET /v1/me/creator-profile",
      "GET /v1/me/creator-profile/networks",
      "GET /v1/me/creator-profile/portfolio",
      "GET /v1/me/creator-profile/portfolio/:id/image",
      "PATCH /v1/me/creator-profile",
      "PATCH /v1/me/creator-profile/networks/:id",
      "PATCH /v1/me/creator-profile/portfolio/:id",
      "POST /v1/me/creator-profile/networks",
      "POST /v1/me/creator-profile/networks/:id/figures",
      "PUT /v1/me/creator-profile/networks/:id/audience",
      "PUT /v1/me/creator-profile/portfolio",
      "PUT /v1/me/creator-profile/portfolio/order",
    ]);
    // Unreachable by a brand (T14.3, T14.4) and swept by value (T1): each file names the proof.
    for (const file of [
      "db-tests/profiles-creator-route.test.ts",
      "db-tests/profiles-creator-networks.test.ts",
      "db-tests/profiles-portfolio-route.test.ts",
    ]) {
      const source = readFileSync(path.resolve(HERE, "..", file), "utf8");
      expect(source, file).toContain("T14.3");
    }
    expect(
      readFileSync(
        path.resolve(HERE, "../db-tests/t1-anonymisation.test.ts"),
        "utf8",
      ),
    ).toContain("T1.1");
  });

  it("keeps each allowance on a response its route still declares", async () => {
    const entries = webResponses(await readyServer());
    for (const [url, fields] of Object.entries(OWN_CONTACT_BY_ROUTE)) {
      const served = entries.filter((entry) => entry.url === url);
      expect(served.length, url).toBeGreaterThan(0);
      for (const field of fields) {
        expect(
          served.some((entry) =>
            entry.schemas.some((schema) => declaresField(schema, field)),
          ),
          `${url} ${field}`,
        ).toBe(true);
      }
    }
  });
});

/** TM11.3 over a server's inventory: web responses but the verification routes, /v1/bo/ apart. */
function verificationResponseFindings(server: ApiServer): string[] {
  const forbidden = forbiddenVerificationNames();
  return webResponses(server)
    .filter((entry) => !isWebVerificationRoute(entry.url))
    .flatMap((entry) =>
      entry.schemas.flatMap((schema) =>
        forbiddenFieldsOf(schema, [], forbidden).map(
          (found) => `${entry.route} ${found}`,
        ),
      ),
    );
}

describe("TM11.3 (L2E 17): no field of verification.* outside the verification modules and /v1/bo/", () => {
  it("derives the list from Drizzle: the piece, the finding, the internal block, beyond the generic names", () => {
    const derived = derivedVerificationColumnNames();
    for (const column of VERIFICATION_GENERIC_COLUMNS) {
      expect(derived.has(normalisedName(column)), column).toBe(true);
    }
    const forbidden = forbiddenVerificationNames();
    for (const name of [
      "object_key",
      "checksum",
      "retention_due_at",
      "observed_handle",
      "observed_platform_account_ref",
      "observed_domain",
      "observed_followers",
      "observed_avg_comments",
      "internal_comment",
      "claimed_by_account_id",
      "granted_by_account_id",
      "registration_number",
      "legal_name",
    ]) {
      expect(forbidden.has(normalisedName(name)), name).toBe(true);
    }
    expect(forbidden.size).toBeGreaterThan(50);
  });

  // L2F commit 16: the tables of 0231 to 0234 join the list by their declaration (their parity with
  // the migrated base is db-tests/tm11-drizzle-parity.test.ts): both handles of queue 6, the text of
  // a contest and its deciders, the withdrawal request; the message stays generic (member_message, a
  // brand refusal's own field), its value is T1's (db-tests/t1-anonymisation, L2F markers).
  it("derives the L2F names too: the old and new handle, the contest text and its deciders", () => {
    const forbidden = forbiddenVerificationNames();
    for (const name of [
      "previous_handle",
      "new_handle",
      "text",
      "original_decider_ids",
      "review_mode",
      "dual_control_request_id",
      "opened_by_account_id",
    ]) {
      expect(forbidden.has(normalisedName(name)), name).toBe(true);
    }
    expect(forbidden.get(normalisedName("previous_handle"))).toBe(
      "verification identifier_change_reviews.previous_handle",
    );
  });

  it("finds none in the contracts but the verification module and the backoffice's", async () => {
    const forbidden = forbiddenVerificationNames();
    const modules = await contractModules();
    const covered = modules.filter(({ name }) => !isVerificationModule(name));
    expect(covered.map(({ name }) => name)).toContain("creator-profile");
    expect(covered.map(({ name }) => name)).toContain("brand-profile");
    const findings = covered.flatMap(({ name, schemas }) =>
      schemas.flatMap(([exported, schema]) =>
        forbiddenFieldsOf(schema, [], forbidden).map(
          (found) => `${name}/${exported} ${found}`,
        ),
      ),
    );
    expect(findings).toEqual([]);
    // the exclusion is real: the verification modules do declare names of the list
    const held = modules
      .filter(({ name }) => isVerificationModule(name))
      .flatMap(({ schemas }) =>
        schemas.flatMap(([, schema]) =>
          forbiddenFieldsOf(schema, [], forbidden),
        ),
      );
    expect(held.length).toBeGreaterThan(0);
  });

  it("finds none in the response schemas of the web surface but the member's own verification routes", async () => {
    const server = await readyServer();
    expect(verificationResponseFindings(server)).toEqual([]);
    const verificationRoutes = webResponses(server).filter((entry) =>
      isWebVerificationRoute(entry.url),
    );
    expect(verificationRoutes.length).toBeGreaterThanOrEqual(10);
  });

  it("fails on a response or a contract that declares an object key or an observed handle", async () => {
    const forbidden = forbiddenVerificationNames();
    expect(
      forbiddenFieldsOf(
        z.strictObject({
          evidence: z.array(z.strictObject({ objectKey: z.string() })),
        }),
        [],
        forbidden,
      ),
    ).toEqual([expect.stringContaining(".evidence.objectKey")]);
    expect(
      forbiddenFieldsOf(
        z.strictObject({ observed_handle: z.string() }),
        [],
        forbidden,
      ),
    ).toHaveLength(1);
    const witness = buildServer(testApiConfig(), {
      logDestination: captureLogs().destination,
    });
    witness.get(
      "/v1/me/tm11-verification-witness",
      {
        schema: {
          response: {
            200: z.strictObject({ checksum: z.string() }),
          },
        },
      },
      async () => ({ checksum: "" }),
    );
    await witness.ready();
    try {
      expect(verificationResponseFindings(witness)).toEqual([
        expect.stringContaining(
          "GET /v1/me/tm11-verification-witness .checksum",
        ),
      ]);
    } finally {
      await witness.close();
    }
  });
});

describe("TM11 witnesses: a field added to a schema makes the check fail", () => {
  it("fails on a handle in a contract schema, at any depth", () => {
    const direct = z.strictObject({ id: z.string(), handle: z.string() });
    const nested = z.strictObject({
      items: z.array(
        z.strictObject({ card: z.strictObject({ handle: z.string() }) }),
      ),
    });
    expect(forbiddenFieldsOf(direct)).toHaveLength(1);
    expect(forbiddenFieldsOf(nested)).toEqual([
      expect.stringContaining(".items.card.handle"),
    ]);
    expect(forbiddenFieldsOf(z.strictObject({ id: z.string() }))).toEqual([]);
  });

  it("fails on a name spelled differently, and on a column the Drizzle tables hold", () => {
    for (const name of [
      "Handle",
      "profile_url",
      "followersCount",
      "legalFirstName",
      "postsLast30Days",
      "sector_code",
    ]) {
      expect(
        forbiddenFieldsOf(z.strictObject({ [name]: z.string() })),
        name,
      ).toHaveLength(1);
    }
  });

  it("lets a contact detail through only where it is allowed", () => {
    const schema = z.strictObject({ email: z.string() });
    expect(forbiddenFieldsOf(schema)).toHaveLength(1);
    expect(forbiddenFieldsOf(schema, ["email"])).toEqual([]);
  });

  it("fails on a route whose response schema declares a handle", async () => {
    const server = await readyServer();
    expect(responseFindings(server)).toEqual([]);
    const witness = buildServer(testApiConfig(), {
      logDestination: captureLogs().destination,
    });
    witness.get(
      "/v1/tm11-witness",
      {
        schema: {
          response: {
            200: z.strictObject({
              results: z.array(z.strictObject({ handle: z.string() })),
            }),
          },
        },
      },
      async () => ({ results: [] }),
    );
    await witness.ready();
    try {
      expect(responseFindings(witness)).toEqual([
        expect.stringContaining("GET /v1/tm11-witness .results.handle"),
      ]);
    } finally {
      await witness.close();
    }
  });
});

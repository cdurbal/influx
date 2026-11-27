// T17.4 (verrou 4, B9) and the guards of the staging operator scripts (D70 end-of-work review, T1
// and S2). No supabase/seed exists: the staging dataset is db:staging-demo-accounts alone, whose
// addresses are the internal testers' (posed by the agent, outside the rule); every address the
// repository could write into a database must therefore end with a reserved test domain.
import { valuesFoundIn } from "@influx/test-kit/logs";
import {
  S3_DOUBLE_DEFAULT_ACCESS_KEY_ID,
  S3_DOUBLE_DEFAULT_SECRET_ACCESS_KEY,
  startS3Double,
  type S3Double,
} from "@influx/test-kit/s3-double";
import { randomUUID } from "node:crypto";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoAccounts } from "../scripts/demo-accounts.ts";
import { generateBrands } from "../scripts/fake-profiles/brand-data.ts";
import { generateCreators } from "../scripts/fake-profiles/creator-data.ts";
import type { PhotoPool } from "../scripts/fake-profiles/images.ts";
import {
  productionProjectRefOfMigrationUrl,
  refuseProduction,
  requiredStagingUrl,
  stagingGoTrue,
  stagingR2,
  urlOf,
} from "../scripts/script-guards.ts";
import {
  reuploadSeedImages,
  type ReuploadDatabase,
  type SeededBrandLogoRow,
  type SeededPortfolioRow,
} from "../scripts/seed-staging-fake-profiles.ts";
import { createObjectStore } from "../src/platform/storage.ts";

const REPOSITORY = path.join(import.meta.dirname, "..", "..", "..");

/** RFC 2606 and RFC 6761: the only domains a dataset of the repository may use. */
const RESERVED_DOMAIN =
  /(^|\.)(example\.(com|net|org)|example|test|invalid|localhost)$/;

function filesUnder(directory: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(directory);
  } catch {
    return [];
  }
  return entries.flatMap((entry) => {
    const full = path.join(directory, entry);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

describe("T17.4: no real address in a dataset of the repository", () => {
  const sources = [
    ...filesUnder(path.join(REPOSITORY, "supabase", "seed")),
    ...filesUnder(path.join(REPOSITORY, "supabase", "migrations")),
    path.join(REPOSITORY, "apps", "api", "scripts", "demo-accounts.ts"),
  ];

  it("reads the migrations and the demo accounts", () => {
    expect(sources.length).toBeGreaterThan(1);
  });

  it("every address ends with a reserved test domain", () => {
    const outside = sources.flatMap((file) =>
      [
        ...readFileSync(file, "utf8").matchAll(
          /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g,
        ),
      ]
        .map((match) => match[1]?.toLowerCase() ?? "")
        .filter((domain) => !RESERVED_DOMAIN.test(domain))
        .map((domain) => `${path.relative(REPOSITORY, file)}: ${domain}`),
    );
    expect(outside).toEqual([]);
  });

  it("the default demo accounts use reserved domains", () => {
    for (const account of demoAccounts()) {
      expect(account.email.split("@")[1]).toMatch(RESERVED_DOMAIN);
    }
  });
});

describe("script guards (staging operator scripts)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ["INFLUX_ENV", "production"],
    ["NODE_ENV", "production"],
  ])("refuseProduction refuses %s=%s", (name, value) => {
    vi.stubEnv("INFLUX_ENV", "staging");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv(name, value);
    expect(() => {
      refuseProduction("x");
    }).toThrow("x refused in production");
  });

  it("refuseProduction lets staging through", () => {
    vi.stubEnv("INFLUX_ENV", "staging");
    vi.stubEnv("NODE_ENV", "test");
    expect(() => {
      refuseProduction("x");
    }).not.toThrow();
  });

  it("a malformed URL is refused without its value (S2)", () => {
    const value = "postgresql://postgres:hunter2-secret@[bad";
    vi.stubEnv("INFLUX_STAGING_MIGRATION_URL", value);
    let message = "";
    try {
      requiredStagingUrl("INFLUX_STAGING_MIGRATION_URL");
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toBe(
      "INFLUX_STAGING_MIGRATION_URL is not a valid URL (value not shown)",
    );
    expect(message).not.toContain("hunter2");
    expect(() => urlOf("X", value)).not.toThrow(/hunter2/);
  });

  it("stagingGoTrue refuses a key and a database of two projects (J4S-5)", () => {
    vi.stubEnv("SUPABASE_URL", "https://aaaaaaaaaaaaaaaa.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_x");
    vi.stubEnv(
      "INFLUX_STAGING_MIGRATION_URL",
      "postgresql://postgres.bbbbbbbbbbbbbbbb:p@aws-0-eu-west-3.pooler.supabase.com:5432/postgres",
    );
    expect(() => stagingGoTrue()).toThrow("name two different projects");
  });

  it("stagingGoTrue accepts one project", () => {
    vi.stubEnv("SUPABASE_URL", "https://aaaaaaaaaaaaaaaa.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_x");
    vi.stubEnv(
      "INFLUX_STAGING_MIGRATION_URL",
      "postgresql://postgres.aaaaaaaaaaaaaaaa:p@aws-0-eu-west-3.pooler.supabase.com:5432/postgres",
    );
    expect(stagingGoTrue().authUrl).toBe(
      "https://aaaaaaaaaaaaaaaa.supabase.co/auth/v1",
    );
  });

  it("stagingGoTrue refuses a SUPABASE_URL that is not a hosted https project", () => {
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
    expect(() => stagingGoTrue()).toThrow(
      "https origin of the staging project",
    );
  });

  it("productionProjectRefOfMigrationUrl extracts the ref of a pooler or direct URL and refuses non-Supabase URLs", () => {
    expect(
      productionProjectRefOfMigrationUrl(
        () =>
          "postgresql://postgres.abcdefghijklmnopqrst:secret@aws-0-eu-west-3.pooler.supabase.com:5432/postgres",
      ),
    ).toBe("abcdefghijklmnopqrst");
    expect(
      productionProjectRefOfMigrationUrl(
        () =>
          "postgresql://postgres:secret@db.abcdefghijklmnopqrst.supabase.co:5432/postgres",
      ),
    ).toBe("abcdefghijklmnopqrst");
    expect(() =>
      productionProjectRefOfMigrationUrl(
        () => "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      ),
    ).toThrow(/must name a hosted Supabase project/);
  });
});

describe("R2B-T5: stagingR2() and --reupload-images (RG20, CA22)", () => {
  const STAGING_ENDPOINT =
    "https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com";
  const EU_ENDPOINT =
    "https://0123456789abcdef0123456789abcdef.eu.r2.cloudflarestorage.com";
  const SECRET_KEY = "staging-r2-secret-never-shown-0123456789abcdef";
  const doubles: S3Double[] = [];
  const tempDirs: string[] = [];

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    await Promise.all(doubles.splice(0).map((double) => double.close()));
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function stubValidStagingR2(): void {
    vi.stubEnv("INFLUX_ENV", "staging");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("R2_ENDPOINT", STAGING_ENDPOINT);
    vi.stubEnv("R2_ACCESS_KEY_ID", "influx-staging-api-key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", SECRET_KEY);
    vi.stubEnv("R2_BUCKET_PREFIX", "influx-staging-");
  }

  it("stagingR2() accepts a valid staging R2 configuration", () => {
    stubValidStagingR2();
    expect(stagingR2()).toEqual({
      endpoint: STAGING_ENDPOINT,
      accessKeyId: "influx-staging-api-key",
      secretAccessKey: SECRET_KEY,
      bucketPrefix: "influx-staging-",
    });
  });

  it("stagingR2() refuses production without leaking values", () => {
    stubValidStagingR2();
    vi.stubEnv("INFLUX_ENV", "production");
    expect(() => stagingR2()).toThrow("staging R2 refused in production");

    vi.stubEnv("INFLUX_ENV", "staging");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => stagingR2()).toThrow("staging R2 refused in production");
  });

  it("stagingR2() refuses .eu. or non-staging endpoints without echoing the endpoint", () => {
    stubValidStagingR2();
    vi.stubEnv("R2_ENDPOINT", EU_ENDPOINT);
    let euMessage = "";
    try {
      stagingR2();
    } catch (error) {
      euMessage = error instanceof Error ? error.message : String(error);
    }
    expect(euMessage).toContain(".eu.");
    expect(valuesFoundIn(euMessage, [EU_ENDPOINT, SECRET_KEY])).toEqual([]);

    vi.stubEnv("R2_ENDPOINT", "http://127.0.0.1:4111");
    let localMessage = "";
    try {
      stagingR2();
    } catch (error) {
      localMessage = error instanceof Error ? error.message : String(error);
    }
    expect(localMessage).toContain("https://<32-hex>.r2.cloudflarestorage.com");
    expect(localMessage).not.toContain("127.0.0.1");
  });

  it("stagingR2() refuses any R2_BUCKET_PREFIX other than influx-staging- without echoing it", () => {
    stubValidStagingR2();
    vi.stubEnv("R2_BUCKET_PREFIX", "influx-production-");
    let message = "";
    try {
      stagingR2();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain("influx-staging-");
    expect(message).not.toContain("influx-production-");
  });

  it("--reupload-images writes once, treats 412 as skipped on re-run, updates differing metadata only, and never calls GoTrue", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const double = await startS3Double();
    doubles.push(double);
    const store = createObjectStore({
      endpoint: double.endpoint,
      accessKeyId: S3_DOUBLE_DEFAULT_ACCESS_KEY_ID,
      secretAccessKey: S3_DOUBLE_DEFAULT_SECRET_ACCESS_KEY,
      bucketPrefix: "test-",
    });

    const tempDir = mkdtempSync(path.join(tmpdir(), "influx-r2b-t5-"));
    tempDirs.push(tempDir);
    const photoPath = path.join(tempDir, "sample.jpg");
    await sharp({
      create: {
        width: 720,
        height: 720,
        channels: 3,
        background: { r: 40, g: 120, b: 90 },
      },
    })
      .jpeg({ quality: 85 })
      .toFile(photoPath);
    const pool: PhotoPool = new Map([["travel", [photoPath]]]);

    const [creator] = generateCreators(1, 20261114);
    const [brand] = generateBrands(1, 20261115);
    if (creator === undefined || brand === undefined) {
      throw new Error("expected synthetic creator and brand");
    }

    const creatorAccountId = randomUUID();
    const brandAccountId = randomUUID();
    const portfolioRows: SeededPortfolioRow[] = Array.from(
      { length: creator.portfolioCount },
      (_, offset) => {
        const itemId = randomUUID();
        return {
          accountId: creatorAccountId,
          email: creator.email,
          itemId,
          objectKey: `${creatorAccountId}/${itemId}.webp`,
          displayOrder: offset + 1,
          byteSize: 1,
          width: 1,
          height: 1,
          checksum: "stale",
        };
      },
    );
    const logoId = randomUUID();
    const logoRows: SeededBrandLogoRow[] = [
      {
        accountId: brandAccountId,
        email: brand.email,
        logoId,
        objectKey: `${brandAccountId}/${logoId}.webp`,
        byteSize: 1,
        width: 1,
        height: 1,
      },
    ];

    const db: ReuploadDatabase = {
      async listApprovedPortfolioItems() {
        return portfolioRows;
      },
      async listActiveBrandLogos() {
        return logoRows;
      },
      async updatePortfolioItemMetadata(itemId, image) {
        const row = portfolioRows.find((entry) => entry.itemId === itemId);
        if (row !== undefined) {
          row.byteSize = image.byteSize;
          row.width = image.width;
          row.height = image.height;
          row.checksum = image.checksum;
        }
      },
      async updateBrandLogoMetadata(id, image) {
        const row = logoRows.find((entry) => entry.logoId === id);
        if (row !== undefined) {
          row.byteSize = image.byteSize;
          row.width = image.width;
          row.height = image.height;
        }
      },
    };

    const first = await reuploadSeedImages({
      pool,
      store,
      db,
      creatorsCount: 1,
      brandsCount: 1,
    });
    const totalObjects = creator.portfolioCount + 1;
    expect(first).toEqual({
      written: totalObjects,
      skipped: 0,
      failed: 0,
      metadataUpdated: totalObjects,
    });
    expect(
      [...double.objects.keys()].filter((key) =>
        key.startsWith("test-portfolio/"),
      ),
    ).toHaveLength(creator.portfolioCount);
    expect(
      [...double.objects.keys()].filter((key) =>
        key.startsWith("test-brand-logo/"),
      ),
    ).toHaveLength(1);

    const second = await reuploadSeedImages({
      pool,
      store,
      db,
      creatorsCount: 1,
      brandsCount: 1,
    });
    expect(second).toEqual({
      written: 0,
      skipped: totalObjects,
      failed: 0,
      metadataUpdated: 0,
    });

    const requestedUrls = fetchSpy.mock.calls.map(([input]) => String(input));
    expect(requestedUrls.length).toBeGreaterThan(0);
    for (const url of requestedUrls) {
      expect(url.startsWith(double.endpoint)).toBe(true);
      expect(url).not.toContain("/auth/v1");
    }
    for (const [, init] of fetchSpy.mock.calls) {
      expect(init?.method).toBe("PUT");
    }
  });

  it("--reupload-images --dry-run writes nothing to R2 and updates no DB metadata", async () => {
    const double = await startS3Double();
    doubles.push(double);
    const store = createObjectStore({
      endpoint: double.endpoint,
      accessKeyId: S3_DOUBLE_DEFAULT_ACCESS_KEY_ID,
      secretAccessKey: S3_DOUBLE_DEFAULT_SECRET_ACCESS_KEY,
      bucketPrefix: "test-",
    });

    const tempDir = mkdtempSync(path.join(tmpdir(), "influx-r2b-t5-dry-"));
    tempDirs.push(tempDir);
    const photoPath = path.join(tempDir, "sample.jpg");
    await sharp({
      create: {
        width: 720,
        height: 720,
        channels: 3,
        background: { r: 90, g: 40, b: 120 },
      },
    })
      .jpeg({ quality: 85 })
      .toFile(photoPath);
    const pool: PhotoPool = new Map([["travel", [photoPath]]]);

    const [brand] = generateBrands(1, 20261115);
    if (brand === undefined) {
      throw new Error("expected synthetic brand");
    }
    const accountId = randomUUID();
    const logoId = randomUUID();
    const updateBrandLogoMetadata = vi.fn(async () => undefined);
    const db: ReuploadDatabase = {
      async listApprovedPortfolioItems() {
        return [];
      },
      async listActiveBrandLogos() {
        return [
          {
            accountId,
            email: brand.email,
            logoId,
            objectKey: `${accountId}/${logoId}.webp`,
            byteSize: 1,
            width: 1,
            height: 1,
          },
        ];
      },
      updatePortfolioItemMetadata: vi.fn(async () => undefined),
      updateBrandLogoMetadata,
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const result = await reuploadSeedImages({
      pool,
      store,
      db,
      dryRun: true,
      only: "brands",
      brandsCount: 1,
    });
    expect(result).toEqual({
      written: 1,
      skipped: 0,
      failed: 0,
      metadataUpdated: 0,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(updateBrandLogoMetadata).not.toHaveBeenCalled();
    expect(double.objects.size).toBe(0);
  });

  it("seed-staging-fake-profiles.ts uses stagingR2() and createObjectStore without x-upsert or storage/v1", () => {
    const source = readFileSync(
      path.join(
        REPOSITORY,
        "apps",
        "api",
        "scripts",
        "seed-staging-fake-profiles.ts",
      ),
      "utf8",
    );
    expect(source).toContain("stagingR2()");
    expect(source).toContain("createObjectStore");
    expect(source).not.toContain("x-upsert");
    expect(source).not.toContain("storage/v1");
  });
});

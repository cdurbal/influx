// T17.4 (verrou 4, B9) and the guards of the staging operator scripts (D70 end-of-work review, T1
// and S2). No supabase/seed exists: the staging dataset is db:staging-demo-accounts alone, whose
// addresses are the internal testers' (posed by the agent, outside the rule); every address the
// repository could write into a database must therefore end with a reserved test domain.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { demoAccounts } from "../scripts/demo-accounts.ts";
import {
  refuseProduction,
  requiredStagingUrl,
  stagingGoTrue,
  urlOf,
} from "../scripts/script-guards.ts";

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
});

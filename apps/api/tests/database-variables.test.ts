// 18 T4.6 g and h: the template of the database variables, and the disappearance of the old
// single elevated variable (21 §3 EC-20).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  apiEnvSchema,
  checkDatabaseUrl,
  DATABASE_URL_ROLES,
  workerEnvSchema,
} from "../src/config/schema.ts";

const API_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const REPOSITORY_ROOT = path.resolve(API_ROOT, "../..");

describe("T4.6 g: .env.example carries the three lines of EC-20", () => {
  const template = readFileSync(path.join(API_ROOT, ".env.example"), "utf8");

  it.each(Object.entries(DATABASE_URL_ROLES))(
    "%s names its role through the pooler, with a placeholder",
    (variable, role) => {
      const line = template
        .split("\n")
        .find((entry) => entry.startsWith(`${variable}=`));
      expect(line, variable).toBeDefined();
      const value = (line ?? "").slice(variable.length + 1).trim();
      expect(value).toBe(
        `postgresql://${role}.your-project-ref:CHANGE_ME@HOST:6543/postgres`,
      );
      // The role part is accepted; only the placeholder is refused (a copied template never starts).
      expect(checkDatabaseUrl(value, role)).toEqual({
        ok: false,
        message: "must not contain the CHANGE_ME placeholder",
      });
      expect(
        checkDatabaseUrl(value.replace("CHANGE_ME", "secret"), role).ok,
      ).toBe(true);
    },
  );
});

describe("T4.6 h: the single elevated variable has disappeared", () => {
  it("appears in no tracked file of apps/, packages/, supabase/ nor .github/", () => {
    // Built by concatenation so that this file does not match itself.
    const name = ["ELEVATED", "DATABASE", "URL"].join("_");
    const tracked = execFileSync(
      "git",
      ["ls-files", "apps", "packages", "supabase", ".github"],
      { cwd: REPOSITORY_ROOT, encoding: "utf8" },
    )
      .split("\n")
      .filter((file) => file.length > 0);
    const offenders = tracked.filter((file) => {
      try {
        return readFileSync(path.join(REPOSITORY_ROOT, file), "utf8").includes(
          name,
        );
      } catch {
        // A file deleted in the working tree but still tracked: nothing to read.
        return false;
      }
    });
    expect(offenders).toEqual([]);
  });
});

describe("T11.4: every variable read at startup is documented in .env.example", () => {
  const template = readFileSync(path.join(API_ROOT, ".env.example"), "utf8");
  /** Set by Railway on every service, never by hand (02 §12.3). */
  const PROVIDED_BY_RAILWAY = new Set(["RAILWAY_ENVIRONMENT_NAME"]);

  it.each([
    ["api", Object.keys(apiEnvSchema.in.shape)],
    ["worker", Object.keys(workerEnvSchema.in.shape)],
  ])("%s", (_service, variables) => {
    expect(variables.length).toBeGreaterThan(5);
    const missing = variables
      .filter((variable) => !PROVIDED_BY_RAILWAY.has(variable))
      .filter(
        (variable) => !new RegExp(`^(?:# )?${variable}=`, "m").test(template),
      );
    expect(missing).toEqual([]);
  });
});

describe("R2A-T4: .env.example documents the four R2 variables with fake loopback values", () => {
  const template = readFileSync(path.join(API_ROOT, ".env.example"), "utf8");

  function valueOf(variable: string): string {
    const line = template
      .split("\n")
      .find((entry) => entry.startsWith(`${variable}=`));
    expect(line, variable).toBeDefined();
    return (line ?? "").slice(variable.length + 1).trim();
  }

  it("sets R2_ENDPOINT to the local s3-double loopback and never a cloud R2 host", () => {
    const endpoint = valueOf("R2_ENDPOINT");
    expect(endpoint).toBe("http://127.0.0.1:4011");
    expect(endpoint).not.toContain("r2.cloudflarestorage.com");
  });

  it("uses CHANGE_ME placeholders on R2 credentials and >= 32 bytes for the secret", () => {
    const accessKey = valueOf("R2_ACCESS_KEY_ID");
    const secretKey = valueOf("R2_SECRET_ACCESS_KEY");
    const prefix = valueOf("R2_BUCKET_PREFIX");
    expect(accessKey).toContain("CHANGE_ME");
    expect(secretKey).toContain("CHANGE_ME");
    expect(new TextEncoder().encode(secretKey).length).toBeGreaterThanOrEqual(
      32,
    );
    expect(prefix).toBe("local-");
  });
});

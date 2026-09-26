// 18 T4.6 g and h: the template of the database variables, and the disappearance of the old
// single elevated variable (21 §3 EC-20).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { checkDatabaseUrl, DATABASE_URL_ROLES } from "../src/config/schema.ts";

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

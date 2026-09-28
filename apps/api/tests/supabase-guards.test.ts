// Static guards of the Supabase Auth adapter (21 §4, J3-B and J3-C rule 1): the two packages of
// the J3 at their exact versions, forbidden packages absent from the repository, one importer
// of @supabase/*, and no test helper (TOTP generator included) reachable from src/.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importSpecifiers } from "@influx/test-kit/guards";
import {
  findForbiddenPackages,
  forbiddenPackagesIn,
  forbiddenPackagesInLockfile,
  listSourceFiles,
  SCRIPT_EXTENSIONS,
} from "@influx/test-kit/static";
import { describe, expect, it } from "vitest";

const API_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const ROOT = path.resolve(API_ROOT, "../..");

function relative(file: string): string {
  return path.relative(API_ROOT, file).split(path.sep).join("/");
}

/** Files of apps/api/src importing a specifier that matches `pattern`. */
function importersOf(pattern: RegExp): string[] {
  return listSourceFiles(path.join(API_ROOT, "src"), SCRIPT_EXTENSIONS)
    .filter((file) =>
      importSpecifiers(readFileSync(file, "utf8")).some((specifier) =>
        pattern.test(specifier),
      ),
    )
    .map(relative)
    .sort();
}

describe("J3-B: dependencies of the J3", () => {
  it("declares @supabase/auth-js 2.117.2 and @fastify/cookie 11.1.2, exact versions", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(API_ROOT, "package.json"), "utf8"),
    ) as { dependencies: Record<string, string> };
    expect(manifest.dependencies["@supabase/auth-js"]).toBe("2.117.2");
    expect(manifest.dependencies["@fastify/cookie"]).toBe("11.1.2");
  });

  it("proves the guard on the witness manifest and lockfile line", () => {
    const witness = readFileSync(
      path.join(ROOT, "test-witnesses/j3b/package.json.txt"),
      "utf8",
    );
    expect(forbiddenPackagesIn(witness, "witness")).toEqual([
      "witness: @supabase/supabase-js in dependencies",
      "witness: @supabase/postgrest-js in devDependencies",
    ]);
    expect(
      forbiddenPackagesInLockfile(
        "  '@supabase/postgrest-js@2.117.2':\n    resolution: {}\n",
        "lock",
      ),
    ).toEqual(["lock: @supabase/postgrest-js"]);
    expect(forbiddenPackagesIn("not json", "broken")).toEqual([
      "broken: not valid JSON",
    ]);
  });

  it("finds neither @supabase/supabase-js nor @supabase/postgrest-js in the repository", () => {
    expect(findForbiddenPackages(ROOT)).toEqual([]);
  });
});

describe("J3-C rule 1: one module talks to Supabase Auth", () => {
  it("has src/platform/supabase.ts as the only importer of @supabase/*", () => {
    expect(importersOf(/^@supabase\//)).toEqual(["src/platform/supabase.ts"]);
  });

  it("never imports @influx/test-kit from src/ (its TOTP generator is for tests only, J3-B)", () => {
    expect(importersOf(/^@influx\/test-kit(?:\/|$)/)).toEqual([]);
  });
});

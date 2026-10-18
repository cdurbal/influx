// 16 RG148 and D70 (02 §12.4, 18 T17): apps/api/.env.local holds the values of staging, which sends
// for real. No automated test ever loads it: every test, test:db and e2e script of the monorepo, and
// the files that start their processes (Vitest and Playwright configurations, global setups, the
// api started by Playwright), are read here and must not name an environment file nor a loader.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

/** What loads an environment file: Node's flags and API, dotenv, or the file itself. */
const ENV_FILE_LOADER = /--env-file|loadEnvFile|dotenv|\.env\.local/;

/** A script run by the automated tests: test, test:*, and anything named e2e. */
function isTestScript(name: string): boolean {
  return name === "test" || name.startsWith("test:") || name.includes("e2e");
}

function packageFiles(): string[] {
  const files = [path.join(ROOT, "package.json")];
  for (const group of ["apps", "packages"]) {
    for (const entry of readdirSync(path.join(ROOT, group))) {
      const file = path.join(ROOT, group, entry, "package.json");
      if (statSync(file, { throwIfNoEntry: false })?.isFile() === true) {
        files.push(file);
      }
    }
  }
  return files;
}

function relative(file: string): string {
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

/** The test scripts of every package, as `<package.json>#<script>` → command. */
function testScripts(): Map<string, string> {
  const scripts = new Map<string, string>();
  for (const file of packageFiles()) {
    const manifest = JSON.parse(readFileSync(file, "utf8")) as {
      scripts?: Record<string, string>;
    };
    for (const [name, command] of Object.entries(manifest.scripts ?? {})) {
      if (isTestScript(name)) {
        scripts.set(`${relative(file)}#${name}`, command);
      }
    }
  }
  return scripts;
}

/** The files that start the test processes; comments are dropped, code only. */
const HARNESS_FILES = [
  "apps/api/vitest.config.ts",
  "apps/api/db-tests/global-setup.ts",
  "apps/web/vitest.config.ts",
  "apps/web/vitest.artifacts.config.ts",
  "apps/web/playwright.config.ts",
  "apps/web/e2e/global-setup.ts",
  "apps/web/e2e/start-api.ts",
  "apps/backoffice/vitest.config.ts",
  "apps/backoffice/vitest.artifacts.config.ts",
  "packages/contracts/vitest.config.ts",
  "packages/test-kit/vitest.config.ts",
];

function codeOf(file: string): string {
  return readFileSync(path.join(ROOT, file), "utf8")
    .split("\n")
    .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
    .join("\n");
}

describe("16 RG148: no automated test loads apps/api/.env.local (D70)", () => {
  it("proves the matcher on the dev scripts, which do load it", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(ROOT, "apps/api/package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    expect(manifest.scripts.dev).toMatch(ENV_FILE_LOADER);
    expect(isTestScript("dev")).toBe(false);
    expect(isTestScript("test:db")).toBe(true);
    expect(isTestScript("test:e2e")).toBe(true);
  });

  it("finds the test, test:db and e2e scripts", () => {
    const names = [...testScripts().keys()];
    expect(names).toContain("apps/api/package.json#test:db");
    expect(names).toContain("apps/api/package.json#test:unit");
    expect(names).toContain("apps/web/package.json#test:e2e");
    expect(names).toContain("package.json#test");
  });

  it("no test, test:db or e2e script names an environment file or a loader", () => {
    const offending = [...testScripts()]
      .filter(([, command]) => ENV_FILE_LOADER.test(command))
      .map(([name]) => name);
    expect(offending).toEqual([]);
  });

  it("no Vitest or Playwright harness file loads an environment file", () => {
    const offending = HARNESS_FILES.filter((file) =>
      ENV_FILE_LOADER.test(codeOf(file)),
    );
    expect(offending).toEqual([]);
  });
});

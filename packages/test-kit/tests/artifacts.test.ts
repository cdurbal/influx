// Self-checks of the T11 artifact scanner: it must find what it is meant to find.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  API_RUNTIME_DIRECTORIES,
  readBuiltStylesheets,
  scanApiRuntimeFiles,
  scanBuildArtifacts,
} from "../src/artifacts.ts";

let appRoot = "";
let nextDirectory = "";

function writeArtifact(relative: string, content: string): void {
  const file = path.join(nextDirectory, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

// Fake values assembled at run time, so that this source file never holds a secret-like literal.
const FAKE_JWT = [
  "eyJhbGciOiJIUzI1NiJ9",
  "eyJzdWIiOiJ0ZXN0In0",
  "c2lnbmF0dXJlLXZhbHVl",
].join(".");
const FAKE_POSTGRES_URL = [
  "postgresql",
  "://user:password",
  "@host:5432/postgres",
].join("");
const FAKE_SUPABASE_SECRET = ["sb", "secret", "AbCdEfGh12345678ijkl"].join("_");
const FAKE_BREVO_KEY = ["xkeysib", "0123456789abcdef".repeat(4)].join("-");

beforeEach(() => {
  appRoot = mkdtempSync(path.join(tmpdir(), "influx-artifacts-"));
  nextDirectory = path.join(appRoot, ".next");
});

afterEach(() => {
  rmSync(appRoot, { recursive: true, force: true });
});

describe("readBuiltStylesheets (G3i b)", () => {
  it("throws when there is no built stylesheet", () => {
    expect(() => readBuiltStylesheets(nextDirectory)).toThrow(/run the build/);
    writeArtifact("static/chunks/app.js", "console.log('hello');");
    expect(() => readBuiltStylesheets(nextDirectory)).toThrow(/run the build/);
  });

  it("joins the stylesheets of .next/static, and nothing else", () => {
    writeArtifact("static/chunks/a.css", ".a{color:red}");
    writeArtifact("static/chunks/b.css", ".b{color:blue}");
    writeArtifact("server/app/c.css", ".c{color:green}");
    const css = readBuiltStylesheets(nextDirectory);
    expect(css).toContain(".a{color:red}");
    expect(css).toContain(".b{color:blue}");
    expect(css).not.toContain(".c{");
  });
});

describe("scanBuildArtifacts (T11)", () => {
  it("throws when there is no build output", () => {
    expect(() => scanBuildArtifacts(nextDirectory)).toThrow(/run the build/);
  });

  it("accepts a clean build", () => {
    writeArtifact("static/chunks/app.js", "console.log('hello');");
    writeArtifact("server/app/page.js", "process.env.SOME_SERVER_VALUE;");
    expect(scanBuildArtifacts(nextDirectory)).toEqual([]);
  });

  it("finds a server variable name in browser code only", () => {
    writeArtifact("static/chunks/app.js", "const k = 'BREVO_API_KEY';");
    // Server bundles may name server variables: only `.next/static` reaches the browser.
    writeArtifact("server/relay.js", "process.env.INFLUX_API_INTERNAL_SECRET;");
    expect(scanBuildArtifacts(nextDirectory)).toEqual([
      ".next/static/chunks/app.js: server name BREVO_",
    ]);
  });

  it("finds a JWT-like string and a Postgres connection string anywhere in the build", () => {
    writeArtifact("static/chunks/app.js", "ok");
    writeArtifact("server/a.js", `const token = "${FAKE_JWT}";`);
    writeArtifact("cache/b.bin", `x${FAKE_POSTGRES_URL}x`);
    expect(scanBuildArtifacts(nextDirectory).sort()).toEqual([
      ".next/cache/b.bin: Postgres connection string",
      ".next/server/a.js: JWT-like string",
    ]);
  });

  it("finds the value of a Supabase secret key and of a Brevo key anywhere in the build", () => {
    writeArtifact("static/chunks/app.js", "ok");
    writeArtifact("server/c.js", `const a = "${FAKE_SUPABASE_SECRET}";`);
    writeArtifact("server/d.js", `const b = "${FAKE_BREVO_KEY}";`);
    expect(scanBuildArtifacts(nextDirectory).sort()).toEqual([
      ".next/server/c.js: Supabase secret key",
      ".next/server/d.js: Brevo key",
    ]);
  });
});

describe("scanApiRuntimeFiles (T11, the third artifact: apps/api runs its sources)", () => {
  function writeRuntime(relative: string, content: string): void {
    const file = path.join(appRoot, relative);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, content);
  }

  it("throws when a runtime directory is missing", () => {
    expect(() => scanApiRuntimeFiles(appRoot)).toThrow(
      /Missing runtime directory/,
    );
  });

  it("finds a secret value in any runtime directory, never in the tests", () => {
    for (const directory of API_RUNTIME_DIRECTORIES) {
      writeRuntime(`${directory}/clean.ts`, "export const ok = 1;");
    }
    writeRuntime(
      "apps/api/src/config/leak.ts",
      `const url = "${FAKE_POSTGRES_URL}";`,
    );
    writeRuntime("deploy/railway/leak.json", `{"key":"${FAKE_BREVO_KEY}"}`);
    writeRuntime("apps/api/tests/fixture.ts", `const jwt = "${FAKE_JWT}";`);
    expect(scanApiRuntimeFiles(appRoot).sort()).toEqual([
      "apps/api/src/config/leak.ts: Postgres connection string",
      "deploy/railway/leak.json: Brevo key",
    ]);
  });
});

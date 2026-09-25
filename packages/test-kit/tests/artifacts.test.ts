// Self-checks of the T11 artifact scanner: it must find what it is meant to find.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scanBuildArtifacts } from "../src/artifacts.ts";

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

beforeEach(() => {
  appRoot = mkdtempSync(path.join(tmpdir(), "influx-artifacts-"));
  nextDirectory = path.join(appRoot, ".next");
});

afterEach(() => {
  rmSync(appRoot, { recursive: true, force: true });
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
});

// The guards of `pnpm trial:record` (16 RG115 points 2 and 4; D62; J7 commit 10): each mode that
// reaches a provider or opens a port is refused in production and in CI before it does anything.
// The real script runs in a child process, without any .env file, so that nothing can be reached.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = path.join(
  import.meta.dirname,
  "..",
  "scripts",
  "record-provider-exchanges.ts",
);

function run(mode: string, environment: Record<string, string>) {
  // The guards' own variables come from the case only, never from the shell running the tests.
  const guarded = new Set([
    "CI",
    "RAILWAY_ENVIRONMENT",
    "INFLUX_ENV",
    "NODE_ENV",
  ]);
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !guarded.has(name)),
  );
  return spawnSync(process.execPath, [SCRIPT, mode], {
    env: { ...inherited, ...environment },
    encoding: "utf8",
    timeout: 20_000,
  });
}

describe.each(["reconciliation", "inbound"])("trial:record %s", (mode) => {
  it("is refused in production", () => {
    const child = run(mode, { INFLUX_ENV: "production" });
    expect(child.status).not.toBe(0);
    expect(child.stderr).toContain("refused in production");
    expect(child.stdout).toBe("");
  });

  it("is refused in CI", () => {
    const child = run(mode, { CI: "true" });
    expect(child.status).not.toBe(0);
    expect(child.stderr).toContain("refused on Railway and in CI");
    expect(child.stdout).toBe("");
  });
});

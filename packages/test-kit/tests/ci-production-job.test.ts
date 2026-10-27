// J9T-2 (end-of-J9 review): the "Migrate production" job of .github/workflows/ci.yml stays inert
// until the founder turns it on, never runs from another branch, never deploys, and only migrates a
// base that carries the production marker and not the staging one (runbook production, sections 1
// and 3; EC-J9-8). The workflow is read as text: no YAML library for a handful of checks.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const WORKFLOWS = path.join(ROOT, ".github/workflows");
const CI = readFileSync(path.join(WORKFLOWS, "ci.yml"), "utf8");

/** The jobs of the workflow, by name: the lines from `  <name>:` to the next job. */
function jobsOf(workflow: string): Map<string, string> {
  const lines = workflow.split(/\r?\n/);
  const start = lines.findIndex((line) => line === "jobs:");
  const jobs = new Map<string, string>();
  let name: string | undefined;
  let body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    const match = /^ {2}([a-z0-9-]+):$/.exec(line);
    if (match) {
      if (name) jobs.set(name, body.join("\n"));
      name = match[1];
      body = [];
    } else if (name) {
      body.push(line);
    }
  }
  if (name) jobs.set(name, body.join("\n"));
  return jobs;
}

/** The lines that are not comments: a comment may name what the job must never do. */
function code(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("#"))
    .join("\n");
}

const JOBS = jobsOf(CI);
const JOB = code(JOBS.get("migrate-production") ?? "");

describe("J9T-2: the Migrate production job", () => {
  it("exists, next to the job of staging", () => {
    expect(JOBS.has("migrate-staging")).toBe(true);
    expect(JOB).not.toBe("");
  });

  it("runs on a push to the production branch only, once the founder's variable is true", () => {
    const condition = /if: >-\n([\s\S]*?)\n {4}needs:/.exec(JOB)?.[1] ?? "";
    expect(condition).toContain("github.event_name == 'push'");
    expect(condition).toContain("github.ref == 'refs/heads/production'");
    expect(condition).toContain("vars.PRODUCTION_MIGRATION_ENABLED == 'true'");
    expect(condition).not.toContain("||");
  });

  it("waits for the required jobs", () => {
    expect(JOB).toMatch(/needs: \[check, relay-node-24\]/);
  });

  it("is the only job that names the production environment", () => {
    for (const [name, body] of JOBS) {
      if (name === "migrate-production") continue;
      expect(code(body), name).not.toMatch(/environment:\s*production/);
    }
    expect(JOB).toMatch(/^ {4}environment: production$/m);
  });

  it("requires the production marker and refuses the staging marker", () => {
    expect(JOB).toContain(
      "to_regclass('influx_production.environment_marker') is not null and to_regclass('influx_staging.environment_marker') is null",
    );
    expect(JOB).toContain('if [ "$marker" != "t" ]; then');
  });

  it("gives the secret to the steps, never to the install", () => {
    const install =
      /- name: Install dependencies\n([\s\S]*?)\n {6}- name:/.exec(JOB)?.[1];
    expect(install).toBeDefined();
    expect(install).not.toContain("secrets.");
  });

  it("never deploys: no `railway` command in any workflow", () => {
    for (const file of ["ci.yml", "weekly.yml"]) {
      const text = code(readFileSync(path.join(WORKFLOWS, file), "utf8"));
      expect(text, file).not.toMatch(/\brailway\s+(up|deploy|redeploy)\b/);
    }
  });
});

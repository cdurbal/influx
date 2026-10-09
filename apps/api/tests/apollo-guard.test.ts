// Skill env-secrets: APOLLO_API_KEY belongs to the worker alone. The code loaded by the HTTP process
// reaches no module of the Apollo connector, and the Apollo host is named by the configuration only.
import {
  listSourceFiles,
  namesIn,
  reachableModules,
  SCRIPT_EXTENSIONS,
} from "@influx/test-kit/static";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const API_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const PACKAGES = path.resolve(API_ROOT, "../../packages");
const CONFIG = path.join(API_ROOT, "src/config/schema.ts");
const APOLLO = path.join(API_ROOT, "src/domains/leads/connectors/apollo");

function relative(file: string): string {
  return path.relative(API_ROOT, file).replace(/\\/g, "/");
}

describe("APOLLO_API_KEY: the worker's only", () => {
  it("the worker reaches the Apollo connector, main.ts does not", () => {
    const apollo = (modules: string[]) =>
      modules.filter((file) => file.startsWith(APOLLO)).map(relative);
    expect(
      apollo(reachableModules(path.join(API_ROOT, "src/worker.ts"), PACKAGES)),
    ).toContain("src/domains/leads/connectors/apollo/client.ts");
    expect(
      apollo(reachableModules(path.join(API_ROOT, "src/main.ts"), PACKAGES)),
    ).toEqual([]);
  });

  it("names the Apollo host in the configuration only", () => {
    const files = listSourceFiles(
      path.join(API_ROOT, "src"),
      SCRIPT_EXTENSIONS,
    );
    const naming = files.filter((file) =>
      namesIn(file).some((name) => name.includes("apollo.io")),
    );
    expect(naming.map(relative)).toEqual([relative(CONFIG)]);
  });
});

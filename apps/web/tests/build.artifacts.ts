// Checks on the build output of apps/web, run by `test:artifacts` after `next build`
// (docs/mvp/03-matrice-des-droits-et-rls.md §8, docs/mvp/18 T7.10 and T11,
// docs/mvp/21-plan-de-developpement.md §4, J1-H and J1-J T-3).
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scanBuildArtifacts } from "@influx/test-kit/artifacts";
import { describe, expect, it } from "vitest";

const NEXT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".next",
);

describe("T11: no secret in the build artifacts", () => {
  it("ships no server variable name to the browser and no credential anywhere", () => {
    expect(scanBuildArtifacts(NEXT_DIR)).toEqual([]);
  });
});

/**
 * The patterns of the proxy (src/proxy.ts) as compiled by Next.js 16 for the Node.js runtime:
 * `functions["/_middleware"].matchers[].regexp` of `.next/server/functions-config-manifest.json`.
 * The source text of the matcher is not enough: a missing escape only shows once compiled.
 * Throws when the manifest or the proxy entry is missing, so that a layout change of a future
 * Next.js version fails the check instead of passing it.
 */
function compiledProxyPatterns(): RegExp[] {
  const manifestFile = path.join(
    NEXT_DIR,
    "server",
    "functions-config-manifest.json",
  );
  if (!existsSync(manifestFile)) {
    throw new Error(`No ${manifestFile}: run the build before test:artifacts.`);
  }
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8")) as {
    functions?: Record<string, { matchers?: Array<{ regexp?: string }> }>;
  };
  const matchers = manifest.functions?.["/_middleware"]?.matchers ?? [];
  const patterns = matchers.flatMap((matcher) =>
    typeof matcher.regexp === "string" ? [new RegExp(matcher.regexp)] : [],
  );
  if (patterns.length === 0) {
    throw new Error("The compiled proxy has no matcher in the manifest.");
  }
  return patterns;
}

function proxyRunsOn(pathname: string): boolean {
  return compiledProxyPatterns().some((pattern) => pattern.test(pathname));
}

describe("T7.10: the compiled proxy matcher (21 J1-C point 3, J1-J T-3)", () => {
  it.each([
    "/api/v1/status",
    "/api/v1/bo/status",
    "/_next/x",
    "/favicon.ico",
    // EC-22: the health route, exactly
    "/health",
  ])("never runs on %s", (pathname) => {
    expect(proxyRunsOn(pathname)).toBe(false);
  });

  it.each(["/", "/fr", "/en", "/xyz", "/healthy", "/health/x"])(
    "runs on %s",
    (pathname) => {
      expect(proxyRunsOn(pathname)).toBe(true);
    },
  );
});

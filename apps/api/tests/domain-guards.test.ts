// Guards of packages/domain and of the brand profile contract (docs/mvp/jalons/l2b/stockage.md §9;
// 06 RG57): the completeness score is computed at ONE place, packages/domain/src, and nowhere else
// (a second copy would drift from the first, CLAUDE.md §2 spirit applied to the score); the domain
// has one importer at L2B, the profile domain of apps/api; the code lists the contract repeats
// (it carries no dependency on the domain) are held equal to the domain's.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BRAND_PROFILE_REQUIRED_FIELD_CODES,
  COMPLETENESS_BLOCK_IDS,
  COMPLETENESS_CRITERION_CODES,
} from "@influx/contracts/brand-profile";
import {
  BRAND_PROFILE_REQUIRED_FIELDS,
  BRAND_PROFILE_WEIGHTS,
} from "@influx/domain/brand-profile";
import { importSpecifiers } from "@influx/test-kit/guards";
import { listSourceFiles, SCRIPT_EXTENSIONS } from "@influx/test-kit/static";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

/** Every `src` directory of the repository's apps and packages. */
const SOURCE_ROOTS = [
  "apps/api/src",
  "apps/backoffice/src",
  "apps/web/src",
  "packages/contracts/src",
  "packages/domain/src",
  "packages/test-kit/src",
  "packages/ui/src",
  "packages/web-platform/src",
];

function relative(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function sourcesOf(roots: readonly string[]): string[] {
  return roots.flatMap((root) =>
    listSourceFiles(path.join(ROOT, root), SCRIPT_EXTENSIONS),
  );
}

const FUNCTION_DECLARATION =
  /\bfunction\s*\*?\s+([A-Za-z0-9_$]*[Cc]ompleteness[A-Za-z0-9_$]*)\s*[(<]/g;
const FUNCTION_VALUE =
  /\b(?:const|let|var)\s+([A-Za-z0-9_$]*[Cc]ompleteness[A-Za-z0-9_$]*)\s*(?::[^=]+)?=\s*(?:async\s+)?(?:function\b|(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*(?::[^=>]+)?=>)/g;

/** Names of the functions a source defines whose name holds "completeness" (either case). */
export function completenessFunctionsIn(source: string): string[] {
  return [
    ...[...source.matchAll(FUNCTION_DECLARATION)].map(
      (match) => match[1] ?? "",
    ),
    ...[...source.matchAll(FUNCTION_VALUE)].map((match) => match[1] ?? ""),
  ];
}

describe("the completeness is computed in packages/domain only (stockage.md §9)", () => {
  it("finds a declared, an arrow and a function-expression definition, and nothing else", () => {
    expect(
      completenessFunctionsIn(
        [
          "export function brandProfileCompleteness(input) {}",
          "export const scoreCompleteness = (input: X): number => 1;",
          "const profileCompleteness = async (a, b) => 1;",
          "let completenessOf = function (input) {};",
          "export const completenessOf2 = input => 1;",
        ].join("\n"),
      ),
    ).toEqual([
      "brandProfileCompleteness",
      "scoreCompleteness",
      "profileCompleteness",
      "completenessOf",
      "completenessOf2",
    ]);
    expect(
      completenessFunctionsIn(
        [
          'import { brandProfileCompleteness } from "@influx/domain/brand-profile";',
          "export const brandProfileCompletenessSchema = z.strictObject({});",
          "export type BrandProfileCompletenessView = X;",
          "const score = brandProfileCompleteness(input);",
          "const completeness = scoreOf(stored);",
        ].join("\n"),
      ),
    ).toEqual([]);
  });

  it("has no such function in any source outside packages/domain/src", () => {
    const outside = sourcesOf(
      SOURCE_ROOTS.filter((root) => root !== "packages/domain/src"),
    );
    expect(outside.length).toBeGreaterThan(100);
    const found = outside.flatMap((file) =>
      completenessFunctionsIn(readFileSync(file, "utf8")).map(
        (name) => `${relative(file)}: ${name}`,
      ),
    );
    expect(found).toEqual([]);
  });

  it("has the function in packages/domain/src, where it belongs", () => {
    const inside = sourcesOf(["packages/domain/src"]).flatMap((file) =>
      completenessFunctionsIn(readFileSync(file, "utf8")),
    );
    expect(inside).toEqual(["brandProfileCompleteness"]);
  });
});

describe("@influx/domain at L2B", () => {
  it("is imported by the profile domain of apps/api and the alerts of queue 1 (L2C 11), and nobody else (no front yet)", () => {
    const importers = sourcesOf(
      SOURCE_ROOTS.filter((root) => root !== "packages/domain/src"),
    )
      .filter((file) =>
        importSpecifiers(readFileSync(file, "utf8")).some((specifier) =>
          /^@influx\/domain(?:\/|$)/.test(specifier),
        ),
      )
      .map(relative);
    expect(importers).toEqual([
      "apps/api/src/domains/backoffice/queues/entry-alerts.ts",
      "apps/api/src/domains/profiles/brand-profile.ts",
    ]);
  });

  it("is the ONE call site of brandProfileCompleteness in the repository's sources", () => {
    const callers = sourcesOf(
      SOURCE_ROOTS.filter((root) => root !== "packages/domain/src"),
    )
      .filter((file) =>
        /\bbrandProfileCompleteness\s*\(/.test(readFileSync(file, "utf8")),
      )
      .map(relative);
    expect(callers).toEqual(["apps/api/src/domains/profiles/brand-profile.ts"]);
  });
});

describe("the contract repeats the code lists of the domain, equal (it has no dependency on it)", () => {
  it("lists the required fields in the same order", () => {
    expect([...BRAND_PROFILE_REQUIRED_FIELD_CODES]).toEqual([
      ...BRAND_PROFILE_REQUIRED_FIELDS,
    ]);
  });

  it("lists the criteria and the blocks of the score in the same order", () => {
    expect([...COMPLETENESS_CRITERION_CODES]).toEqual(
      BRAND_PROFILE_WEIGHTS.map((weight) => weight.code),
    );
    expect([...COMPLETENESS_BLOCK_IDS]).toEqual([
      ...new Set(BRAND_PROFILE_WEIGHTS.map((weight) => weight.block)),
    ]);
  });
});

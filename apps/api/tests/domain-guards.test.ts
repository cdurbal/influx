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
  CREATOR_BIO_MAX_LENGTH,
  CREATOR_COMPLETENESS_BLOCK_IDS,
  CREATOR_COMPLETENESS_CRITERION_CODES,
  CREATOR_HEADLINE_MAX_LENGTH,
  CREATOR_PROFILE_REQUIRED_FIELD_CODES,
} from "@influx/contracts/creator-profile";
import {
  BRAND_PROFILE_REQUIRED_FIELDS,
  BRAND_PROFILE_WEIGHTS,
} from "@influx/domain/brand-profile";
import {
  BIO_MAX_LENGTH,
  CREATOR_PROFILE_REQUIRED_FIELDS,
  CREATOR_PROFILE_WEIGHTS,
  HEADLINE_MAX_LENGTH,
} from "@influx/domain/creator-profile";
import {
  CREATOR_VERIFICATION_LEVELS as CONTRACT_CREATOR_LEVELS,
  VERIFICATION_BADGE_STATES as CONTRACT_BADGE_STATES,
  VERIFICATION_ENGAGEMENT_BP_MAX,
  VERIFICATION_EVIDENCE_SOURCES as CONTRACT_EVIDENCE_SOURCES,
  VERIFICATION_EVIDENCE_STATES as CONTRACT_EVIDENCE_STATES,
  VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH,
  VERIFICATION_LEGAL_NAME_MAX_LENGTH,
  VERIFICATION_LEVELS as CONTRACT_LEVELS,
  VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH,
  VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH,
  VERIFICATION_OBSERVED_HANDLE_MAX_LENGTH,
  VERIFICATION_POSTS_LAST_30_DAYS_MAX,
  VERIFICATION_REGISTRATION_NUMBER_MAX_LENGTH,
  VERIFICATION_REQUEST_STATUSES as CONTRACT_REQUEST_STATUSES,
} from "@influx/contracts/verification";
import {
  CREATOR_VERIFICATION_LEVELS,
  INTERNAL_COMMENT_MAX_LENGTH,
  LEGAL_NAME_MAX_LENGTH,
  MEMBER_MESSAGE_MAX_LENGTH,
  MEMBER_MESSAGE_MIN_LENGTH,
  OBSERVED_ENGAGEMENT_BP_MAX,
  OBSERVED_HANDLE_MAX_LENGTH,
  POSTS_LAST_30_DAYS_MAX,
  REGISTRATION_NUMBER_MAX_LENGTH,
  VERIFICATION_BADGE_STATES,
  VERIFICATION_EVIDENCE_SOURCES,
  VERIFICATION_EVIDENCE_STATES,
  VERIFICATION_LEVELS,
  VERIFICATION_REQUEST_STATUSES,
} from "@influx/domain/verification";
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
    expect(inside).toEqual([
      "brandProfileCompleteness",
      "creatorProfileCompleteness",
    ]);
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
      "apps/api/src/domains/profiles/creator/networks.ts",
      "apps/api/src/domains/profiles/creator/profile.ts",
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

  it("is the ONE call site of creatorProfileCompleteness in the repository's sources (L2D 08)", () => {
    const callers = sourcesOf(
      SOURCE_ROOTS.filter((root) => root !== "packages/domain/src"),
    )
      .filter((file) =>
        /\bcreatorProfileCompleteness\s*\(/.test(readFileSync(file, "utf8")),
      )
      .map(relative);
    expect(callers).toEqual([
      "apps/api/src/domains/profiles/creator/profile.ts",
    ]);
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

  it("lists the required fields of the creator profile in the same order (L2D 08)", () => {
    expect([...CREATOR_PROFILE_REQUIRED_FIELD_CODES]).toEqual([
      ...CREATOR_PROFILE_REQUIRED_FIELDS,
    ]);
  });

  it("lists the criteria and the blocks of the creator score in the same order (L2D 08)", () => {
    expect([...CREATOR_COMPLETENESS_CRITERION_CODES]).toEqual(
      CREATOR_PROFILE_WEIGHTS.map((weight) => weight.code),
    );
    expect([...CREATOR_COMPLETENESS_BLOCK_IDS]).toEqual([
      ...new Set(CREATOR_PROFILE_WEIGHTS.map((weight) => weight.block)),
    ]);
  });

  it("repeats the ceilings of the short title and the bio, equal (L2D 08)", () => {
    expect(CREATOR_HEADLINE_MAX_LENGTH).toBe(HEADLINE_MAX_LENGTH);
    expect(CREATOR_BIO_MAX_LENGTH).toBe(BIO_MAX_LENGTH);
  });

  it("lists the levels, states and sources of the verification in the same order (L2E 11)", () => {
    expect([...CONTRACT_LEVELS]).toEqual([...VERIFICATION_LEVELS]);
    expect([...CONTRACT_CREATOR_LEVELS]).toEqual([
      ...CREATOR_VERIFICATION_LEVELS,
    ]);
    expect([...CONTRACT_REQUEST_STATUSES]).toEqual([
      ...VERIFICATION_REQUEST_STATUSES,
    ]);
    expect([...CONTRACT_BADGE_STATES]).toEqual([...VERIFICATION_BADGE_STATES]);
    expect([...CONTRACT_EVIDENCE_STATES]).toEqual([
      ...VERIFICATION_EVIDENCE_STATES,
    ]);
    expect([...CONTRACT_EVIDENCE_SOURCES]).toEqual([
      ...VERIFICATION_EVIDENCE_SOURCES,
    ]);
  });

  it("repeats the bounds of what an agent types, equal (L2E 11)", () => {
    expect(VERIFICATION_OBSERVED_HANDLE_MAX_LENGTH).toBe(
      OBSERVED_HANDLE_MAX_LENGTH,
    );
    expect(VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH).toBe(
      INTERNAL_COMMENT_MAX_LENGTH,
    );
    expect(VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH).toBe(
      MEMBER_MESSAGE_MIN_LENGTH,
    );
    expect(VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH).toBe(
      MEMBER_MESSAGE_MAX_LENGTH,
    );
    expect(VERIFICATION_LEGAL_NAME_MAX_LENGTH).toBe(LEGAL_NAME_MAX_LENGTH);
    expect(VERIFICATION_REGISTRATION_NUMBER_MAX_LENGTH).toBe(
      REGISTRATION_NUMBER_MAX_LENGTH,
    );
    expect(VERIFICATION_POSTS_LAST_30_DAYS_MAX).toBe(POSTS_LAST_30_DAYS_MAX);
    expect(VERIFICATION_ENGAGEMENT_BP_MAX).toBe(OBSERVED_ENGAGEMENT_BP_MAX);
  });
});

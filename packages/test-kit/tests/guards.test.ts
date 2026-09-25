// Self-checks of the shared guard helpers: a detector that no longer detects is a test that lies
// (docs/mvp/18-plan-de-test-mvp.md §5, G7).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  classConflicts,
  classesOf,
  findClassListConflicts,
  findMatches,
  findPrimitiveBaseClassConflicts,
  HARD_CODED_COLOR_PATTERN,
  HARD_CODED_LENGTH_PATTERN,
  listFiles,
} from "../src/guards.ts";

const TEMP_ROOT = mkdtempSync(path.join(tmpdir(), "influx-test-kit-"));

function writeFixture(relative: string, content: string): string {
  const file = path.join(TEMP_ROOT, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

afterAll(() => {
  rmSync(TEMP_ROOT, { recursive: true, force: true });
});

describe("file helpers", () => {
  it("lists files recursively and reports matches with a relative path and line", () => {
    const file = writeFixture("list/a/b.ts", "first\nmailto:x\n");
    expect(listFiles(path.join(TEMP_ROOT, "list"))).toEqual([file]);
    expect(findMatches(/mailto:/g, [file, file], TEMP_ROOT)).toEqual([
      "list/a/b.ts:2: mailto:x",
      "list/a/b.ts:2: mailto:x",
    ]);
  });
});

describe("G3 patterns", () => {
  it("detects hexadecimal colors, color functions and literal lengths", () => {
    expect(HARD_CODED_COLOR_PATTERN.test("color: #22c55e;")).toBe(true);
    expect(HARD_CODED_COLOR_PATTERN.test("rgba(0, 0, 0, 0.5)")).toBe(true);
    expect(HARD_CODED_LENGTH_PATTERN.test("margin: 12px")).toBe(true);
    expect(HARD_CODED_LENGTH_PATTERN.test("gap: 1.5rem")).toBe(true);
    expect(HARD_CODED_COLOR_PATTERN.test("var(--color-brand-primary)")).toBe(
      false,
    );
    expect(HARD_CODED_LENGTH_PATTERN.test("p-(--spacing-inset-card)")).toBe(
      false,
    );
  });
});

describe("G7 detector", () => {
  it("fails on a known conflicting example (self-check of the detector)", () => {
    expect(
      classConflicts(classesOf(`"w-full" "aspect-4/5 w-1/3 sm:w-full"`)),
    ).toEqual(["|width"]);
    expect(classConflicts(classesOf(`"w-1/3 sm:w-full"`))).toEqual([]);
  });

  it("checks each side of a ternary apart", () => {
    const file = writeFixture(
      "src/Ternary.tsx",
      `const c = cn("flex", open ? "w-full" : "w-1/2");\n`,
    );
    expect(findClassListConflicts([file], TEMP_ROOT)).toEqual([]);
    const conflicting = writeFixture(
      "src/Conflict.tsx",
      `export const X = <div className="w-full w-1/2" />;\n`,
    );
    expect(findClassListConflicts([conflicting], TEMP_ROOT)).toEqual([
      `src/Conflict.tsx: |width in "w-full w-1/2"`,
    ]);
  });

  it("flags a width in the base classes of a primitive, but not an opt-in class", () => {
    const file = writeFixture(
      "src/ui/Primitive.tsx",
      `cn("w-full whitespace-nowrap", fullWidth && "w-full", className)\n`,
    );
    expect(findPrimitiveBaseClassConflicts([file], TEMP_ROOT)).toEqual([
      "src/ui/Primitive.tsx: w-full",
      "src/ui/Primitive.tsx: whitespace-nowrap",
    ]);
  });
});

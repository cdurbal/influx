// 18 §3 rule 2: the database tests are never skipped. A `.skip`, `.todo`, `.skipIf` or `.only`
// in db-tests/ fails the run. A dynamic skip, a removed case or an empty `it.each` escapes this
// static guard: the floor of executed cases per file catches them (scripts/check-db-case-floors.ts,
// db-tests/case-floors.ts, 21 Q2).
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DB_TESTS = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../db-tests",
);

describe("database tests are never skipped", () => {
  it("contain no skip, todo, skipIf, runIf or only", () => {
    const offenders = readdirSync(DB_TESTS)
      .filter((name) => name.endsWith(".ts"))
      .filter((name) =>
        /\b(?:it|test|describe)\s*\.\s*(?:skip|todo|skipIf|runIf|only)\b/.test(
          readFileSync(path.join(DB_TESTS, name), "utf8"),
        ),
      );
    expect(offenders).toEqual([]);
  });
});

// 18 T16.1, T16.2, T16.7 — no commission computation in apps/, packages/, supabase/migrations
// and supabase/seed; each analyser is first proven on the witness files (18 T6, "Tout contrôle
// statique est éprouvé sur des fichiers témoins").
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  listSourceFiles,
  scanScriptForCommission,
  scanSqlForCommission,
  SCRIPT_EXTENSIONS,
  wordsOf,
  isMoneyIdentifier,
  isRateIdentifier,
} from "../src/static/index.ts";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const WITNESSES = path.join(ROOT, "test-witnesses/t16");

function witnesses(suffix: string): string[] {
  return readdirSync(WITNESSES)
    .filter((name) => name.endsWith(suffix))
    .map((name) => path.join(WITNESSES, name));
}

describe("T16: the analysers catch every witness", () => {
  it.each(witnesses(".ts.txt"))("%s", (file) => {
    expect(scanScriptForCommission(file).length).toBeGreaterThan(0);
  });

  it.each(witnesses(".sql.txt"))("%s", (file) => {
    expect(scanSqlForCommission(file).length).toBeGreaterThan(0);
  });

  it("names the rule each witness breaks", () => {
    const report = (name: string) =>
      scanScriptForCommission(path.join(WITNESSES, name)).join("\n");
    expect(report("multiply-literal.ts.txt")).toContain("T16.1");
    expect(report("multiply-rate.ts.txt")).toContain("T16.1");
    expect(report("multiply-constant.ts.txt")).toContain("T16.1");
    expect(report("scale-decimal.ts.txt")).toContain("T16.2");
    expect(report("scale-percent-text.ts.txt")).toContain("T16.2");
    expect(report("scale-quotient.ts.txt")).toContain("T16.2");
    expect(report("exemption.ts.txt")).toContain("T16.7");
  });

  it("splits identifiers into words and keeps rateLimit out", () => {
    expect(wordsOf("advertiserRateBp")).toEqual(["advertiser", "rate", "bp"]);
    expect(wordsOf("NET_AMOUNT_2")).toEqual(["net", "amount"]);
    expect(isMoneyIdentifier("amountMinor")).toBe(true);
    expect(isMoneyIdentifier("network")).toBe(false);
    expect(isRateIdentifier("creator_rate_bp")).toBe(true);
    expect(isRateIdentifier("rateLimit")).toBe(false);
    expect(isRateIdentifier("rate_limit_window")).toBe(false);
  });
});

describe("T16.1, T16.2, T16.7 on the code base", () => {
  it("finds nothing in apps/ and packages/", () => {
    const files = ["apps", "packages"].flatMap((directory) =>
      listSourceFiles(path.join(ROOT, directory), SCRIPT_EXTENSIONS),
    );
    expect(files.length).toBeGreaterThan(50);
    expect(files.flatMap(scanScriptForCommission)).toEqual([]);
  });

  it("finds nothing in supabase/migrations and supabase/seed", () => {
    const files = ["supabase/migrations", "supabase/seed"]
      .map((directory) => path.join(ROOT, directory))
      .filter((directory) => existsSync(directory))
      .flatMap((directory) => listSourceFiles(directory, [".sql"]));
    expect(files.length).toBeGreaterThanOrEqual(8);
    expect(files.flatMap(scanSqlForCommission)).toEqual([]);
  });
});

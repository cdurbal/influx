import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  BASIS_POINTS_MAX,
  formatBasisPoints,
  parsePercentageToBasisPoints,
} from "../src/creator-profile/index.ts";

const parsed = (input: string) => {
  const result = parsePercentageToBasisPoints(input);
  return result.ok ? result.basisPoints : result.reason;
};

describe("L2D-U4 a percentage with two decimals in basis points (RG46, EC-L2D-8)", () => {
  it("reads a typed percentage as basis points", () => {
    expect(parsed("0")).toBe(0);
    expect(parsed("3.5")).toBe(350);
    expect(parsed("3,50")).toBe(350);
    expect(parsed("12")).toBe(1200);
    expect(parsed("0.05")).toBe(5);
    expect(parsed("99.99")).toBe(9999);
    expect(parsed("100")).toBe(BASIS_POINTS_MAX);
    expect(parsed("100.00")).toBe(10000);
    expect(parsed("007.1")).toBe(710);
    expect(parsed("  4.2 ")).toBe(420);
  });

  it("refuses a third decimal, a value above 100 and a malformed value", () => {
    expect(parsed("3.456")).toBe("too_many_decimals");
    expect(parsed("100.01")).toBe("out_of_range");
    expect(parsed("101")).toBe("out_of_range");
    expect(parsed("1000")).toBe("out_of_range");
    expect(parsed("")).toBe("empty");
    expect(parsed("  ")).toBe("empty");
    expect(parsed("-1")).toBe("invalid_format");
    expect(parsed("+3")).toBe("invalid_format");
    expect(parsed("3.")).toBe("invalid_format");
    expect(parsed(".5")).toBe("invalid_format");
    expect(parsed("1,000.5")).toBe("invalid_format");
    expect(parsed("1e2")).toBe("invalid_format");
    expect(parsed("3 %")).toBe("invalid_format");
  });

  it("writes basis points back as a percentage, digits only", () => {
    expect(formatBasisPoints(0)).toBe("0");
    expect(formatBasisPoints(5)).toBe("0.05");
    expect(formatBasisPoints(350)).toBe("3.5");
    expect(formatBasisPoints(1200)).toBe("12");
    expect(formatBasisPoints(9999)).toBe("99.99");
    expect(formatBasisPoints(10000)).toBe("100");
  });

  it("refuses to write what is not a count of basis points", () => {
    expect(formatBasisPoints(-1)).toBeNull();
    expect(formatBasisPoints(10001)).toBeNull();
    expect(formatBasisPoints(3.5)).toBeNull();
    expect(formatBasisPoints(Number.NaN)).toBeNull();
  });

  it("round-trips every value from 0 to 10 000", () => {
    for (let count = 0; count <= BASIS_POINTS_MAX; count += 1) {
      const written = formatBasisPoints(count);
      expect(parsed(written ?? "")).toBe(count);
    }
  });

  it("is done by the chain, with no division nor multiplication in its source (T16.1)", () => {
    const source = readFileSync(
      new URL("../src/creator-profile/basis-points.ts", import.meta.url),
      "utf8",
    )
      .split("\n")
      .filter((line) => !line.trimStart().startsWith("//"))
      .join("\n")
      .replace(/\/\*[\s\S]*?\*\//gu, "")
      .replace(/\/(?:[^/\n\\]|\\.)+\/[a-z]*/gu, "re")
      .replace(/"[^"\n]*"|`[^`\n]*`/gu, "str");
    expect(source).not.toMatch(/[*/]/u);
  });
});

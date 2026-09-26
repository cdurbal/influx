import { describe, expect, it } from "vitest";
import {
  ELEVATED_OPERATIONS,
  isElevatedOperation,
  SIGNED_ELEVATED_OPERATIONS,
} from "../src/elevated-operations.ts";

describe("elevated operations (03 P7, 18 T6.1)", () => {
  it("only declares operations of the signed list (U ⊆ P)", () => {
    for (const operation of ELEVATED_OPERATIONS) {
      expect(SIGNED_ELEVATED_OPERATIONS).toContain(operation);
    }
  });

  it("signs exactly the five operations of 03 P7", () => {
    expect(SIGNED_ELEVATED_OPERATIONS).toHaveLength(5);
    expect(new Set(SIGNED_ELEVATED_OPERATIONS).size).toBe(5);
  });

  it("recognises no operation at J2, whatever the value", () => {
    for (const value of [
      ...SIGNED_ELEVATED_OPERATIONS,
      "",
      "service",
      undefined,
      null,
    ]) {
      expect(isElevatedOperation(value)).toBe(false);
    }
  });
});

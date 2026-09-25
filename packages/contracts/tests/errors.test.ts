import { describe, expect, it } from "vitest";
import { ERROR_CODES, errorEnvelopeSchema } from "../src/errors.ts";
import { systemStatusSchema } from "../src/system.ts";

describe("error codes", () => {
  it("is a closed list of unique snake_case codes", () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
    for (const code of ERROR_CODES) {
      expect(code).toMatch(/^[a-z]+(?:_[a-z]+)*$/);
    }
  });
});

describe("error envelope", () => {
  const valid = {
    error: {
      code: "not_found",
      message: "Route not found",
      requestId: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    },
  };

  it("accepts a well-formed envelope, with or without details", () => {
    expect(errorEnvelopeSchema.safeParse(valid).success).toBe(true);
    const withDetails = {
      error: {
        ...valid.error,
        code: "validation_failed",
        details: [{ path: "email", issue: "invalid_format" }],
      },
    };
    expect(errorEnvelopeSchema.safeParse(withDetails).success).toBe(true);
  });

  it("rejects an unknown code and a missing request identifier", () => {
    expect(
      errorEnvelopeSchema.safeParse({
        error: { ...valid.error, code: "teapot" },
      }).success,
    ).toBe(false);
    expect(
      errorEnvelopeSchema.safeParse({
        error: { code: "not_found", message: "Route not found" },
      }).success,
    ).toBe(false);
  });

  it("strips any field that is not declared (output filter)", () => {
    const parsed = errorEnvelopeSchema.parse({
      error: { ...valid.error, stack: "Error: at line 1" },
      extra: true,
    });
    expect(parsed).toEqual(valid);
  });
});

describe("system status", () => {
  it("only accepts { status: 'ok' }", () => {
    expect(systemStatusSchema.parse({ status: "ok", version: "1" })).toEqual({
      status: "ok",
    });
    expect(systemStatusSchema.safeParse({ status: "down" }).success).toBe(
      false,
    );
  });
});

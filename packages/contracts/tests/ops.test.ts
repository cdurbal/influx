// J4S-6 (21 §J9 commit 7): a browser error report is strict text — what the api stores and the
// "Santé technique" screen shows reads exactly as received.
import { describe, expect, it } from "vitest";
import {
  CLIENT_ERROR_LIMITS,
  clientErrorReportSchema,
  toStrictText,
} from "../src/ops.ts";

const REPORT = {
  kind: "error",
  errorType: "TypeError",
  message: "Cannot read properties of undefined",
  stack: "TypeError: x\n    at render (app.js:1:2)",
  page: "/fr/compte",
} as const;

/** Characters that make a text read otherwise than it is, or hide part of it. */
const NOT_STRICT: [string, string][] = [
  ["a right-to-left override", "\u202E"],
  ["a left-to-right isolate", "\u2066"],
  ["a zero-width space", "\u200B"],
  ["a zero-width joiner", "\u200D"],
  ["a byte order mark", "\uFEFF"],
  ["a soft hyphen", "\u00AD"],
  ["a private-use character", "\uE000"],
  ["a lone surrogate", "\uD800"],
  ["a control character", "\u0007"],
  ["a C1 control character", "\u009B"],
  ["a carriage return", "\r"],
];

describe("clientErrorReportSchema: strict text (J4S-6)", () => {
  it("accepts a plain report, accents, emoji and line feeds in the stack", () => {
    expect(clientErrorReportSchema.safeParse(REPORT).success).toBe(true);
    expect(
      clientErrorReportSchema.safeParse({
        ...REPORT,
        message: "Échec : « réseau » 🚧",
      }).success,
    ).toBe(true);
  });

  it.each(NOT_STRICT)(
    "refuses %s in the message, the stack and the page",
    (_label, character) => {
      for (const field of ["message", "stack", "page"] as const) {
        const value = `${REPORT[field]}${character}x`;
        expect(
          clientErrorReportSchema.safeParse({ ...REPORT, [field]: value })
            .success,
          field,
        ).toBe(false);
      }
    },
  );

  it("refuses a line feed in the message, keeps it in the stack", () => {
    expect(
      clientErrorReportSchema.safeParse({ ...REPORT, message: "a\nb" }).success,
    ).toBe(false);
  });
});

describe("toStrictText (the collector, before sending)", () => {
  it.each(NOT_STRICT)("replaces %s with a space", (_label, character) => {
    expect(toStrictText(`a${character}b`, 10)).toBe("a b");
  });

  it("keeps the line feeds of a stack only", () => {
    expect(toStrictText("a\nb\u202Ec", 10, true)).toBe("a\nb c");
    expect(toStrictText("a\nb", 10)).toBe("a b");
  });

  it("cuts to the limit without leaving half of a surrogate pair", () => {
    expect(toStrictText("ab🚧", 3)).toBe("ab");
    expect(
      toStrictText("x".repeat(600), CLIENT_ERROR_LIMITS.message),
    ).toHaveLength(CLIENT_ERROR_LIMITS.message);
  });

  it("always gives what the schema accepts", () => {
    const hostile = `\u202Eevil\u200B${"\uD800"}\r\n\u0000`;
    expect(
      clientErrorReportSchema.safeParse({
        ...REPORT,
        message: toStrictText(hostile, CLIENT_ERROR_LIMITS.message),
        stack: toStrictText(hostile, CLIENT_ERROR_LIMITS.stack, true),
      }).success,
    ).toBe(true);
  });
});

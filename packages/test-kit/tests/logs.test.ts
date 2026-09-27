// Self-checks of the C-1 tool (21 J1-J): a search that no longer finds is a test that lies.
import { describe, expect, it } from "vitest";
import { captureLogStream, formsOf, valuesFoundIn } from "../src/logs.ts";

const EMAIL = "Leak.Marker+tag@Example.test";
const CODE = "481516";

describe("captureLogStream", () => {
  it("keeps every written line, as text and as lines", () => {
    const capture = captureLogStream();
    capture.destination.write('{"msg":"a"}\n');
    capture.destination.write('{"msg":"b"}\n');
    expect(capture.text()).toBe('{"msg":"a"}\n{"msg":"b"}\n');
    expect(capture.lines()).toEqual(['{"msg":"a"}', '{"msg":"b"}']);
  });
});

describe("valuesFoundIn (C-1)", () => {
  it("finds nothing in a clean text", () => {
    expect(
      valuesFoundIn('{"msg":"clean","email":"[redacted]"}', [EMAIL, CODE]),
    ).toEqual([]);
  });

  it.each<[string, string, string]>([
    ["as is", `{"msg":"sent to ${EMAIL}"}`, `${EMAIL} (raw)`],
    [
      "in another letter case",
      `{"to":"${EMAIL.toLowerCase()}"}`,
      `${EMAIL} (raw)`,
    ],
    [
      "percent-encoded, in a URL",
      `{"url":"/v1/x?email=${encodeURIComponent(EMAIL)}"}`,
      `${EMAIL} (percent-encoded)`,
    ],
    [
      "in base64, in a cookie",
      `{"cookie":"t=${Buffer.from(EMAIL).toString("base64")}"}`,
      `${EMAIL} (base64)`,
    ],
  ])("finds an e-mail address written %s", (_case, text, expected) => {
    expect(valuesFoundIn(text, [EMAIL])).toContain(expected);
  });

  it("finds a value written in base64url, in a token", () => {
    // Its base64 form holds "+" and "/": the two forms differ.
    const value = "marker>>>???~~~";
    const token = Buffer.from(value).toString("base64url");
    expect(token).not.toBe(Buffer.from(value).toString("base64"));
    expect(valuesFoundIn(`{"token":"${token}"}`, [value])).toEqual([
      `${value} (base64url)`,
    ]);
  });

  it("finds a value escaped by JSON", () => {
    const value = 'say "hi" \\ bye';
    const line = JSON.stringify({ message: value });
    expect(valuesFoundIn(line, [value])).toContain(`${value} (json)`);
  });

  it("finds a code inside a stack or a message", () => {
    const line = JSON.stringify({
      err: { stack: `Error: code ${CODE} refused\n    at x` },
    });
    expect(valuesFoundIn(line, [CODE])).toEqual([`${CODE} (raw)`]);
  });

  it("refuses a value too short to prove anything", () => {
    expect(() => valuesFoundIn("text", ["12345"])).toThrow(/too short/);
  });

  it("lists each distinct form once", () => {
    expect(formsOf("abcdef").map((form) => form.form)).toEqual([
      "raw",
      "base64",
    ]);
  });
});

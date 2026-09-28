// The TOTP generator of the tests, against the vectors of RFC 6238 appendix B (SHA-1) and
// RFC 4226 appendix D.
import { describe, expect, it } from "vitest";
import { base32Decode, hotp, totpCode } from "../src/totp.ts";

/** "12345678901234567890" in base32. */
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("totp", () => {
  it("decodes base32", () => {
    expect(base32Decode(RFC_SECRET).toString("ascii")).toBe(
      "12345678901234567890",
    );
    expect(() => base32Decode("not base32!")).toThrow("not a base32 text");
  });

  it.each([
    [0, "755224"],
    [1, "287082"],
    [9, "520489"],
  ])("gives the HOTP value of counter %i (RFC 4226)", (counter, expected) => {
    expect(hotp(base32Decode(RFC_SECRET), counter)).toBe(expected);
  });

  it.each([
    ["1970-01-01T00:00:59Z", "94287082"],
    ["2005-03-18T01:58:29Z", "07081804"],
    ["2033-05-18T03:33:20Z", "69279037"],
  ])("gives the last six digits of the RFC 6238 vector at %s", (at, eight) => {
    expect(totpCode(RFC_SECRET, new Date(at))).toBe(eight.slice(2));
  });

  it("moves by one period with step", () => {
    const at = new Date("1970-01-01T00:00:59Z");
    expect(totpCode(RFC_SECRET, at, 1)).toBe(
      totpCode(RFC_SECRET, new Date("1970-01-01T00:01:29Z")),
    );
  });
});

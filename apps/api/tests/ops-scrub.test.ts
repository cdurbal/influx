// The cleaning function of the ops schema and the pure parts of the recorder (docs/mvp/02 §20.5,
// §20.8; 18 T13.6). The database side is in db-tests/t13-ops-recording.test.ts.
import { describe, expect, it } from "vitest";
import { bucketOf } from "../src/domains/ops/recorder.ts";
import {
  fingerprintOf,
  normalizeMessage,
  routeModelOf,
  scrubStack,
  scrubText,
} from "../src/domains/ops/scrub.ts";

describe("scrubText (02 §20.8)", () => {
  it.each([
    [
      "an e-mail address",
      "no account for anne.martin@example.test",
      "anne.martin",
    ],
    ["a six-digit code", "code 482913 refused", "482913"],
    ["a secret key", "key sb_secret_Zq81mWp0Lk7Hx2Yv9Ab3 refused", "Zq81mWp0"],
    ["a uuid", "row 3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f", "3f1c2d4e"],
    ["an IPv4 address", "from 203.0.113.7", "203.0.113.7"],
    ["an IPv6 address", "from 2001:db8:85a3::8a2e:370:7334", "2001:db8"],
    ["a query string", "GET /fr/connexion?email=a@b.example&code=1", "code=1"],
  ])("removes %s", (_label, input, secret) => {
    expect(scrubText(input, 500)).not.toContain(secret);
  });

  it("bounds the length and removes control characters", () => {
    const text = scrubText(`a\u0000b\n${"x".repeat(600)}`, 500);
    expect(text.length).toBe(500);
    // eslint-disable-next-line no-control-regex -- the absence of control characters is the point
    expect(text).not.toMatch(/[\u0000-\u001f]/);
  });
});

describe("fingerprints", () => {
  it("groups two occurrences that differ by values and line numbers only", () => {
    const stack = (line: number) =>
      scrubStack(
        `TypeError: x\n    at verify (/srv/app/apps/api/src/domains/identity/verify-code.ts:${line}:5)`,
        4000,
      );
    const a = fingerprintOf({
      errorType: "TypeError",
      message: normalizeMessage("cannot read 'first' of row 12", 500),
      route: "/v1/auth/verify-code",
      stack: stack(10),
    });
    const b = fingerprintOf({
      errorType: "TypeError",
      message: normalizeMessage("cannot read 'second' of row 345", 500),
      route: "/v1/auth/verify-code",
      stack: stack(42),
    });
    expect(a.equals(b)).toBe(true);
  });

  it("keeps only the repository path of our own frames", () => {
    expect(
      scrubStack(
        "Error: x\n    at f (C:\\Users\\someone\\influx\\apps\\api\\src\\server.ts:3:4)\n    at g (node:internal/x:1:1)",
        4000,
      ),
    ).toBe("at f (apps/api/src/server.ts:3:4)\nat g (<external>)");
  });
});

describe("route models and duration buckets", () => {
  it.each([
    ["/v1/auth/verify-code", "/v1/auth/verify-code"],
    ["/v1/creators/:id", "/v1/creators/:id"],
    ["/fr/marque", "/fr/marque"],
    ["/v1/creators/3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f", "/v1/creators/:id"],
    ["/v1/invoices/123456", "/v1/invoices/:id"],
    ["/fr/x?email=a@b.example", "/fr/x"],
    ["/fr/a@b.example", "/fr/:id"],
  ])("models %s as %s", (path, model) => {
    expect(routeModelOf(path)).toBe(model);
  });

  it.each([
    [0, 0],
    [25, 0],
    [26, 1],
    [1000, 5],
    [5000, 7],
    [5001, 8],
  ])("puts %d ms in bucket %d", (duration, bucket) => {
    expect(bucketOf(duration)).toBe(bucket);
  });
});

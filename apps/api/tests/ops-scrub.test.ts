// The cleaning function of the ops schema and the pure parts of the recorder (docs/mvp/02 §20.5,
// §20.8; 18 T13.6). The database side is in db-tests/t13-ops-recording.test.ts.
import { describe, expect, it } from "vitest";
import { bucketOf } from "../src/domains/ops/buckets.ts";
import { OpsRecorder } from "../src/domains/ops/recorder.ts";
import { CLIENT_ERROR_RATE } from "../src/domains/ops/routes.ts";
import { MinuteCounter } from "../src/platform/minute-counter.ts";
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
    [
      "a quoted name (J4S-2)",
      "Cannot read properties of undefined (reading 'Anne Martin')",
      "Anne Martin",
    ],
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

  it("keeps strict text only: no format, private-use or lone surrogate character (J4S-6)", () => {
    const text = scrubText("a\u202Eb\u200Bc\uFEFFd\uE000e\uD800f\u009Bg", 500);
    expect(text).toBe("a b c d e f g");
    // A cut never leaves half of a surrogate pair.
    expect(scrubText(`${"x".repeat(498)}🚧🚧`, 500)).toBe(
      `${"x".repeat(498)}…`,
    );
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
    ["/v1/me/sessions/:id", "/v1/me/sessions/:id"],
    ["/fr/marque", "/fr/marque"],
    [
      "/v1/me/sessions/3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f",
      "/v1/me/sessions/:id",
    ],
    ["/v1/me/sessions/123456", "/v1/me/sessions/:id"],
    ["/fr/connexion?email=a@b.example", "/fr/connexion"],
    ["/inscrits/3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f", "/inscrits/:id"],
    ["/", "/"],
  ])("models %s as %s", (path, model) => {
    expect(routeModelOf(path)).toBe(model);
  });

  // L2AS-2: a closed list. A path no page or route serves is never stored, whatever it holds.
  it.each([
    ["an unknown page", "/fr/x"],
    ["a name in a path", "/fr/profil/jean-dupont"],
    ["a handle in a path", "/en/creator/anne_martin"],
    ["an e-mail address in a path", "/fr/a@b.example"],
    ["a route of no front", "/v1/creators/:id"],
    ["a numeric segment of an unknown route", "/v1/invoices/123456"],
    ["a known page under the wrong prefix", "/v1/marque"],
    ["a known page, longer", "/fr/marque/jean-dupont"],
    ["a trailing slash", "/fr/marque/"],
    ["the other language's slug", "/en/marque"],
    ["not a path", "fr/marque"],
  ])("never stores %s", (_label, path) => {
    expect(routeModelOf(path)).toBeNull();
  });

  it("counts a request on an unknown path as unmatched, and keeps a known one", () => {
    const ops = new OpsRecorder({ version: "test", instance: "test" });
    ops.recordRequest("GET", "/fr/profil/jean-dupont", 404, 5);
    ops.recordRequest("GET", "/v1/status", 200, 5);
    ops.recordRequest("GET", undefined, 404, 5);
    // The cells are private: their keys are `METHOD route model`.
    const keys = [...ops["requests"].values()].flatMap((cells) => [
      ...cells.keys(),
    ]);
    expect(keys.sort()).toEqual(["GET /v1/status", "GET unmatched"]);
  });

  it("takes the filter of its settings for the routes of a test", () => {
    const filter = (model: string) => model === "/fr/special";
    expect(routeModelOf("/fr/special", filter)).toBe("/fr/special");
    expect(routeModelOf("/fr/marque", filter)).toBeNull();
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

describe("rate bounds of POST /v1/ops/client-errors (02 §20.5)", () => {
  it("bounds each key per minute, and starts again the next minute", () => {
    let now = new Date("2026-10-06T10:00:05Z");
    const counter = new MinuteCounter(() => now);
    const taken = (key: string, limit: number, times: number) =>
      Array.from({ length: times }, () => counter.take(key, limit)).filter(
        Boolean,
      ).length;
    expect(taken("address:a", CLIENT_ERROR_RATE.address, 40)).toBe(30);
    expect(taken("instance", CLIENT_ERROR_RATE.instance, 350)).toBe(300);
    expect(taken("address:b", CLIENT_ERROR_RATE.address, 5)).toBe(5);
    now = new Date("2026-10-06T10:01:00Z");
    expect(counter.take("address:a", CLIENT_ERROR_RATE.address)).toBe(true);
  });
});

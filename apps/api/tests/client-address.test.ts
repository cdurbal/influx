// Address of the client, unit level (docs/mvp/03 §6.4 A5 and PP-6, 18 T7.12 "unitaire au J3").
// Whether Railway's edge overwrites a forged x-real-ip is a finding on staging at J4 (C-4), not a
// unit test: here, the table of forged or malformed values, and the /32 and /64 keys.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import {
  readClientAddress,
  type ClientAddress,
} from "../src/platform/client-address.ts";

const PEPPER = "throttle-pepper-for-tests-0123456789abcdef";

function keyOf(address: ClientAddress): string {
  if (address.status !== "known") {
    throw new Error(`expected a known address, got ${address.reason}`);
  }
  return address.throttleKey;
}

describe("readClientAddress (03 §6.4 A5)", () => {
  it("keys an IPv4 address by its /32, as an HMAC that does not quote it", () => {
    const address = readClientAddress("203.0.113.77", PEPPER);
    expect(address).toMatchObject({ status: "known", family: "ipv4" });
    const key = keyOf(address);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(key).not.toContain("203");
    expect(keyOf(readClientAddress("203.0.113.77", PEPPER))).toBe(key);
    expect(keyOf(readClientAddress("203.0.113.78", PEPPER))).not.toBe(key);
  });

  it.each([
    ["::ffff:203.0.113.77"],
    ["::FFFF:203.0.113.77"],
    ["::ffff:cb00:714d"],
  ])("reads the IPv4-mapped address %s as the IPv4 address", (mapped) => {
    const address = readClientAddress(mapped, PEPPER);
    expect(address).toMatchObject({ status: "known", family: "ipv4" });
    expect(keyOf(address)).toBe(
      keyOf(readClientAddress("203.0.113.77", PEPPER)),
    );
  });

  it("keys an IPv6 address by its /64, whatever its written form", () => {
    const key = keyOf(readClientAddress("2001:db8:1:2::1", PEPPER));
    for (const sameNetwork of [
      "2001:db8:1:2:ffff:ffff:ffff:ffff",
      "2001:0DB8:0001:0002:0000:0000:0000:0005",
      "2001:db8:1:2:0:0:1.2.3.4",
    ]) {
      const address = readClientAddress(sameNetwork, PEPPER);
      expect(address, sameNetwork).toMatchObject({ family: "ipv6" });
      expect(keyOf(address), sameNetwork).toBe(key);
    }
    expect(keyOf(readClientAddress("2001:db8:1:3::1", PEPPER))).not.toBe(key);
    expect(keyOf(readClientAddress("::1", PEPPER))).not.toBe(key);
  });

  it("changes every key when the pepper changes (a rotation resets the counters)", () => {
    const other = "another-pepper-for-tests-0123456789abcdef";
    expect(keyOf(readClientAddress("203.0.113.77", other))).not.toBe(
      keyOf(readClientAddress("203.0.113.77", PEPPER)),
    );
  });

  it.each<[string, string | string[] | undefined, ClientAddress]>([
    ["no header", undefined, { status: "unknown", reason: "absent" }],
    ["an empty header", "", { status: "unknown", reason: "absent" }],
    [
      "a list of addresses",
      "203.0.113.77, 198.51.100.1",
      { status: "unknown", reason: "invalid" },
    ],
    [
      "two headers",
      ["203.0.113.77", "198.51.100.1"],
      { status: "unknown", reason: "invalid" },
    ],
    [
      "an address with a port",
      "203.0.113.77:443",
      { status: "unknown", reason: "invalid" },
    ],
    [
      "a bracketed IPv6",
      "[2001:db8::1]",
      { status: "unknown", reason: "invalid" },
    ],
    ["an IPv6 zone", "fe80::1%eth0", { status: "unknown", reason: "invalid" }],
    ["a host name", "localhost", { status: "unknown", reason: "invalid" }],
    ["leading zeros", "010.0.0.1", { status: "unknown", reason: "invalid" }],
    [
      "an octet over 255",
      "256.1.1.1",
      { status: "unknown", reason: "invalid" },
    ],
    ["a truncated IPv4", "203.0.113", { status: "unknown", reason: "invalid" }],
    ["two compressions", "1::2::3", { status: "unknown", reason: "invalid" }],
    ["a space", " 203.0.113.77", { status: "unknown", reason: "invalid" }],
  ])("refuses %s", (_case, header, expected) => {
    expect(readClientAddress(header, PEPPER)).toEqual(expected);
  });
});

describe("request.ip is never read (03 §6.4 A5, point 1)", () => {
  const apiRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
  );
  const eslint = new ESLint({ cwd: apiRoot });

  it.each([
    ["src/domains/identity/routes.ts"],
    ["src/platform/client-address.ts"],
    ["src/server.ts"],
    ["src/config/index.ts"],
  ])("refuses request.ip and request.ips in %s", async (file) => {
    const source = `declare const request: { ip: string; ips: string[] };
export const a = request.ip;
export const { ips } = request;
`;
    const [result] = await eslint.lintText(source, {
      filePath: path.join(apiRoot, file),
    });
    const refused = (result?.messages ?? []).filter(
      (message) => message.ruleId === "no-restricted-properties",
    );
    expect(refused.map((message) => message.message)).toEqual([
      expect.stringMatching(/ ip is never read/),
      expect.stringMatching(/ ips is never read/),
    ]);
  });
});

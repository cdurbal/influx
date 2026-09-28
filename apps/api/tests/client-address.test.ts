// Address of the client, unit level (docs/mvp/03 §6.4 A5 and PP-6, 18 T7.12 "unitaire au J3").
// Whether Railway's edge overwrites a forged x-real-ip is a finding on staging at J4 (C-4), not a
// unit test: here, the table of forged or malformed values, and the /32 and /64 keys.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import {
  gotrueForwardedAddressOf,
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

describe("gotrueForwardedAddressOf: the pseudonymous address sent to GoTrue (21 EC-38)", () => {
  const forwarded = (header: string, pepper = PEPPER) =>
    gotrueForwardedAddressOf(readClientAddress(header, pepper), pepper);

  it("is an IPv6 address of fd00::/8 that quotes nothing of the client's address", () => {
    const address = forwarded("203.0.113.77");
    expect(address).toMatch(/^fd[0-9a-f]{2}(?::[0-9a-f]{1,4}){7}$/);
    expect(readClientAddress(address ?? "", PEPPER)).toMatchObject({
      status: "known",
      family: "ipv6",
    });
    expect(address).not.toContain("203");
    expect(address).not.toContain("cb00");
  });

  it("groups like the rate-limiting key: one value per /32 and per /64", () => {
    expect(forwarded("203.0.113.77")).toBe(forwarded("::ffff:203.0.113.77"));
    expect(forwarded("203.0.113.78")).not.toBe(forwarded("203.0.113.77"));
    expect(forwarded("2001:db8:1:2::1")).toBe(
      forwarded("2001:db8:1:2:ffff:ffff:ffff:ffff"),
    );
    expect(forwarded("2001:db8:1:3::1")).not.toBe(forwarded("2001:db8:1:2::1"));
  });

  it("changes with the pepper, and differs from the rate-limiting key (domain separation)", () => {
    const other = "another-pepper-for-tests-0123456789abcdef";
    expect(forwarded("203.0.113.77", other)).not.toBe(
      forwarded("203.0.113.77"),
    );
    const key = keyOf(readClientAddress("203.0.113.77", PEPPER));
    const compact = (forwarded("203.0.113.77") ?? "").replace(/:/g, "");
    expect(key).not.toContain(compact.slice(2, 10));
  });

  it("is null for an unknown address: nothing is sent (EC-38 (2))", () => {
    expect(
      gotrueForwardedAddressOf({ status: "unknown", reason: "absent" }, PEPPER),
    ).toBeNull();
    expect(
      gotrueForwardedAddressOf(
        { status: "unknown", reason: "invalid" },
        PEPPER,
      ),
    ).toBeNull();
  });
});

// ESLint guards of src/ (03 §6.4 A5; 21 §4, J3 security review R-3).
const API_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const eslint = new ESLint({ cwd: API_ROOT });

/** Messages of `ruleId` for `source`, linted as if it were `file` of apps/api. */
async function messagesOf(
  source: string,
  file: string,
  ruleId: string,
): Promise<string[]> {
  const [result] = await eslint.lintText(source, {
    filePath: path.join(API_ROOT, file),
  });
  return (result?.messages ?? [])
    .filter((message) => message.ruleId === ruleId)
    .map((message) => message.message);
}

describe("request.ip is never read (03 §6.4 A5, point 1)", () => {
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
    expect(await messagesOf(source, file, "no-restricted-properties")).toEqual([
      expect.stringMatching(/ ip is never read/),
      expect.stringMatching(/ ips is never read/),
    ]);
  });
});

describe("neither the socket nor the address headers are read outside client-address.ts (21 R-3)", () => {
  it.each([
    ["src/domains/identity/routes.ts"],
    ["src/platform/client-address.ts"],
    ["src/platform/other.ts"],
    ["src/server.ts"],
    ["src/config/index.ts"],
  ])("refuses request.socket and remoteAddress in %s", async (file) => {
    const source = `declare const request: { socket: { remoteAddress?: string } };
declare const connection: { remoteAddress?: string };
export const a = request.socket;
export const { socket } = request;
export const b = request["socket"];
export const c = connection.remoteAddress;
`;
    expect(await messagesOf(source, file, "no-restricted-properties")).toEqual([
      expect.stringMatching(/ socket is never read/),
      expect.stringMatching(/ socket is never read/),
      expect.stringMatching(/ socket is never read/),
      expect.stringMatching(/ remoteAddress is never read/),
    ]);
  });

  it.each([
    ["src/domains/identity/routes.ts"],
    ["src/platform/other.ts"],
    ["src/server.ts"],
    ["src/config/index.ts"],
  ])(
    "refuses the x-real-ip and x-forwarded-for strings in %s, in any letter case",
    async (file) => {
      const source = `declare const headers: Record<string, string | undefined>;
export const a = headers["x-real-ip"];
export const b = headers["X-Forwarded-For"];
export const c = headers[\`x-forwarded-for\`];
`;
      const refused = await messagesOf(source, file, "no-restricted-syntax");
      expect(refused).toHaveLength(3);
      for (const message of refused) {
        expect(message).toMatch(
          /^x-real-ip and x-forwarded-for are read by src\/platform\/client-address\.ts only/,
        );
      }
    },
  );

  it("accepts the x-real-ip string in src/platform/client-address.ts", async () => {
    const source = `export const CLIENT_ADDRESS_HEADER = "x-real-ip";
`;
    expect(
      await messagesOf(
        source,
        "src/platform/client-address.ts",
        "no-restricted-syntax",
      ),
    ).toEqual([]);
  });

  it("still refuses a plugin-level onSend hook in src/ (21 N2)", async () => {
    const source = `declare const app: { addHook(name: string, hook: () => void): void };
app.addHook("onSend", () => {});
`;
    expect(
      await messagesOf(
        source,
        "src/domains/identity/routes.ts",
        "no-restricted-syntax",
      ),
    ).toEqual([expect.stringMatching(/^An onSend or preSerialization hook/)]);
  });
});

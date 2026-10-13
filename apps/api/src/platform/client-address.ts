// Address of the client (docs/mvp/03 §6.4 A5 and PP-6, 21 §3 EC-21, 21 §4 J3 point 11).
// - Source: the `x-real-ip` header written by Railway's edge and relayed by the fronts, read only
//   AFTER the internal secret identified the calling surface. `request.ip` is never read
//   (`trustProxy: false`, ESLint), `x-forwarded-for` never.
// - Validated by zod (IPv4 or IPv6); an IPv4-mapped IPv6 address (`::ffff:a.b.c.d`) is an IPv4.
// - Only its rate-limiting key leaves this module: the /32 of an IPv4, the /64 of an IPv6, as an
//   HMAC-SHA-256 with AUTH_THROTTLE_PEPPER. The address itself is never kept, never logged, and
//   never written to the `ops` schema. GoTrue receives a pseudonymous address derived from that
//   key, never the address (EC-38).
import { createHmac } from "node:crypto";
import type { FastifyRequest } from "fastify";
import * as z from "zod";

export const CLIENT_ADDRESS_HEADER = "x-real-ip";

/** Domain separation: the pepper also keys other digests (e-mail addresses of the throttle). */
const THROTTLE_KEY_LABEL = "throttle-ip:";

export type ClientAddress =
  | {
      status: "known";
      family: "ipv4" | "ipv6";
      /** HMAC-SHA-256 of the /32 (IPv4) or the /64 (IPv6), hexadecimal. */
      throttleKey: string;
    }
  | { status: "unknown"; reason: "absent" | "invalid" };

const ipv4Schema = z.ipv4();
const ipv6Schema = z.ipv6();

/** Eight 16-bit groups of a valid IPv6 address (validated by zod first), or null. */
function groupsOf(address: string): number[] | null {
  let text = address.toLowerCase();
  // A trailing dotted IPv4 (`::ffff:1.2.3.4`) becomes two groups.
  const dotted = /^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
  if (dotted !== null) {
    const [, head = "", a, b, c, d] = dotted;
    const bytes = [a, b, c, d].map(Number);
    text = `${head}${(((bytes[0] ?? 0) << 8) | (bytes[1] ?? 0)).toString(16)}:${(((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0)).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) {
    return null;
  }
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const compressed = halves.length === 2;
  const missing = 8 - head.length - tail.length;
  if (compressed ? missing < 1 : missing !== 0) {
    return null;
  }
  const groups = [
    ...head,
    ...Array.from({ length: compressed ? missing : 0 }, () => "0"),
    ...tail,
  ].map((group) => Number.parseInt(group, 16));
  return groups.length === 8 &&
    groups.every((group) => group >= 0 && group <= 0xffff)
    ? groups
    : null;
}

/** `::ffff:a.b.c.d`: the first 80 bits null, the next 16 set. */
function mappedIpv4Of(groups: readonly number[]): string | null {
  const isMapped =
    groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff;
  if (!isMapped) {
    return null;
  }
  const high = groups[6] ?? 0;
  const low = groups[7] ?? 0;
  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
}

function throttleKeyOf(pepper: string, prefix: string): string {
  return createHmac("sha256", pepper)
    .update(`${THROTTLE_KEY_LABEL}${prefix}`, "utf8")
    .digest("hex");
}

/**
 * Reads the relayed address. Absent (no header, or empty) and invalid (a list, a port, a host
 * name, a malformed address, several headers) are told apart for the log line, never the value.
 */
export function readClientAddress(
  header: string | string[] | undefined,
  pepper: string,
): ClientAddress {
  if (header === undefined || header === "") {
    return { status: "unknown", reason: "absent" };
  }
  if (typeof header !== "string") {
    return { status: "unknown", reason: "invalid" };
  }
  if (ipv4Schema.safeParse(header).success) {
    return {
      status: "known",
      family: "ipv4",
      throttleKey: throttleKeyOf(pepper, `ipv4:${header}`),
    };
  }
  if (!ipv6Schema.safeParse(header).success) {
    return { status: "unknown", reason: "invalid" };
  }
  const groups = groupsOf(header);
  if (groups === null) {
    return { status: "unknown", reason: "invalid" };
  }
  const mapped = mappedIpv4Of(groups);
  if (mapped !== null) {
    return {
      status: "known",
      family: "ipv4",
      throttleKey: throttleKeyOf(pepper, `ipv4:${mapped}`),
    };
  }
  const prefix = groups
    .slice(0, 4)
    .map((group) => group.toString(16).padStart(4, "0"))
    .join(":");
  return {
    status: "known",
    family: "ipv6",
    throttleKey: throttleKeyOf(pepper, `ipv6:${prefix}::/64`),
  };
}

/** An IPv4 network in CIDR notation, split: `1.179.112.0/20` is `{ network: "1.179.112.0", prefixLength: 20 }`. */
export type Ipv4Range = { network: string; prefixLength: number };

/** Where the relayed address stands against a list of ranges. The address itself never leaves. */
export type AddressRangeCheck = "absent" | "invalid" | "outside" | "within";

function ipv4ToNumber(address: string): number {
  return address
    .split(".")
    .reduce((value, byte) => value * 256 + Number(byte), 0);
}

function isInIpv4Range(address: string, range: Ipv4Range): boolean {
  const size = 2 ** (32 - range.prefixLength);
  const start = Math.floor(ipv4ToNumber(range.network) / size) * size;
  const value = ipv4ToNumber(address);
  return value >= start && value < start + size;
}

/**
 * Whether the relayed `x-real-ip` lies in one of `ranges` (IPv4 only; an IPv4-mapped IPv6 address
 * is its IPv4, any other IPv6 address is outside). Same source and same validation as
 * readClientAddress(), read only after the internal secret: the Brevo webhook (J7 decision 1).
 */
export function checkAddressInRanges(
  header: string | string[] | undefined,
  ranges: readonly Ipv4Range[],
): AddressRangeCheck {
  if (header === undefined || header === "") {
    return "absent";
  }
  if (typeof header !== "string") {
    return "invalid";
  }
  let ipv4: string | null = null;
  if (ipv4Schema.safeParse(header).success) {
    ipv4 = header;
  } else if (ipv6Schema.safeParse(header).success) {
    const groups = groupsOf(header);
    if (groups === null) {
      return "invalid";
    }
    ipv4 = mappedIpv4Of(groups);
  } else {
    return "invalid";
  }
  return ipv4 !== null && ranges.some((range) => isInIpv4Range(ipv4, range))
    ? "within"
    : "outside";
}

/** Domain separation of the address sent to GoTrue (21 §4, J3 security arbitration EC-38). */
const GOTRUE_ADDRESS_LABEL = "gotrue-ip:";

/**
 * Value of the `Sb-Forwarded-For` header of the calls to GoTrue (21 §3 EC-38, point 2): not the
 * client's address, but an IPv6 address of `fd00::/8` derived by HMAC-SHA-256 from its
 * rate-limiting key. GoTrue limits by client as well as with the real address (same /32 or /64
 * grouping, stable per client, the same value for a TOTP challenge and its verification), and
 * Supabase never receives the address. Null for an unknown address: nothing is sent (EC-38 (2)).
 */
export function gotrueForwardedAddressOf(
  address: ClientAddress,
  pepper: string,
): string | null {
  if (address.status !== "known") {
    return null;
  }
  const digest = createHmac("sha256", pepper)
    .update(`${GOTRUE_ADDRESS_LABEL}${address.throttleKey}`, "utf8")
    .digest();
  // First byte 0xfd (unique local addresses), then 120 bits of the digest.
  const bytes = [0xfd, ...digest.subarray(0, 15)];
  const groups: string[] = [];
  for (let index = 0; index < 16; index += 2) {
    const group = ((bytes[index] ?? 0) << 8) | (bytes[index + 1] ?? 0);
    groups.push(group.toString(16));
  }
  return groups.join(":");
}

const warnedRequests = new WeakSet<FastifyRequest>();

/**
 * The address of the request, for a consumer that needs it (rate limiting, from J3 commit 6).
 * An unknown address gets one `warn` line per request, without any value (03 §6.4 A5 point 5):
 * written here rather than for every request, since a call from a front's server (health probe,
 * EC-22) never carries an address. The fallback counters (e-mail address, global "unknown
 * address" ceiling) are the consumer's.
 */
export function clientAddressOf(request: FastifyRequest): ClientAddress {
  const address: ClientAddress = request.clientAddress ?? {
    status: "unknown",
    reason: "absent",
  };
  if (address.status === "unknown" && !warnedRequests.has(request)) {
    warnedRequests.add(request);
    request.log.warn(
      { reason: address.reason },
      "client address unknown: rate limited by the fallback counters",
    );
  }
  return address;
}

declare module "fastify" {
  interface FastifyRequest {
    /** Set after the internal secret is validated (server.ts); null before, or when refused. */
    clientAddress: ClientAddress | null;
  }
}

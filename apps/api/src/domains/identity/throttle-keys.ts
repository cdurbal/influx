// Keys of the rate-limiting counters (identity.auth_request_throttle, 0014): ALWAYS an HMAC-SHA-256
// with AUTH_THROTTLE_PEPPER, 32 bytes, never an address, an IP or an identifier in clear (04 §5.8,
// 04 §12.10 point 4). One label per kind of key: a digest of one kind never equals another's.
import { createHmac } from "node:crypto";
import type { ClientAddress } from "../../platform/client-address.ts";

function hmacOf(pepper: string, label: string, value: string): Buffer {
  return createHmac("sha256", pepper)
    .update(`${label}${value}`, "utf8")
    .digest();
}

/** A normalised e-mail address (05 RG44, per-address counters). */
export function emailThrottleKey(pepper: string, email: string): Buffer {
  return hmacOf(pepper, "throttle-email:", email);
}

/** The random reference of a login request (EC-3 point 1), never its sequential id. */
export function loginRequestThrottleKey(
  pepper: string,
  reference: string,
): Buffer {
  return hmacOf(pepper, "throttle-login-request:", reference);
}

/** A global counter of the platform (unknown IP, EC-21; surveillance, A-3). */
export function globalThrottleKey(pepper: string, name: string): Buffer {
  return hmacOf(pepper, "throttle-global:", name);
}

/** The client address's key, already an HMAC of its /32 or /64 (03 §6.4 A5), as 32 bytes. */
export function addressThrottleKey(
  address: Extract<ClientAddress, { status: "known" }>,
): Buffer {
  return Buffer.from(address.throttleKey, "hex");
}

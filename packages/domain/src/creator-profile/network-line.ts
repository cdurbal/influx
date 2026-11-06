// What a creator types on a line of the networks block: handle, pseudonym and profile URL
// (docs/mvp/07 RG30, RG43, RG44, CA12; jalons/l2d/modele.md 0217). The database arbitrates the same
// rules (`creator_social_accounts` checks and `profiles.guard_creator_social_account()`): these are
// the copy the browser and the API share (RG14). The hosts of a network come from the reference list
// `reference.network_url_hosts`; this code only compares. No dependency and no `URL`.
import {
  HANDLE_MAX_LENGTH,
  PROFILE_URL_MAX_LENGTH,
  PSEUDONYM_MAX_LENGTH,
} from "./limits.ts";

export type NetworkTextRefusal = "empty" | "too_long" | "invalid_characters";

export type NetworkTextResult =
  | { readonly ok: true; readonly value: string }
  | { readonly ok: false; readonly reason: NetworkTextRefusal };

const CONTROL = /\p{Cc}/u;

function networkText(input: string, maxLength: number): NetworkTextResult {
  const value = input.trim();
  if (value === "") return { ok: false, reason: "empty" };
  if (CONTROL.test(value)) return { ok: false, reason: "invalid_characters" };
  if (Array.from(value).length > maxLength) {
    return { ok: false, reason: "too_long" };
  }
  return { ok: true, value };
}

/** A handle as stored: outside its margins, up to 100 characters, no control character (RG44). */
export function normalizeHandle(input: string): NetworkTextResult {
  return networkText(input, HANDLE_MAX_LENGTH);
}

/** A pseudonym as stored: outside its margins, up to 60 characters, no control character (RG30). */
export function normalizePseudonym(input: string): NetworkTextResult {
  return networkText(input, PSEUDONYM_MAX_LENGTH);
}

/** Two handles of one network are the same handle when they differ by case only (RG42). */
export function handleKey(handle: string): string {
  return handle.trim().toLowerCase();
}

export type ProfileUrlRefusal =
  | "empty"
  | "too_long"
  | "invalid_shape"
  | "no_host"
  | "credentials"
  | "wrong_network";

export type ProfileUrlResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly reason: ProfileUrlRefusal };

const HTTPS_URL = /^https:\/\/[^\s\p{Cc}]+$/u;
// L2DS-1: a plain host name and an optional port. `[^/?#]*` alone lets a backslash through, which a
// browser reads as a path separator (`https://evil.example\.instagram.com` opens evil.example).
const PLAIN_AUTHORITY = /^[A-Za-z0-9.-]+(:[0-9]{1,5})?$/u;

/**
 * Checks a profile URL against the hosts of its network (RG43, CA12): `https://` with no space,
 * a host and no credentials, an authority made of a plain host name and an optional port
 * (`invalid_shape` otherwise, L2DS-1), and, when the network lists hosts, that host or one of its
 * subdomains (an Instagram line pointing to TikTok is refused with `wrong_network`, the message
 * of its own). A network without any listed host is free. The same decision as the database's.
 */
export function checkProfileUrl(
  input: string,
  networkHosts: readonly string[],
): ProfileUrlResult {
  const url = input.trim();
  if (url === "") return { ok: false, reason: "empty" };
  if (Array.from(url).length > PROFILE_URL_MAX_LENGTH) {
    return { ok: false, reason: "too_long" };
  }
  if (!HTTPS_URL.test(url)) return { ok: false, reason: "invalid_shape" };
  const authority = /^https:\/\/([^/?#]*)/u.exec(url)?.[1] ?? "";
  if (authority === "") return { ok: false, reason: "no_host" };
  if (authority.includes("@")) return { ok: false, reason: "credentials" };
  if (!PLAIN_AUTHORITY.test(authority)) {
    return { ok: false, reason: "invalid_shape" };
  }
  const host = authority.replace(/:\d*$/u, "").toLowerCase();
  const listed = networkHosts.map((entry) => entry.toLowerCase());
  const pointsToNetwork = listed.some(
    (entry) => host === entry || host.endsWith(`.${entry}`),
  );
  if (listed.length > 0 && !pointsToNetwork) {
    return { ok: false, reason: "wrong_network" };
  }
  return { ok: true, url };
}

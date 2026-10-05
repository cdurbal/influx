// k-anonymity lookup of a new password in Pwned Passwords (docs/mvp/03 B-1; 21 §4, J3-A d option
// B, accepted by expert-cybersecurite with four corrections). The ONLY module that names the host
// of the service (static test).
// - Only the first five hexadecimal characters of the SHA-1 leave the server, upper case: never
//   the password, never the whole digest, never an account identifier, no cookie.
// - `Add-Padding: true`; a padding line has a count of 0 and is not a presence (correction 1).
// - Fails closed: time-out, any answer other than 200, a malformed body ⇒ `unavailable`.
// - The `fetch` is injected: the tests never call the service. Neither the prefix nor the result is
//   logged.
// Called only when a password is CHOSEN (invitation at J8, change), never at sign-in (J3-A d).
import { createHash } from "node:crypto";

/** The service of production; a double is accepted on a loopback host only (J3-C rule 10). */
export const PWNED_PASSWORDS_RANGE_URL =
  "https://api.pwnedpasswords.com/range/";

/** Our own User-Agent, as the service asks. */
export const PWNED_PASSWORDS_USER_AGENT = "influx-api";

export type PwnedPasswordVerdict = "clear" | "compromised" | "unavailable";

export type PwnedPasswordCheck = (
  password: string,
) => Promise<PwnedPasswordVerdict>;

export type PwnedPasswordSettings = {
  fetch: typeof fetch;
  timeoutMs: number;
  /** Defaults to the service of production. */
  rangeUrl?: string;
};

/** A line of the answer: 35 hexadecimal characters, a colon, a count. */
const RANGE_LINE = /^([0-9A-F]{35}):(\d{1,10})$/;

export function createPwnedPasswordCheck(
  settings: PwnedPasswordSettings,
): PwnedPasswordCheck {
  const rangeUrl = settings.rangeUrl ?? PWNED_PASSWORDS_RANGE_URL;
  return async (password) => {
    const digest = createHash("sha1")
      .update(password, "utf8")
      .digest("hex")
      .toUpperCase();
    const prefix = digest.slice(0, 5);
    const suffix = digest.slice(5);
    let body: string;
    try {
      const response = await settings.fetch(`${rangeUrl}${prefix}`, {
        method: "GET",
        headers: {
          "Add-Padding": "true",
          "User-Agent": PWNED_PASSWORDS_USER_AGENT,
        },
        redirect: "error",
        signal: AbortSignal.timeout(settings.timeoutMs),
      });
      if (response.status !== 200) {
        return "unavailable";
      }
      body = await response.text();
    } catch {
      // Time-out or network failure: closed (correction 3). The caller logs the outcome only.
      return "unavailable";
    }
    let lines = 0;
    for (const line of body.split(/\r?\n/)) {
      if (line === "") {
        continue;
      }
      const match = RANGE_LINE.exec(line.toUpperCase());
      if (match === null) {
        return "unavailable";
      }
      lines += 1;
      if (match[1] === suffix && Number(match[2]) > 0) {
        return "compromised";
      }
    }
    return lines === 0 ? "unavailable" : "clear";
  };
}

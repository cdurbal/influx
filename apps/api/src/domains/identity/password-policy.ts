// Rules of a NEW backoffice password (docs/mvp/03 B-1; 21 §3 EC-57; 21 §4, J3-A d and the
// security arbitration of B-1; 17b §3.14.d). Order (correction 3): local rules, then the
// k-anonymity lookup, then only GoTrue — and never inside a database transaction. No composition
// rule, no expiry. Used where a password is chosen (invitation at J8, change), through
// withNewPassword() only (J3S-5); the sign-in never calls it.
import {
  PASSWORD_MAX_UTF8_BYTES,
  PASSWORD_MIN_CHARACTERS,
} from "../../platform/supabase.ts";
import type { PwnedPasswordCheck } from "../../platform/hibp.ts";

/** One outcome per message of 17b §3.14.d. */
export type NewPasswordVerdict =
  | "accepted"
  | "too_short"
  | "too_long"
  | "context"
  | "compromised"
  | "check_unavailable";

/** NIST SP 800-63B context list: the brand itself (correction 2). */
const CONTEXT_WORDS = ["influx"];

/** The local rules alone: bounds of EC-57, then the context words. */
export function localPasswordVerdict(
  password: string,
  email: string,
): Exclude<NewPasswordVerdict, "compromised" | "check_unavailable"> {
  if ([...password].length < PASSWORD_MIN_CHARACTERS) {
    return "too_short";
  }
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_UTF8_BYTES) {
    return "too_long";
  }
  const lowered = password.toLowerCase();
  const localPart = email.slice(0, email.indexOf("@")).toLowerCase();
  const words =
    localPart === "" ? CONTEXT_WORDS : [localPart, ...CONTEXT_WORDS];
  if (words.some((word) => lowered.includes(word))) {
    return "context";
  }
  return "accepted";
}

/** All the rules of B-1: the lookup is made only when the local rules pass. */
export async function newPasswordVerdict(
  password: string,
  email: string,
  isPwned: PwnedPasswordCheck,
): Promise<NewPasswordVerdict> {
  const local = localPasswordVerdict(password, email);
  if (local !== "accepted") {
    return local;
  }
  const pwned = await isPwned(password);
  if (pwned === "compromised") {
    return "compromised";
  }
  return pwned === "clear" ? "accepted" : "check_unavailable";
}

/** A password choice: GoTrue's result when the password was accepted, the refusal otherwise. */
export type NewPasswordChoice<Value> =
  | { verdict: "accepted"; value: Value }
  | { verdict: Exclude<NewPasswordVerdict, "accepted"> };

/**
 * J3S-5: the one path by which a route hands GoTrue a password it did not know (acceptance of an
 * internal invitation, change of password). The verdict of B-1 comes first; `setPassword` (the
 * GoTrue call) runs only on `accepted`: never on a compromised password, nor when the lookup could
 * not be made (fails closed, `check_unavailable`). Called outside any database transaction. The
 * line carries the verdict only (C-1).
 */
export async function withNewPassword<Value>(
  isPwned: PwnedPasswordCheck,
  logger: { info(object: object, message: string): void },
  candidate: { password: string; email: string },
  setPassword: () => Promise<Value>,
): Promise<NewPasswordChoice<Value>> {
  const verdict = await newPasswordVerdict(
    candidate.password,
    candidate.email,
    isPwned,
  );
  if (verdict !== "accepted") {
    logger.info({ verdict }, "new password refused");
    return { verdict };
  }
  return { verdict, value: await setPassword() };
}

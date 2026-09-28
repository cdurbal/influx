// TOTP generator of the TESTS (RFC 6238, HMAC-SHA-1, 30 s, 6 digits), for the TOTP factors of
// the local stack (21 §4, J3-B: `otplib` and `speakeasy` are refused; GoTrue verifies the codes).
// Never importable from apps/api/src (static guard of apps/api/tests/supabase-guards.test.ts).
import { createHmac } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD_SECONDS = 30;
const DIGITS = 6;

/** Bytes of an RFC 4648 base32 text (the `secret` of a GoTrue enrolment), padding ignored. */
export function base32Decode(text: string): Buffer {
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const character of text.replace(/=+$/, "").toUpperCase()) {
    const value = BASE32_ALPHABET.indexOf(character);
    if (value === -1) {
      throw new Error("not a base32 text");
    }
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** HOTP value (RFC 4226) of a counter, with `digits` digits. */
export function hotp(key: Buffer, counter: number, digits = DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(message).digest();
  const offset = (digest[digest.length - 1] ?? 0) & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, "0");
}

/** The TOTP code of a base32 secret at `at` (default: now), `step` periods later or earlier. */
export function totpCode(
  base32Secret: string,
  at: Date = new Date(),
  step = 0,
): string {
  const counter = Math.floor(at.getTime() / 1000 / PERIOD_SECONDS) + step;
  return hotp(base32Decode(base32Secret), counter);
}

/** Milliseconds left in the current 30-second period. */
export function millisecondsLeftInPeriod(at: Date = new Date()): number {
  return PERIOD_SECONDS * 1000 - (at.getTime() % (PERIOD_SECONDS * 1000));
}

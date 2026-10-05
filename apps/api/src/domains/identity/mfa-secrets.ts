// The secrets of the backoffice second factor that INFLUX holds itself (docs/mvp/03 MFA-3; 21 §4,
// J3-C rule 9, EC-17, G-1 point 2): recovery codes and enrollment tokens. Drawn by node:crypto,
// kept in the database as SHA-256 only (80 and 256 random bits: no slow hash needed, J3-B), never
// logged.
import { createHash, randomBytes } from "node:crypto";

/** Crockford base32: no I, L, O, U (J3-C rule 9). */
const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** EC-17: ten codes per batch. */
export const RECOVERY_CODE_COUNT = 10;

/** 80 random bits: 16 characters of 5 bits. */
const RECOVERY_CODE_BYTES = 10;
const RECOVERY_CODE_LENGTH = 16;

const NORMALIZED_RECOVERY_CODE = /^[0-9A-HJKMNP-TV-Z]{16}$/;

/** 32 random bytes in base64url, without padding (G-1 point 2: at least 128 bits). */
const ENROLLMENT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

function crockfordOf(bytes: Buffer): string {
  let text = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      text += CROCKFORD_ALPHABET[(buffer >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
    buffer &= (1 << bits) - 1;
  }
  return text;
}

/** One code as shown once to its holder: XXXX-XXXX-XXXX-XXXX (17b §3.14.c). */
function displayOf(code: string): string {
  return code.match(/.{4}/g)?.join("-") ?? code;
}

export type RecoveryCodeBatch = {
  /** What the holder sees, once; never stored, never logged. */
  displayed: string[];
  /** SHA-256 of each normalised code: what the database keeps. */
  hashes: Buffer[];
};

/** Ten new codes, all distinct (a collision of 80-bit draws is redrawn, never kept). */
export function generateRecoveryCodes(): RecoveryCodeBatch {
  const codes = new Set<string>();
  while (codes.size < RECOVERY_CODE_COUNT) {
    const code = crockfordOf(randomBytes(RECOVERY_CODE_BYTES));
    if (code.length === RECOVERY_CODE_LENGTH) {
      codes.add(code);
    }
  }
  return {
    displayed: [...codes].map(displayOf),
    hashes: [...codes].map(recoveryCodeHashOf),
  };
}

/**
 * EC-17 point 1: a typed code, case, spaces and dashes ignored, O read as 0, I and L as 1. Null
 * when what is left is not 16 characters of the alphabet.
 */
export function normalizeRecoveryCode(typed: string): string | null {
  const normalized = typed
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  return NORMALIZED_RECOVERY_CODE.test(normalized) ? normalized : null;
}

/** The digest of a normalised code. */
export function recoveryCodeHashOf(normalized: string): Buffer {
  return createHash("sha256").update(normalized, "utf8").digest();
}

/**
 * G-1 point 2: the digest of an enrollment token, the SHA-256 of its 32 bytes (as for a session
 * identifier); null when the text is not a token. The bootstrap script (commit 11) and the
 * invitation (J8) store this same digest.
 */
export function enrollmentTokenHashOf(token: string): Buffer | null {
  if (!ENROLLMENT_TOKEN_PATTERN.test(token)) {
    return null;
  }
  const bytes = Buffer.from(token, "base64url");
  return bytes.length === 32
    ? createHash("sha256").update(bytes).digest()
    : null;
}

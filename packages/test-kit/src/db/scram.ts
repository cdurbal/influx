// SCRAM-SHA-256 verifier computed on the client (docs/mvp/03 §4 P7, rule 5 of 0001): a password
// is never sent in clear inside a SQL statement, which may end up in the Postgres log. Format of
// RFC 5803, as stored by PostgreSQL in pg_authid.rolpassword.
import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";

const ITERATIONS = 4096;
const SALT_BYTES = 16;
const KEY_BYTES = 32;

function hmac(key: Buffer, text: string): Buffer {
  return createHmac("sha256", key).update(text).digest();
}

export function scramSha256Verifier(
  password: string,
  salt: Buffer = randomBytes(SALT_BYTES),
  iterations: number = ITERATIONS,
): string {
  // SASLprep is the identity on printable ASCII: other passwords are refused.
  if (!/^[\x21-\x7e]{16,}$/.test(password)) {
    throw new Error(
      "test passwords must be printable ASCII, 16 characters or more",
    );
  }
  const salted = pbkdf2Sync(password, salt, iterations, KEY_BYTES, "sha256");
  const storedKey = createHash("sha256")
    .update(hmac(salted, "Client Key"))
    .digest();
  const serverKey = hmac(salted, "Server Key");
  return `SCRAM-SHA-256$${iterations}:${salt.toString("base64")}$${storedKey.toString("base64")}:${serverKey.toString("base64")}`;
}

/** Shape check before a verifier is inlined in ALTER ROLE (which takes no bind parameter). */
export const SCRAM_VERIFIER_PATTERN =
  /^SCRAM-SHA-256\$[0-9]+:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/;

// Sets the passwords of the three connection roles on the LOCAL stack or in CI (03 P7, rule 5 of
// 0001; 21 J2 point 7): SCRAM verifier computed here, never a clear password in SQL, never in a
// migration. The connection comes from local-stack.ts, which only reaches the loopback.
import type postgres from "postgres";
import { LOCAL_ROLE_PASSWORDS, LOGIN_ROLES } from "./local-stack.ts";
import { SCRAM_VERIFIER_PATTERN, scramSha256Verifier } from "./scram.ts";

export async function setLocalRolePasswords(
  migration: postgres.Sql,
): Promise<void> {
  for (const role of LOGIN_ROLES) {
    const verifier = scramSha256Verifier(LOCAL_ROLE_PASSWORDS[role]);
    if (!SCRAM_VERIFIER_PATTERN.test(verifier)) {
      throw new Error("malformed SCRAM verifier");
    }
    // ALTER ROLE takes no bind parameter: the role comes from a constant list and the verifier
    // matches a strict pattern (base64 and separators only).
    await migration.unsafe(`alter role ${role} with password '${verifier}'`);
  }
}

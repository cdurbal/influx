// Global setup of the database tests (docs/mvp/18 §3 and T4). Runs once, before any file:
// 1. the local stack must answer, with the migrations applied: otherwise the run FAILS with a
//    message that says what to do (18 §3 rule 2: never skipped);
// 2. the fixed local passwords of the three connection roles are set (SCRAM verifiers);
// 3. T4.1 runs first: if any influx_% role carries rolsuper or rolbypassrls, every RLS test would
//    pass for nothing, so the run stops here (18 T4, "exécuté en premier");
// 4. no temporary right of an interrupted run is left in the stack (J2 review of 0009, V4).
import {
  connectAsMigrationRole,
  requireLocalStack,
  setLocalRolePasswords,
} from "@influx/test-kit/db";
import {
  assertNoTemporaryRights,
  INTERRUPTED_RUN_MESSAGE,
} from "./temporary-rights.ts";

export default async function setup(): Promise<void> {
  await requireLocalStack();
  const migration = connectAsMigrationRole({ max: 1 });
  try {
    await setLocalRolePasswords(migration);
    const offenders = await migration<{ rolname: string }[]>`
      select rolname from pg_catalog.pg_roles
       where rolname like 'influx\_%' and (rolsuper or rolbypassrls)`;
    if (offenders.length > 0) {
      // The S2 case of T4 sets BYPASSRLS on influx_admin for a moment: an interrupted run is the
      // likeliest cause on the local stack; anywhere else, it is a real finding.
      throw new Error(
        `T4.1: role(s) with rolsuper or rolbypassrls: ${offenders
          .map((row) => row.rolname)
          .join(
            ", ",
          )}. The other database tests are not run. On the local stack, if a run was interrupted: ${INTERRUPTED_RUN_MESSAGE}`,
      );
    }
    await assertNoTemporaryRights(migration);
  } finally {
    await migration.end({ timeout: 1 });
  }
}

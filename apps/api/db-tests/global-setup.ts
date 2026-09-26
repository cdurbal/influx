// Global setup of the database tests (docs/mvp/18 §3 and T4). Runs once, before any file:
// 1. the local stack must answer, with the migrations applied: otherwise the run FAILS with a
//    message that says what to do (18 §3 rule 2: never skipped);
// 2. the fixed local passwords of the three connection roles are set (SCRAM verifiers);
// 3. T4.1 runs first: if any influx_% role carries rolsuper or rolbypassrls, every RLS test would
//    pass for nothing, so the run stops here (18 T4, "exécuté en premier").
import {
  connectAsMigrationRole,
  requireLocalStack,
  setLocalRolePasswords,
} from "@influx/test-kit/db";

export default async function setup(): Promise<void> {
  await requireLocalStack();
  const migration = connectAsMigrationRole({ max: 1 });
  try {
    await setLocalRolePasswords(migration);
    const offenders = await migration<{ rolname: string }[]>`
      select rolname from pg_catalog.pg_roles
       where rolname like 'influx\_%' and (rolsuper or rolbypassrls)`;
    if (offenders.length > 0) {
      throw new Error(
        `T4.1: role(s) with rolsuper or rolbypassrls: ${offenders
          .map((row) => row.rolname)
          .join(", ")}. The other database tests are not run.`,
      );
    }
  } finally {
    await migration.end({ timeout: 1 });
  }
}

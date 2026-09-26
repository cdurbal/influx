// `corepack pnpm db:role-passwords`: sets the fixed LOCAL passwords of influx_app,
// influx_auth_login and influx_worker_login on the local Supabase stack (after every
// `supabase db reset`, which keeps roles but may be run on a fresh cluster). CI runs it too.
import {
  connectAsMigrationRole,
  requireLocalStack,
} from "../src/db/local-stack.ts";
import { setLocalRolePasswords } from "../src/db/role-passwords.ts";

await requireLocalStack();
const migration = connectAsMigrationRole({ max: 1 });
try {
  await setLocalRolePasswords(migration);
  process.stdout.write("local role passwords set (SCRAM verifiers)\n");
} finally {
  await migration.end({ timeout: 1 });
}

// `corepack pnpm db:demo-accounts` (from the repository root), after `supabase db reset` and
// `corepack pnpm db:role-passwords`, with the variables of EC-51 exported (docs/mvp/21 §4, J3
// commit 11; EC-45 (1)). Publishes the drafts of the public documents (21 EC-62, J5 commit 3:
// LOCAL_SEED_DRAFTS of terms-publication.ts, each label once), then creates the four
// demonstration accounts of scripts/demo-accounts.ts on the LOCAL stack; runs in CI the same way.
//
// Refused: when INFLUX_ENV or NODE_ENV says production, when SUPABASE_URL is set to anything but
// the loopback, and whenever the stack read from `supabase status` is not the loopback one
// (@influx/test-kit/db refuses it). No `.env*` file is read.
//
// What it prints (fixed local values, no real secret):
//   advertiser  demo-advertiser@example.test  code by e-mail (Brevo double)
//   creator     demo-creator@example.test     code by e-mail (Brevo double)
//   agent       demo-agent@example.test       password "…"  activation link http://localhost:3001/activation#…
//   admin       demo-admin@example.test       password "…"  activation link http://localhost:3001/activation#…
// The activation link (72 hours) opens the enrollment of the TOTP at the first sign-in (B-2). A
// second run does nothing ("already present"); a partial set asks for `supabase db reset`.
import {
  connectAsMigrationRole,
  localAuthStack,
  requireLocalStack,
} from "@influx/test-kit/db";
import { demoAccounts, seedDemoAccounts } from "./demo-accounts.ts";
import { refuseOutsideTheLocalStack } from "./script-guards.ts";
import {
  LOCAL_SEED_DRAFTS,
  publishUnlessPublished,
} from "./terms-publication.ts";

/** Where `pnpm dev:backoffice` listens (apps/backoffice/package.json). */
const LOCAL_BACKOFFICE_ORIGIN = "http://localhost:3001";

refuseOutsideTheLocalStack("demo accounts");
await requireLocalStack();
const local = localAuthStack();
const accounts = demoAccounts();
const migration = connectAsMigrationRole({ max: 1 });
try {
  for (const draft of LOCAL_SEED_DRAFTS) {
    const published = await publishUnlessPublished(migration, draft);
    if (published.kind === "published") {
      process.stdout.write(
        `published ${draft.document}/${draft.locale} "${draft.label}" (local stack)
`,
      );
    }
  }
  const outcome = await seedDemoAccounts(
    migration,
    { authUrl: local.authUrl, secretKey: local.secretKey },
    accounts,
  );
  process.stdout.write(
    outcome === "created"
      ? "demo accounts created (local stack, example.test):\n"
      : "demo accounts already present (local stack, example.test):\n",
  );
  for (const account of accounts) {
    const access =
      account.password === null
        ? "code by e-mail (Brevo double)"
        : `password "${account.password}"  activation link ${LOCAL_BACKOFFICE_ORIGIN}/activation#${account.enrollmentToken ?? ""}`;
    process.stdout.write(
      `  ${account.role.padEnd(10)}  ${account.email.padEnd(30)}  ${access}\n`,
    );
  }
} finally {
  await migration.end({ timeout: 1 });
}

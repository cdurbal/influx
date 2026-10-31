// Before the journeys: the local stack must answer, with GoTrue, and the terms of service must be
// in force WITH their text in both languages (screen 3 shows them, 05 RG24). Otherwise the run
// fails with what to do: a journey is never skipped (18 §3 rule 2).
// The returned function is the teardown (PLT-3): the run fails on any error occurrence recorded
// in ops.error_occurrences since the mark taken here (support/error-guard.ts).
import {
  connectAsMigrationRole,
  requireLocalAuth,
  requireLocalStack,
} from "@influx/test-kit/db";
import { assertNoNewErrors, readErrorMark } from "./support/error-guard";

export default async function globalSetup(): Promise<() => Promise<void>> {
  await requireLocalStack();
  await requireLocalAuth();
  const sql = connectAsMigrationRole({ max: 1 });
  let mark: string;
  try {
    mark = await readErrorMark(sql);
    const rows = await sql<{ locale: string }[]>`
      select locale from identity.terms_versions
       where document_kind = 'terms_of_service' and effective_to is null
         and effective_from <= now() and content is not null`;
    const locales = new Set(rows.map((row) => row.locale));
    if (!locales.has("fr") || !locales.has("en")) {
      throw new Error(
        "no terms of service in force with their text in French and in English: run " +
          "`corepack pnpm --filter @influx/api db:publish-terms -- --latest` (21 EC-62).",
      );
    }
  } finally {
    await sql.end({ timeout: 1 });
  }
  return async () => {
    const check = connectAsMigrationRole({ max: 1 });
    try {
      await assertNoNewErrors(check, mark);
    } finally {
      await check.end({ timeout: 1 });
    }
  };
}

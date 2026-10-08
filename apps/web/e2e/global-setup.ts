// Before the journeys: the local stack must answer, with GoTrue, and the terms of service must be
// in force WITH their text in both languages (screen 3 shows them, 05 RG24). Otherwise the run
// fails with what to do: a journey is never skipped (18 §3 rule 2).
import {
  connectAsMigrationRole,
  requireLocalAuth,
  requireLocalStack,
} from "@influx/test-kit/db";

export default async function globalSetup(): Promise<void> {
  await requireLocalStack();
  await requireLocalAuth();
  const sql = connectAsMigrationRole({ max: 1 });
  try {
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
}

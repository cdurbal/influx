// The entries of queue 1, "profils marque à valider", as the journeys of the backoffice need them
// (L2C-16; jalons/l2c/file.md A1): a brand with its open entry, written straight into the local stack
// by the migration role (loopback only, @influx/test-kit/db), as apps/api's T14 file writes them. The
// deadline is given as a gap from now (negative: overdue), the lock as a colleague who holds it.
// The brands of a journey belong to a colleague, so that the journey reads them alone (`?owner=`)
// whatever other journeys left in the queue; `withdrawReviewEntries` closes them after the run, as
// no journey decides an entry and none must raise the counters of the next run (15 RG28).
import { connectAsMigrationRole } from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";

type Sql = ReturnType<typeof connectAsMigrationRole>;

async function withSql<T>(run: (sql: Sql) => Promise<T>): Promise<T> {
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    return await run(sql);
  } finally {
    await sql.end({ timeout: 1 });
  }
}

export type ReviewEntryOptions = {
  /** The trading name shown in the list. */
  name: string;
  /** The colleague who owns the account (15 RG36: never the one who reads the list). */
  ownerAgentId: string;
  countryCode?: string;
  /** A revision is the change of one moderated field of a published profile. */
  kind?: "submission" | "revision";
  /** Minutes from now to the deadline: negative, the entry is overdue. */
  dueInMinutes: number;
  /** The alert threshold of age is past (06 RG7). */
  escalated?: boolean;
  /** The colleague who holds the lock, taken ten minutes ago. */
  heldByAgentId?: string;
  /** A presentation with an e-mail address raises the alert of a direct contact (06 RG19). */
  presentation?: string;
  /** The moderated field a revision changes. */
  revisedField?: string;
};

/** Every account whose entry a journey opened, closed by `withdrawReviewEntries`. */
const brands: string[] = [];

const PRESENTATION =
  "We design durable outdoor gear for people who spend their weekends on the trails. ".repeat(
    2,
  );

/** A brand with its open entry; returns the account and the entry. */
export async function seedReviewEntry(
  options: ReviewEntryOptions,
): Promise<{ accountId: string; entryId: string }> {
  const accountId = randomUUID();
  const entryId = randomUUID();
  const kind = options.kind ?? "submission";
  await withSql((sql) =>
    sql.begin(async (tx) => {
      await tx`
        insert into identity.accounts
          (id, auth_user_id, email, email_verified_at, country_code, preferred_language,
           is_adult_attested, adult_attested_at, declared_status, owner_agent_id)
        values (${accountId}, ${randomUUID()}, ${`e2e-queue-${accountId}@example.test`}, now(),
                ${options.countryCode ?? "FR"}, 'fr', true, now(), 'business',
                ${options.ownerAgentId})`;
      await tx`
        insert into identity.account_roles (account_id, role) values (${accountId}, 'advertiser')`;
      await tx`
        insert into profiles.advertiser_profiles
          (account_id, legal_name, status, submitted_at, presentation, primary_sector_code,
           company_size_band, contact_role, completeness_percent, first_published_at)
        values (${accountId}, ${options.name},
                ${kind === "revision" ? "published" : "pending_review"}::profiles.advertiser_profile_status,
                now(), ${options.presentation ?? PRESENTATION}, 'sports_leisure', '11_50',
                'marketing', 80, ${kind === "revision" ? new Date() : null})`;
      await tx`
        insert into profiles.advertiser_contact_details
          (account_id, contact_first_name, contact_email, contact_phone)
        values (${accountId}, 'Contact', ${`contact-${accountId}@brand.example.test`}, '+33612345678')`;
      await tx`
        insert into profiles.advertiser_review_entries (id, account_id, kind)
        values (${entryId}, ${accountId}, ${kind}::profiles.review_entry_kind)`;
      // created, due and alert in ONE statement: the checks keep them in this order
      await tx`
        update profiles.advertiser_review_entries
           set created_at = now() + make_interval(mins => ${options.dueInMinutes}) - interval '8 hours',
               sla_due_at = now() + make_interval(mins => ${options.dueInMinutes}),
               escalate_at = now() + make_interval(mins => ${options.dueInMinutes})
                             + case when ${options.escalated === true} then interval '1 hour'
                                    else interval '3 days' end
         where id = ${entryId}`;
      if (options.heldByAgentId !== undefined) {
        await tx`
          update profiles.advertiser_review_entries
             set claimed_by_account_id = ${options.heldByAgentId},
                 claimed_at = now() - interval '10 minutes',
                 claim_expires_at = now() + interval '20 minutes'
           where id = ${entryId}`;
      }
      if (kind === "revision") {
        await tx`
          insert into profiles.profile_field_revisions
            (account_id, field_code, proposed_value, advertiser_review_entry_id)
          values (${accountId}, ${options.revisedField ?? "advertiser.presentation"},
                  ${"A new presentation of the brand, longer than before."}::jsonb, ${entryId})`;
      }
    }),
  );
  brands.push(accountId);
  return { accountId, entryId };
}

/** After the journeys: the entries they opened leave the queue, and its counters, undecided. */
export async function withdrawReviewEntries(): Promise<void> {
  if (brands.length === 0) {
    return;
  }
  await withSql(
    (sql) => sql`
      update profiles.advertiser_review_entries
         set state = 'withdrawn', closed_at = now()
       where state = 'open' and account_id = any(${brands}::uuid[])`,
  );
}

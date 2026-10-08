// What a sign-up left in the local stack, read back by the migration role (loopback only,
// @influx/test-kit/db): the account, its role, the terms accepted, the consent and its exact
// wording (RG32), and the three lines of the queue of EC-10, which no worker empties yet (J6).
import { connectAsMigrationRole } from "@influx/test-kit/db";

export type SignedUpAccount = {
  role: string;
  countryCode: string;
  preferredLanguage: string;
  declaredStatus: string;
  adultAttestedDated: boolean;
  legalName: string | null;
  acceptedTermsInForce: boolean;
  acceptanceLocale: string | null;
  consents: { purpose: string; granted: boolean; wording: string | null }[];
  queue: string[];
};

export async function signedUpAccount(
  email: string,
): Promise<SignedUpAccount | null> {
  const sql = connectAsMigrationRole({ max: 1 });
  try {
    const [account] = await sql<
      {
        id: string;
        country_code: string;
        preferred_language: string;
        declared_status: string;
        attested_dated: boolean;
      }[]
    >`
      select id::text, country_code, preferred_language, declared_status::text,
             is_adult_attested and adult_attested_at is not null as attested_dated
        from identity.accounts where email = ${email}`;
    if (account === undefined) {
      return null;
    }
    const roles = await sql<{ role: string }[]>`
      select role::text from identity.account_roles where account_id = ${account.id}::uuid`;
    const profiles = await sql<{ legal_name: string }[]>`
      select legal_name from profiles.advertiser_profiles
       where account_id = ${account.id}::uuid`;
    const acceptances = await sql<{ in_force: boolean; locale: string }[]>`
      select (v.effective_to is null) as in_force, a.locale::text
        from identity.terms_acceptances a
        join identity.terms_versions v on v.id = a.terms_version_id
       where a.account_id = ${account.id}::uuid
         and v.document_kind = 'terms_of_service'`;
    const consents = await sql<
      { purpose: string; granted: boolean; wording: string | null }[]
    >`
      select purpose::text, granted, evidence->>'wording' as wording
        from identity.consent_events
       where account_id = ${account.id}::uuid order by purpose`;
    const queue = await sql<{ destination: string }[]>`
      select destination::text from leads.outbox_events
       where subject_key = ${`account:${account.id}`} and event_type = 'lead.created'
       order by destination`;
    return {
      role: roles.map((row) => row.role).join(","),
      countryCode: account.country_code,
      preferredLanguage: account.preferred_language,
      declaredStatus: account.declared_status,
      adultAttestedDated: account.attested_dated,
      legalName: profiles[0]?.legal_name ?? null,
      acceptedTermsInForce:
        acceptances.length === 1 && acceptances[0]?.in_force === true,
      acceptanceLocale: acceptances[0]?.locale ?? null,
      consents,
      queue: queue.map((row) => row.destination),
    };
  } finally {
    await sql.end({ timeout: 1 });
  }
}

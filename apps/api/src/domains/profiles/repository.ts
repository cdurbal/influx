// SQL of the brand profile of the member's own account (docs/mvp/06 §A to §D; 0106, 0122, 0202,
// 0203; jalons/l2b, commit 07). Every statement runs in the member's transaction, as
// influx_advertiser: the account is the one of the transaction context (`influx.current_account_id()`),
// never a parameter, and the row-level policies of 0202 bind every read and write to it.
// - The columns of block 1 to 3, the six lists (replaced as a whole: delete, then insert with a
//   `slot` from 1 to n where the list is ordered), the contact person (upsert on `account_id`).
// - The trading name goes through identity.update_own_account() (0122): the column, and the ONE
//   lead.updated of CA3 in the same transaction. No second name column exists (06 RG2).
// - The submission is profiles.submit_own_advertiser_profile() (0203), the only member transition;
//   23514 carries the code of the first missing field in DETAIL, 55000 a state that cannot be
//   submitted, 42501 a wrong caller.
import { sql, type SQL } from "drizzle-orm";
import type { Transaction } from "../../db/index.ts";

/** The lists of the profile, by the name the contract gives them; the code column is fixed here. */
export const BRAND_PROFILE_LISTS = {
  secondarySectors: {
    table: "advertiser_secondary_sectors",
    column: "sector_code",
    slotted: true,
  },
  targetMarkets: {
    table: "advertiser_target_markets",
    column: "country_code",
    slotted: true,
  },
  workingLanguages: {
    table: "advertiser_working_languages",
    column: "language_code",
    slotted: false,
  },
  topics: { table: "advertiser_topics", column: "topic_code", slotted: true },
  networks: {
    table: "advertiser_networks",
    column: "network_code",
    slotted: false,
  },
  formats: {
    table: "advertiser_formats",
    column: "format_code",
    slotted: false,
  },
  audienceCountries: {
    table: "advertiser_audience_countries",
    column: "country_code",
    slotted: true,
  },
  usageRights: {
    table: "advertiser_usage_rights",
    column: "usage_right_code",
    slotted: false,
  },
} as const;

export type BrandProfileListName = keyof typeof BRAND_PROFILE_LISTS;

/** The profile as stored: what the account and the `profiles` tables hold, nothing computed. */
export type StoredBrandProfile = {
  status: string;
  submittedAt: string | null;
  legalName: string;
  country: string;
  preferredLanguage: string;
  signInEmail: string;
  primarySector: string | null;
  companySize: string | null;
  websiteDomain: string | null;
  presentation: string | null;
  exclusivityBand: string | null;
  collaborationRhythm: string | null;
  offersNonMonetary: boolean | null;
  contactRole: string | null;
  /** An active logo is attached (0204: one per brand). */
  hasLogo: boolean;
  lists: Record<BrandProfileListName, string[]>;
  contact: {
    firstName: string | null;
    email: string | null;
    phone: string | null;
    url: string | null;
  };
};

/** Codes still active in each reference list the form draws from. */
export type ActiveReferences = {
  sectors: string[];
  topics: string[];
  networks: string[];
  formats: string[];
  usageRights: string[];
  countries: string[];
  languages: string[];
};

const ISO_UTC = 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"';

/** A Postgres text-array literal, every element quoted (drizzle expands a JS array into a list). */
function textArray(values: readonly string[]): string {
  return `{${values
    .map((value) => `"${value.replace(/["\\]/g, "\\$&")}"`)
    .join(",")}}`;
}

/** The table of a list, schema-qualified; its name comes from the closed map above. */
function tableOf(name: BrandProfileListName): SQL {
  return sql`${sql.identifier("profiles")}.${sql.identifier(BRAND_PROFILE_LISTS[name].table)}`;
}

/**
 * An aggregated list of one table, in slot order where it has one. As JSON: the pool does not
 * fetch array types (`fetch_types: false`, db/pool.ts), so a Postgres array would come back as text.
 */
function listColumn(name: BrandProfileListName): SQL {
  const list = BRAND_PROFILE_LISTS[name];
  const table = tableOf(name);
  const column = sql.identifier(list.column);
  const order = sql.identifier(list.slotted ? "slot" : list.column);
  return sql`coalesce((select jsonb_agg(${column}::text order by ${order})
                         from ${table} l
                        where l.account_id = p.account_id), '[]'::jsonb)`;
}

type StoredRow = {
  status: string;
  submitted_at: string | null;
  legal_name: string;
  country: string;
  preferred_language: string;
  email: string;
  primary_sector_code: string | null;
  company_size_band: string | null;
  website_domain: string | null;
  presentation: string | null;
  exclusivity_band: string | null;
  collaboration_rhythm: string | null;
  offers_non_monetary: boolean | null;
  contact_role: string | null;
  contact_first_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  contact_url: string | null;
  has_logo: boolean;
} & Record<BrandProfileListName, string[]>;

/** The state of the session's own brand profile, or null when the account holds none. */
export async function readOwnBrandProfile(
  tx: Transaction,
): Promise<StoredBrandProfile | null> {
  const rows = await tx.execute<StoredRow>(sql`
    select p.status::text as status,
           to_char(p.submitted_at at time zone 'UTC', ${ISO_UTC}) as submitted_at,
           p.legal_name,
           a.country_code::text as country,
           a.preferred_language::text as preferred_language,
           a.email,
           p.primary_sector_code, p.company_size_band, p.website_domain, p.presentation,
           p.exclusivity_band, p.collaboration_rhythm, p.offers_non_monetary, p.contact_role,
           c.contact_first_name, c.contact_email, c.contact_phone, c.contact_url,
           exists (select 1 from profiles.brand_logo_objects lo
                    where lo.account_id = p.account_id and lo.state = 'active') as has_logo,
           ${listColumn("secondarySectors")} as "secondarySectors",
           ${listColumn("targetMarkets")} as "targetMarkets",
           ${listColumn("workingLanguages")} as "workingLanguages",
           ${listColumn("topics")} as "topics",
           ${listColumn("networks")} as "networks",
           ${listColumn("formats")} as "formats",
           ${listColumn("audienceCountries")} as "audienceCountries",
           ${listColumn("usageRights")} as "usageRights"
      from profiles.advertiser_profiles p
      join identity.accounts a on a.id = p.account_id
      left join profiles.advertiser_contact_details c on c.account_id = p.account_id
     where p.account_id = (select influx.current_account_id())`);
  const row = rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    status: row.status,
    submittedAt: row.submitted_at,
    legalName: row.legal_name,
    country: row.country,
    preferredLanguage: row.preferred_language,
    signInEmail: row.email,
    primarySector: row.primary_sector_code,
    companySize: row.company_size_band,
    websiteDomain: row.website_domain,
    presentation: row.presentation,
    exclusivityBand: row.exclusivity_band,
    collaborationRhythm: row.collaboration_rhythm,
    offersNonMonetary: row.offers_non_monetary,
    contactRole: row.contact_role,
    hasLogo: row.has_logo === true,
    lists: {
      secondarySectors: row.secondarySectors,
      targetMarkets: row.targetMarkets,
      workingLanguages: row.workingLanguages,
      topics: row.topics,
      networks: row.networks,
      formats: row.formats,
      audienceCountries: row.audienceCountries,
      usageRights: row.usageRights,
    },
    contact: {
      firstName: row.contact_first_name,
      email: row.contact_email,
      phone: row.contact_phone,
      url: row.contact_url,
    },
  };
}

/**
 * Locks the profile row for the rest of the transaction and returns its status: two saves at the
 * same moment (autosave from two tabs) are serialised, the second reads what the first committed.
 */
export async function lockOwnBrandProfile(
  tx: Transaction,
): Promise<string | null> {
  const rows = await tx.execute<{ status: string }>(
    sql`select status::text as status
          from profiles.advertiser_profiles
         where account_id = (select influx.current_account_id())
           for update`,
  );
  return rows[0]?.status ?? null;
}

/** The codes still active in the reference lists of the form (a retired code is never offered). */
export async function readActiveReferences(
  tx: Transaction,
): Promise<ActiveReferences> {
  const rows = await tx.execute<ActiveReferences>(sql`
    select (select coalesce(jsonb_agg(code::text order by code), '[]'::jsonb) from reference.sectors
             where retired_at is null) as sectors,
           (select coalesce(jsonb_agg(code::text order by code), '[]'::jsonb) from reference.topics
             where retired_at is null) as topics,
           (select coalesce(jsonb_agg(code::text order by code), '[]'::jsonb) from reference.networks
             where retired_at is null) as networks,
           (select coalesce(jsonb_agg(code::text order by code), '[]'::jsonb) from reference.formats
             where retired_at is null) as formats,
           (select coalesce(jsonb_agg(code::text order by sort_order), '[]'::jsonb) from reference.usage_rights
             where retired_at is null and code <> 'none') as "usageRights",
           (select coalesce(jsonb_agg(code::text order by code), '[]'::jsonb) from reference.countries
             where is_active) as countries,
           (select coalesce(jsonb_agg(code::text order by code), '[]'::jsonb) from reference.languages
             where is_active and code in ('fr', 'en')) as languages`);
  const row = rows[0];
  return {
    sectors: row?.sectors ?? [],
    topics: row?.topics ?? [],
    networks: row?.networks ?? [],
    formats: row?.formats ?? [],
    usageRights: row?.usageRights ?? [],
    countries: row?.countries ?? [],
    languages: row?.languages ?? [],
  };
}

/** The columns of the profile row a save may set; an absent key is left as it is. */
export type BrandProfileColumns = {
  primarySector?: string | null | undefined;
  companySize?: string | null | undefined;
  websiteDomain?: string | null | undefined;
  presentation?: string | null | undefined;
  exclusivityBand?: string | null | undefined;
  collaborationRhythm?: string | null | undefined;
  offersNonMonetary?: boolean | null | undefined;
  contactRole?: string | null | undefined;
};

/** Sets the given columns of the profile row (0202: column rights of influx_advertiser). */
export async function updateBrandProfileColumns(
  tx: Transaction,
  columns: BrandProfileColumns,
): Promise<void> {
  const assignments: SQL[] = [];
  if (columns.primarySector !== undefined) {
    assignments.push(sql`primary_sector_code = ${columns.primarySector}::text`);
  }
  if (columns.companySize !== undefined) {
    assignments.push(sql`company_size_band = ${columns.companySize}::text`);
  }
  if (columns.websiteDomain !== undefined) {
    assignments.push(sql`website_domain = ${columns.websiteDomain}::text`);
  }
  if (columns.presentation !== undefined) {
    assignments.push(sql`presentation = ${columns.presentation}::text`);
  }
  if (columns.exclusivityBand !== undefined) {
    assignments.push(sql`exclusivity_band = ${columns.exclusivityBand}::text`);
  }
  if (columns.collaborationRhythm !== undefined) {
    assignments.push(
      sql`collaboration_rhythm = ${columns.collaborationRhythm}::text`,
    );
  }
  if (columns.offersNonMonetary !== undefined) {
    assignments.push(
      sql`offers_non_monetary = ${columns.offersNonMonetary}::boolean`,
    );
  }
  if (columns.contactRole !== undefined) {
    assignments.push(sql`contact_role = ${columns.contactRole}::text`);
  }
  if (assignments.length === 0) {
    return;
  }
  await tx.execute(
    sql`update profiles.advertiser_profiles
           set ${sql.join(assignments, sql`, `)}
         where account_id = (select influx.current_account_id())`,
  );
}

/** Stores the score as packages/domain computed it (06 RG57); the base never recomputes it. */
export async function storeScore(
  tx: Transaction,
  percent: number,
): Promise<void> {
  await tx.execute(
    sql`update profiles.advertiser_profiles
           set completeness_percent = ${percent}::smallint
         where account_id = (select influx.current_account_id())
           and completeness_percent is distinct from ${percent}::smallint`,
  );
}

/**
 * Replaces a list as a whole: deletion, then insertion in the order given (slot 1 to n where the
 * list is ordered). The caps, the closed lists and `none` are the database's (0202).
 */
export async function replaceBrandProfileList(
  tx: Transaction,
  name: BrandProfileListName,
  codes: readonly string[],
): Promise<void> {
  const list = BRAND_PROFILE_LISTS[name];
  const table = tableOf(name);
  const column = sql.identifier(list.column);
  await tx.execute(
    sql`delete from ${table} where account_id = (select influx.current_account_id())`,
  );
  if (codes.length === 0) {
    return;
  }
  const literal = textArray(codes);
  if (list.slotted) {
    await tx.execute(
      sql`insert into ${table} (account_id, slot, ${column})
          select (select influx.current_account_id()), v.ord::smallint, v.code
            from unnest(${literal}::text[]) with ordinality as v (code, ord)`,
    );
  } else {
    await tx.execute(
      sql`insert into ${table} (account_id, ${column})
          select (select influx.current_account_id()), v.code
            from unnest(${literal}::text[]) as v (code)`,
    );
  }
}

/** The fields of the contact person to write; `null` empties one, an absent key is left alone. */
export type ContactChanges = {
  firstName?: string | null | undefined;
  email?: string | null | undefined;
  phone?: string | null | undefined;
  url?: string | null | undefined;
};

/** Upsert on `account_id` of the contact person (06 RG35); only the given fields are written. */
export async function upsertContact(
  tx: Transaction,
  changes: ContactChanges,
): Promise<void> {
  const fields: { column: string; value: string | null }[] = [];
  if (changes.firstName !== undefined) {
    fields.push({ column: "contact_first_name", value: changes.firstName });
  }
  if (changes.email !== undefined) {
    fields.push({ column: "contact_email", value: changes.email });
  }
  if (changes.phone !== undefined) {
    fields.push({ column: "contact_phone", value: changes.phone });
  }
  if (changes.url !== undefined) {
    fields.push({ column: "contact_url", value: changes.url });
  }
  if (fields.length === 0) {
    return;
  }
  const columns = sql.join(
    fields.map((field) => sql.identifier(field.column)),
    sql`, `,
  );
  const values = sql.join(
    fields.map((field) => sql`${field.value}::text`),
    sql`, `,
  );
  const assignments = sql.join(
    fields.map(
      (field) =>
        sql`${sql.identifier(field.column)} = excluded.${sql.identifier(field.column)}`,
    ),
    sql`, `,
  );
  await tx.execute(
    sql`insert into profiles.advertiser_contact_details (account_id, ${columns})
        values ((select influx.current_account_id()), ${values})
        on conflict (account_id) do update set ${assignments}`,
  );
}

/**
 * The trading name, through identity.update_own_account() (0122): the column and the ONE
 * lead.updated in this transaction (CA3). Country and language are left as they are (CA2).
 */
export async function renameCompany(
  tx: Transaction,
  companyName: string,
): Promise<boolean> {
  const rows = await tx.execute<{ changed: boolean }>(
    sql`select identity.update_own_account(
          null::text, null::text, null::identity.declared_status, ${companyName}::text
        ) as changed`,
  );
  return rows[0]?.changed === true;
}

export type SubmissionOutcome = {
  status: string;
  submittedAt: string | null;
  changed: boolean;
};

/** profiles.submit_own_advertiser_profile() (0203); the refusals are its SQLSTATE codes. */
export async function submitOwnBrandProfile(
  tx: Transaction,
): Promise<SubmissionOutcome> {
  const rows = await tx.execute<{
    status: string;
    submitted_at: string | null;
    changed: boolean;
  }>(
    sql`select status, to_char(submitted_at at time zone 'UTC', ${ISO_UTC}) as submitted_at, changed
          from profiles.submit_own_advertiser_profile()`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("profiles.submit_own_advertiser_profile() returned no row");
  }
  return {
    status: row.status,
    submittedAt: row.submitted_at,
    changed: row.changed,
  };
}

// The logo of the brand (0204; jalons/l2b/stockage.md §3 to §6, commit 09): the five member doors,
// SECURITY DEFINER, the account of the transaction context. The quota refusal is 54000, DETAIL
// `uploads` or `bytes` (EC-L2B-08-1).

/** A row of profiles.brand_logo_objects named by its id and the key the base generated. */
export type LogoObjectRef = {
  logoId: string;
  objectKey: string;
};

/** (b) The quota consumed and the row pending, before any byte is decoded. */
export async function beginBrandLogoUpload(
  tx: Transaction,
  receivedBytes: number,
): Promise<LogoObjectRef> {
  const rows = await tx.execute<{ logo_id: string; object_key: string }>(
    sql`select logo_id::text as logo_id, object_key
          from profiles.begin_brand_logo_upload(${receivedBytes}::integer)`,
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error("profiles.begin_brand_logo_upload() returned no row");
  }
  return { logoId: row.logo_id, objectKey: row.object_key };
}

/** (c) Refused by the checks of its bytes: the pending row deleted (the quota stays consumed). */
export async function discardBrandLogoUpload(
  tx: Transaction,
  logoId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ done: boolean }>(
    sql`select profiles.discard_brand_logo_upload(${logoId}::uuid) as done`,
  );
  return rows[0]?.done === true;
}

/** (d) The write to Storage failed: the pending row to purging (an object may exist). */
export async function failBrandLogoUpload(
  tx: Transaction,
  logoId: string,
): Promise<boolean> {
  const rows = await tx.execute<{ done: boolean }>(
    sql`select profiles.fail_brand_logo_upload(${logoId}::uuid) as done`,
  );
  return rows[0]?.done === true;
}

/** (e) The row active, the previous one to purging; the previous one, to remove at once (f). */
export async function activateBrandLogo(
  tx: Transaction,
  logoId: string,
  stored: { byteSize: number; width: number; height: number },
): Promise<LogoObjectRef | null> {
  const rows = await tx.execute<{
    previous_logo_id: string;
    previous_object_key: string;
  }>(
    sql`select previous_logo_id::text as previous_logo_id, previous_object_key
          from profiles.activate_brand_logo(${logoId}::uuid, ${stored.byteSize}::integer,
                 ${stored.width}::integer, ${stored.height}::integer)`,
  );
  const row = rows[0];
  return row === undefined
    ? null
    : { logoId: row.previous_logo_id, objectKey: row.previous_object_key };
}

/** DELETE: the active logo to purging; it, to remove at once, or null when there was none. */
export async function removeOwnBrandLogo(
  tx: Transaction,
): Promise<LogoObjectRef | null> {
  const rows = await tx.execute<{ logo_id: string; object_key: string }>(
    sql`select logo_id::text as logo_id, object_key
          from profiles.remove_own_brand_logo()`,
  );
  const row = rows[0];
  return row === undefined
    ? null
    : { logoId: row.logo_id, objectKey: row.object_key };
}

/** The active logo of the session's own account, as its row describes it. */
export type ActiveLogoRow = LogoObjectRef & {
  byteSize: number;
  width: number;
  height: number;
  activatedAt: string;
};

export async function readOwnActiveLogo(
  tx: Transaction,
): Promise<ActiveLogoRow | null> {
  const rows = await tx.execute<{
    logo_id: string;
    object_key: string;
    byte_size: number;
    width: number;
    height: number;
    activated_at: string;
  }>(
    sql`select id::text as logo_id, object_key, byte_size, width, height,
               to_char(activated_at at time zone 'UTC', ${ISO_UTC}) as activated_at
          from profiles.brand_logo_objects
         where account_id = (select influx.current_account_id()) and state = 'active'`,
  );
  const row = rows[0];
  return row === undefined
    ? null
    : {
        logoId: row.logo_id,
        objectKey: row.object_key,
        byteSize: Number(row.byte_size),
        width: Number(row.width),
        height: Number(row.height),
        activatedAt: row.activated_at,
      };
}

/** The DETAIL of a database error, through the wrapping of drizzle (`cause`). */
export function detailOf(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth += 1) {
    const detail: unknown = (current as Error & { detail?: unknown }).detail;
    if (typeof detail === "string" && detail !== "") {
      return detail;
    }
    current = current.cause;
  }
  return null;
}

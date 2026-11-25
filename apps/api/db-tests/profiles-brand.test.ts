// L2B commit 05 — the full brand profile of 0202 (docs/mvp/06 blocks 1 to 3, RG13 to RG37; 04 §5.2;
// 03 §3.2, C(9); D40, D46): the caps and closed lists held by the base, the shape of the domain,
// the phone, the address and the page, the free texts, and who reads and writes what. Rights per
// table and role are probed by T2 (t2-rls-matrix); the export and the erasure by
// t8-privacy-execution. Each case runs in a rolled-back transaction of the local superuser, which
// acts as apps/api does (support.ts: actAsMember, actAsInternal).
import {
  accountIdOf,
  inRolledBackTransaction,
  type DataSet,
} from "@influx/test-kit/db";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAsInternal,
  actAsMember,
  localSuperuser,
  migrationRole,
  testDataSet,
} from "./support.ts";

const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";
const UNIQUE_VIOLATION = "23505";
const INSUFFICIENT_PRIVILEGE = "42501";

/** The ten tables of the brand profile after 0202. */
const PROFILE_TABLES = [
  "profiles.advertiser_profiles",
  "profiles.advertiser_secondary_sectors",
  "profiles.advertiser_target_markets",
  "profiles.advertiser_working_languages",
  "profiles.advertiser_topics",
  "profiles.advertiser_networks",
  "profiles.advertiser_formats",
  "profiles.advertiser_audience_countries",
  "profiles.advertiser_usage_rights",
  "profiles.advertiser_contact_details",
] as const;

/** The two advertisers of the data set of T2, whose profile, lists and contact person it holds. */
const brandA = accountIdOf("advertiser", "a");
const brandB = accountIdOf("advertiser", "b");

let dataSet: DataSet;
let migration: postgres.Sql;

beforeAll(async () => {
  dataSet = await testDataSet();
  migration = migrationRole();
});

type Outcome =
  | { outcome: "rows"; count: number }
  | { outcome: "error"; code: string; constraint: string | undefined };

/** One statement in a savepoint of `tx`: its row count, or its SQLSTATE and constraint. */
async function run(
  tx: postgres.TransactionSql,
  statement: string,
  parameters: readonly postgres.ParameterOrJSON<never>[] = [],
): Promise<Outcome> {
  try {
    const result = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters as postgres.ParameterOrJSON<never>[],
      ),
    );
    return { outcome: "rows", count: Math.max(result.count, result.length) };
  } catch (error) {
    const found = error as { code?: string; constraint_name?: string };
    return {
      outcome: "error",
      code: found.code ?? "unknown",
      constraint: found.constraint_name,
    };
  }
}

/** One statement of the superuser (constraints alone can refuse), rolled back. */
function attempt(statement: string, beforehand?: string): Promise<Outcome> {
  return inRolledBackTransaction(localSuperuser(), async (tx) => {
    if (beforehand !== undefined) {
      await tx.unsafe(beforehand);
    }
    return run(tx, statement);
  });
}

/** A refusal of SQLSTATE `code`, by the named constraint when one is given. */
function refusedBy(code: string, constraint?: string): unknown {
  return constraint === undefined
    ? expect.objectContaining({ outcome: "error", code })
    : { outcome: "error", code, constraint };
}

const ACCEPTED_ONE = { outcome: "rows", count: 1 };

/** An UPDATE of brand A's profile row (the data set holds it). */
function profileUpdate(assignment: string): string {
  return `update profiles.advertiser_profiles set ${assignment}
           where account_id = '${brandA}'`;
}

/** An UPDATE of brand A's contact person (the data set holds the row). */
function contactUpdate(assignment: string): string {
  return `update profiles.advertiser_contact_details set ${assignment}
           where account_id = '${brandA}'`;
}

/** An INSERT of a choice of brand A in a list table. */
function listInsert(table: string, columns: string, values: string): string {
  return `insert into profiles.${table} (account_id, ${columns})
          values ('${brandA}', ${values})`;
}

// ---------------------------------------------------------------------------------------------
// The caps of 06 RG15 and RG27, held by the base
// ---------------------------------------------------------------------------------------------

describe("06 RG15, RG27: the caps of the lists, held by the base", () => {
  it.each([
    [
      "two secondary sectors",
      "advertiser_secondary_sectors",
      "slot, sector_code",
      "2, 'home_garden'",
    ],
    [
      "five target markets",
      "advertiser_target_markets",
      "slot, country_code",
      "5, 'DE'",
    ],
    ["three topics", "advertiser_topics", "slot, topic_code", "3, 'travel'"],
    [
      "five audience countries",
      "advertiser_audience_countries",
      "slot, country_code",
      "5, 'DE'",
    ],
  ])("accepts %s (the cap itself)", async (_label, table, columns, values) => {
    expect(await attempt(listInsert(table, columns, values))).toEqual(
      ACCEPTED_ONE,
    );
  });

  it.each([
    [
      "a third secondary sector",
      "advertiser_secondary_sectors",
      "slot, sector_code",
      "3, 'home_garden'",
      "advertiser_secondary_sectors_slot",
    ],
    [
      "a sixth target market",
      "advertiser_target_markets",
      "slot, country_code",
      "6, 'DE'",
      "advertiser_target_markets_slot",
    ],
    [
      "a fourth topic",
      "advertiser_topics",
      "slot, topic_code",
      "4, 'travel'",
      "advertiser_topics_slot",
    ],
    [
      "a sixth audience country",
      "advertiser_audience_countries",
      "slot, country_code",
      "6, 'DE'",
      "advertiser_audience_countries_slot",
    ],
    [
      "a working language other than fr and en",
      "advertiser_working_languages",
      "language_code",
      "'de'",
      "advertiser_working_languages_closed",
    ],
  ])("refuses %s", async (_label, table, columns, values, constraint) => {
    expect(await attempt(listInsert(table, columns, values))).toEqual(
      refusedBy(CHECK_VIOLATION, constraint),
    );
  });

  it.each([
    [
      "the same topic twice",
      "advertiser_topics",
      "slot, topic_code",
      "2, 'beauty'",
      "advertiser_topics_once",
    ],
    [
      "the same target market twice",
      "advertiser_target_markets",
      "slot, country_code",
      "2, 'FR'",
      "advertiser_target_markets_once",
    ],
    [
      "a second choice in a taken slot",
      "advertiser_audience_countries",
      "slot, country_code",
      "1, 'DE'",
      "advertiser_audience_countries_pkey",
    ],
    [
      "the same network twice",
      "advertiser_networks",
      "network_code",
      "'instagram'",
      "advertiser_networks_pkey",
    ],
  ])(
    "refuses %s (a list holds a choice once)",
    async (_label, table, columns, values, constraint) => {
      expect(await attempt(listInsert(table, columns, values))).toEqual(
        refusedBy(UNIQUE_VIOLATION, constraint),
      );
    },
  );
});

describe("L2-amend: `none` is not a usage right among others", () => {
  it("refuses `none` in the usage rights of a brand", async () => {
    expect(
      await attempt(
        listInsert("advertiser_usage_rights", "usage_right_code", "'none'"),
      ),
    ).toEqual(refusedBy(CHECK_VIOLATION, "advertiser_usage_rights_not_none"));
  });

  it("accepts a real right (the witness)", async () => {
    expect(
      await attempt(
        listInsert(
          "advertiser_usage_rights",
          "usage_right_code",
          "'paid_whitelisting'",
        ),
      ),
    ).toEqual(ACCEPTED_ONE);
  });
});

describe("06 RG13: every list is closed by its reference (foreign key)", () => {
  it.each([
    [
      "an unknown main sector",
      profileUpdate("primary_sector_code = 'tobacco'"),
    ],
    [
      "an unknown secondary sector",
      listInsert(
        "advertiser_secondary_sectors",
        "slot, sector_code",
        "2, 'tobacco'",
      ),
    ],
    [
      "an unknown market",
      listInsert("advertiser_target_markets", "slot, country_code", "2, 'ZZ'"),
    ],
    [
      "an unknown topic",
      listInsert("advertiser_topics", "slot, topic_code", "2, 'lifestyle'"),
    ],
    [
      "an unknown network",
      listInsert("advertiser_networks", "network_code", "'vine'"),
    ],
    [
      "an unknown format",
      listInsert("advertiser_formats", "format_code", "'vine_video'"),
    ],
    [
      "an unknown audience country",
      listInsert(
        "advertiser_audience_countries",
        "slot, country_code",
        "2, 'ZZ'",
      ),
    ],
    [
      "an unknown usage right",
      listInsert("advertiser_usage_rights", "usage_right_code", "'forever'"),
    ],
    [
      "a list of a profile that does not exist",
      `insert into profiles.advertiser_topics (account_id, slot, topic_code)
       values ('00000000-0000-4000-8000-000000000000', 1, 'beauty')`,
    ],
  ])("refuses %s", async (_label, statement) => {
    expect(await attempt(statement)).toEqual(refusedBy(FOREIGN_KEY_VIOLATION));
  });
});

// ---------------------------------------------------------------------------------------------
// Lengths and shapes (06 RG15, RG17, RG35)
// ---------------------------------------------------------------------------------------------

describe("06 RG15, RG35: lengths of the free texts", () => {
  it.each([
    [
      "a presentation of 1 000 characters",
      profileUpdate("presentation = repeat('é', 1000)"),
    ],
    [
      "a presentation with line breaks",
      profileUpdate(
        "presentation = E'We make shoes.\\n\\nWe look for creators.\\tThank you.'",
      ),
    ],
    [
      "a presentation shorter than 120 characters (a draft; 0203 refuses it at submission)",
      profileUpdate("presentation = 'Short draft.'"),
    ],
    [
      "a first name of 40 characters",
      contactUpdate("contact_first_name = repeat('é', 40)"),
    ],
  ])("accepts %s", async (_label, statement) => {
    expect(await attempt(statement)).toEqual(ACCEPTED_ONE);
  });

  it.each([
    [
      "a presentation of 1 001 characters",
      profileUpdate("presentation = repeat('é', 1001)"),
      "advertiser_profiles_presentation_length",
    ],
    [
      "a first name of 41 characters",
      contactUpdate("contact_first_name = repeat('é', 41)"),
      "advertiser_contact_details_first_name_length",
    ],
  ])("refuses %s", async (_label, statement, constraint) => {
    expect(await attempt(statement)).toEqual(
      refusedBy(CHECK_VIOLATION, constraint),
    );
  });
});

describe("06 RG17: the website is a domain, nothing more", () => {
  it.each([
    ["a domain", "exemple.com"],
    ["a sub-domain", "shop.exemple.co.uk"],
    ["a domain of another script, as typed", "café-été.fr"],
    ["a punycode domain", "xn--caf-dma.fr"],
    ["a domain of 100 characters", `${"a".repeat(60)}.${"b".repeat(35)}.com`],
  ])("accepts %s", async (_label, domain) => {
    expect(
      await attempt(profileUpdate(`website_domain = '${domain}'`)),
    ).toEqual(ACCEPTED_ONE);
  });

  it.each([
    ["a scheme", "https://exemple.com"],
    ["a path", "exemple.com/contact"],
    ["a parameter", "exemple.com?ref=x"],
    ["an anchor", "exemple.com#contact"],
    ["a port", "exemple.com:8080"],
    ["credentials", "user@exemple.com"],
    ["a single label", "exemple"],
    ["an IPv4 address", "192.168.0.10"],
    ["a label starting with a hyphen", "-exemple.com"],
    ["a one-letter last label", "exemple.c"],
    ["a space", "exemple .com"],
    ["an underscore", "ex_emple.com"],
  ])("refuses %s", async (_label, domain) => {
    expect(
      await attempt(profileUpdate(`website_domain = '${domain}'`)),
    ).toEqual(
      refusedBy(CHECK_VIOLATION, "advertiser_profiles_website_domain_shape"),
    );
  });

  it("refuses an upper-case domain (packages/domain stores it in lower case)", async () => {
    expect(
      await attempt(profileUpdate("website_domain = 'Exemple.com'")),
    ).toEqual(
      refusedBy(CHECK_VIOLATION, "advertiser_profiles_website_domain_lower"),
    );
  });

  it("refuses a domain of 101 characters", async () => {
    expect(
      await attempt(
        profileUpdate(
          `website_domain = '${"a".repeat(60)}.${"b".repeat(36)}.com'`,
        ),
      ),
    ).toEqual(
      refusedBy(CHECK_VIOLATION, "advertiser_profiles_website_domain_length"),
    );
  });
});

describe("06 RG35: the contact person's coordinates", () => {
  it.each([
    ["a phone of 7 digits", "contact_phone = '+1234567'"],
    ["a phone of 15 digits", "contact_phone = '+123456789012345'"],
    [
      "a professional address",
      "contact_email = 'camille.dupont@maison.example'",
    ],
    [
      "an https contact page",
      "contact_url = 'https://maison.example/contact?ref=a'",
    ],
    ["an https host alone", "contact_url = 'https://maison.example'"],
  ])("accepts %s", async (_label, assignment) => {
    expect(await attempt(contactUpdate(assignment))).toEqual(ACCEPTED_ONE);
  });

  it.each([
    ["a national number", "contact_phone = '0612345678'", "phone_shape"],
    [
      "a number with spaces",
      "contact_phone = '+33 6 12 34 56 78'",
      "phone_shape",
    ],
    ["a number of 6 digits", "contact_phone = '+123456'", "phone_shape"],
    [
      "a number of 16 digits",
      "contact_phone = '+1234567890123456'",
      "phone_shape",
    ],
    [
      "an address without @",
      "contact_email = 'camille.maison.example'",
      "email_shape",
    ],
    [
      "an address without a domain",
      "contact_email = 'camille@maison'",
      "email_shape",
    ],
    [
      "an upper-case address",
      "contact_email = 'Camille@maison.example'",
      "email_lower",
    ],
    [
      "an http page",
      "contact_url = 'http://maison.example/contact'",
      "url_https",
    ],
    [
      "a page with credentials",
      "contact_url = 'https://user@maison.example/'",
      "url_https",
    ],
    ["a page without a host", "contact_url = 'https:///contact'", "url_https"],
    ["a script", "contact_url = 'javascript:alert(1)'", "url_https"],
  ])("refuses %s", async (_label, assignment, suffix) => {
    expect(await attempt(contactUpdate(assignment))).toEqual(
      refusedBy(CHECK_VIOLATION, `advertiser_contact_details_${suffix}`),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// L2AT-5 for 0202: every check constraint of the ten tables has a case that it alone refuses
// (its name read from the error), accepted once that constraint is dropped (mutation). A
// constraint added to these tables without a case fails the inventory.
// ---------------------------------------------------------------------------------------------

const CONSTRAINT_CASES: Readonly<Record<string, readonly string[]>> = {
  // 0106
  advertiser_profiles_legal_name_length: [
    profileUpdate("legal_name = 'X'"),
    profileUpdate("legal_name = repeat('n', 121)"),
  ],
  advertiser_profiles_legal_name_printable: [
    profileUpdate("legal_name = E'Maison\\nNord'"),
  ],
  // 0202
  advertiser_profiles_company_size_band: [
    profileUpdate("company_size_band = '1_9'"),
  ],
  advertiser_profiles_website_domain_length: [
    profileUpdate(`website_domain = '${"a".repeat(60)}.${"b".repeat(36)}.com'`),
  ],
  advertiser_profiles_website_domain_lower: [
    profileUpdate("website_domain = 'Exemple.com'"),
  ],
  advertiser_profiles_website_domain_shape: [
    profileUpdate("website_domain = 'https://exemple.com'"),
    profileUpdate("website_domain = '10.0.0.10'"),
  ],
  advertiser_profiles_presentation_length: [
    profileUpdate("presentation = repeat('p', 1001)"),
  ],
  advertiser_profiles_presentation_not_blank: [
    profileUpdate("presentation = '   '"),
    profileUpdate("presentation = E'\\n\\n'"),
  ],
  advertiser_profiles_presentation_printable: [
    profileUpdate("presentation = 'Hello' || chr(7)"),
    profileUpdate("presentation = 'Hello' || chr(133)"),
  ],
  advertiser_profiles_exclusivity_band: [
    profileUpdate("exclusivity_band = 'le_6m'"),
  ],
  advertiser_profiles_collaboration_rhythm: [
    profileUpdate("collaboration_rhythm = 'yearly'"),
  ],
  advertiser_profiles_contact_role: [profileUpdate("contact_role = 'ceo'")],
  advertiser_profiles_completeness_percent: [
    profileUpdate("completeness_percent = 101"),
    profileUpdate("completeness_percent = -1"),
  ],
  advertiser_secondary_sectors_slot: [
    listInsert(
      "advertiser_secondary_sectors",
      "slot, sector_code",
      "3, 'home_garden'",
    ),
    listInsert(
      "advertiser_secondary_sectors",
      "slot, sector_code",
      "0, 'retail_ecommerce'",
    ),
  ],
  advertiser_target_markets_slot: [
    listInsert("advertiser_target_markets", "slot, country_code", "6, 'DE'"),
  ],
  advertiser_working_languages_closed: [
    listInsert("advertiser_working_languages", "language_code", "'de'"),
  ],
  advertiser_topics_slot: [
    listInsert("advertiser_topics", "slot, topic_code", "4, 'travel'"),
  ],
  advertiser_audience_countries_slot: [
    listInsert(
      "advertiser_audience_countries",
      "slot, country_code",
      "6, 'DE'",
    ),
  ],
  advertiser_usage_rights_not_none: [
    listInsert("advertiser_usage_rights", "usage_right_code", "'none'"),
  ],
  advertiser_contact_details_first_name_length: [
    contactUpdate("contact_first_name = repeat('c', 41)"),
  ],
  advertiser_contact_details_first_name_not_blank: [
    contactUpdate("contact_first_name = '  '"),
  ],
  advertiser_contact_details_first_name_printable: [
    contactUpdate("contact_first_name = E'Ann\\t'"),
  ],
  advertiser_contact_details_email_shape: [
    contactUpdate("contact_email = 'camille.maison.example'"),
  ],
  advertiser_contact_details_email_lower: [
    contactUpdate("contact_email = 'Camille@maison.example'"),
  ],
  advertiser_contact_details_email_length: [
    contactUpdate(
      `contact_email = '${"a".repeat(300)}@${"b".repeat(16)}.test'`,
    ),
  ],
  advertiser_contact_details_phone_shape: [
    contactUpdate("contact_phone = '0612345678'"),
  ],
  advertiser_contact_details_url_https: [
    contactUpdate("contact_url = 'http://maison.example/contact'"),
  ],
  advertiser_contact_details_url_length: [
    contactUpdate(`contact_url = 'https://exemple.com/${"a".repeat(481)}'`),
  ],
};

describe("every check constraint of the brand profile has a case (L2AT-5 for 0202)", () => {
  it("inventories exactly the check constraints of the ten tables", async () => {
    const rows = await migration<{ name: string }[]>`
      select conname as name
        from pg_constraint
       where contype = 'c'
         and conrelid::regclass::text = any(${PROFILE_TABLES as unknown as string[]})
       order by conname`;
    expect(rows.map((row) => row.name)).toEqual(
      Object.keys(CONSTRAINT_CASES).sort(),
    );
  });

  const flat = Object.entries(CONSTRAINT_CASES).flatMap(
    ([constraint, statements]) =>
      statements.map((statement, index) => ({
        constraint,
        index,
        statement,
        table: PROFILE_TABLES.find((name) =>
          constraint.startsWith(`${name.slice("profiles.".length)}_`),
        ),
      })),
  );

  it.each(flat)(
    "refuses $constraint (case $index) by that constraint",
    async ({ constraint, statement }) => {
      expect(await attempt(statement)).toEqual(
        refusedBy(CHECK_VIOLATION, constraint),
      );
    },
  );

  it.each(flat)(
    "accepts the case $index of $constraint once it is dropped (mutation)",
    async ({ constraint, statement, table }) => {
      expect(
        await attempt(
          statement,
          `alter table ${String(table)} drop constraint ${constraint}`,
        ),
      ).toEqual(ACCEPTED_ONE);
    },
  );
});

// ---------------------------------------------------------------------------------------------
// 06 RG13: no free text but the name, the presentation and the first name
// ---------------------------------------------------------------------------------------------

describe("06 RG13: the only free texts are the name, the presentation and the first name", () => {
  it("binds every other text column to a reference list, a closed list or a shape", async () => {
    const columns = await migration<{ name: string; bound: boolean }[]>`
      select c.relname || '.' || a.attname as name,
             exists (select 1 from pg_constraint k
                      where k.conrelid = c.oid and k.contype = 'f'
                        and a.attnum = any (k.conkey)
                        and k.confrelid::regclass::text like 'reference.%') as bound
        from pg_attribute a
        join pg_class c on c.oid = a.attrelid
       where c.oid = any (${PROFILE_TABLES as unknown as string[]}::regclass[])
         and a.attnum > 0 and not a.attisdropped
         and a.atttypid in ('text'::regtype, 'character'::regtype, 'character varying'::regtype)
       order by 1`;
    // Not bound to a reference list: the closed lists of a CHECK, the four shapes, the free texts.
    expect(
      columns
        .filter((column) => !column.bound)
        .map((column) => column.name)
        .sort(),
    ).toEqual(
      [
        // closed lists (CHECK ... in)
        "advertiser_profiles.collaboration_rhythm",
        "advertiser_profiles.company_size_band",
        "advertiser_profiles.contact_role",
        "advertiser_profiles.exclusivity_band",
        // shapes
        "advertiser_profiles.website_domain",
        "advertiser_contact_details.contact_email",
        "advertiser_contact_details.contact_phone",
        "advertiser_contact_details.contact_url",
        // the three free texts of RG13 (a name, the presentation, a first name)
        "advertiser_profiles.legal_name",
        "advertiser_profiles.presentation",
        "advertiser_contact_details.contact_first_name",
      ].sort(),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// Who reads and writes (03 §3.2, C(9); 06 RG37; D40, D46)
// ---------------------------------------------------------------------------------------------

type Tx = postgres.TransactionSql;

function asBrand<T>(tx: Tx, account: string, fn: () => Promise<T>): Promise<T> {
  return actAsMember(
    tx,
    "influx_advertiser",
    { accountId: account, role: "advertiser", aal: "aal1" },
    fn,
  );
}

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

describe("03 §3.2: the owner alone writes his profile, through named columns", () => {
  it("updates the columns of blocks 1 to 3 of his own profile, never another's", async () => {
    const outcome = await scenario((tx) =>
      asBrand(tx, brandA, async () => ({
        own: await run(
          tx,
          `update profiles.advertiser_profiles
              set primary_sector_code = 'home_garden', company_size_band = '51_250',
                  website_domain = 'maison.example', presentation = 'Our words.',
                  exclusivity_band = 'negotiable', collaboration_rhythm = 'ambassador',
                  offers_non_monetary = false, contact_role = 'executive',
                  completeness_percent = 42
            where account_id = $1`,
          [brandA],
        ),
        other: await run(
          tx,
          "update profiles.advertiser_profiles set presentation = 'Taken over.' where account_id = $1",
          [brandB],
        ),
      })),
    );
    expect(outcome).toEqual({
      own: ACCEPTED_ONE,
      other: { outcome: "rows", count: 0 },
    });
  });

  it.each([
    ["the status (0203)", "status = 'draft'"],
    ["the name (identity.update_own_account, 0122)", "legal_name = 'Renamed'"],
    ["the dates", "updated_at = now()"],
  ])("refuses him %s (42501)", async (_label, assignment) => {
    const outcome = await scenario((tx) =>
      asBrand(tx, brandA, () =>
        run(
          tx,
          `update profiles.advertiser_profiles set ${assignment} where account_id = $1`,
          [brandA],
        ),
      ),
    );
    expect(outcome).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
  });

  it("refuses him to create or delete a profile (42501)", async () => {
    const outcome = await scenario((tx) =>
      asBrand(tx, brandA, async () => ({
        insert: await run(
          tx,
          "insert into profiles.advertiser_profiles (account_id, legal_name) values ($1, 'Twin')",
          [brandA],
        ),
        delete: await run(
          tx,
          "delete from profiles.advertiser_profiles where account_id = $1",
          [brandA],
        ),
      })),
    );
    expect(outcome).toEqual({
      insert: refusedBy(INSUFFICIENT_PRIVILEGE),
      delete: refusedBy(INSUFFICIENT_PRIVILEGE),
    });
  });

  it("replaces his own list (delete, then insert), never another brand's", async () => {
    const outcome = await scenario(async (tx) => {
      const written = await asBrand(tx, brandA, async () => ({
        cleared: await run(
          tx,
          "delete from profiles.advertiser_topics where account_id = $1",
          [brandA],
        ),
        added: await run(
          tx,
          `insert into profiles.advertiser_topics (account_id, slot, topic_code)
           values ($1, 1, 'travel'), ($1, 2, 'food'), ($1, 3, 'pets')`,
          [brandA],
        ),
        otherDeleted: await run(
          tx,
          "delete from profiles.advertiser_topics where account_id = $1",
          [brandB],
        ),
        otherAdded: await run(
          tx,
          "insert into profiles.advertiser_topics (account_id, slot, topic_code) values ($1, 2, 'food')",
          [brandB],
        ),
        updated: await run(
          tx,
          "update profiles.advertiser_topics set topic_code = 'gaming' where account_id = $1",
          [brandA],
        ),
      }));
      const topics = await tx<{ account_id: string; topic_code: string }[]>`
        select account_id::text, topic_code from profiles.advertiser_topics
         where account_id in (${brandA}, ${brandB}) order by account_id = ${brandB}, slot`;
      return { written, topics };
    });
    expect(outcome.written).toEqual({
      cleared: ACCEPTED_ONE,
      added: { outcome: "rows", count: 3 },
      otherDeleted: { outcome: "rows", count: 0 },
      otherAdded: refusedBy(INSUFFICIENT_PRIVILEGE),
      updated: refusedBy(INSUFFICIENT_PRIVILEGE),
    });
    expect(outcome.topics).toEqual([
      { account_id: brandA, topic_code: "travel" },
      { account_id: brandA, topic_code: "food" },
      { account_id: brandA, topic_code: "pets" },
      { account_id: brandB, topic_code: "fashion" },
    ]);
  });

  it("writes and reads his own contact person, never another brand's", async () => {
    const outcome = await scenario((tx) =>
      asBrand(tx, brandA, async () => ({
        upsert: await run(
          tx,
          `insert into profiles.advertiser_contact_details
             (account_id, contact_first_name, contact_email, contact_phone, contact_url)
           values ($1, 'Camille', 'camille@maison.example', '+33612345678',
                   'https://maison.example/contact')
           on conflict (account_id) do update
             set contact_first_name = excluded.contact_first_name,
                 contact_email = excluded.contact_email,
                 contact_phone = excluded.contact_phone,
                 contact_url = excluded.contact_url`,
          [brandA],
        ),
        seen: await tx<{ account_id: string; contact_first_name: string }[]>`
          select account_id::text, contact_first_name
            from profiles.advertiser_contact_details order by account_id`,
        other: await run(
          tx,
          "update profiles.advertiser_contact_details set contact_phone = '+33700000000' where account_id = $1",
          [brandB],
        ),
        otherInsert: await run(
          tx,
          "insert into profiles.advertiser_contact_details (account_id, contact_first_name) values ($1, 'Intruder')",
          [brandB],
        ),
      })),
    );
    expect(outcome).toEqual({
      upsert: ACCEPTED_ONE,
      seen: [{ account_id: brandA, contact_first_name: "Camille" }],
      other: { outcome: "rows", count: 0 },
      otherInsert: refusedBy(INSUFFICIENT_PRIVILEGE),
    });
  });
});

describe("D40, D46 (03 C(9)): a creator holds nothing on the brand profile at L2B", () => {
  it("has no right in the catalogue on any of the ten tables", async () => {
    const rows = await migration<{ grant: string }[]>`
      select t || ' ' || p as grant
        from unnest(${PROFILE_TABLES as unknown as string[]}::text[]) t,
             unnest(array['SELECT', 'INSERT', 'UPDATE', 'DELETE']) p
       where has_table_privilege('influx_creator', t, p)
          or (p <> 'DELETE' and has_any_column_privilege('influx_creator', t, p))`;
    expect(rows).toEqual([]);
  });

  it.each(PROFILE_TABLES)(
    "refuses a creator any read of %s (42501), the contact person included",
    async (table) => {
      const creator = dataSet.accounts.creator.a.id;
      const outcome = await scenario((tx) =>
        actAsMember(
          tx,
          "influx_creator",
          { accountId: creator, role: "creator", aal: "aal1" },
          () => run(tx, `select * from ${table}`),
        ),
      );
      expect(outcome).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
    },
  );
});

describe("06 RG37: agent and admin read the contact person in aal2, and write nothing at L2B", () => {
  it.each(["influx_agent", "influx_admin"] as const)(
    "%s reads every brand's contact person in aal2, none in aal1",
    async (role) => {
      const side = role === "influx_agent" ? "agent" : "admin";
      const account = dataSet.accounts[side].a.id;
      const read = (aal: "aal1" | "aal2") =>
        scenario((tx) =>
          actAsInternal(
            tx,
            role,
            { accountId: account, role: side, aal },
            () =>
              tx<{ account_id: string; contact_email: string }[]>`
                select account_id::text, contact_email
                  from profiles.advertiser_contact_details
                 where account_id in (${brandA}, ${brandB}) order by contact_email`,
          ),
        );
      expect(await read("aal2")).toEqual([
        { account_id: brandA, contact_email: "t2-contact-a@example.test" },
        { account_id: brandB, contact_email: "t2-contact-b@example.test" },
      ]);
      expect(await read("aal1")).toEqual([]);
    },
  );

  it.each([
    ["the profile", profileUpdate("presentation = 'Corrected.'")],
    ["the contact person", contactUpdate("contact_phone = '+33700000000'")],
    [
      "a list",
      listInsert("advertiser_topics", "slot, topic_code", "2, 'travel'"),
    ],
  ])(
    "refuses an agent any write of %s (42501, 03 C(7) comes with L2C)",
    async (_label, statement) => {
      const agent = dataSet.accounts.agent.a.id;
      const outcome = await scenario((tx) =>
        actAsInternal(
          tx,
          "influx_agent",
          { accountId: agent, role: "agent", aal: "aal2" },
          () => run(tx, statement),
        ),
      );
      expect(outcome).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
    },
  );
});

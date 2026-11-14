// L3B commit 02 — the campaigns core of 0303 (docs/mvp/09 blocks 1 to 8; 04 §5.4 as
// jalons/l3b/modele.md reformulates it; fiche invariants 1, 3, 4, 9, 11).
//   L3B-T2  the base holds the shape of a campaign: caps by rank, closed lists, upper bounds, the
//           order of the four dates, the 12-month window, the coherence of rights, product and gift,
//           the band of Q16 and its currency, the suspended range (D78), the declaration of RG85,
//           and the required fields outside draft, rejected and an erased campaign.
//   L3B-T3  who reads and writes what: the brand on its own campaigns and lists through named
//           columns, never the state, the cycle, the declaration, the range nor the owner; the
//           freeze outside draft and rejected; another brand, a creator, an agent refused; the nine
//           Lot 3 codes with their export_class; the Drizzle declaration held to the catalogue (TM11).
// Rights per table and role are also probed by T2 (t2-rls-matrix). Each case runs in a rolled-back
// transaction of the local superuser, which acts as apps/api does (support.ts: actAsMember).
import {
  accountIdOf,
  CAMPAIGN_IDS,
  inRolledBackTransaction,
} from "@influx/test-kit/db";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import { campaignsColumns } from "../src/db/schema/introspection.ts";
import { campaignCalendar, civilDateIn } from "./campaign-dates-kit.ts";
import {
  actAsInternal,
  actAsMember,
  localSuperuser,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;

const CHECK_VIOLATION = "23514";
const FOREIGN_KEY_VIOLATION = "23503";
const UNIQUE_VIOLATION = "23505";
const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_EDITABLE = "55000";

const brandA = accountIdOf("advertiser", "a");
const brandB = accountIdOf("advertiser", "b");
const campaignA = CAMPAIGN_IDS.a;
const campaignB = CAMPAIGN_IDS.b;

/** A band of the test only, in EUR (reference.price_bands is loaded by 0304, line 03). */
const PROBE_BAND = "l3b_t2_probe";
const WITH_PROBE_BAND =
  "insert into reference.price_bands (currency, code, label_key, min_amount_minor, max_amount_minor) " +
  `values ('EUR', '${PROBE_BAND}', 'price_band.${PROBE_BAND}', 0, 100000), ` +
  `('GBP', '${PROBE_BAND}', 'price_band.${PROBE_BAND}', 0, 100000)`;

beforeAll(async () => {
  await testDataSet();
});

type Outcome =
  | { outcome: "rows"; count: number }
  | { outcome: "error"; code: string; constraint: string | undefined };

/** One statement in a savepoint of `tx`: its row count, or its SQLSTATE and constraint. */
async function run(tx: Tx, statement: string): Promise<Outcome> {
  try {
    const result = await tx.savepoint((savepoint) =>
      savepoint.unsafe(statement),
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

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

/** One statement of the superuser (constraints alone can refuse), the probe band loaded first. */
function attempt(statement: string, beforehand?: string): Promise<Outcome> {
  return scenario(async (tx) => {
    await tx.unsafe(WITH_PROBE_BAND);
    if (beforehand !== undefined) {
      await tx.unsafe(beforehand);
    }
    return run(tx, statement);
  });
}

function refusedBy(code: string, constraint?: string): unknown {
  return constraint === undefined
    ? expect.objectContaining({ outcome: "error", code })
    : { outcome: "error", code, constraint };
}

const ACCEPTED_ONE = { outcome: "rows", count: 1 };

/** The four dates of a valid campaign, from today (L3BT-9). */
const CALENDAR = campaignCalendar();

/** The columns of a campaign ready to submit (cash, EUR, the probe band), as SQL literals. */
const SUBMITTABLE: Readonly<Record<string, string>> = {
  advertiser_account_id: `'${brandA}'`,
  status: "'pending_review'",
  title: "repeat('t', 10)",
  campaign_type_code: "'product_placement'",
  public_summary: "repeat('s', 120)",
  brief: "repeat('b', 300)",
  product_description: "repeat('p', 20)",
  sector_code: "'beauty_personal_care'",
  product_is_sent: "false",
  usage_rights_code: "'none'",
  exclusivity_band: "'none'",
  content_review_delay: "'5bd'",
  currency: "'EUR'",
  remuneration_kind: "'cash'",
  per_creator_budget_band_code: `'${PROBE_BAND}'`,
  creators_wanted: "3",
  applications_close_on: `date '${CALENDAR.applicationsCloseOn}'`,
  starts_on: `date '${CALENDAR.startsOn}'`,
  ends_on: `date '${CALENDAR.endsOn}'`,
};

/** An INSERT of a campaign of brand A: the submittable row, with `overrides` (null drops a column). */
function campaignInsert(
  overrides: Readonly<Record<string, string | null>> = {},
  base: Readonly<Record<string, string>> = SUBMITTABLE,
): string {
  const columns = { ...base, ...overrides };
  const kept = Object.entries(columns).filter(
    (entry): entry is [string, string] => entry[1] !== null,
  );
  return (
    `insert into campaigns.campaigns (${kept.map(([column]) => column).join(", ")}) ` +
    `values (${kept.map(([, value]) => value).join(", ")})`
  );
}

/** A draft of brand A with `overrides` only. */
function draftInsert(overrides: Readonly<Record<string, string>>): string {
  return campaignInsert(overrides, { advertiser_account_id: `'${brandA}'` });
}

/** An UPDATE of the draft of brand A (the data set holds it). */
function draftUpdate(assignment: string): string {
  return `update campaigns.campaigns set ${assignment} where id = '${campaignA}'`;
}

/** An INSERT in a list of the draft of brand A. */
function listInsert(table: string, columns: string, values: string): string {
  return `insert into campaigns.${table} (campaign_id, ${columns}) values ('${campaignA}', ${values})`;
}

function asBrand<T>(tx: Tx, account: string, fn: () => Promise<T>): Promise<T> {
  return actAsMember(
    tx,
    "influx_advertiser",
    { accountId: account, role: "advertiser", aal: "aal1" },
    fn,
  );
}

// ---------------------------------------------------------------------------------------------
// L3B-T2: the shape of a campaign, held by the base
// ---------------------------------------------------------------------------------------------

describe("L3B-T2 caps by rank and codes once (modele §3, pattern 0202)", () => {
  it.each([
    [
      "campaign_key_messages",
      "position, body",
      "6, 'A sixth message'",
      "campaign_key_messages_position",
    ],
    [
      "campaign_deliverables",
      "slot, network_code, format_code, quantity",
      "11, 'youtube', 'youtube_short', 1",
      "campaign_deliverables_slot",
    ],
    [
      "campaign_usage_territories",
      "slot, country_code",
      "6, 'DE'",
      "campaign_usage_territories_slot",
    ],
    [
      "campaign_audience_countries",
      "slot, country_code",
      "6, 'DE'",
      "campaign_audience_countries_slot",
    ],
    [
      "campaign_topics",
      "slot, topic_code",
      "4, 'travel'",
      "campaign_topics_slot",
    ],
    [
      "campaign_requested_items",
      "slot, item_code",
      "5, 'concept_proposal'",
      "campaign_requested_items_slot",
    ],
  ])(
    "L3B-T2 refuses a row beyond the cap of %s",
    async (table, columns, values, constraint) => {
      expect(await attempt(listInsert(table, columns, values))).toEqual(
        refusedBy(CHECK_VIOLATION, constraint),
      );
    },
  );

  it("L3B-T2 refuses the same code twice in a list, and the same deliverable line twice (RG36)", async () => {
    expect(
      await attempt(
        listInsert("campaign_topics", "slot, topic_code", "2, 'beauty'"),
      ),
    ).toEqual(refusedBy(UNIQUE_VIOLATION, "campaign_topics_once"));
    expect(
      await attempt(
        listInsert(
          "campaign_deliverables",
          "slot, network_code, format_code, quantity",
          "2, 'instagram', 'instagram_reel', 3",
        ),
      ),
    ).toEqual(refusedBy(UNIQUE_VIOLATION, "campaign_deliverables_once"));
  });

  it("L3B-T2 bounds a deliverable quantity from 1 to 20 and a key message to 200 characters", async () => {
    for (const quantity of [0, 21]) {
      expect(
        await attempt(
          listInsert(
            "campaign_deliverables",
            "slot, network_code, format_code, quantity",
            `2, 'youtube', 'youtube_short', ${quantity}`,
          ),
        ),
      ).toEqual(refusedBy(CHECK_VIOLATION, "campaign_deliverables_quantity"));
    }
    expect(
      await attempt(
        listInsert(
          "campaign_key_messages",
          "position, body",
          "2, repeat('k', 201)",
        ),
      ),
    ).toEqual(refusedBy(CHECK_VIOLATION, "campaign_key_messages_body_length"));
  });

  it("L3B-T2 refuses a format of another network (23514 deliverable_format), accepts a UGC format on any network (-9)", async () => {
    expect(
      await attempt(
        listInsert(
          "campaign_deliverables",
          "slot, network_code, format_code, quantity",
          "2, 'tiktok', 'youtube_short', 1",
        ),
      ),
    ).toEqual(refusedBy(CHECK_VIOLATION, "deliverable_format"));
    expect(
      await attempt(
        listInsert(
          "campaign_deliverables",
          "slot, network_code, format_code, quantity",
          "2, 'tiktok', 'ugc_video', 1",
        ),
      ),
    ).toEqual(ACCEPTED_ONE);
  });

  it("L3B-T2 refuses the inactive requested item proposed_rate (D78, EC-L3B-02-2)", async () => {
    expect(
      await attempt(
        listInsert(
          "campaign_requested_items",
          "slot, item_code",
          "2, 'proposed_rate'",
        ),
      ),
    ).toEqual(refusedBy(CHECK_VIOLATION, "requested_item_inactive"));
  });
});

describe("L3B-T2 upper bounds and closed lists in every state (modele §2)", () => {
  it.each([
    ["title", "repeat('t', 141)", "campaigns_title_length"],
    ["public_summary", "repeat('s', 401)", "campaigns_public_summary_length"],
    ["brief", "repeat('b', 4001)", "campaigns_brief_length"],
    ["product_description", "repeat('p', 601)", "campaigns_product_length"],
    ["restrictions", "repeat('r', 1001)", "campaigns_restrictions_length"],
    [
      "internal_reference",
      "repeat('i', 41)",
      "campaigns_internal_reference_length",
    ],
    ["content_review_delay", "'3bd'", "campaigns_content_review_delay"],
    ["exclusivity_band", "'le_6m'", "campaigns_exclusivity_band"],
    [
      "usage_rights_duration_band",
      "'24m'",
      "campaigns_usage_rights_duration_band",
    ],
    [
      "usage_rights_territory_scope",
      "'europe'",
      "campaigns_usage_rights_territory_scope",
    ],
    [
      "shipping_costs_borne_by",
      "'influx'",
      "campaigns_shipping_costs_borne_by",
    ],
    ["creators_wanted", "51", "campaigns_creators_wanted"],
    ["max_applications", "201", "campaigns_max_applications"],
    ["total_budget_minor", "0", "campaigns_total_budget_positive"],
  ])("L3B-T2 refuses %s = %s on a draft", async (column, value, constraint) => {
    expect(
      await attempt(draftInsert({ [column]: value, currency: "'EUR'" })),
    ).toEqual(refusedBy(CHECK_VIOLATION, constraint));
  });

  it("L3B-T2 keeps a draft with nothing but its owner (RG108)", async () => {
    expect(await attempt(draftInsert({}))).toEqual(ACCEPTED_ONE);
  });
});

describe("L3B-T2 the calendar (RG70, RG74; EC-L3B-02-3)", () => {
  it("L3B-T2 refuses dates out of order, even on a partial calendar", async () => {
    expect(
      await attempt(
        draftUpdate(
          `applications_close_on = date '${civilDateIn(41)}', ends_on = date '${civilDateIn(40)}'`,
        ),
      ),
    ).toEqual(refusedBy(CHECK_VIOLATION, "campaigns_dates_ordered"));
    expect(
      await attempt(
        draftUpdate(
          `content_due_on = date '${civilDateIn(33)}', starts_on = date '${civilDateIn(32)}'`,
        ),
      ),
    ).toEqual(refusedBy(CHECK_VIOLATION, "campaigns_dates_ordered"));
    expect(
      await attempt(
        draftUpdate(
          `applications_close_on = date '${CALENDAR.applicationsCloseOn}', ` +
            `content_due_on = date '${CALENDAR.contentDueOn}', ` +
            `starts_on = date '${CALENDAR.startsOn}', ends_on = date '${CALENDAR.endsOn}'`,
        ),
      ),
    ).toEqual(ACCEPTED_ONE);
  });

  it("L3B-T2 refuses a publication window beyond 12 months", async () => {
    expect(
      await attempt(
        draftUpdate(
          "starts_on = date '2027-02-01', ends_on = date '2028-02-02'",
        ),
      ),
    ).toEqual(
      refusedBy(CHECK_VIOLATION, "campaigns_publication_window_max_12m"),
    );
    expect(
      await attempt(
        draftUpdate(
          "starts_on = date '2027-02-01', ends_on = date '2028-02-01'",
        ),
      ),
    ).toEqual(ACCEPTED_ONE);
  });
});

describe("L3B-T2 rights, product and gift (RG24, RG29, RG39, RG43, RG62, RG63)", () => {
  it("L3B-T2 refuses terms on `none` and `none` on a UGC campaign", async () => {
    expect(
      await attempt(
        draftUpdate(
          "usage_rights_code = 'none', usage_rights_duration_band = '3m'",
        ),
      ),
    ).toEqual(
      refusedBy(CHECK_VIOLATION, "campaigns_usage_rights_none_has_no_terms"),
    );
    expect(
      await attempt(
        draftUpdate(
          "campaign_type_code = 'ugc_delivered', usage_rights_code = 'none'",
        ),
      ),
    ).toEqual(
      refusedBy(CHECK_VIOLATION, "campaigns_ugc_requires_usage_rights"),
    );
  });

  it("L3B-T2 refuses details on a product not sent, and « no product » on a gift kind (-7)", async () => {
    expect(
      await attempt(
        draftUpdate("product_is_sent = false, creator_keeps_product = true"),
      ),
    ).toEqual(
      refusedBy(CHECK_VIOLATION, "campaigns_product_not_sent_has_no_details"),
    );
    for (const kind of ["gift_only", "cash_and_gift"]) {
      expect(
        await attempt(
          draftUpdate(`remuneration_kind = '${kind}', product_is_sent = false`),
        ),
      ).toEqual(
        refusedBy(CHECK_VIOLATION, "campaigns_gift_kinds_require_product"),
      );
    }
  });
});

describe("L3B-T2 the band of Q16 and the suspended range (modele §1, D78)", () => {
  it("L3B-T2 refuses a band on « gift only » (CA76)", async () => {
    expect(
      await attempt(
        draftUpdate(
          `currency = 'EUR', remuneration_kind = 'gift_only', per_creator_budget_band_code = '${PROBE_BAND}'`,
        ),
      ),
    ).toEqual(
      refusedBy(CHECK_VIOLATION, "campaigns_gift_only_has_no_budget_band"),
    );
  });

  it("L3B-T2 refuses a band or an amount without its currency (MATCH SIMPLE)", async () => {
    expect(
      await attempt(
        draftUpdate(`per_creator_budget_band_code = '${PROBE_BAND}'`),
      ),
    ).toEqual(refusedBy(CHECK_VIOLATION, "campaigns_amounts_need_currency"));
    expect(await attempt(draftUpdate("total_budget_minor = 500000"))).toEqual(
      refusedBy(CHECK_VIOLATION, "campaigns_amounts_need_currency"),
    );
  });

  it("L3B-T2 refuses a band the currency does not hold, and a change of currency that keeps the band (23503)", async () => {
    expect(
      await attempt(
        draftUpdate(
          "currency = 'EUR', per_creator_budget_band_code = 'no_such_band'",
        ),
      ),
    ).toEqual(refusedBy(FOREIGN_KEY_VIOLATION, "campaigns_budget_band_fk"));
    expect(
      await attempt(
        draftUpdate("currency = 'USD'"),
        draftUpdate(
          `currency = 'EUR', per_creator_budget_band_code = '${PROBE_BAND}'`,
        ),
      ),
    ).toEqual(refusedBy(FOREIGN_KEY_VIOLATION, "campaigns_budget_band_fk"));
    expect(
      await attempt(
        draftUpdate("currency = 'GBP'"),
        draftUpdate(
          `currency = 'EUR', per_creator_budget_band_code = '${PROBE_BAND}'`,
        ),
      ),
    ).toEqual(ACCEPTED_ONE);
  });

  it("L3B-T2 keeps the exact range empty, whatever the writer (D78)", async () => {
    expect(
      await attempt(
        draftUpdate("currency = 'EUR', per_creator_amount_min_minor = 10000"),
      ),
    ).toEqual(
      refusedBy(CHECK_VIOLATION, "campaigns_exact_range_suspended_d78"),
    );
  });
});

describe("L3B-T2 the declaration of RG85 and the erasure (EC-L3B-02-4, EC-L3B-02-5)", () => {
  it("L3B-T2 refuses a partial declaration, a locale outside fr and en, a hash that is not a SHA-256", async () => {
    expect(
      await attempt(draftUpdate("authorizations_declared_at = now()")),
    ).toEqual(refusedBy(CHECK_VIOLATION, "campaigns_declaration_is_complete"));
    const full = (locale: string, bytes: number) =>
      draftUpdate(
        `authorizations_declared_at = now(), authorizations_declared_by_account_id = '${brandA}', ` +
          `authorizations_declaration_locale = '${locale}', ` +
          `authorizations_declaration_hash = sha256(convert_to(repeat('x', ${bytes}), 'UTF8'))`,
      );
    expect(await attempt(full("de", 1))).toEqual(
      refusedBy(CHECK_VIOLATION, "campaigns_declaration_locale"),
    );
    expect(await attempt(full("fr", 1))).toEqual(ACCEPTED_ONE);
    expect(
      await attempt(
        draftUpdate(
          `authorizations_declared_at = now(), authorizations_declared_by_account_id = '${brandA}', ` +
            "authorizations_declaration_locale = 'en', authorizations_declaration_hash = '\\x00ff'::bytea",
        ),
      ),
    ).toEqual(refusedBy(CHECK_VIOLATION, "campaigns_declaration_hash_sha256"));
  });

  it("L3B-T2 refuses erased_at on a campaign that is not closed, keeps an erased one emptied", async () => {
    expect(await attempt(draftUpdate("erased_at = now()"))).toEqual(
      refusedBy(CHECK_VIOLATION, "campaigns_erased_is_closed"),
    );
    expect(
      await attempt(
        draftUpdate("status = 'closed', erased_at = now(), title = null"),
      ),
    ).toEqual(ACCEPTED_ONE);
  });
});

describe("L3B-T2 the required fields outside draft and rejected (modele §2, EC-L3B-02-6)", () => {
  it("L3B-T2 accepts a complete campaign in pending_review, and a gift-only one without a band", async () => {
    expect(await attempt(campaignInsert())).toEqual(ACCEPTED_ONE);
    expect(
      await attempt(
        campaignInsert({
          remuneration_kind: "'gift_only'",
          per_creator_budget_band_code: null,
          product_is_sent: "true",
          product_value_band_code: `'${PROBE_BAND}'`,
          creator_keeps_product: "true",
          shipping_costs_borne_by: "'brand'",
        }),
      ),
    ).toEqual(ACCEPTED_ONE);
  });

  it.each([
    [{ title: null }, "campaigns_required_when_submitted"],
    [{ ends_on: null }, "campaigns_required_when_submitted"],
    [{ title: "repeat('t', 9)" }, "campaigns_text_minimums_when_submitted"],
    [{ brief: "repeat('b', 299)" }, "campaigns_text_minimums_when_submitted"],
    [{ product_is_sent: "true" }, "campaigns_product_details_when_submitted"],
    [
      { usage_rights_code: "'organic_repost'" },
      "campaigns_usage_terms_when_submitted",
    ],
    [
      { per_creator_budget_band_code: null },
      "campaigns_budget_band_when_submitted",
    ],
    [
      { remuneration_kind: "'affiliate'", per_creator_budget_band_code: null },
      "campaigns_budget_band_when_submitted",
    ],
  ] as const)(
    "L3B-T2 refuses a submitted campaign with %o (%s)",
    async (overrides, constraint) => {
      expect(await attempt(campaignInsert(overrides))).toEqual(
        refusedBy(CHECK_VIOLATION, constraint),
      );
    },
  );

  it("L3B-T2 lets a rejected campaign hold an incomplete version (RG10), as a draft", async () => {
    expect(
      await attempt(
        campaignInsert({ status: "'rejected'", title: null, ends_on: null }),
      ),
    ).toEqual(ACCEPTED_ONE);
  });
});

// ---------------------------------------------------------------------------------------------
// L3B-T3: who reads and writes what
// ---------------------------------------------------------------------------------------------

describe("L3B-T3 the brand writes its own campaign through named columns (modele §4)", () => {
  it("L3B-T3 creates a draft of its own, reads it, writes its entry columns", async () => {
    const outcome = await scenario((tx) =>
      asBrand(tx, brandA, async () => {
        const [created] = await tx<{ id: string; status: string }[]>`
          insert into campaigns.campaigns (advertiser_account_id, title)
          values (${brandA}, 'My first campaign') returning id, status`;
        return {
          created: created?.status,
          update: await run(
            tx,
            `update campaigns.campaigns set title = 'Renamed', creators_wanted = 4 where id = '${created?.id ?? ""}'`,
          ),
          own: await run(tx, "select id from campaigns.campaigns"),
          lists: await run(
            tx,
            listInsert("campaign_topics", "slot, topic_code", "2, 'travel'"),
          ),
        };
      }),
    );
    expect(outcome).toEqual({
      created: "draft",
      update: ACCEPTED_ONE,
      own: { outcome: "rows", count: 2 },
      lists: ACCEPTED_ONE,
    });
  });

  it.each([
    ["status = 'pending_review'"],
    ["submitted_at = now()"],
    ["erased_at = now()"],
    ["authorizations_declared_at = now()"],
    ["authorizations_declaration_hash = null"],
    ["per_creator_amount_min_minor = null"],
    [`advertiser_account_id = '${brandB}'`],
  ])(
    "L3B-T3 refuses to the brand the column of `%s` (42501)",
    async (assignment) => {
      const outcome = await scenario((tx) =>
        asBrand(tx, brandA, () => run(tx, draftUpdate(assignment))),
      );
      expect(outcome).toEqual(refusedBy(INSUFFICIENT_PRIVILEGE));
    },
  );

  it("L3B-T3 never lets the brand create a campaign in another state, read the suspended range, nor delete a campaign", async () => {
    const outcome = await scenario((tx) =>
      asBrand(tx, brandA, async () => ({
        status: await run(
          tx,
          `insert into campaigns.campaigns (advertiser_account_id, status) values ('${brandA}', 'published')`,
        ),
        range: await run(
          tx,
          "select per_creator_amount_min_minor from campaigns.campaigns",
        ),
        delete: await run(
          tx,
          `delete from campaigns.campaigns where id = '${campaignA}'`,
        ),
        listUpdate: await run(
          tx,
          `update campaigns.campaign_topics set topic_code = 'travel' where campaign_id = '${campaignA}'`,
        ),
      })),
    );
    expect(outcome).toEqual({
      status: refusedBy(INSUFFICIENT_PRIVILEGE),
      range: refusedBy(INSUFFICIENT_PRIVILEGE),
      delete: refusedBy(INSUFFICIENT_PRIVILEGE),
      listUpdate: refusedBy(INSUFFICIENT_PRIVILEGE),
    });
  });

  it("L3B-T3 replaces a list in one transaction (delete then insert)", async () => {
    const outcome = await scenario((tx) =>
      asBrand(tx, brandA, async () => ({
        removed: await run(
          tx,
          `delete from campaigns.campaign_topics where campaign_id = '${campaignA}'`,
        ),
        first: await run(
          tx,
          listInsert("campaign_topics", "slot, topic_code", "1, 'travel'"),
        ),
        second: await run(
          tx,
          listInsert("campaign_topics", "slot, topic_code", "2, 'beauty'"),
        ),
      })),
    );
    expect(outcome).toEqual({
      removed: ACCEPTED_ONE,
      first: ACCEPTED_ONE,
      second: ACCEPTED_ONE,
    });
  });
});

describe("L3B-T3 another brand sees and touches nothing (fiche invariant 4)", () => {
  it("L3B-T3 brand A neither reads, updates nor creates for brand B", async () => {
    const outcome = await scenario((tx) =>
      asBrand(tx, brandA, async () => ({
        read: await run(
          tx,
          `select id from campaigns.campaigns where id = '${campaignB}'`,
        ),
        update: await run(
          tx,
          `update campaigns.campaigns set title = 'Taken' where id = '${campaignB}'`,
        ),
        create: await run(
          tx,
          `insert into campaigns.campaigns (advertiser_account_id) values ('${brandB}')`,
        ),
      })),
    );
    expect(outcome).toEqual({
      read: { outcome: "rows", count: 0 },
      update: { outcome: "rows", count: 0 },
      create: refusedBy(INSUFFICIENT_PRIVILEGE),
    });
  });

  it("L3B-T3 brand A neither reads, adds to nor removes from a list of brand B", async () => {
    const outcome = await scenario((tx) =>
      asBrand(tx, brandA, async () => ({
        read: await run(
          tx,
          `select campaign_id from campaigns.campaign_topics where campaign_id = '${campaignB}'`,
        ),
        insert: await run(
          tx,
          `insert into campaigns.campaign_topics (campaign_id, slot, topic_code) values ('${campaignB}', 3, 'travel')`,
        ),
        delete: await run(
          tx,
          `delete from campaigns.campaign_deliverables where campaign_id = '${campaignB}'`,
        ),
      })),
    );
    expect(outcome).toEqual({
      read: { outcome: "rows", count: 0 },
      insert: refusedBy(INSUFFICIENT_PRIVILEGE),
      delete: { outcome: "rows", count: 0 },
    });
  });
});

describe("L3B-T3 the freeze outside draft and rejected (modele §4, 55000 campaign_not_editable)", () => {
  /** The campaign of brand A moved by the superuser (no guard for him) before the brand acts. */
  async function frozenAs(state: string): Promise<Record<string, Outcome>> {
    return scenario(async (tx) => {
      await tx.unsafe(WITH_PROBE_BAND);
      const [frozen] = await tx.unsafe<{ id: string }[]>(
        state === "erased"
          ? `${campaignInsert({ status: "'closed'", erased_at: "now()" })} returning id`
          : `${campaignInsert({ status: `'${state}'` })} returning id`,
      );
      const id = frozen?.id ?? "";
      return asBrand(tx, brandA, async () => ({
        update: await run(
          tx,
          `update campaigns.campaigns set title = 'Changed later' where id = '${id}'`,
        ),
        add: await run(
          tx,
          `insert into campaigns.campaign_topics (campaign_id, slot, topic_code) values ('${id}', 1, 'travel')`,
        ),
        remove: await run(
          tx,
          `delete from campaigns.campaign_topics where campaign_id = '${id}'`,
        ),
      }));
    });
  }

  it.each([["pending_review"], ["erased"]])(
    "L3B-T3 refuses every brand write on a campaign %s",
    async (state) => {
      const frozen = refusedBy(NOT_EDITABLE);
      expect(await frozenAs(state)).toEqual({
        update: frozen,
        add: frozen,
        // no row to delete: the guard fires per row, the delete finds none
        remove: { outcome: "rows", count: 0 },
      });
    },
  );

  it("L3B-T3 refuses the removal of a list row of a frozen campaign, names the refusal in DETAIL", async () => {
    const outcome = await scenario(async (tx) => {
      await tx.unsafe(WITH_PROBE_BAND);
      await tx.unsafe(
        `insert into campaigns.campaign_audience_bands (campaign_id, audience_band_code) values ('${campaignA}', 'nano')`,
      );
      await tx.unsafe(draftUpdate("status = 'closed', erased_at = now()"));
      return asBrand(tx, brandA, async () => {
        try {
          await tx.savepoint((savepoint) =>
            savepoint.unsafe(
              `delete from campaigns.campaign_audience_bands where campaign_id = '${campaignA}'`,
            ),
          );
          return "deleted";
        } catch (error) {
          const found = error as { code?: string; detail?: string };
          return `${found.code ?? ""} ${found.detail ?? ""}`;
        }
      });
    });
    expect(outcome).toBe(`${NOT_EDITABLE} campaign_not_editable`);
  });

  it("L3B-T3 lets the brand correct a rejected campaign (RG10)", async () => {
    const outcome = await scenario(async (tx) => {
      await tx.unsafe(draftUpdate("status = 'rejected'"));
      return asBrand(tx, brandA, () =>
        run(tx, draftUpdate("title = 'Corrected after refusal'")),
      );
    });
    expect(outcome).toEqual(ACCEPTED_ONE);
  });
});

describe("L3B-T3 the creator and INFLUX hold nothing on campaigns.* at L3B (D78, TM5.6)", () => {
  it("L3B-T3 refuses the creator every table of the schema, and grants him no USAGE", async () => {
    const outcome = await scenario((tx) =>
      actAsMember(
        tx,
        "influx_creator",
        {
          accountId: accountIdOf("creator", "a"),
          role: "creator",
          aal: "aal1",
        },
        async () => ({
          campaign: await run(tx, "select id from campaigns.campaigns"),
          list: await run(
            tx,
            "select campaign_id from campaigns.campaign_topics",
          ),
          items: await run(tx, "select code from campaigns.requested_items"),
          types: await run(tx, "select code from reference.campaign_types"),
        }),
      ),
    );
    expect(outcome).toEqual({
      campaign: refusedBy(INSUFFICIENT_PRIVILEGE),
      list: refusedBy(INSUFFICIENT_PRIVILEGE),
      items: refusedBy(INSUFFICIENT_PRIVILEGE),
      // a reference list, read like every other (0201)
      types: { outcome: "rows", count: 7 },
    });
  });

  it("L3B-T3 refuses an agent the campaigns and the reasons of queue 7 before L3C (EC-L3B-02-1)", async () => {
    const outcome = await scenario((tx) =>
      actAsInternal(
        tx,
        "influx_agent",
        { accountId: accountIdOf("agent", "a"), role: "agent", aal: "aal2" },
        async () => ({
          campaign: await run(tx, "select id from campaigns.campaigns"),
          reasons: await run(
            tx,
            "select code from campaigns.rejection_reasons",
          ),
        }),
      ),
    );
    expect(outcome).toEqual({
      campaign: refusedBy(INSUFFICIENT_PRIVILEGE),
      reasons: refusedBy(INSUFFICIENT_PRIVILEGE),
    });
  });

  it("L3B-T3 grants USAGE on the schema campaigns to the brand alone, to the owner of its submission door (0305) and to the owner of the export and the erasure (0306)", async () => {
    const rows = await scenario(
      (tx) =>
        tx<{ rolname: string }[]>`
        select rolname from pg_catalog.pg_roles
         where rolname like 'influx\\_%' and has_schema_privilege(oid, 'campaigns', 'USAGE')
         order by rolname`,
    );
    expect(rows.map((row) => row.rolname)).toEqual([
      "influx_advertiser",
      "influx_campaign_definer",
      "influx_privacy_definer",
    ]);
  });

  it("L3B-T3 the brand reads the five requested items, proposed_rate inactive (D78)", async () => {
    const rows = await scenario((tx) =>
      asBrand(
        tx,
        brandA,
        () =>
          tx<{ code: string; is_active: boolean }[]>`
          select code, is_active from campaigns.requested_items order by position`,
      ),
    );
    expect(rows).toEqual([
      { code: "motivation_message", is_active: true },
      { code: "past_content_examples", is_active: true },
      { code: "concept_proposal", is_active: true },
      { code: "proposed_rate", is_active: false },
      { code: "availability", is_active: true },
    ]);
  });
});

describe("L3B-T3 the codes of Lot 3 and the closed lists (04 §4.3, modele §3)", () => {
  it("L3B-T3 loads the nine codes of 04 §4.3, each with its export_class (F3)", async () => {
    const rows = await scenario(
      (tx) =>
        tx<
          {
            code: string;
            domain: string;
            subject_type: string;
            severity: string;
            export_class: string;
          }[]
        >`
        select code, domain, subject_type, severity, export_class from audit.event_types
         where domain in ('campaigns', 'matching', 'search') order by code`,
    );
    expect(rows).toEqual([
      {
        code: "block.created",
        domain: "matching",
        subject_type: "party_block",
        severity: "sensitive",
        export_class: "excluded_third_party",
      },
      {
        code: "block.lifted",
        domain: "matching",
        subject_type: "party_block",
        severity: "sensitive",
        export_class: "excluded_third_party",
      },
      {
        code: "campaign.closed",
        domain: "campaigns",
        subject_type: "campaign",
        severity: "info",
        export_class: "exported",
      },
      {
        code: "campaign.paused",
        domain: "campaigns",
        subject_type: "campaign",
        severity: "info",
        export_class: "exported",
      },
      {
        code: "campaign.published",
        domain: "campaigns",
        subject_type: "campaign",
        severity: "sensitive",
        export_class: "exported",
      },
      {
        code: "campaign.rejected",
        domain: "campaigns",
        subject_type: "campaign",
        severity: "sensitive",
        export_class: "exported",
      },
      {
        code: "campaign.submitted",
        domain: "campaigns",
        subject_type: "campaign",
        severity: "info",
        export_class: "exported",
      },
      {
        code: "campaign.updated",
        domain: "campaigns",
        subject_type: "campaign",
        severity: "info",
        export_class: "exported",
      },
      {
        code: "search.settings_changed",
        domain: "search",
        subject_type: "search_setting",
        severity: "sensitive",
        export_class: "exported",
      },
    ]);
  });

  it("L3B-T3 holds the seven campaign types (no `other`) and the fourteen reasons of RG90", async () => {
    const outcome = await scenario(async (tx) => ({
      types: (
        await tx<{ code: string }[]>`
        select code from reference.campaign_types order by sort_order`
      ).map((row) => row.code),
      reasons: await tx<
        { next_step: string; count: number; with_message: number }[]
      >`
        select next_step, count(*)::int as count,
               count(*) filter (where requires_member_message)::int as with_message
          from campaigns.rejection_reasons group by next_step order by next_step`,
    }));
    expect(outcome).toEqual({
      types: [
        "product_placement",
        "ugc_delivered",
        "product_review",
        "ambassador",
        "contest",
        "event_presence",
        "affiliate_program",
      ],
      reasons: [
        { next_step: "contact", count: 3, with_message: 2 },
        { next_step: "fix", count: 11, with_message: 0 },
      ],
    });
  });
});

describe("L3B-T3 TM11: the Drizzle declaration of campaigns.ts has the columns of the base", () => {
  it("L3B-T3 declares every table of the schema campaigns with exactly its columns", async () => {
    const catalogue = await scenario(
      (tx) =>
        tx<{ name: string; columns: string[] }[]>`
        select c.relname as name, array_agg(a.attname::text order by a.attname) as columns
          from pg_catalog.pg_class c
          join pg_catalog.pg_namespace n on n.oid = c.relnamespace
          join pg_catalog.pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
         where n.nspname = 'campaigns' and c.relkind in ('r', 'p')
         group by c.relname order by c.relname`,
    );
    const declared = Object.fromEntries(
      Object.entries(campaignsColumns()).map(([table, columns]) => [
        table,
        [...columns].sort(),
      ]),
    );
    expect(declared).toEqual(
      Object.fromEntries(
        catalogue.map((row) => [row.name, [...row.columns].sort()]),
      ),
    );
    // twelve tables of 0303, plus authorization_declaration_texts (0305)
    expect(Object.keys(declared)).toHaveLength(13);
  });
});

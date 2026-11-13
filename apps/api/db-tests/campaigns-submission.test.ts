// L3B commit 05 — the submission of a campaign and its creator view, guarded by the database (0305;
// docs/mvp/09 RG4, RG5, RG84, RG85, CA2, CA3, CA56, CA68, CA76; jalons/l3b/modele.md §5 and §6;
// fiche invariants 1, 3 to 7, 9, 11).
//   L3B-T6  the only member transition: draft or rejected -> pending_review, the brand profile
//           published, every missing field named, the declaration of RG85 for a sensitive sector
//           (hash of the exact text, locale, author, instant), campaign.submitted in the
//           transaction, the second submission without a write; the refusals (T14: another brand
//           and an unknown campaign alike); the owner of the door, its rights, L2DS-5 extended; the
//           creator view, an allow-list without currency, band, budget, reference nor declaration.
// The parity of the required fields is campaign-parity.test.ts. Each case runs in a rolled-back
// transaction of the local superuser, which acts as apps/api does (support.ts: actAsMember).
import { createHash } from "node:crypto";
import {
  accountIdOf,
  CAMPAIGN_IDS,
  inRolledBackTransaction,
} from "@influx/test-kit/db";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAsInternal,
  actAsMember,
  localSuperuser,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;

const CHECK_VIOLATION = "23514";
const NOT_IN_PREREQUISITE_STATE = "55000";
const INSUFFICIENT_PRIVILEGE = "42501";

const brandA = accountIdOf("advertiser", "a");
const brandB = accountIdOf("advertiser", "b");
const campaignA = CAMPAIGN_IDS.a;
const campaignB = CAMPAIGN_IDS.b;
const UNKNOWN_CAMPAIGN = "00000000-0000-4000-8000-0000000fffff";

/** The exact texts of RG85 (09 RG85 for FR, 0305 for EN). */
const DECLARATION_FR =
  "Je déclare détenir les autorisations nécessaires pour promouvoir ce produit dans les pays " +
  "visés et respecter les règles de publicité qui s'y appliquent.";
const DECLARATION_EN =
  "I declare that I hold the authorisations required to promote this product in the countries " +
  "targeted and that I comply with the advertising rules that apply there.";

const sha256Hex = (text: string) =>
  createHash("sha256").update(text, "utf8").digest("hex");

beforeAll(async () => {
  await testDataSet();
});

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

function asBrand<T>(tx: Tx, account: string, fn: () => Promise<T>): Promise<T> {
  return actAsMember(
    tx,
    "influx_advertiser",
    { accountId: account, role: "advertiser", aal: "aal1" },
    fn,
  );
}

/** Brand A's profile published (CA2), as the superuser. */
async function publishProfileOf(tx: Tx, account: string): Promise<void> {
  await tx`
    update profiles.advertiser_profiles set status = 'published' where account_id = ${account}`;
}

/**
 * Completes the draft of brand A as the superuser: the data set already holds one row in each list
 * (a key message, a deliverable, a territory FR, an audience country, language and topic); the
 * columns are filled here, in EUR with a band of 0304; the campaign stays draft.
 */
async function completeCampaignA(
  tx: Tx,
  overrides: Readonly<Record<string, string | number | boolean | null>> = {},
): Promise<void> {
  const columns = {
    title: "Summer outdoor kit",
    campaign_type_code: "product_placement",
    public_summary: "s".repeat(120),
    brief: "b".repeat(300),
    internal_reference: "REF-2027-01",
    product_description: "A light tent for two",
    sector_code: "sports_leisure",
    product_is_sent: false,
    usage_rights_code: "organic_repost",
    usage_rights_duration_band: "3m",
    usage_rights_territory_scope: "selected_countries",
    exclusivity_band: "none",
    content_review_delay: "5bd",
    currency: "EUR",
    remuneration_kind: "cash",
    per_creator_budget_band_code: "500_1000",
    creators_wanted: 3,
    total_budget_minor: 3000000,
    applications_close_on: "2027-01-10",
    content_due_on: "2027-01-25",
    starts_on: "2027-02-01",
    ends_on: "2027-03-01",
    ...overrides,
  };
  await tx`update campaigns.campaigns set ${tx(columns)} where id = ${campaignA}`;
}

/** Brand A ready: its profile published, its campaign complete (draft). */
async function readyA(
  tx: Tx,
  overrides: Readonly<Record<string, string | number | boolean | null>> = {},
): Promise<void> {
  await publishProfileOf(tx, brandA);
  await completeCampaignA(tx, overrides);
}

type Submission =
  | { outcome: "submitted"; status: string; changed: boolean; at: Date }
  | {
      outcome: "error";
      code: string;
      message: string;
      detail: string | undefined;
    };

/** campaigns.submit_own_campaign() in a savepoint: its row, or its SQLSTATE, MESSAGE and DETAIL. */
async function submit(
  tx: Tx,
  campaign: string,
  locale: string | null = null,
): Promise<Submission> {
  try {
    const [row] = await tx.savepoint(
      (savepoint) =>
        savepoint<{ status: string; submitted_at: Date; changed: boolean }[]>`
          select status, submitted_at, changed
            from campaigns.submit_own_campaign(${campaign}::uuid, ${locale}::text)`,
    );
    if (row === undefined) throw new Error("the submission returned no row");
    return {
      outcome: "submitted",
      status: row.status,
      changed: row.changed,
      at: row.submitted_at,
    };
  } catch (error) {
    const found = error as { code?: string; message?: string; detail?: string };
    if (found.code === undefined) throw error;
    return {
      outcome: "error",
      code: found.code,
      message: found.message ?? "",
      detail: found.detail,
    };
  }
}

function brandSubmits(
  tx: Tx,
  campaign: string = campaignA,
  locale: string | null = null,
): Promise<Submission> {
  return asBrand(tx, brandA, () => submit(tx, campaign, locale));
}

function refused(code: string, message: string, detail?: string): unknown {
  return detail === undefined
    ? expect.objectContaining({ outcome: "error", code, message })
    : { outcome: "error", code, message, detail };
}

type CampaignState = {
  status: string;
  submitted: boolean;
  declared_at: Date | null;
  declared_by: string | null;
  locale: string | null;
  hash: string | null;
};

async function stateOfA(tx: Tx): Promise<CampaignState> {
  const [row] = await tx<CampaignState[]>`
    select status::text as status, submitted_at is not null as submitted,
           authorizations_declared_at as declared_at,
           authorizations_declared_by_account_id::text as declared_by,
           authorizations_declaration_locale::text as locale,
           encode(authorizations_declaration_hash, 'hex') as hash
      from campaigns.campaigns where id = ${campaignA}`;
  if (row === undefined) throw new Error("no campaign A");
  return row;
}

type RegisterLine = {
  actor_account_id: string | null;
  subject_type: string;
  payload: Record<string, unknown>;
};

async function submittedLines(
  tx: Tx,
  campaign: string,
): Promise<RegisterLine[]> {
  return tx<RegisterLine[]>`
    select actor_account_id::text as actor_account_id, subject_type, payload
      from audit.audit_events
     where event_type = 'campaign.submitted' and subject_id = ${campaign}
     order by seq`;
}

const UNCHANGED_DRAFT: CampaignState = {
  status: "draft",
  submitted: false,
  declared_at: null,
  declared_by: null,
  locale: null,
  hash: null,
};

// ---------------------------------------------------------------------------------------------
// L3B-T6: the submission
// ---------------------------------------------------------------------------------------------

describe("L3B-T6 the brand submits its complete campaign (09 RG4, RG5; modele §5)", () => {
  it("L3B-T6 moves a complete draft to pending_review, the instant and campaign.submitted in the same transaction", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      const submission = await brandSubmits(tx);
      return {
        submission,
        state: await stateOfA(tx),
        lines: await submittedLines(tx, campaignA),
      };
    });
    expect(outcome.submission).toEqual({
      outcome: "submitted",
      status: "pending_review",
      changed: true,
      at: expect.any(Date),
    });
    expect(outcome.state).toEqual({
      ...UNCHANGED_DRAFT,
      status: "pending_review",
      submitted: true,
    });
    expect(outcome.lines).toEqual([
      {
        actor_account_id: brandA,
        subject_type: "campaign",
        payload: { from_status: "draft" },
      },
    ]);
  });

  it("L3B-T6 writes nothing when asked again while pending_review (the instant of the first, one line)", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      const first = await brandSubmits(tx);
      const second = await brandSubmits(tx);
      return { first, second, lines: await submittedLines(tx, campaignA) };
    });
    expect(outcome.second).toEqual({
      outcome: "submitted",
      status: "pending_review",
      changed: false,
      at: outcome.first.outcome === "submitted" ? outcome.first.at : null,
    });
    expect(outcome.lines).toHaveLength(1);
  });

  it("L3B-T6 submits a rejected campaign again (RG10), from_status rejected", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      await tx`update campaigns.campaigns set status = 'rejected' where id = ${campaignA}`;
      return {
        submission: await brandSubmits(tx),
        lines: await submittedLines(tx, campaignA),
      };
    });
    expect(outcome.submission).toEqual(
      expect.objectContaining({ status: "pending_review", changed: true }),
    );
    expect(outcome.lines.map((line) => line.payload)).toEqual([
      { from_status: "rejected" },
    ]);
  });

  it.each(["published", "paused", "closed"])(
    "L3B-T6 refuses a %s campaign (55000 campaign_not_submittable, RG5), nothing written",
    async (status) => {
      const outcome = await scenario(async (tx) => {
        await readyA(tx);
        await tx`
          update campaigns.campaigns set status = ${status}::campaigns.campaign_status
           where id = ${campaignA}`;
        return {
          submission: await brandSubmits(tx),
          status: (await stateOfA(tx)).status,
          lines: await submittedLines(tx, campaignA),
        };
      });
      expect(outcome).toEqual({
        submission: refused(
          NOT_IN_PREREQUISITE_STATE,
          "campaign_not_submittable",
          status,
        ),
        status,
        lines: [],
      });
    },
  );

  it.each(["draft", "pending_review", "rejected", "suspended"])(
    "L3B-T6 refuses while the brand profile is %s (55000 profile_not_published, CA2)",
    async (profileStatus) => {
      const outcome = await scenario(async (tx) => {
        await completeCampaignA(tx);
        await tx`
          update profiles.advertiser_profiles
             set status = ${profileStatus}::profiles.advertiser_profile_status
           where account_id = ${brandA}`;
        return {
          submission: await brandSubmits(tx),
          state: await stateOfA(tx),
        };
      });
      expect(outcome).toEqual({
        submission: refused(
          NOT_IN_PREREQUISITE_STATE,
          "profile_not_published",
          "profile_not_published",
        ),
        state: UNCHANGED_DRAFT,
      });
    },
  );
});

describe("L3B-T6 every missing field is named, in the order of the form (CA3, CA76; fiche invariants 5, 6)", () => {
  it("L3B-T6 names the usage rights and the publication period together (CA3), the draft unchanged", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx, {
        usage_rights_code: null,
        usage_rights_duration_band: null,
        usage_rights_territory_scope: null,
        starts_on: null,
        ends_on: null,
      });
      return {
        submission: await brandSubmits(tx),
        state: await stateOfA(tx),
        lines: await submittedLines(tx, campaignA),
      };
    });
    expect(outcome).toEqual({
      submission: refused(
        CHECK_VIOLATION,
        "required_fields_missing",
        "usage_rights,starts_on,ends_on",
      ),
      state: UNCHANGED_DRAFT,
      lines: [],
    });
  });

  it("L3B-T6 names every code of a fresh draft, the lists of the data set emptied", async () => {
    const submission = await scenario(async (tx) => {
      await publishProfileOf(tx, brandA);
      for (const table of [
        "campaign_key_messages",
        "campaign_deliverables",
        "campaign_usage_territories",
        "campaign_audience_countries",
        "campaign_audience_languages",
        "campaign_topics",
      ]) {
        await tx.unsafe(
          `delete from campaigns.${table} where campaign_id = '${campaignA}'`,
        );
      }
      await tx`update campaigns.campaigns set title = null where id = ${campaignA}`;
      return brandSubmits(tx);
    });
    expect(submission).toEqual(
      refused(
        CHECK_VIOLATION,
        "required_fields_missing",
        [
          "title",
          "campaign_type",
          "public_summary",
          "brief",
          "product_description",
          "product_sector",
          "product_is_sent",
          "deliverables",
          "usage_rights",
          "exclusivity",
          "content_review_delay",
          "audience_countries",
          "audience_languages",
          "audience_topics",
          "currency",
          "remuneration_kind",
          "creators_wanted",
          "applications_close_on",
          "starts_on",
          "ends_on",
        ].join(","),
      ),
    );
  });

  it("L3B-T6 refuses cash without a band (CA76) and accepts gift only without one", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx, { per_creator_budget_band_code: null });
      const cash = await brandSubmits(tx);
      await tx`
        update campaigns.campaigns
           set remuneration_kind = 'gift_only', product_is_sent = true,
               product_value_band_code = '100_250', creator_keeps_product = true,
               shipping_costs_borne_by = 'brand'
         where id = ${campaignA}`;
      const gift = await brandSubmits(tx);
      return { cash, gift };
    });
    expect(outcome).toEqual({
      cash: refused(CHECK_VIOLATION, "required_fields_missing", "budget_band"),
      gift: expect.objectContaining({
        status: "pending_review",
        changed: true,
      }),
    });
  });

  it("L3B-T6 refuses a territory incoherent with its scope (worldwide with a country)", async () => {
    const submission = await scenario(async (tx) => {
      await readyA(tx, { usage_rights_territory_scope: "worldwide" });
      return brandSubmits(tx);
    });
    expect(submission).toEqual(
      refused(
        CHECK_VIOLATION,
        "required_fields_missing",
        "usage_rights_territory",
      ),
    );
  });

  it("L3B-T6 refuses a key message under 10 characters (EC-L3B-04-4: optional, sound when there)", async () => {
    const submission = await scenario(async (tx) => {
      await readyA(tx);
      await tx`
        update campaigns.campaign_key_messages set body = 'Too short'
         where campaign_id = ${campaignA}`;
      return brandSubmits(tx);
    });
    expect(submission).toEqual(
      refused(CHECK_VIOLATION, "required_fields_missing", "key_messages"),
    );
  });
});

describe("L3B-T6 the declaration of RG85 for a sensitive sector (RG84, RG85, CA56; fiche invariant 7)", () => {
  it.each([
    ["no locale", null],
    ["an unknown locale", "de"],
  ])(
    "L3B-T6 refuses an alcohol campaign with %s (23514 authorizations_declaration), nothing written",
    async (_label, locale) => {
      const outcome = await scenario(async (tx) => {
        await readyA(tx, { sector_code: "alcohol" });
        return {
          submission: await brandSubmits(tx, campaignA, locale),
          state: await stateOfA(tx),
        };
      });
      expect(outcome).toEqual({
        submission: refused(
          CHECK_VIOLATION,
          "authorizations_declaration",
          "authorizations_declaration",
        ),
        state: UNCHANGED_DRAFT,
      });
    },
  );

  it.each([
    ["fr", DECLARATION_FR],
    ["en", DECLARATION_EN],
  ])(
    "L3B-T6 keeps the hash of the exact %s text, its author and its instant, and names them in the register",
    async (locale, text) => {
      const outcome = await scenario(async (tx) => {
        await readyA(tx, { sector_code: "alcohol" });
        return {
          submission: await brandSubmits(tx, campaignA, locale),
          state: await stateOfA(tx),
          lines: await submittedLines(tx, campaignA),
        };
      });
      expect(outcome.submission).toEqual(
        expect.objectContaining({ status: "pending_review", changed: true }),
      );
      expect(outcome.state).toEqual({
        status: "pending_review",
        submitted: true,
        declared_at: expect.any(Date),
        declared_by: brandA,
        locale,
        hash: sha256Hex(text),
      });
      expect(outcome.lines.map((line) => line.payload)).toEqual([
        {
          from_status: "draft",
          declaration_locale: locale,
          declaration_hash: sha256Hex(text),
        },
      ]);
    },
  );

  it("L3B-T6 empties a former declaration when the sector is no longer sensitive (-11), a locale given or not", async () => {
    const state = await scenario(async (tx) => {
      await readyA(tx, { sector_code: "alcohol" });
      await brandSubmits(tx, campaignA, "fr");
      await tx`
        update campaigns.campaigns set status = 'rejected', sector_code = 'sports_leisure'
         where id = ${campaignA}`;
      await brandSubmits(tx, campaignA, "fr");
      return stateOfA(tx);
    });
    expect(state).toEqual({
      ...UNCHANGED_DRAFT,
      status: "pending_review",
      submitted: true,
    });
  });

  it("L3B-T6 serves the brand the two texts of the box, each with the SHA-256 of its UTF-8 bytes", async () => {
    const rows = await scenario((tx) =>
      asBrand(
        tx,
        brandA,
        () =>
          tx<{ locale: string; body: string; hash: string }[]>`
          select locale, body, encode(body_sha256, 'hex') as hash
            from campaigns.authorization_declaration_texts order by locale`,
      ),
    );
    expect(rows).toEqual([
      { locale: "en", body: DECLARATION_EN, hash: sha256Hex(DECLARATION_EN) },
      { locale: "fr", body: DECLARATION_FR, hash: sha256Hex(DECLARATION_FR) },
    ]);
  });

  it("L3B-T6 refuses a text whose hash is not that of its bytes (EC-L3B-05-1)", async () => {
    const code = await scenario(async (tx) => {
      try {
        await tx.savepoint(
          (savepoint) =>
            savepoint`update campaigns.authorization_declaration_texts
                         set body = body || ' ' where locale = 'en'`,
        );
        return "accepted";
      } catch (error) {
        return (error as { code?: string }).code;
      }
    });
    expect(code).toBe(CHECK_VIOLATION);
  });
});

describe("L3B-T6 who may submit (T14, RG5; fiche invariants 3, 4)", () => {
  it("L3B-T6 answers another brand's campaign and an unknown one alike (42501 forbidden), nothing written", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      await publishProfileOf(tx, brandB);
      const other = await asBrand(tx, brandB, () => submit(tx, campaignA));
      const unknown = await asBrand(tx, brandB, () =>
        submit(tx, UNKNOWN_CAMPAIGN),
      );
      return { other, unknown, state: await stateOfA(tx) };
    });
    expect(outcome).toEqual({
      other: refused(INSUFFICIENT_PRIVILEGE, "forbidden"),
      unknown: refused(INSUFFICIENT_PRIVILEGE, "forbidden"),
      state: UNCHANGED_DRAFT,
    });
    expect(outcome.other).toEqual(outcome.unknown);
  });

  it("L3B-T6 refuses a suspended advertiser account (42501 forbidden)", async () => {
    const submission = await scenario(async (tx) => {
      await readyA(tx);
      await tx`
        update identity.accounts set status = 'suspended', suspended_at = now()
         where id = ${brandA}`;
      return brandSubmits(tx);
    });
    expect(submission).toEqual(refused(INSUFFICIENT_PRIVILEGE, "forbidden"));
  });

  it("L3B-T6 refuses the creator and the agent the door (42501)", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      const creator = await actAsMember(
        tx,
        "influx_creator",
        {
          accountId: accountIdOf("creator", "a"),
          role: "creator",
          aal: "aal1",
        },
        () => submit(tx, campaignA),
      );
      const agent = await actAsInternal(
        tx,
        "influx_agent",
        { accountId: accountIdOf("agent", "a"), role: "agent", aal: "aal2" },
        () => submit(tx, campaignA),
      );
      return { creator, agent, state: await stateOfA(tx) };
    });
    expect(outcome).toEqual({
      creator: expect.objectContaining({
        outcome: "error",
        code: INSUFFICIENT_PRIVILEGE,
      }),
      agent: expect.objectContaining({
        outcome: "error",
        code: INSUFFICIENT_PRIVILEGE,
      }),
      state: UNCHANGED_DRAFT,
    });
  });

  it("L3B-T6 freezes the submitted campaign for its brand (55000 campaign_not_editable)", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      await brandSubmits(tx);
      return asBrand(tx, brandA, async () => {
        try {
          await tx.savepoint(
            (savepoint) =>
              savepoint`update campaigns.campaigns set title = 'A new title here'
                         where id = ${campaignA}`,
          );
          return "accepted";
        } catch (error) {
          const found = error as { code?: string; message?: string };
          return `${found.code} ${found.message}`;
        }
      });
    });
    expect(outcome).toBe(`${NOT_IN_PREREQUISITE_STATE} campaign_not_editable`);
  });

  it("L3B-T6 the owner of the door can write no state but pending_review (EC-L3B-05-6)", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      await tx`
        select pg_catalog.set_config('influx.account', ${brandA}, true),
               pg_catalog.set_config('influx.role', 'advertiser', true),
               pg_catalog.set_config('influx.aal', 'aal1', true)`;
      await tx.unsafe("set local role influx_campaign_definer");
      const attempt = async (status: string) => {
        try {
          const result = await tx.savepoint(
            (savepoint) =>
              savepoint`update campaigns.campaigns
                           set status = ${status}::campaigns.campaign_status
                         where id = ${campaignA}`,
          );
          return `rows ${result.count}`;
        } catch (error) {
          return (error as { code?: string }).code;
        }
      };
      const published = await attempt("published");
      const rejected = await attempt("rejected");
      // the witness: the one state it writes goes through
      const pending = await attempt("pending_review");
      await tx.unsafe("reset role");
      return { published, rejected, pending };
    });
    expect(outcome).toEqual({
      published: INSUFFICIENT_PRIVILEGE,
      rejected: INSUFFICIENT_PRIVILEGE,
      pending: "rows 1",
    });
  });
});

describe("L3B-T6 the owner of the door and its functions (03 P7; fiche invariant 11)", () => {
  it("L3B-T6 influx_campaign_definer is NOLOGIN NOINHERIT, without member nor membership", async () => {
    const outcome = await scenario(async (tx) => ({
      role: await tx<{ login: boolean; inherit: boolean; bypass: boolean }[]>`
        select rolcanlogin as login, rolinherit as inherit, rolbypassrls as bypass
          from pg_catalog.pg_roles where rolname = 'influx_campaign_definer'`,
      memberships: await tx<{ count: number }[]>`
        select count(*)::int as count from pg_catalog.pg_auth_members m
         where m.member = 'influx_campaign_definer'::regrole
            or (m.roleid = 'influx_campaign_definer'::regrole
                and (m.inherit_option or m.set_option))`,
    }));
    expect(outcome).toEqual({
      role: [{ login: false, inherit: false, bypass: false }],
      memberships: [{ count: 0 }],
    });
  });

  it("L3B-T6 the door is SECURITY DEFINER of its owner, the view SECURITY INVOKER, both EXECUTE to influx_advertiser only", async () => {
    const rows = await scenario(
      (tx) =>
        tx<
          {
            name: string;
            definer: boolean;
            owner: string;
            config: string[];
            grantees: string[];
          }[]
        >`
        select p.proname as name, p.prosecdef as definer,
               pg_catalog.pg_get_userbyid(p.proowner) as owner, p.proconfig as config,
               coalesce((select pg_catalog.array_agg(pg_catalog.pg_get_userbyid(a.grantee)::text
                                                      order by pg_catalog.pg_get_userbyid(a.grantee)::text)
                           from pg_catalog.aclexplode(p.proacl) a
                          where a.grantee <> p.proowner), '{}') as grantees
          from pg_catalog.pg_proc p
         where p.oid in ('campaigns.submit_own_campaign(uuid, text)'::regprocedure,
                         'campaigns.campaign_creator_view(uuid)'::regprocedure)
         order by p.proname`,
    );
    expect(rows).toEqual([
      {
        name: "campaign_creator_view",
        definer: false,
        owner: "postgres",
        config: ['search_path=""'],
        grantees: ["influx_advertiser"],
      },
      {
        name: "submit_own_campaign",
        definer: true,
        owner: "influx_campaign_definer",
        config: ['search_path=""'],
        grantees: ["influx_advertiser"],
      },
    ]);
  });

  /** The functions owned by the two member door owners whose body may run dynamic SQL (L2DS-5 extended). */
  async function dynamicSqlOwnedByDoorOwners(sql: Tx): Promise<string[]> {
    const rows = await sql<{ name: string }[]>`
      select p.oid::regprocedure::text as name
        from pg_catalog.pg_proc p
       where p.proowner in ('influx_campaign_definer'::regrole, 'influx_identity_definer'::regrole)
         and p.prosrc ~* ${"\\mexecute\\M|query_to_xml|cursor_to_xml|table_to_xml|schema_to_xml|database_to_xml|ts_stat|ts_rewrite|dblink"}
       order by 1`;
    return rows.map((row) => row.name);
  }

  it("L3B-T6 L2DS-5 extended (L3AS-3): no dynamic SQL in a function of the two door owners, red on a witness (rolled back)", async () => {
    const outcome = await scenario(async (tx) => {
      const clean = await dynamicSqlOwnedByDoorOwners(tx);
      await tx.unsafe(`
        create function campaigns.l3b_t6_witness(p_query text) returns xml
          language sql security definer set search_path = ''
        as $fn$ select pg_catalog.query_to_xml(p_query, true, false, '') $fn$`);
      await tx.unsafe(
        "alter function campaigns.l3b_t6_witness(text) owner to influx_campaign_definer",
      );
      return { clean, witnessed: await dynamicSqlOwnedByDoorOwners(tx) };
    });
    expect(outcome).toEqual({
      clean: [],
      witnessed: ["campaigns.l3b_t6_witness(text)"],
    });
  });
});

// ---------------------------------------------------------------------------------------------
// L3B-T6: the creator view (modele §6, CA68, RG98; D78)
// ---------------------------------------------------------------------------------------------

const CREATOR_VIEW_KEYS = [
  "title",
  "campaignType",
  "publicSummary",
  "brief",
  "productDescription",
  "productSector",
  "restrictions",
  "keyMessages",
  "productIsSent",
  "creatorKeepsProduct",
  "shippingCostsBorneBy",
  "deliverables",
  "networks",
  "usageRights",
  "usageRightsDuration",
  "usageRightsTerritoryScope",
  "usageRightsTerritories",
  "exclusivity",
  "contentReviewDelay",
  "audienceCountries",
  "audienceLanguages",
  "audienceTopics",
  "audienceBands",
  "audienceAgeBands",
  "audienceGender",
  "remunerationKind",
  "creatorsWanted",
  "applicationsCloseOn",
  "contentDueOn",
  "startsOn",
  "endsOn",
  "requestedItems",
].sort();

async function creatorViewOf(
  tx: Tx,
  account: string,
  campaign: string,
): Promise<{ view?: Record<string, unknown>; code?: string }> {
  return asBrand(tx, account, async () => {
    try {
      const [row] = await tx.savepoint(
        (savepoint) =>
          savepoint<{ view: Record<string, unknown> }[]>`
            select campaigns.campaign_creator_view(${campaign}::uuid) as view`,
      );
      return { view: row?.view };
    } catch (error) {
      return { code: (error as { code?: string }).code };
    }
  });
}

describe("L3B-T6 the creator view is an allow-list without currency, band, budget nor declaration (CA68, D78)", () => {
  it("L3B-T6 holds exactly the 32 keys of modele §6, even on an empty draft", async () => {
    const outcome = await scenario(async (tx) => {
      await tx`
        delete from campaigns.campaign_key_messages where campaign_id = ${campaignA}`;
      return creatorViewOf(tx, brandA, campaignA);
    });
    expect(Object.keys(outcome.view ?? {}).sort()).toEqual(CREATOR_VIEW_KEYS);
    expect(outcome.view?.keyMessages).toEqual([]);
    expect(outcome.view?.brief).toBeNull();
  });

  it("L3B-T6 serves the brief, the lists in their rank and the deduced networks, never the currency, the band, the budget, the reference, the declaration nor the state", async () => {
    const view = await scenario(async (tx) => {
      await readyA(tx, { sector_code: "alcohol", max_applications: 40 });
      await brandSubmits(tx, campaignA, "en");
      return (await creatorViewOf(tx, brandA, campaignA)).view ?? {};
    });
    expect(Object.keys(view).sort()).toEqual(CREATOR_VIEW_KEYS);
    expect(view).toEqual(
      expect.objectContaining({
        title: "Summer outdoor kit",
        productSector: "alcohol",
        deliverables: [
          {
            networkCode: "instagram",
            formatCode: "instagram_reel",
            quantity: 1,
          },
        ],
        networks: ["instagram"],
        usageRightsTerritories: ["FR"],
        remunerationKind: "cash",
        startsOn: "2027-02-01",
        contentDueOn: "2027-01-25",
      }),
    );
    const served = JSON.stringify(view);
    for (const hidden of [
      "EUR",
      "500_1000",
      "3000000",
      "REF-2027-01",
      "pending_review",
      campaignA,
      brandA,
      sha256Hex(DECLARATION_EN),
    ]) {
      expect(served, hidden).not.toContain(hidden);
    }
  });

  it("L3B-T6 answers another brand's campaign and an unknown one alike (42501), and is refused to the creator", async () => {
    const outcome = await scenario(async (tx) => ({
      other: await creatorViewOf(tx, brandA, campaignB),
      unknown: await creatorViewOf(tx, brandA, UNKNOWN_CAMPAIGN),
      creator: await actAsMember(
        tx,
        "influx_creator",
        {
          accountId: accountIdOf("creator", "a"),
          role: "creator",
          aal: "aal1",
        },
        async () => {
          try {
            await tx.savepoint(
              (savepoint) =>
                savepoint`select campaigns.campaign_creator_view(${campaignA}::uuid)`,
            );
            return "served";
          } catch (error) {
            return (error as { code?: string }).code;
          }
        },
      ),
    }));
    expect(outcome).toEqual({
      other: { code: INSUFFICIENT_PRIVILEGE },
      unknown: { code: INSUFFICIENT_PRIVILEGE },
      creator: INSUFFICIENT_PRIVILEGE,
    });
  });
});

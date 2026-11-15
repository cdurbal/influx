// L3C commit 05 — the worker's reads of the campaigns (0310; docs/mvp/09 RG93, RG94, RG103 to RG106,
// CA69, CA70; jalons/l3c/modele.md §8; fiche invariants 5, 8).
//   L3C-T5  leads.read_campaign_attributes(): the attributes of RG104 for a Brevo contact (a counter,
//           a date, codes; never a text, a band, a budget nor a note), « a publié » and its date only
//           for an Apollo contact (RG105); leads.read_brevo_campaign_decision(): the facts of each
//           decision e-mail (code, type, date, reason, message to the brand, field), never the
//           internal comment, a value nor an agent; both for influx_worker only, on a line it holds,
//           never for an erased account nor an act of another account.
// Each case runs in a rolled-back transaction of the local superuser, which writes the fixtures (outside
// the guards) and acts as the worker does (support.ts: actAs).
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAs,
  actAsInternal,
  actAsMember,
  localSuperuser,
  migrationRole,
  testDataSet,
} from "./support.ts";
import { campaignCalendar } from "./campaign-dates-kit.ts";
import { publishAsInflux } from "./campaign-publication-kit.ts";

type Tx = postgres.TransactionSql;
type Row = Record<string, unknown>;

const CALENDAR = campaignCalendar();

const INSUFFICIENT_PRIVILEGE = "42501";
const INVALID_PARAMETER = "22023";
const NOT_IN_PREREQUISITE_STATE = "55000";

const agentA = accountIdOf("agent", "a");
const agentB = accountIdOf("agent", "b");
const adminA = accountIdOf("admin", "a");

const COMMENT = "l3c-t5 internal comment marker";
const MESSAGE = "l3c-t5 message to the brand about its refusal";
/** A time zone far from UTC: the date of an act is the account's (EC-L2G-05-5 pattern). */
const ZONE = "Pacific/Kiritimati";

const READ_ATTRIBUTES =
  "select * from leads.read_campaign_attributes($1::bigint, $2)";
// the date as text: the driver would read a date as a JavaScript instant
const READ_DECISION =
  "select email_code, campaign_type_code, occurred_on::text as occurred_on, reason_code, " +
  "member_message, field_code, preferred_language " +
  "from leads.read_brevo_campaign_decision($1::bigint, $2)";

beforeAll(async () => {
  await testDataSet();
});

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

type Attempt =
  | { outcome: "rows"; rows: Row[] }
  | { outcome: "error"; code: string; message: string };

async function attempt(
  tx: Tx,
  statement: string,
  parameters: readonly postgres.ParameterOrJSON<never>[] = [],
): Promise<Attempt> {
  try {
    const rows = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters as postgres.ParameterOrJSON<never>[],
      ),
    );
    return { outcome: "rows", rows: [...rows] as Row[] };
  } catch (error) {
    const failure = error as { code?: string; message?: string };
    if (failure.code === undefined) throw error;
    return {
      outcome: "error",
      code: failure.code,
      message: failure.message ?? "",
    };
  }
}

function rowsOf(result: Attempt): Row[] {
  if (result.outcome === "error") {
    throw new Error(`${result.code} ${result.message}`);
  }
  return result.rows;
}

function codeOf(result: Attempt): string {
  return result.outcome === "error" ? result.code : "rows";
}

function asWorker(
  tx: Tx,
  statement: string,
  line: string,
  worker = "w1",
): Promise<Attempt> {
  return actAs(tx, "worker", () => attempt(tx, statement, [line, worker]));
}

// the fixtures ------------------------------------------------------------------------------------

/** An active member of its own, in ZONE; an advertiser has its brand profile. */
async function newAccount(
  tx: Tx,
  role: "advertiser" | "creator" = "advertiser",
): Promise<string> {
  const id = randomUUID();
  await tx`
    insert into identity.accounts
      (id, auth_user_id, email, email_verified_at, country_code, preferred_language, timezone,
       display_name, is_adult_attested, adult_attested_at, declared_status)
    values (${id}, ${randomUUID()}, ${`l3c-t5-${id}@example.test`}, now(), 'FR', 'fr', ${ZONE},
            'L3C T5 Person', true, now(),
            ${role === "advertiser" ? "business" : "individual"}::identity.declared_status)`;
  await tx`insert into identity.account_roles (account_id, role)
           values (${id}, ${role}::identity.account_role)`;
  if (role === "advertiser") {
    await tx`insert into profiles.advertiser_profiles (account_id, legal_name)
             values (${id}, 'L3C T5 Brand')`;
  }
  return id;
}

/** A complete campaign of the account, submitted, its texts, band and budget filled. */
async function submittedCampaign(
  tx: Tx,
  account: string,
  label: string,
  sector = "sports_leisure",
  currency = "EUR",
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into campaigns.campaigns
      (advertiser_account_id, status, title, campaign_type_code, public_summary, brief,
       internal_reference, product_description, sector_code, restrictions, product_is_sent,
       product_value_band_code, creator_keeps_product, shipping_costs_borne_by, usage_rights_code,
       usage_rights_duration_band, usage_rights_territory_scope, exclusivity_band,
       content_review_delay, audience_gender_code, currency, remuneration_kind,
       per_creator_budget_band_code, creators_wanted, total_budget_minor, applications_close_on,
       content_due_on, starts_on, ends_on, max_applications, authorizations_declared_at,
       authorizations_declared_by_account_id, authorizations_declaration_locale,
       authorizations_declaration_hash, submitted_at)
    values (${account}, 'pending_review', ${`${label} campaign title`}, 'product_placement',
            ${`${label} summary ${"s".repeat(120)}`}, ${`${label} brief ${"b".repeat(300)}`},
            ${`${label}-REF`}, ${`${label} product ${"p".repeat(20)}`}, ${sector}, ${`${label} restrictions`}, true,
            'under_100', true, 'brand', 'organic_repost', '3m', 'worldwide', 'none', '5bd',
            'mixed', ${currency}, 'cash_and_gift', '500_1000', 3, 3000000,
            ${CALENDAR.applicationsCloseOn}, ${CALENDAR.contentDueOn}, ${CALENDAR.startsOn},
            ${CALENDAR.endsOn}, 50, now(), ${account}, 'fr', sha256('l3c-t5'::bytea), now())
    returning id::text`;
  if (row === undefined) throw new Error("no campaign");
  await tx`
    insert into campaigns.campaign_key_messages (campaign_id, position, body)
    values (${row.id}, 1, ${`${label} key message`})`;
  await tx`
    insert into campaigns.campaign_deliverables
      (campaign_id, slot, network_code, format_code, quantity)
    values (${row.id}, 1, 'tiktok', 'tiktok_video', 1),
           (${row.id}, 2, 'instagram', 'instagram_reel', 2),
           (${row.id}, 3, 'tiktok', 'tiktok_live', 1)`;
  await tx`
    insert into campaigns.campaign_audience_countries (campaign_id, slot, country_code)
    values (${row.id}, 1, 'FR'), (${row.id}, 2, 'BE')`;
  return row.id;
}

/** A campaign published as INFLUX would (the kit), its first publication moved to `at`. */
async function publishedCampaign(
  tx: Tx,
  account: string,
  label: string,
  at: string,
  sector?: string,
  currency?: string,
): Promise<string> {
  const id = await submittedCampaign(tx, account, label, sector, currency);
  await publishAsInflux(tx, id);
  await tx`update campaigns.campaigns set first_published_at = ${at}::timestamptz
            where id = ${id}`;
  return id;
}

/** A queue line of the account, already in processing for the worker w1. */
async function line(
  tx: Tx,
  account: string,
  eventType: string,
  destination: string,
  payload: Row,
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into leads.outbox_events
      (event_id, event_type, destination, subject_key, payload, idempotency_key, status, locked_by,
       locked_at)
    values (gen_random_uuid(), ${eventType}, ${destination}::leads.outbox_destination,
            ${`account:${account}`}, ${JSON.stringify(payload)}::text::jsonb,
            ${`${eventType}:${randomUUID()}`}, 'processing', 'w1', now())
    returning id::text`;
  if (row === undefined) throw new Error("no line");
  return row.id;
}

function decisionLine(
  tx: Tx,
  account: string,
  campaign: string,
  emailCode: string,
  act:
    { entry_id: string } | { intervention_id: string } | Record<string, never>,
): Promise<string> {
  return line(tx, account, "campaign.decision", "brevo_transactional", {
    event_id: randomUUID(),
    account_id: account,
    campaign_id: campaign,
    email_code: emailCode,
    ...act,
  });
}

/** A refusal of queue 7 (other, its message to the brand, an internal comment), by agent B. */
async function rejectedEntry(
  tx: Tx,
  account: string,
  campaign: string,
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into campaigns.campaign_review_entries
      (campaign_id, advertiser_account_id, state, decided_by_account_id, decided_at,
       rejection_reason_code, member_message, internal_comment, closed_at)
    values (${campaign}, ${account}, 'rejected', ${agentB}, now(), 'other', ${MESSAGE}, ${COMMENT},
            now())
    returning id::text`;
  if (row === undefined) throw new Error("no entry");
  return row.id;
}

/** An intervention of agent A (its values and comment held by the line, never read). */
async function intervention(
  tx: Tx,
  account: string,
  campaign: string,
  kind: "created" | "corrected" | "paused" | "resumed" | "closed",
): Promise<string> {
  const corrected = kind === "corrected";
  const [row] = await tx<{ id: string }[]>`
    insert into campaigns.agent_interventions
      (campaign_id, advertiser_account_id, kind, field_code, old_value, new_value, reason_code,
       internal_comment, agent_account_id)
    values (${campaign}, ${account}, ${kind}, ${corrected ? "brief" : null},
            ${corrected ? JSON.stringify("l3c-t5 old brief") : null}::text::jsonb,
            ${corrected ? JSON.stringify("l3c-t5 new brief") : null}::text::jsonb,
            ${kind === "created" ? "brand_request" : "entry_error"}, ${COMMENT}, ${agentA})
    returning id::text`;
  if (row === undefined) throw new Error("no intervention");
  return row.id;
}

async function dayInZone(tx: Tx, instant: string): Promise<string> {
  const [row] = await tx<{ day: string }[]>`
    select ((${instant}::timestamptz at time zone ${ZONE})::date)::text as day`;
  return String(row?.day);
}

/** The read's output columns (proargmodes 't'). */
async function outputColumns(fn: string): Promise<string[]> {
  const [row] = await migrationRole()<{ names: string[] }[]>`
    select array(select n from unnest(p.proargnames, p.proargmodes) as a (n, m)
                  where m = 't') as names
      from pg_catalog.pg_proc p
     where p.oid = ${fn}::regprocedure`;
  return row?.names ?? [];
}

// ---------------------------------------------------------------------------------------------

describe("L3C-T5 leads.read_campaign_attributes(): RG104 for Brevo, RG105 for Apollo (0310)", () => {
  it("serves a Brevo contact the counter, the latest publication and its sector, currency, countries and networks; a draft is not counted, a closed one is", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newAccount(tx);
      const older = await publishedCampaign(
        tx,
        brand,
        "older",
        "2026-02-01T10:00:00Z",
      );
      await tx`update campaigns.campaigns set status = 'closed' where id = ${older}`;
      await publishedCampaign(
        tx,
        brand,
        "latest",
        "2026-03-01T10:00:00Z",
        "beauty_personal_care",
        "GBP",
      );
      await submittedCampaign(tx, brand, "pending");
      const id = await line(tx, brand, "campaign.published", "brevo_contact", {
        account_id: brand,
      });
      return rowsOf(await asWorker(tx, READ_ATTRIBUTES, id));
    });
    expect(outcome).toEqual([
      {
        has_published: true,
        campaigns_published: 2,
        last_published_at: new Date("2026-03-01T10:00:00Z"),
        last_sector_code: "beauty_personal_care",
        last_currency: "GBP",
        last_countries: "FR,BE",
        last_networks: "tiktok,instagram",
      },
    ]);
  });

  it("serves an Apollo contact « a publié une campagne » and its date only (RG105, CA70)", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newAccount(tx);
      await publishedCampaign(tx, brand, "only", "2026-03-01T10:00:00Z");
      const id = await line(tx, brand, "campaign.published", "apollo_contact", {
        account_id: brand,
      });
      return rowsOf(await asWorker(tx, READ_ATTRIBUTES, id));
    });
    expect(outcome).toEqual([
      {
        has_published: true,
        campaigns_published: null,
        last_published_at: new Date("2026-03-01T10:00:00Z"),
        last_sector_code: null,
        last_currency: null,
        last_countries: null,
        last_networks: null,
      },
    ]);
  });

  it("serves an advertiser without a published campaign false, 0 and NULL; no row for a creator nor an erased account", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newAccount(tx);
      await submittedCampaign(tx, brand, "pending");
      const creator = await newAccount(tx, "creator");
      const erased = await newAccount(tx);
      await publishedCampaign(tx, erased, "erased", "2026-03-01T10:00:00Z");
      const lines = {
        brand: await line(tx, brand, "lead.updated", "brevo_contact", {}),
        creator: await line(tx, creator, "lead.updated", "brevo_contact", {}),
        erased: await line(
          tx,
          erased,
          "campaign.published",
          "brevo_contact",
          {},
        ),
      };
      await tx`update identity.accounts set status = 'deleted', deleted_at = now()
                where id = ${erased}`;
      return {
        brand: rowsOf(await asWorker(tx, READ_ATTRIBUTES, lines.brand)),
        creator: rowsOf(await asWorker(tx, READ_ATTRIBUTES, lines.creator)),
        erased: rowsOf(await asWorker(tx, READ_ATTRIBUTES, lines.erased)),
      };
    });
    expect(outcome.brand).toEqual([
      {
        has_published: false,
        campaigns_published: 0,
        last_published_at: null,
        last_sector_code: null,
        last_currency: null,
        last_countries: null,
        last_networks: null,
      },
    ]);
    expect(outcome.creator).toEqual([]);
    expect(outcome.erased).toEqual([]);
  });
});

describe("L3C-T5 leads.read_brevo_campaign_decision(): the facts of each decision e-mail (0310, modele §8)", () => {
  it("serves a refusal its reason, its message to the brand, its date in the account's zone and its type; a publication without reason nor message", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newAccount(tx);
      const refused = await submittedCampaign(tx, brand, "refused");
      const entry = await rejectedEntry(tx, brand, refused);
      const published = await submittedCampaign(tx, brand, "published");
      await publishAsInflux(tx, published);
      const [decided] = await tx<
        { entry: string; at: string; refusedAt: string }[]
      >`
        select (select e.id::text from campaigns.campaign_review_entries e
                 where e.campaign_id = ${published}) as entry,
               (select e.decided_at::text from campaigns.campaign_review_entries e
                 where e.campaign_id = ${published}) as at,
               (select e.decided_at::text from campaigns.campaign_review_entries e
                 where e.id = ${entry}) as "refusedAt"`;
      return {
        refusedDay: await dayInZone(tx, String(decided?.refusedAt)),
        publishedDay: await dayInZone(tx, String(decided?.at)),
        refusal: rowsOf(
          await asWorker(
            tx,
            READ_DECISION,
            await decisionLine(tx, brand, refused, "rejected", {
              entry_id: entry,
            }),
          ),
        ),
        publication: rowsOf(
          await asWorker(
            tx,
            READ_DECISION,
            await decisionLine(tx, brand, published, "published", {
              entry_id: String(decided?.entry),
            }),
          ),
        ),
      };
    });
    expect(outcome.refusal).toEqual([
      {
        email_code: "rejected",
        campaign_type_code: "product_placement",
        occurred_on: outcome.refusedDay,
        reason_code: "other",
        member_message: MESSAGE,
        field_code: null,
        preferred_language: "fr",
      },
    ]);
    expect(outcome.publication).toEqual([
      {
        email_code: "published",
        campaign_type_code: "product_placement",
        occurred_on: outcome.publishedDay,
        reason_code: null,
        member_message: null,
        field_code: null,
        preferred_language: "fr",
      },
    ]);
  });

  it("serves an intervention its field and reason (never its values), the automatic closure its date; a code that does not match its act gives no row", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newAccount(tx);
      const campaign = await submittedCampaign(tx, brand, "acted");
      const corrected = await intervention(tx, brand, campaign, "corrected");
      const paused = await intervention(tx, brand, campaign, "paused");
      const closed = await publishedCampaign(
        tx,
        brand,
        "closed",
        "2026-03-01T10:00:00Z",
      );
      await tx`update campaigns.campaigns set status = 'closed' where id = ${closed}`;
      const [instants] = await tx<{ corrected: string; closed: string }[]>`
        select (select created_at::text from campaigns.agent_interventions
                 where id = ${corrected}) as corrected,
               (select closed_at::text from campaigns.campaigns where id = ${closed}) as closed`;
      const read = async (
        code: string,
        act: { intervention_id: string } | Record<string, never>,
        target = campaign,
      ): Promise<Row[]> =>
        rowsOf(
          await asWorker(
            tx,
            READ_DECISION,
            await decisionLine(tx, brand, target, code, act),
          ),
        );
      return {
        correctedDay: await dayInZone(tx, String(instants?.corrected)),
        closedDay: await dayInZone(tx, String(instants?.closed)),
        corrected: await read("corrected", { intervention_id: corrected }),
        paused: await read("paused_by_influx", { intervention_id: paused }),
        automatic: await read("closed_automatically", {}, closed),
        mismatch: await read("closed_by_influx", { intervention_id: paused }),
        unknown: await read("updated", { intervention_id: paused }),
        notClosed: await read("closed_automatically", {}),
      };
    });
    expect(outcome.corrected).toEqual([
      {
        email_code: "corrected",
        campaign_type_code: "product_placement",
        occurred_on: outcome.correctedDay,
        reason_code: "entry_error",
        member_message: null,
        field_code: "brief",
        preferred_language: "fr",
      },
    ]);
    expect(outcome.paused).toEqual([
      expect.objectContaining({
        email_code: "paused_by_influx",
        reason_code: "entry_error",
        field_code: null,
      }),
    ]);
    expect(outcome.automatic).toEqual([
      {
        email_code: "closed_automatically",
        campaign_type_code: "product_placement",
        occurred_on: outcome.closedDay,
        reason_code: null,
        member_message: null,
        field_code: null,
        preferred_language: "fr",
      },
    ]);
    expect(outcome.mismatch).toEqual([]);
    expect(outcome.unknown).toEqual([]);
    expect(outcome.notClosed).toEqual([]);
  });

  it("serves no row once the account is erased, nor for an act of another account or another campaign", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newAccount(tx);
      const other = await newAccount(tx);
      const campaign = await submittedCampaign(tx, brand, "mine");
      const sibling = await submittedCampaign(tx, brand, "sibling");
      const entry = await rejectedEntry(tx, brand, campaign);
      const acted = await intervention(tx, brand, campaign, "paused");
      const lines = {
        foreignEntry: await decisionLine(tx, other, campaign, "rejected", {
          entry_id: entry,
        }),
        foreignAct: await decisionLine(
          tx,
          other,
          campaign,
          "paused_by_influx",
          {
            intervention_id: acted,
          },
        ),
        sibling: await decisionLine(tx, brand, sibling, "rejected", {
          entry_id: entry,
        }),
        mine: await decisionLine(tx, brand, campaign, "rejected", {
          entry_id: entry,
        }),
      };
      const read = async (id: string): Promise<Row[]> =>
        rowsOf(await asWorker(tx, READ_DECISION, id));
      const before = {
        foreignEntry: await read(lines.foreignEntry),
        foreignAct: await read(lines.foreignAct),
        sibling: await read(lines.sibling),
        mine: await read(lines.mine),
      };
      await tx`update identity.accounts set status = 'deleted', deleted_at = now()
                where id = ${brand}`;
      return { before, erased: await read(lines.mine) };
    });
    expect(outcome.before.foreignEntry).toEqual([]);
    expect(outcome.before.foreignAct).toEqual([]);
    expect(outcome.before.sibling).toEqual([]);
    expect(outcome.before.mine).toHaveLength(1);
    expect(outcome.erased).toEqual([]);
  });
});

describe("L3C-T5 the two reads: the worker alone, nothing of RG106 (0310)", () => {
  it("refuses every role but the worker (42501), another worker (55000) and another line (22023)", async () => {
    const outcome = await scenario(async (tx) => {
      const brand = await newAccount(tx);
      const campaign = await submittedCampaign(tx, brand, "roles");
      const entry = await rejectedEntry(tx, brand, campaign);
      const contact = await line(
        tx,
        brand,
        "campaign.published",
        "brevo_contact",
        {},
      );
      const decision = await decisionLine(tx, brand, campaign, "rejected", {
        entry_id: entry,
      });
      const pairs: [string, string][] = [
        [READ_ATTRIBUTES, contact],
        [READ_DECISION, decision],
      ];
      const roles: string[] = [];
      for (const [statement, id] of pairs) {
        roles.push(
          codeOf(
            await actAsMember(
              tx,
              "influx_advertiser",
              { accountId: brand, role: "advertiser", aal: "aal1" },
              () => attempt(tx, statement, [id, "w1"]),
            ),
          ),
          codeOf(
            await actAsInternal(
              tx,
              "influx_agent",
              { accountId: agentA, role: "agent", aal: "aal2" },
              () => attempt(tx, statement, [id, "w1"]),
            ),
          ),
          codeOf(
            await actAsInternal(
              tx,
              "influx_admin",
              { accountId: adminA, role: "admin", aal: "aal2" },
              () => attempt(tx, statement, [id, "w1"]),
            ),
          ),
          codeOf(
            await actAs(tx, "privacy", () =>
              attempt(tx, statement, [id, "w1"]),
            ),
          ),
        );
      }
      return {
        roles,
        otherWorker: [
          codeOf(await asWorker(tx, READ_ATTRIBUTES, contact, "w2")),
          codeOf(await asWorker(tx, READ_DECISION, decision, "w2")),
        ],
        otherLine: [
          // a transactional line is no contact; a contact line is no decision
          codeOf(await asWorker(tx, READ_ATTRIBUTES, decision)),
          codeOf(await asWorker(tx, READ_DECISION, contact)),
        ],
      };
    });
    expect(outcome.roles).toEqual(Array(8).fill(INSUFFICIENT_PRIVILEGE));
    expect(outcome.otherWorker).toEqual([
      NOT_IN_PREREQUISITE_STATE,
      NOT_IN_PREREQUISITE_STATE,
    ]);
    expect(outcome.otherLine).toEqual([INVALID_PARAMETER, INVALID_PARAMETER]);
  });

  it("returns codes, dates, a counter, a boolean and the message of a refusal only; their owner reads no text, band, budget, value, agent nor comment, the worker nothing", async () => {
    const attributes = await outputColumns(
      "leads.read_campaign_attributes(bigint, text)",
    );
    const decision = await outputColumns(
      "leads.read_brevo_campaign_decision(bigint, text)",
    );
    const rights = await migrationRole()<{ role: string; name: string }[]>`
      select r.role, c.attrelid::regclass::text || '.' || c.attname as name
        from unnest(array['influx_leads_definer', 'influx_worker']) as r (role),
             pg_catalog.pg_attribute c
       where c.attrelid in ('campaigns.campaigns'::regclass,
                            'campaigns.campaign_review_entries'::regclass,
                            'campaigns.agent_interventions'::regclass,
                            'campaigns.campaign_published_snapshots'::regclass,
                            'campaigns.campaign_key_messages'::regclass)
         and c.attnum > 0 and not c.attisdropped
         and pg_catalog.has_column_privilege(r.role, c.attrelid, c.attname, 'SELECT')
       order by 1, 2`;
    expect(attributes).toEqual([
      "has_published",
      "campaigns_published",
      "last_published_at",
      "last_sector_code",
      "last_currency",
      "last_countries",
      "last_networks",
    ]);
    expect(decision).toEqual([
      "email_code",
      "campaign_type_code",
      "occurred_on",
      "reason_code",
      "member_message",
      "field_code",
      "preferred_language",
    ]);
    expect(rights).toEqual([
      {
        role: "influx_leads_definer",
        name: "campaigns.agent_interventions.advertiser_account_id",
      },
      {
        role: "influx_leads_definer",
        name: "campaigns.agent_interventions.campaign_id",
      },
      {
        role: "influx_leads_definer",
        name: "campaigns.agent_interventions.created_at",
      },
      {
        role: "influx_leads_definer",
        name: "campaigns.agent_interventions.field_code",
      },
      {
        role: "influx_leads_definer",
        name: "campaigns.agent_interventions.id",
      },
      {
        role: "influx_leads_definer",
        name: "campaigns.agent_interventions.kind",
      },
      {
        role: "influx_leads_definer",
        name: "campaigns.agent_interventions.reason_code",
      },
      {
        role: "influx_leads_definer",
        name: "campaigns.campaign_review_entries.advertiser_account_id",
      },
      {
        role: "influx_leads_definer",
        name: "campaigns.campaign_review_entries.campaign_id",
      },
      {
        role: "influx_leads_definer",
        name: "campaigns.campaign_review_entries.decided_at",
      },
      {
        role: "influx_leads_definer",
        name: "campaigns.campaign_review_entries.id",
      },
      {
        role: "influx_leads_definer",
        name: "campaigns.campaign_review_entries.member_message",
      },
      {
        role: "influx_leads_definer",
        name: "campaigns.campaign_review_entries.rejection_reason_code",
      },
      {
        role: "influx_leads_definer",
        name: "campaigns.campaign_review_entries.state",
      },
      {
        role: "influx_leads_definer",
        name: "campaigns.campaigns.advertiser_account_id",
      },
      {
        role: "influx_leads_definer",
        name: "campaigns.campaigns.campaign_type_code",
      },
      { role: "influx_leads_definer", name: "campaigns.campaigns.closed_at" },
      { role: "influx_leads_definer", name: "campaigns.campaigns.currency" },
      {
        role: "influx_leads_definer",
        name: "campaigns.campaigns.first_published_at",
      },
      { role: "influx_leads_definer", name: "campaigns.campaigns.id" },
      { role: "influx_leads_definer", name: "campaigns.campaigns.sector_code" },
    ]);
  });
});

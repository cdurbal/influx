// L3C commit 04 — the life of a published campaign and the interventions of an agent (0309;
// docs/mvp/09 RG1, RG8, RG9, RG93, RG94, CA8, CA9, CA49, CA60, CA61; 03 C(7); jalons/l3c/modele.md
// §5, §6, §8; fiche invariants 1, 6, 7, 10, 11).
//   L3C-T4  RG8, CA8 (the brand pauses and resumes its own pause, never INFLUX's); RG9, CA9 (closure,
//           irreversible, nothing erased); the agent's pause, resumption and closure with a reason, a
//           held account admitted; the automatic closure at the end + N days, not before, by the
//           system only; RG1, CA60, CA61 (old and new value, reason, the brand told); the correction
//           refused outside the states of modele §6; T14.
// Each case runs in a rolled-back transaction of the local superuser, which acts as apps/api does
// (support.ts: actAsMember, actAsInternal, actAs).
import {
  accountIdOf,
  CAMPAIGN_IDS,
  inRolledBackTransaction,
} from "@influx/test-kit/db";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAs,
  actAsInternal,
  actAsMember,
  localSuperuser,
  testDataSet,
} from "./support.ts";
import { campaignCalendar, civilDateIn } from "./campaign-dates-kit.ts";
import { publishAsInflux } from "./campaign-publication-kit.ts";

type Tx = postgres.TransactionSql;

const CALENDAR = campaignCalendar();

const INVALID_PARAMETER = "22023";
const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_IN_PREREQUISITE_STATE = "55000";
const LOCK_NOT_AVAILABLE = "55P03";
const CHECK_VIOLATION = "23514";

const brandA = accountIdOf("advertiser", "a");
const brandB = accountIdOf("advertiser", "b");
const creatorA = accountIdOf("creator", "a");
const agentA = accountIdOf("agent", "a");
const agentB = accountIdOf("agent", "b");
const adminA = accountIdOf("admin", "a");
const campaignA = CAMPAIGN_IDS.a;
const campaignB = CAMPAIGN_IDS.b;
const UNKNOWN = "00000000-0000-4000-8000-0000000fffff";

const COMMENT = "l3c-t4-internal-comment-marker";

beforeAll(async () => {
  await testDataSet();
});

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

type Refusal = {
  outcome: "error";
  code: string;
  message: string;
  detail: string | undefined;
};
type Parameter = postgres.ParameterOrJSON<never> | undefined;
type Outcome<T> = { outcome: "rows"; rows: T[] } | Refusal;

/** One statement in a savepoint of `tx`: its rows, or its SQLSTATE, message and detail. */
async function run<T = Record<string, unknown>>(
  tx: Tx,
  statement: string,
  parameters: readonly Parameter[] = [],
): Promise<Outcome<T>> {
  try {
    const result = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters.map(
          (value) => value ?? null,
        ) as postgres.ParameterOrJSON<never>[],
      ),
    );
    return { outcome: "rows", rows: [...result] as T[] };
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

async function rows<T>(
  tx: Tx,
  statement: string,
  parameters: readonly Parameter[] = [],
): Promise<T[]> {
  const found = await run<T>(tx, statement, parameters);
  if (found.outcome === "error") {
    throw new Error(`${found.code} ${found.message} (${found.detail ?? ""})`);
  }
  return found.rows;
}

function refused(code: string, message?: string, detail?: string): unknown {
  return expect.objectContaining({
    outcome: "error",
    code,
    ...(message === undefined ? {} : { message }),
    ...(detail === undefined ? {} : { detail }),
  });
}

function asBrand<T>(tx: Tx, account: string, fn: () => Promise<T>): Promise<T> {
  return actAsMember(
    tx,
    "influx_advertiser",
    { accountId: account, role: "advertiser", aal: "aal1" },
    fn,
  );
}

type Internal = { account: string; role: "agent" | "admin" };
const AGENT_A: Internal = { account: agentA, role: "agent" };
const AGENT_B: Internal = { account: agentB, role: "agent" };
const ADMIN_A: Internal = { account: adminA, role: "admin" };

function call<T>(
  tx: Tx,
  who: Internal,
  statement: string,
  parameters: readonly Parameter[],
  aal: "aal1" | "aal2" = "aal2",
): Promise<Outcome<T>> {
  return actAsInternal(
    tx,
    who.role === "agent" ? "influx_agent" : "influx_admin",
    { accountId: who.account, role: who.role, aal },
    () => run<T>(tx, statement, parameters),
  );
}

// the calls --------------------------------------------------------------------------------------

type BrandPassage = { status: string; changed: boolean };
type AgentPassage = { status: string; intervention_id: string };

function brandPassage(
  tx: Tx,
  fn: "pause_own_campaign" | "resume_own_campaign" | "close_own_campaign",
  campaign: string = campaignA,
  account: string = brandA,
): Promise<Outcome<BrandPassage>> {
  return asBrand(tx, account, () =>
    run<BrandPassage>(tx, `select * from campaigns.${fn}($1::uuid)`, [
      campaign,
    ]),
  );
}

function agentPassage(
  tx: Tx,
  who: Internal,
  fn: "pause_campaign" | "resume_campaign" | "close_campaign",
  campaign: string = campaignA,
  reason: string | null = "brand_request",
  comment: string | null = null,
  aal: "aal1" | "aal2" = "aal2",
): Promise<Outcome<AgentPassage>> {
  return call<AgentPassage>(
    tx,
    who,
    `select * from campaigns.${fn}($1::uuid, $2::text, $3::text)`,
    [campaign, reason, comment],
    aal,
  );
}

type Correction = { intervention_id: string; review_token: string | null };

function correct(
  tx: Tx,
  who: Internal,
  field: string,
  value: unknown,
  reason = "entry_error",
  comment: string | null = COMMENT,
  campaign: string = campaignA,
): Promise<Outcome<Correction>> {
  return call<Correction>(
    tx,
    who,
    // the value travels as JSON text, cast by the server (a jsonb parameter would be encoded twice)
    "select * from campaigns.correct_campaign_field($1::uuid, $2::text, $3::text::jsonb, $4::text, $5::text)",
    [campaign, field, JSON.stringify(value), reason, comment],
  );
}

function createFor(
  tx: Tx,
  who: Internal,
  account: string,
  title: string | null = "Winter collection launch",
  type: string | null = "product_review",
): Promise<Outcome<{ campaign_id: string; intervention_id: string }>> {
  return call(
    tx,
    who,
    "select * from campaigns.create_campaign_for_brand($1::uuid, $2::text, $3::text)",
    [account, title, type],
  );
}

// the fixtures -----------------------------------------------------------------------------------

type Overrides = Readonly<Record<string, string | number | boolean | null>>;

/** Completes the draft of brand A (the data set holds one row in each list), its profile published. */
async function readyA(tx: Tx, overrides: Overrides = {}): Promise<void> {
  await tx`
    update profiles.advertiser_profiles set status = 'published' where account_id = ${brandA}`;
  const columns = {
    title: "Summer outdoor kit",
    campaign_type_code: "product_placement",
    public_summary: "s".repeat(120),
    brief: "b".repeat(300),
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
    applications_close_on: CALENDAR.applicationsCloseOn,
    content_due_on: CALENDAR.contentDueOn,
    starts_on: CALENDAR.startsOn,
    ends_on: CALENDAR.endsOn,
    ...overrides,
  };
  await tx`update campaigns.campaigns set ${tx(columns)} where id = ${campaignA}`;
}

/** Campaign A complete and published (or paused) as INFLUX would have it (0308 snapshot). */
async function liveA(
  tx: Tx,
  status: "published" | "paused" = "published",
  overrides: Overrides = {},
): Promise<void> {
  await readyA(tx, overrides);
  await publishAsInflux(tx, campaignA, status);
}

/** Campaign A submitted by its brand: the id of its open entry. */
async function submittedA(
  tx: Tx,
  overrides: Overrides = {},
  locale: string | null = null,
): Promise<string> {
  await readyA(tx, overrides);
  const submission = await asBrand(tx, brandA, () =>
    run(tx, "select * from campaigns.submit_own_campaign($1::uuid, $2::text)", [
      campaignA,
      locale,
    ]),
  );
  if (submission.outcome === "error") {
    throw new Error(`${submission.code} ${submission.message}`);
  }
  const [entry] = await tx<{ id: string }[]>`
    select id::text from campaigns.campaign_review_entries
     where campaign_id = ${campaignA} and state = 'open'`;
  if (entry === undefined) throw new Error("no open entry");
  return entry.id;
}

/** `who` claims the entry: the version token. */
async function claim(tx: Tx, who: Internal, entry: string): Promise<string> {
  const [opened] = await actAsInternal(
    tx,
    who.role === "agent" ? "influx_agent" : "influx_admin",
    { accountId: who.account, role: who.role, aal: "aal2" },
    () =>
      rows<{ review_token: string | null }>(
        tx,
        "select * from campaigns.open_campaign_review_entry($1::uuid)",
        [entry],
      ),
  );
  if (opened?.review_token == null) throw new Error("no claim");
  return opened.review_token;
}

/** Another complete campaign of `account`, published (or paused), its period ending `endsIn` days from today. */
async function liveCampaign(
  tx: Tx,
  account: string,
  status: "published" | "paused",
  endsIn: number,
  closeIn: number = endsIn - 30,
): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into campaigns.campaigns
      (advertiser_account_id, title, campaign_type_code, public_summary, brief,
       product_description, sector_code, product_is_sent, usage_rights_code,
       usage_rights_duration_band, usage_rights_territory_scope, exclusivity_band,
       content_review_delay, currency, remuneration_kind, per_creator_budget_band_code,
       creators_wanted, applications_close_on, content_due_on, starts_on, ends_on, submitted_at)
    values (${account}, 'An ending campaign', 'product_placement', ${"s".repeat(120)},
            ${"b".repeat(300)}, 'A light tent for two', 'sports_leisure', false, 'organic_repost',
            '3m', 'worldwide', 'none', '5bd', 'EUR', 'cash', '500_1000', 3,
            ${civilDateIn(closeIn)}, ${civilDateIn(closeIn + 5)}, ${civilDateIn(closeIn + 10)},
            ${civilDateIn(endsIn)}, now() - interval '60 days')
    returning id::text`;
  if (row === undefined) throw new Error("no campaign");
  await publishAsInflux(tx, row.id, status);
  return row.id;
}

type Cycle = {
  status: string;
  paused: boolean;
  pause_origin: string | null;
  closed: boolean;
  snapshot: string | null;
  title: string | null;
};

async function cycleOf(tx: Tx, campaign: string = campaignA): Promise<Cycle> {
  const [row] = await tx<Cycle[]>`
    select status::text, paused_at is not null as paused, pause_origin,
           closed_at is not null as closed, current_snapshot_id::text as snapshot, title
      from campaigns.campaigns where id = ${campaign}`;
  if (row === undefined) throw new Error("no campaign");
  return row;
}

type RegisterLine = {
  event_type: string;
  actor_type: string;
  actor_account_id: string | null;
  payload: Record<string, unknown>;
};

async function linesOf(
  tx: Tx,
  campaign: string = campaignA,
): Promise<RegisterLine[]> {
  return tx<RegisterLine[]>`
    select event_type, actor_type::text as actor_type, actor_account_id::text as actor_account_id,
           payload
      from audit.audit_events
     where subject_type = 'campaign' and subject_id = ${campaign}
       and event_type in ('campaign.paused', 'campaign.resumed', 'campaign.closed',
                          'campaign.corrected', 'campaign.created_for_brand',
                          'campaign.record_read')
     order by seq`;
}

type Queued = {
  event_type: string;
  destination: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
};

async function decisionsOf(
  tx: Tx,
  account: string = brandA,
): Promise<Queued[]> {
  return tx<Queued[]>`
    select event_type, destination::text, payload, idempotency_key
      from leads.outbox_events
     where subject_key = ${`account:${account}`} and event_type = 'campaign.decision'
     order by created_at, event_id`;
}

type Intervention = {
  kind: string;
  field_code: string | null;
  old_value: unknown;
  new_value: unknown;
  reason_code: string;
  internal_comment: string | null;
  agent_account_id: string;
  review_entry_id: string | null;
};

async function interventionsOf(
  tx: Tx,
  campaign: string = campaignA,
): Promise<Intervention[]> {
  return tx<Intervention[]>`
    select kind, field_code, old_value, new_value, reason_code, internal_comment,
           agent_account_id::text as agent_account_id, review_entry_id::text as review_entry_id
      from campaigns.agent_interventions
     where campaign_id = ${campaign}
     order by created_at, id`;
}

// ---------------------------------------------------------------------------------------------
// L3C-T4: the brand's passages (RG8, CA8; RG9, CA9)
// ---------------------------------------------------------------------------------------------

describe("L3C-T4 the brand pauses, resumes and closes its campaign (09 RG8, RG9, CA8, CA9)", () => {
  it("L3C-T4 RG8 CA8 the brand pauses its published campaign: paused by the brand, registered, no e-mail; a second pause changes nothing", async () => {
    const outcome = await scenario(async (tx) => {
      await liveA(tx);
      const first = await brandPassage(tx, "pause_own_campaign");
      const second = await brandPassage(tx, "pause_own_campaign");
      return {
        first,
        second,
        cycle: await cycleOf(tx),
        lines: await linesOf(tx),
        decisions: await decisionsOf(tx),
      };
    });
    expect(outcome.first).toEqual({
      outcome: "rows",
      rows: [{ status: "paused", changed: true }],
    });
    expect(outcome.second).toEqual({
      outcome: "rows",
      rows: [{ status: "paused", changed: false }],
    });
    expect(outcome.cycle).toMatchObject({
      status: "paused",
      paused: true,
      pause_origin: "brand",
      closed: false,
    });
    expect(outcome.lines).toEqual([
      {
        event_type: "campaign.paused",
        actor_type: "member",
        actor_account_id: brandA,
        payload: { origin: "brand" },
      },
    ]);
    expect(outcome.decisions).toEqual([]);
  });

  it("L3C-T4 RG8 the brand resumes its own pause: published again on the same snapshot, the pause emptied, no new validation", async () => {
    const outcome = await scenario(async (tx) => {
      await liveA(tx);
      const before = (await cycleOf(tx)).snapshot;
      await brandPassage(tx, "pause_own_campaign");
      const resumed = await brandPassage(tx, "resume_own_campaign");
      const again = await brandPassage(tx, "resume_own_campaign");
      const [counts] = await tx<{ snapshots: number; open: number }[]>`
        select (select count(*)::int from campaigns.campaign_published_snapshots
                 where campaign_id = ${campaignA}) as snapshots,
               (select count(*)::int from campaigns.campaign_review_entries
                 where campaign_id = ${campaignA} and state = 'open') as open`;
      return {
        resumed,
        again,
        before,
        cycle: await cycleOf(tx),
        counts,
        lines: (await linesOf(tx)).map((line) => line.event_type),
      };
    });
    expect(outcome.resumed).toEqual({
      outcome: "rows",
      rows: [{ status: "published", changed: true }],
    });
    expect(outcome.again).toEqual({
      outcome: "rows",
      rows: [{ status: "published", changed: false }],
    });
    expect(outcome.cycle).toMatchObject({
      status: "published",
      paused: false,
      pause_origin: null,
      snapshot: outcome.before,
    });
    expect(outcome.counts).toEqual({ snapshots: 1, open: 0 });
    expect(outcome.lines).toEqual(["campaign.paused", "campaign.resumed"]);
  });

  it("L3C-T4 RG8 the brand never resumes a pause decided by INFLUX (55000 campaign_not_resumable, paused_by_influx)", async () => {
    const outcome = await scenario(async (tx) => {
      await liveA(tx);
      await agentPassage(tx, AGENT_A, "pause_campaign");
      return {
        resume: await brandPassage(tx, "resume_own_campaign"),
        cycle: await cycleOf(tx),
      };
    });
    expect(outcome.resume).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "campaign_not_resumable",
        "paused_by_influx",
      ),
    );
    expect(outcome.cycle).toMatchObject({
      status: "paused",
      pause_origin: "influx",
    });
  });

  it("L3C-T4 RG9 CA9 the brand closes a published or a paused campaign: closed, nothing erased, a second closure changes nothing", async () => {
    const outcome = await scenario(async (tx) => {
      await liveA(tx);
      const fromPublished = await brandPassage(tx, "close_own_campaign");
      const again = await brandPassage(tx, "close_own_campaign");
      const paused = await liveCampaign(tx, brandA, "paused", 60, 10);
      const fromPaused = await brandPassage(tx, "close_own_campaign", paused);
      return {
        fromPublished,
        again,
        fromPaused,
        cycleA: await cycleOf(tx),
        cyclePaused: await cycleOf(tx, paused),
        lines: await linesOf(tx),
      };
    });
    expect(outcome.fromPublished).toEqual({
      outcome: "rows",
      rows: [{ status: "closed", changed: true }],
    });
    expect(outcome.again).toEqual({
      outcome: "rows",
      rows: [{ status: "closed", changed: false }],
    });
    expect(outcome.fromPaused).toEqual({
      outcome: "rows",
      rows: [{ status: "closed", changed: true }],
    });
    // RG9: no data erased, the snapshot kept
    expect(outcome.cycleA).toMatchObject({
      status: "closed",
      closed: true,
      title: "Summer outdoor kit",
      snapshot: expect.any(String),
    });
    expect(outcome.cyclePaused).toMatchObject({
      status: "closed",
      closed: true,
      paused: false,
      pause_origin: null,
    });
    expect(outcome.lines).toEqual([
      expect.objectContaining({
        event_type: "campaign.closed",
        actor_account_id: brandA,
        payload: { origin: "brand" },
      }),
    ]);
  });

  it("L3C-T4 CA9 a closure is irreversible: neither the brand, an agent nor any influx_% writer reopens it (55000)", async () => {
    const outcome = await scenario(async (tx) => {
      await liveA(tx);
      await brandPassage(tx, "close_own_campaign");
      const brandResume = await brandPassage(tx, "resume_own_campaign");
      const brandPause = await brandPassage(tx, "pause_own_campaign");
      const agentResume = await agentPassage(tx, AGENT_A, "resume_campaign");
      // the erasure owner is free of the freeze: the trigger of the cycle still refuses
      await tx.unsafe(
        "grant update (status) on campaigns.campaigns to influx_privacy_definer",
      );
      await tx.unsafe(
        "create policy l3c_t4_witness on campaigns.campaigns to influx_privacy_definer " +
          "using (true) with check (true)",
      );
      await tx.unsafe("set local role influx_privacy_definer");
      const reopen = await run(
        tx,
        "update campaigns.campaigns set status = 'published' where id = $1::uuid",
        [campaignA],
      );
      await tx.unsafe("reset role");
      return {
        brandResume,
        brandPause,
        agentResume,
        reopen,
        status: (await cycleOf(tx)).status,
      };
    });
    expect(outcome.brandResume).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "campaign_not_resumable", "closed"),
    );
    expect(outcome.brandPause).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "campaign_not_pausable", "closed"),
    );
    expect(outcome.agentResume).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "campaign_not_resumable", "closed"),
    );
    expect(outcome.reopen).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "campaign_closed", "campaign_closed"),
    );
    expect(outcome.status).toBe("closed");
  });

  it("L3C-T4 the brand's passages outside their states: a draft is not paused, a pending campaign not closed (55000, DETAIL the state)", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      const pauseDraft = await brandPassage(tx, "pause_own_campaign");
      const resumeDraft = await brandPassage(tx, "resume_own_campaign");
      await submittedA(tx);
      const closePending = await brandPassage(tx, "close_own_campaign");
      return { pauseDraft, resumeDraft, closePending };
    });
    expect(outcome).toEqual({
      pauseDraft: refused(
        NOT_IN_PREREQUISITE_STATE,
        "campaign_not_pausable",
        "draft",
      ),
      resumeDraft: refused(
        NOT_IN_PREREQUISITE_STATE,
        "campaign_not_resumable",
        "draft",
      ),
      closePending: refused(
        NOT_IN_PREREQUISITE_STATE,
        "campaign_not_closable",
        "pending_review",
      ),
    });
  });

  it("L3C-T4 T14 the brand's passages: an unknown campaign and another brand's give the same answer (42501 forbidden)", async () => {
    const outcome = await scenario(async (tx) => {
      await liveA(tx);
      const unknown = await brandPassage(
        tx,
        "pause_own_campaign",
        UNKNOWN,
        brandB,
      );
      const other = await brandPassage(
        tx,
        "pause_own_campaign",
        campaignA,
        brandB,
      );
      return { unknown, other, status: (await cycleOf(tx)).status };
    });
    expect(outcome.unknown).toEqual(
      refused(INSUFFICIENT_PRIVILEGE, "forbidden"),
    );
    expect(outcome.other).toEqual(outcome.unknown);
    expect(outcome.status).toBe("published");
  });

  it("L3C-T4 invariant 1 the brand's door never leaves a draft for published, even with every right (55000 campaign_not_editable)", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      await tx.unsafe(
        "create policy l3c_t4_witness on campaigns.campaigns to influx_campaign_definer " +
          "using (true) with check (true)",
      );
      await tx.unsafe("set local role influx_campaign_definer");
      const publish = await run(
        tx,
        "update campaigns.campaigns set status = 'published' where id = $1::uuid",
        [campaignA],
      );
      await tx.unsafe("reset role");
      return publish;
    });
    expect(outcome).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "campaign_not_editable",
        "campaign_not_editable",
      ),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// L3C-T4: the agent's passages (modele §5; RG8, RG9, RG93)
// ---------------------------------------------------------------------------------------------

describe("L3C-T4 an agent or an admin pauses, resumes and closes a campaign, with a reason (modele §5)", () => {
  it("L3C-T4 the agent pauses with authority: the intervention, the e-mail paused_by_influx and the register line, nominative", async () => {
    const outcome = await scenario(async (tx) => {
      await liveA(tx);
      const paused = await agentPassage(
        tx,
        AGENT_A,
        "pause_campaign",
        campaignA,
        "non_compliant_content",
        COMMENT,
      );
      return {
        paused,
        cycle: await cycleOf(tx),
        interventions: await interventionsOf(tx),
        decisions: await decisionsOf(tx),
        lines: await linesOf(tx),
      };
    });
    if (outcome.paused.outcome !== "rows") throw new Error("not paused");
    const id = outcome.paused.rows[0]?.intervention_id;
    expect(outcome.paused.rows).toEqual([
      { status: "paused", intervention_id: expect.any(String) },
    ]);
    expect(outcome.cycle).toMatchObject({
      status: "paused",
      pause_origin: "influx",
    });
    expect(outcome.interventions).toEqual([
      {
        kind: "paused",
        field_code: null,
        old_value: null,
        new_value: null,
        reason_code: "non_compliant_content",
        internal_comment: COMMENT,
        agent_account_id: agentA,
        review_entry_id: null,
      },
    ]);
    expect(outcome.decisions).toEqual([
      {
        event_type: "campaign.decision",
        destination: "brevo_transactional",
        payload: {
          event_id: expect.any(String),
          account_id: brandA,
          campaign_id: campaignA,
          email_code: "paused_by_influx",
          intervention_id: id,
        },
        idempotency_key: `campaign.decision:${id}`,
      },
    ]);
    expect(outcome.lines).toEqual([
      {
        event_type: "campaign.paused",
        actor_type: "agent",
        actor_account_id: agentA,
        payload: {
          origin: "influx",
          reason_code: "non_compliant_content",
          intervention_id: id,
        },
      },
    ]);
    // fiche invariant 5: the comment never leaves the line
    expect(JSON.stringify([outcome.decisions, outcome.lines])).not.toContain(
      COMMENT,
    );
  });

  it("L3C-T4 the agent resumes a pause, INFLUX's or the brand's: published, resumed_by_influx, campaign.resumed", async () => {
    const outcome = await scenario(async (tx) => {
      await liveA(tx);
      await brandPassage(tx, "pause_own_campaign");
      const resumed = await agentPassage(
        tx,
        ADMIN_A,
        "resume_campaign",
        campaignA,
        "brand_request",
      );
      return {
        resumed,
        cycle: await cycleOf(tx),
        codes: (await decisionsOf(tx)).map((q) => q.payload.email_code),
        lines: (await linesOf(tx)).map((l) => [
          l.event_type,
          l.actor_account_id,
          l.payload.origin,
        ]),
      };
    });
    expect(outcome.resumed).toEqual({
      outcome: "rows",
      rows: [{ status: "published", intervention_id: expect.any(String) }],
    });
    expect(outcome.cycle).toMatchObject({ status: "published", paused: false });
    expect(outcome.codes).toEqual(["resumed_by_influx"]);
    expect(outcome.lines).toEqual([
      ["campaign.paused", brandA, "brand"],
      ["campaign.resumed", adminA, "influx"],
    ]);
  });

  it("L3C-T4 RG9 the agent closes a paused campaign: closed, closed_by_influx, campaign.closed {origin influx}", async () => {
    const outcome = await scenario(async (tx) => {
      await liveA(tx, "paused");
      const closed = await agentPassage(
        tx,
        AGENT_B,
        "close_campaign",
        campaignA,
        "other",
        COMMENT,
      );
      return {
        closed,
        cycle: await cycleOf(tx),
        codes: (await decisionsOf(tx)).map((q) => q.payload.email_code),
        kinds: (await interventionsOf(tx)).map((i) => [i.kind, i.reason_code]),
        line: (await linesOf(tx)).at(-1),
      };
    });
    expect(outcome.closed).toEqual({
      outcome: "rows",
      rows: [{ status: "closed", intervention_id: expect.any(String) }],
    });
    expect(outcome.cycle).toMatchObject({
      status: "closed",
      closed: true,
      paused: false,
    });
    expect(outcome.codes).toEqual(["closed_by_influx"]);
    expect(outcome.kinds).toEqual([["closed", "other"]]);
    expect(outcome.line).toMatchObject({
      event_type: "campaign.closed",
      actor_account_id: agentB,
      payload: expect.objectContaining({
        origin: "influx",
        reason_code: "other",
      }),
    });
  });

  it("L3C-T4 the agent's passage refused: no reason, other without comment, a passage already done, aal1, a brand caller", async () => {
    const outcome = await scenario(async (tx) => {
      await liveA(tx);
      const noReason = await agentPassage(
        tx,
        AGENT_A,
        "pause_campaign",
        campaignA,
        null,
      );
      const unknownReason = await agentPassage(
        tx,
        AGENT_A,
        "pause_campaign",
        campaignA,
        "because",
      );
      const otherBare = await agentPassage(
        tx,
        AGENT_A,
        "pause_campaign",
        campaignA,
        "other",
      );
      const aal1 = await agentPassage(
        tx,
        AGENT_A,
        "pause_campaign",
        campaignA,
        "brand_request",
        null,
        "aal1",
      );
      const resumePublished = await agentPassage(
        tx,
        AGENT_A,
        "resume_campaign",
      );
      const brand = await asBrand(tx, brandA, () =>
        run(
          tx,
          "select * from campaigns.pause_campaign($1::uuid, 'brand_request', null)",
          [campaignA],
        ),
      );
      return {
        noReason,
        unknownReason,
        otherBare,
        aal1,
        resumePublished,
        brand,
        status: (await cycleOf(tx)).status,
        interventions: (await interventionsOf(tx)).length,
      };
    });
    expect(outcome).toEqual({
      noReason: refused(INVALID_PARAMETER, "reason"),
      unknownReason: refused(INVALID_PARAMETER, "reason"),
      otherBare: refused(INVALID_PARAMETER, "internal_comment"),
      aal1: refused(INSUFFICIENT_PRIVILEGE, "forbidden"),
      resumePublished: refused(
        NOT_IN_PREREQUISITE_STATE,
        "campaign_not_resumable",
        "published",
      ),
      brand: refused(INSUFFICIENT_PRIVILEGE),
      status: "published",
      interventions: 0,
    });
  });

  it("L3C-T4 modele §5 the agent who holds the brand's account may pause it; a draft is not closable (DETAIL draft)", async () => {
    const outcome = await scenario(async (tx) => {
      await liveA(tx);
      await tx`update identity.accounts set owner_agent_id = ${agentA} where id = ${brandA}`;
      const held = await agentPassage(tx, AGENT_A, "pause_campaign");
      const draft = await agentPassage(
        tx,
        AGENT_A,
        "close_campaign",
        campaignB,
      );
      return { held, draft };
    });
    expect(outcome.held).toEqual({
      outcome: "rows",
      rows: [{ status: "paused", intervention_id: expect.any(String) }],
    });
    expect(outcome.draft).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "campaign_not_closable", "draft"),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// L3C-T4: the automatic closure (RG9; modele §5)
// ---------------------------------------------------------------------------------------------

/** A run of campaign_closure for the current period, open; the closure on it, as the worker. */
async function closureRun(tx: Tx) {
  await tx.unsafe("set local session_replication_role = replica");
  await tx`
    delete from ops.periodic_runs
     where task_code::text = 'campaign_closure'
       and period_key = to_char(now() at time zone 'UTC', 'YYYY-MM-DD')`;
  await tx.unsafe("set local session_replication_role = origin");
  const [opened] = await tx<{ id: string }[]>`
    insert into ops.periodic_runs (task_code, period_key)
    values ('campaign_closure', to_char(now() at time zone 'UTC', 'YYYY-MM-DD'))
    returning id::text`;
  if (opened === undefined) throw new Error("no run");
  return {
    id: opened.id,
    close: async (): Promise<number> => {
      const [row] = await actAs(tx, "worker", () =>
        tx.unsafe<{ n: number }[]>(
          "select ops.close_ended_campaigns($1::uuid, 1::smallint) as n",
          [opened.id],
        ),
      );
      return Number(row?.n);
    },
  };
}

describe("L3C-T4 RG9 the worker closes a campaign at the end of its period + campaign_auto_close_days, not before", () => {
  it("L3C-T4 RG9 at ends_on + 30 days a published and a paused campaign close, by the system; at + 29 nothing; a passed deadline writes nothing (CA49)", async () => {
    const outcome = await scenario(async (tx) => {
      const due = await liveCampaign(tx, brandA, "published", -30);
      const duePaused = await liveCampaign(tx, brandB, "paused", -31);
      const early = await liveCampaign(tx, brandA, "published", -29);
      // CA49: the application deadline passed, the period not ended
      const deadline = await liveCampaign(tx, brandB, "published", 20, -3);
      const closure = await closureRun(tx);
      const count = await closure.close();
      const again = await closure.close();
      return {
        count,
        again,
        due: await cycleOf(tx, due),
        duePaused: await cycleOf(tx, duePaused),
        early: (await cycleOf(tx, early)).status,
        deadline: (await cycleOf(tx, deadline)).status,
        lines: await linesOf(tx, due),
        decisions: (await decisionsOf(tx)).filter(
          (q) => q.payload.campaign_id === due,
        ),
        earlyLines: (await linesOf(tx, early)).length,
      };
    });
    expect(outcome.count).toBeGreaterThanOrEqual(2);
    expect(outcome.again).toBe(0);
    expect(outcome.due).toMatchObject({ status: "closed", closed: true });
    expect(outcome.duePaused).toMatchObject({
      status: "closed",
      closed: true,
      paused: false,
    });
    expect(outcome.early).toBe("published");
    expect(outcome.deadline).toBe("published");
    expect(outcome.earlyLines).toBe(0);
    expect(outcome.lines).toEqual([
      {
        event_type: "campaign.closed",
        actor_type: "system",
        actor_account_id: null,
        payload: { origin: "system" },
      },
    ]);
    expect(outcome.decisions).toEqual([
      {
        event_type: "campaign.decision",
        destination: "brevo_transactional",
        payload: {
          event_id: expect.any(String),
          account_id: brandA,
          campaign_id: outcome.decisions[0]?.payload.campaign_id,
          email_code: "closed_automatically",
        },
        idempotency_key: `campaign.decision:${String(outcome.decisions[0]?.payload.campaign_id)}`,
      },
    ]);
  });

  it("L3C-T4 RG9 the delay is the parameter in table: at 10 days, a campaign ended 10 days ago closes", async () => {
    const outcome = await scenario(async (tx) => {
      await tx`
        update backoffice.operational_settings set value = '10'::jsonb
         where key = 'campaign_auto_close_days'`;
      const ended = await liveCampaign(tx, brandA, "published", -10);
      const recent = await liveCampaign(tx, brandA, "published", -9);
      const closure = await closureRun(tx);
      await closure.close();
      return {
        ended: (await cycleOf(tx, ended)).status,
        recent: (await cycleOf(tx, recent)).status,
      };
    });
    expect(outcome).toEqual({ ended: "closed", recent: "published" });
  });

  it("L3C-T4 RG9 the closure runs inside an open campaign_closure run only (55000), executed by influx_worker alone", async () => {
    const outcome = await scenario(async (tx) => {
      const outside = await actAs(tx, "worker", () =>
        run(tx, "select ops.close_ended_campaigns($1::uuid, 1::smallint)", [
          UNKNOWN,
        ]),
      );
      const [rights] = await tx<
        { worker: boolean; agent: boolean; admin: boolean; brand: boolean }[]
      >`
        select has_function_privilege('influx_worker', 'ops.close_ended_campaigns(uuid,smallint)', 'EXECUTE') as worker,
               has_function_privilege('influx_agent', 'ops.close_ended_campaigns(uuid,smallint)', 'EXECUTE') as agent,
               has_function_privilege('influx_admin', 'ops.close_ended_campaigns(uuid,smallint)', 'EXECUTE') as admin,
               has_function_privilege('influx_advertiser', 'ops.close_ended_campaigns(uuid,smallint)', 'EXECUTE') as brand`;
      return { outside, rights };
    });
    expect(outcome.outside).toEqual(refused(NOT_IN_PREREQUISITE_STATE));
    expect(outcome.rights).toEqual({
      worker: true,
      agent: false,
      admin: false,
      brand: false,
    });
  });
});

// ---------------------------------------------------------------------------------------------
// L3C-T4: the creation for a brand (RG1, RG94, CA61)
// ---------------------------------------------------------------------------------------------

describe("L3C-T4 RG1 CA61 an agent creates a draft for a brand that called him", () => {
  it("L3C-T4 CA61 the draft of the brand, its profile in any state: the intervention (brand_request), created_for_brand, the register line nominative", async () => {
    const outcome = await scenario(async (tx) => {
      await tx`
        update profiles.advertiser_profiles set status = 'draft' where account_id = ${brandB}`;
      const created = await createFor(tx, AGENT_A, brandB);
      if (created.outcome !== "rows") return { created };
      const campaign = created.rows[0]?.campaign_id ?? UNKNOWN;
      const [row] = await tx<
        {
          advertiser: string;
          status: string;
          title: string;
          type: string;
        }[]
      >`
        select advertiser_account_id::text as advertiser, status::text, title,
               campaign_type_code as type
          from campaigns.campaigns where id = ${campaign}`;
      return {
        created,
        row,
        interventions: await interventionsOf(tx, campaign),
        codes: (await decisionsOf(tx, brandB)).map((q) => [
          q.payload.email_code,
          q.payload.campaign_id === campaign,
        ]),
        lines: await linesOf(tx, campaign),
      };
    });
    expect(outcome.created).toEqual({
      outcome: "rows",
      rows: [
        {
          campaign_id: expect.any(String),
          intervention_id: expect.any(String),
        },
      ],
    });
    expect(outcome.row).toEqual({
      advertiser: brandB,
      status: "draft",
      title: "Winter collection launch",
      type: "product_review",
    });
    expect(outcome.interventions).toEqual([
      {
        kind: "created",
        field_code: null,
        old_value: null,
        new_value: {
          title: "Winter collection launch",
          campaignType: "product_review",
        },
        reason_code: "brand_request",
        internal_comment: null,
        agent_account_id: agentA,
        review_entry_id: null,
      },
    ]);
    expect(outcome.codes).toEqual([["created_for_brand", true]]);
    expect(outcome.lines).toEqual([
      expect.objectContaining({
        event_type: "campaign.created_for_brand",
        actor_account_id: agentA,
        payload: expect.objectContaining({ reason_code: "brand_request" }),
      }),
    ]);
  });

  it("L3C-T4 T14 the creation refused: an unknown account and a creator account alike (42501); a suspended brand, a retired type, no title", async () => {
    const outcome = await scenario(async (tx) => {
      const unknown = await createFor(tx, AGENT_A, UNKNOWN);
      const creator = await createFor(tx, AGENT_A, creatorA);
      const noTitle = await createFor(tx, AGENT_A, brandA, "  ");
      const unknownType = await createFor(
        tx,
        AGENT_A,
        brandA,
        "A title",
        "other",
      );
      await tx`
        update reference.campaign_types set retired_at = now() where code = 'contest'`;
      const retired = await createFor(
        tx,
        AGENT_A,
        brandA,
        "A title",
        "contest",
      );
      await tx`
        update identity.accounts set status = 'suspended', suspended_at = now()
         where id = ${brandB}`;
      const suspended = await createFor(tx, AGENT_A, brandB);
      return { unknown, creator, noTitle, unknownType, retired, suspended };
    });
    expect(outcome.unknown).toEqual(
      refused(INSUFFICIENT_PRIVILEGE, "forbidden"),
    );
    expect(outcome.creator).toEqual(outcome.unknown);
    expect(outcome.noTitle).toEqual(refused(INVALID_PARAMETER, "title"));
    expect(outcome.unknownType).toEqual(
      refused(INVALID_PARAMETER, "campaign_type"),
    );
    expect(outcome.retired).toEqual(
      refused(INVALID_PARAMETER, "campaign_type"),
    );
    expect(outcome.suspended).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "brand_not_active"),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// L3C-T4: the correction of a field (RG94, CA60; modele §6)
// ---------------------------------------------------------------------------------------------

describe("L3C-T4 RG94 CA60 an agent corrects a field, its old and new value, a reason, the brand told", () => {
  it("L3C-T4 CA60 the product category of a draft corrected: old and new value kept, reason and comment, corrected e-mail, the register without the values", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      const corrected = await correct(
        tx,
        AGENT_A,
        "product_sector",
        "fashion_accessories",
      );
      return {
        corrected,
        sector: (
          await tx<{ sector_code: string }[]>`
            select sector_code from campaigns.campaigns where id = ${campaignA}`
        )[0]?.sector_code,
        interventions: await interventionsOf(tx),
        decisions: await decisionsOf(tx),
        lines: await linesOf(tx),
      };
    });
    expect(outcome.corrected).toEqual({
      outcome: "rows",
      rows: [{ intervention_id: expect.any(String), review_token: null }],
    });
    const id =
      outcome.corrected.outcome === "rows"
        ? outcome.corrected.rows[0]?.intervention_id
        : undefined;
    expect(outcome.sector).toBe("fashion_accessories");
    expect(outcome.interventions).toEqual([
      {
        kind: "corrected",
        field_code: "product_sector",
        old_value: "sports_leisure",
        new_value: "fashion_accessories",
        reason_code: "entry_error",
        internal_comment: COMMENT,
        agent_account_id: agentA,
        review_entry_id: null,
      },
    ]);
    expect(outcome.decisions).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({
          email_code: "corrected",
          intervention_id: id,
        }),
        idempotency_key: `campaign.decision:${id}`,
      }),
    ]);
    expect(outcome.lines).toEqual([
      {
        event_type: "campaign.corrected",
        actor_type: "agent",
        actor_account_id: agentA,
        payload: {
          intervention_id: id,
          field_code: "product_sector",
          reason_code: "entry_error",
        },
      },
    ]);
    expect(JSON.stringify(outcome.lines)).not.toContain("fashion_accessories");
  });

  it("L3C-T4 a list is replaced in a block; a change of currency empties both bands, kept in the old value", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      const messages = await correct(tx, ADMIN_A, "key_messages", [
        "Light and solid",
        "Set up in two minutes",
      ]);
      const currency = await correct(tx, ADMIN_A, "currency", "USD");
      const [row] = await tx<
        { currency: string; budget: string | null; messages: string[] }[]
      >`
        select c.currency, c.per_creator_budget_band_code as budget,
               array(select m.body from campaigns.campaign_key_messages m
                      where m.campaign_id = c.id order by m.position) as messages
          from campaigns.campaigns c where c.id = ${campaignA}`;
      return {
        messages: messages.outcome,
        currency: currency.outcome,
        row,
        // one transaction, one instant: ordered by field
        values: (await interventionsOf(tx))
          .map((i) => [i.field_code, i.old_value, i.new_value])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      };
    });
    expect(outcome.messages).toBe("rows");
    expect(outcome.currency).toBe("rows");
    expect(outcome.row).toEqual({
      currency: "USD",
      budget: null,
      messages: ["Light and solid", "Set up in two minutes"],
    });
    expect(outcome.values[1]?.[0]).toBe("key_messages");
    expect(outcome.values[1]?.[2]).toEqual([
      "Light and solid",
      "Set up in two minutes",
    ]);
    expect(outcome.values[0]).toEqual([
      "currency",
      { currency: "EUR", productValueBand: null, budgetBand: "500_1000" },
      { currency: "USD", productValueBand: null, budgetBand: null },
    ]);
  });

  it("L3C-T4 Q1 the correction refused outside draft, rejected and a held pending campaign: published, paused, closed (55000 campaign_not_correctable)", async () => {
    const outcome = await scenario(async (tx) => {
      await liveA(tx);
      const published = await correct(tx, AGENT_A, "title", "Another title");
      await brandPassage(tx, "pause_own_campaign");
      const paused = await correct(tx, AGENT_A, "title", "Another title");
      await brandPassage(tx, "close_own_campaign");
      const closed = await correct(tx, AGENT_A, "title", "Another title");
      return {
        published,
        paused,
        closed,
        title: (await cycleOf(tx)).title,
        interventions: (await interventionsOf(tx)).length,
      };
    });
    expect(outcome).toEqual({
      published: refused(
        NOT_IN_PREREQUISITE_STATE,
        "campaign_not_correctable",
        "published",
      ),
      paused: refused(
        NOT_IN_PREREQUISITE_STATE,
        "campaign_not_correctable",
        "paused",
      ),
      closed: refused(
        NOT_IN_PREREQUISITE_STATE,
        "campaign_not_correctable",
        "closed",
      ),
      title: "Summer outdoor kit",
      interventions: 0,
    });
  });

  it("L3C-T4 modele §6 a pending campaign is corrected by the holder of its live claim only: a new token, the entry named", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedA(tx);
      const unclaimed = await correct(
        tx,
        AGENT_A,
        "title",
        "A corrected title",
      );
      const token = await claim(tx, AGENT_A, entry);
      const other = await correct(tx, AGENT_B, "title", "A corrected title");
      const held = await correct(tx, AGENT_A, "title", "A corrected title");
      return {
        unclaimed,
        other,
        held,
        token,
        interventions: await interventionsOf(tx),
        entry,
      };
    });
    expect(outcome.unclaimed).toEqual(
      refused(LOCK_NOT_AVAILABLE, "no_live_claim", "none"),
    );
    expect(outcome.other).toEqual(
      refused(LOCK_NOT_AVAILABLE, "no_live_claim", agentA),
    );
    expect(outcome.held).toEqual({
      outcome: "rows",
      rows: [
        {
          intervention_id: expect.any(String),
          review_token: expect.any(String),
        },
      ],
    });
    if (outcome.held.outcome === "rows") {
      expect(outcome.held.rows[0]?.review_token).not.toBe(outcome.token);
    }
    expect(outcome.interventions).toEqual([
      expect.objectContaining({
        field_code: "title",
        old_value: "Summer outdoor kit",
        new_value: "A corrected title",
        review_entry_id: outcome.entry,
      }),
    ]);
  });

  it("L3C-T4 modele §3 D84 after a second opinion is asked, the correction is refused to its requester who took the entry back and to a colleague (55000 first_review_given)", async () => {
    const outcome = await scenario(async (tx) => {
      const entry = await submittedA(tx, { sector_code: "alcohol" }, "en");
      const token = await claim(tx, AGENT_A, entry);
      await call(
        tx,
        AGENT_A,
        "select campaigns.first_review_campaign_entry($1::uuid, $2::text, $3::text)",
        [
          entry,
          token,
          "Autorisations vérifiées, déclaration conforme aux pays.",
        ],
      );
      // D84: the requester is no longer refused; he takes the claim back, the correction stays refused
      await claim(tx, AGENT_A, entry);
      const firstReviewer = await correct(tx, AGENT_A, "title", "A new title");
      await call(
        tx,
        AGENT_A,
        "select campaigns.release_campaign_review_entry($1::uuid)",
        [entry],
      );
      await claim(tx, AGENT_B, entry);
      const second = await correct(tx, AGENT_B, "title", "A new title");
      return { firstReviewer, second };
    });
    expect(outcome.firstReviewer).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "first_review_given"),
    );
    expect(outcome.second).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "first_review_given"),
    );
  });

  it("L3C-T4 T14 the correction of a pending campaign of a held account answers as an unknown campaign (42501)", async () => {
    const outcome = await scenario(async (tx) => {
      await submittedA(tx);
      await tx`update identity.accounts set owner_agent_id = ${agentA} where id = ${brandA}`;
      const held = await correct(tx, AGENT_A, "title", "A new title");
      const unknown = await correct(
        tx,
        AGENT_A,
        "title",
        "A new title",
        "entry_error",
        COMMENT,
        UNKNOWN,
      );
      return { held, unknown };
    });
    expect(outcome.unknown).toEqual(
      refused(INSUFFICIENT_PRIVILEGE, "forbidden"),
    );
    expect(outcome.held).toEqual(outcome.unknown);
  });

  it("L3C-T4 the correction refused: the state or the declaration as a field, a value of the wrong type, no change, a constraint of the campaign", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      return {
        status: await correct(tx, AGENT_A, "status", "published"),
        declaration: await correct(
          tx,
          AGENT_A,
          "authorizations_declaration_hash",
          "00",
        ),
        wrongType: await correct(tx, AGENT_A, "creators_wanted", "three"),
        badDate: await correct(tx, AGENT_A, "ends_on", "2026-02-30"),
        unchanged: await correct(tx, AGENT_A, "title", "Summer outdoor kit"),
        tooLong: await correct(tx, AGENT_A, "title", "t".repeat(141)),
        noReason: await correct(tx, AGENT_A, "title", "A title", "typo"),
        interventions: (await interventionsOf(tx)).length,
      };
    });
    expect(outcome).toEqual({
      status: refused(INVALID_PARAMETER, "field_code"),
      declaration: refused(INVALID_PARAMETER, "field_code"),
      wrongType: refused(INVALID_PARAMETER, "value"),
      badDate: refused(INVALID_PARAMETER, "value"),
      unchanged: refused(INVALID_PARAMETER, "unchanged"),
      tooLong: refused(CHECK_VIOLATION),
      noReason: refused(INVALID_PARAMETER, "reason"),
      interventions: 0,
    });
  });
});

// ---------------------------------------------------------------------------------------------
// L3C-T4: the line of an intervention, the reads, the record
// ---------------------------------------------------------------------------------------------

describe("L3C-T4 the interventions are immutable and read without their comment; the record read is journalled", () => {
  it("L3C-T4 an intervention never changes: its owner holds no UPDATE, and the trigger refuses even a granted writer (55000 intervention_immutable)", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      await correct(tx, AGENT_A, "title", "A corrected title");
      const [rights] = await tx<{ update: boolean; delete: boolean }[]>`
        select has_table_privilege('influx_campaign_review_definer', 'campaigns.agent_interventions', 'UPDATE') as update,
               has_table_privilege('influx_campaign_review_definer', 'campaigns.agent_interventions', 'DELETE') as delete`;
      await tx.unsafe(
        "grant update (reason_code) on campaigns.agent_interventions to influx_campaign_review_definer",
      );
      await tx.unsafe(
        "create policy l3c_t4_witness on campaigns.agent_interventions " +
          "to influx_campaign_review_definer using (true) with check (true)",
      );
      await tx.unsafe("set local role influx_campaign_review_definer");
      // no WHERE: the owner reads no column it would filter on
      const change = await run(
        tx,
        "update campaigns.agent_interventions set reason_code = 'other'",
      );
      await tx.unsafe("reset role");
      return { rights, change };
    });
    expect(outcome.rights).toEqual({ update: false, delete: false });
    expect(outcome.change).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "intervention_immutable"),
    );
  });

  it("L3C-T4 agent and admin read the interventions and the cycle, never the comment; the brand reads no intervention", async () => {
    const outcome = await scenario(async (tx) => {
      await liveA(tx);
      await agentPassage(
        tx,
        AGENT_A,
        "pause_campaign",
        campaignA,
        "other",
        COMMENT,
      );
      const agentRead = await call<{ kind: string; reason_code: string }>(
        tx,
        AGENT_B,
        "select kind, reason_code from campaigns.agent_interventions where campaign_id = $1::uuid",
        [campaignA],
      );
      const agentComment = await call(
        tx,
        AGENT_B,
        "select internal_comment from campaigns.agent_interventions",
        [],
      );
      const agentCycle = await call<{ pause_origin: string; paused: boolean }>(
        tx,
        ADMIN_A,
        "select pause_origin, paused_at is not null as paused from campaigns.campaigns where id = $1::uuid",
        [campaignA],
      );
      const brandCycle = await asBrand(tx, brandA, () =>
        run<{ pause_origin: string }>(
          tx,
          "select pause_origin from campaigns.campaigns where id = $1::uuid",
          [campaignA],
        ),
      );
      const brandRead = await asBrand(tx, brandA, () =>
        run(tx, "select id from campaigns.agent_interventions", []),
      );
      return { agentRead, agentComment, agentCycle, brandCycle, brandRead };
    });
    expect(outcome.agentRead).toEqual({
      outcome: "rows",
      rows: [{ kind: "paused", reason_code: "other" }],
    });
    expect(outcome.agentComment).toEqual(refused(INSUFFICIENT_PRIVILEGE));
    expect(outcome.agentCycle).toEqual({
      outcome: "rows",
      rows: [{ pause_origin: "influx", paused: true }],
    });
    expect(outcome.brandCycle).toEqual({
      outcome: "rows",
      rows: [{ pause_origin: "influx" }],
    });
    expect(outcome.brandRead).toEqual(refused(INSUFFICIENT_PRIVILEGE));
  });

  it("L3C-T4 the record of a campaign is opened with campaign.record_read in the transaction; an unknown campaign answers 42501", async () => {
    const outcome = await scenario(async (tx) => {
      const opened = await call(
        tx,
        AGENT_A,
        "select campaigns.open_campaign_record($1::uuid)",
        [campaignB],
      );
      const unknown = await call(
        tx,
        AGENT_A,
        "select campaigns.open_campaign_record($1::uuid)",
        [UNKNOWN],
      );
      return {
        opened: opened.outcome,
        unknown,
        lines: await linesOf(tx, campaignB),
      };
    });
    expect(outcome.opened).toBe("rows");
    expect(outcome.unknown).toEqual(
      refused(INSUFFICIENT_PRIVILEGE, "forbidden"),
    );
    expect(outcome.lines).toEqual([
      {
        event_type: "campaign.record_read",
        actor_type: "agent",
        actor_account_id: agentA,
        payload: {},
      },
    ]);
  });
});

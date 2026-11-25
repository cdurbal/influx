// L3C commit 03 — the decisions of queue 7: the publication and its snapshot, the enhanced review
// (one person, a second opinion optional: D84, 0313), the typed refusal, the e-mail and the lead
// queued in the transaction (0308, 0313; docs/mvp/09 RG5, RG15, RG85, RG89, RG90, RG92, RG93, RG103,
// CA5, CA48, CA56, CA57, CA59, CA69; 18 TM5.1, TM5.6; jalons/l3c/modele.md §2 to §4, §8, "Amendement
// D84"; fiche invariants 1 to 6, 8, 10).
//   L3C-T3  TM5.1 and CA5 (published written by the decision of a holder only); the snapshot is
//           campaign_creator_view(), versioned, hashed (TM5.6, doubled by a CHECK); the responsible
//           salesperson; CA48; a brand not publishable; RG15 read again; CA56, CA57 amended by D84
//           (one person publishes, agent or admin; a second opinion asked is read by all, decided by
//           a colleague or taken back by its requester; review_mode and requester in the register);
//           CA59; the stale token; T14; campaign.published, the decision e-mail and the lead in the
//           transaction of the decision, ids only.
// Each case runs in a rolled-back transaction of the local superuser, which acts as apps/api does
// (support.ts: actAsMember, actAsInternal).
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
const agentA = accountIdOf("agent", "a");
const agentB = accountIdOf("agent", "b");
const adminA = accountIdOf("admin", "a");
const campaignA = CAMPAIGN_IDS.a;
const UNKNOWN_ENTRY = "00000000-0000-4000-8000-0000000fffff";

const OPINION =
  "Autorisations vérifiées pour les pays visés, déclaration conforme.";
const INTERNAL_MARKER = "l3c-t3-internal-comment-marker";
const MESSAGE =
  "Votre campagne doit être reprise avant toute nouvelle soumission.";

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

function asInternal<T>(
  tx: Tx,
  who: Internal,
  fn: () => Promise<T>,
  aal: "aal1" | "aal2" = "aal2",
): Promise<T> {
  return actAsInternal(
    tx,
    who.role === "agent" ? "influx_agent" : "influx_admin",
    { accountId: who.account, role: who.role, aal },
    fn,
  );
}

function call<T>(
  tx: Tx,
  who: Internal,
  statement: string,
  parameters: readonly Parameter[],
  aal: "aal1" | "aal2" = "aal2",
): Promise<Outcome<T>> {
  return asInternal(tx, who, () => run<T>(tx, statement, parameters), aal);
}

// the calls --------------------------------------------------------------------------------------

const OPEN = "select * from campaigns.open_campaign_review_entry($1::uuid)";
const PUBLISH =
  "select * from campaigns.publish_campaign_review_entry($1::uuid, $2::text, $3::uuid, $4::text)";
const REJECT =
  "select * from campaigns.reject_campaign_review_entry($1::uuid, $2::text, $3::text, $4::text, $5::text)";
const FIRST_REVIEW =
  "select campaigns.first_review_campaign_entry($1::uuid, $2::text, $3::text) as at";

type Published = {
  decided_at: Date;
  sla_breached: boolean;
  snapshot_version: number;
  first_publication: boolean;
};

/** `who` opens (claims) the entry: the version token. */
async function claim(tx: Tx, who: Internal, entry: string): Promise<string> {
  const [opened] = await asInternal(tx, who, () =>
    rows<{ outcome: string; review_token: string | null }>(tx, OPEN, [entry]),
  );
  if (opened?.review_token === null || opened === undefined) {
    throw new Error(`no claim: ${opened?.outcome ?? "none"}`);
  }
  return opened.review_token;
}

function publish(
  tx: Tx,
  who: Internal,
  entry: string,
  token: string | null,
  owner: string | null = agentB,
  comment: string | null = null,
): Promise<Outcome<Published>> {
  return call<Published>(tx, who, PUBLISH, [entry, token, owner, comment]);
}

function reject(
  tx: Tx,
  who: Internal,
  entry: string,
  token: string | null,
  reason: string,
  message: string | null = null,
  comment: string | null = null,
): Promise<Outcome<{ decided_at: Date; sla_breached: boolean }>> {
  return call(tx, who, REJECT, [entry, token, reason, message, comment]);
}

// the fixtures -----------------------------------------------------------------------------------

/** Completes the draft of brand A (the data set holds one row in each list) and publishes its profile. */
async function readyA(
  tx: Tx,
  overrides: Readonly<Record<string, string | number | boolean | null>> = {},
): Promise<void> {
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

/** Brand A ready (sensitive with a locale), campaign A submitted: the id of its open entry. */
async function submittedA(
  tx: Tx,
  overrides: Readonly<Record<string, string | number | boolean | null>> = {},
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

/** A sensitive campaign A (alcohol, declaration in English) submitted: its entry. */
function sensitiveA(tx: Tx): Promise<string> {
  return submittedA(tx, { sector_code: "alcohol" }, "en");
}

type CampaignState = {
  status: string;
  owner_agent_id: string | null;
  has_snapshot: boolean;
  first_published: boolean;
};

async function campaignOfA(tx: Tx): Promise<CampaignState> {
  const [row] = await tx<CampaignState[]>`
    select status::text, owner_agent_id::text, current_snapshot_id is not null as has_snapshot,
           first_published_at is not null as first_published
      from campaigns.campaigns where id = ${campaignA}`;
  if (row === undefined) throw new Error("no campaign");
  return row;
}

type Snapshot = {
  version: number;
  payload: Record<string, unknown>;
  hash_ok: boolean;
  published_by: string;
  first_reviewed_by: string | null;
  review_entry_id: string;
  current: boolean;
};

async function snapshotsOfA(tx: Tx): Promise<Snapshot[]> {
  return tx<Snapshot[]>`
    select s.version, s.payload,
           s.content_hash = sha256(convert_to(s.payload::text, 'UTF8')) as hash_ok,
           s.published_by_account_id::text as published_by,
           s.first_reviewed_by_account_id::text as first_reviewed_by,
           s.review_entry_id::text as review_entry_id,
           c.current_snapshot_id = s.id as current
      from campaigns.campaign_published_snapshots s
      join campaigns.campaigns c on c.id = s.campaign_id
     where s.campaign_id = ${campaignA}
     order by s.version`;
}

type Entry = {
  state: string;
  decided_by: string | null;
  reason: string | null;
  message: string | null;
  comment: string | null;
  first_reviewed_by: string | null;
  opinion: string | null;
  claimed_by: string | null;
};

async function entry(tx: Tx, id: string): Promise<Entry> {
  const [row] = await tx<Entry[]>`
    select state::text, decided_by_account_id::text as decided_by,
           rejection_reason_code as reason, member_message as message,
           internal_comment as comment, first_reviewed_by_account_id::text as first_reviewed_by,
           first_review_opinion as opinion, claimed_by_account_id::text as claimed_by
      from campaigns.campaign_review_entries where id = ${id}`;
  if (row === undefined) throw new Error("no entry");
  return row;
}

type Queued = {
  event_type: string;
  destination: string;
  payload: Record<string, unknown>;
  idempotency_key: string;
};

async function queuedForA(tx: Tx): Promise<Queued[]> {
  return tx<Queued[]>`
    select event_type, destination::text, payload, idempotency_key
      from leads.outbox_events
     where subject_key = ${`account:${brandA}`}
       and event_type in ('campaign.decision', 'campaign.published')
     order by event_type, destination`;
}

type RegisterLine = {
  event_type: string;
  actor_account_id: string | null;
  payload: Record<string, unknown>;
};

async function campaignLines(tx: Tx): Promise<RegisterLine[]> {
  return tx<RegisterLine[]>`
    select event_type, actor_account_id::text as actor_account_id, payload
      from audit.audit_events
     where subject_type = 'campaign' and subject_id = ${campaignA}
       and event_type in ('campaign.published', 'campaign.rejected', 'campaign.first_reviewed')
     order by seq`;
}

/** Nothing of a decision was written for campaign A. */
async function nothingDecided(tx: Tx, id: string): Promise<unknown> {
  return {
    campaign: (await campaignOfA(tx)).status,
    entry: (await entry(tx, id)).state,
    snapshots: (await snapshotsOfA(tx)).length,
    queued: (await queuedForA(tx)).length,
    lines: (await campaignLines(tx)).length,
  };
}

const UNTOUCHED = {
  campaign: "pending_review",
  entry: "open",
  snapshots: 0,
  queued: 0,
  lines: 0,
};

// ---------------------------------------------------------------------------------------------
// L3C-T3: TM5.1, CA5 — the publication by the holder of a live claim
// ---------------------------------------------------------------------------------------------

describe("L3C-T3 TM5.1 a campaign is published by the decision of an agent only (09 RG5, CA5)", () => {
  it("L3C-T3 TM5.1 the holder publishes: the campaign published with its owner, snapshot v1, the entry decided", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      const token = await claim(tx, AGENT_A, id);
      const published = await publish(
        tx,
        AGENT_A,
        id,
        token,
        agentB,
        INTERNAL_MARKER,
      );
      const snapshots = await snapshotsOfA(tx);
      return {
        published,
        campaign: await campaignOfA(tx),
        entry: await entry(tx, id),
        snapshots: snapshots.map((s) => ({
          version: s.version,
          published_by: s.published_by,
          first_reviewed_by: s.first_reviewed_by,
          review_entry_id: s.review_entry_id === id,
          current: s.current,
        })),
      };
    });
    expect(outcome.published).toEqual({
      outcome: "rows",
      rows: [
        expect.objectContaining({
          sla_breached: false,
          snapshot_version: 1,
          first_publication: true,
        }),
      ],
    });
    expect(outcome.campaign).toEqual({
      status: "published",
      owner_agent_id: agentB,
      has_snapshot: true,
      first_published: true,
    });
    expect(outcome.entry).toMatchObject({
      state: "published",
      decided_by: agentA,
      reason: null,
      message: null,
      comment: INTERNAL_MARKER,
    });
    expect(outcome.snapshots).toEqual([
      {
        version: 1,
        published_by: agentA,
        first_reviewed_by: null,
        review_entry_id: true,
        current: true,
      },
    ]);
  });

  it("L3C-T3 TM5.1 CA5 no other writer of published: the brand, an agent directly, a state without snapshot", async () => {
    const outcome = await scenario(async (tx) => {
      await submittedA(tx);
      const brand = await asBrand(tx, brandA, () =>
        run(
          tx,
          "update campaigns.campaigns set status = 'published' where id = $1::uuid",
          [campaignA],
        ),
      );
      const agent = await call(
        tx,
        AGENT_A,
        "update campaigns.campaigns set status = 'published' where id = $1::uuid",
        [campaignA],
      );
      // even the migration role: published without a snapshot is refused by the base
      const bare = await run(
        tx,
        "update campaigns.campaigns set status = 'published' where id = $1::uuid",
        [campaignA],
      );
      return { brand, agent, bare, status: (await campaignOfA(tx)).status };
    });
    expect(outcome).toEqual({
      brand: refused(INSUFFICIENT_PRIVILEGE),
      agent: refused(INSUFFICIENT_PRIVILEGE),
      bare: refused(CHECK_VIOLATION),
      status: "pending_review",
    });
  });

  it("L3C-T3 TM5.1 no decision without the caller's live claim: another holder, an expired claim, no claim (55P03), nothing written", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      const unclaimed = await publish(tx, AGENT_B, id, "x");
      const token = await claim(tx, AGENT_A, id);
      const other = await publish(tx, AGENT_B, id, token);
      await tx`
        update campaigns.campaign_review_entries
           set claimed_at = now() - interval '2 hours', claim_expires_at = now() - interval '1 minute'
         where id = ${id}`;
      const expired = await publish(tx, AGENT_A, id, token);
      const rejectExpired = await reject(
        tx,
        AGENT_A,
        id,
        token,
        "brief_insufficient",
      );
      return {
        unclaimed,
        other,
        expired,
        rejectExpired,
        state: await nothingDecided(tx, id),
      };
    });
    expect(outcome).toEqual({
      unclaimed: refused(LOCK_NOT_AVAILABLE, "no_live_claim", "none"),
      other: refused(LOCK_NOT_AVAILABLE, "no_live_claim", agentA),
      expired: refused(LOCK_NOT_AVAILABLE, "no_live_claim", "none"),
      rejectExpired: refused(LOCK_NOT_AVAILABLE, "no_live_claim", "none"),
      state: UNTOUCHED,
    });
  });

  it("L3C-T3 a stale token (the campaign changed since the opening): 55000 stale_token for both decisions, nothing written", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      const token = await claim(tx, AGENT_A, id);
      await tx`update campaigns.campaigns set title = 'Summer outdoor kit 2' where id = ${campaignA}`;
      return {
        publish: await publish(tx, AGENT_A, id, token),
        reject: await reject(tx, AGENT_A, id, token, "brief_insufficient"),
        none: await publish(tx, AGENT_A, id, null),
        state: await nothingDecided(tx, id),
      };
    });
    expect(outcome).toEqual({
      publish: refused(NOT_IN_PREREQUISITE_STATE, "stale_token", "stale_token"),
      reject: refused(NOT_IN_PREREQUISITE_STATE, "stale_token", "stale_token"),
      none: refused(NOT_IN_PREREQUISITE_STATE, "stale_token", "stale_token"),
      state: UNTOUCHED,
    });
  });

  it("L3C-T3 T14 an unknown entry, an entry of a held account and a member answer the same 42501 forbidden", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      const unknown = await publish(tx, AGENT_A, UNKNOWN_ENTRY, "x");
      await tx`update identity.accounts set owner_agent_id = ${agentA} where id = ${brandA}`;
      const held = await publish(tx, AGENT_A, id, "x");
      const heldReject = await reject(
        tx,
        AGENT_A,
        id,
        "x",
        "brief_insufficient",
      );
      const aal1 = await call(
        tx,
        AGENT_B,
        PUBLISH,
        [id, "x", agentB, null],
        "aal1",
      );
      const member = await asBrand(tx, brandA, () =>
        run(tx, PUBLISH, [id, "x", agentB, null]),
      );
      return { unknown, held, heldReject, aal1, member };
    });
    expect(outcome.unknown).toEqual(
      refused(INSUFFICIENT_PRIVILEGE, "forbidden"),
    );
    expect(outcome.held).toEqual(outcome.unknown);
    expect(outcome.heldReject).toEqual(outcome.unknown);
    expect(outcome.aal1).toEqual(refused(INSUFFICIENT_PRIVILEGE, "forbidden"));
    expect(outcome.member).toEqual(refused(INSUFFICIENT_PRIVILEGE));
  });

  it("L3C-T3 the responsible salesperson is required: none, a brand account, an inactive agent (22023 owner_agent)", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      const token = await claim(tx, AGENT_A, id);
      const none = await publish(tx, AGENT_A, id, token, null);
      const brand = await publish(tx, AGENT_A, id, token, brandA);
      await tx`
        update identity.agent_profiles
           set is_active = false, deactivated_at = now(), deactivated_by_account_id = ${adminA}
         where account_id = ${agentB}`;
      const inactive = await publish(tx, AGENT_A, id, token, agentB);
      // an admin is an internal account: accepted
      const admin = await publish(tx, AGENT_A, id, token, adminA);
      return {
        none,
        brand,
        inactive,
        admin,
        owner: (await campaignOfA(tx)).owner_agent_id,
      };
    });
    expect(outcome).toMatchObject({
      none: refused(INVALID_PARAMETER, "owner_agent", "owner_agent"),
      brand: refused(INVALID_PARAMETER, "owner_agent", "owner_agent"),
      inactive: refused(INVALID_PARAMETER, "owner_agent", "owner_agent"),
      admin: { outcome: "rows" },
      owner: adminA,
    });
  });

  it("L3C-T3 CA48 an application deadline passed is never published (55000 calendar_passed); refused with calendar_invalid", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      await tx`
        update campaigns.campaigns set applications_close_on = ${civilDateIn(-1)}::date
         where id = ${campaignA}`;
      const token = await claim(tx, AGENT_A, id);
      const published = await publish(tx, AGENT_A, id, token);
      const rejected = await reject(tx, AGENT_A, id, token, "calendar_invalid");
      return { published, rejected, entry: (await entry(tx, id)).state };
    });
    expect(outcome).toMatchObject({
      published: refused(
        NOT_IN_PREREQUISITE_STATE,
        "calendar_passed",
        "calendar_passed",
      ),
      rejected: { outcome: "rows" },
      entry: "rejected",
    });
  });

  it("L3C-T3 CA48 the deadline of today is still open: the campaign is published", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      await tx`
        update campaigns.campaigns set applications_close_on = ${civilDateIn(0)}::date
         where id = ${campaignA}`;
      const token = await claim(tx, AGENT_A, id);
      return publish(tx, AGENT_A, id, token);
    });
    expect(outcome).toMatchObject({ outcome: "rows" });
  });

  it("L3C-T3 a brand profile no longer published or an account suspended: 55000 brand_not_publishable", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      const token = await claim(tx, AGENT_A, id);
      await tx`
        update profiles.advertiser_profiles set status = 'suspended' where account_id = ${brandA}`;
      const profile = await publish(tx, AGENT_A, id, token);
      await tx`
        update profiles.advertiser_profiles set status = 'published' where account_id = ${brandA}`;
      await tx`
        update identity.accounts set status = 'suspended', suspended_at = now() where id = ${brandA}`;
      const account = await publish(tx, AGENT_A, id, token);
      return { profile, account, state: await nothingDecided(tx, id) };
    });
    expect(outcome).toEqual({
      profile: refused(
        NOT_IN_PREREQUISITE_STATE,
        "brand_not_publishable",
        "brand_not_publishable",
      ),
      account: refused(
        NOT_IN_PREREQUISITE_STATE,
        "brand_not_publishable",
        "brand_not_publishable",
      ),
      state: UNTOUCHED,
    });
  });

  it("L3C-T3 RG15 read again at the publication: at the cap, 55000 live_campaign_cap with the campaigns to close", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      await tx`
        update backoffice.operational_settings set value = '1'::jsonb where key = 'campaign_live_cap'`;
      const [other] = await tx<{ id: string }[]>`
        insert into campaigns.campaigns
          (advertiser_account_id, title, campaign_type_code, public_summary, brief,
           product_description, sector_code, product_is_sent, usage_rights_code,
           usage_rights_duration_band, usage_rights_territory_scope, exclusivity_band,
           content_review_delay, currency, remuneration_kind, per_creator_budget_band_code,
           creators_wanted, applications_close_on, starts_on, ends_on, submitted_at)
        values (${brandA}, 'Another campaign', 'product_placement', ${"s".repeat(120)},
                ${"b".repeat(300)}, 'A light tent for two', 'sports_leisure', false,
                'organic_repost', '3m', 'worldwide', 'none', '5bd', 'EUR', 'cash', '500_1000', 3,
                ${CALENDAR.applicationsCloseOn}, ${CALENDAR.startsOn}, ${CALENDAR.endsOn}, now())
        returning id::text`;
      if (other === undefined) throw new Error("no campaign");
      await publishAsInflux(tx, other.id);
      const token = await claim(tx, AGENT_A, id);
      return {
        published: await publish(tx, AGENT_A, id, token),
        other: other.id,
      };
    });
    expect(outcome.published).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "live_campaign_cap", outcome.other),
    );
  });

  it("L3C-T3 a later publication writes version 2, keeps first_published_at and queues no second lead", async () => {
    const outcome = await scenario(async (tx) => {
      const first = await submittedA(tx);
      await publish(tx, AGENT_A, first, await claim(tx, AGENT_A, first));
      // one transaction has one now(): the first publication is dated in the past to tell them apart
      await tx`
        update campaigns.campaigns set first_published_at = '2026-01-02T03:04:05Z'
         where id = ${campaignA}`;
      // back in queue 7 (the path of RG7 comes later): the state and a new entry, as the base
      await tx`update campaigns.campaigns set status = 'pending_review' where id = ${campaignA}`;
      const [second] = await tx<{ id: string }[]>`
        insert into campaigns.campaign_review_entries (campaign_id, advertiser_account_id)
        values (${campaignA}, ${brandA}) returning id::text`;
      if (second === undefined) throw new Error("no entry");
      const again = await publish(
        tx,
        AGENT_B,
        second.id,
        await claim(tx, AGENT_B, second.id),
      );
      const [{ kept } = { kept: false }] = await tx<{ kept: boolean }[]>`
        select first_published_at = '2026-01-02T03:04:05Z'::timestamptz as kept
          from campaigns.campaigns where id = ${campaignA}`;
      return {
        again,
        kept,
        versions: (await snapshotsOfA(tx)).map((s) => [s.version, s.current]),
        queued: (await queuedForA(tx)).map(
          (q) => `${q.event_type}>${q.destination}`,
        ),
      };
    });
    expect(outcome).toEqual({
      again: {
        outcome: "rows",
        rows: [
          expect.objectContaining({
            snapshot_version: 2,
            first_publication: false,
          }),
        ],
      },
      kept: true,
      versions: [
        [1, false],
        [2, true],
      ],
      queued: [
        "campaign.decision>brevo_transactional",
        "campaign.decision>brevo_transactional",
        "campaign.published>apollo_contact",
        "campaign.published>brevo_contact",
      ],
    });
  });
});

// ---------------------------------------------------------------------------------------------
// L3C-T3: TM5.6 — the snapshot is the creator view
// ---------------------------------------------------------------------------------------------

describe("L3C-T3 TM5.6 the snapshot is campaign_creator_view() at the decision (D78, modele §2)", () => {
  it("L3C-T3 TM5.6 the payload equals the creator view at the decision, its hash the SHA-256 of its text", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      const [{ view } = { view: null }] = await tx<
        { view: Record<string, unknown> }[]
      >`
        select campaigns.campaign_creator_view(${campaignA}::uuid) as view`;
      await publish(tx, AGENT_A, id, await claim(tx, AGENT_A, id));
      const [snapshot] = await snapshotsOfA(tx);
      return { view, snapshot };
    });
    expect(outcome.snapshot?.payload).toEqual(outcome.view);
    expect(outcome.snapshot?.hash_ok).toBe(true);
  });

  it("L3C-T3 TM5.6 the snapshot holds neither the currency, a band, the total budget, the internal reference nor the declaration", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(
        tx,
        {
          sector_code: "alcohol",
          internal_reference: "REF-L3C-T3",
          total_budget_minor: 987654,
        },
        "fr",
      );
      await call(tx, AGENT_A, FIRST_REVIEW, [
        id,
        await claim(tx, AGENT_A, id),
        OPINION,
      ]);
      await publish(tx, AGENT_B, id, await claim(tx, AGENT_B, id));
      const [snapshot] = await snapshotsOfA(tx);
      return snapshot?.payload ?? {};
    });
    const text = JSON.stringify(outcome);
    for (const marker of ["REF-L3C-T3", "987654", "500_1000", "EUR"]) {
      expect(text, marker).not.toContain(marker);
    }
    expect(Object.keys(outcome)).not.toEqual(
      expect.arrayContaining(["currency"]),
    );
    expect(Object.keys(outcome)).toHaveLength(32);
  });

  it("L3C-T3 TM5.6 the base refuses a snapshot carrying an internal key (CHECK campaign_published_snapshots_no_internal_keys)", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      const attempts: Record<string, unknown> = {};
      for (const key of [
        "currency",
        "totalBudgetMinor",
        "internalReference",
        "perCreatorBudgetBand",
      ]) {
        attempts[key] = await run(
          tx,
          "insert into campaigns.campaign_published_snapshots " +
            "(campaign_id, version, payload, content_hash, published_at, published_by_account_id, review_entry_id) " +
            "values ($1::uuid, 1, jsonb_build_object($2::text, 'x'), sha256('x'::bytea), now(), $3::uuid, $4::uuid)",
          [campaignA, key, agentA, id],
        );
      }
      return attempts;
    });
    for (const [key, attempt] of Object.entries(outcome)) {
      expect(attempt, key).toEqual(refused(CHECK_VIOLATION));
    }
  });

  it("L3C-T3 TM5.6 influx_creator holds nothing on the snapshots; agent and admin read them, the brand does not", async () => {
    const [row] = await scenario(
      (tx) =>
        tx<
          {
            creator: boolean;
            creator_schema: boolean;
            agent: boolean;
            admin: boolean;
            advertiser: boolean;
          }[]
        >`
        select has_table_privilege('influx_creator', 'campaigns.campaign_published_snapshots', 'SELECT') as creator,
               has_schema_privilege('influx_creator', 'campaigns', 'USAGE') as creator_schema,
               has_table_privilege('influx_agent', 'campaigns.campaign_published_snapshots', 'SELECT') as agent,
               has_table_privilege('influx_admin', 'campaigns.campaign_published_snapshots', 'SELECT') as admin,
               has_table_privilege('influx_advertiser', 'campaigns.campaign_published_snapshots', 'SELECT') as advertiser`,
    );
    expect(row).toEqual({
      creator: false,
      creator_schema: false,
      agent: true,
      admin: true,
      advertiser: false,
    });
  });

  it("L3C-T3 TM5.6 a snapshot is immutable: neither the agent nor the owner of the decisions changes it (55000 or 42501)", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      await publish(tx, AGENT_A, id, await claim(tx, AGENT_A, id));
      const agent = await call(
        tx,
        AGENT_A,
        "update campaigns.campaign_published_snapshots set version = 9 where campaign_id = $1::uuid",
        [campaignA],
      );
      await tx.unsafe("set local role influx_campaign_review_definer");
      const owner = await run(
        tx,
        "delete from campaigns.campaign_published_snapshots where campaign_id = $1::uuid",
        [campaignA],
      );
      await tx.unsafe("reset role");
      // the trigger, the second line: an influx_% role granted for the case
      await tx.unsafe(
        "grant select (campaign_id, version), update (version) on campaigns.campaign_published_snapshots to influx_worker",
      );
      await tx.unsafe("grant usage on schema campaigns to influx_worker");
      await tx.unsafe(
        "create policy l3c_t3_witness on campaigns.campaign_published_snapshots to influx_worker using (true) with check (true)",
      );
      await tx.unsafe("set local role influx_worker");
      const trigger = await run(
        tx,
        "update campaigns.campaign_published_snapshots set version = 9 where campaign_id = $1::uuid",
        [campaignA],
      );
      await tx.unsafe("reset role");
      return { agent, owner, trigger };
    });
    expect(outcome).toEqual({
      agent: refused(INSUFFICIENT_PRIVILEGE),
      owner: refused(INSUFFICIENT_PRIVILEGE),
      trigger: refused(NOT_IN_PREREQUISITE_STATE, "snapshot_immutable"),
    });
  });

  it("L3C-T3 agent and admin read the campaign without the suspended range, its lists and the refusal reasons", async () => {
    const outcome = await scenario(async (tx) => {
      await submittedA(tx);
      return asInternal(tx, AGENT_A, async () => ({
        campaign: await run(
          tx,
          "select title, total_budget_minor, per_creator_budget_band_code from campaigns.campaigns where id = $1::uuid",
          [campaignA],
        ),
        range: await run(
          tx,
          "select per_creator_amount_min_minor from campaigns.campaigns where id = $1::uuid",
          [campaignA],
        ),
        deliverables: await run(
          tx,
          "select count(*)::int as n from campaigns.campaign_deliverables where campaign_id = $1::uuid",
          [campaignA],
        ),
        reasons: await run(
          tx,
          "select count(*)::int as n from campaigns.rejection_reasons",
        ),
      }));
    });
    expect(outcome).toEqual({
      campaign: {
        outcome: "rows",
        rows: [
          {
            title: "Summer outdoor kit",
            total_budget_minor: null,
            per_creator_budget_band_code: "500_1000",
          },
        ],
      },
      range: refused(INSUFFICIENT_PRIVILEGE),
      deliverables: { outcome: "rows", rows: [{ n: 1 }] },
      reasons: { outcome: "rows", rows: [{ n: 14 }] },
    });
  });
});

// ---------------------------------------------------------------------------------------------
// L3C-T3: CA56, CA57, D84 — the enhanced review by one person, a second opinion optional
// ---------------------------------------------------------------------------------------------

describe("L3C-T3 CA56 CA57 D84 a sensitive sector is published by one person, a second opinion optional (09 RG85)", () => {
  it("L3C-T3 CA57 D84 a sensitive campaign is published by one person, an agent or an admin: single in the register, no requester", async () => {
    const alone = (who: Internal) =>
      scenario(async (tx) => {
        const id = await sensitiveA(tx);
        const published = await publish(tx, who, id, await claim(tx, who, id));
        const [snapshot] = await snapshotsOfA(tx);
        return {
          published: published.outcome,
          status: (await campaignOfA(tx)).status,
          snapshot: {
            published_by: snapshot?.published_by,
            first_reviewed_by: snapshot?.first_reviewed_by,
          },
          decided_by: (await entry(tx, id)).decided_by,
          line: (await campaignLines(tx)).at(-1),
        };
      });
    for (const who of [AGENT_A, ADMIN_A]) {
      expect(await alone(who), who.role).toEqual({
        published: "rows",
        status: "published",
        snapshot: { published_by: who.account, first_reviewed_by: null },
        decided_by: who.account,
        line: {
          event_type: "campaign.published",
          actor_account_id: who.account,
          payload: expect.objectContaining({
            enhanced_review: true,
            review_mode: "single",
            first_reviewed_by_account_id: null,
          }),
        },
      });
    }
  });

  it("L3C-T3 CA56 D84 asking a second opinion keeps the opinion, gives the claim back; the entry stays readable by all, its requester included", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await sensitiveA(tx);
      const token = await claim(tx, AGENT_A, id);
      const first = await call(tx, AGENT_A, FIRST_REVIEW, [id, token, OPINION]);
      const listedBy = async (who: Internal) =>
        (
          await asInternal(tx, who, () =>
            rows<{ n: number }>(
              tx,
              "select count(*)::int as n from campaigns.campaign_review_entries where id = $1::uuid",
              [id],
            ),
          )
        )[0]?.n;
      const listed = {
        requester: await listedBy(AGENT_A),
        colleague: await listedBy(AGENT_B),
        admin: await listedBy(ADMIN_A),
      };
      const given = await entry(tx, id);
      const [reopened] = await asInternal(tx, AGENT_A, () =>
        rows<{ outcome: string; first_review_opinion: string | null }>(
          tx,
          OPEN,
          [id],
        ),
      );
      return {
        first: first.outcome,
        entry: given,
        listed,
        reopened,
        lines: await campaignLines(tx),
      };
    });
    expect(outcome).toEqual({
      first: "rows",
      entry: expect.objectContaining({
        state: "open",
        first_reviewed_by: agentA,
        opinion: OPINION,
        claimed_by: null,
        decided_by: null,
      }),
      listed: { requester: 1, colleague: 1, admin: 1 },
      reopened: expect.objectContaining({
        outcome: "claimed",
        first_review_opinion: OPINION,
      }),
      lines: [
        {
          event_type: "campaign.first_reviewed",
          actor_account_id: agentA,
          payload: { entry_id: expect.any(String) },
        },
      ],
    });
    expect(JSON.stringify(outcome.lines)).not.toContain("Autorisations");
  });

  it("L3C-T3 CA56 D84 a colleague publishes after the request: the snapshot names both, second_opinion in the register, the opinion served to the holder", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await sensitiveA(tx);
      await call(tx, ADMIN_A, FIRST_REVIEW, [
        id,
        await claim(tx, ADMIN_A, id),
        OPINION,
      ]);
      const [opened] = await asInternal(tx, AGENT_B, () =>
        rows<{ review_token: string; first_review_opinion: string | null }>(
          tx,
          OPEN,
          [id],
        ),
      );
      const published = await publish(
        tx,
        AGENT_B,
        id,
        opened?.review_token ?? null,
      );
      const [snapshot] = await snapshotsOfA(tx);
      return {
        opinion: opened?.first_review_opinion,
        published: published.outcome,
        snapshot: {
          published_by: snapshot?.published_by,
          first_reviewed_by: snapshot?.first_reviewed_by,
        },
        decided_by: (await entry(tx, id)).decided_by,
        line: (await campaignLines(tx)).at(-1),
      };
    });
    expect(outcome).toEqual({
      opinion: OPINION,
      published: "rows",
      snapshot: { published_by: agentB, first_reviewed_by: adminA },
      decided_by: agentB,
      line: {
        event_type: "campaign.published",
        actor_account_id: agentB,
        payload: expect.objectContaining({
          enhanced_review: true,
          review_mode: "second_opinion",
          first_reviewed_by_account_id: adminA,
          snapshot_version: 1,
        }),
      },
    });
  });

  it("L3C-T3 D84 the requester takes the entry back and decides himself: an admin publishes (single, named twice), an agent refuses; no second request", async () => {
    const byAdmin = await scenario(async (tx) => {
      const id = await sensitiveA(tx);
      await call(tx, ADMIN_A, FIRST_REVIEW, [
        id,
        await claim(tx, ADMIN_A, id),
        OPINION,
      ]);
      const token = await claim(tx, ADMIN_A, id);
      const firstAgain = await call(tx, ADMIN_A, FIRST_REVIEW, [
        id,
        token,
        OPINION,
      ]);
      const published = await publish(tx, ADMIN_A, id, token);
      const [snapshot] = await snapshotsOfA(tx);
      return {
        firstAgain,
        published: published.outcome,
        snapshot: {
          published_by: snapshot?.published_by,
          first_reviewed_by: snapshot?.first_reviewed_by,
        },
        decided_by: (await entry(tx, id)).decided_by,
        line: (await campaignLines(tx)).at(-1),
      };
    });
    expect(byAdmin).toEqual({
      firstAgain: refused(
        NOT_IN_PREREQUISITE_STATE,
        "first_review_given",
        "first_review_given",
      ),
      published: "rows",
      snapshot: { published_by: adminA, first_reviewed_by: adminA },
      decided_by: adminA,
      line: {
        event_type: "campaign.published",
        actor_account_id: adminA,
        payload: expect.objectContaining({
          enhanced_review: true,
          review_mode: "single",
          first_reviewed_by_account_id: adminA,
        }),
      },
    });
    const byAgent = await scenario(async (tx) => {
      const id = await sensitiveA(tx);
      await call(tx, AGENT_A, FIRST_REVIEW, [
        id,
        await claim(tx, AGENT_A, id),
        OPINION,
      ]);
      const rejected = await reject(
        tx,
        AGENT_A,
        id,
        await claim(tx, AGENT_A, id),
        "sensitive_authorizations_missing",
      );
      return {
        rejected: rejected.outcome,
        entry: await entry(tx, id),
        status: (await campaignOfA(tx)).status,
      };
    });
    expect(byAgent).toEqual({
      rejected: "rows",
      entry: expect.objectContaining({
        state: "rejected",
        decided_by: agentA,
        first_reviewed_by: agentA,
      }),
      status: "rejected",
    });
  });

  it("L3C-T3 the first examination: not for a sector that is not sensitive, once only, with a reasoned opinion (55000, 22023)", async () => {
    const outcome = await scenario(async (tx) => {
      const plain = await submittedA(tx);
      const notSensitive = await call(tx, AGENT_A, FIRST_REVIEW, [
        plain,
        await claim(tx, AGENT_A, plain),
        OPINION,
      ]);
      const short = await call(tx, AGENT_A, FIRST_REVIEW, [
        plain,
        "x",
        "Trop court",
      ]);
      return { notSensitive, short };
    });
    expect(outcome).toEqual({
      notSensitive: refused(
        NOT_IN_PREREQUISITE_STATE,
        "not_enhanced_review",
        "not_enhanced_review",
      ),
      short: refused(INVALID_PARAMETER, "opinion", "opinion"),
    });
  });

  it("L3C-T3 a second first examination by another person is refused (55000 first_review_given)", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await sensitiveA(tx);
      await call(tx, AGENT_A, FIRST_REVIEW, [
        id,
        await claim(tx, AGENT_A, id),
        OPINION,
      ]);
      return call(tx, AGENT_B, FIRST_REVIEW, [
        id,
        await claim(tx, AGENT_B, id),
        OPINION,
      ]);
    });
    expect(outcome).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "first_review_given",
        "first_review_given",
      ),
    );
  });

  it("L3C-T3 RG85 a refusal needs one person only: a sensitive campaign rejected by a single agent", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await sensitiveA(tx);
      const rejected = await reject(
        tx,
        AGENT_A,
        id,
        await claim(tx, AGENT_A, id),
        "sensitive_authorizations_missing",
      );
      return {
        rejected: rejected.outcome,
        status: (await campaignOfA(tx)).status,
      };
    });
    expect(outcome).toEqual({ rejected: "rows", status: "rejected" });
  });

  it("L3C-T3 D84 the trigger of the enhanced review refuses a sensitive snapshot without the declaration only, even from the migration role (23514)", async () => {
    const attempt = (fixture: (tx: Tx) => Promise<unknown>) =>
      scenario(async (tx) => {
        await fixture(tx);
        try {
          await tx.savepoint((savepoint) =>
            publishAsInflux(savepoint, campaignA),
          );
          return "published";
        } catch (error) {
          const found = error as { code?: string; message?: string };
          return `${found.code ?? ""} ${found.message ?? ""}`;
        }
      });
    // declared at the submission, without a requester: published
    const declared = await attempt((tx) => sensitiveA(tx));
    // submitted outside a sensitive sector (no declaration), the sector then made sensitive
    const undeclared = await attempt(async (tx) => {
      await submittedA(tx);
      await tx`update campaigns.campaigns set sector_code = 'alcohol' where id = ${campaignA}`;
    });
    expect({ declared, undeclared }).toEqual({
      declared: "published",
      undeclared: `${CHECK_VIOLATION} enhanced_review`,
    });
  });
});

// ---------------------------------------------------------------------------------------------
// L3C-T3: CA59 — the typed refusal
// ---------------------------------------------------------------------------------------------

describe("L3C-T3 CA59 a refusal carries a typed reason; the campaign stays editable (09 RG10, RG89, RG90, RG92)", () => {
  it("L3C-T3 TM5.1 CA59 a refusal: the campaign rejected, the entry rejected with its reason, campaign.rejected typed", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      const rejected = await reject(
        tx,
        AGENT_A,
        id,
        await claim(tx, AGENT_A, id),
        "brief_insufficient",
        null,
        INTERNAL_MARKER,
      );
      return {
        rejected,
        campaign: await campaignOfA(tx),
        entry: await entry(tx, id),
        lines: await campaignLines(tx),
      };
    });
    expect(outcome).toEqual({
      rejected: {
        outcome: "rows",
        rows: [expect.objectContaining({ sla_breached: false })],
      },
      campaign: {
        status: "rejected",
        owner_agent_id: null,
        has_snapshot: false,
        first_published: false,
      },
      entry: expect.objectContaining({
        state: "rejected",
        decided_by: agentA,
        reason: "brief_insufficient",
        message: null,
        comment: INTERNAL_MARKER,
      }),
      lines: [
        {
          event_type: "campaign.rejected",
          actor_account_id: agentA,
          payload: {
            entry_id: expect.any(String),
            reason_code: "brief_insufficient",
            late: false,
          },
        },
      ],
    });
  });

  it("L3C-T3 RG90 an unknown or an inactive reason is refused (22023 reason), nothing written", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      const token = await claim(tx, AGENT_A, id);
      const unknown = await reject(tx, AGENT_A, id, token, "no_such_reason");
      await tx`update campaigns.rejection_reasons set is_active = false where code = 'duplicate'`;
      const inactive = await reject(tx, AGENT_A, id, token, "duplicate");
      return { unknown, inactive, state: await nothingDecided(tx, id) };
    });
    expect(outcome).toEqual({
      unknown: refused(INVALID_PARAMETER, "reason", "reason"),
      inactive: refused(INVALID_PARAMETER, "reason", "reason"),
      state: UNTOUCHED,
    });
  });

  it("L3C-T3 RG90 other and illicit_content need a message of 20 to 500 characters; any other reason refuses one (22023 member_message)", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      const token = await claim(tx, AGENT_A, id);
      const missing = await reject(tx, AGENT_A, id, token, "other");
      const short = await reject(
        tx,
        AGENT_A,
        id,
        token,
        "illicit_content",
        "Trop court",
      );
      const long = await reject(
        tx,
        AGENT_A,
        id,
        token,
        "other",
        "m".repeat(501),
      );
      const unexpected = await reject(
        tx,
        AGENT_A,
        id,
        token,
        "brief_insufficient",
        MESSAGE,
      );
      const accepted = await reject(tx, AGENT_A, id, token, "other", MESSAGE);
      return {
        missing,
        short,
        long,
        unexpected,
        accepted: accepted.outcome,
        message: (await entry(tx, id)).message,
      };
    });
    expect(outcome).toEqual({
      missing: refused(INVALID_PARAMETER, "member_message", "member_message"),
      short: refused(INVALID_PARAMETER, "member_message", "member_message"),
      long: refused(INVALID_PARAMETER, "member_message", "member_message"),
      unexpected: refused(
        INVALID_PARAMETER,
        "member_message",
        "member_message",
      ),
      accepted: "rows",
      message: MESSAGE,
    });
  });

  it("L3C-T3 RG92 the internal comment: 1 000 characters at most (22023), never read by agent nor admin, never sent nor registered", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      const token = await claim(tx, AGENT_A, id);
      const tooLong = await reject(
        tx,
        AGENT_A,
        id,
        token,
        "brief_insufficient",
        null,
        "c".repeat(1001),
      );
      await reject(tx, AGENT_A, id, token, "other", MESSAGE, INTERNAL_MARKER);
      const read = await call(
        tx,
        AGENT_B,
        "select internal_comment from campaigns.campaign_review_entries where id = $1::uuid",
        [id],
      );
      return {
        tooLong,
        read,
        sent: JSON.stringify(await queuedForA(tx)),
        registered: JSON.stringify(await campaignLines(tx)),
      };
    });
    expect(outcome.tooLong).toEqual(
      refused(INVALID_PARAMETER, "internal_comment", "internal_comment"),
    );
    expect(outcome.read).toEqual(refused(INSUFFICIENT_PRIVILEGE));
    expect(outcome.sent).not.toContain(INTERNAL_MARKER);
    expect(outcome.sent).not.toContain(MESSAGE);
    expect(outcome.registered).not.toContain(INTERNAL_MARKER);
    expect(outcome.registered).not.toContain(MESSAGE);
  });

  it("L3C-T3 CA59 the rejected campaign stays editable by the brand and is submitted again into a new entry", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      await reject(
        tx,
        AGENT_A,
        id,
        await claim(tx, AGENT_A, id),
        "brief_insufficient",
      );
      const edit = await asBrand(tx, brandA, () =>
        run(
          tx,
          "update campaigns.campaigns set brief = $2 where id = $1::uuid",
          [campaignA, "c".repeat(320)],
        ),
      );
      const again = await asBrand(tx, brandA, () =>
        run(
          tx,
          "select status, changed from campaigns.submit_own_campaign($1::uuid, null)",
          [campaignA],
        ),
      );
      const entries = await tx<{ state: string }[]>`
        select state::text from campaigns.campaign_review_entries
         where campaign_id = ${campaignA} and state in ('open', 'rejected') order by state`;
      return {
        edit: edit.outcome,
        again,
        entries: entries.map((e) => e.state),
      };
    });
    expect(outcome).toEqual({
      edit: "rows",
      again: {
        outcome: "rows",
        rows: [{ status: "pending_review", changed: true }],
      },
      entries: ["open", "rejected"],
    });
  });
});

// ---------------------------------------------------------------------------------------------
// L3C-T3: CA69 — the e-mail and the lead, in the transaction of the decision
// ---------------------------------------------------------------------------------------------

describe("L3C-T3 CA69 the decision queues its e-mail and the first publication its lead, ids only (09 RG93, RG103)", () => {
  it("L3C-T3 CA69 the first publication queues campaign.decision to Brevo transactional and campaign.published to Brevo and Apollo", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      await publish(tx, AGENT_A, id, await claim(tx, AGENT_A, id));
      return { id, queued: await queuedForA(tx) };
    });
    const lead = {
      event_id: expect.any(String),
      account_id: brandA,
      campaign_id: campaignA,
    };
    expect(outcome.queued).toEqual([
      {
        event_type: "campaign.decision",
        destination: "brevo_transactional",
        payload: {
          event_id: expect.any(String),
          account_id: brandA,
          campaign_id: campaignA,
          email_code: "published",
          entry_id: outcome.id,
        },
        idempotency_key: `campaign.decision:${outcome.id}`,
      },
      {
        event_type: "campaign.published",
        destination: "apollo_contact",
        payload: lead,
        idempotency_key: `campaign.published:${campaignA}`,
      },
      {
        event_type: "campaign.published",
        destination: "brevo_contact",
        payload: lead,
        idempotency_key: `campaign.published:${campaignA}`,
      },
    ]);
  });

  it("L3C-T3 the refusal queues the decision e-mail only (email_code rejected), never a lead", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      await reject(
        tx,
        AGENT_A,
        id,
        await claim(tx, AGENT_A, id),
        "other",
        MESSAGE,
      );
      return queuedForA(tx);
    });
    expect(
      outcome.map((q) => [q.event_type, q.destination, q.payload.email_code]),
    ).toEqual([["campaign.decision", "brevo_transactional", "rejected"]]);
  });

  it("L3C-T3 the line campaign.published is nominative and typed: entry, version, owner, late, no text", async () => {
    const outcome = await scenario(async (tx) => {
      const id = await submittedA(tx);
      await publish(
        tx,
        AGENT_A,
        id,
        await claim(tx, AGENT_A, id),
        agentB,
        INTERNAL_MARKER,
      );
      return { id, lines: await campaignLines(tx) };
    });
    expect(outcome.lines).toEqual([
      {
        event_type: "campaign.published",
        actor_account_id: agentA,
        payload: {
          entry_id: outcome.id,
          snapshot_version: 1,
          first_publication: true,
          owner_agent_id: agentB,
          enhanced_review: false,
          review_mode: "single",
          first_reviewed_by_account_id: null,
          late: false,
        },
      },
    ]);
  });
});

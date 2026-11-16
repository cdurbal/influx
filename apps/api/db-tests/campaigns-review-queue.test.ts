// L3C commit 02 — queue 7: the entry opened by the submission door, its deadlines, RG15, RG95, the
// claim and the freeze as a closed list of roles (0307; docs/mvp/09 RG6, RG15, RG87, RG88, RG95, CA10,
// CA58, CA62; 15 RG27, RG36, RG37; jalons/l3c/modele.md §1, §7, §9; fiche invariants 4, 9 to 11).
//   L3C-T2  one open entry per submission (1 business day, 2 for a sensitive sector, escalation at 3
//           business days of age), a new entry for a rejected campaign submitted again, the deadlines
//           frozen by the base; RG15 (the campaigns to close named) and its setting; RG95 an alert,
//           never a refusal; the claim (holder named, 30 minutes, expiry taken over, release,
//           extension, forced release by an admin), the conflict of interest (42501, T14) and the
//           requester of a second opinion, read like anybody (D84, 0313); the columns of the agents
//           out of the brand's reach; the freeze L3BS-2.
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

/** The four dates of a valid campaign, from today (L3BT-9). */
const CALENDAR = campaignCalendar();

const INVALID_PARAMETER = "22023";
const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_IN_PREREQUISITE_STATE = "55000";
const LOCK_NOT_AVAILABLE = "55P03";
const UNIQUE_VIOLATION = "23505";

const brandA = accountIdOf("advertiser", "a");
const brandB = accountIdOf("advertiser", "b");
const agentA = accountIdOf("agent", "a");
const agentB = accountIdOf("agent", "b");
const adminA = accountIdOf("admin", "a");
const adminB = accountIdOf("admin", "b");
const campaignA = CAMPAIGN_IDS.a;
const UNKNOWN_ENTRY = "00000000-0000-4000-8000-0000000fffff";

const OPINION =
  "Autorisations vérifiées pour les pays visés, déclaration conforme.";

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
const ADMIN_B: Internal = { account: adminB, role: "admin" };

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

// the calls --------------------------------------------------------------------------------------

const OPEN = "select * from campaigns.open_campaign_review_entry($1::uuid)";
const RELEASE = "select campaigns.release_campaign_review_entry($1::uuid)";
const EXTEND =
  "select campaigns.extend_campaign_review_claim($1::uuid) as expires";
const FORCE =
  "select campaigns.force_release_campaign_review_claim($1::uuid, $2::text) as holder";

type Opened = {
  outcome: string;
  holder_account_id: string | null;
  claimed_at: Date | null;
  claim_expires_at: Date | null;
  review_token: string | null;
  first_reviewed_by_account_id: string | null;
  first_reviewed_at: Date | null;
  first_review_opinion: string | null;
};

function call<T>(
  tx: Tx,
  who: Internal,
  statement: string,
  parameters: readonly Parameter[],
  aal: "aal1" | "aal2" = "aal2",
): Promise<Outcome<T>> {
  return asInternal(tx, who, () => run<T>(tx, statement, parameters), aal);
}

async function open(tx: Tx, who: Internal, entry: string): Promise<Opened> {
  const [opened] = await asInternal(tx, who, () =>
    rows<Opened>(tx, OPEN, [entry]),
  );
  if (opened === undefined) throw new Error("no opening");
  return opened;
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

/** The brand submits campaign A: its outcome. */
function brandSubmits(
  tx: Tx,
  locale: string | null = null,
): Promise<Outcome<{ status: string; changed: boolean }>> {
  return asBrand(tx, brandA, () =>
    run<{ status: string; changed: boolean }>(
      tx,
      "select status, changed from campaigns.submit_own_campaign($1::uuid, $2::text)",
      [campaignA, locale],
    ),
  );
}

/** Brand A ready, campaign A submitted: the id of its open entry. */
async function submittedA(
  tx: Tx,
  locale: string | null = null,
): Promise<string> {
  const submission = await brandSubmits(tx, locale);
  if (submission.outcome === "error") {
    throw new Error(`${submission.code} ${submission.message}`);
  }
  return openEntryOfA(tx);
}

async function openEntryOfA(tx: Tx): Promise<string> {
  const [entry] = await tx<{ id: string }[]>`
    select id::text from campaigns.campaign_review_entries
     where campaign_id = ${campaignA} and state = 'open'`;
  if (entry === undefined) throw new Error("no open entry");
  return entry.id;
}

type Live = {
  status: "published" | "paused" | "closed" | "draft" | "rejected";
  title?: string;
  closeOn?: string;
  startsOn?: string;
  endsOn?: string;
  submittedDaysAgo?: number;
  account?: string;
};

/** Another complete campaign of brand A (or of `account`), in `status`, as the superuser. */
async function otherCampaign(tx: Tx, live: Live): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    insert into campaigns.campaigns
      (advertiser_account_id, status, title, campaign_type_code, public_summary, brief,
       product_description, sector_code, product_is_sent, usage_rights_code,
       usage_rights_duration_band, usage_rights_territory_scope, exclusivity_band,
       content_review_delay, currency, remuneration_kind, per_creator_budget_band_code,
       creators_wanted, applications_close_on, starts_on, ends_on, submitted_at)
    values (${live.account ?? brandA},
            ${live.status === "published" || live.status === "paused" ? "draft" : live.status}::campaigns.campaign_status,
            ${live.title ?? "Another campaign"}, 'product_placement', ${"s".repeat(120)},
            ${"b".repeat(300)}, 'A light tent for two', 'sports_leisure', false, 'organic_repost',
            '3m', 'worldwide', 'none', '5bd', 'EUR', 'cash', '500_1000', 3,
            ${live.closeOn ?? CALENDAR.applicationsCloseOn}, ${live.startsOn ?? CALENDAR.startsOn},
            ${live.endsOn ?? CALENDAR.endsOn},
            now() - make_interval(days => ${live.submittedDaysAgo ?? 1}))
    returning id::text`;
  if (row === undefined) throw new Error("no campaign");
  // 0308: a published or paused campaign carries its snapshot (campaigns_published_needs_review)
  if (live.status === "published" || live.status === "paused") {
    await publishAsInflux(tx, row.id, live.status);
  }
  return row.id;
}

async function setting(tx: Tx, key: string, value: number): Promise<void> {
  await tx`
    update backoffice.operational_settings set value = to_jsonb(${value}::int) where key = ${key}`;
}

type RegisterLine = {
  event_type: string;
  actor_account_id: string | null;
  payload: Record<string, unknown>;
};

async function queueLines(tx: Tx, entry: string): Promise<RegisterLine[]> {
  return tx<RegisterLine[]>`
    select event_type, actor_account_id::text as actor_account_id, payload
      from audit.audit_events
     where subject_type = 'queue_entry' and subject_id = ${entry}
     order by seq`;
}

// ---------------------------------------------------------------------------------------------
// L3C-T2: the entry and its deadlines
// ---------------------------------------------------------------------------------------------

type Deadlines = {
  entries: number;
  state: string;
  sla_ok: boolean;
  escalate_ok: boolean;
};

/** The open entries of campaign A and whether their deadlines are those of `delay` and `escalation`. */
async function deadlinesOfA(
  tx: Tx,
  delay: number,
  escalation: number,
): Promise<Deadlines[]> {
  return tx<Deadlines[]>`
    select count(*) over ()::int as entries, e.state::text as state,
           e.sla_due_at = backoffice.business_deadline('campaigns', e.created_at, ${delay}::int)
             as sla_ok,
           e.escalate_at = backoffice.business_deadline('campaigns', e.created_at, ${escalation}::int)
             as escalate_ok
      from campaigns.campaign_review_entries e
     where e.campaign_id = ${campaignA} and e.state = 'open'`;
}

describe("L3C-T2 the submission opens one entry of queue 7 with its frozen deadlines (09 RG6, 15 RG37)", () => {
  it("L3C-T2 a submission opens one open entry: 1 business day, escalation at 3 business days of age", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      await submittedA(tx);
      return deadlinesOfA(tx, 480, 1440);
    });
    expect(outcome).toEqual([
      { entries: 1, state: "open", sla_ok: true, escalate_ok: true },
    ]);
  });

  it("L3C-T2 a sensitive sector, read by join, gives 2 business days (campaign_enhanced_review_minutes)", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx, { sector_code: "alcohol" });
      await submittedA(tx, "en");
      return deadlinesOfA(tx, 960, 1440);
    });
    expect(outcome).toEqual([
      { entries: 1, state: "open", sla_ok: true, escalate_ok: true },
    ]);
  });

  it("L3C-T2 the enhanced delay is data: raised to 2 400 minutes, the deadline and the escalation follow", async () => {
    const outcome = await scenario(async (tx) => {
      await setting(tx, "campaign_enhanced_review_minutes", 2400);
      await readyA(tx, { sector_code: "alcohol" });
      await submittedA(tx, "fr");
      return deadlinesOfA(tx, 2400, 2400);
    });
    expect(outcome).toEqual([
      { entries: 1, state: "open", sla_ok: true, escalate_ok: true },
    ]);
  });

  it("L3C-T2 the deadlines are the base's, whatever the writer gives (04 §5.6)", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      await tx`update campaigns.campaigns set status = 'pending_review' where id = ${campaignA}`;
      await tx`
        insert into campaigns.campaign_review_entries
          (campaign_id, advertiser_account_id, created_at, sla_due_at, escalate_at)
        values (${campaignA}, ${brandA}, now() - interval '30 days', now() + interval '1 year',
                now() + interval '2 years')`;
      return deadlinesOfA(tx, 480, 1440);
    });
    expect(outcome).toEqual([
      { entries: 1, state: "open", sla_ok: true, escalate_ok: true },
    ]);
  });

  it("L3C-T2 asked again while pending, the door opens no second entry; the base refuses a second open one (23505)", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      await submittedA(tx);
      const again = await brandSubmits(tx);
      const count = await deadlinesOfA(tx, 480, 1440);
      const second = await run(
        tx,
        "insert into campaigns.campaign_review_entries (campaign_id, advertiser_account_id) " +
          "values ($1::uuid, $2::uuid)",
        [campaignA, brandA],
      );
      return { again, entries: count.length, second };
    });
    expect(outcome).toEqual({
      again: {
        outcome: "rows",
        rows: [{ status: "pending_review", changed: false }],
      },
      entries: 1,
      second: refused(UNIQUE_VIOLATION),
    });
  });

  it("L3C-T2 a rejected campaign submitted again gets a new entry, the rejected one kept", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      const first = await submittedA(tx);
      await tx`
        update campaigns.campaign_review_entries
           set state = 'rejected', decided_by_account_id = ${agentB}, decided_at = now(),
               rejection_reason_code = 'brief_insufficient', closed_at = now()
         where id = ${first}`;
      await tx`update campaigns.campaigns set status = 'rejected' where id = ${campaignA}`;
      const second = await submittedA(tx);
      return {
        distinct: first !== second,
        states: (
          await tx<{ state: string }[]>`
            select state::text from campaigns.campaign_review_entries
             where campaign_id = ${campaignA} and id in (${first}, ${second})
             order by created_at, state`
        ).map((row) => row.state),
      };
    });
    expect(outcome).toEqual({ distinct: true, states: ["open", "rejected"] });
  });

  it("L3C-T2 every pending_review campaign of the stack has exactly one open entry, and only they (modele -1)", async () => {
    const mismatches = await scenario(
      (tx) =>
        tx<{ id: string }[]>`
        select c.id::text from campaigns.campaigns c
         where (c.status = 'pending_review')
               <> exists (select 1 from campaigns.campaign_review_entries e
                           where e.campaign_id = c.id and e.state = 'open')`,
    );
    expect(mismatches).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// L3C-T2: RG15 (CA10) and RG95 (CA62)
// ---------------------------------------------------------------------------------------------

describe("L3C-T2 RG15: a brand holds at most campaign_live_cap published or paused campaigns (CA10)", () => {
  it("L3C-T2 at the cap, the submission is refused, the campaigns to close named in DETAIL, nothing written", async () => {
    const outcome = await scenario(async (tx) => {
      await setting(tx, "campaign_live_cap", 2);
      const older = await otherCampaign(tx, {
        status: "paused",
        submittedDaysAgo: 5,
      });
      const newer = await otherCampaign(tx, {
        status: "published",
        submittedDaysAgo: 2,
      });
      await readyA(tx);
      const submission = await brandSubmits(tx);
      const [state] = await tx<{ status: string; entries: number }[]>`
        select c.status::text as status,
               (select count(*)::int from campaigns.campaign_review_entries e
                 where e.campaign_id = c.id and e.state = 'open') as entries
          from campaigns.campaigns c where c.id = ${campaignA}`;
      return { submission, state, expected: `${older},${newer}` };
    });
    expect(outcome.submission).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "live_campaign_cap", outcome.expected),
    );
    expect(outcome.state).toEqual({ status: "draft", entries: 0 });
  });

  it("L3C-T2 only published and paused count: draft, rejected, closed and pending campaigns leave room", async () => {
    const outcome = await scenario(async (tx) => {
      await setting(tx, "campaign_live_cap", 1);
      for (const status of ["draft", "rejected", "closed"] as const) {
        await otherCampaign(tx, { status });
      }
      await readyA(tx);
      return brandSubmits(tx);
    });
    expect(outcome).toEqual({
      outcome: "rows",
      rows: [{ status: "pending_review", changed: true }],
    });
  });

  it("L3C-T2 the cap is data: raised above the live campaigns, the same submission goes through", async () => {
    const outcome = await scenario(async (tx) => {
      await setting(tx, "campaign_live_cap", 1);
      await otherCampaign(tx, { status: "published" });
      await readyA(tx);
      const refusedFirst = await brandSubmits(tx);
      await setting(tx, "campaign_live_cap", 2);
      return { refusedFirst, accepted: await brandSubmits(tx) };
    });
    expect(outcome).toEqual({
      refusedFirst: refused(NOT_IN_PREREQUISITE_STATE, "live_campaign_cap"),
      accepted: {
        outcome: "rows",
        rows: [{ status: "pending_review", changed: true }],
      },
    });
  });

  it("L3C-T2 the campaigns of another brand never count", async () => {
    const outcome = await scenario(async (tx) => {
      await setting(tx, "campaign_live_cap", 1);
      await otherCampaign(tx, { status: "published", account: brandB });
      await readyA(tx);
      return brandSubmits(tx);
    });
    expect(outcome).toEqual({
      outcome: "rows",
      rows: [{ status: "pending_review", changed: true }],
    });
  });
});

async function duplicateOfA(tx: Tx): Promise<string | null> {
  const [row] = await tx<{ duplicate: string | null }[]>`
    select duplicate_of_campaign_id::text as duplicate from campaigns.campaign_review_entries
     where campaign_id = ${campaignA} and state = 'open'`;
  if (row === undefined) throw new Error("no open entry");
  return row.duplicate;
}

describe("L3C-T2 RG95: a duplicate is an alert carried by the entry, never a refusal (CA62)", () => {
  it("L3C-T2 the same normalized title over an overlapping period: the entry names the last such campaign, the submission passes", async () => {
    const outcome = await scenario(async (tx) => {
      await otherCampaign(tx, {
        status: "paused",
        title: "summer OUTDOOR kit",
        submittedDaysAgo: 9,
      });
      const last = await otherCampaign(tx, {
        status: "published",
        title: "  SUMMER — outdoor-kit!! ",
        submittedDaysAgo: 3,
      });
      await readyA(tx);
      const submission = await brandSubmits(tx);
      return { submission, duplicate: await duplicateOfA(tx), last };
    });
    expect(outcome.submission).toEqual({
      outcome: "rows",
      rows: [{ status: "pending_review", changed: true }],
    });
    expect(outcome.duplicate).toBe(outcome.last);
  });

  it("L3C-T2 no alert for a period that does not overlap, another title or a draft", async () => {
    const outcome = await scenario(async (tx) => {
      await otherCampaign(tx, {
        status: "published",
        title: "Summer outdoor kit",
        closeOn: civilDateIn(1),
        startsOn: civilDateIn(2),
        endsOn: civilDateIn(20),
      });
      await otherCampaign(tx, {
        status: "published",
        title: "Winter outdoor kit",
      });
      await otherCampaign(tx, { status: "draft", title: "Summer outdoor kit" });
      await readyA(tx);
      await submittedA(tx);
      return duplicateOfA(tx);
    });
    expect(outcome).toBeNull();
  });

  it("L3C-T2 normalized_title: lower case, every run of non-alphanumerics one space, trimmed", async () => {
    const [row] = await scenario(
      (tx) =>
        tx<{ a: string; b: string; c: string | null }[]>`
        select campaigns.normalized_title('  Été 2027 — Kit!! ') as a,
               campaigns.normalized_title('SUMMER outdoor-kit') as b,
               campaigns.normalized_title(null) as c`,
    );
    expect(row).toEqual({
      a: "été 2027 kit",
      b: "summer outdoor kit",
      c: null,
    });
  });
});

// ---------------------------------------------------------------------------------------------
// L3C-T2: the claim (09 RG88, 15 RG27, CA58)
// ---------------------------------------------------------------------------------------------

describe("L3C-T2 the claim of an entry of queue 7 (09 RG88, 15 RG27 C1 to C4, CA58)", () => {
  it("L3C-T2 opening a free entry claims it for 30 minutes, with the version token; queue.entry_opened", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      const entry = await submittedA(tx);
      const opened = await open(tx, AGENT_B, entry);
      return { opened, lines: await queueLines(tx, entry) };
    });
    expect(outcome.opened).toEqual(
      expect.objectContaining({
        outcome: "claimed",
        holder_account_id: agentB,
        review_token: expect.stringMatching(/^[0-9a-f]{64}$/),
        first_reviewed_by_account_id: null,
        first_review_opinion: null,
      }),
    );
    const { claimed_at: claimed, claim_expires_at: expires } = outcome.opened;
    expect((expires?.getTime() ?? 0) - (claimed?.getTime() ?? 0)).toBe(
      30 * 60 * 1000,
    );
    expect(outcome.lines).toEqual([
      {
        event_type: "queue.entry_opened",
        actor_account_id: agentB,
        payload: { queue_code: "campaigns", outcome: "claimed" },
      },
    ]);
  });

  it("L3C-T2 a second internal reads it « déjà prise en charge par … »: read_only, the holder named, no token", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      const entry = await submittedA(tx);
      await open(tx, AGENT_B, entry);
      return {
        second: await open(tx, ADMIN_A, entry),
        holderAgain: await open(tx, AGENT_B, entry),
      };
    });
    expect(outcome.second).toEqual(
      expect.objectContaining({
        outcome: "read_only",
        holder_account_id: agentB,
        review_token: null,
      }),
    );
    expect(outcome.holderAgain).toEqual(
      expect.objectContaining({
        outcome: "held",
        holder_account_id: agentB,
        review_token: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
  });

  it("L3C-T2 an expired claim is taken over, queue.claim_expired written first with its holder", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      const entry = await submittedA(tx);
      await open(tx, AGENT_B, entry);
      await tx`
        update campaigns.campaign_review_entries
           set claimed_at = now() - interval '40 minutes',
               claim_expires_at = now() - interval '10 minutes'
         where id = ${entry}`;
      const opened = await open(tx, ADMIN_A, entry);
      return { opened, lines: await queueLines(tx, entry) };
    });
    expect(outcome.opened).toEqual(
      expect.objectContaining({
        outcome: "claimed",
        holder_account_id: adminA,
      }),
    );
    expect(outcome.lines.map((line) => line.event_type)).toEqual([
      "queue.entry_opened",
      "queue.claim_expired",
      "queue.entry_opened",
    ]);
    expect(outcome.lines[1]?.payload).toEqual(
      expect.objectContaining({
        queue_code: "campaigns",
        holder_account_id: agentB,
      }),
    );
  });

  it("L3C-T2 the holder releases it (queue.claim_released); another can neither release nor extend it (55P03, the holder in DETAIL)", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      const entry = await submittedA(tx);
      await open(tx, AGENT_B, entry);
      const otherRelease = await call(tx, ADMIN_A, RELEASE, [entry]);
      const otherExtend = await call(tx, ADMIN_A, EXTEND, [entry]);
      const release = await call(tx, AGENT_B, RELEASE, [entry]);
      const [claim] = await tx<{ holder: string | null }[]>`
        select claimed_by_account_id::text as holder from campaigns.campaign_review_entries
         where id = ${entry}`;
      const lines = await queueLines(tx, entry);
      return { otherRelease, otherExtend, release, claim, last: lines.at(-1) };
    });
    expect(outcome.otherRelease).toEqual(
      refused(LOCK_NOT_AVAILABLE, "no_live_claim", agentB),
    );
    expect(outcome.otherExtend).toEqual(
      refused(LOCK_NOT_AVAILABLE, "no_live_claim", agentB),
    );
    expect(outcome.release.outcome).toBe("rows");
    expect(outcome.claim).toEqual({ holder: null });
    expect(outcome.last).toEqual(
      expect.objectContaining({
        event_type: "queue.claim_released",
        payload: expect.objectContaining({
          queue_code: "campaigns",
          holder_account_id: agentB,
        }),
      }),
    );
  });

  it("L3C-T2 the holder extends the claim to now() + 30 minutes (queue.claim_extended)", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      const entry = await submittedA(tx);
      await open(tx, AGENT_B, entry);
      await tx`
        update campaigns.campaign_review_entries
           set claim_expires_at = now() + interval '5 minutes' where id = ${entry}`;
      const extended = await call<{ expires: Date }>(tx, AGENT_B, EXTEND, [
        entry,
      ]);
      const [now] = await tx<{ now: Date }[]>`select now() as now`;
      const lines = await queueLines(tx, entry);
      return { extended, now: now?.now, last: lines.at(-1)?.event_type };
    });
    if (outcome.extended.outcome !== "rows") throw new Error("not extended");
    const expires = outcome.extended.rows[0]?.expires.getTime() ?? 0;
    expect(expires - (outcome.now?.getTime() ?? 0)).toBe(30 * 60 * 1000);
    expect(outcome.last).toBe("queue.claim_extended");
  });

  it("L3C-T2 an admin lifts a live claim with a typed reason; an agent is refused (42501), an unknown reason too (22023)", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      const entry = await submittedA(tx);
      await open(tx, AGENT_B, entry);
      const [reason] = await tx<{ code: string }[]>`
        select code from backoffice.claim_release_reasons where is_active order by code limit 1`;
      const byAgent = await call(tx, AGENT_A, FORCE, [entry, reason?.code]);
      const unknownReason = await call(tx, ADMIN_B, FORCE, [
        entry,
        "no_such_reason",
      ]);
      const forced = await call<{ holder: string }>(tx, ADMIN_B, FORCE, [
        entry,
        reason?.code,
      ]);
      const [kept] = await tx<
        { holder: string | null; forced_holder: string; by: string }[]
      >`
        select claimed_by_account_id::text as holder,
               forced_release_holder_account_id::text as forced_holder,
               forced_release_by_account_id::text as by
          from campaigns.campaign_review_entries where id = ${entry}`;
      const lines = await queueLines(tx, entry);
      return { byAgent, unknownReason, forced, kept, last: lines.at(-1) };
    });
    expect(outcome.byAgent).toEqual(
      refused(INSUFFICIENT_PRIVILEGE, "forbidden"),
    );
    expect(outcome.unknownReason).toEqual(refused(INVALID_PARAMETER, "reason"));
    expect(outcome.forced).toEqual({
      outcome: "rows",
      rows: [{ holder: agentB }],
    });
    expect(outcome.kept).toEqual({
      holder: null,
      forced_holder: agentB,
      by: adminB,
    });
    expect(outcome.last).toEqual(
      expect.objectContaining({
        event_type: "queue.claim_forced_release",
        actor_account_id: adminB,
        payload: expect.objectContaining({
          queue_code: "campaigns",
          holder_account_id: agentB,
        }),
      }),
    );
  });

  it("L3C-T2 a closed entry answers closed to anybody, nothing claimed; releasing it is 55000 entry_closed", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      const entry = await submittedA(tx);
      await tx`
        update campaigns.campaign_review_entries
           set state = 'withdrawn', closed_at = now() where id = ${entry}`;
      return {
        opened: await open(tx, AGENT_B, entry),
        release: await call(tx, AGENT_B, RELEASE, [entry]),
      };
    });
    expect(outcome.opened).toEqual(
      expect.objectContaining({
        outcome: "closed",
        holder_account_id: null,
        review_token: null,
      }),
    );
    expect(outcome.release).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "entry_closed"),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// L3C-T2: who never claims (15 RG36, modele §3, T14)
// ---------------------------------------------------------------------------------------------

describe("L3C-T2 the conflict of interest, the requester of a second opinion and the outsiders (15 RG36, T14, D84)", () => {
  it("L3C-T2 an agent holding the brand gets the answer of an unknown entry (42501 forbidden)", async () => {
    const outcome = await scenario(async (tx) => {
      await tx`update identity.accounts set owner_agent_id = ${agentA} where id = ${brandA}`;
      await readyA(tx);
      const entry = await submittedA(tx);
      return {
        held: await call(tx, AGENT_A, OPEN, [entry]),
        unknown: await call(tx, AGENT_A, OPEN, [UNKNOWN_ENTRY]),
        extend: await call(tx, AGENT_A, EXTEND, [entry]),
      };
    });
    expect(outcome.held).toEqual(refused(INSUFFICIENT_PRIVILEGE, "forbidden"));
    expect(outcome.unknown).toEqual(outcome.held);
    expect(outcome.extend).toEqual(outcome.held);
  });

  it("L3C-T2 D84 an open entry with a second opinion asked is read by all, its requester included (list, opening); the next holder reads the opinion, a reader does not", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx, { sector_code: "alcohol" });
      const entry = await submittedA(tx, "en");
      await tx`
        update campaigns.campaign_review_entries
           set first_reviewed_by_account_id = ${agentB}, first_reviewed_at = now(),
               first_review_opinion = ${OPINION}
         where id = ${entry}`;
      const seenByFirst = await asInternal(tx, AGENT_B, () =>
        rows<{ id: string }>(
          tx,
          "select id::text from campaigns.campaign_review_entries where id = $1::uuid",
          [entry],
        ),
      );
      const seenByAdmin = await asInternal(tx, ADMIN_A, () =>
        rows<{ id: string }>(
          tx,
          "select id::text from campaigns.campaign_review_entries where id = $1::uuid",
          [entry],
        ),
      );
      return {
        seenByFirst: seenByFirst.length,
        seenByAdmin: seenByAdmin.length,
        holder: await open(tx, ADMIN_A, entry),
        reader: await open(tx, ADMIN_B, entry),
        openByFirst: await open(tx, AGENT_B, entry),
      };
    });
    expect(outcome.seenByFirst).toBe(1);
    expect(outcome.seenByAdmin).toBe(1);
    // the requester opens it like anybody: here a reader, the claim being held
    expect(outcome.openByFirst).toEqual(
      expect.objectContaining({
        outcome: "read_only",
        holder_account_id: adminA,
        first_reviewed_by_account_id: agentB,
        first_review_opinion: null,
      }),
    );
    expect(outcome.holder).toEqual(
      expect.objectContaining({
        outcome: "claimed",
        first_reviewed_by_account_id: agentB,
        first_review_opinion: OPINION,
      }),
    );
    expect(outcome.reader).toEqual(
      expect.objectContaining({
        outcome: "read_only",
        first_reviewed_by_account_id: agentB,
        first_review_opinion: null,
      }),
    );
  });

  it("L3C-T2 D84 the read policy (0313, the clauses of 0307): an open entry is read before and after a second opinion is asked, its requester included, and once closed", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx, { sector_code: "alcohol" });
      const entry = await submittedA(tx, "en");
      const seen = (who: Internal, aal: "aal1" | "aal2" = "aal2") =>
        asInternal(
          tx,
          who,
          async () =>
            (
              await rows<{ id: string }>(
                tx,
                "select id::text from campaigns.campaign_review_entries where id = $1::uuid",
                [entry],
              )
            ).length,
          aal,
        );
      const submitted = {
        agent: await seen(AGENT_A),
        admin: await seen(ADMIN_A),
        agentAal1: await seen(AGENT_A, "aal1"),
        adminAal1: await seen(ADMIN_A, "aal1"),
      };
      const { review_token: token } = await open(tx, AGENT_A, entry);
      const claimedByHolder = await seen(AGENT_A);
      await asInternal(tx, AGENT_A, () =>
        rows(
          tx,
          "select campaigns.first_review_campaign_entry($1::uuid, $2::text, $3::text)",
          [entry, token, OPINION],
        ),
      );
      const reviewed = {
        author: await seen(AGENT_A),
        otherAgent: await seen(AGENT_B),
        admin: await seen(ADMIN_A),
      };
      await tx`
        update campaigns.campaign_review_entries
           set state = 'withdrawn', closed_at = now() where id = ${entry}`;
      return {
        submitted,
        claimedByHolder,
        reviewed,
        closedByAuthor: await seen(AGENT_A),
      };
    });
    expect(outcome.submitted).toEqual({
      agent: 1,
      admin: 1,
      agentAal1: 0,
      adminAal1: 0,
    });
    expect(outcome.claimedByHolder).toBe(1);
    expect(outcome.reviewed).toEqual({ author: 1, otherAgent: 1, admin: 1 });
    expect(outcome.closedByAuthor).toBe(1);
  });

  it("L3C-T2 an internal in aal1 and a brand cannot open an entry (42501)", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      const entry = await submittedA(tx);
      return {
        aal1: await call(tx, AGENT_B, OPEN, [entry], "aal1"),
        brand: await asBrand(tx, brandA, () => run(tx, OPEN, [entry])),
      };
    });
    expect(outcome.aal1).toEqual(refused(INSUFFICIENT_PRIVILEGE));
    expect(outcome.brand).toEqual(refused(INSUFFICIENT_PRIVILEGE));
  });

  it("L3C-T2 the brand reads its own entries without any agent column; agent and admin never read the opinion nor the comment", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      await submittedA(tx);
      const brand = await asBrand(tx, brandA, async () => ({
        own: await run<{ state: string }>(
          tx,
          "select state::text from campaigns.campaign_review_entries where campaign_id = $1::uuid " +
            "and state = 'open'",
          [campaignA],
        ),
        others: await run<{ n: number }>(
          tx,
          "select count(*)::int as n from campaigns.campaign_review_entries " +
            "where advertiser_account_id <> $1::uuid",
          [brandA],
        ),
        claim: await run(
          tx,
          "select claimed_by_account_id from campaigns.campaign_review_entries",
        ),
        deadline: await run(
          tx,
          "select sla_due_at from campaigns.campaign_review_entries",
        ),
        duplicate: await run(
          tx,
          "select duplicate_of_campaign_id from campaigns.campaign_review_entries",
        ),
      }));
      const agent = await asInternal(tx, AGENT_B, async () => ({
        opinion: await run(
          tx,
          "select first_review_opinion from campaigns.campaign_review_entries",
        ),
        comment: await run(
          tx,
          "select internal_comment from campaigns.campaign_review_entries",
        ),
      }));
      return { brand, agent };
    });
    expect(outcome.brand).toEqual({
      own: { outcome: "rows", rows: [{ state: "open" }] },
      others: { outcome: "rows", rows: [{ n: 0 }] },
      claim: refused(INSUFFICIENT_PRIVILEGE),
      deadline: refused(INSUFFICIENT_PRIVILEGE),
      duplicate: refused(INSUFFICIENT_PRIVILEGE),
    });
    expect(outcome.agent).toEqual({
      opinion: refused(INSUFFICIENT_PRIVILEGE),
      comment: refused(INSUFFICIENT_PRIVILEGE),
    });
  });
});

// ---------------------------------------------------------------------------------------------
// L3C-T2: the freeze, a closed list of roles (modele §7, L3BS-2)
// ---------------------------------------------------------------------------------------------

/**
 * Grants `role`, for the rolled-back transaction only, an UPDATE of the title and the state of any
 * campaign and its policies: what the freeze alone must then refuse or admit.
 */
async function temporaryWriter(tx: Tx, role: string): Promise<void> {
  await tx.unsafe(`grant usage on schema campaigns to ${role}`);
  await tx.unsafe(
    `grant select (id, status, title), update (status, title) on campaigns.campaigns to ${role}`,
  );
  await tx.unsafe(
    `create policy l3c_t2_witness on campaigns.campaigns to ${role} using (true) with check (true)`,
  );
}

async function writeAs(
  tx: Tx,
  role: string,
  statement: string,
): Promise<string> {
  await tx.unsafe(`set local role ${role}`);
  const result = await run(tx, statement);
  await tx.unsafe("reset role");
  return result.outcome === "rows"
    ? "accepted"
    : `${result.code} ${result.message}`;
}

describe("L3C-T2 the freeze is a closed list of roles (modele §7, L3BS-2)", () => {
  it("L3C-T2 an influx_% role outside the list is refused even with every right (55000 campaign_not_editable)", async () => {
    const outcome = await scenario(async (tx) => {
      await temporaryWriter(tx, "influx_worker");
      return writeAs(
        tx,
        "influx_worker",
        `update campaigns.campaigns set title = 'A title from outside' where id = '${campaignA}'`,
      );
    });
    expect(outcome).toBe(`${NOT_IN_PREREQUISITE_STATE} campaign_not_editable`);
  });

  it("L3C-T2 the owner of queue 7 writes a pending campaign and its decisions' passages, never a published campaign's entry", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      await submittedA(tx);
      const published = await otherCampaign(tx, { status: "published" });
      await temporaryWriter(tx, "influx_campaign_review_definer");
      const role = "influx_campaign_review_definer";
      return {
        pending: await writeAs(
          tx,
          role,
          `update campaigns.campaigns set title = 'A corrected title' where id = '${campaignA}'`,
        ),
        publication: await writeAs(
          tx,
          role,
          `update campaigns.campaigns set status = 'rejected' where id = '${campaignA}'`,
        ),
        publishedEntry: await writeAs(
          tx,
          role,
          `update campaigns.campaigns set title = 'A title after publication' where id = '${published}'`,
        ),
        backToDraft: await writeAs(
          tx,
          role,
          `update campaigns.campaigns set status = 'draft' where id = '${published}'`,
        ),
      };
    });
    expect(outcome).toEqual({
      pending: "accepted",
      publication: "accepted",
      publishedEntry: `${NOT_IN_PREREQUISITE_STATE} campaign_not_editable`,
      backToDraft: `${NOT_IN_PREREQUISITE_STATE} campaign_not_editable`,
    });
  });

  it("L3C-T2 the owner of the automatic closure only closes a published or paused campaign", async () => {
    const outcome = await scenario(async (tx) => {
      const published = await otherCampaign(tx, { status: "published" });
      await temporaryWriter(tx, "influx_maintenance_definer");
      const role = "influx_maintenance_definer";
      return {
        close: await writeAs(
          tx,
          role,
          `update campaigns.campaigns set status = 'closed' where id = '${published}'`,
        ),
        draftTitle: await writeAs(
          tx,
          role,
          `update campaigns.campaigns set title = 'A title by the worker' where id = '${campaignA}'`,
        ),
      };
    });
    expect(outcome).toEqual({
      close: "accepted",
      draftTitle: `${NOT_IN_PREREQUISITE_STATE} campaign_not_editable`,
    });
  });

  it("L3C-T2 the brand's door owner keeps the brand's passages only: paused from published, never published from pending", async () => {
    const outcome = await scenario(async (tx) => {
      await readyA(tx);
      await submittedA(tx);
      const published = await otherCampaign(tx, { status: "published" });
      await temporaryWriter(tx, "influx_campaign_definer");
      await tx`
        select pg_catalog.set_config('influx.account', ${brandA}, true),
               pg_catalog.set_config('influx.role', 'advertiser', true)`;
      const role = "influx_campaign_definer";
      return {
        pause: await writeAs(
          tx,
          role,
          `update campaigns.campaigns set status = 'paused' where id = '${published}'`,
        ),
        publish: await writeAs(
          tx,
          role,
          `update campaigns.campaigns set status = 'published' where id = '${campaignA}'`,
        ),
      };
    });
    expect(outcome).toEqual({
      pause: "accepted",
      publish: `${NOT_IN_PREREQUISITE_STATE} campaign_not_editable`,
    });
  });
});

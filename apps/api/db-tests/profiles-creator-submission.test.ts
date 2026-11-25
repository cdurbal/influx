// L2G commit 03 — the submission of a creator profile and the regime of a published one, 0243
// (jalons/l2g/03.md; l2g/modele.md points 1, 6, 7, 11, 15, §2, §3 "0243", §3 bis; fiche invariants 4,
// 7 to 9, 16; 07 RG4, RG5, RG8 to RG10, RG86 to RG90; 08 RG16; L2DS-4, L2DS-6). L2G-D4 the submission:
// the nominative list (portfolio and « Compte vérifié » included), three visuals deposited, the score
// recomputed by the base; L2G-D5 a moderated field of a published profile: a revision, the validated
// version served (CA48); L2G-D6 an immediate field applies at once (CA49), the switch of RG8; the
// guard (suspended, the status); a deleted line takes its revisions; T14 another's line or visual;
// L2G-D7 (the role change itself) lives in t8-account-actions.test.ts. The doors run in rolled-back
// transactions of the local superuser, as apps/api calls them; a publication is a direct write (the
// decisions of 0244 do not exist yet).
import {
  accountIdOf,
  CREATOR_SOCIAL_ACCOUNT_IDS,
  inRolledBackTransaction,
} from "@influx/test-kit/db";
import { createHash } from "node:crypto";
import type postgres from "postgres";
import { beforeAll, describe, expect, it } from "vitest";
import {
  actAsMember,
  localSuperuser,
  migrationRole,
  testDataSet,
} from "./support.ts";

type Tx = postgres.TransactionSql;

const CHECK_VIOLATION = "23514";
const INVALID_PARAMETER = "22023";
const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_IN_PREREQUISITE_STATE = "55000";

const creatorA = accountIdOf("creator", "a");
const creatorB = accountIdOf("creator", "b");
const brandA = accountIdOf("advertiser", "a");
const agentA = accountIdOf("agent", "a");

type Refusal = {
  outcome: "error";
  code: string;
  message: string;
  detail: string | undefined;
};
type Parameter = postgres.ParameterOrJSON<never> | undefined;
type Outcome<T> = { outcome: "rows"; rows: T[]; count: number } | Refusal;

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
    return {
      outcome: "rows",
      rows: [...result] as T[],
      count: Math.max(result.count, result.length),
    };
  } catch (error) {
    const found = error as { code?: string; message?: string; detail?: string };
    return {
      outcome: "error",
      code: found.code ?? "unknown",
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

function asCreator<T>(
  tx: Tx,
  account: string,
  fn: () => Promise<T>,
): Promise<T> {
  return actAsMember(
    tx,
    "influx_creator",
    { accountId: account, role: "creator", aal: "aal1" },
    fn,
  );
}

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

const SUBMIT = "select * from profiles.submit_own_creator_profile()";
const REVISE =
  "select * from profiles.submit_own_creator_revision($1::text, $2::text, $3::jsonb)";
const CAPTION =
  "select * from profiles.set_own_portfolio_caption($1::uuid, $2::text, $3::boolean)";
const RECORD =
  "select profiles.record_own_creator_profile_change() as recorded";

type Submitted = {
  status: string;
  missing_fields: string[];
  entry_id: string | null;
};
type Revised = { revision_status: string | null; entry_id: string | null };

const HEADLINE = "Créatrice lifestyle à Rennes, voyages et cuisine";
const BIO =
  "Je partage chaque semaine des recettes de saison, des adresses de voyage et des routines simples. " +
  "Mes abonnés aiment le ton direct et les formats courts, tournés avec soin.";

/**
 * The blocks 1 to 5 complete: the texts, the main topic, the availability; the primary line of the
 * data set (its handle, its audience) with its URL and its figures confirmed.
 */
async function fillProfile(tx: Tx, account: string): Promise<string> {
  const side = account === creatorA ? "a" : "b";
  const line = CREATOR_SOCIAL_ACCOUNT_IDS[side];
  const host = side === "a" ? "www.instagram.com" : "www.tiktok.com";
  return asCreator(tx, account, async () => {
    await tx`
      update profiles.creator_public_profiles
         set headline = ${HEADLINE}, bio = ${BIO}, primary_topic_code = 'food',
             availability_band = 'lt_1m'
       where account_id = ${account}`;
    await tx`
      update profiles.creator_social_accounts
         set profile_url = ${`https://${host}/t2_creator_${side}`}
       where id = ${line}`;
    await tx`select profiles.confirm_own_creator_figures(${line}::uuid, 48000, 12, 30)`;
    return line;
  });
}

const sha = (seed: string) => createHash("sha256").update(seed).digest("hex");

/** `account` deposits `count` visuals through the doors of 0242; their ids. */
async function deposit(
  tx: Tx,
  account: string,
  count: number,
): Promise<string[]> {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = await asCreator(tx, account, async () => {
      const [begun] = await rows<{ item_id: string }>(
        tx,
        "select * from profiles.begin_portfolio_upload($1::integer, null)",
        [500_000],
      );
      if (begun === undefined) throw new Error("no deposit");
      await rows(
        tx,
        "select * from profiles.store_portfolio_item($1::uuid, 400000, 1080, 1350, $2::text)",
        [begun.item_id, sha(begun.item_id)],
      );
      return begun.item_id;
    });
    ids.push(id);
  }
  return ids;
}

/** An active « Compte vérifié » on `line`, written directly as the decision of 0224 would. */
async function accountBadge(tx: Tx, account: string, line: string) {
  const [request] = await tx<{ id: string }[]>`
    insert into verification.verification_requests
      (account_id, social_account_id, network_code, level, status)
    values (${account}, ${line}, 'instagram', 'account_verified', 'pending')
    returning id::text`;
  await tx`
    update verification.verification_requests
       set status = 'approved', decided_by_account_id = ${agentA}, decided_at = now(),
           closed_at = now()
     where id = ${request?.id ?? null}`;
  await tx`
    insert into verification.badges
      (account_id, social_account_id, network_code, request_id, level, granted_by_account_id,
       granted_at, evidence_source, observed_handle_at_decision)
    values (${account}, ${line}, 'instagram', ${request?.id ?? null}, 'account_verified',
            ${agentA}, now(), 'public_profile', 'x')`;
}

/** The decision of 0244, written directly: published, the main line listed. */
async function publish(tx: Tx, account: string): Promise<void> {
  await tx`
    update profiles.creator_public_profiles set status = 'published', published_at = now()
     where account_id = ${account}`;
  await tx`
    update profiles.creator_public_networks set listed_at = now() where account_id = ${account}`;
}

async function statusOf(tx: Tx, account: string): Promise<string | undefined> {
  const [row] = await tx<{ status: string }[]>`
    select status::text as status from profiles.creator_public_profiles
     where account_id = ${account}`;
  return row?.status;
}

async function scoreOf(tx: Tx, account: string): Promise<number | undefined> {
  const [row] = await tx<{ score: number }[]>`
    select completeness_percent::int as score from profiles.creator_identities
     where account_id = ${account}`;
  return row?.score;
}

async function registerOf(tx: Tx, account: string, event: string) {
  return tx<{ payload: Record<string, unknown> }[]>`
    select payload - 'db_session_user' as payload from audit.audit_events
     where event_type = ${event} and subject_type = 'creator_profile' and subject_id = ${account}
     order by seq`;
}

beforeAll(async () => {
  await testDataSet();
});

// ---------------------------------------------------------------------------------------------
// The catalogues of queue 2
// ---------------------------------------------------------------------------------------------

describe("modele point 6, §2: the moderated creator fields and the reasons of 07 RG96", () => {
  it("lists the six creator fields, their table and their label key", async () => {
    const found = await migrationRole()<
      { code: string; target_table: string; label_key: string }[]
    >`
      select code, target_table, label_key from profiles.moderated_fields
       where profile_kind = 'creator' and is_active order by code`;
    expect(found).toEqual(
      [
        ["creator.bio", "profiles.creator_public_profiles"],
        ["creator.headline", "profiles.creator_public_profiles"],
        ["creator.network_handle", "profiles.creator_social_accounts"],
        ["creator.network_line", "profiles.creator_public_networks"],
        ["creator.network_url", "profiles.creator_social_accounts"],
        ["creator.portfolio_caption", "profiles.portfolio_items"],
      ].map(([code, table]) => ({
        code,
        target_table: table,
        label_key: `field.${code}`,
      })),
    );
  });

  it("lists the ten reasons of RG96 in order, `other` alone requiring the message", async () => {
    const found = await migrationRole()<
      {
        code: string;
        label_key: string;
        message_key: string;
        requires_member_message: boolean;
        next_step: string;
      }[]
    >`
      select code, label_key, message_key, requires_member_message, next_step
        from profiles.creator_rejection_reasons order by position`;
    const fix = [
      "identifier_in_text",
      "bio_insufficient",
      "portfolio_insufficient",
      "portfolio_non_compliant",
      "network_link_inconsistent",
      "figures_inconsistent",
      "topic_inconsistent",
    ];
    const contact = ["illicit_content", "age_doubt", "other"];
    expect(found).toEqual(
      [...fix, ...contact].map((code) => ({
        code,
        label_key: `reason.profiles_creator.${code}`,
        message_key: `creatorProfileDecision.reason.${code}`,
        requires_member_message: code === "other",
        next_step: fix.includes(code) ? "fix" : "contact",
      })),
    );
  });
});

// ---------------------------------------------------------------------------------------------
// L2G-D4: the submission
// ---------------------------------------------------------------------------------------------

describe("L2G-D4: the submission names what is missing, needs three visuals and recomputes the score (07 RG4, RG90, L2DS-4)", () => {
  it("answers the nominative list in the order of the form, portfolio and « Compte vérifié » last, and writes nothing", async () => {
    const outcome = await scenario(async (tx) => {
      const submitted = await asCreator(tx, creatorB, () =>
        rows<Submitted>(tx, SUBMIT),
      );
      return {
        submitted,
        status: await statusOf(tx, creatorB),
        entries: await tx`
          select 1 from profiles.creator_review_entries
           where account_id = ${creatorB} and state = 'open'`,
        lines: await registerOf(tx, creatorB, "creator_profile.submitted"),
      };
    });
    expect(outcome.submitted).toEqual([
      {
        status: "draft",
        missing_fields: [
          "headline",
          "bio",
          "primary_topic",
          "profile_url",
          "figures_date",
          "availability",
          "portfolio",
          "account_verified",
        ],
        entry_id: null,
      },
    ]);
    expect(outcome.status).toBe("draft");
    expect(outcome.entries).toHaveLength(0);
    expect(outcome.lines).toHaveLength(0);
  });

  it("refuses two visuals (RG4: three deposited) and an absent « Compte vérifié » (08 RG16)", async () => {
    const outcome = await scenario(async (tx) => {
      const line = await fillProfile(tx, creatorA);
      await deposit(tx, creatorA, 2);
      const twoVisuals = await asCreator(tx, creatorA, () =>
        rows<Submitted>(tx, SUBMIT),
      );
      await deposit(tx, creatorA, 1);
      const noBadge = await asCreator(tx, creatorA, () =>
        rows<Submitted>(tx, SUBMIT),
      );
      await accountBadge(tx, creatorA, line);
      return { twoVisuals, noBadge };
    });
    expect(outcome.twoVisuals[0]?.missing_fields).toEqual([
      "portfolio",
      "account_verified",
    ]);
    expect(outcome.noBadge[0]?.missing_fields).toEqual(["account_verified"]);
  });

  it("submits a complete profile: pending_review, the entry `submission` with its deadlines, the line of the register, the score stored by the base", async () => {
    const outcome = await scenario(async (tx) => {
      const line = await fillProfile(tx, creatorA);
      await deposit(tx, creatorA, 3);
      await accountBadge(tx, creatorA, line);
      // L2DS-4: a stale value in the column is never what the base keeps
      await tx`
        update profiles.creator_identities set completeness_percent = 3
         where account_id = ${creatorA}`;
      const first = await asCreator(tx, creatorA, () =>
        rows<Submitted>(tx, SUBMIT),
      );
      const again = await asCreator(tx, creatorA, () =>
        rows<Submitted>(tx, SUBMIT),
      );
      const [entry] = await tx<
        {
          id: string;
          kind: string;
          state: string;
          deadlines: boolean;
        }[]
      >`
        select id::text, kind::text, state::text,
               sla_due_at > created_at and escalate_at > sla_due_at as deadlines
          from profiles.creator_review_entries
         where account_id = ${creatorA} and state = 'open'`;
      return {
        first,
        again,
        entry,
        status: await statusOf(tx, creatorA),
        score: await scoreOf(tx, creatorA),
        lines: await registerOf(tx, creatorA, "creator_profile.submitted"),
      };
    });
    const entry = outcome.entry?.id;
    expect(outcome.first).toEqual([
      { status: "pending_review", missing_fields: [], entry_id: entry },
    ]);
    // submitted again while waiting: nothing written, the open entry answered
    expect(outcome.again).toEqual(outcome.first);
    expect(outcome.entry).toMatchObject({
      kind: "submission",
      state: "open",
      deadlines: true,
    });
    expect(outcome.status).toBe("pending_review");
    // RG87: headline 5, bio 10, topic 5; from the data set secondary 2, tone 2, languages 3,
    // country 1, ages 4, genders 3, offer line 8, formats 3, usage right 2, a request filed 2; first
    // line 16, main country 10, availability 2, three visuals 6
    expect(outcome.score).toBe(84);
    expect(outcome.lines).toEqual([
      { payload: { from_status: "draft", entry_id: entry } },
    ]);
  });

  it("refuses a published or suspended profile (55000 profile_state) and any caller but its creator (42501)", async () => {
    const outcome = await scenario(async (tx) => {
      await tx`
        update profiles.creator_public_profiles set status = 'published', published_at = now()
         where account_id = ${creatorA}`;
      const published = await asCreator(tx, creatorA, () => run(tx, SUBMIT));
      const advertiser = await actAsMember(
        tx,
        "influx_advertiser",
        { accountId: brandA, role: "advertiser", aal: "aal1" },
        () => run(tx, SUBMIT),
      );
      return { published, advertiser };
    });
    expect(outcome.published).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "profile_state", "published"),
    );
    expect(outcome.advertiser).toEqual(refused(INSUFFICIENT_PRIVILEGE));
  });
});

// ---------------------------------------------------------------------------------------------
// L2G-D5: a moderated field of a published profile
// ---------------------------------------------------------------------------------------------

describe("L2G-D5: on a published profile a moderated field waits in a revision, the validated version served (07 RG9, CA48)", () => {
  it("refuses the headline written directly, deposits it as a revision, and withdraws it on a return to the validated value", async () => {
    const outcome = await scenario(async (tx) => {
      await fillProfile(tx, creatorA);
      await publish(tx, creatorA);
      return asCreator(tx, creatorA, async () => {
        const direct = await run(
          tx,
          `update profiles.creator_public_profiles set headline = 'Un autre titre assez long'
            where account_id = '${creatorA}'`,
        );
        const proposed = await rows<Revised>(tx, REVISE, [
          "creator.headline",
          undefined,
          "Un autre titre assez long, modéré",
        ]);
        const repeated = await rows<Revised>(tx, REVISE, [
          "creator.headline",
          undefined,
          "Un autre titre assez long, modéré",
        ]);
        const [served] = await tx<{ headline: string }[]>`
          select headline from profiles.creator_public_profiles where account_id = ${creatorA}`;
        const back = await rows<Revised>(tx, REVISE, [
          "creator.headline",
          undefined,
          HEADLINE,
        ]);
        const [entry] = await tx<{ kind: string; state: string }[]>`
          select kind::text, state::text from profiles.creator_review_entries
           where id = ${proposed[0]?.entry_id ?? null}`;
        return { direct, proposed, repeated, served, back, entry };
      });
    });
    expect(outcome.direct).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "moderated_field", "creator.headline"),
    );
    expect(outcome.proposed[0]?.revision_status).toBe("pending_review");
    expect(outcome.repeated).toEqual(outcome.proposed);
    expect(outcome.served?.headline).toBe(HEADLINE);
    expect(outcome.back).toEqual([
      {
        revision_status: "withdrawn",
        entry_id: outcome.proposed[0]?.entry_id,
      },
    ]);
    // nothing left to examine: the revision entry withdrawn with it
    expect(outcome.entry).toEqual({ kind: "revision", state: "withdrawn" });
  });

  it("refuses a bio emptied (23514 bio), a revision outside published (55000) and an unknown field (22023)", async () => {
    const outcome = await scenario(async (tx) => {
      await fillProfile(tx, creatorA);
      const draft = await asCreator(tx, creatorA, () =>
        run(tx, REVISE, ["creator.bio", undefined, BIO]),
      );
      await publish(tx, creatorA);
      return asCreator(tx, creatorA, async () => ({
        draft,
        emptied: await run(tx, REVISE, [
          "creator.bio",
          undefined,
          "Trop court.",
        ]),
        unknown: await run(tx, REVISE, [
          "advertiser.presentation",
          undefined,
          "x",
        ]),
      }));
    });
    expect(outcome.draft).toEqual(
      refused(NOT_IN_PREREQUISITE_STATE, "profile_state", "draft"),
    );
    expect(outcome.emptied).toEqual(refused(CHECK_VIOLATION, undefined, "bio"));
    expect(outcome.unknown).toEqual(
      refused(INVALID_PARAMETER, "field", "field"),
    );
  });

  it("freezes the handle and the URL of a listed line, but the handle under an active « Compte vérifié » (queue 6 alone)", async () => {
    const outcome = await scenario(async (tx) => {
      const line = await fillProfile(tx, creatorA);
      await publish(tx, creatorA);
      const write = (assignment: string) =>
        asCreator(tx, creatorA, () =>
          run(
            tx,
            `update profiles.creator_social_accounts set ${assignment} where id = '${line}'`,
          ),
        );
      const handle = await write("handle = 'other_handle'");
      const url = await write(
        "profile_url = 'https://www.instagram.com/other_handle'",
      );
      const revised = await asCreator(tx, creatorA, () =>
        rows<Revised>(tx, REVISE, [
          "creator.network_url",
          line,
          "https://www.instagram.com/other_handle",
        ]),
      );
      await accountBadge(tx, creatorA, line);
      const verifiedHandle = await write("handle = 'other_handle'");
      const verifiedRevision = await asCreator(tx, creatorA, () =>
        run(tx, REVISE, ["creator.network_handle", line, "third_handle"]),
      );
      return { handle, url, revised, verifiedHandle, verifiedRevision };
    });
    expect(outcome.handle).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "moderated_field",
        "creator.network_handle",
      ),
    );
    expect(outcome.url).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "moderated_field",
        "creator.network_url",
      ),
    );
    expect(outcome.revised[0]?.revision_status).toBe("pending_review");
    expect(outcome.verifiedHandle).toMatchObject({ outcome: "rows", count: 1 });
    expect(outcome.verifiedRevision).toEqual(
      refused(INVALID_PARAMETER, "field", "field"),
    );
  });

  it("adds a line unlisted, never main, proposes it (network_line) and withdraws its revisions when it is deleted", async () => {
    const outcome = await scenario(async (tx) => {
      await fillProfile(tx, creatorA);
      await publish(tx, creatorA);
      return asCreator(tx, creatorA, async () => {
        const main = await run(
          tx,
          `insert into profiles.creator_social_accounts
             (account_id, network_code, is_primary, handle)
           values ('${creatorA}', 'tiktok', true, 'tk_handle')`,
        );
        const [added] = await rows<{ id: string }>(
          tx,
          `insert into profiles.creator_social_accounts (account_id, network_code, handle)
           values ('${creatorA}', 'tiktok', 'tk_handle') returning id::text`,
        );
        const id = added?.id ?? "";
        const promoted = await run(
          tx,
          `update profiles.creator_social_accounts set is_primary = true where id = '${id}'`,
        );
        const listing = await rows<Revised>(tx, REVISE, [
          "creator.network_line",
          id,
          {},
        ]);
        const handleOfUnlisted = await run(tx, REVISE, [
          "creator.network_handle",
          id,
          "tk_other",
        ]);
        await tx.unsafe(
          `delete from profiles.creator_social_accounts where id = '${id}'`,
        );
        const [left] = await tx<{ status: string }[]>`
          select status::text from profiles.creator_field_revisions
           where account_id = ${creatorA} and row_key = ${id}`;
        return { main, listing, promoted, handleOfUnlisted, left };
      });
    });
    expect(outcome.main).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "moderated_field",
        "creator.network_line",
      ),
    );
    expect(outcome.promoted).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "moderated_field",
        "creator.network_line",
      ),
    );
    expect(outcome.listing[0]?.revision_status).toBe("pending_review");
    expect(outcome.handleOfUnlisted).toEqual(
      refused(INVALID_PARAMETER, "row_key", "row_key"),
    );
    expect(outcome.left?.status).toBe("withdrawn");
  });

  it("re-validates the caption of an approved visual (RG82), writes the statement of RG83, and sets the caption of a pending one directly", async () => {
    const outcome = await scenario(async (tx) => {
      await fillProfile(tx, creatorA);
      const [approved, pending] = await deposit(tx, creatorA, 2);
      await tx`
        update profiles.portfolio_items
           set state = 'approved', decided_by_account_id = ${agentA}, decided_at = now()
         where id = ${approved ?? null}`;
      await publish(tx, creatorA);
      return asCreator(tx, creatorA, async () => {
        const direct = await run(
          tx,
          `update profiles.portfolio_items set caption = 'Atelier' where id = '${approved}'`,
        );
        const revised = await rows<Revised>(tx, CAPTION, [
          approved,
          "Atelier de la marque Lumen",
          true,
        ]);
        const pendingSet = await rows<Revised>(tx, CAPTION, [
          pending,
          "Dans ma cuisine",
          false,
        ]);
        const bad = await run(tx, CAPTION, [pending, "deux\nlignes", false]);
        const nothingDeclared = await run(tx, CAPTION, [pending, null, true]);
        const found = await tx<
          { id: string; caption: string | null; declared: boolean }[]
        >`
          select id::text, caption, brand_declaration_id is not null as declared
            from profiles.portfolio_items where id in (${approved ?? null}, ${pending ?? null})`;
        const statements = await tx<{ caption: string }[]>`
          select caption from profiles.portfolio_brand_declarations
           where portfolio_item_id = ${approved ?? null}`;
        const [revision] = await tx<{ value: Record<string, unknown> }[]>`
          select proposed_value as value from profiles.creator_field_revisions
           where row_key = ${approved ?? null} and status = 'pending_review'`;
        return {
          direct,
          revised,
          pendingSet,
          bad,
          nothingDeclared,
          found,
          statements,
          revision,
        };
      });
    });
    // a member never writes a visual: only through the doors (the guard holds the door's write)
    expect(outcome.direct).toEqual(refused(INSUFFICIENT_PRIVILEGE));
    expect(outcome.revised[0]?.revision_status).toBe("pending_review");
    expect(outcome.pendingSet).toEqual([
      { revision_status: null, entry_id: null },
    ]);
    expect(outcome.bad).toEqual(
      refused(INVALID_PARAMETER, "caption", "caption"),
    );
    expect(outcome.nothingDeclared).toEqual(
      refused(INVALID_PARAMETER, "caption", "caption"),
    );
    // the approved caption is still the validated one (none), the pending one changed at once
    expect(outcome.found.map((row) => row.caption).sort()).toEqual([
      "Dans ma cuisine",
      null,
    ]);
    expect(outcome.statements).toEqual([
      { caption: "Atelier de la marque Lumen" },
    ]);
    expect(outcome.revision?.value).toMatchObject({
      caption: "Atelier de la marque Lumen",
    });
  });
});

// ---------------------------------------------------------------------------------------------
// L2G-D6: an immediate field, the switch of RG8, the score and lead.updated
// ---------------------------------------------------------------------------------------------

describe("L2G-D6: on a published profile an immediate field applies at once (07 RG9, CA49, RG8)", () => {
  it("lets the creator change his tones, his formats and his visibility; the change records the score and one lead.updated", async () => {
    const outcome = await scenario(async (tx) => {
      await fillProfile(tx, creatorA);
      await publish(tx, creatorA);
      return asCreator(tx, creatorA, async () => {
        const tones = await run(
          tx,
          `insert into profiles.creator_tones (account_id, slot, tone_code)
           values ('${creatorA}', 2, 'expert')`,
        );
        const formats = await run(
          tx,
          `delete from profiles.creator_formats where account_id = '${creatorA}'`,
        );
        const visibility = await run(
          tx,
          `update profiles.creator_public_profiles set is_searchable = false
            where account_id = '${creatorA}'`,
        );
        const recorded = await rows<{ recorded: boolean }>(tx, RECORD);
        return { tones, formats, visibility, recorded };
      });
    });
    expect(outcome.tones).toMatchObject({ outcome: "rows", count: 1 });
    expect(outcome.formats).toMatchObject({ outcome: "rows", count: 1 });
    expect(outcome.visibility).toMatchObject({ outcome: "rows", count: 1 });
    expect(outcome.recorded).toEqual([{ recorded: true }]);
  });

  it("stores the score of the base on a draft, without lead.updated (false)", async () => {
    const outcome = await scenario(async (tx) => {
      await fillProfile(tx, creatorA);
      const before = await tx<{ n: number }[]>`
        select count(*)::int as n from leads.outbox_events
         where subject_key = ${`account:${creatorA}`} and event_type = 'lead.updated'`;
      const recorded = await asCreator(tx, creatorA, () =>
        rows<{ recorded: boolean }>(tx, RECORD),
      );
      const after = await tx<{ n: number }[]>`
        select count(*)::int as n from leads.outbox_events
         where subject_key = ${`account:${creatorA}`} and event_type = 'lead.updated'`;
      return {
        recorded,
        added: (after[0]?.n ?? 0) - (before[0]?.n ?? 0),
        score: await scoreOf(tx, creatorA),
      };
    });
    expect(outcome.recorded).toEqual([{ recorded: false }]);
    expect(outcome.added).toBe(0);
    // the score of the complete profile above but the three visuals (84 - 6)
    expect(outcome.score).toBe(78);
  });
});

// ---------------------------------------------------------------------------------------------
// §3 bis: the guard, T14, L2DS-6
// ---------------------------------------------------------------------------------------------

describe("§3 bis, T14, L2DS-6: the guard of a creator profile, another's rows, the role kept outside draft", () => {
  it("freezes a suspended profile, every list and switch included (55000 profile_state suspended)", async () => {
    const outcome = await scenario(async (tx) => {
      await tx`
        update profiles.creator_public_profiles set status = 'suspended'
         where account_id = ${creatorA}`;
      return asCreator(tx, creatorA, async () => ({
        list: await run(
          tx,
          `insert into profiles.creator_tones (account_id, slot, tone_code)
           values ('${creatorA}', 2, 'expert')`,
        ),
        switch: await run(
          tx,
          `update profiles.creator_public_profiles set is_searchable = false
            where account_id = '${creatorA}'`,
        ),
        sector: await run(
          tx,
          `delete from profiles.creator_refused_sectors where account_id = '${creatorA}'`,
        ),
      }));
    });
    const frozen = refused(
      NOT_IN_PREREQUISITE_STATE,
      "profile_state",
      "suspended",
    );
    expect(outcome).toEqual({ list: frozen, switch: frozen, sector: frozen });
  });

  it("answers another's line and another's visual as unknown ones (42501), and gives the advertiser nothing on queue 2", async () => {
    const outcome = await scenario(async (tx) => {
      await fillProfile(tx, creatorA);
      const lineB = await fillProfile(tx, creatorB);
      const [visualB] = await deposit(tx, creatorB, 1);
      await publish(tx, creatorA);
      const line = await asCreator(tx, creatorA, () =>
        run(tx, REVISE, [
          "creator.network_url",
          lineB,
          "https://www.instagram.com/x",
        ]),
      );
      const visual = await asCreator(tx, creatorA, () =>
        run(tx, CAPTION, [visualB, "Une légende", false]),
      );
      const advertiser = await actAsMember(
        tx,
        "influx_advertiser",
        { accountId: brandA, role: "advertiser", aal: "aal1" },
        async () => ({
          entries: await run(
            tx,
            "select 1 from profiles.creator_review_entries",
          ),
          revisions: await run(
            tx,
            "select 1 from profiles.creator_field_revisions",
          ),
        }),
      );
      return { line, visual, advertiser };
    });
    expect(outcome.line).toEqual(refused(INSUFFICIENT_PRIVILEGE, "forbidden"));
    expect(outcome.visual).toEqual(
      refused(INSUFFICIENT_PRIVILEGE, "forbidden"),
    );
    expect(outcome.advertiser).toEqual({
      entries: refused(INSUFFICIENT_PRIVILEGE),
      revisions: refused(INSUFFICIENT_PRIVILEGE),
    });
  });

  it("keeps the creator role of a profile that is not a draft (55000 creator_profile_not_draft), lets a draft's go", async () => {
    const outcome = await scenario(async (tx) => {
      await tx`
        update profiles.creator_public_profiles set status = 'pending_review'
         where account_id = ${creatorA}`;
      const pending = await run(
        tx,
        `delete from identity.account_roles where account_id = '${creatorA}' and role = 'creator'`,
      );
      const draft = await run(
        tx,
        `delete from identity.account_roles where account_id = '${creatorB}' and role = 'creator'`,
      );
      return { pending, draft };
    });
    expect(outcome.pending).toEqual(
      refused(
        NOT_IN_PREREQUISITE_STATE,
        "creator_profile_not_draft",
        "creator_profile_not_draft",
      ),
    );
    expect(outcome.draft).toMatchObject({ outcome: "rows", count: 1 });
  });
});

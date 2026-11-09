// L2F commit 09 — the verification opened by an agent, 0234 (jalons/l2f/09.md; l2f/modele.md §1
// point 14, §2, §6; decisions-detail.md D83, A + A-bis; fiche invariants 9, 10, 12; 06 RG51, RG52;
// 08 RG9, RG53). L2F-D17: an agent opens the request of a member he knows (origin, reason, one
// request per triplet, the member's own taken over, never doubled; refusals: own account, unknown,
// other population, inactive, audience); the code is issued without its e-mail, one notice queued;
// no badge without a finding. A-bis: the verified login address on the website domain grants
// « Marque vérifiée » with the register consulted; a consumer mailbox, another domain or an
// unverified address refused; the TXT path stays. D83 Q4: an account the caller holds is his to
// decide on a request opened by an agent only. Each case runs in a rolled-back transaction of the
// local superuser, which writes the fixtures and acts as the members, the agents and the admins
// exactly as apps/api takes the role.
import {
  accountIdOf,
  CREATOR_SOCIAL_ACCOUNT_IDS,
  inRolledBackTransaction,
} from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { describe, expect, it } from "vitest";
import { actAsInternal, actAsMember, localSuperuser } from "./support.ts";

type Tx = postgres.TransactionSql;

const INSUFFICIENT_PRIVILEGE = "42501";
const NOT_IN_PREREQUISITE_STATE = "55000";
const INVALID_PARAMETER_VALUE = "22023";
const CHECK_VIOLATION = "23514";

const creatorA = accountIdOf("creator", "a");
const creatorB = accountIdOf("creator", "b");
const brandA = accountIdOf("advertiser", "a");
const brandB = accountIdOf("advertiser", "b");
const agentA = accountIdOf("agent", "a");
const agentB = accountIdOf("agent", "b");
const lineA = CREATOR_SOCIAL_ACCOUNT_IDS.a;
const lineB = CREATOR_SOCIAL_ACCOUNT_IDS.b;
const DOMAIN = "example.test";

type Parameter = postgres.ParameterOrJSON<never> | null | undefined;
type Outcome<T> =
  | { outcome: "rows"; rows: T[] }
  | { outcome: "error"; code: string; detail: string | undefined };

/** One statement in a savepoint of `tx`: its rows, or its SQLSTATE and detail. */
async function run<T = Record<string, unknown>>(
  tx: Tx,
  statement: string,
  parameters: readonly Parameter[] = [],
): Promise<Outcome<T>> {
  try {
    const rows = await tx.savepoint((savepoint) =>
      savepoint.unsafe(
        statement,
        parameters.map(
          (value) => value ?? null,
        ) as postgres.ParameterOrJSON<never>[],
      ),
    );
    return { outcome: "rows", rows: [...rows] as T[] };
  } catch (error) {
    const found = error as { code?: string; detail?: string };
    return {
      outcome: "error",
      code: found.code ?? "unknown",
      detail: found.detail,
    };
  }
}

function refused(code: string, detail?: string) {
  return detail === undefined
    ? { outcome: "error", code }
    : { outcome: "error", code, detail };
}

function scenario<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return inRolledBackTransaction(localSuperuser(), fn);
}

/** Runs `fn` as the agent `account`, aal2 unless said otherwise. */
function asAgent<T>(
  tx: Tx,
  account: string,
  fn: () => Promise<T>,
  aal: "aal1" | "aal2" = "aal2",
): Promise<T> {
  return actAsInternal(
    tx,
    "influx_agent",
    { accountId: account, role: "agent", aal },
    fn,
  );
}

const OPEN_FOR =
  "select request_id::text, status, created from verification.open_request_for_member($1::uuid, $2::uuid, $3::verification.badge_level, $4::text, $5::text, $6::text, $7::text, $8::text)";
const OPEN_OWN =
  "select request_id::text, status, created from verification.open_own_request($1::uuid, $2::verification.badge_level)";
const OPEN_REQUEST = "select * from verification.open_request($1::uuid)";
const DOSSIER =
  "select opened_by, opening_reason_code, opening_comment, login_address_eligible from verification.read_request_dossier($1::uuid)";
const GRANT_ACCOUNT =
  "select * from verification.grant_account_verified($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text)";
const GRANT_BRAND =
  "select * from verification.grant_brand_verified($1::uuid, $2::text, $3::text, $4::text, $5::text, $6::uuid, $7::text)";
const GRANT_BY_LOGIN =
  "select * from verification.grant_brand_verified_by_login($1::uuid, $2::text, $3::uuid, $4::text)";

type Opened = { request_id: string; status: string; created: boolean };

/** `fn` opened by `agent` for `account`; the row, or the refusal. */
function openFor(
  tx: Tx,
  agent: string,
  parameters: readonly Parameter[],
): Promise<Outcome<Opened>> {
  return asAgent(tx, agent, () => run<Opened>(tx, OPEN_FOR, parameters));
}

async function opened(
  tx: Tx,
  agent: string,
  parameters: readonly Parameter[],
): Promise<Opened> {
  const result = await openFor(tx, agent, parameters);
  const row = result.outcome === "rows" ? result.rows[0] : undefined;
  if (row === undefined)
    throw new Error(`not opened: ${JSON.stringify(result)}`);
  return row;
}

/** `agent` claims the entry; its review token. */
async function claim(tx: Tx, agent: string, request: string): Promise<string> {
  const [row] = await asAgent(tx, agent, () =>
    tx.unsafe<{ outcome: string; review_token: string | null }[]>(
      OPEN_REQUEST,
      [request],
    ),
  );
  if (row?.review_token == null)
    throw new Error(`not claimed: ${JSON.stringify(row)}`);
  return row.review_token;
}

type RequestRow = {
  status: string;
  opened_by: string;
  author: string | null;
  reason: string | null;
  comment: string | null;
  submitted: boolean;
};

async function requestOf(
  tx: Tx,
  request: string,
): Promise<RequestRow | undefined> {
  const [row] = await tx<RequestRow[]>`
    select status::text, opened_by, opened_by_account_id::text as author,
           opening_reason_code as reason, opening_comment as comment,
           submitted_at is not null and sla_due_at is not null as submitted
      from verification.verification_requests where id = ${request}`;
  return row;
}

async function codesOf(
  tx: Tx,
  request: string,
): Promise<
  {
    code: string;
    kind: string;
    live: boolean;
    channel: string | null;
    domain: string | null;
  }[]
> {
  return tx`
    select code, kind, revoked_at is null as live, observed_channel as channel,
           observed_domain as domain
      from verification.ownership_codes where request_id = ${request} order by created_at, id`;
}

async function queueOf(tx: Tx, request: string): Promise<string[]> {
  const rows = await tx<{ type: string }[]>`
    select event_type as type from leads.outbox_events
     where payload ->> 'request_id' = ${request} order by id`;
  return rows.map((row) => row.type);
}

async function registerOf(
  tx: Tx,
  request: string,
): Promise<
  { code: string; actor: string | null; payload: Record<string, unknown> }[]
> {
  return tx`
    select event_type as code, actor_account_id::text as actor, payload
      from audit.audit_events where subject_id = ${request} order by seq`;
}

async function frSource(tx: Tx): Promise<string> {
  const [row] = await tx<{ id: string }[]>`
    select id::text from verification.registry_sources
     where country_code = 'FR' and is_active and source_type <> 'gleif' limit 1`;
  if (row === undefined) throw new Error("no FR source");
  return row.id;
}

describe("L2F-D17: the verification opened by an agent (D83 A, 0234)", () => {
  it("opens « Compte vérifié » of a known creator: pending, origin and reason, code without its e-mail, one notice; a second agent takes it over without doubling; no badge without the finding", async () => {
    await scenario(async (tx) => {
      const request = await opened(tx, agentA, [
        creatorA,
        lineA,
        "account_verified",
        "existing_client",
        null,
        null,
        null,
        null,
      ]);
      expect(request).toEqual({
        request_id: request.request_id,
        status: "pending",
        created: true,
      });
      expect(await requestOf(tx, request.request_id)).toEqual({
        status: "pending",
        opened_by: "agent",
        author: agentA,
        reason: "existing_client",
        comment: null,
        submitted: true,
      });
      const [live] = await codesOf(tx, request.request_id);
      expect(live).toMatchObject({
        kind: "network",
        live: true,
        channel: null,
      });
      // EC-L2F-09-3: one e-mail, the agent's notice, never the code e-mail
      expect(await queueOf(tx, request.request_id)).toEqual([
        "verification.agent_opened_notice",
      ]);
      const register = await registerOf(tx, request.request_id);
      expect(register.map((line) => line.code)).toEqual([
        "verification.requested",
        "verification.code_generated",
        "verification.submitted",
        "verification.opened_by_agent",
      ]);
      expect(register.at(-1)).toEqual({
        code: "verification.opened_by_agent",
        actor: agentA,
        payload: {
          level: "account_verified",
          reason_code: "existing_client",
          taken_over: false,
          responsible_agent: false,
        },
      });

      // D83 (7): the same triplet again, by another agent: taken over, never doubled, nothing written
      expect(
        await openFor(tx, agentB, [
          creatorA,
          lineA,
          "account_verified",
          "past_collaboration",
          null,
          null,
          null,
          null,
        ]),
      ).toEqual({
        outcome: "rows",
        rows: [
          { request_id: request.request_id, status: "pending", created: false },
        ],
      });
      expect((await requestOf(tx, request.request_id))?.author).toBe(agentA);
      expect((await requestOf(tx, request.request_id))?.reason).toBe(
        "existing_client",
      );
      expect(await queueOf(tx, request.request_id)).toEqual([
        "verification.agent_opened_notice",
      ]);
      expect(
        (await registerOf(tx, request.request_id)).at(-1)?.payload,
      ).toMatchObject({
        reason_code: "past_collaboration",
        taken_over: true,
      });
      // the member's own door meets the same request (RG14)
      expect(
        await actAsMember(
          tx,
          "influx_creator",
          { accountId: creatorA, role: "creator", aal: "aal1" },
          () => run(tx, OPEN_OWN, [lineA, "account_verified"]),
        ),
      ).toMatchObject(refused(NOT_IN_PREREQUISITE_STATE));

      // no badge without the finding: the code read on line, compared by the base (RG45)
      const token = await claim(tx, agentB, request.request_id);
      expect(
        await asAgent(tx, agentB, () =>
          run(tx, GRANT_ACCOUNT, [
            request.request_id,
            token,
            "INFLUX-22222222",
            "t2_creator_a",
            null,
            null,
          ]),
        ),
      ).toEqual(refused(INVALID_PARAMETER_VALUE, "code_mismatch"));
      const granted = await asAgent(tx, agentB, () =>
        run<{ outcome: string }>(tx, GRANT_ACCOUNT, [
          request.request_id,
          token,
          live?.code,
          "t2_creator_a",
          null,
          null,
        ]),
      );
      expect(granted).toMatchObject({
        outcome: "rows",
        rows: [{ outcome: "granted" }],
      });
    });
  });

  it("takes over the member's draft (origin member, code kept); D83 Q4: the responsible agent decides an agent-opened request only", async () => {
    await scenario(async (tx) => {
      const [own] = (await actAsMember(
        tx,
        "influx_creator",
        { accountId: creatorA, role: "creator", aal: "aal1" },
        () => tx.unsafe<Opened[]>(OPEN_OWN, [lineA, "account_verified"]),
      )) as Opened[];
      if (own === undefined) throw new Error("no draft");
      const [code] = await codesOf(tx, own.request_id);

      expect(
        await openFor(tx, agentA, [
          creatorA,
          lineA,
          "account_verified",
          "other",
          "Signed with us last spring",
          null,
          null,
          null,
        ]),
      ).toEqual({
        outcome: "rows",
        rows: [
          { request_id: own.request_id, status: "pending", created: false },
        ],
      });
      expect(await requestOf(tx, own.request_id)).toEqual({
        status: "pending",
        opened_by: "member",
        author: agentA,
        reason: "other",
        comment: "Signed with us last spring",
        submitted: true,
      });
      // the live code kept, no code drawn, no code e-mail besides the one of the member's opening
      expect(await codesOf(tx, own.request_id)).toEqual([code]);
      expect(await queueOf(tx, own.request_id)).toEqual([
        "verification.code_issued",
        "verification.agent_opened_notice",
      ]);

      // 08 RG53 kept on a request of member origin: agent A holds creator A
      await tx`update identity.accounts set owner_agent_id = ${agentA} where id = ${creatorA}`;
      expect(
        await asAgent(tx, agentA, () =>
          run(tx, OPEN_REQUEST, [own.request_id]),
        ),
      ).toEqual(refused(INSUFFICIENT_PRIVILEGE));

      // D83 Q4: the responsible agent opens and decides for his client
      await tx`update identity.accounts set owner_agent_id = ${agentA} where id = ${creatorB}`;
      const mine = await opened(tx, agentA, [
        creatorB,
        lineB,
        "account_verified",
        "invited_by_agent",
        null,
        null,
        null,
        null,
      ]);
      expect(
        (await registerOf(tx, mine.request_id)).at(-1)?.payload,
      ).toMatchObject({
        responsible_agent: true,
        taken_over: false,
      });
      await claim(tx, agentA, mine.request_id);
      expect(
        await asAgent(tx, agentA, () => run(tx, DOSSIER, [mine.request_id])),
      ).toEqual({
        outcome: "rows",
        rows: [
          {
            opened_by: "agent",
            opening_reason_code: "invited_by_agent",
            opening_comment: null,
            login_address_eligible: null,
          },
        ],
      });
      // the origin is written at the creation only, the opening frozen (EC-L2F-09-2)
      expect(
        await run(
          tx,
          "update verification.verification_requests set opened_by = 'member' where id = $1",
          [mine.request_id],
        ),
      ).toEqual(refused(NOT_IN_PREREQUISITE_STATE, "request_opening"));
    });
  });

  it("refuses an unknown or own account, another population, an inactive account, the audience, a reason or comment out of rule, a block given for nothing, and any caller but an agent in aal2", async () => {
    await scenario(async (tx) => {
      const row = (
        account: string,
        line: string | null,
        level: string,
        reason = "existing_client",
        comment: string | null = null,
        block: readonly (string | null)[] = [null, null, null],
      ): Parameter[] => [account, line, level, reason, comment, ...block];

      expect(
        await openFor(tx, agentA, row(randomUUID(), lineA, "account_verified")),
      ).toEqual(refused(INSUFFICIENT_PRIVILEGE));
      expect(
        await openFor(tx, agentA, row(agentA, null, "brand_verified")),
      ).toEqual(refused(INSUFFICIENT_PRIVILEGE));
      expect(
        await openFor(tx, agentA, row(creatorA, null, "brand_verified")),
      ).toEqual(refused(INSUFFICIENT_PRIVILEGE));
      expect(
        await openFor(tx, agentA, row(brandA, null, "account_verified")),
      ).toEqual(refused(INSUFFICIENT_PRIVILEGE));
      expect(
        await openFor(tx, agentA, row(creatorA, lineB, "account_verified")),
      ).toEqual(refused(INSUFFICIENT_PRIVILEGE));
      expect(
        await openFor(tx, agentA, row(creatorA, lineA, "audience_verified")),
      ).toEqual(refused(INVALID_PARAMETER_VALUE, "level"));
      expect(
        await openFor(
          tx,
          agentA,
          row(creatorA, lineA, "account_verified", "friend"),
        ),
      ).toEqual(refused(INVALID_PARAMETER_VALUE, "reason"));
      expect(
        await openFor(
          tx,
          agentA,
          row(creatorA, lineA, "account_verified", "other"),
        ),
      ).toEqual(refused(INVALID_PARAMETER_VALUE, "opening_comment"));
      expect(
        await openFor(
          tx,
          agentA,
          row(
            creatorA,
            lineA,
            "account_verified",
            "existing_client",
            "x".repeat(1001),
          ),
        ),
      ).toEqual(refused(INVALID_PARAMETER_VALUE, "opening_comment"));
      expect(
        await openFor(
          tx,
          agentA,
          row(creatorA, lineA, "account_verified", "existing_client", null, [
            "X SAS",
            "FR",
            "1",
          ]),
        ),
      ).toEqual(refused(INVALID_PARAMETER_VALUE, "internal_details_present"));
      // the brand already holds its block: the three fields stay NULL (EC-L2F-09-4)
      await tx`update profiles.advertiser_profiles set website_domain = ${DOMAIN} where account_id = ${brandA}`;
      expect(
        await openFor(
          tx,
          agentA,
          row(brandA, null, "brand_verified", "existing_client", null, [
            "X SAS",
            "FR",
            "1",
          ]),
        ),
      ).toEqual(refused(INVALID_PARAMETER_VALUE, "internal_details_present"));
      // a brand without a domain (CA26)
      expect(
        await openFor(tx, agentA, row(brandB, null, "brand_verified")),
      ).toEqual(refused(CHECK_VIOLATION, "website_domain_required"));
      await tx`update identity.accounts set status = 'suspended', suspended_at = now() where id = ${creatorB}`;
      expect(
        await openFor(tx, agentA, row(creatorB, lineB, "account_verified")),
      ).toEqual(refused(NOT_IN_PREREQUISITE_STATE, "account_unavailable"));
      // an agent in aal1, a member: refused before anything
      expect(
        await asAgent(
          tx,
          agentA,
          () => run(tx, OPEN_FOR, row(creatorA, lineA, "account_verified")),
          "aal1",
        ),
      ).toEqual(refused(INSUFFICIENT_PRIVILEGE));
      expect(
        await actAsMember(
          tx,
          "influx_creator",
          { accountId: creatorA, role: "creator", aal: "aal1" },
          () => run(tx, OPEN_FOR, row(creatorA, lineA, "account_verified")),
        ),
      ).toMatchObject(refused(INSUFFICIENT_PRIVILEGE));
      // nothing was opened
      const [count] = await tx<{ n: number }[]>`
        select count(*)::int as n from verification.verification_requests
         where opening_reason_code is not null`;
      expect(count?.n).toBe(0);
    });
  });

  it("A-bis: opens « Marque vérifiée » of a known brand, its block written when missing; the login address on the domain grants with the register, nothing asked of the brand", async () => {
    await scenario(async (tx) => {
      await tx`update profiles.advertiser_profiles set website_domain = ${DOMAIN} where account_id = ${brandB}`;
      await tx`delete from profiles.advertiser_internal_details where account_id = ${brandB}`;
      expect(
        await openFor(tx, agentA, [
          brandB,
          null,
          "brand_verified",
          "existing_client",
          null,
          null,
          null,
          null,
        ]),
      ).toEqual(refused(CHECK_VIOLATION, "internal_details_required"));
      expect(
        await openFor(tx, agentA, [
          brandB,
          null,
          "brand_verified",
          "existing_client",
          null,
          "B SAS",
          "ZZ",
          "B-1",
        ]),
      ).toEqual(refused(INVALID_PARAMETER_VALUE, "registration_country_code"));
      const request = await opened(tx, agentA, [
        brandB,
        null,
        "brand_verified",
        "existing_client",
        null,
        " B Brand SAS ",
        "fr",
        "RCS-B-1",
      ]);
      expect(request.created).toBe(true);
      const [block] = await tx`
        select legal_name, registration_country_code, registration_number
          from profiles.advertiser_internal_details where account_id = ${brandB}`;
      expect(block).toEqual({
        legal_name: "B Brand SAS",
        registration_country_code: "FR",
        registration_number: "RCS-B-1",
      });
      expect(
        (await codesOf(tx, request.request_id)).map((c) => [c.kind, c.live]),
      ).toEqual([["domain", true]]);
      expect(await queueOf(tx, request.request_id)).toEqual([
        "verification.agent_opened_notice",
      ]);

      const token = await claim(tx, agentB, request.request_id);
      expect(
        await asAgent(tx, agentB, () => run(tx, DOSSIER, [request.request_id])),
      ).toEqual({
        outcome: "rows",
        rows: [
          {
            opened_by: "agent",
            opening_reason_code: "existing_client",
            opening_comment: null,
            login_address_eligible: true,
          },
        ],
      });
      // the registration stays the agent's finding (RG52)
      expect(
        await asAgent(tx, agentB, () =>
          run(tx, GRANT_BY_LOGIN, [
            request.request_id,
            token,
            randomUUID(),
            null,
          ]),
        ),
      ).toEqual(refused(NOT_IN_PREREQUISITE_STATE, "no_registry_source"));
      const source = await frSource(tx);
      const granted = await asAgent(tx, agentB, () =>
        run<{ outcome: string; badge_id: string }>(tx, GRANT_BY_LOGIN, [
          request.request_id,
          token,
          source,
          null,
        ]),
      );
      expect(granted).toMatchObject({
        outcome: "rows",
        rows: [{ outcome: "granted" }],
      });
      const badge =
        granted.outcome === "rows" ? granted.rows[0]?.badge_id : undefined;
      const [held] = await tx`
        select level::text, state::text, granted_by_account_id::text as by, evidence_source
          from verification.badges where id = ${badge ?? null}`;
      expect(held).toEqual({
        level: "brand_verified",
        state: "active",
        by: agentB,
        evidence_source: "domain_and_registry",
      });
      // the finding: channel login_address, the website domain (never the domain of the address)
      expect(
        (await codesOf(tx, request.request_id)).map((c) => [
          c.channel,
          c.domain,
        ]),
      ).toEqual([["login_address", DOMAIN]]);
      const granting = (await registerOf(tx, request.request_id)).find(
        (line) => line.code === "verification.granted",
      );
      expect(granting).toMatchObject({
        actor: agentB,
        payload: {
          channel: "login_address",
          agent_opened: true,
          responsible_agent: false,
        },
      });
      expect(JSON.stringify(granting)).not.toContain("@");
      expect(await queueOf(tx, request.request_id)).toEqual([
        "verification.agent_opened_notice",
        "verification.decision",
      ]);
    });
  });

  it("A-bis refuses a consumer mailbox, another domain and an unverified address, without saying the address; the TXT path stays", async () => {
    await scenario(async (tx) => {
      await tx`update profiles.advertiser_profiles set website_domain = ${DOMAIN} where account_id = ${brandA}`;
      const request = await opened(tx, agentA, [
        brandA,
        null,
        "brand_verified",
        "past_collaboration",
        null,
        null,
        null,
        null,
      ]);
      const token = await claim(tx, agentB, request.request_id);
      const source = await frSource(tx);
      const grantByLogin = () =>
        asAgent(tx, agentB, () =>
          run(tx, GRANT_BY_LOGIN, [request.request_id, token, source, null]),
        );
      const eligible = async () => {
        const result = await asAgent(tx, agentB, () =>
          run<{ login_address_eligible: boolean }>(tx, DOSSIER, [
            request.request_id,
          ]),
        );
        return result.outcome === "rows"
          ? result.rows[0]?.login_address_eligible
          : result;
      };

      // a subdomain of the website domain is the brand's
      await tx`update identity.accounts set email = 't2-advertiser-a@mail.example.test' where id = ${brandA}`;
      expect(await eligible()).toBe(true);
      for (const [email, detail] of [
        ["t2-advertiser-a@gmail.com", "consumer_domain"],
        ["t2-advertiser-a@eu.mail.ru", "consumer_domain"],
        ["t2-advertiser-a@other.test", "other_domain"],
        ["t2-advertiser-a@notexample.test", "other_domain"],
      ] as const) {
        await tx`update identity.accounts set email = ${email} where id = ${brandA}`;
        expect(await eligible()).toBe(false);
        const result = await grantByLogin();
        expect(result).toEqual(refused(NOT_IN_PREREQUISITE_STATE, detail));
        expect(JSON.stringify(result)).not.toContain("@");
      }
      await tx`
        update identity.accounts set email = 't2-advertiser-a@example.test', email_verified_at = null
         where id = ${brandA}`;
      expect(await grantByLogin()).toEqual(
        refused(NOT_IN_PREREQUISITE_STATE, "unverified"),
      );
      expect(
        (await codesOf(tx, request.request_id)).map((c) => c.channel),
      ).toEqual([null]);

      // the TXT stays possible (06 RG51): the code read on the domain
      const [live] = await codesOf(tx, request.request_id);
      const granted = await asAgent(tx, agentB, () =>
        run<{ outcome: string }>(tx, GRANT_BRAND, [
          request.request_id,
          token,
          live?.code,
          DOMAIN,
          "dns_txt",
          source,
          null,
        ]),
      );
      expect(granted).toMatchObject({
        outcome: "rows",
        rows: [{ outcome: "granted" }],
      });
      expect(
        (await codesOf(tx, request.request_id)).map((c) => c.channel),
      ).toEqual(["dns_txt"]);
    });
  });
});

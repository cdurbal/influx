// L3G commit 11 — L3G-T11: TM12.5, TM12.3 and T14 around the identified view, as one transversal read of
// the whole of what 0328 to 0333 and the routes of 09 and 10 added (docs/mvp/18 TM12.3, TM12.5, T14;
// l3g-fiche.md invariants 2, 3, 7, 14; jalons/l3g/modele.md §1, §8). Each door and each route has its own
// file (creator-identified-search-door, team-selection-queue, search-settings-reader, …); this file reads
// them together, from the catalogue and from the router, so that a door or a route added to the view later
// is met here as well:
//   - TM12.5 in base: every door of 04 to 08 (the identified door, the prefill, the four doors of queue 9,
//     the readers of the counters and of the settings, the two writers of the settings, the daily task of
//     the worker) is executed by its own roles alone: influx_advertiser and influx_creator, and the roles
//     of Supabase, get 42501 on each one, called, and hold no EXECUTE; the two owners of the doors have
//     no function a member role can run;
//   - TM12.5 on the routes: a brand and a creator get, on the web surface, the answer of a route that does
//     not exist, on each of the nine routes of the view; the backoffice's surface answers them 401;
//   - TM12.3: no route of the whole server exports anything, in any format; the routes of the view take
//     no size of page nor format, whatever the schema of the body or of the query;
//   - T14: a campaign, a prefill, a request of queue 9 or a request of the dual control that is unknown,
//     a draft, drawn by a colleague, of a brand the caller holds, or addressed by a member, answers as an
//     address that does not exist (same status, same code, same message), nothing journaled nor written.
// The doors are called in a rolled-back transaction of the local superuser, as apps/api calls them (influx_app,
// then the role and the context of the caller). The routes are called through fastify.inject() on accounts
// COMMITTED through campaign-review-kit.ts; the requests of queue 9 are written by the migration role and
// removed with the file.
import { accountIdOf, inRolledBackTransaction } from "@influx/test-kit/db";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as z from "zod";
import { routeInventoryOf, type InventoriedRoute } from "../src/server.ts";
import {
  answer,
  openReviewKit,
  type Internal,
  type ReviewKit,
} from "./campaign-review-kit.ts";
import type { Member } from "./campaign-routes-kit.ts";
import { HERE } from "./creator-search-kit.ts";
import {
  brandCampaign,
  publishedBrand,
  type PublishedBrand,
} from "./open-campaigns-kit.ts";
import { actAsMember, localSuperuser, testDataSet } from "./support.ts";

type Tx = postgres.TransactionSql;

const INSUFFICIENT_PRIVILEGE = "42501";
const WEB_COOKIE = "__Host-influx-session";

const brandA = accountIdOf("advertiser", "a");
const creatorA = accountIdOf("creator", "a");

const IDENTIFIED = "/v1/bo/creator-search";
const PREFILL = "/v1/bo/campaigns/:id/creator-prefill";
const ENTRIES = "/v1/bo/team-selection/entries";
const SETTINGS = "/v1/bo/settings/search";
const DUAL = "/v1/bo/dual-control";
const NIL = "00000000-0000-4000-8000-000000000000";

/** The nine routes the identified view, queue 9 and the settings added (09, 10): method, model, body. */
const VIEW_ROUTES: readonly {
  method: "GET" | "POST";
  url: string;
  body?: object;
}[] = [
  { method: "POST", url: IDENTIFIED, body: { filters: HERE } },
  { method: "POST", url: PREFILL },
  { method: "GET", url: ENTRIES },
  { method: "POST", url: `${ENTRIES}/search`, body: {} },
  { method: "POST", url: `${ENTRIES}/:id/open` },
  { method: "POST", url: `${ENTRIES}/:id/release` },
  { method: "POST", url: `${ENTRIES}/:id/extend` },
  {
    method: "POST",
    url: `${ENTRIES}/:id/close`,
    body: { reasonCode: "duplicate" },
  },
  { method: "GET", url: SETTINGS },
];

const nameOf = (route: { method: string; url: string }) =>
  `${route.method} ${route.url}`;
const withId = (url: string, id: string) => url.replace(":id", id);

// ---------------------------------------------------------------------------------------------
// The doors of 04 to 08, by who may execute them
// ---------------------------------------------------------------------------------------------

/** One door: its signature, a call that reaches the EXECUTE check with typed nulls, who holds it. */
type Door = { signature: string; call: string; holders: readonly string[] };

const AGENTS_AND_ADMINS = ["influx_admin", "influx_agent"];
const ADMINS = ["influx_admin"];
const WORKER = ["influx_worker"];

const DOORS: readonly Door[] = [
  // 0328 (L3G-04): the identified door, and the alerts of the volume of searches it recreated
  {
    signature:
      "search.search_creators_identified(jsonb,text,integer,uuid,uuid)",
    call: "select search.search_creators_identified('{}'::jsonb, 'default', 1, null::uuid, null::uuid)",
    holders: AGENTS_AND_ADMINS,
  },
  {
    signature: "search.creator_search_volume_alerts()",
    call: "select * from search.creator_search_volume_alerts()",
    holders: ADMINS,
  },
  // 0329 (L3G-05): the prefill of « Compatible creators »
  {
    signature: "search.prefill_campaign_filters(uuid)",
    call: "select search.prefill_campaign_filters(null::uuid)",
    holders: AGENTS_AND_ADMINS,
  },
  // 0330 (L3G-06): the four doors of queue 9
  {
    signature: "search.open_team_selection_request(uuid)",
    call: "select * from search.open_team_selection_request(null::uuid)",
    holders: AGENTS_AND_ADMINS,
  },
  {
    signature: "search.release_team_selection_request(uuid)",
    call: "select * from search.release_team_selection_request(null::uuid)",
    holders: AGENTS_AND_ADMINS,
  },
  {
    signature: "search.extend_team_selection_claim(uuid)",
    call: "select * from search.extend_team_selection_claim(null::uuid)",
    holders: AGENTS_AND_ADMINS,
  },
  {
    signature: "search.close_team_selection_request(uuid,text,text)",
    call: "select * from search.close_team_selection_request(null::uuid, 'duplicate', null::text)",
    holders: AGENTS_AND_ADMINS,
  },
  // 0331 (L3G-07): the readers of the admins, and the daily task of the worker
  {
    signature: "search.critical_mass_alerts()",
    call: "select * from search.critical_mass_alerts()",
    holders: ADMINS,
  },
  {
    signature: "search.read_supply_counters()",
    call: "select * from search.read_supply_counters()",
    holders: ADMINS,
  },
  {
    signature: "ops.compute_supply_counters(uuid,smallint)",
    call: "select ops.compute_supply_counters(null::uuid, 1::smallint)",
    holders: WORKER,
  },
  // 0332 (L3G-08): the two writers of the settings, behind the double validation
  {
    signature: "search.write_search_setting(uuid,uuid,text,jsonb,text)",
    call: "select search.write_search_setting(null::uuid, null::uuid, 'k_anonymity_threshold', '5'::jsonb, 'founder_decision')",
    holders: ADMINS,
  },
  {
    signature:
      "search.write_facet_setting(uuid,uuid,text,boolean,integer,text,text)",
    call: "select search.write_facet_setting(null::uuid, null::uuid, 'F1', true, 1, 'founder_decision', null::text)",
    holders: ADMINS,
  },
  // 0333 (L3G-08b): the reader of the settings
  {
    signature: "search.read_search_settings()",
    call: "select * from search.read_search_settings()",
    holders: ADMINS,
  },
];

/** Every role that holds, or must not hold, a door of the view. */
const ROLES = [
  "influx_advertiser",
  "influx_creator",
  "influx_agent",
  "influx_admin",
  "influx_worker",
  "anon",
  "authenticated",
  "service_role",
] as const;

/** The SQLSTATE of a refused call, or "ok" (a savepoint: the transaction stays usable). */
async function attempt(tx: Tx, call: () => Promise<unknown>): Promise<string> {
  try {
    await tx.savepoint(async () => {
      await call();
    });
    return "ok";
  } catch (error) {
    return (error as { code?: string }).code ?? "unknown";
  }
}

beforeAll(async () => {
  await testDataSet();
});

describe("L3G-T11 TM12.5 in base: each door of 04 to 08 is executed by its own roles alone (fiche invariants 2, 3)", () => {
  it("holds EXECUTE on each of the thirteen doors for the roles of the model alone, answers 42501 to a brand and to a creator calling it, leaves PUBLIC out, and owns no function a member role can run", async () => {
    const outcome = await inRolledBackTransaction(
      localSuperuser(),
      async (tx) => {
        const matrix: { signature: string; holders: string[] }[] = [];
        const codes: Record<string, string[]> = {};
        for (const door of DOORS) {
          const held = await tx<{ role: string; held: boolean }[]>`
            select r as role,
                   pg_catalog.has_function_privilege(r, ${door.signature}::text, 'EXECUTE') as held
              from unnest(${[...ROLES]}::text[]) r
             order by r`;
          matrix.push({
            signature: door.signature,
            holders: held.filter((row) => row.held).map((row) => row.role),
          });
          codes[door.signature] = [
            await attempt(tx, () =>
              actAsMember(
                tx,
                "influx_advertiser",
                { accountId: brandA, role: "advertiser", aal: "aal1" },
                () => tx.unsafe(door.call),
              ),
            ),
            await attempt(tx, () =>
              actAsMember(
                tx,
                "influx_creator",
                { accountId: creatorA, role: "creator", aal: "aal1" },
                () => tx.unsafe(door.call),
              ),
            ),
          ];
        }
        const [publicHolds] = await tx<{ names: string[] }[]>`
          select coalesce(array_agg(s.signature order by s.signature), '{}') as names
            from unnest(${DOORS.map((door) => door.signature)}::text[]) s(signature)
           where exists (
             select 1
               from pg_catalog.pg_proc p,
                    pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
              where p.oid = s.signature::regprocedure and a.grantee = 0
                and a.privilege_type = 'EXECUTE')`;
        const [owned] = await tx<{ names: string[] }[]>`
          select coalesce(array_agg(r || ' ' || p.oid::regprocedure::text
                                    order by r || ' ' || p.oid::regprocedure::text), '{}') as names
            from pg_catalog.pg_proc p,
                 unnest(array['influx_advertiser', 'influx_creator', 'anon', 'authenticated',
                              'service_role']) r
           where p.proowner in ('influx_agent_search_definer'::regrole,
                                'influx_search_admin_definer'::regrole)
             and pg_catalog.has_function_privilege(r, p.oid, 'EXECUTE')`;
        return {
          matrix,
          codes,
          publicHolds: publicHolds?.names,
          owned: owned?.names,
        };
      },
    );
    expect(DOORS).toHaveLength(13);
    expect(outcome.matrix).toEqual(
      DOORS.map((door) => ({
        signature: door.signature,
        holders: [...door.holders].sort(),
      })),
    );
    expect(outcome.codes).toEqual(
      Object.fromEntries(
        DOORS.map((door) => [
          door.signature,
          [INSUFFICIENT_PRIVILEGE, INSUFFICIENT_PRIVILEGE],
        ]),
      ),
    );
    expect(outcome.publicHolds).toEqual([]);
    expect(outcome.owned).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------
// The routes
// ---------------------------------------------------------------------------------------------

let kit: ReviewKit;
let agent: Internal;
let otherAgent: Internal;
let adminA: Internal;
let adminB: Internal;
let brand: PublishedBrand;
let heldBrand: Member;
let creator: Member;
/** The answer of an address that does not exist, on the web surface and on the backoffice's. */
let unknownWeb: ReturnType<typeof answer>;
let unknownBackoffice: ReturnType<typeof answer>;
const requestIds: string[] = [];

/** A request of queue 9, open and due tomorrow, written by the migration role. */
async function deposit(owner: Member): Promise<string> {
  const [row] = await kit.fx.migration<{ id: string }[]>`
    insert into search.selection_requests
      (advertiser_account_id, filters, language, sla_due_at, created_at)
    values (${owner.accountId}, '{}'::jsonb, 'fr', now() + interval '1 day', now())
    returning id::text`;
  if (row === undefined) {
    throw new Error("no request written");
  }
  requestIds.push(row.id);
  return row.id;
}

/** What a request of queue 9 and the journals hold now: a refusal writes none of it. */
async function writtenByTheView(): Promise<unknown> {
  const [row] = await kit.fx.migration<Record<string, unknown>[]>`
    select (select count(*)::int from search.search_queries
             where account_id = any(${[agent, otherAgent, adminA, adminB].map((who) => who.accountId)}::uuid[]))
             as queries,
           (select count(*)::int from search.campaign_prefills
             where account_id = any(${[agent, otherAgent, adminA, adminB].map((who) => who.accountId)}::uuid[]))
             as prefills,
           (select count(*)::int from search.selection_requests
             where (claimed_by_account_id is not null or closed_at is not null)
               and id = any(${requestIds}::uuid[])) as touched,
           (select count(*)::int from backoffice.dual_control_requests
             where action_code in ('search.change_setting', 'search.change_facet')) as requests,
           (select count(*)::int from leads.outbox_events) as outbox`;
  return row;
}

const callOn = (
  route: { method: "GET" | "POST"; url: string; body?: object },
  id: string,
  session: string | null,
  options?: { surface?: "backoffice" | "web"; cookie?: string },
) => kit.bo(route.method, withId(route.url, id), session, route.body, options);

describe("L3G-T11 TM12.5 on the routes, TM12.3, T14 (fiche invariants 2, 7, 14)", () => {
  beforeAll(async () => {
    kit = await openReviewKit();
    agent = await kit.newInternal("agent", "Alix");
    otherAgent = await kit.newInternal("agent", "Camille");
    adminA = await kit.newInternal("admin", "Dominique");
    adminB = await kit.newInternal("admin", "Claude");
    brand = await publishedBrand(kit.fx, kit.server);
    heldBrand = await kit.newBrand({ owner: agent.accountId });
    creator = await kit.fx.newMember("creator");
    unknownWeb = answer(
      await kit.bo("GET", "/v1/bo/nothing-here", creator.session, undefined, {
        surface: "web",
        cookie: WEB_COOKIE,
      }),
    );
    unknownBackoffice = answer(
      await kit.bo("GET", "/v1/bo/nothing-here", agent.session),
    );
    expect(unknownWeb.status).toBe(404);
    expect(unknownBackoffice.status).toBe(404);
  });

  afterAll(async () => {
    await kit.fx.migration`
      delete from search.selection_requests where id = any(${requestIds}::uuid[])`;
    const actors = [agent, otherAgent, adminA, adminB].map(
      (who) => who.accountId,
    );
    await kit.fx.migration.begin(async (tx) => {
      const queries = tx`
        select q.id from search.search_queries q where q.account_id = any(${actors}::uuid[])`;
      await tx`delete from search.impression_reasons where search_query_id in (${queries})`;
      await tx`delete from search.search_impressions where search_query_id in (${queries})`;
      await tx`delete from search.search_queries where account_id = any(${actors}::uuid[])`;
      await tx`delete from search.campaign_prefills where account_id = any(${actors}::uuid[])`;
    });
    await kit.close();
  });

  it("TM12.5: a brand and a creator get the answer of a route that does not exist on the nine routes of the view on the web surface, and 401 on the backoffice's; the router knows all nine", async () => {
    const inventory = routeInventoryOf(kit.server).map(nameOf);
    expect(inventory).toEqual(
      expect.arrayContaining(VIEW_ROUTES.map((route) => nameOf(route))),
    );
    const memberSession = await kit.memberSession();
    for (const route of VIEW_ROUTES) {
      for (const id of [NIL, randomUUID()]) {
        for (const session of [creator.session, brand.session, memberSession]) {
          const refused = answer(
            await callOn(route, id, session, {
              surface: "web",
              cookie: WEB_COOKIE,
            }),
          );
          expect(refused, nameOf(route)).toEqual(unknownWeb);
        }
        for (const session of [null, creator.session, brand.session]) {
          const refused = answer(await callOn(route, id, session));
          expect(refused.status, `${nameOf(route)} backoffice`).toBe(401);
        }
      }
    }
  });

  it("TM12.3: no route of the server exports, in any format, and the routes of the view take no size of page, no format and no count, in the body nor in the query", () => {
    const inventory = routeInventoryOf(kit.server);
    // no route of the whole server exports anything (C(17)): by its address, whatever it exports
    expect(
      inventory
        .filter((route) =>
          /export|csv|xlsx?|download|dump|extract|\.pdf|archive/i.test(
            route.url,
          ),
        )
        // the person's own copy of his data (RGPD access, /v1/me): no search, no list of anybody
        .filter((route) => !route.url.startsWith("/v1/me/data-export"))
        .map(nameOf),
    ).toEqual([]);
    // the nine routes of the view are the whole of the view: nothing else under their prefixes
    expect(
      inventory
        .filter(
          (route) =>
            route.url.startsWith(IDENTIFIED) ||
            route.url.endsWith("/creator-prefill") ||
            route.url.startsWith("/v1/bo/team-selection/") ||
            route.url.startsWith(SETTINGS),
        )
        .map(nameOf)
        .sort(),
    ).toEqual(VIEW_ROUTES.map(nameOf).sort());
    const SIZE =
      /^(limit|size|pageSize|perPage|per_page|page_size|count|format|fields|columns|select)$/;
    // the search and the prefill: the schemas of the route, read as JSON Schema, hold none of those keys
    const keysIn = (schema: unknown): string[] =>
      typeof schema === "object" && schema !== null && "_zod" in schema
        ? Object.keys(
            (
              z.toJSONSchema(schema as z.ZodType, {
                io: "input",
                unrepresentable: "any",
              }) as { properties?: Record<string, unknown> }
            ).properties ?? {},
          )
        : [];
    const searchRoutes = inventory.filter(
      (route: InventoriedRoute) =>
        route.url === IDENTIFIED || route.url.endsWith("/creator-prefill"),
    );
    expect(searchRoutes.map(nameOf).sort()).toEqual([
      `POST ${PREFILL}`,
      `POST ${IDENTIFIED}`,
    ]);
    for (const route of searchRoutes) {
      expect(
        [
          ...keysIn(route.schema.body),
          ...keysIn(route.schema.querystring),
        ].filter((key) => SIZE.test(key)),
        nameOf(route),
      ).toEqual([]);
    }
    expect(
      searchRoutes
        .filter((route) => route.url === IDENTIFIED)
        .flatMap((route) => keysIn(route.schema.body))
        .sort(),
    ).toEqual(["campaignId", "filters", "page", "prefillId", "sort"]);
    // the settings read takes nothing at all
    const reader = inventory.find((route) => route.url === SETTINGS);
    expect(keysIn(reader?.schema.body)).toEqual([]);
    expect(keysIn(reader?.schema.querystring)).toEqual([]);
  });

  it("T14.1 to T14.4: an unknown campaign, a draft, a prefill of a colleague or an unknown one, a request of queue 9 unknown or of a brand the caller holds, an unknown request of the dual control, all answer as an address that does not exist, and nothing is written", async () => {
    const draft = await brandCampaign(kit.fx, kit.server, brand, {
      state: "draft",
    });
    const published = await brandCampaign(kit.fx, kit.server, brand);
    const held = await deposit(heldBrand);
    const drawn = await kit.bo(
      "POST",
      `/v1/bo/campaigns/${published.id}/creator-prefill`,
      otherAgent.session,
    );
    expect(drawn.statusCode, drawn.body).toBe(200);
    const { prefillId } = drawn.json<{ prefillId: string }>();
    const before = await writtenByTheView();
    const search = (session: string, body: object) =>
      kit.bo("POST", IDENTIFIED, session, body);
    const prefill = (session: string, id: string) =>
      kit.bo("POST", `/v1/bo/campaigns/${id}/creator-prefill`, session);
    const refusals: [string, ReturnType<typeof answer>][] = [];
    // the campaign: of the search and of the prefill, unknown or a draft, for an agent and an admin
    for (const who of [agent, adminA]) {
      for (const id of [randomUUID(), draft.id]) {
        refusals.push([
          `search campaign ${id}`,
          answer(await search(who.session, { filters: HERE, campaignId: id })),
        ]);
        refusals.push([
          `prefill campaign ${id}`,
          answer(await prefill(who.session, id)),
        ]);
      }
    }
    // the prefill linked to a search: a colleague's, an unknown one
    for (const id of [prefillId, randomUUID()]) {
      refusals.push([
        `search prefill ${id}`,
        answer(
          await search(agent.session, {
            filters: HERE,
            campaignId: published.id,
            prefillId: id,
          }),
        ),
      ]);
    }
    // queue 9: a request unknown, and one of a brand the caller holds, on the four routes of an entry
    for (const route of VIEW_ROUTES.filter((found) =>
      found.url.startsWith(`${ENTRIES}/:id/`),
    )) {
      for (const id of [randomUUID(), held]) {
        refusals.push([
          `${nameOf(route)} ${id}`,
          answer(await callOn(route, id, agent.session)),
        ]);
      }
    }
    // the dual control: a request that is not there, read and confirmed
    for (const who of [adminA, adminB]) {
      refusals.push([
        "read unknown dual control",
        answer(await kit.bo("GET", `${DUAL}/${randomUUID()}`, who.session)),
      ]);
      refusals.push([
        "confirm unknown dual control",
        answer(
          await kit.bo(
            "POST",
            `${DUAL}/${randomUUID()}/confirm`,
            who.session,
            {},
          ),
        ),
      ]);
    }
    for (const [label, got] of refusals) {
      expect(got.status, label).toBe(404);
      expect(got, label).toEqual(unknownBackoffice);
    }
    expect(refusals).toHaveLength(8 + 2 + 8 + 4);
    // a refusal wrote no journal line, no prefill, no claim nor closure, no request, nothing to the outbox
    expect(await writtenByTheView()).toEqual(before);
    // the same campaigns and requests, asked as a creator or a brand on the web surface: the same answer
    for (const session of [creator.session, brand.session]) {
      for (const [route, id] of [
        [VIEW_ROUTES[0], draft.id],
        [VIEW_ROUTES[1], published.id],
        [VIEW_ROUTES[4], held],
        [VIEW_ROUTES[7], held],
      ] as const) {
        if (route === undefined) {
          throw new Error("no route");
        }
        expect(
          answer(
            await callOn(route, id, session, {
              surface: "web",
              cookie: WEB_COOKIE,
            }),
          ),
          nameOf(route),
        ).toEqual(unknownWeb);
      }
    }
  });
});

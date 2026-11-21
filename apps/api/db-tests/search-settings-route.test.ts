// L3G commit 10 — L3G-T10: the search settings of the administrators, GET /v1/bo/settings/search, and their change
// under a peer's control through POST /v1/bo/dual-control (docs/mvp/04 §5.5; 10 RG2, RG11, RG57, RG63, RG88;
// 15 §F, RG110, AL22, AL65; 18 T14, TM12.5; D38 Q2, D84; jalons/l3g/modele.md §6 to §8; l3g-fiche invariants 9, 10,
// 14; 0331, 0332, 0333). Through fastify.inject(), straight to apps/api, the doors of the base behind them, as an
// agent and two administrators of a backoffice session in aal2:
//   - the read: the ten keys as the base holds them, each checked against its schema, and the counters of the
//     last snapshot; an agent refused 403, a member 404 on the web surface and 401 on the backoffice's;
//   - the request: a key or a facet, a reason of the closed list, a value the contract bounds (400 before the
//     session), an admin only (an agent's attempt refused and journaled), a peer admin or none (409 no_peer_admin);
//   - the confirmation: the requester alone is refused while a peer exists, the peer's confirmation writes the
//     setting once (register: before, after, the 2V, the mode peer) and the request is spent (409);
//   - the alerts of the critical mass: AL65 for the administrators alone, the counters stale by their count.
// The settings are restored as the migration role does; the snapshot of the counters is a day of the far future,
// written and removed by the file; nothing else of the base is touched.
import {
  searchSettingsResponseSchema,
  SEARCH_SETTING_KEYS,
} from "@influx/contracts/search-settings";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  answer,
  issuesOf,
  openReviewKit,
  type Internal,
  type ReviewKit,
} from "./campaign-review-kit.ts";

const SETTINGS = "/v1/bo/settings/search";
const DUAL = "/v1/bo/dual-control";
const ALERTS = "/v1/bo/alerts";
const KEY = "critical_mass_thresholds";

let kit: ReviewKit;
let agent: Internal;
let adminA: Internal;
let adminB: Internal;
/** The value of the key under test as the base held it, put back by the file. */
let originalValue: unknown;
/** The far-future day of the controlled snapshot of the counters (a literal of the base's own calendar). */
let snapshotDay: string;

type View = {
  id: string;
  action: Record<string, unknown>;
  target: unknown;
  recap: {
    scope: { kind: string; count: number };
    consequences: string[];
    reversible: boolean;
  };
  reasonCode: string;
  reasonNote: string | null;
  state: string;
  executed: boolean;
  next: { kind: string };
  confirmation: { mode: string } | null;
};
type SettingsBody = {
  asOf: string;
  settings: { key: string; value: unknown }[];
  counters: {
    snapshotOn: string;
    computedAt: string;
    global: { published: number; searchable: number };
    topics: { code: string; published: number; searchable: number }[];
    countries: { code: string; published: number; searchable: number }[];
    curve: { snapshotOn: string; published: number; searchable: number }[];
  } | null;
};

const get = (session: string | null, url: string) =>
  kit.bo("GET", url, session);
const post = (session: string | null, url: string, body?: object) =>
  kit.bo("POST", url, session, body);

function settingChange(value: unknown, extra: object = {}) {
  return {
    code: "search.change_setting",
    setting: { key: KEY, value },
    reasonCode: "founder_decision",
    reasonNote: "L3G T10",
    ...extra,
  };
}

async function valueOf(key: string): Promise<unknown> {
  const [row] = await kit.fx.migration<{ value: unknown }[]>`
    select value from search.search_settings where key = ${key}`;
  return row?.value;
}

async function requestRow(id: string) {
  const [row] = await kit.fx.migration<
    {
      state: string;
      action_code: string;
      consumed: boolean;
      payload: Record<string, unknown>;
    }[]
  >`
    select state::text as state, action_code, consumed_at is not null as consumed, payload
      from backoffice.dual_control_requests where id = ${id}`;
  if (row === undefined) {
    throw new Error("no such request");
  }
  return row;
}

async function settingsSeenBy(who: Internal): Promise<SettingsBody> {
  const response = await get(who.session, SETTINGS);
  expect(response.statusCode, response.body).toBe(200);
  return response.json<SettingsBody>();
}

beforeAll(async () => {
  kit = await openReviewKit();
  agent = await kit.newInternal("agent", "Alix");
  adminA = await kit.newInternal("admin", "Dominique");
  adminB = await kit.newInternal("admin", "Camille");
  originalValue = await valueOf(KEY);
  // a controlled snapshot, the newest of the base and stale: AL65 counters_stale says so (0331)
  const [day] = await kit.fx.migration<{ day: string }[]>`
    select to_char(current_date + 400, 'YYYY-MM-DD') as day`;
  snapshotDay = day?.day ?? "";
  await kit.fx.migration`
    insert into search.supply_counters
      (snapshot_on, dimension, dimension_value, published_profiles_count,
       searchable_profiles_count, computed_at)
    values (${snapshotDay}::date, 'global', '*', 10, 8, now() - interval '5 days'),
           (${snapshotDay}::date, 'topic', 'pets', 4, 3, now() - interval '5 days'),
           (${snapshotDay}::date, 'country', 'FR', 6, 5, now() - interval '5 days'),
           ((${snapshotDay}::date - 1), 'global', '*', 2, 1, now() - interval '6 days')`;
});

afterAll(async () => {
  await kit.fx.migration`
    delete from search.supply_counters where snapshot_on >= ${snapshotDay}::date - 1`;
  await kit.fx.migration`
    update search.search_settings set value = ${JSON.stringify(originalValue)}::text::jsonb
     where key = ${KEY}`;
  await kit.close();
});

describe("L3G-T10 the read: the ten keys and the counters, an administrator's alone (modele §7, §8; fiche invariant 14)", () => {
  it("serves the ten keys of the base, each of the shape of its schema, and the counters of the last snapshot with its curve, no-store", async () => {
    const response = await get(adminA.session, SETTINGS);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const body = response.json<SettingsBody>();
    expect(Object.keys(body).sort()).toEqual(["asOf", "counters", "settings"]);
    expect(searchSettingsResponseSchema.safeParse(body).success).toBe(true);
    expect(body.settings.map((setting) => setting.key).sort()).toEqual(
      [...SEARCH_SETTING_KEYS].sort(),
    );
    expect(body.settings.find((setting) => setting.key === KEY)?.value).toEqual(
      originalValue,
    );
    // who changed a key and when are in the register, not here
    expect(response.body).not.toContain("updatedBy");
    expect(response.body).not.toContain("updated_by");
    expect(body.counters).toEqual({
      snapshotOn: snapshotDay,
      computedAt: expect.any(String),
      global: { published: 10, searchable: 8 },
      topics: [{ code: "pets", published: 4, searchable: 3 }],
      countries: [{ code: "FR", published: 6, searchable: 5 }],
      curve: [
        {
          snapshotOn: expect.any(String),
          published: 2,
          searchable: 1,
        },
      ],
    });
  });

  it("refuses an agent 403 before any door, and a member or nobody: 404 on the web surface, 401 on the backoffice's", async () => {
    const refused = await get(agent.session, SETTINGS);
    expect(refused.statusCode).toBe(403);
    expect(answer(refused).error.code).toBe("forbidden");
    expect(refused.body).not.toContain(KEY);
    const creator = await kit.fx.newMember("creator");
    const unknownWeb = answer(
      await kit.bo(
        "GET",
        "/v1/bo/settings/nothing",
        creator.session,
        undefined,
        { surface: "web", cookie: "__Host-influx-session" },
      ),
    );
    expect(
      answer(
        await kit.bo("GET", SETTINGS, creator.session, undefined, {
          surface: "web",
          cookie: "__Host-influx-session",
        }),
      ),
    ).toEqual(unknownWeb);
    for (const session of [null, creator.session]) {
      expect((await get(session, SETTINGS)).statusCode).toBe(401);
    }
  });
});

describe("L3G-T10 the request: a closed entry, an administrator, a peer to confirm (D84, D38 Q2; fiche invariant 10)", () => {
  it("shows the action, its recap and what this administrator may do next, and writes nothing yet", async () => {
    const next = { publishedProfiles: 31, perTopic: 5 };
    const response = await post(adminA.session, DUAL, settingChange(next));
    expect(response.statusCode, response.body).toBe(200);
    const view = response.json<View>();
    expect(view).toMatchObject({
      action: {
        code: "search.change_setting",
        setting: { key: KEY, value: next },
      },
      target: null,
      recap: {
        scope: { kind: "setting", count: 1 },
        consequences: ["setting_changed"],
        reversible: true,
      },
      reasonCode: "founder_decision",
      reasonNote: "L3G T10",
      state: "pending",
      executed: false,
      confirmation: null,
      next: { kind: "await_peer" },
    });
    expect(await valueOf(KEY)).toEqual(originalValue);
    // the peer sees what he may do, the facet request carries its own recap
    const seen = await get(adminB.session, `${DUAL}/${view.id}`);
    expect(seen.json<View>().next).toEqual({ kind: "confirm_as_peer" });
    const facet = await post(adminA.session, DUAL, {
      code: "search.change_facet",
      facetCode: "F1",
      isOpen: true,
      displayOrder: 1,
      reasonCode: "critical_mass_reached",
    });
    expect(facet.statusCode, facet.body).toBe(200);
    expect(facet.json<View>()).toMatchObject({
      action: {
        code: "search.change_facet",
        facetCode: "F1",
        isOpen: true,
        displayOrder: 1,
      },
      recap: {
        scope: { kind: "setting", count: 1 },
        consequences: ["facet_changed", "config_version_opened"],
      },
    });
    for (const id of [view.id, facet.json<View>().id]) {
      expect(
        (await post(adminA.session, `${DUAL}/${id}/cancel`)).json(),
      ).toEqual({ cancelled: true });
    }
  });

  it("refuses at the contract what the base would refuse: an unknown key, a value out of bounds, a facet outside the base, a reason outside the list", async () => {
    const refusals: object[] = [
      {
        code: "search.change_setting",
        setting: { key: "no_such_key", value: 1 },
        reasonCode: "founder_decision",
      },
      {
        code: "search.change_setting",
        setting: { key: "k_anonymity_threshold", value: 3 },
        reasonCode: "founder_decision",
      },
      {
        code: "search.change_setting",
        setting: {
          key: KEY,
          value: { publishedProfiles: 31, perTopic: 5, extra: 1 },
        },
        reasonCode: "founder_decision",
      },
      settingChange(
        { publishedProfiles: 31, perTopic: 5 },
        { reasonCode: "because" },
      ),
      {
        code: "search.change_facet",
        facetCode: "F12",
        isOpen: true,
        displayOrder: 7,
        reasonCode: "founder_decision",
      },
      {
        code: "search.change_facet",
        facetCode: "F2",
        isOpen: true,
        displayOrder: 7,
        reasonCode: "founder_decision",
      },
      {
        code: "search.change_facet",
        facetCode: "F99",
        isOpen: false,
        displayOrder: 7,
        reasonCode: "founder_decision",
      },
      {
        code: "search.change_facet",
        facetCode: "F1",
        isOpen: true,
        displayOrder: 100,
        reasonCode: "founder_decision",
      },
    ];
    for (const body of refusals) {
      const refused = await post(adminA.session, DUAL, body);
      expect(refused.statusCode, JSON.stringify(body)).toBe(400);
      expect(refused.json<{ error: { code: string } }>().error.code).toBe(
        "validation_failed",
      );
    }
    expect(await valueOf(KEY)).toEqual(originalValue);
  });

  it("refuses an agent 403 and journals the attempt (CA63); the request is an administrator's", async () => {
    const before = (await kit.refusedActions(agent.accountId)).length;
    const refused = await post(
      agent.session,
      DUAL,
      settingChange({ publishedProfiles: 32, perTopic: 5 }),
    );
    expect(refused.statusCode).toBe(403);
    expect((await kit.refusedActions(agent.accountId)).slice(before)).toEqual([
      "backoffice.dual_control",
    ]);
    expect(await valueOf(KEY)).toEqual(originalValue);
  });

  it("answers 409 no_peer_admin, and writes no request, while no other administrator can confirm", async () => {
    const others = await kit.fx.migration<{ account_id: string }[]>`
      update identity.agent_profiles p
         set is_active = false, deactivated_at = now(), deactivated_by_account_id = p.account_id
        from identity.account_roles r
       where r.account_id = p.account_id and r.role = 'admin' and p.is_active
         and p.account_id <> ${adminA.accountId}
      returning p.account_id::text as account_id`;
    try {
      const [before] = await kit.fx.migration<{ n: number }[]>`
        select count(*)::int as n from backoffice.dual_control_requests
         where action_code like 'search.%'`;
      for (const body of [
        settingChange({ publishedProfiles: 33, perTopic: 5 }),
        {
          code: "search.change_facet",
          facetCode: "F1",
          isOpen: true,
          displayOrder: 1,
          reasonCode: "founder_decision",
        },
      ]) {
        const refused = await post(adminA.session, DUAL, body);
        expect(refused.statusCode).toBe(409);
        expect(issuesOf(refused)).toEqual([
          { path: "dualControl", issue: "no_peer_admin" },
        ]);
      }
      const [after] = await kit.fx.migration<{ n: number }[]>`
        select count(*)::int as n from backoffice.dual_control_requests
         where action_code like 'search.%'`;
      expect(after?.n).toBe(before?.n);
    } finally {
      for (const { account_id: accountId } of others) {
        await kit.fx.migration`
          update identity.agent_profiles
             set is_active = true, deactivated_at = null, deactivated_by_account_id = null
           where account_id = ${accountId}`;
      }
    }
  });
});

describe("L3G-T10 the confirmation: a peer, once, with the register (D84; 0332)", () => {
  it("refuses the requester alone while a peer exists, lets the peer write the setting once, and spends the request", async () => {
    const next = { publishedProfiles: 41, perTopic: 6 };
    const requested = (
      await post(adminA.session, DUAL, settingChange(next))
    ).json<View>();
    const [last] = await kit.fx.migration<{ seq: string }[]>`
      select coalesce(max(seq), 0)::text as seq from audit.audit_events`;
    // the requester cannot confirm his own request while another administrator can
    const alone = await post(
      adminA.session,
      `${DUAL}/${requested.id}/confirm`,
      {},
    );
    expect(alone.statusCode).toBe(403);
    expect(await valueOf(KEY)).toEqual(originalValue);
    expect((await requestRow(requested.id)).consumed).toBe(false);

    const confirmed = await post(
      adminB.session,
      `${DUAL}/${requested.id}/confirm`,
      {},
    );
    expect(confirmed.statusCode, confirmed.body).toBe(200);
    expect(confirmed.json()).toEqual({ mode: "peer", reevaluated: null });
    expect(await valueOf(KEY)).toEqual(next);
    expect(
      (await settingsSeenBy(adminA)).settings.find((s) => s.key === KEY)?.value,
    ).toEqual(next);
    expect(await requestRow(requested.id)).toMatchObject({
      action_code: "search.change_setting",
      consumed: true,
      payload: { key: KEY, value: next },
    });
    const lines = await kit.fx.migration<
      { actor: string; payload: Record<string, unknown> }[]
    >`
      select actor_account_id::text as actor, payload from audit.audit_events
       where event_type = 'search.settings_changed' and seq > ${last?.seq ?? "0"}::bigint
       order by seq`;
    expect(lines).toEqual([
      {
        actor: adminB.accountId,
        payload: expect.objectContaining({
          table: "search_settings",
          key: KEY,
          before: originalValue,
          after: next,
          dual_control_request_id: requested.id,
          dual_control: "peer",
        }),
      },
    ]);
    // single use: a second confirmation is a conflict, and the request is no longer on the screen of a peer
    const again = await post(
      adminB.session,
      `${DUAL}/${requested.id}/confirm`,
      {},
    );
    expect(again.statusCode).toBe(409);
    expect(
      (await get(adminB.session, `${DUAL}/${requested.id}`)).json<View>(),
    ).toMatchObject({
      state: "confirmed",
      executed: true,
      next: { kind: "none" },
    });
  });

  it("confirms a facet left as it is: the request is spent, no version is opened and nothing is written", async () => {
    const [facet] = await kit.fx.migration<
      { is_open: boolean; display_order: number }[]
    >`select is_open, display_order from search.facet_settings where facet_code = 'F1'`;
    const [versions] = await kit.fx.migration<{ version: string }[]>`
      select coalesce(max(version), 0)::text as version from search.facet_config_versions`;
    const requested = (
      await post(adminA.session, DUAL, {
        code: "search.change_facet",
        facetCode: "F1",
        isOpen: facet?.is_open ?? true,
        displayOrder: facet?.display_order ?? 1,
        reasonCode: "configuration_error",
        reasonNote: "A note of the version, never opened here",
      })
    ).json<View>();
    const confirmed = await post(
      adminB.session,
      `${DUAL}/${requested.id}/confirm`,
      {},
    );
    expect(confirmed.statusCode, confirmed.body).toBe(200);
    expect(confirmed.json()).toEqual({ mode: "peer", reevaluated: null });
    expect((await requestRow(requested.id)).consumed).toBe(true);
    const [after] = await kit.fx.migration<{ version: string }[]>`
      select coalesce(max(version), 0)::text as version from search.facet_config_versions`;
    expect(after?.version).toBe(versions?.version);
  });
});

describe("L3G-T10 AL65: the critical mass of the search, for the administrators alone (CA60; 15 AL65)", () => {
  it("lists the counters stale by the hours since their computation for an administrator, never for an agent", async () => {
    const adminAlerts = (await get(adminA.session, ALERTS)).json<{
      alerts: {
        code: string;
        cause: string;
        count: number;
        since: string | null;
        destination: string | null;
      }[];
    }>().alerts;
    const stale = adminAlerts.find((alert) => alert.code === "AL65");
    expect(stale).toMatchObject({
      code: "AL65",
      cause: "counters_stale",
      destination: null,
    });
    // five days, in whole hours: never a figure of a creator
    expect(stale?.count).toBeGreaterThanOrEqual(120);
    expect(stale?.since).not.toBeNull();
    const agentAlerts = (await get(agent.session, ALERTS)).json<{
      alerts: { code: string }[];
    }>().alerts;
    expect(
      agentAlerts.filter((alert) => ["AL22", "AL65"].includes(alert.code)),
    ).toEqual([]);
  });
});

// L3G commit 10 — L3G-T10: queue 9 of the backoffice, « sélection par l'équipe INFLUX », its routes under
// /v1/bo/team-selection/entries (docs/mvp/10 RG61, RG84; 15 RG26 to RG28, RG33, RG34, RG36, C1 to C3, C5, AL23;
// 17b I13; 18 T14, TM12.5; D45, D46, D48, D78; jalons/l3g/modele.md §5, §8; l3g-fiche invariants 8, 11, 12, 14).
// Through fastify.inject(), straight to apps/api, the four doors of 0330 behind them, as an agent, a second
// agent and an administrator of a backoffice session in aal2:
//   - the list: the exact keys of a page and of a row (a brand, a campaign, a deadline, a lock; never the
//     message, a criterion, a rate nor a budget), the deadline order, the filters, the cursor; a request of a
//     brand the caller HOLDS is absent from his list and his counters (15 RG36);
//   - opening is claiming (C1, C2): claimed, held, read_only with the holder named; the message served as PLAIN
//     text, bidirectional controls and control characters removed (L3FS-7), the criteria as the brand entered
//     them; the opening is in the register;
//   - the holder alone releases, extends and closes: a colleague gets 409 `claim` held_by_other and the name
//     of the holder, a free request 409 claim_not_held; an expired claim is taken over;
//   - the closure by a reason of the closed list, the note for `other` alone (400 otherwise), the register
//     holding the reason code and never the note; a closed request stays closed (409 entry_closed);
//   - T14: an unknown request and one of a brand the caller holds answer exactly alike, on every route;
//     TM12.5: a member gets the 404 of a route that does not exist on the web surface, a 401 on the backoffice's;
//   - AL23: the open requests past their deadline, for the agents and the administrators, the held brand not
//     counted for its holder, falling by itself when they are closed;
//   - D45, RG8: nothing to the outbox, to `matching.*` nor to the messaging, the brand is not told.
// Accounts COMMITTED through campaign-review-kit.ts; the requests are written by the migration role (the
// deposit has its own tests, selection-request-route.test.ts) and removed with the file.
import {
  closeTeamSelectionRequestSchema,
  teamSelectionEntriesResponseSchema,
} from "@influx/contracts/backoffice-queues";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { routeInventoryOf } from "../src/server.ts";
import {
  answer,
  issuesOf,
  openReviewKit,
  type Internal,
  type ReviewKit,
} from "./campaign-review-kit.ts";
import type { Member } from "./campaign-routes-kit.ts";
import { sideEffectsOf } from "./creator-search-kit.ts";

const ENTRIES = "/v1/bo/team-selection/entries";
const NIL = "00000000-0000-4000-8000-000000000000";
const FILTERS = { F1: "pets", F6: { country: "FR" } };
const BIDI = String.fromCodePoint(0x202e);
const PDF = String.fromCodePoint(0x202c);
const LRI = String.fromCodePoint(0x2066);
const PDI = String.fromCodePoint(0x2069);
const BELL = String.fromCodePoint(0x07);

let kit: ReviewKit;
let agent: Internal;
let otherAgent: Internal;
let admin: Internal;
let brand: Member;
let heldBrand: Member;
let campaign: { campaignId: string; title: string };
const requestIds: string[] = [];

/** The keys of a page of the list, and of a row, and no other. */
const PAGE_KEYS = ["asOf", "counters", "items", "nextCursor"];
const ROW_KEYS = [
  "advertiserAccountId",
  "brandName",
  "campaignId",
  "campaignTitle",
  "claim",
  "createdAt",
  "id",
  "language",
  "overdue",
  "owner",
  "slaDueAt",
];
const COUNTER_KEYS = [
  "lastDecidedAt",
  "oldestCreatedAt",
  "overdue",
  "pending",
  "policy",
  "queue",
  "unclaimed",
];

type Row = {
  id: string;
  advertiserAccountId: string;
  brandName: string | null;
  campaignId: string | null;
  campaignTitle: string | null;
  overdue: boolean;
  owner: { accountId: string; displayName: string | null } | null;
  claim: {
    holder: { accountId: string; displayName: string | null } | null;
    claimedAt: string | null;
    claimExpiresAt: string | null;
    heldByCaller: boolean;
  };
};
type Page = {
  asOf: string;
  counters: {
    pending: number;
    overdue: number;
    unclaimed: number;
    queue: string;
  } | null;
  items: Row[];
  nextCursor: string | null;
};
type Opened = {
  outcome: string;
  holder: { accountId: string; displayName: string | null } | null;
  claimedAt: string | null;
  claimExpiresAt: string | null;
  request: {
    id: string;
    brandName: string | null;
    campaign: { id: string; title: string | null } | null;
    filters: Record<string, unknown>;
    message: string | null;
    state: string;
    closure: {
      reasonCode: string;
      note: string | null;
      closedBy: { accountId: string } | null;
    } | null;
  };
};

type Deposit = {
  brand?: Member;
  message?: string | null;
  overdue?: boolean;
  campaignId?: string | null;
};

/** One open request, written by the migration role: due tomorrow, or a day ago when `overdue`. */
async function deposit(options: Deposit = {}): Promise<string> {
  const overdue = options.overdue === true;
  const [row] = await kit.fx.migration<{ id: string }[]>`
    insert into search.selection_requests
      (advertiser_account_id, campaign_id, filters, language, message, sla_due_at, created_at)
    values (${(options.brand ?? brand).accountId}, ${options.campaignId ?? null},
            ${JSON.stringify(FILTERS)}::text::jsonb, 'fr', ${options.message ?? null},
            case when ${overdue} then now() - interval '1 day' else now() + interval '1 day' end,
            case when ${overdue} then now() - interval '3 days' else now() end)
    returning id::text`;
  if (row === undefined) {
    throw new Error("no request written");
  }
  requestIds.push(row.id);
  return row.id;
}

const get = (session: string | null, url: string) =>
  kit.bo("GET", url, session);
const post = (session: string | null, url: string, body?: object) =>
  kit.bo("POST", url, session, body);

/** Every row of the list for `who`, following the cursor (other files leave nothing, but the page is capped). */
async function listAll(who: Internal): Promise<Page & { items: Row[] }> {
  let cursor: string | null = null;
  let first: Page | null = null;
  const items: Row[] = [];
  for (let pages = 0; pages < 20; pages += 1) {
    const response = await post(who.session, `${ENTRIES}/search`, {
      limit: 50,
      ...(cursor === null ? {} : { cursor }),
    });
    expect(response.statusCode, response.body).toBe(200);
    const page = response.json<Page>();
    first ??= page;
    items.push(...page.items);
    cursor = page.nextCursor;
    if (cursor === null) {
      break;
    }
  }
  if (first === null) {
    throw new Error("no page");
  }
  return { ...first, items };
}

const open = (who: Internal, id: string) =>
  post(who.session, `${ENTRIES}/${id}/open`);

async function stateOf(id: string) {
  const [row] = await kit.fx.migration<
    {
      state: string;
      claimed_by: string | null;
      closed_by: string | null;
      reason: string | null;
      note: string | null;
    }[]
  >`
    select state, claimed_by_account_id::text as claimed_by,
           closed_by_account_id::text as closed_by, close_reason_code as reason, close_note as note
      from search.selection_requests where id = ${id}`;
  if (row === undefined) {
    throw new Error("no such request");
  }
  return row;
}

/** AL23 of GET /v1/bo/alerts for `who`: its count, 0 when it is not up. */
async function al23Of(
  who: Internal,
): Promise<{ count: number; cause?: string }> {
  const response = await get(who.session, "/v1/bo/alerts");
  expect(response.statusCode, response.body).toBe(200);
  const alert = response
    .json<{ alerts: { code: string; cause: string; count: number }[] }>()
    .alerts.find((found) => found.code === "AL23");
  return alert === undefined
    ? { count: 0 }
    : { count: alert.count, cause: alert.cause };
}

let free: string;
let overdueFree: string;
let held: string;
let unknownAnswer: ReturnType<typeof answer>;

beforeAll(async () => {
  kit = await openReviewKit();
  agent = await kit.newInternal("agent", "Alix");
  otherAgent = await kit.newInternal("agent", "Camille");
  admin = await kit.newInternal("admin", "Dominique");
  brand = await kit.newBrand();
  heldBrand = await kit.newBrand({ owner: agent.accountId });
  campaign = await kit.submitCampaign(brand);
  free = await deposit({
    message: "Bonjour, une sélection s'il vous plaît.",
    campaignId: campaign.campaignId,
  });
  overdueFree = await deposit({ overdue: true });
  held = await deposit({ brand: heldBrand, message: "Held brand" });
  unknownAnswer = answer(await open(agent, randomUUID()));
  expect(unknownAnswer.status).toBe(404);
});

afterAll(async () => {
  await kit.fx.migration`
    delete from search.selection_requests where id = any(${requestIds}::uuid[])`;
  await kit.close();
});

describe("L3G-T10 the list holds the brand, the campaign, the deadline and the lock, never the words of the brand (fiche invariants 11, 12)", () => {
  it("serves a page and rows of exact keys, the counters of queue 9, no-store, no message nor criterion", async () => {
    const response = await get(agent.session, `${ENTRIES}?limit=50`);
    expect(response.statusCode, response.body).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const page = response.json<Page>();
    expect(Object.keys(page).sort()).toEqual(PAGE_KEYS);
    expect(Object.keys(page.counters ?? {}).sort()).toEqual(COUNTER_KEYS);
    expect(page.counters?.queue).toBe("team_selection");
    expect(teamSelectionEntriesResponseSchema.safeParse(page).success).toBe(
      true,
    );
    const all = await listAll(agent);
    const row = all.items.find((found) => found.id === free);
    expect(row).toMatchObject({
      id: free,
      advertiserAccountId: brand.accountId,
      campaignId: campaign.campaignId,
      campaignTitle: campaign.title,
      overdue: false,
      owner: null,
      claim: {
        holder: null,
        claimedAt: null,
        claimExpiresAt: null,
        heldByCaller: false,
      },
    });
    for (const found of all.items) {
      expect(Object.keys(found).sort()).toEqual(ROW_KEYS);
    }
    for (const marker of ["Bonjour", "pets", "message", "filters"]) {
      expect(response.body).not.toContain(marker);
    }
  });

  it("RG36: a request of a brand the caller holds is neither listed nor counted for him, and is for a colleague", async () => {
    const mine = await listAll(agent);
    const theirs = await listAll(otherAgent);
    const adminView = await listAll(admin);
    expect(mine.items.map((row) => row.id)).not.toContain(held);
    expect(theirs.items.map((row) => row.id)).toContain(held);
    expect(adminView.items.map((row) => row.id)).toContain(held);
    const heldRow = theirs.items.find((row) => row.id === held);
    expect(heldRow?.owner).toEqual({
      accountId: agent.accountId,
      displayName: "Alix",
    });
    // the same queue seen by two agents: the one request the first holds is the whole difference
    expect(
      (theirs.counters?.pending ?? 0) - (mine.counters?.pending ?? 0),
    ).toBe(1);
    expect(
      (theirs.counters?.unclaimed ?? 0) - (mine.counters?.unclaimed ?? 0),
    ).toBe(1);
  });

  it("lists the oldest deadline first, the overdue ones in front, and applies the filters of RG33", async () => {
    const all = await listAll(agent);
    const ids = all.items.map((row) => row.id);
    expect(ids.indexOf(overdueFree)).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf(overdueFree)).toBeLessThan(ids.indexOf(free));
    const late = await get(agent.session, `${ENTRIES}?overdue=true&limit=50`);
    const lateIds = late.json<Page>().items.map((row) => row.id);
    expect(lateIds).toContain(overdueFree);
    expect(lateIds).not.toContain(free);
    const freeOnly = await post(agent.session, `${ENTRIES}/search`, {
      holder: "free",
      limit: 50,
    });
    expect(
      freeOnly.json<Page>().items.every((row) => row.claim.holder === null),
    ).toBe(true);
    // the request page is bounded and closed: no size beyond the cap, no other key, a cursor that is a cursor
    for (const [url, body] of [
      [`${ENTRIES}?limit=51`, undefined],
      [`${ENTRIES}?cursor=nonsense`, undefined],
      [`${ENTRIES}?state=closed`, undefined],
    ] as const) {
      const refused = await get(agent.session, url);
      expect(refused.statusCode, `${url} ${String(body)}`).toBe(400);
    }
    expect(
      (await post(agent.session, `${ENTRIES}/search`, { limit: 51 }))
        .statusCode,
    ).toBe(400);
  });
});

describe("L3G-T10 opening is claiming, and the message is plain text (15 C1, C2; L3FS-7; D46)", () => {
  it("claims a free request, then holds it; a colleague and an administrator read it, the holder named; each opening is journaled", async () => {
    const first = await open(agent, free);
    expect(first.statusCode, first.body).toBe(200);
    expect(first.headers["cache-control"]).toBe("no-store");
    const claimed = first.json<Opened>();
    expect(claimed).toMatchObject({
      outcome: "claimed",
      holder: { accountId: agent.accountId, displayName: "Alix" },
    });
    expect(claimed.claimedAt).not.toBeNull();
    expect(claimed.claimExpiresAt).not.toBeNull();
    expect(claimed.request).toMatchObject({
      id: free,
      brandName: expect.any(String),
      campaign: { id: campaign.campaignId, title: campaign.title },
      filters: FILTERS,
      message: "Bonjour, une sélection s'il vous plaît.",
      state: "open",
      closure: null,
    });
    expect((await open(agent, free)).json<Opened>().outcome).toBe("held");
    for (const who of [otherAgent, admin]) {
      const read = (await open(who, free)).json<Opened>();
      expect(read.outcome).toBe("read_only");
      expect(read.holder).toEqual({
        accountId: agent.accountId,
        displayName: "Alix",
      });
    }
    const lines = await kit.register(free, "queue.entry_opened");
    expect(lines.map((line) => line.payload)).toEqual([
      { queue_code: "team_selection", outcome: "claimed" },
      { queue_code: "team_selection", outcome: "held" },
      { queue_code: "team_selection", outcome: "read_only" },
      { queue_code: "team_selection", outcome: "read_only" },
    ]);
    // the claim shows in the list, for the holder and for the others
    const mine = (await listAll(agent)).items.find((row) => row.id === free);
    expect(mine?.claim.heldByCaller).toBe(true);
    const theirs = (await listAll(otherAgent)).items.find(
      (row) => row.id === free,
    );
    expect(theirs?.claim).toMatchObject({
      holder: { accountId: agent.accountId, displayName: "Alix" },
      heldByCaller: false,
    });
  });

  it("serves the message as plain text: bidirectional controls and control characters removed, markup left as characters", async () => {
    const id = await deposit({
      message: [
        "Hello ",
        BIDI,
        "evil",
        PDF,
        " <b>bold</b>",
        BELL,
        LRI,
        "x",
        PDI,
        "\r\nsecond line",
      ].join(""),
    });
    const opened = (await open(agent, id)).json<Opened>();
    expect(opened.request.message).toBe("Hello evil <b>bold</b>x\nsecond line");
    const clean = JSON.stringify(opened);
    for (const control of [BIDI, PDF, BELL, LRI, PDI, "\r"]) {
      expect(clean).not.toContain(control);
    }
    // a request without a message answers null, never an empty text
    const bare = await deposit();
    expect((await open(agent, bare)).json<Opened>().request.message).toBeNull();
    await post(agent.session, `${ENTRIES}/${id}/release`);
    await post(agent.session, `${ENTRIES}/${bare}/release`);
  });
});

describe("L3G-T10 the holder alone releases, extends and closes (15 C2, C3; file.md A9; 17b I13)", () => {
  it("answers 409 `claim` held_by_other with the name of the holder to a colleague, claim_not_held to anybody on a free request", async () => {
    // `free` is held by the first agent since the opening above
    for (const route of ["release", "extend"] as const) {
      const refused = await post(
        otherAgent.session,
        `${ENTRIES}/${free}/${route}`,
      );
      expect(refused.statusCode, route).toBe(409);
      expect(issuesOf(refused)).toEqual([
        { path: "claim", issue: "held_by_other" },
        { path: "claim.holder", issue: "Alix" },
      ]);
    }
    const noClose = await post(otherAgent.session, `${ENTRIES}/${free}/close`, {
      reasonCode: "duplicate",
    });
    expect(noClose.statusCode).toBe(409);
    expect(issuesOf(noClose)[0]).toEqual({
      path: "claim",
      issue: "held_by_other",
    });
    expect((await stateOf(free)).state).toBe("open");
    // a request nobody holds: nothing to give back, extend or close
    const bare = await deposit();
    for (const [route, body] of [
      ["release", undefined],
      ["extend", undefined],
      ["close", { reasonCode: "duplicate" }],
    ] as const) {
      const refused = await post(
        agent.session,
        `${ENTRIES}/${bare}/${route}`,
        body,
      );
      expect(refused.statusCode, route).toBe(409);
      expect(issuesOf(refused)).toEqual([
        { path: "claim", issue: "claim_not_held" },
      ]);
    }
  });

  it("extends the claim, gives it back, lets a colleague take it, and takes over an expired one (the lapse journaled)", async () => {
    const before = (await open(agent, free)).json<Opened>();
    const extended = await post(agent.session, `${ENTRIES}/${free}/extend`);
    expect(extended.statusCode, extended.body).toBe(200);
    const { claimExpiresAt } = extended.json<{ claimExpiresAt: string }>();
    expect(Date.parse(claimExpiresAt)).toBeGreaterThanOrEqual(
      Date.parse(before.claimExpiresAt ?? ""),
    );
    const released = await post(agent.session, `${ENTRIES}/${free}/release`);
    expect(released.json()).toEqual({ released: true });
    expect((await stateOf(free)).claimed_by).toBeNull();
    const taken = (await open(otherAgent, free)).json<Opened>();
    expect(taken).toMatchObject({
      outcome: "claimed",
      holder: { accountId: otherAgent.accountId },
    });
    // his claim lapses: the first agent takes the request over, the lapse written first with its holder
    await kit.fx.migration`
      update search.selection_requests
         set claimed_at = now() - interval '2 hours', claim_expires_at = now() - interval '1 hour'
       where id = ${free}`;
    const over = (await open(agent, free)).json<Opened>();
    expect(over.outcome).toBe("claimed");
    const lapses = await kit.register(free, "queue.claim_expired");
    expect(lapses.at(-1)?.payload).toMatchObject({
      queue_code: "team_selection",
      holder_account_id: otherAgent.accountId,
    });
    // and the colleague, whose claim is gone, is told so, not that somebody else holds it by mistake
    const late = await post(otherAgent.session, `${ENTRIES}/${free}/extend`);
    expect(late.statusCode).toBe(409);
    expect(issuesOf(late)[0]).toEqual({
      path: "claim",
      issue: "held_by_other",
    });
  });
});

describe("L3G-T10 the closure takes a reason of the closed list, the note for `other` alone (17b I13; 0330)", () => {
  it("closes with a reason, the register holding the code and never the note, and answers the request to open next", async () => {
    const id = await deposit({ message: "To be closed" });
    await open(agent, id);
    const closed = await post(agent.session, `${ENTRIES}/${id}/close`, {
      reasonCode: "off_brief",
    });
    expect(closed.statusCode, closed.body).toBe(200);
    const body = closed.json<{
      closedAt: string;
      next: { entryId: string } | null;
    }>();
    expect(Object.keys(body).sort()).toEqual(["closedAt", "next"]);
    // never the request just closed
    expect(body.next?.entryId).not.toBe(id);
    expect(await stateOf(id)).toMatchObject({
      state: "closed",
      claimed_by: null,
      closed_by: agent.accountId,
      reason: "off_brief",
      note: null,
    });
    const lines = await kit.register(id, "search.selection_request_closed");
    expect(lines.map((line) => line.payload)).toEqual([
      { reason_code: "off_brief" },
    ]);
    // a closed request opens as closed, with its closure, and nothing can be done to it again
    const again = (await open(otherAgent, id)).json<Opened>();
    expect(again.outcome).toBe("closed");
    expect(again.request).toMatchObject({
      state: "closed",
      closure: {
        reasonCode: "off_brief",
        note: null,
        closedBy: { accountId: agent.accountId },
      },
    });
    for (const [route, body] of [
      ["release", undefined],
      ["close", { reasonCode: "duplicate" }],
    ] as const) {
      const refused = await post(
        agent.session,
        `${ENTRIES}/${id}/${route}`,
        body,
      );
      expect(refused.statusCode, route).toBe(409);
      expect(issuesOf(refused)).toEqual([
        { path: "entry", issue: "entry_closed" },
      ]);
    }
  });

  it("asks a note of 10 to 500 characters for `other` and for `other` alone; a reason outside the list is refused", async () => {
    const id = await deposit();
    await open(agent, id);
    const invalid: object[] = [
      { reasonCode: "other" },
      { reasonCode: "other", note: "too short" },
      { reasonCode: "other", note: "x".repeat(501) },
      { reasonCode: "duplicate", note: "A note nobody asked for" },
      { reasonCode: "budget_mismatch" },
      { reasonCode: "suspected_circumvention" },
      {},
      { reasonCode: "duplicate", extra: true },
    ];
    for (const body of invalid) {
      const refused = await post(agent.session, `${ENTRIES}/${id}/close`, body);
      expect(refused.statusCode, JSON.stringify(body)).toBe(400);
      expect(refused.json<{ error: { code: string } }>().error.code).toBe(
        "validation_failed",
      );
    }
    // nothing was closed by the refusals
    expect((await stateOf(id)).state).toBe("open");
    expect(
      closeTeamSelectionRequestSchema.safeParse({
        reasonCode: "other",
        note: "  a note of ten characters  ",
      }).success,
    ).toBe(true);
    const note = "The brand asks for something INFLUX does not do.";
    const closed = await post(agent.session, `${ENTRIES}/${id}/close`, {
      reasonCode: "other",
      note: `  ${note}  `,
    });
    expect(closed.statusCode, closed.body).toBe(200);
    expect(await stateOf(id)).toMatchObject({
      state: "closed",
      reason: "other",
      note,
    });
    // the register carries the code alone: the note is for the agents of the queue
    const lines = await kit.register(id, "search.selection_request_closed");
    expect(lines.map((line) => line.payload)).toEqual([
      { reason_code: "other" },
    ]);
    const read = (await open(admin, id)).json<Opened>();
    expect(read.request.closure).toMatchObject({
      reasonCode: "other",
      note,
    });
  });
});

describe("L3G-T10 T14, TM12.5: the agents alone reach the queue, and an object that is not theirs answers like one that does not exist", () => {
  it("T14.3, T14.4: an unknown request and one of a brand the caller holds answer exactly alike, on every route", async () => {
    const routes: [string, object | undefined][] = [
      ["open", undefined],
      ["release", undefined],
      ["extend", undefined],
      ["close", { reasonCode: "duplicate" }],
    ];
    for (const [route, body] of routes) {
      const unknown = answer(
        await post(agent.session, `${ENTRIES}/${randomUUID()}/${route}`, body),
      );
      expect(unknown.status, route).toBe(404);
      expect(
        answer(await post(agent.session, `${ENTRIES}/${held}/${route}`, body)),
        route,
      ).toEqual(unknown);
    }
    // the holder of a brand is no holder of its request: nothing of it was claimed, closed or written
    expect(await stateOf(held)).toMatchObject({
      state: "open",
      claimed_by: null,
    });
    // a colleague, who does not hold the brand, may take it
    const taken = (await open(otherAgent, held)).json<Opened>();
    expect(taken.outcome).toBe("claimed");
    await post(otherAgent.session, `${ENTRIES}/${held}/release`);
  });

  it("TM12.5: a member of any role gets the 404 of a route that does not exist on the web surface and a 401 on the backoffice's; the inventory knows every route", async () => {
    const creator = await kit.fx.newMember("creator");
    const memberSession = await kit.memberSession();
    const routes = [
      ["GET", ENTRIES, undefined],
      ["POST", `${ENTRIES}/search`, {}],
      ["POST", `${ENTRIES}/${NIL}/open`, undefined],
      ["POST", `${ENTRIES}/${NIL}/release`, undefined],
      ["POST", `${ENTRIES}/${NIL}/extend`, undefined],
      ["POST", `${ENTRIES}/${NIL}/close`, { reasonCode: "duplicate" }],
    ] as const;
    const unknownWeb = answer(
      await kit.bo(
        "GET",
        "/v1/bo/team-selection/nothing",
        creator.session,
        undefined,
        { surface: "web", cookie: "__Host-influx-session" },
      ),
    );
    expect(unknownWeb.status).toBe(404);
    for (const [method, url, body] of routes) {
      for (const [session, cookie] of [
        [creator.session, "__Host-influx-session"],
        [brand.session, "__Host-influx-session"],
        [memberSession, "__Host-influx-session"],
      ] as const) {
        expect(
          answer(
            await kit.bo(method, url, session, body, {
              surface: "web",
              cookie,
            }),
          ),
          `${method} ${url} web`,
        ).toEqual(unknownWeb);
      }
      for (const session of [null, creator.session, brand.session]) {
        const refused = answer(await kit.bo(method, url, session, body));
        expect(refused.status, `${method} ${url} backoffice`).toBe(401);
      }
    }
    const registered = routeInventoryOf(kit.server)
      .filter((route) => route.url.includes("/v1/bo/team-selection/"))
      .map((route) => `${route.method} ${route.url}`);
    expect(registered.sort()).toEqual(
      [
        `GET ${ENTRIES}`,
        `POST ${ENTRIES}/search`,
        `POST ${ENTRIES}/:id/open`,
        `POST ${ENTRIES}/:id/release`,
        `POST ${ENTRIES}/:id/extend`,
        `POST ${ENTRIES}/:id/close`,
      ].sort(),
    );
  });
});

describe("L3G-T10 AL23: the requests past their deadline, for the agents and the administrators (15 §F; RG36, RG64)", () => {
  it("lists AL23 with its count for an agent and an administrator, the held brand left out for its holder, and it falls by itself once the requests are closed", async () => {
    const before = {
      agent: await al23Of(agent),
      other: await al23Of(otherAgent),
      admin: await al23Of(admin),
    };
    const lateFree = await deposit({ overdue: true });
    const lateHeld = await deposit({ brand: heldBrand, overdue: true });
    const after = {
      agent: await al23Of(agent),
      other: await al23Of(otherAgent),
      admin: await al23Of(admin),
    };
    expect(after.agent.count - before.agent.count).toBe(1);
    expect(after.other.count - before.other.count).toBe(2);
    expect(after.admin.count - before.admin.count).toBe(2);
    for (const found of Object.values(after)) {
      expect(found.cause).toBe("selection_past_deadline");
    }
    // the alert of an agent is derived at each read: closing the two requests puts it back
    for (const id of [lateFree, lateHeld]) {
      expect((await open(otherAgent, id)).json<Opened>().outcome).toBe(
        "claimed",
      );
      const closed = await post(otherAgent.session, `${ENTRIES}/${id}/close`, {
        reasonCode: "duplicate",
      });
      expect(closed.statusCode, closed.body).toBe(200);
    }
    expect((await al23Of(agent)).count).toBe(before.agent.count);
    expect((await al23Of(otherAgent)).count).toBe(before.other.count);
    expect((await al23Of(admin)).count).toBe(before.admin.count);
  });
});

describe("L3G-T10 D45, RG8: the queue writes neither the outbox, nor matching, nor the messaging, and tells nobody", () => {
  it("opening, extending, releasing and closing leave the outbox, matching.* and messaging.* as they were; the brand has no line", async () => {
    const id = await deposit({ message: "Side effects" });
    const before = await sideEffectsOf(kit.fx);
    const brandLines = await kit.outbox(brand.accountId);
    await open(agent, id);
    await post(agent.session, `${ENTRIES}/${id}/extend`);
    await post(agent.session, `${ENTRIES}/${id}/release`);
    await open(otherAgent, id);
    const closed = await post(otherAgent.session, `${ENTRIES}/${id}/close`, {
      reasonCode: "campaign_closed",
    });
    expect(closed.statusCode, closed.body).toBe(200);
    expect(await sideEffectsOf(kit.fx)).toEqual(before);
    expect(await kit.outbox(brand.accountId)).toEqual(brandLines);
  });
});

// T14 (L3C, commit 07) — the routes of queue 7 and of the campaign record, on the local stack through the pools of
// apps/api (docs/mvp/09 RG85, RG88; 15 RG36, CA19; 18 T14.1 to T14.4; jalons/l3c/modele.md §1, §5, §6; l3c-fiche
// invariants 4, 11; migrations 0307, 0312): for each route of /v1/bo/campaigns, the web surface, no session and a
// member session never reach it; an entry or a campaign that does not exist, the one of the caller's own account
// and the open entry whose first examination the caller gave answer ONE answer (same status, code, message);
// an account the caller HOLDS answers 403 `conflict_of_interest`, the attempt journaled, and is absent from the
// list and the counters; and no brief, title, opinion, comment nor address typed here reaches a log (D60).
// The brands and campaigns are those of campaign-review-kit.ts (submitted through the member routes).
import { valuesFoundIn } from "@influx/test-kit/logs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ANY_TOKEN,
  answer,
  BO_CAMPAIGNS,
  BO_ENTRIES,
  issuesOf,
  NIL,
  openReviewKit,
  type Internal,
  type ReviewKit,
  type SubmittedCampaign,
} from "./campaign-review-kit.ts";
import { localSuperuser } from "./support.ts";

type Method = "GET" | "POST";

let kit: ReviewKit;
/** The commercial who HOLDS the brands of this file, two agents who decide, an administrator. */
let holder: Internal;
let agentA: Internal;
let agentB: Internal;
let admin: Internal;
let ownCampaign: { campaignId: string; entryId: string } | undefined;

/** A body that passes the schema of each route: a refusal must come from the rule, never from a 400. */
const BODIES: Readonly<Record<string, object | undefined>> = {
  open: undefined,
  release: undefined,
  extend: undefined,
  "force-release": { reasonCode: "holder_absent" },
  "first-review": {
    reviewToken: ANY_TOKEN,
    opinion: "An opinion of at least twenty characters.",
  },
  publish: { reviewToken: ANY_TOKEN, ownerAgentId: NIL },
  reject: { reviewToken: ANY_TOKEN, reasonCode: "brief_insufficient" },
  corrections: {
    fieldCode: "title",
    value: "T14 title",
    reasonCode: "entry_error",
  },
  pause: { reasonCode: "brand_request" },
  resume: { reasonCode: "brand_request" },
  close: { reasonCode: "brand_request" },
};

type Target = { method: Method; url: (id: string) => string; body?: object };

function entryRoute(act: string): Target {
  const body = BODIES[act];
  return {
    method: "POST",
    url: (id) => `${BO_ENTRIES}/${id}/${act}`,
    ...(body === undefined ? {} : { body }),
  };
}

function campaignRoute(act: string): Target {
  const body = BODIES[act];
  return {
    method: "POST",
    url: (id) => `${BO_CAMPAIGNS}/${id}/${act}`,
    ...(body === undefined ? {} : { body }),
  };
}

const ENTRY_ROUTES: Record<string, Target> = Object.fromEntries(
  [
    "open",
    "release",
    "extend",
    "force-release",
    "first-review",
    "publish",
    "reject",
  ].map((act) => [act, entryRoute(act)]),
);
const CAMPAIGN_ROUTES: Record<string, Target> = {
  record: { method: "GET", url: (id) => `${BO_CAMPAIGNS}/${id}` },
  ...Object.fromEntries(
    ["corrections", "pause", "resume", "close"].map((act) => [
      act,
      campaignRoute(act),
    ]),
  ),
};
const EVERY_ROUTE: Record<string, Target> = {
  ...ENTRY_ROUTES,
  ...CAMPAIGN_ROUTES,
  list: { method: "GET", url: () => `${BO_ENTRIES}?limit=1` },
  search: { method: "POST", url: () => `${BO_ENTRIES}/search`, body: {} },
  create: {
    method: "POST",
    url: () => BO_CAMPAIGNS,
    body: {
      advertiserAccountId: NIL,
      title: "T14 title",
      campaignType: "product_placement",
    },
  },
};

beforeAll(async () => {
  kit = await openReviewKit();
  holder = await kit.newInternal("agent", "Camille");
  agentA = await kit.newInternal("agent", "Alix");
  agentB = await kit.newInternal("agent", "Brice");
  admin = await kit.newInternal("admin", "Dominique");
});

afterAll(async () => {
  if (ownCampaign !== undefined) {
    const { campaignId, entryId } = ownCampaign;
    await localSuperuser().begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`delete from campaigns.campaign_review_entries where id = ${entryId}`;
      await tx`delete from campaigns.campaigns where id = ${campaignId}`;
    });
  }
  await kit.close();
});

async function fresh(options: { sector?: string; declare?: boolean } = {}) {
  const brand = await kit.newBrand({ owner: holder.accountId });
  return kit.submitCampaign(brand, options);
}

async function opened(who: Internal, entryId: string) {
  const response = await kit.bo(
    "POST",
    `${BO_ENTRIES}/${entryId}/open`,
    who.session,
  );
  expect(response.statusCode, response.body).toBe(200);
  return response.json<{ reviewToken: string }>();
}

async function published(): Promise<SubmittedCampaign> {
  const submitted = await fresh();
  const token = (await opened(agentA, submitted.entryId)).reviewToken;
  const response = await kit.bo(
    "POST",
    `${BO_ENTRIES}/${submitted.entryId}/publish`,
    agentA.session,
    { reviewToken: token, ownerAgentId: agentA.accountId },
  );
  expect(response.statusCode, response.body).toBe(200);
  return submitted;
}

/** A campaign and an open entry of the agent's own account: the doors never write them (one role per account). */
async function ownFixture(): Promise<{ campaignId: string; entryId: string }> {
  if (ownCampaign === undefined) {
    const campaignId = randomUUID();
    const entryId = randomUUID();
    await localSuperuser().begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`
        insert into campaigns.campaigns (id, advertiser_account_id)
        values (${campaignId}, ${agentA.accountId})`;
      await tx`
        insert into campaigns.campaign_review_entries
          (id, campaign_id, advertiser_account_id, created_at, sla_due_at, escalate_at)
        values (${entryId}, ${campaignId}, ${agentA.accountId}, now(),
                now() + interval '1 day', now() + interval '2 days')`;
    });
    ownCampaign = { campaignId, entryId };
  }
  return ownCampaign;
}

const WEB = { surface: "web", cookie: "__Host-influx-session" } as const;

describe("T14.1: the surface and the session (18 T14.1; 03 §6.2)", () => {
  it("T14.1 the web surface never reaches a route of /v1/bo/campaigns: the answer of an unknown route, even with a member cookie", async () => {
    const member = await kit.memberSession();
    const unknown = answer(
      await kit.bo("GET", "/v1/bo/no-such-route", member, undefined, WEB),
    );
    expect(unknown.status).toBe(404);
    for (const [name, route] of Object.entries(EVERY_ROUTE)) {
      const response = await kit.bo(
        route.method,
        route.url(NIL),
        member,
        route.body,
        WEB,
      );
      expect(answer(response), name).toEqual(unknown);
    }
  });

  it("T14.1 no session and a member session answer 401 unauthenticated on every route", async () => {
    const member = await kit.memberSession();
    for (const [name, route] of Object.entries(EVERY_ROUTE)) {
      for (const session of [null, member]) {
        const got = answer(
          await kit.bo(route.method, route.url(NIL), session, route.body),
        );
        expect(
          got.status,
          `${name} (${session === null ? "none" : "member"})`,
        ).toBe(401);
        expect(got.error.code, name).toBe("unauthenticated");
      }
    }
  });
});

describe("T14.3, T14.4: what is not the caller's answers like what does not exist", () => {
  it("T14.3 an entry that does not exist, and the one of the caller's own account, answer ONE answer on every route of the queue", async () => {
    const own = await ownFixture();
    for (const [name, route] of Object.entries(ENTRY_ROUTES)) {
      const missing = answer(
        await kit.bo(route.method, route.url(NIL), agentA.session, route.body),
      );
      const hidden = answer(
        await kit.bo(
          route.method,
          route.url(own.entryId),
          agentA.session,
          route.body,
        ),
      );
      // an agent's forced release is refused whatever the entry (CA63): never a signal of existence
      expect(missing.status, name).toBe(name === "force-release" ? 403 : 404);
      expect(hidden, name).toEqual(missing);
    }
  });

  it("T14.3 a campaign that does not exist, and the one of the caller's own account, answer ONE 404 on every route of the record", async () => {
    const own = await ownFixture();
    for (const [name, route] of Object.entries(CAMPAIGN_ROUTES)) {
      const missing = answer(
        await kit.bo(route.method, route.url(NIL), agentA.session, route.body),
      );
      const hidden = answer(
        await kit.bo(
          route.method,
          route.url(own.campaignId),
          agentA.session,
          route.body,
        ),
      );
      expect(missing.status, name).toBe(404);
      expect(hidden, name).toEqual(missing);
    }
  });

  it("T14.4 an entry whose first examination the caller gave is hidden from him: the same 404 as an unknown entry", async () => {
    const sector = await kit.sensitiveSector();
    const submitted = await fresh({ sector, declare: true });
    const token = (await opened(agentA, submitted.entryId)).reviewToken;
    const first = await kit.bo(
      "POST",
      `${BO_ENTRIES}/${submitted.entryId}/first-review`,
      agentA.session,
      {
        reviewToken: token,
        opinion:
          "T14-OPINION-MARKER the authorizations were read and are in order.",
      },
    );
    expect(first.statusCode, first.body).toBe(200);
    kit.fx.watch("T14-OPINION-MARKER");
    const missing = answer(
      await kit.bo("POST", `${BO_ENTRIES}/${NIL}/open`, agentA.session),
    );
    for (const act of ["open", "publish", "reject", "first-review", "extend"]) {
      const route = ENTRY_ROUTES[act];
      expect(route).toBeDefined();
      const got = answer(
        await kit.bo(
          "POST",
          route?.url(submitted.entryId) ?? "",
          agentA.session,
          route?.body,
        ),
      );
      expect(got, act).toEqual(missing);
    }
    // the list does not show it to him either
    const listed = await kit.bo(
      "GET",
      `${BO_ENTRIES}?owner=${holder.accountId}&limit=50`,
      agentA.session,
    );
    expect(
      listed.json<{ items: { id: string }[] }>().items.map((item) => item.id),
    ).not.toContain(submitted.entryId);
  });

  it("T14.4 a body or an identifier of the wrong shape is a 400, never a signal about an object", async () => {
    const badId = answer(
      await kit.bo("POST", `${BO_ENTRIES}/not-a-uuid/open`, agentA.session),
    );
    expect(badId.status).toBe(400);
    const badRecord = await kit.bo(
      "GET",
      `${BO_CAMPAIGNS}/not-a-uuid`,
      agentA.session,
    );
    expect(badRecord.statusCode).toBe(400);
    const strict = await kit.bo(
      "POST",
      `${BO_ENTRIES}/${NIL}/publish`,
      agentA.session,
      { reviewToken: ANY_TOKEN, ownerAgentId: NIL, extra: true },
    );
    expect(strict.statusCode).toBe(400);
  });
});

describe("15 RG36, CA19: the account the caller holds", () => {
  it("T14 the entries of a brand the caller holds are neither listed nor counted for him, and are for a colleague", async () => {
    const submitted = await fresh();
    type Page = {
      items: { id: string }[];
      counters: { pending: number };
    };
    // agent B, who gave no first examination: the entries hidden from agent A are not his case
    const colleague = await kit.bo(
      "GET",
      `${BO_ENTRIES}?limit=50`,
      agentB.session,
    );
    const held = await kit.bo("GET", `${BO_ENTRIES}?limit=50`, holder.session);
    expect(held.statusCode, held.body).toBe(200);
    const colleagueBody = colleague.json<Page>();
    const heldBody = held.json<Page>();
    expect(colleagueBody.items.map((item) => item.id)).toContain(
      submitted.entryId,
    );
    expect(heldBody.items.map((item) => item.id)).not.toContain(
      submitted.entryId,
    );
    expect(colleagueBody.counters.pending).toBeGreaterThan(
      heldBody.counters.pending,
    );
  });

  it("T14 a decision or an opening on an entry of an account the caller holds answers 403 conflict_of_interest, the attempt journaled (CA19)", async () => {
    const submitted = await fresh();
    const count = async () =>
      (await kit.refusedActions(holder.accountId)).filter(
        (code) => code === "queue.conflict_of_interest",
      ).length;
    const before = await count();
    const attempts = ["open", "extend", "first-review", "publish", "reject"];
    for (const act of attempts) {
      const route = ENTRY_ROUTES[act];
      const response = await kit.bo(
        "POST",
        route?.url(submitted.entryId) ?? "",
        holder.session,
        route?.body,
      );
      expect(response.statusCode, `${act} ${response.body}`).toBe(403);
      expect(issuesOf(response), act).toEqual([
        { path: "entry", issue: "conflict_of_interest" },
      ]);
    }
    expect((await count()) - before).toBe(attempts.length);
    // nothing was claimed nor decided
    expect((await kit.campaignRow(submitted.campaignId)).status).toBe(
      "pending_review",
    );
    const [entry] = await kit.fx.migration<
      { state: string; claimed_by_account_id: string | null }[]
    >`
      select state::text, claimed_by_account_id::text
        from campaigns.campaign_review_entries where id = ${submitted.entryId}`;
    expect(entry).toEqual({ state: "open", claimed_by_account_id: null });
  });

  it("T14 the correction of a pending campaign of a held account is refused 403 and journaled; the record and the passages of a published one are admitted (modele §5, §6)", async () => {
    const pending = await fresh();
    const refused = await kit.bo(
      "POST",
      `${BO_CAMPAIGNS}/${pending.campaignId}/corrections`,
      holder.session,
      BODIES.corrections,
    );
    expect(refused.statusCode).toBe(403);
    expect(issuesOf(refused)).toEqual([
      { path: "entry", issue: "conflict_of_interest" },
    ]);
    const live = await published();
    const read = await kit.bo(
      "GET",
      `${BO_CAMPAIGNS}/${live.campaignId}`,
      holder.session,
    );
    expect(read.statusCode, read.body).toBe(200);
    const paused = await kit.bo(
      "POST",
      `${BO_CAMPAIGNS}/${live.campaignId}/pause`,
      holder.session,
      BODIES.pause,
    );
    expect(paused.statusCode, paused.body).toBe(200);
    const resumed = await kit.bo(
      "POST",
      `${BO_CAMPAIGNS}/${live.campaignId}/resume`,
      admin.session,
      BODIES.resume,
    );
    expect(resumed.statusCode, resumed.body).toBe(200);
  });
});

describe("D60: nothing typed in this file reaches a log", () => {
  it("T14 wrote no brief, title, opinion, comment nor address in any log of the file", async () => {
    const submitted = await fresh();
    kit.fx.watch("T14-COMMENT-MARKER", "t14-contact@example.com");
    await opened(agentA, submitted.entryId);
    await kit.bo(
      "POST",
      `${BO_CAMPAIGNS}/${submitted.campaignId}/corrections`,
      agentA.session,
      {
        fieldCode: "title",
        value: "T14 corrected title",
        reasonCode: "other",
        internalComment: "T14-COMMENT-MARKER",
      },
    );
    await kit.bo(
      "POST",
      `${BO_ENTRIES}/${submitted.entryId}/reject`,
      agentA.session,
      {
        reviewToken: ANY_TOKEN,
        reasonCode: "other",
        memberMessage: "Please write to t14-contact@example.com about it.",
      },
    );
    expect(kit.fx.logStreams.length).toBeGreaterThan(0);
    const text = kit.fx.logStreams.map((stream) => stream()).join("\n");
    expect(valuesFoundIn(text, [...new Set(kit.fx.watchedValues)])).toEqual([]);
    expect(agentB.accountId).not.toBe(agentA.accountId);
  });
});

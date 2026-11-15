// L3C-T7 (commit 07) — the routes of queue 7, « campagnes à valider », and of the record of a campaign on the
// local stack through the pools of apps/api (docs/mvp/09 RG1, RG5, RG8, RG9, RG21 to RG23, RG85, RG87 to RG95;
// 15 RG26 to RG28, RG33, RG34, C1 to C8; 17b §3.8; jalons/l3c/modele.md §1, §3 to §6; l3c-fiche invariants 1, 2,
// 4 to 6, 12; migrations 0307 to 0309, 0312):
//   the list and its search, the opening that claims, release, extension and forced release, the first review,
//   the publication, the refusal, the record (a journaled read), the correction of a field, the creation for a
//   brand, and the pause, resume and close of an agent.
// T14 on each route (the web surface, no session, a member session, an unknown or own campaign, the account
// the caller holds): t14-campaign-review-route.test.ts. The campaigns are SUBMITTED through the member routes
// of L3B (campaign-review-kit.ts): the entry is the one the door of 0307 writes. Every list is read through the
// filter `owner`: the brands of this file are held by one commercial, so the entries of other files never enter
// the expectations.
import type { LightMyRequestResponse } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ANY_TOKEN,
  BO_CAMPAIGNS,
  BO_ENTRIES,
  issuesOf,
  NIL,
  openReviewKit,
  type Internal,
  type ReviewKit,
  type SubmittedCampaign,
  type SubmitOptions,
} from "./campaign-review-kit.ts";

let kit: ReviewKit;
/** The commercial who holds the brands of this file (D54), the two agents and the administrator who decide. */
let holder: Internal;
let agentA: Internal;
let agentB: Internal;
let admin: Internal;

type Row = {
  id: string;
  campaignId: string;
  brandName: string | null;
  title: string | null;
  enhancedReview: boolean;
  phase: string;
  firstReviewer: { accountId: string; displayName: string | null } | null;
  claim: {
    holder: { accountId: string; displayName: string | null } | null;
    heldByCaller: boolean;
  };
  alerts: string[];
};
type ListBody = {
  asOf: string;
  counters: { queue: string; pending: number } | null;
  items: Row[];
  nextCursor: string | null;
};
type Opened = {
  outcome: string;
  reviewToken: string | null;
  entry: {
    state: string;
    claim: {
      holder: { displayName: string | null } | null;
      heldByCaller: boolean;
    };
    review: {
      phase: string;
      enhancedReview: boolean;
      firstReviewer: { accountId: string } | null;
      firstOpinion: string | null;
    };
    decision: { rejectionReasonCode: string | null } | null;
  };
  brand: { name: string | null };
  campaign: Record<string, unknown>;
  status: string;
  alerts: {
    code: string;
    field: string;
    position: number | null;
    signals: string[];
  }[];
  duplicateOf: { campaignId: string } | null;
  reasons: { code: string; requiresMemberMessage: boolean; message: string }[];
  responsibles: { accountId: string }[];
};
type Record_ = {
  cycle: {
    status: string;
    pauseOrigin: string | null;
    snapshotVersion: number | null;
    owner: { accountId: string } | null;
  };
  fields: Record<string, unknown>;
  entries: {
    state: string;
    firstReviewedBy: { accountId: string } | null;
    decision: { rejectionReasonCode: string | null } | null;
  }[];
  interventions: {
    kind: string;
    fieldCode: string | null;
    oldValueJson: string | null;
    newValueJson: string | null;
    reasonCode: string;
  }[];
};

beforeAll(async () => {
  kit = await openReviewKit();
  holder = await kit.newInternal("agent", "Camille");
  agentA = await kit.newInternal("agent", "Alix");
  agentB = await kit.newInternal("agent", "Brice");
  admin = await kit.newInternal("admin", "Dominique");
});

afterAll(async () => {
  await kit.close();
});

/** A new brand held by the commercial of the file, and a campaign submitted by it. */
async function fresh(
  options: SubmitOptions & { language?: "fr" | "en" } = {},
): Promise<SubmittedCampaign> {
  const brand = await kit.newBrand({
    owner: holder.accountId,
    ...(options.language === undefined ? {} : { language: options.language }),
  });
  return kit.submitCampaign(brand, options);
}

function entriesUrl(params: Record<string, string | number> = {}): string {
  const query = new URLSearchParams({
    owner: holder.accountId,
    limit: "50",
    ...Object.fromEntries(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    ),
  });
  return `${BO_ENTRIES}?${query.toString()}`;
}

async function list(
  who: Internal,
  params: Record<string, string | number> = {},
) {
  const response = await kit.bo("GET", entriesUrl(params), who.session);
  expect(response.statusCode, response.body).toBe(200);
  return { body: response.json<ListBody>(), raw: response.body };
}

async function open(who: Internal, entryId: string): Promise<Opened> {
  const response = await kit.bo(
    "POST",
    `${BO_ENTRIES}/${entryId}/open`,
    who.session,
  );
  expect(response.statusCode, response.body).toBe(200);
  return response.json<Opened>();
}

async function publish(
  who: Internal,
  entryId: string,
  token: string,
  owner: Internal = agentA,
): Promise<LightMyRequestResponse> {
  return kit.bo("POST", `${BO_ENTRIES}/${entryId}/publish`, who.session, {
    reviewToken: token,
    ownerAgentId: owner.accountId,
  });
}

/** A campaign published by agent A, ready for the acts of the record. */
async function published(
  options: SubmitOptions = {},
): Promise<SubmittedCampaign> {
  const submitted = await fresh(options);
  const opened = await open(agentA, submitted.entryId);
  const response = await publish(
    agentA,
    submitted.entryId,
    opened.reviewToken ?? "",
  );
  expect(response.statusCode, response.body).toBe(200);
  return submitted;
}

async function record(who: Internal, campaignId: string) {
  const response = await kit.bo(
    "GET",
    `${BO_CAMPAIGNS}/${campaignId}`,
    who.session,
  );
  expect(response.statusCode, response.body).toBe(200);
  return { body: response.json<Record_>(), raw: response.body };
}

async function emailCodes(accountId: string): Promise<string[]> {
  return (await kit.outbox(accountId))
    .filter((event) => event.eventType === "campaign.decision")
    .map((event) => String(event.payload.email_code));
}

describe("L3C-T7: the list of queue 7 (09 RG87; 15 RG26 to RG28, RG33, RG34)", () => {
  it("L3C-T7.1 lists an entry with its brand, title, category and counters, and no text nor band of the campaign", async () => {
    const submitted = await fresh();
    const { body, raw } = await list(agentA);
    const row = body.items.find((item) => item.id === submitted.entryId);
    expect(row).toMatchObject({
      campaignId: submitted.campaignId,
      brandName: submitted.brand.name,
      title: submitted.title,
      enhancedReview: false,
      phase: "single",
      firstReviewer: null,
      alerts: [],
    });
    expect(row?.claim).toMatchObject({ holder: null, heldByCaller: false });
    expect(body.counters?.queue).toBe("campaigns");
    expect(body.counters?.pending).toBeGreaterThanOrEqual(1);
    // no brief, no summary, no figure, no currency, no band in the list (invariant 12)
    expect(raw).not.toContain(submitted.brief);
    expect(raw).not.toContain("3000000");
    expect(raw).not.toContain("500_1000");
    expect(raw).not.toContain("EUR");
  });

  it("L3C-T7.2 caps the page, hands an opaque cursor, and the search by body answers the same page", async () => {
    await fresh();
    await fresh();
    const first = await list(agentA, { limit: 1 });
    expect(first.body.items).toHaveLength(1);
    expect(first.body.nextCursor).not.toBeNull();
    const second = await list(agentA, {
      limit: 1,
      cursor: first.body.nextCursor ?? "",
    });
    expect(second.body.items).toHaveLength(1);
    expect(second.body.items[0]?.id).not.toBe(first.body.items[0]?.id);
    const searched = await kit.bo(
      "POST",
      `${BO_ENTRIES}/search`,
      agentA.session,
      {
        owner: holder.accountId,
        limit: 1,
        cursor: first.body.nextCursor,
      },
    );
    expect(searched.statusCode, searched.body).toBe(200);
    expect(searched.json<ListBody>().items[0]?.id).toBe(
      second.body.items[0]?.id,
    );
    const tooMany = await kit.bo(
      "GET",
      entriesUrl({ limit: 51 }),
      agentA.session,
    );
    expect(tooMany.statusCode).toBe(400);
    const badCursor = await kit.bo(
      "GET",
      entriesUrl({ cursor: "not-a-cursor" }),
      agentA.session,
    );
    expect(badCursor.statusCode).toBe(400);
  });

  it("L3C-T7.3 warns of a direct contact in a text by field and kind of signal, never by the text (RG21), and filters on the alert", async () => {
    const dirty = await fresh({
      brief: `Write me at someone-l3c@example.com for the details. ${"x".repeat(300)}`,
    });
    const clean = await fresh();
    const { body, raw } = await list(agentA, { alert: "true" });
    const ids = body.items.map((item) => item.id);
    expect(ids).toContain(dirty.entryId);
    expect(ids).not.toContain(clean.entryId);
    expect(
      body.items.find((item) => item.id === dirty.entryId)?.alerts,
    ).toEqual(["contact"]);
    expect(raw).not.toContain("someone-l3c@example.com");
    const opened = await open(agentA, dirty.entryId);
    expect(opened.alerts).toEqual([
      { code: "contact", field: "brief", position: null, signals: ["email"] },
    ]);
    expect(JSON.stringify(opened.alerts)).not.toContain("someone-l3c");
  });

  it("L3C-T7.4 marks a campaign that doubles a published one of the same brand (RG95), information and never a refusal", async () => {
    const brand = await kit.newBrand({ owner: holder.accountId });
    const first = await kit.submitCampaign(brand, {
      title: "L3C double title",
    });
    const opened = await open(agentA, first.entryId);
    expect(
      (await publish(agentA, first.entryId, opened.reviewToken ?? ""))
        .statusCode,
    ).toBe(200);
    const second = await kit.submitCampaign(brand, {
      title: "L3C double title",
    });
    const { body } = await list(agentA);
    expect(
      body.items.find((item) => item.id === second.entryId)?.alerts,
    ).toContain("duplicate");
    const view = await open(agentA, second.entryId);
    expect(view.duplicateOf?.campaignId).toBe(first.campaignId);
    expect(view.outcome).toBe("claimed");
  });
});

describe("L3C-T7: a fresh entry (0312: read policy of queue 7)", () => {
  it("L3C-T7.21 lists, counts and opens an entry that has no first review yet", async () => {
    const before = (await list(agentA)).body.counters?.pending ?? 0;
    const submitted = await fresh();
    const after = await list(agentA);
    expect(after.body.items.map((item) => item.id)).toContain(
      submitted.entryId,
    );
    expect(after.body.counters?.pending).toBe(before + 1);
    expect((await open(agentA, submitted.entryId)).outcome).toBe("claimed");
  });
});

describe("L3C-T7: opening is claiming, and the acts on the claim (15 C1 to C4; 09 RG88)", () => {
  it("L3C-T7.5 opens and claims, serves the budget by its label key only, the reasons with the message the brand will receive, and the responsibles", async () => {
    const submitted = await fresh();
    const opened = await open(agentA, submitted.entryId);
    expect(opened.outcome).toBe("claimed");
    expect(opened.reviewToken).toMatch(/^[0-9a-f]{64}$/);
    expect(opened.entry.claim.heldByCaller).toBe(true);
    expect(opened.status).toBe("pending_review");
    expect(opened.campaign.budgetBandLabelKey).toBe("price_band.500_1000");
    const serialised = JSON.stringify(opened);
    for (const absent of [
      "totalBudget",
      "currency",
      "3000000",
      "productValueBand",
    ]) {
      expect(serialised, absent).not.toContain(absent);
    }
    expect(opened.reasons).toHaveLength(14);
    const brief = opened.reasons.find(
      (reason) => reason.code === "brief_insufficient",
    );
    expect(brief?.message).toBe(
      "Votre brief ne permet pas à un créateur de comprendre ce que vous attendez.",
    );
    expect(
      opened.reasons
        .filter((reason) => reason.requiresMemberMessage)
        .map((reason) => reason.code)
        .sort(),
    ).toEqual(["illicit_content", "other"]);
    expect(opened.responsibles.map((agent) => agent.accountId)).toContain(
      agentA.accountId,
    );
    // a colleague reads it, in read-only mode, with the name of the holder, and without the token
    const other = await open(agentB, submitted.entryId);
    expect(other.outcome).toBe("read_only");
    expect(other.reviewToken).toBeNull();
    expect(other.entry.claim.holder?.displayName).toBe("Alix");
    expect(other.entry.claim.heldByCaller).toBe(false);
    // the list names the holder too, and the filter « moi » finds it
    const mine = await list(agentA, { holder: "me" });
    expect(mine.body.items.map((item) => item.id)).toContain(submitted.entryId);
    const free = await list(agentB, { holder: "free" });
    expect(free.body.items.map((item) => item.id)).not.toContain(
      submitted.entryId,
    );
  });

  it("L3C-T7.6 tells the reasons in the language of the brand", async () => {
    const submitted = await fresh({ language: "en" });
    const opened = await open(agentA, submitted.entryId);
    expect(
      opened.reasons.find((reason) => reason.code === "duplicate")?.message,
    ).toBe("An identical campaign is already published.");
  });

  it("L3C-T7.7 gives the claim back, takes it again for the delay, and refuses the decision of a colleague (C3, A9)", async () => {
    const submitted = await fresh();
    const opened = await open(agentA, submitted.entryId);
    const extended = await kit.bo(
      "POST",
      `${BO_ENTRIES}/${submitted.entryId}/extend`,
      agentA.session,
    );
    expect(extended.statusCode, extended.body).toBe(200);
    expect(
      Date.parse(extended.json<{ claimExpiresAt: string }>().claimExpiresAt),
    ).toBeGreaterThan(Date.now());
    // a colleague decides on a claim that is not his: 409 and the name of the holder (C2)
    const refused = await publish(
      agentB,
      submitted.entryId,
      opened.reviewToken ?? "",
    );
    expect(refused.statusCode).toBe(409);
    expect(issuesOf(refused)).toEqual([
      { path: "claim", issue: "held_by_other" },
      { path: "claim.holder", issue: "Alix" },
    ]);
    const released = await kit.bo(
      "POST",
      `${BO_ENTRIES}/${submitted.entryId}/release`,
      agentA.session,
    );
    expect(released.json()).toEqual({ released: true });
    const taken = await open(agentB, submitted.entryId);
    expect(taken.outcome).toBe("claimed");
    // the previous holder has no live claim any more
    const late = await publish(
      agentA,
      submitted.entryId,
      opened.reviewToken ?? "",
    );
    expect(late.statusCode).toBe(409);
    expect(issuesOf(late)[0]).toEqual({
      path: "claim",
      issue: "held_by_other",
    });
  });

  it("L3C-T7.8 lifts a live claim by an administrator only, with a typed reason, and the dispossessed holder learns it (C4, A8)", async () => {
    const submitted = await fresh();
    const opened = await open(agentA, submitted.entryId);
    const byAgent = await kit.bo(
      "POST",
      `${BO_ENTRIES}/${submitted.entryId}/force-release`,
      agentB.session,
      { reasonCode: "holder_absent" },
    );
    expect(byAgent.statusCode).toBe(403);
    expect(await kit.refusedActions(agentB.accountId)).toContain(
      "queue.force_release_claim",
    );
    const byAdmin = await kit.bo(
      "POST",
      `${BO_ENTRIES}/${submitted.entryId}/force-release`,
      admin.session,
      { reasonCode: "holder_absent" },
    );
    expect(byAdmin.statusCode, byAdmin.body).toBe(200);
    expect(byAdmin.json()).toMatchObject({
      released: true,
      holder: { displayName: "Alix" },
    });
    const late = await publish(
      agentA,
      submitted.entryId,
      opened.reviewToken ?? "",
    );
    expect(late.statusCode).toBe(409);
    expect(issuesOf(late)).toEqual([{ path: "claim", issue: "claim_lifted" }]);
    const unknownReason = await kit.bo(
      "POST",
      `${BO_ENTRIES}/${submitted.entryId}/force-release`,
      admin.session,
      { reasonCode: "because" },
    );
    expect(unknownReason.statusCode).toBe(400);
  });
});

describe("L3C-T7: the decisions (09 RG5, RG85, RG89 to RG92; modele §3, §4)", () => {
  it("L3C-T7.9 publishes under the live claim: the snapshot, the responsible, the register, the e-mail and the leads, and nothing of the text outside", async () => {
    const submitted = await fresh();
    const opened = await open(agentA, submitted.entryId);
    const response = await publish(
      agentA,
      submitted.entryId,
      opened.reviewToken ?? "",
      agentB,
    );
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      late: false,
      snapshotVersion: 1,
      firstPublication: true,
    });
    expect(await kit.campaignRow(submitted.campaignId)).toMatchObject({
      status: "published",
      ownerAgentId: agentB.accountId,
    });
    const lines = await kit.register(
      submitted.campaignId,
      "campaign.published",
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]?.actor).toBe(agentA.accountId);
    const events = await kit.outbox(submitted.brand.accountId);
    expect(
      events
        .filter((event) => event.eventType === "campaign.decision")
        .map((event) => event.payload.email_code),
    ).toEqual(["published"]);
    expect(
      events.some((event) => event.eventType === "campaign.published"),
    ).toBe(true);
    expect(JSON.stringify(events)).not.toContain(submitted.brief);
    expect(JSON.stringify(events)).not.toContain(submitted.title);
    // a second decision on a closed entry is refused
    const again = await publish(
      agentA,
      submitted.entryId,
      opened.reviewToken ?? "",
    );
    expect(again.statusCode).toBe(409);
    expect(issuesOf(again)).toEqual([{ path: "entry", issue: "entry_closed" }]);
    const view = await open(agentB, submitted.entryId);
    expect(view.outcome).toBe("closed");
    expect(view.reviewToken).toBeNull();
  });

  it("L3C-T7.10 refuses a stale version after a correction under the claim, and the new token publishes (L3BS-1)", async () => {
    const submitted = await fresh();
    const opened = await open(agentA, submitted.entryId);
    const corrected = await kit.bo(
      "POST",
      `${BO_CAMPAIGNS}/${submitted.campaignId}/corrections`,
      agentA.session,
      {
        fieldCode: "public_summary",
        value: `L3C corrected summary ${"c".repeat(100)}`,
        reasonCode: "entry_error",
      },
    );
    expect(corrected.statusCode, corrected.body).toBe(200);
    const fresher = corrected.json<{ reviewToken: string | null }>()
      .reviewToken;
    expect(fresher).toMatch(/^[0-9a-f]{64}$/);
    expect(fresher).not.toBe(opened.reviewToken);
    const stale = await publish(
      agentA,
      submitted.entryId,
      opened.reviewToken ?? "",
    );
    expect(stale.statusCode).toBe(409);
    expect(issuesOf(stale)).toEqual([{ path: "entry", issue: "stale_token" }]);
    expect(
      (await publish(agentA, submitted.entryId, fresher ?? "")).statusCode,
    ).toBe(200);
  });

  it("L3C-T7.11 asks a responsible who is an active internal account, and a token of the right shape", async () => {
    const submitted = await fresh();
    const opened = await open(agentA, submitted.entryId);
    const unknown = await publish(
      agentA,
      submitted.entryId,
      opened.reviewToken ?? "",
      { ...agentA, accountId: NIL },
    );
    expect(unknown.statusCode).toBe(400);
    expect(issuesOf(unknown)).toEqual([
      { path: "ownerAgentId", issue: "invalid_owner_agent" },
    ]);
    const none = await kit.bo(
      "POST",
      `${BO_ENTRIES}/${submitted.entryId}/publish`,
      agentA.session,
      { reviewToken: opened.reviewToken },
    );
    expect(none.statusCode).toBe(400);
    const badToken = await kit.bo(
      "POST",
      `${BO_ENTRIES}/${submitted.entryId}/publish`,
      agentA.session,
      { reviewToken: "xyz", ownerAgentId: agentA.accountId },
    );
    expect(badToken.statusCode).toBe(400);
  });

  it("L3C-T7.12 refuses with a typed reason: the brand is told by e-mail, the comment goes nowhere (RG90, RG92)", async () => {
    const submitted = await fresh();
    const opened = await open(agentA, submitted.entryId);
    const response = await kit.bo(
      "POST",
      `${BO_ENTRIES}/${submitted.entryId}/reject`,
      agentA.session,
      {
        reviewToken: opened.reviewToken,
        reasonCode: "brief_insufficient",
        internalComment: "L3C-INTERNAL-COMMENT-MARKER",
      },
    );
    expect(response.statusCode, response.body).toBe(200);
    expect(await kit.campaignRow(submitted.campaignId)).toMatchObject({
      status: "rejected",
      snapshotId: null,
    });
    expect(await emailCodes(submitted.brand.accountId)).toEqual(["rejected"]);
    expect(
      JSON.stringify(await kit.outbox(submitted.brand.accountId)),
    ).not.toContain("L3C-INTERNAL-COMMENT-MARKER");
    expect(
      JSON.stringify(await kit.register(submitted.campaignId)),
    ).not.toContain("L3C-INTERNAL-COMMENT-MARKER");
    const closed = await open(agentB, submitted.entryId);
    expect(closed.entry.decision?.rejectionReasonCode).toBe(
      "brief_insufficient",
    );
    expect(JSON.stringify(closed)).not.toContain("L3C-INTERNAL-COMMENT-MARKER");
  });

  it("L3C-T7.13 asks the message of the agent for `other` and refuses a direct contact in it (RG90, RG158)", async () => {
    const submitted = await fresh();
    const opened = await open(agentA, submitted.entryId);
    const url = `${BO_ENTRIES}/${submitted.entryId}/reject`;
    const without = await kit.bo("POST", url, agentA.session, {
      reviewToken: opened.reviewToken,
      reasonCode: "other",
    });
    expect(without.statusCode).toBe(400);
    expect(issuesOf(without)).toEqual([
      { path: "memberMessage", issue: "invalid_member_message" },
    ]);
    const contact = await kit.bo("POST", url, agentA.session, {
      reviewToken: opened.reviewToken,
      reasonCode: "other",
      memberMessage:
        "Please write to the team at team-l3c@example.com about it.",
    });
    expect(contact.statusCode).toBe(400);
    expect(issuesOf(contact)).toEqual([
      { path: "memberMessage", issue: "direct_contact" },
    ]);
    const unknownCode = await kit.bo("POST", url, agentA.session, {
      reviewToken: opened.reviewToken,
      reasonCode: "because",
    });
    expect(unknownCode.statusCode).toBe(400);
    const good = await kit.bo("POST", url, agentA.session, {
      reviewToken: opened.reviewToken,
      reasonCode: "other",
      memberMessage:
        "The period of the campaign overlaps a blackout we cannot serve.",
    });
    expect(good.statusCode, good.body).toBe(200);
  });

  it("L3C-T7.14 asks two persons in a sensitive sector: no publication at time 1, the opinion stays with the holder of the second review (RG85, CA56, CA57)", async () => {
    const sector = await kit.sensitiveSector();
    const submitted = await fresh({ sector, declare: true });
    const row = (await list(agentA)).body.items.find(
      (item) => item.id === submitted.entryId,
    );
    expect(row).toMatchObject({ enhancedReview: true, phase: "first" });
    const first = await open(agentA, submitted.entryId);
    expect(first.entry.review).toMatchObject({
      enhancedReview: true,
      phase: "first",
    });
    // the publication of the only examiner is refused
    const alone = await publish(
      agentA,
      submitted.entryId,
      first.reviewToken ?? "",
    );
    expect(alone.statusCode).toBe(409);
    expect(issuesOf(alone)).toEqual([
      { path: "entry", issue: "enhanced_review_required" },
    ]);
    // a short opinion is refused before anything is read
    const short = await kit.bo(
      "POST",
      `${BO_ENTRIES}/${submitted.entryId}/first-review`,
      agentA.session,
      { reviewToken: first.reviewToken, opinion: "ok" },
    );
    expect(short.statusCode).toBe(400);
    const opinion =
      "L3C-OPINION-MARKER the authorizations were read and are in order for this product.";
    const given = await kit.bo(
      "POST",
      `${BO_ENTRIES}/${submitted.entryId}/first-review`,
      agentA.session,
      { reviewToken: first.reviewToken, opinion },
    );
    expect(given.statusCode, given.body).toBe(200);
    // the entry is hidden from the first examiner: the list, the opening
    expect(
      (await list(agentA)).body.items.map((item) => item.id),
    ).not.toContain(submitted.entryId);
    expect(
      (
        await kit.bo(
          "POST",
          `${BO_ENTRIES}/${submitted.entryId}/open`,
          agentA.session,
        )
      ).statusCode,
    ).toBe(404);
    // the second person reads « 2e examen », the opinion as the holder, and decides
    const listed = (await list(agentB)).body.items.find(
      (item) => item.id === submitted.entryId,
    );
    expect(listed).toMatchObject({
      phase: "second",
      firstReviewer: { displayName: "Alix" },
    });
    const second = await open(agentB, submitted.entryId);
    expect(second.entry.review).toMatchObject({
      phase: "second",
      firstOpinion: opinion,
    });
    // a colleague who only reads never gets it
    const reader = await open(admin, submitted.entryId);
    expect(reader.outcome).toBe("read_only");
    expect(reader.entry.review.firstOpinion).toBeNull();
    expect(JSON.stringify(reader)).not.toContain("L3C-OPINION-MARKER");
    const done = await publish(
      agentB,
      submitted.entryId,
      second.reviewToken ?? "",
    );
    expect(done.statusCode, done.body).toBe(200);
    expect(
      JSON.stringify(await kit.outbox(submitted.brand.accountId)),
    ).not.toContain("L3C-OPINION-MARKER");
    expect(
      JSON.stringify(await kit.register(submitted.campaignId)),
    ).not.toContain("L3C-OPINION-MARKER");
    const read = await record(admin, submitted.campaignId);
    expect(read.raw).not.toContain("L3C-OPINION-MARKER");
    expect(read.body.entries[0]?.firstReviewedBy?.accountId).toBe(
      agentA.accountId,
    );
  });

  it("L3C-T7.15 refuses the first review outside a sensitive sector (modele §3)", async () => {
    const submitted = await fresh();
    const opened = await open(agentA, submitted.entryId);
    const response = await kit.bo(
      "POST",
      `${BO_ENTRIES}/${submitted.entryId}/first-review`,
      agentA.session,
      {
        reviewToken: opened.reviewToken,
        opinion: "An opinion that no ordinary campaign should need.",
      },
    );
    expect(response.statusCode).toBe(409);
    expect(issuesOf(response)).toEqual([
      { path: "entry", issue: "not_enhanced_review" },
    ]);
    expect(
      (
        await kit.bo(
          "POST",
          `${BO_ENTRIES}/${submitted.entryId}/publish`,
          agentA.session,
          { reviewToken: ANY_TOKEN, ownerAgentId: agentA.accountId },
        )
      ).statusCode,
    ).toBe(409);
  });
});

describe("L3C-T7: the record, the corrections, the creation and the passages (09 RG1, RG8, RG9, RG94; modele §5, §6)", () => {
  it("L3C-T7.16 opens the record by the journaled door: one `campaign.record_read` per read, the budget by its label key, the history", async () => {
    const submitted = await published();
    const before = (
      await kit.register(submitted.campaignId, "campaign.record_read")
    ).length;
    const { body, raw } = await record(agentB, submitted.campaignId);
    const lines = await kit.register(
      submitted.campaignId,
      "campaign.record_read",
    );
    expect(lines).toHaveLength(before + 1);
    expect(lines.at(-1)?.actor).toBe(agentB.accountId);
    expect(body.cycle).toMatchObject({
      status: "published",
      snapshotVersion: 1,
      owner: { accountId: agentA.accountId },
    });
    expect(body.fields).toMatchObject({
      title: submitted.title,
      internalReference: "L3C-REF",
      budgetBandLabelKey: "price_band.500_1000",
    });
    expect(body.entries[0]).toMatchObject({ state: "published" });
    for (const absent of [
      "totalBudget",
      "currency",
      "3000000",
      "internalComment",
      "opinion",
    ]) {
      expect(raw, absent).not.toContain(absent);
    }
  });

  it("L3C-T7.17 corrects a field of a draft, keeps the old and the new value, and never serves the value of a figure (RG94)", async () => {
    const brand = await kit.newBrand({ owner: holder.accountId });
    const created = await kit.bo("POST", BO_CAMPAIGNS, agentA.session, {
      advertiserAccountId: brand.accountId,
      title: "L3C draft for a brand",
      campaignType: "product_placement",
    });
    expect(created.statusCode, created.body).toBe(200);
    const { campaignId } = created.json<{ campaignId: string }>();
    const url = `${BO_CAMPAIGNS}/${campaignId}/corrections`;
    const title = await kit.bo("POST", url, agentA.session, {
      fieldCode: "title",
      value: "L3C draft corrected",
      reasonCode: "brand_request",
    });
    expect(title.statusCode, title.body).toBe(200);
    expect(title.json<{ reviewToken: string | null }>().reviewToken).toBeNull();
    const currency = await kit.bo("POST", url, agentA.session, {
      fieldCode: "currency",
      value: "EUR",
      reasonCode: "brand_request",
    });
    expect(currency.statusCode, currency.body).toBe(200);
    const total = await kit.bo("POST", url, agentA.session, {
      fieldCode: "total_budget",
      value: 7654321,
      reasonCode: "brand_request",
    });
    expect(total.statusCode, total.body).toBe(200);
    const { body, raw } = await record(agentB, campaignId);
    const corrected = body.interventions.filter(
      (item) => item.kind === "corrected",
    );
    expect(corrected.find((item) => item.fieldCode === "title")).toMatchObject({
      oldValueJson: JSON.stringify("L3C draft for a brand"),
      newValueJson: JSON.stringify("L3C draft corrected"),
      reasonCode: "brand_request",
    });
    for (const code of ["currency", "total_budget"]) {
      expect(
        corrected.find((item) => item.fieldCode === code),
        code,
      ).toMatchObject({ oldValueJson: null, newValueJson: null });
    }
    expect(raw).not.toContain("7654321");
    expect(body.interventions.some((item) => item.kind === "created")).toBe(
      true,
    );
    // the brand is told, by codes only
    expect(await emailCodes(brand.accountId)).toEqual([
      "created_for_brand",
      "corrected",
      "corrected",
      "corrected",
    ]);
    // nothing changed is no intervention; `other` asks a comment; a list is replaced whole
    const same = await kit.bo("POST", url, agentA.session, {
      fieldCode: "title",
      value: "L3C draft corrected",
      reasonCode: "brand_request",
    });
    expect(same.statusCode).toBe(400);
    expect(issuesOf(same)).toEqual([{ path: "value", issue: "unchanged" }]);
    const other = await kit.bo("POST", url, agentA.session, {
      fieldCode: "title",
      value: "L3C draft again",
      reasonCode: "other",
    });
    expect(other.statusCode).toBe(400);
    expect(issuesOf(other)).toEqual([
      { path: "internalComment", issue: "invalid_internal_comment" },
    ]);
    const list = await kit.bo("POST", url, agentA.session, {
      fieldCode: "key_messages",
      value: ["First message", "Second message"],
      reasonCode: "entry_error",
    });
    expect(list.statusCode, list.body).toBe(200);
    const wrongShape = await kit.bo("POST", url, agentA.session, {
      fieldCode: "creators_wanted",
      value: "many",
      reasonCode: "entry_error",
    });
    expect(wrongShape.statusCode).toBe(400);
    expect(issuesOf(wrongShape)).toEqual([
      { path: "value", issue: "invalid_value" },
    ]);
    expect((await record(agentB, campaignId)).body.fields.keyMessages).toEqual([
      "First message",
      "Second message",
    ]);
  });

  it("L3C-T7.18 refuses a correction of a published campaign, and of a pending one without the live claim (modele §6)", async () => {
    const live = await published();
    const refused = await kit.bo(
      "POST",
      `${BO_CAMPAIGNS}/${live.campaignId}/corrections`,
      agentB.session,
      { fieldCode: "title", value: "L3C too late", reasonCode: "entry_error" },
    );
    expect(refused.statusCode).toBe(409);
    expect(issuesOf(refused)).toEqual([
      { path: "campaign", issue: "campaign_not_correctable" },
    ]);
    const pending = await fresh();
    const unclaimed = await kit.bo(
      "POST",
      `${BO_CAMPAIGNS}/${pending.campaignId}/corrections`,
      agentB.session,
      { fieldCode: "title", value: "L3C no claim", reasonCode: "entry_error" },
    );
    expect(unclaimed.statusCode).toBe(409);
    expect(issuesOf(unclaimed)).toEqual([
      { path: "claim", issue: "claim_not_held" },
    ]);
    await open(agentA, pending.entryId);
    const held = await kit.bo(
      "POST",
      `${BO_CAMPAIGNS}/${pending.campaignId}/corrections`,
      agentB.session,
      { fieldCode: "title", value: "L3C not mine", reasonCode: "entry_error" },
    );
    expect(held.statusCode).toBe(409);
    expect(issuesOf(held)[0]).toEqual({
      path: "claim",
      issue: "held_by_other",
    });
  });

  it("L3C-T7.19 creates a draft for an active brand only (RG1, Q2)", async () => {
    const unknown = await kit.bo("POST", BO_CAMPAIGNS, agentA.session, {
      advertiserAccountId: NIL,
      title: "L3C nobody",
      campaignType: "product_placement",
    });
    expect(unknown.statusCode).toBe(404);
    const brand = await kit.newBrand({ owner: holder.accountId });
    const badType = await kit.bo("POST", BO_CAMPAIGNS, agentA.session, {
      advertiserAccountId: brand.accountId,
      title: "L3C bad type",
      campaignType: "no_such_type",
    });
    expect(badType.statusCode).toBe(400);
    expect(issuesOf(badType)).toEqual([
      { path: "campaignType", issue: "invalid_campaign_type" },
    ]);
    await kit.fx
      .migration`update identity.accounts set status = 'suspended', suspended_at = now() where id = ${brand.accountId}`;
    const suspended = await kit.bo("POST", BO_CAMPAIGNS, agentA.session, {
      advertiserAccountId: brand.accountId,
      title: "L3C suspended",
      campaignType: "product_placement",
    });
    expect(suspended.statusCode).toBe(409);
    expect(issuesOf(suspended)).toEqual([
      { path: "campaign", issue: "brand_not_active" },
    ]);
  });

  it("L3C-T7.20 pauses with authority (the brand cannot resume it), resumes and closes: irreversible, told by e-mail (RG8, RG9, RG93)", async () => {
    const submitted = await published();
    const act = (
      passage: string,
      body: object = { reasonCode: "brand_request" },
    ) =>
      kit.bo(
        "POST",
        `${BO_CAMPAIGNS}/${submitted.campaignId}/${passage}`,
        agentB.session,
        body,
      );
    const paused = await act("pause");
    expect(paused.statusCode, paused.body).toBe(200);
    expect(paused.json()).toMatchObject({ status: "paused" });
    expect(await kit.campaignRow(submitted.campaignId)).toMatchObject({
      status: "paused",
      pauseOrigin: "influx",
    });
    const twice = await act("pause");
    expect(twice.statusCode).toBe(409);
    expect(issuesOf(twice)).toEqual([
      { path: "campaign", issue: "campaign_not_pausable" },
    ]);
    const noComment = await act("resume", { reasonCode: "other" });
    expect(noComment.statusCode).toBe(400);
    expect(issuesOf(noComment)).toEqual([
      { path: "internalComment", issue: "invalid_internal_comment" },
    ]);
    expect((await act("resume")).json()).toMatchObject({ status: "published" });
    expect((await act("pause")).statusCode).toBe(200);
    const closed = await act("close", {
      reasonCode: "other",
      internalComment: "L3C closing comment",
    });
    expect(closed.json()).toMatchObject({ status: "closed" });
    const reopened = await act("resume");
    expect(reopened.statusCode).toBe(409);
    expect(issuesOf(reopened)).toEqual([
      { path: "campaign", issue: "campaign_not_resumable" },
    ]);
    const again = await act("close");
    expect(again.statusCode).toBe(409);
    expect(issuesOf(again)).toEqual([
      { path: "campaign", issue: "campaign_not_closable" },
    ]);
    expect(await emailCodes(submitted.brand.accountId)).toEqual([
      "published",
      "paused_by_influx",
      "resumed_by_influx",
      "paused_by_influx",
      "closed_by_influx",
    ]);
    const { body, raw } = await record(agentA, submitted.campaignId);
    expect(body.cycle.status).toBe("closed");
    expect(body.interventions.map((item) => item.kind)).toEqual([
      "closed",
      "paused",
      "resumed",
      "paused",
    ]);
    expect(raw).not.toContain("L3C closing comment");
    // a draft is neither paused nor closed by an agent
    const draft = await kit.bo("POST", BO_CAMPAIGNS, agentA.session, {
      advertiserAccountId: submitted.brand.accountId,
      title: "L3C a draft",
      campaignType: "product_placement",
    });
    const { campaignId } = draft.json<{ campaignId: string }>();
    const notPausable = await kit.bo(
      "POST",
      `${BO_CAMPAIGNS}/${campaignId}/pause`,
      agentA.session,
      { reasonCode: "brand_request" },
    );
    expect(notPausable.statusCode).toBe(409);
  });
});

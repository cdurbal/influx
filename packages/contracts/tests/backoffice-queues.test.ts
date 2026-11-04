import { describe, expect, it } from "vitest";
import {
  entriesQuerySchema,
  forceReleaseRequestSchema,
  publishEntryRequestSchema,
  publishEntryResponseSchema,
  rejectEntryRequestSchema,
  entriesResponseSchema,
  openEntryResponseSchema,
  queueEntryRowSchema,
  QUEUE_PAGE_SIZE_DEFAULT,
  QUEUE_PAGE_SIZE_MAX,
  reviewAlertSchema,
} from "../src/backoffice-queues.ts";

const ID = "5b1d6f3e-0a52-4c8e-9f0e-2f6a1c7d9b10";

describe("GET /v1/bo/queues/profiles-advertiser/entries query (15 RG33, RG34)", () => {
  it("defaults the page, coerces it from the query string and accepts the filters of the queue", () => {
    expect(entriesQuerySchema.parse({})).toEqual({
      limit: QUEUE_PAGE_SIZE_DEFAULT,
    });
    expect(
      entriesQuerySchema.parse({
        limit: String(QUEUE_PAGE_SIZE_MAX),
        kind: "revision",
        country: "FR",
        overdue: "true",
        holder: "me",
        owner: "none",
        alert: "true",
        from: "2026-11-01T00:00:00.000Z",
        to: "2026-11-02T00:00:00.000Z",
      }),
    ).toMatchObject({
      limit: QUEUE_PAGE_SIZE_MAX,
      holder: "me",
      owner: "none",
    });
    expect(entriesQuerySchema.parse({ holder: ID }).holder).toBe(ID);
  });

  it("refuses a page over the cap, a filter outside RG33, a term, an inverted period", () => {
    for (const query of [
      { limit: String(QUEUE_PAGE_SIZE_MAX + 1) },
      { limit: "0" },
      { sort: "name" },
      { q: "maison" },
      { email: "a@example.test" },
      { overdue: "false" },
      { holder: "somebody" },
      { owner: "me" },
      { kind: "creator" },
      { cursor: "not a cursor!" },
      { from: "2026-11-02T00:00:00.000Z", to: "2026-11-01T00:00:00.000Z" },
    ]) {
      expect(
        entriesQuerySchema.safeParse(query).success,
        JSON.stringify(query),
      ).toBe(false);
    }
  });
});

const ROW = {
  id: ID,
  accountId: ID,
  kind: "submission",
  createdAt: "2026-11-01T09:00:00.000Z",
  slaDueAt: "2026-11-02T09:00:00.000Z",
  escalateAt: null,
  overdue: false,
  brandName: "Maison Aube",
  countryCode: "FR",
  completenessPercent: 80,
  modifiedFields: [],
  owner: null,
  claim: {
    holder: null,
    claimedAt: null,
    claimExpiresAt: null,
    heldByCaller: false,
  },
  alerts: [],
};

describe("the answers are closed (06 RG80, RG81; 15 RG34)", () => {
  it("refuses a field outside the list on a line, so that no coordinate slips in", () => {
    expect(queueEntryRowSchema.safeParse(ROW).success).toBe(true);
    for (const extra of [
      { email: "contact@brand.example" },
      { contactPhone: "+33612345678" },
      { legalName: "Maison Aube SAS" },
    ]) {
      expect(queueEntryRowSchema.safeParse({ ...ROW, ...extra }).success).toBe(
        false,
      );
    }
    expect(
      entriesResponseSchema.safeParse({
        asOf: "2026-11-01T10:00:00.000Z",
        items: [ROW],
        nextCursor: null,
      }).success,
    ).toBe(true);
  });

  it("refuses an alert that carries anything but a code, a field and the kind of signal", () => {
    expect(
      reviewAlertSchema.safeParse({
        code: "direct_contact",
        field: "advertiser.presentation",
        signals: ["email"],
      }).success,
    ).toBe(true);
    for (const alert of [
      { code: "direct_contact", field: "advertiser.presentation", signals: [] },
      {
        code: "direct_contact",
        field: "advertiser.presentation",
        signals: ["email"],
        text: "a@b.example",
      },
      {
        code: "direct_contact",
        field: "advertiser.contact_role",
        signals: ["email"],
      },
      { code: "duplicate_domain", matches: [] },
    ]) {
      expect(
        reviewAlertSchema.safeParse(alert).success,
        JSON.stringify(alert),
      ).toBe(false);
    }
  });

  it("holds the review token to a SHA-256 in hexadecimal, and nothing else", () => {
    const shape = openEntryResponseSchema.shape.reviewToken;
    expect(shape.safeParse("a".repeat(64)).success).toBe(true);
    expect(shape.safeParse(null).success).toBe(true);
    expect(shape.safeParse("A".repeat(64)).success).toBe(false);
    expect(shape.safeParse("a".repeat(63)).success).toBe(false);
  });
});

describe("the decision requests (06 RG65, RG66; 15 C4, C6; file.md A6, A8)", () => {
  const token = "a".repeat(64);

  it("binds a decision to the version examined: the token is required, the comment is bounded, nothing else passes", () => {
    expect(
      publishEntryRequestSchema.safeParse({ reviewToken: token }).success,
    ).toBe(true);
    for (const body of [
      {},
      { reviewToken: "A".repeat(64) },
      { reviewToken: token, internalComment: "" },
      { reviewToken: token, internalComment: "x".repeat(1001) },
      { reviewToken: token, decidedBy: ID },
    ]) {
      expect(
        publishEntryRequestSchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
    }
  });

  it("asks a refusal for a reason of the closed list, and bounds the message the agent writes", () => {
    const ok = {
      reviewToken: token,
      reasonCode: "other",
      memberMessage: "x".repeat(20),
    };
    expect(rejectEntryRequestSchema.safeParse(ok).success).toBe(true);
    for (const body of [
      { reviewToken: token },
      { reviewToken: token, reasonCode: "because" },
      { ...ok, memberMessage: "x".repeat(19) },
      { ...ok, memberMessage: "x".repeat(501) },
    ]) {
      expect(
        rejectEntryRequestSchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
    }
  });

  it("lifts a claim for a typed reason only, and answers the next entry as an identifier alone", () => {
    expect(
      forceReleaseRequestSchema.safeParse({ reasonCode: "holder_absent" })
        .success,
    ).toBe(true);
    expect(
      forceReleaseRequestSchema.safeParse({
        reasonCode: "holder_absent",
        comment: "free text",
      }).success,
    ).toBe(false);
    expect(
      forceReleaseRequestSchema.safeParse({ reasonCode: "other" }).success,
    ).toBe(false);
    const decided = {
      decidedAt: "2026-11-04T10:00:00.000Z",
      late: false,
      firstPublication: true,
    };
    expect(
      publishEntryResponseSchema.safeParse({
        ...decided,
        next: { entryId: ID },
      }).success,
    ).toBe(true);
    expect(
      publishEntryResponseSchema.safeParse({ ...decided, next: null }).success,
    ).toBe(true);
    expect(
      publishEntryResponseSchema.safeParse({
        ...decided,
        next: { entryId: ID, brandName: "x" },
      }).success,
    ).toBe(false);
  });
});

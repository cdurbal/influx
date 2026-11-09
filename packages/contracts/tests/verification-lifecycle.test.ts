import { describe, expect, it } from "vitest";
import {
  IDENTITY_CHANGE_QUEUE,
  queueCodeSchema,
  VERIFICATION_DISPUTES_QUEUE,
} from "../src/backoffice-queues.ts";
import { z } from "../src/zod.ts";
import {
  accountBadgesResponseSchema,
  BRAND_CONSTAT_CHANNELS,
  BRAND_OBSERVED_CHANNELS,
  brandObservedChannelSchema,
  confirmIdentifierChangeRequestSchema,
  contestableDecisionSchema,
  disputeEntryRowSchema,
  disputeOpenResponseSchema,
  grantBrandByLoginRequestSchema,
  identifierChangeDossierSchema,
  identifierChangeEntryRowSchema,
  openVerificationForMemberBodySchema,
  overturnDisputeRequestSchema,
  ownBadgeSchema,
  ownDisputesResponseSchema,
  requestBadgeRevocationBodySchema,
  submitDisputeBodySchema,
  upholdDisputeRequestSchema,
  VERIFICATION_REFUSAL_ISSUES,
  verificationDossierSchema,
} from "../src/verification.ts";

const ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ID = "00000000-0000-4000-8000-000000000002";
const TOKEN = "a".repeat(64);
const INSTANT = "2026-11-08T10:00:00.000Z";
const CODE = "INFLUX-23456789";

/** Every property name of a JSON schema, at any depth. */
function propertyNames(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(propertyNames);
  if (node === null || typeof node !== "object") return [];
  return Object.entries(node).flatMap(([key, value]) =>
    key === "properties" && value !== null && typeof value === "object"
      ? [...Object.keys(value), ...Object.values(value).flatMap(propertyNames)]
      : propertyNames(value),
  );
}

const namesOf = (schema: z.ZodType) =>
  propertyNames(z.toJSONSchema(schema, { io: "output" }));

const message = (length: number) => "m".repeat(length);

describe("L2F-11 the member's contest, closed (08 RG77, CA52; invariant 13)", () => {
  const dispute = {
    id: ID,
    requestId: ID,
    badgeId: null,
    level: "audience_verified",
    networkCode: "instagram",
    reasonCode: "misread",
    text: null,
    submittedAt: INSTANT,
    state: "upheld",
    outcome: {
      result: "upheld",
      reasonCode: "decision_confirmed",
      memberMessage: null,
      decidedAt: INSTANT,
    },
  };
  const response = {
    asOf: INSTANT,
    windowDays: 30,
    contestable: [
      {
        kind: "refusal",
        requestId: ID,
        level: "account_verified",
        networkCode: "instagram",
        reasonCode: "ownership_not_proven",
        decidedAt: INSTANT,
        closesAt: INSTANT,
      },
      {
        kind: "revocation",
        badgeId: OTHER_ID,
        level: "audience_verified",
        networkCode: "instagram",
        reasonCode: "terms_breach",
        memberMessage: message(30),
        decidedAt: INSTANT,
        closesAt: INSTANT,
      },
    ],
    disputes: [dispute],
  };

  it("reads the decisions to contest, the contests and the outcome with its motive, and nothing a member may not read", () => {
    expect(ownDisputesResponseSchema.safeParse(response).success).toBe(true);
    expect(
      namesOf(ownDisputesResponseSchema).filter((name) =>
        /decider|claim|holder|lock|agent|comment|reviewmode|sla|escalat|token|handle/iu.test(
          name,
        ),
      ),
    ).toEqual([]);
    expect(
      ownDisputesResponseSchema.safeParse({
        ...response,
        disputes: [{ ...dispute, internalComment: "x" }],
      }).success,
    ).toBe(false);
    expect(
      ownDisputesResponseSchema.safeParse({
        ...response,
        disputes: [{ ...dispute, level: "brand_verified" }],
      }).success,
    ).toBe(false);
  });

  it("names a contestable decision by its own identifier, a refusal by a request and a withdrawal by a badge", () => {
    expect(
      contestableDecisionSchema.safeParse(response.contestable[0]).success,
    ).toBe(true);
    expect(
      contestableDecisionSchema.safeParse({
        ...response.contestable[0],
        badgeId: ID,
      }).success,
    ).toBe(false);
    expect(
      contestableDecisionSchema.safeParse({
        ...response.contestable[1],
        reasonCode: "ownership_not_proven",
      }).success,
    ).toBe(false);
  });

  it("sends one decision, a reason of the list, and the text of `other` always, 1 000 characters at most", () => {
    const parse = (body: unknown) => submitDisputeBodySchema.safeParse(body);
    expect(parse({ requestId: ID, reasonCode: "misread" }).success).toBe(true);
    expect(parse({ badgeId: ID, reasonCode: "evidence_valid" }).success).toBe(
      true,
    );
    expect(parse({ requestId: ID, reasonCode: "other" }).success).toBe(false);
    expect(
      parse({ requestId: ID, reasonCode: "other", text: "Why." }).success,
    ).toBe(true);
    expect(
      parse({ requestId: ID, badgeId: OTHER_ID, reasonCode: "misread" })
        .success,
    ).toBe(false);
    expect(parse({ reasonCode: "misread" }).success).toBe(false);
    expect(parse({ requestId: ID, reasonCode: "invented" }).success).toBe(
      false,
    );
    expect(
      parse({ requestId: ID, reasonCode: "misread", text: "x".repeat(1001) })
        .success,
    ).toBe(false);
    expect(
      parse({ requestId: ID, reasonCode: "misread", accountId: ID }).success,
    ).toBe(false);
  });

  it("states the end of the grace on a badge, absent until the route serves it", () => {
    const badge = {
      level: "audience_verified",
      networkCode: "instagram",
      state: "to_refresh",
      grantedAt: INSTANT,
      periodStart: "2026-08-01",
      periodEnd: "2026-08-30",
      evidenceSource: "native_dashboard",
      expiresAt: INSTANT,
    };
    expect(ownBadgeSchema.safeParse(badge).success).toBe(true);
    expect(
      ownBadgeSchema.safeParse({ ...badge, graceEndsAt: INSTANT }).success,
    ).toBe(true);
    expect(
      ownBadgeSchema.safeParse({ ...badge, graceEndsAt: "soon" }).success,
    ).toBe(false);
  });
});

describe("L2F-11 the withdrawal of a badge and the badges of an account (08 RG73; 0231)", () => {
  it("asks with a reason of the list and a message of 20 to 500 characters, never anything else", () => {
    const parse = (body: unknown) =>
      requestBadgeRevocationBodySchema.safeParse(body);
    expect(parse({ reasonCode: "influx_error" }).success).toBe(true);
    expect(
      parse({ reasonCode: "terms_breach", memberMessage: message(20) }).success,
    ).toBe(true);
    expect(
      parse({ reasonCode: "terms_breach", memberMessage: message(19) }).success,
    ).toBe(false);
    expect(
      parse({ reasonCode: "terms_breach", memberMessage: message(501) })
        .success,
    ).toBe(false);
    expect(parse({ reasonCode: "other" }).success).toBe(false);
    expect(
      parse({ reasonCode: "influx_error", badgeId: ID, accountId: ID }).success,
    ).toBe(false);
  });

  it("reads a badge with its pending withdrawal and its contest, and carries no figure or identifier of a network", () => {
    const response = {
      asOf: INSTANT,
      badges: [
        {
          id: ID,
          level: "audience_verified",
          networkCode: "instagram",
          state: "active",
          grantedAt: INSTANT,
          expiresAt: INSTANT,
          endedAt: null,
          revokedAt: null,
          revocationReasonCode: null,
          pendingRevocation: {
            dualControlRequestId: OTHER_ID,
            state: "pending",
          },
          dispute: null,
        },
      ],
      reasons: [
        {
          code: "terms_breach",
          position: 4,
          levels: ["account_verified", "audience_verified"],
          requiresMemberMessage: true,
          escalatesToAdmin: true,
          message:
            "Votre profil ne respecte pas les conditions d'utilisation d'INFLUX.",
        },
      ],
    };
    expect(accountBadgesResponseSchema.safeParse(response).success).toBe(true);
    expect(
      namesOf(accountBadgesResponseSchema).filter((name) =>
        /handle|follower|figure|engagement|comment|url/iu.test(name),
      ),
    ).toEqual([]);
    expect(
      accountBadgesResponseSchema.safeParse({
        ...response,
        badges: [
          {
            ...response.badges[0],
            pendingRevocation: {
              dualControlRequestId: OTHER_ID,
              state: "waiting",
            },
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("L2F-11 queue 5, the contests of the agent (08 RG77; 15 RG27, RG29)", () => {
  const row = {
    id: ID,
    accountId: OTHER_ID,
    kind: "refusal",
    level: "audience_verified",
    networkCode: "instagram",
    displayName: "Maison Aube",
    countryCode: "FR",
    reasonCode: "other",
    submittedAt: INSTANT,
    slaDueAt: INSTANT,
    escalateAt: INSTANT,
    overdue: false,
    owner: null,
    claim: {
      holder: null,
      claimedAt: null,
      claimExpiresAt: null,
      heldByCaller: false,
    },
  };

  it("lists a contest without handle, text or decider, and leaves the code of the queue to the screens", () => {
    expect(disputeEntryRowSchema.safeParse(row).success).toBe(true);
    expect(
      namesOf(disputeEntryRowSchema).filter((name) =>
        /handle|text|decider|profileUrl|comment/iu.test(name),
      ),
    ).toEqual([]);
    expect(disputeEntryRowSchema.safeParse({ ...row, text: "x" }).success).toBe(
      false,
    );
    expect(VERIFICATION_DISPUTES_QUEUE).toBe("verification_disputes");
    expect(IDENTITY_CHANGE_QUEUE).toBe("identity_change_review");
    expect(
      [VERIFICATION_DISPUTES_QUEUE, IDENTITY_CHANGE_QUEUE].filter(
        (code) => queueCodeSchema.safeParse(code).success,
      ),
    ).toEqual([]);
  });

  it("carries the dossier and the motives only with a claim, and never the review token of another entry's shape", () => {
    const entry = {
      id: ID,
      kind: "refusal",
      level: "account_verified",
      networkCode: "instagram",
      state: "open",
      submittedAt: INSTANT,
      slaDueAt: INSTANT,
      escalateAt: INSTANT,
      overdue: false,
      claim: row.claim,
      lastForcedRelease: null,
      decision: null,
    };
    const open = {
      asOf: INSTANT,
      outcome: "read_only",
      reviewToken: null,
      entry,
      account: {
        id: OTHER_ID,
        countryCode: "FR",
        preferredLanguage: "fr",
        owner: null,
      },
      dossier: null,
      outcomeReasons: [],
    };
    expect(disputeOpenResponseSchema.safeParse(open).success).toBe(true);
    expect(
      disputeOpenResponseSchema.safeParse({ ...open, reviewToken: "short" })
        .success,
    ).toBe(false);
    expect(
      disputeOpenResponseSchema.safeParse({
        ...open,
        entry: { ...entry, state: "reopened" },
      }).success,
    ).toBe(false);
  });

  it("upholds with a motive of the upheld ones, `decision_overturned` never, and overturns by what was contested", () => {
    const uphold = (body: unknown) =>
      upholdDisputeRequestSchema.safeParse(body).success;
    expect(
      uphold({ reviewToken: TOKEN, outcomeReasonCode: "decision_confirmed" }),
    ).toBe(true);
    expect(
      uphold({
        reviewToken: TOKEN,
        outcomeReasonCode: "other",
        memberMessage: message(25),
      }),
    ).toBe(true);
    expect(
      uphold({ reviewToken: TOKEN, outcomeReasonCode: "decision_overturned" }),
    ).toBe(false);
    expect(
      uphold({
        reviewToken: TOKEN,
        outcomeReasonCode: "other",
        memberMessage: message(5),
      }),
    ).toBe(false);

    const overturn = (body: unknown) =>
      overturnDisputeRequestSchema.safeParse(body).success;
    expect(
      overturn({
        target: "refusal_account",
        reviewToken: TOKEN,
        observedCode: CODE,
        observedHandle: "maison.aube",
      }),
    ).toBe(true);
    expect(
      overturn({
        target: "refusal_audience",
        reviewToken: TOKEN,
        followers: 47300,
        postsLast30Days: 12,
        avgComments: 40,
        engagementBp: 350,
        periodStart: "2026-10-01",
        periodEnd: "2026-10-30",
        observedHandle: "maison.aube",
      }),
    ).toBe(true);
    expect(
      overturn({
        target: "revocation",
        reviewToken: TOKEN,
        observedHandle: "maison.aube",
      }),
    ).toBe(true);
    expect(overturn({ target: "revocation", reviewToken: TOKEN })).toBe(false);
    expect(
      overturn({
        target: "refusal_audience",
        reviewToken: TOKEN,
        followers: -1,
        postsLast30Days: 12,
        avgComments: 40,
        engagementBp: null,
        periodStart: "2026-10-01",
        periodEnd: "2026-10-30",
        observedHandle: "maison.aube",
      }),
    ).toBe(false);
    expect(
      overturn({
        target: "somewhere",
        reviewToken: TOKEN,
        observedHandle: "x",
      }),
    ).toBe(false);
  });
});

describe("L2F-11 queue 6, the identifiers changed (08 RG78; 15 RG29; 0233)", () => {
  const claim = {
    holder: null,
    claimedAt: null,
    claimExpiresAt: null,
    heldByCaller: false,
  };

  it("lists a change without any identifier, and shows the former and the new one in the decision view only", () => {
    const row = {
      id: ID,
      accountId: OTHER_ID,
      networkCode: "instagram",
      displayName: null,
      countryCode: "FR",
      changeCount: 2,
      createdAt: INSTANT,
      lastChangedAt: INSTANT,
      slaDueAt: INSTANT,
      escalateAt: INSTANT,
      overdue: false,
      owner: null,
      claim,
    };
    expect(identifierChangeEntryRowSchema.safeParse(row).success).toBe(true);
    expect(
      namesOf(identifierChangeEntryRowSchema).filter((name) =>
        /handle|pseudonym|profileUrl/iu.test(name),
      ),
    ).toEqual([]);
    expect(namesOf(identifierChangeDossierSchema)).toEqual(
      expect.arrayContaining(["previousHandle", "newHandle"]),
    );
    expect(
      identifierChangeEntryRowSchema.safeParse({ ...row, changeCount: 0 })
        .success,
    ).toBe(false);
    const dossier = {
      networkCode: "instagram",
      previousHandle: null,
      newHandle: "maison.aube2",
      changeCount: 1,
      createdAt: INSTANT,
      lastChangedAt: INSTANT,
      creator: { handle: "maison.aube2", pseudonym: null, profileUrl: null },
      accountBadge: { id: ID, state: "active", grantedAt: INSTANT },
      audienceBadge: null,
    };
    expect(identifierChangeDossierSchema.safeParse(dossier).success).toBe(true);
    expect(
      identifierChangeDossierSchema.safeParse({
        ...dossier,
        accountBadge: { id: ID, state: "gone", grantedAt: INSTANT },
      }).success,
    ).toBe(false);
  });

  it("confirms with the handle typed, and requires a proof with no text but a comment", () => {
    expect(
      confirmIdentifierChangeRequestSchema.safeParse({
        reviewToken: TOKEN,
        observedHandle: "maison.aube2",
      }).success,
    ).toBe(true);
    expect(
      confirmIdentifierChangeRequestSchema.safeParse({ reviewToken: TOKEN })
        .success,
    ).toBe(false);
  });
});

describe("L2F-11 a verification opened by an agent, and the proof by the login address (D83 A, A-bis)", () => {
  const base = {
    level: "account_verified",
    socialAccountId: ID,
    openingReasonCode: "existing_client",
  };
  const parse = (body: unknown) =>
    openVerificationForMemberBodySchema.safeParse(body).success;

  it("opens a creator line or a brand, never the audience, with a reason of the list and a comment for `other`", () => {
    expect(parse(base)).toBe(true);
    expect(
      parse({
        level: "brand_verified",
        socialAccountId: null,
        openingReasonCode: "invited_by_agent",
      }),
    ).toBe(true);
    expect(parse({ ...base, level: "audience_verified" })).toBe(false);
    expect(parse({ ...base, openingReasonCode: "other" })).toBe(false);
    expect(
      parse({
        ...base,
        openingReasonCode: "other",
        openingComment: "Met at an event.",
      }),
    ).toBe(true);
    expect(parse({ ...base, openingReasonCode: "boss_said_so" })).toBe(false);
    expect(parse({ ...base, openingComment: "x".repeat(1001) })).toBe(false);
  });

  it("names a line for « Compte vérifié » and none for the brand, whose internal block comes whole or not at all", () => {
    expect(parse({ ...base, socialAccountId: null })).toBe(false);
    expect(
      parse({
        level: "brand_verified",
        socialAccountId: ID,
        openingReasonCode: "existing_client",
      }),
    ).toBe(false);
    const brand = {
      level: "brand_verified",
      socialAccountId: null,
      openingReasonCode: "existing_client",
    };
    expect(
      parse({
        ...brand,
        legalName: "Maison Aube SAS",
        registrationCountryCode: "FR",
        registrationNumber: "123456789",
      }),
    ).toBe(true);
    expect(parse({ ...brand, legalName: "Maison Aube SAS" })).toBe(false);
    expect(
      parse({
        ...base,
        legalName: "Maison Aube SAS",
        registrationCountryCode: "FR",
        registrationNumber: "1",
      }),
    ).toBe(false);
  });

  it("grants by the login address with no code and no channel typed, and records the channel the database wrote", () => {
    expect(
      grantBrandByLoginRequestSchema.safeParse({
        reviewToken: TOKEN,
        registrySourceId: ID,
      }).success,
    ).toBe(true);
    expect(
      grantBrandByLoginRequestSchema.safeParse({
        reviewToken: TOKEN,
        registrySourceId: ID,
        observedCode: CODE,
        observedChannel: "login_address",
      }).success,
    ).toBe(false);
    expect([...BRAND_CONSTAT_CHANNELS]).toEqual([
      ...BRAND_OBSERVED_CHANNELS,
      "login_address",
    ]);
    expect(brandObservedChannelSchema.safeParse("login_address").success).toBe(
      false,
    );
  });

  it("shows the origin to the agent in the dossier of queue 4, absent until commit 15, and adds the refusals of L2F", () => {
    const dossier = {
      codeExpiresAt: null,
      creator: null,
      brand: null,
      evidence: [],
      history: [],
      badges: [],
      alerts: [],
    };
    expect(verificationDossierSchema.safeParse(dossier).success).toBe(true);
    expect(
      verificationDossierSchema.safeParse({
        ...dossier,
        opening: {
          openedBy: "agent",
          reasonCode: "existing_client",
          comment: null,
          loginAddressEligible: false,
        },
      }).success,
    ).toBe(true);
    expect(
      verificationDossierSchema.safeParse({
        ...dossier,
        opening: {
          openedBy: "someone",
          reasonCode: null,
          comment: null,
          loginAddressEligible: false,
        },
      }).success,
    ).toBe(false);
    expect(VERIFICATION_REFUSAL_ISSUES).toEqual(
      expect.arrayContaining([
        "badge_not_holding",
        "revocation_pending",
        "not_disputable",
        "dispute_window_closed",
        "already_disputed",
        "reviewer_is_decider",
        "reflection_delay",
        "restore_expired",
        "line_deleted",
        "handle_already_verified",
        "login_address_ineligible",
      ]),
    );
  });
});

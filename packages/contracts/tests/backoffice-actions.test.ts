import { describe, expect, it } from "vitest";
import {
  alertsResponseSchema,
  apolloSettingSchema,
  correctionRequestSchema,
  DEGRADED_REVIEW_WEEKS_DEFAULT,
  DEGRADED_REVIEW_WEEKS_MAX,
  degradedReviewQuerySchema,
  degradedReviewResponseSchema,
  dualControlActionSchema,
  dualControlConfirmSchema,
  dualControlRequestSchema,
  dualControlTargetSchema,
  REPLAY_SELECTION_MAX,
  replayRequestSchema,
} from "../src/backoffice-actions.ts";

const ACCOUNT = "00000000-0000-4000-8000-000000000001";

describe("POST /v1/bo/leads/replays (05 RG101, CA59)", () => {
  it("takes pairs and a reason of the closed list, a selection up to its bound", () => {
    const items = Array.from({ length: REPLAY_SELECTION_MAX }, () => ({
      accountId: ACCOUNT,
      destination: "brevo",
    }));
    expect(
      replayRequestSchema.safeParse({ items, reasonCode: "provider_recovered" })
        .success,
    ).toBe(true);
    for (const body of [
      { items: [], reasonCode: "provider_recovered" },
      { items: [...items, items[0]], reasonCode: "provider_recovered" },
      {
        items: [{ accountId: ACCOUNT, destination: "brevo" }],
        reasonCode: "because",
      },
      // never an internal line id (0101 "never exposed")
      { items: [{ outboxId: 12 }], reasonCode: "provider_recovered" },
    ]) {
      expect(replayRequestSchema.safeParse(body).success).toBe(false);
    }
  });
});

describe("POST /v1/bo/accounts/:id/corrections (05 RG108)", () => {
  it("needs a field to correct and a typed reason; the role is not here", () => {
    expect(
      correctionRequestSchema.safeParse({
        reasonCode: "signup_error",
        countryCode: "BE",
      }).success,
    ).toBe(true);
    for (const body of [
      { reasonCode: "signup_error" },
      { countryCode: "BE" },
      { reasonCode: "signup_error", role: "advertiser" },
      { reasonCode: "signup_error", countryCode: "XX" },
      { reasonCode: "signup_error", comment: "a\u0007b", countryCode: "BE" },
    ]) {
      expect(correctionRequestSchema.safeParse(body).success).toBe(false);
    }
  });
});

describe("Apollo keys and the dual control (05 RG81; 03 PD1 to PD7)", () => {
  it("knows the three keys and their shapes (0103)", () => {
    for (const setting of [
      { key: "apollo_scope", value: "tous_les_inscrits" },
      { key: "apollo_excluded_countries", value: [] },
      {
        key: "apollo_legal_basis",
        value: {
          default: "consentement_requis",
          byCountry: [
            { countryCode: "BE", basis: "interet_legitime_avec_opposition" },
          ],
        },
      },
    ]) {
      expect(apolloSettingSchema.safeParse(setting).success).toBe(true);
    }
    for (const setting of [
      { key: "apollo_scope", value: "everyone" },
      { key: "rate_limits", value: {} },
      { key: "apollo_excluded_countries", value: ["XX"] },
      {
        key: "apollo_legal_basis",
        value: { default: "consentement_requis" },
      },
      {
        key: "apollo_legal_basis",
        value: {
          default: "consentement_requis",
          byCountry: [
            { countryCode: "BE", basis: "consentement_requis" },
            { countryCode: "BE", basis: "consentement_requis" },
          ],
        },
      },
    ]) {
      expect(apolloSettingSchema.safeParse(setting).success).toBe(false);
    }
  });

  it("requests a role change with the brand's name, or an Apollo key, nothing else", () => {
    expect(
      dualControlRequestSchema.safeParse({
        code: "identity.change_member_role",
        accountId: ACCOUNT,
        legalName: "Acme SAS",
        reasonCode: "member_request",
      }).success,
    ).toBe(true);
    for (const body of [
      {
        code: "identity.change_member_role",
        accountId: ACCOUNT,
        reasonCode: "member_request",
      },
      {
        code: "identity.grant_role",
        accountId: ACCOUNT,
        role: "admin",
        reasonCode: "x",
      },
      {
        code: "leads.change_apollo_setting",
        setting: { key: "apollo_scope", value: "annonceurs_seuls" },
        reasonCode: "because",
      },
    ]) {
      expect(dualControlRequestSchema.safeParse(body).success).toBe(false);
    }
  });

  it("confirms without a justification by default, and refuses a short one", () => {
    expect(dualControlConfirmSchema.parse({})).toEqual({
      degradedJustification: null,
    });
    expect(
      dualControlConfirmSchema.safeParse({ degradedJustification: "too short" })
        .success,
    ).toBe(false);
  });
});

describe('the execution of a "mes données" request under 2V (15 RG75 step 6; J8 commit 8)', () => {
  const REQUEST = "6e5d4c3b-2a19-4807-b6f5-e4d3c2b1a090";

  it("requests an access or an erasure with the only reason of the list", () => {
    for (const requestType of ["access", "erasure"] as const) {
      expect(
        dualControlRequestSchema.safeParse({
          code: "privacy.approve_data_request",
          requestId: REQUEST,
          requestType,
          reasonCode: "request_instructed",
        }).success,
      ).toBe(true);
    }
  });

  it("refuses another type, another reason, and any extra field", () => {
    const base = {
      code: "privacy.approve_data_request",
      requestId: REQUEST,
      requestType: "erasure",
      reasonCode: "request_instructed",
    };
    for (const body of [
      { ...base, requestType: "rectification" },
      { ...base, reasonCode: "founder_decision" },
      { ...base, accountId: REQUEST },
      { ...base, requestId: "not-a-uuid" },
    ]) {
      expect(dualControlRequestSchema.safeParse(body).success).toBe(false);
    }
  });
});

describe("PD1 (J8S-2): the target of a 2V action, never an identifier alone", () => {
  it("names a member account without its address, an invitation by its address and role", () => {
    expect(
      dualControlTargetSchema.safeParse({
        kind: "member_account",
        accountId: ACCOUNT,
        role: "advertiser",
        countryCode: "BE",
        createdAt: "2026-10-01T08:00:00.000Z",
        companyName: "Acme SAS",
      }).success,
    ).toBe(true);
    expect(
      dualControlTargetSchema.safeParse({
        kind: "internal_invitation",
        email: "camille@influx.test",
        role: "admin",
        createdAt: "2026-10-01T08:00:00.000Z",
      }).success,
    ).toBe(true);
    // a member account never carries its address (05 RG40: read on the journaled record)
    expect(
      dualControlTargetSchema.safeParse({
        kind: "member_account",
        accountId: ACCOUNT,
        role: "creator",
        countryCode: "FR",
        createdAt: "2026-10-01T08:00:00.000Z",
        companyName: null,
        email: "member@example.test",
      }).success,
    ).toBe(false);
  });
});

describe("L2F-13 the withdrawal of a badge under 2V (0231; 08 RG73 to RG76)", () => {
  const BADGE = "00000000-0000-4000-8000-000000000002";

  it("is a stored action of the closed list (account, badge, reason) and never one a route requests", () => {
    expect(
      dualControlActionSchema.safeParse({
        code: "verification.revoke_badge",
        accountId: ACCOUNT,
        badgeId: BADGE,
        reasonCode: "terms_breach",
      }).success,
    ).toBe(true);
    // a reason outside the closed list, a missing badge or an extra key: refused
    for (const action of [
      { accountId: ACCOUNT, badgeId: BADGE, reasonCode: "invented" },
      { accountId: ACCOUNT, reasonCode: "terms_breach" },
      {
        accountId: ACCOUNT,
        badgeId: BADGE,
        reasonCode: "terms_breach",
        memberMessage: "twenty characters at least",
      },
    ]) {
      expect(
        dualControlActionSchema.safeParse({
          code: "verification.revoke_badge",
          ...action,
        }).success,
      ).toBe(false);
    }
    // the request of a 2V never carries it: the database refuses it there (0231)
    expect(
      dualControlRequestSchema.safeParse({
        code: "verification.revoke_badge",
        accountId: ACCOUNT,
        badgeId: BADGE,
        reasonCode: "terms_breach",
      }).success,
    ).toBe(false);
  });

  it("names the badge it reaches by level, network code and state, never a figure nor a handle", () => {
    const target = {
      kind: "badge",
      accountId: ACCOUNT,
      badgeId: BADGE,
      level: "account_verified",
      networkCode: "instagram",
      badgeState: "active",
      memberMessage: null,
      cascadeCount: 1,
      memberRole: "creator",
      countryCode: "FR",
      companyName: null,
    };
    expect(dualControlTargetSchema.safeParse(target).success).toBe(true);
    for (const extra of [{ handle: "@someone" }, { followers: 1200 }]) {
      expect(
        dualControlTargetSchema.safeParse({ ...target, ...extra }).success,
      ).toBe(false);
    }
    expect(
      dualControlTargetSchema.safeParse({ ...target, badgeState: "weird" })
        .success,
    ).toBe(false);
  });
});

describe("PD6 (J8S-1): the weekly review of the degraded confirmations", () => {
  it("defaults to four ISO weeks, coerced from the query string, 1 to 53", () => {
    expect(degradedReviewQuerySchema.parse({})).toEqual({
      weeks: DEGRADED_REVIEW_WEEKS_DEFAULT,
    });
    expect(degradedReviewQuerySchema.parse({ weeks: "53" })).toEqual({
      weeks: DEGRADED_REVIEW_WEEKS_MAX,
    });
    for (const query of [{ weeks: "0" }, { weeks: "54" }, { other: "1" }]) {
      expect(
        degradedReviewQuerySchema.safeParse(query).success,
        JSON.stringify(query),
      ).toBe(false);
    }
  });

  it("answers ISO weeks only", () => {
    const answer = (week: string) => ({
      weeks: 4,
      evaluatedAt: "2026-10-20T08:00:00.000Z",
      review: [{ week, confirmations: [] }],
    });
    expect(
      degradedReviewResponseSchema.safeParse(answer("2026-W43")).success,
    ).toBe(true);
    expect(
      degradedReviewResponseSchema.safeParse(answer("2026-43")).success,
    ).toBe(false);
  });
});

describe("J8S-4: the admin role grants of the home alerts", () => {
  it("are part of every answer, empty for an agent, without any address", () => {
    const base = {
      evaluatedAt: "2026-10-20T08:00:00.000Z",
      alerts: [],
      newBrowserSignIns: [],
    };
    expect(alertsResponseSchema.safeParse(base).success).toBe(false);
    const grant = {
      accountId: ACCOUNT,
      firstName: "Camille",
      grantedBy: null,
      grantedByFirstName: null,
      grantedAt: "2026-10-20T07:00:00.000Z",
    };
    expect(
      alertsResponseSchema.safeParse({ ...base, adminRoleGrants: [grant] })
        .success,
    ).toBe(true);
    expect(
      alertsResponseSchema.safeParse({
        ...base,
        adminRoleGrants: [{ ...grant, email: "camille@influx.test" }],
      }).success,
    ).toBe(false);
  });
});

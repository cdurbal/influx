import { describe, expect, it } from "vitest";
import {
  apolloSettingSchema,
  correctionRequestSchema,
  dualControlConfirmSchema,
  dualControlRequestSchema,
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
      { key: "apollo_prospecting_countries", value: [] },
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
      { key: "apollo_prospecting_countries", value: ["XX"] },
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

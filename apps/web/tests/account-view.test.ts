// The rules of the "mon compte" screens that are not apps/api's (src/components/account/
// account-view.ts; docs/mvp/17 §6.1 to §6.4; 05 RG22, RG57, RG58, RG95, RG96, RG137, RG143).
import type {
  DataRequest,
  EmailChangeRequest,
  MeResponse,
} from "@influx/contracts/account";
import { describe, expect, it } from "vitest";
import {
  browserOf,
  changedFieldsOf,
  confirmedSidesOf,
  confirmStepOf,
  consentOriginOf,
  detailsFormMessage,
  detailsRefusalOf,
  draftOf,
  emailChangeRefusalOf,
  formatDate,
  freshCodeRequestMessage,
  freshCodeStepOf,
  isConfirmationWordTyped,
  openRequestOf,
} from "@/components/account/account-view";

const CREATOR: MeResponse = {
  email: "creator@example.test",
  role: "creator",
  preferredLanguage: "fr",
  countryCode: "FR",
  declaredStatus: "individual",
  companyName: null,
  termsToAccept: null,
};

const ADVERTISER: MeResponse = {
  ...CREATOR,
  email: "brand@example.test",
  role: "advertiser",
  declaredStatus: "business",
  companyName: "Maison",
};

const REQUEST: EmailChangeRequest = {
  id: "7b0f6f53-1f0c-4c1e-9d5b-1a2b3c4d5e6f",
  newEmail: "new@example.test",
  expiresAt: "2026-10-15T10:00:00.000Z",
  oldConfirmed: false,
  newConfirmed: false,
};

describe("mes informations (17 §6.1)", () => {
  it("sends nothing when nothing changed", () => {
    expect(changedFieldsOf(CREATOR, draftOf(CREATOR))).toBeNull();
    expect(changedFieldsOf(ADVERTISER, draftOf(ADVERTISER))).toBeNull();
  });

  it("sends the changed fields only", () => {
    expect(
      changedFieldsOf(CREATOR, {
        ...draftOf(CREATOR),
        countryCode: "BE",
        declaredStatus: "business",
      }),
    ).toEqual({ countryCode: "BE", declaredStatus: "business" });
    expect(
      changedFieldsOf(ADVERTISER, {
        ...draftOf(ADVERTISER),
        preferredLanguage: "en",
        companyName: "  Maison Neuve ",
      }),
    ).toEqual({ preferredLanguage: "en", companyName: "Maison Neuve" });
  });

  it("never sends a field of the other role (RG22)", () => {
    expect(
      changedFieldsOf(ADVERTISER, {
        ...draftOf(ADVERTISER),
        declaredStatus: "individual",
      }),
    ).toBeNull();
    expect(
      changedFieldsOf(CREATOR, { ...draftOf(CREATOR), companyName: "X" }),
    ).toBeNull();
  });

  it("keeps a company name for an advertiser", () => {
    expect(
      detailsFormMessage(ADVERTISER, {
        ...draftOf(ADVERTISER),
        companyName: "  ",
      }),
    ).toBe("companyRequired");
    expect(detailsFormMessage(CREATOR, draftOf(CREATOR))).toBeNull();
  });

  it("names the refusal from the issues of the 400, never their values", () => {
    expect(
      detailsRefusalOf({
        kind: "failed",
        code: "validation_failed",
        issues: ["unavailable"],
      }),
    ).toBe("countryUnavailable");
    expect(
      detailsRefusalOf({
        kind: "failed",
        code: "validation_failed",
        issues: ["too_long"],
      }),
    ).toBe("companyInvalid");
    expect(detailsRefusalOf({ kind: "failed" })).toBe("unavailable");
  });
});

describe("the fresh code (05 RG57)", () => {
  it("leaves only with a journey token", () => {
    expect(
      freshCodeRequestMessage({
        kind: "ok",
        data: {
          outcome: "sent",
          retryAfterSeconds: 60,
          matchingPhrase: "BLUE OWL",
          reauthToken: "token",
        },
      }),
    ).toBeNull();
    expect(
      freshCodeRequestMessage({
        kind: "ok",
        data: { outcome: "sent", retryAfterSeconds: 60 },
      }),
    ).toBe("sendUnavailable");
    expect(
      freshCodeRequestMessage({
        kind: "ok",
        data: { outcome: "rate_limited", retryAfterSeconds: 60 },
      }),
    ).toBe("rateLimited");
    expect(freshCodeRequestMessage({ kind: "failed" })).toBe("sendUnavailable");
  });

  it("closes the field when only a new code helps (RG137)", () => {
    expect(
      freshCodeStepOf({
        kind: "ok",
        data: {
          outcome: "reauthenticated",
          purpose: "data_export",
          validForSeconds: 300,
        },
      }),
    ).toEqual({ kind: "verified" });
    expect(
      freshCodeStepOf({
        kind: "ok",
        data: { outcome: "invalid", attemptsLeft: 2 },
      }),
    ).toEqual({
      kind: "error",
      message: "invalid",
      remaining: 2,
      closed: false,
    });
    for (const outcome of [
      "too_many_attempts",
      "expired",
      "session_lost",
    ] as const) {
      expect(freshCodeStepOf({ kind: "ok", data: { outcome } })).toMatchObject({
        closed: true,
      });
    }
    expect(freshCodeStepOf({ kind: "failed" })).toEqual({
      kind: "error",
      message: "verifyUnavailable",
      closed: false,
    });
  });
});

describe("the change of address (05 RG58)", () => {
  it("counts the confirmed sides", () => {
    expect(confirmedSidesOf(REQUEST)).toBe(0);
    expect(confirmedSidesOf({ ...REQUEST, oldConfirmed: true })).toBe(1);
  });

  it("names a refused request, and asks a fresh code again otherwise (C4.c)", () => {
    expect(
      emailChangeRefusalOf({
        kind: "failed",
        code: "validation_failed",
        issues: ["same_as_current"],
      }),
    ).toBe("sameAsCurrent");
    expect(
      emailChangeRefusalOf({
        kind: "failed",
        code: "validation_failed",
        issues: ["undeliverable"],
      }),
    ).toBe("undeliverable");
    expect(
      emailChangeRefusalOf({
        kind: "failed",
        code: "reauthentication_required",
      }),
    ).toBe("freshCodeRequired");
    expect(
      emailChangeRefusalOf({
        kind: "failed",
        code: "email_change_unavailable",
      }),
    ).toBe("unavailable");
  });

  it("follows each answer of a confirmation code", () => {
    expect(
      confirmStepOf({
        kind: "ok",
        data: {
          outcome: "confirmed",
          request: { ...REQUEST, oldConfirmed: true },
        },
      }),
    ).toEqual({
      kind: "pending",
      request: { ...REQUEST, oldConfirmed: true },
    });
    expect(
      confirmStepOf({ kind: "ok", data: { outcome: "completed" } }),
    ).toEqual({ kind: "completed" });
    expect(
      confirmStepOf({ kind: "ok", data: { outcome: "address_unavailable" } }),
    ).toEqual({ kind: "ended", message: "addressUnavailable" });
    expect(confirmStepOf({ kind: "failed", code: "not_found" })).toEqual({
      kind: "ended",
      message: "gone",
    });
    expect(
      confirmStepOf({
        kind: "ok",
        data: { outcome: "invalid", attemptsLeft: 4 },
      }),
    ).toEqual({ kind: "codeError", message: "invalid", remaining: 4 });
  });
});

describe("mes préférences (05 RG95, RG96)", () => {
  it("writes every origin in full; a Brevo unsubscription is an unsubscribe link", () => {
    expect(consentOriginOf("signup_form")).toBe("signupForm");
    expect(consentOriginOf("account_settings")).toBe("accountSettings");
    expect(consentOriginOf("brevo_webhook")).toBe("unsubscribeLink");
    expect(consentOriginOf("apollo_optout")).toBe("prospectionOptOut");
    expect(consentOriginOf("backoffice")).toBe("influx");
    expect(consentOriginOf("data_request")).toBe("dataRequest");
  });

  it("writes a date as the language does", () => {
    expect(formatDate("2026-01-12T12:00:00.000Z", "fr")).toMatch(
      /janvier 2026/,
    );
    expect(formatDate("2026-01-12T12:00:00.000Z", "en")).toMatch(/January/);
  });
});

describe("mes sessions (05 RG143)", () => {
  it("reads a browser by its family and its system", () => {
    expect(browserOf("firefox.windows")).toEqual({
      family: "firefox",
      system: "windows",
    });
    expect(browserOf("unidentified.unidentified")).toBeNull();
  });
});

describe("mes données (17 §6.3)", () => {
  it("asks for the exact word, spaces around aside", () => {
    expect(isConfirmationWordTyped(" SUPPRIMER ", "SUPPRIMER")).toBe(true);
    expect(isConfirmationWordTyped("supprimer", "SUPPRIMER")).toBe(false);
    expect(isConfirmationWordTyped("", "DELETE")).toBe(false);
  });

  it("finds the open request of a type", () => {
    const base: DataRequest = {
      id: "0b6f6f53-1f0c-4c1e-9d5b-1a2b3c4d5e6f",
      type: "access",
      receivedAt: "2026-10-14T10:00:00.000Z",
      dueAt: "2026-11-13T10:00:00.000Z",
      status: "closed",
      completedAt: "2026-10-20T10:00:00.000Z",
      outcome: "satisfaite",
    };
    expect(openRequestOf([base], "access")).toBeNull();
    const open = { ...base, status: "received" as const, completedAt: null };
    expect(openRequestOf([base, open], "access")).toBe(open);
    expect(openRequestOf([open], "erasure")).toBeNull();
  });
});

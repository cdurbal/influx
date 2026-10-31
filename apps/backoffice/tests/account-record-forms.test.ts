// The rules of the three forms of an account record (src/components/account-record-forms.ts;
// docs/mvp/05 RG93, RG108): required field, mandatory reason, payload, words of the refusal. Pure
// functions: no browser, no network.
import { describe, expect, it } from "vitest";
import {
  correctionNotice,
  correctionOutcome,
  LEGAL_NAME_MAX,
  roleChangeOutcome,
  suppressionCanSubmit,
  suppressionOutcome,
  suppressionRefusal,
} from "@/components/account-record-forms";
import { messages } from "@/messages/fr";

const ACCOUNT = "0b6d9c1e-5d7a-4c1b-9b1e-3f2a4c5d6e7f";
const NO_CHANGE = {
  declaredStatus: "",
  country: "",
  language: "",
  reason: "",
  note: "",
};

describe("correction form (RG108)", () => {
  it("asks for at least one value before anything else", () => {
    expect(correctionOutcome({ ...NO_CHANGE, reason: "data_quality" })).toEqual(
      {
        ok: false,
        error: messages.account.nothingToCorrect,
      },
    );
    expect(correctionOutcome(NO_CHANGE)).toEqual({
      ok: false,
      error: messages.account.nothingToCorrect,
    });
  });

  it("requires a reason once a value is chosen", () => {
    expect(correctionOutcome({ ...NO_CHANGE, country: "FR" })).toEqual({
      ok: false,
      error: messages.common.reasonPlaceholder,
    });
  });

  it("sends only the chosen values, with the reason", () => {
    expect(
      correctionOutcome({
        ...NO_CHANGE,
        language: "en",
        reason: "member_request",
      }),
    ).toEqual({
      ok: true,
      body: { reasonCode: "member_request", preferredLanguage: "en" },
    });
  });

  it("sends every chosen value and the note trimmed", () => {
    expect(
      correctionOutcome({
        declaredStatus: "business",
        country: "BE",
        language: "fr",
        reason: "signup_error",
        note: "  typo at signup  ",
      }),
    ).toEqual({
      ok: true,
      body: {
        reasonCode: "signup_error",
        declaredStatus: "business",
        countryCode: "BE",
        preferredLanguage: "fr",
        comment: "typo at signup",
      },
    });
  });

  it("leaves out a blank note", () => {
    const outcome = correctionOutcome({
      ...NO_CHANGE,
      country: "FR",
      reason: "data_quality",
      note: "   ",
    });
    expect(outcome.ok && "comment" in outcome.body).toBe(false);
  });

  it("says whether anything changed", () => {
    expect(correctionNotice(true)).toBe(messages.account.corrected);
    expect(correctionNotice(false)).toBe(messages.account.nothingChanged);
  });
});

describe("role change form (RG108, dual control)", () => {
  it("refuses a legal name under 2 or over 120 characters once trimmed", () => {
    for (const legalName of ["", " a ", "x".repeat(LEGAL_NAME_MAX + 1)]) {
      expect(
        roleChangeOutcome(ACCOUNT, { legalName, reason: "member_request" }),
      ).toEqual({ ok: false, error: messages.account.legalNameInvalid });
    }
  });

  it("accepts the bounds, 2 and 120 characters", () => {
    for (const legalName of ["ab", "x".repeat(LEGAL_NAME_MAX)]) {
      expect(
        roleChangeOutcome(ACCOUNT, { legalName, reason: "member_request" }).ok,
      ).toBe(true);
    }
  });

  it("checks the name before the reason", () => {
    expect(roleChangeOutcome(ACCOUNT, { legalName: "", reason: "" })).toEqual({
      ok: false,
      error: messages.account.legalNameInvalid,
    });
  });

  it("requires a reason", () => {
    expect(
      roleChangeOutcome(ACCOUNT, { legalName: "Acme", reason: "" }),
    ).toEqual({ ok: false, error: messages.common.reasonPlaceholder });
  });

  it("builds the request of the dual control with the trimmed name", () => {
    expect(
      roleChangeOutcome(ACCOUNT, {
        legalName: "  Acme SAS ",
        reason: "signup_error",
      }),
    ).toEqual({
      ok: true,
      body: {
        code: "identity.change_member_role",
        accountId: ACCOUNT,
        legalName: "Acme SAS",
        reasonCode: "signup_error",
      },
    });
  });
});

describe("Brevo suppression lift form (RG93)", () => {
  it("waits for a reason, silently", () => {
    expect(suppressionCanSubmit("")).toBe(false);
    expect(suppressionCanSubmit("provider_error")).toBe(true);
    expect(suppressionOutcome("")).toEqual({ ok: false, error: null });
  });

  it("sends the reason alone", () => {
    expect(suppressionOutcome("complaint_misattributed")).toEqual({
      ok: true,
      body: { reasonCode: "complaint_misattributed" },
    });
  });

  it("words the 409 as no recorded suppression and leaves the other refusals to the common words", () => {
    expect(suppressionRefusal("conflict")).toBe(
      messages.account.suppressionNone,
    );
    for (const code of [
      "forbidden",
      "not_found",
      "validation_failed",
      undefined,
    ]) {
      expect(suppressionRefusal(code)).toBeNull();
    }
  });
});

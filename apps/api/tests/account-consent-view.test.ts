// The one consent value shown for two purposes (docs/mvp/05 RG33, RG95; 17 §6.2): consentView()
// of src/domains/identity/account-routes.ts. The routes on the local stack are
// db-tests/tm1-member-account-route.test.ts.
import { describe, expect, it } from "vitest";
import { consentView } from "../src/domains/identity/account-routes.ts";
import type { ConsentState } from "../src/domains/identity/repository.ts";

function state(
  purpose: ConsentState["purpose"],
  granted: boolean,
  source: string,
  occurredAt: string,
): ConsentState {
  return { purpose, granted, source, occurredAt };
}

describe("consentView (05 RG33, RG95)", () => {
  it("is granted when both purposes are, dated by the latest event", () => {
    expect(
      consentView([
        state(
          "marketing_email",
          true,
          "signup_form",
          "2026-10-01T10:00:00.000Z",
        ),
        state(
          "commercial_prospection",
          true,
          "account_settings",
          "2026-10-02T10:00:00.000Z",
        ),
      ]),
    ).toEqual({
      granted: true,
      occurredAt: "2026-10-02T10:00:00.000Z",
      source: "account_settings",
    });
  });

  it("is withdrawn as soon as one purpose is, with the date and origin of that withdrawal", () => {
    expect(
      consentView([
        state(
          "marketing_email",
          false,
          "brevo_webhook",
          "2026-10-03T08:00:00.000Z",
        ),
        state(
          "commercial_prospection",
          true,
          "signup_form",
          "2026-10-04T08:00:00.000Z",
        ),
      ]),
    ).toEqual({
      granted: false,
      occurredAt: "2026-10-03T08:00:00.000Z",
      source: "brevo_webhook",
    });
  });

  it("shows the latest of two withdrawals", () => {
    expect(
      consentView([
        state(
          "marketing_email",
          false,
          "account_settings",
          "2026-10-05T08:00:00.000Z",
        ),
        state(
          "commercial_prospection",
          false,
          "apollo_optout",
          "2026-10-06T08:00:00.000Z",
        ),
      ]),
    ).toMatchObject({ granted: false, source: "apollo_optout" });
  });

  it("is withdrawn without date nor origin when no event exists, or one purpose has none", () => {
    expect(consentView([])).toEqual({
      granted: false,
      occurredAt: null,
      source: null,
    });
    expect(
      consentView([
        state(
          "marketing_email",
          true,
          "signup_form",
          "2026-10-01T10:00:00.000Z",
        ),
      ]),
    ).toEqual({ granted: false, occurredAt: null, source: null });
  });
});

import { describe, expect, it } from "vitest";
import {
  ELEVATED_OPERATIONS,
  ELEVATED_POOL_EXCEPTIONS,
  isElevatedOperation,
  SIGNED_ELEVATED_OPERATIONS,
} from "../src/elevated-operations.ts";

describe("elevated operations (03 P7, 18 T6.1)", () => {
  it("only declares operations of the signed list (U ⊆ P)", () => {
    for (const operation of ELEVATED_OPERATIONS) {
      expect(SIGNED_ELEVATED_OPERATIONS).toContain(operation);
    }
  });

  it("signs exactly the motifs of the entries of 03 P7 (EC-5; E-6 at J4; EC-62 at J5; J7 decisions 2, 4 and 5)", () => {
    expect([...SIGNED_ELEVATED_OPERATIONS].sort()).toEqual(
      [
        "identity.backoffice_enroll_totp",
        "identity.backoffice_reauthenticate",
        "identity.backoffice_sign_in",
        "identity.complete_signup",
        "identity.member_email_change",
        "identity.member_reauthenticate",
        "identity.read_published_terms",
        "identity.request_code",
        "identity.verify_code",
        "leads.drain_outbox",
        "leads.receive_brevo_event",
        "maintenance.run_periodic",
        "ops.record_telemetry",
        "privacy.execute_request",
        "support.report_delivery_issue",
      ].sort(),
    );
    expect(new Set(SIGNED_ELEVATED_OPERATIONS).size).toBe(15);
  });

  it("binds the Brevo webhook to the api pool although leads.* runs on the worker (J7 decision 2)", () => {
    expect(ELEVATED_POOL_EXCEPTIONS).toEqual({
      "leads.receive_brevo_event": "auth",
    });
  });

  it("recognises the operations with a caller, and nothing else", () => {
    for (const operation of ELEVATED_OPERATIONS) {
      expect(isElevatedOperation(operation)).toBe(true);
    }
    const withoutCaller = SIGNED_ELEVATED_OPERATIONS.filter(
      (operation) =>
        !(ELEVATED_OPERATIONS as readonly string[]).includes(operation),
    );
    for (const value of [...withoutCaller, "", "service", undefined, null]) {
      expect(isElevatedOperation(value)).toBe(false);
    }
  });
});

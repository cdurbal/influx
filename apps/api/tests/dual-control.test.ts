// The dual control service without the database (docs/mvp/03 §1.3 PD1, PD6; 17b §3.13.c): what the
// recap says of each action of the closed list, and the bounds of the weekly review. The flows
// run on the local stack: db-tests/t8-dual-control-service.test.ts.
import { describe, expect, it } from "vitest";
import type { Transaction } from "../src/db/index.ts";
import {
  DEGRADED_REVIEW_MAX_WEEKS,
  degradedConfirmationsByWeek,
  dualControlRecap,
} from "../src/domains/backoffice/dual-control.ts";
import { DUAL_CONTROL_ACTION_CODES } from "../src/domains/backoffice/dual-control/repository.ts";

const ACCOUNT = "00000000-0000-4000-8000-000000000001";

describe("PD1: the recap of each action, before the first gesture", () => {
  it("covers the closed list of the database, one object each", () => {
    expect([...DUAL_CONTROL_ACTION_CODES].sort()).toEqual([
      "identity.change_member_role",
      "identity.grant_role",
      "identity.invite_admin",
      "leads.change_apollo_setting",
      "privacy.approve_data_request",
    ]);
    for (const recap of [
      dualControlRecap({
        code: "identity.grant_role",
        accountId: ACCOUNT,
        role: "agent",
      }),
      dualControlRecap({
        code: "identity.change_member_role",
        accountId: ACCOUNT,
        role: "advertiser",
        legalName: "Acme SAS",
      }),
      dualControlRecap({
        code: "identity.invite_admin",
        invitationId: ACCOUNT,
      }),
      dualControlRecap({
        code: "leads.change_apollo_setting",
        setting: { key: "apollo_scope", value: "annonceurs_seuls" },
      }),
      dualControlRecap({
        code: "privacy.approve_data_request",
        requestId: ACCOUNT,
        requestType: "access",
      }),
    ]) {
      expect(recap.scope.count).toBe(1);
      expect(recap.consequences.length).toBeGreaterThan(0);
    }
  });

  it('says, by type, what the execution of a "mes données" request does, and that it is final (J8 commit 8)', () => {
    expect(
      dualControlRecap({
        code: "privacy.approve_data_request",
        requestId: ACCOUNT,
        requestType: "erasure",
      }),
    ).toEqual({
      scope: { kind: "data_request", count: 1 },
      consequences: [
        "account_anonymized",
        "sessions_closed",
        "brevo_contact_deleted",
        "auth_user_deleted",
        "request_closed_after_brevo",
      ],
      reversible: false,
    });
    expect(
      dualControlRecap({
        code: "privacy.approve_data_request",
        requestId: ACCOUNT,
        requestType: "access",
      }),
    ).toEqual({
      scope: { kind: "data_request", count: 1 },
      consequences: [
        "export_published",
        "member_notified",
        "request_closed_after_brevo",
      ],
      reversible: false,
    });
  });

  it("says that a role change revokes the sessions and cannot be undone, and an admin invitation can", () => {
    expect(
      dualControlRecap({
        code: "identity.change_member_role",
        accountId: ACCOUNT,
        role: "advertiser",
        legalName: "Acme SAS",
      }),
    ).toMatchObject({
      reversible: false,
      consequences: expect.arrayContaining(["sessions_revoked"]),
    });
    expect(
      dualControlRecap({
        code: "identity.invite_admin",
        invitationId: ACCOUNT,
      }),
    ).toMatchObject({
      scope: { kind: "internal_invitation", count: 1 },
      reversible: true,
    });
  });

  it("says that an Apollo key re-evaluates the skipped accounts and can be set back (RG81)", () => {
    expect(
      dualControlRecap({
        code: "leads.change_apollo_setting",
        setting: { key: "apollo_excluded_countries", value: ["FR"] },
      }),
    ).toEqual({
      scope: { kind: "setting", count: 1 },
      consequences: ["setting_changed", "skipped_accounts_reevaluated"],
      reversible: true,
    });
  });
});

describe("PD6: the weekly review", () => {
  it("refuses a span outside 1 to 53 ISO weeks before reading anything", async () => {
    const tx = {} as Transaction;
    for (const weeks of [0, -1, 1.5, DEGRADED_REVIEW_MAX_WEEKS + 1]) {
      await expect(degradedConfirmationsByWeek(tx, weeks)).rejects.toThrow(
        RangeError,
      );
    }
  });
});

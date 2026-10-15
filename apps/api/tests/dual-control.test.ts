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
import { DUAL_CONTROL_ACTION_CODES } from "../src/domains/backoffice/repository.ts";

const ACCOUNT = "00000000-0000-4000-8000-000000000001";

describe("PD1: the recap of each action, before the first gesture", () => {
  it("covers the closed list of the database, one object each", () => {
    expect([...DUAL_CONTROL_ACTION_CODES].sort()).toEqual([
      "identity.change_member_role",
      "identity.grant_role",
      "identity.invite_admin",
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
      }),
      dualControlRecap({
        code: "identity.invite_admin",
        invitationId: ACCOUNT,
      }),
    ]) {
      expect(recap.scope.count).toBe(1);
      expect(recap.consequences.length).toBeGreaterThan(0);
    }
  });

  it("says that a role change revokes the sessions and cannot be undone, and an admin invitation can", () => {
    expect(
      dualControlRecap({
        code: "identity.change_member_role",
        accountId: ACCOUNT,
        role: "advertiser",
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

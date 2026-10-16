// Contract of the invitations (15 RG99; 05 RG116 to RG119; 21 §J8 commit 7).
import { describe, expect, it } from "vitest";
import { backofficeInvitationAcceptBodySchema } from "../src/backoffice-auth.ts";
import { dualControlRequestSchema } from "../src/backoffice-actions.ts";
import {
  internalInvitationRequestSchema,
  memberInvitationRequestSchema,
} from "../src/backoffice-invitations.ts";
import { acquisitionSchema } from "../src/signup.ts";

const TOKEN = "A".repeat(43);

describe("invitations (J8 commit 7)", () => {
  it("an internal invitation proposes agent or admin only, with a typed reason", () => {
    expect(
      internalInvitationRequestSchema.parse({
        email: " New.Agent@Example.Test ",
        role: "agent",
        reasonCode: "new_team_member",
      }).email,
    ).toBe("new.agent@example.test");
    for (const body of [
      { email: "a@example.test", role: "creator", reasonCode: "new_team_member" },
      { email: "a@example.test", role: "agent", reasonCode: "because" },
    ]) {
      expect(internalInvitationRequestSchema.safeParse(body).success).toBe(false);
    }
  });

  it("05 RG116: a member invitation proposes advertiser or creator, in fr or en", () => {
    expect(
      memberInvitationRequestSchema.safeParse({
        email: "brand@example.test",
        proposedRole: "advertiser",
        preferredLanguage: "en",
      }).success,
    ).toBe(true);
    expect(
      memberInvitationRequestSchema.safeParse({
        email: "brand@example.test",
        proposedRole: "agent",
        preferredLanguage: "en",
      }).success,
    ).toBe(false);
  });

  it("05 RG119: a malformed invitation code is dropped, never a refusal of the sign-up", () => {
    expect(acquisitionSchema.parse({ invitationCode: TOKEN })).toEqual({
      invitationCode: TOKEN,
    });
    expect(acquisitionSchema.parse({ invitationCode: "short" })).toEqual({
      invitationCode: null,
    });
  });

  it("the acceptance requires the token, the address, a first name, a country and a language", () => {
    const body = {
      invitationToken: TOKEN,
      email: "a@example.test",
      password: "x",
      firstName: " Alex ",
      countryCode: "FR",
      preferredLanguage: "fr",
    };
    expect(backofficeInvitationAcceptBodySchema.parse(body).firstName).toBe(
      "Alex",
    );
    expect(
      backofficeInvitationAcceptBodySchema.safeParse({ ...body, firstName: "\u0007" })
        .success,
    ).toBe(false);
  });

  it("the 2V of an admin invitation can be requested again, with an invitation reason", () => {
    expect(
      dualControlRequestSchema.safeParse({
        code: "identity.invite_admin",
        invitationId: "00000000-0000-4000-8000-000000000000",
        reasonCode: "team_replacement",
      }).success,
    ).toBe(true);
  });
});

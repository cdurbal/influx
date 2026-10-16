// The secrets and links of the two invitations (15 RG99; 05 RG116; 21 §J8 commit 7; G-1 point 2).
import { describe, expect, it } from "vitest";
import {
  internalActivationLink,
  memberSignupLink,
  newInvitationSecret,
} from "../src/domains/backoffice/invitation-links.ts";
import { enrollmentTokenHashOf } from "../src/domains/identity/mfa-secrets.ts";

describe("invitation secrets and links (J8 commit 7)", () => {
  it("draws 32 random bytes whose digest is the one the enrollment reads (G-1 point 2)", () => {
    const first = newInvitationSecret();
    const second = newInvitationSecret();
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.token).not.toBe(second.token);
    expect(enrollmentTokenHashOf(first.token)?.equals(first.hash)).toBe(true);
  });

  it("puts the secret in the fragment of the activation page", () => {
    expect(internalActivationLink("https://bo.influx.test", "T")).toBe(
      "https://bo.influx.test/activation#T",
    );
  });

  it("opens the sign-up door of the proposed role, in the invitation's language (05 RG1, EC-15)", () => {
    const origin = "https://influx.test";
    expect(memberSignupLink(origin, "fr", "advertiser", "C")).toBe(
      "https://influx.test/fr/inscription/marque#invitation=C",
    );
    expect(memberSignupLink(origin, "fr", "creator", "C")).toBe(
      "https://influx.test/fr/inscription/createur#invitation=C",
    );
    expect(memberSignupLink(origin, "en", "advertiser", "C")).toBe(
      "https://influx.test/en/signup/brand#invitation=C",
    );
    expect(memberSignupLink(origin, "en", "creator", "C")).toBe(
      "https://influx.test/en/signup/creator#invitation=C",
    );
  });
});

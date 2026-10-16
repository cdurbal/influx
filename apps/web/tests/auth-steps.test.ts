// Screens 1 and 2 of the journey and the routing after the code (docs/mvp/17 §2.5, §2.6, §3.2;
// 05 RG42, RG66 to RG69, RG112, RG137; 21 EC-15), as plain functions.
import { describe, expect, it } from "vitest";
import {
  announcedSeconds,
  codeDigitsOf,
  codeFormMessage,
  contactFormMessage,
  emailFormMessage,
  requestMessage,
  verifyStepOf,
} from "@/components/auth/auth-steps";
import {
  homePageOf,
  MEMBER_PAGE_SLUGS,
  memberPageHref,
  memberPagePath,
  signupPageOf,
} from "@/lib/member-paths";

describe("emailFormMessage (05 RG11, RG112)", () => {
  it("asks for an address, a valid shape, 254 characters at most", () => {
    expect(emailFormMessage("  ")).toBe("required");
    expect(emailFormMessage("name@")).toBe("format");
    expect(emailFormMessage(`${"a".repeat(250)}@b.co`)).toBe("tooLong");
    expect(emailFormMessage(" Name+tag@Example.com ")).toBeNull();
  });
});

describe("requestMessage (17 §3.7)", () => {
  it("maps each outcome of request-code", () => {
    expect(requestMessage("sent")).toBeNull();
    expect(requestMessage("undeliverable")).toBe("undeliverable");
    expect(requestMessage("rate_limited")).toBe("rateLimited");
    expect(requestMessage("provider_unavailable")).toBe("serviceUnavailable");
  });
});

describe("the code field (17 §3.2)", () => {
  it("keeps six digits of a pasted code, nothing else", () => {
    expect(codeDigitsOf(" 123 456 ")).toBe("123456");
    expect(codeDigitsOf("12-34-56-78")).toBe("123456");
    expect(codeDigitsOf("abc")).toBe("");
  });

  it("checks the code before sending it", () => {
    expect(codeFormMessage("")).toEqual({ key: "required" });
    expect(codeFormMessage("12345")).toEqual({ key: "format" });
    expect(codeFormMessage("123456")).toBeNull();
  });

  it("announces the countdown every ten seconds and at the last one", () => {
    expect(announcedSeconds(60)).toBe(60);
    expect(announcedSeconds(59)).toBe(60);
    expect(announcedSeconds(41)).toBe(50);
    expect(announcedSeconds(2)).toBe(10);
    expect(announcedSeconds(1)).toBe(1);
    expect(announcedSeconds(0)).toBe(0);
  });
});

describe("verifyStepOf (17 §2.5; 05 RG66 to RG69, RG137)", () => {
  it("routes by the real role, with the notice only when a door was chosen (RG67)", () => {
    const signedIn = {
      outcome: "signed_in",
      role: "creator",
      roleMismatch: true,
    } as const;
    expect(verifyStepOf(signedIn, true)).toEqual({
      kind: "signedIn",
      role: "creator",
      roleMismatch: true,
    });
    expect(verifyStepOf(signedIn, false)).toEqual({
      kind: "signedIn",
      role: "creator",
      roleMismatch: false,
    });
  });

  it("opens screen 3 for an address without account, no session elsewhere", () => {
    expect(verifyStepOf({ outcome: "signup_required" }, true)).toEqual({
      kind: "signupRequired",
    });
    expect(verifyStepOf({ outcome: "internal_account" }, true)).toEqual({
      kind: "internal",
    });
    expect(verifyStepOf({ outcome: "account_unavailable" }, true)).toEqual({
      kind: "suspended",
    });
  });

  it("keeps the field after a wrong code, closes it after the fifth or a lost journey", () => {
    expect(verifyStepOf({ outcome: "invalid", attemptsLeft: 3 }, true)).toEqual(
      {
        kind: "codeError",
        message: { key: "invalid", remaining: 3 },
        closed: false,
      },
    );
    expect(verifyStepOf({ outcome: "too_many_attempts" }, true)).toMatchObject({
      closed: true,
    });
    expect(verifyStepOf({ outcome: "session_lost" }, true)).toMatchObject({
      closed: true,
    });
    expect(verifyStepOf({ outcome: "expired" }, true)).toMatchObject({
      closed: false,
    });
    expect(verifyStepOf({ outcome: "verify_unavailable" }, true)).toEqual({
      kind: "codeError",
      message: { key: "verifyUnavailable" },
      closed: false,
    });
  });
});

describe("member paths (17 §2.6; 21 EC-15)", () => {
  it("translates every segment by language", () => {
    expect(memberPagePath("signupAdvertiser", "fr")).toBe(
      "/fr/inscription/marque",
    );
    expect(memberPagePath("signupAdvertiser", "en")).toBe("/en/signup/brand");
    expect(memberPagePath("signupCreator", "fr")).toBe(
      "/fr/inscription/createur",
    );
    expect(memberPagePath("signupCreator", "en")).toBe("/en/signup/creator");
    expect(memberPagePath("signIn", "en")).toBe("/en/sign-in");
    expect(memberPageHref("advertiserHome", "en")).toBe("/brand");
    expect(memberPageHref("creatorHome", "fr")).toBe("/createur");
  });

  it("gives each page and language its own address", () => {
    const paths = Object.values(MEMBER_PAGE_SLUGS).flatMap((slugs) =>
      Object.values(slugs),
    );
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("sends each role to its own space, and each door to its own page", () => {
    expect(homePageOf("advertiser")).toBe("advertiserHome");
    expect(homePageOf("creator")).toBe("creatorHome");
    expect(signupPageOf(null)).toBe("signupDoors");
    expect(signupPageOf("advertiser")).toBe("signupAdvertiser");
    expect(signupPageOf("creator")).toBe("signupCreator");
  });
});

describe("contactFormMessage (05 RG65; 17 §3.3)", () => {
  it("asks for another valid address than the one that receives no code", () => {
    expect(contactFormMessage("me@example.com", "")).toBe("required");
    expect(contactFormMessage("me@example.com", "other@")).toBe("format");
    expect(contactFormMessage("me@example.com", " ME@Example.com ")).toBe(
      "same",
    );
    expect(
      contactFormMessage("me@example.com", "other@example.org"),
    ).toBeNull();
  });
});

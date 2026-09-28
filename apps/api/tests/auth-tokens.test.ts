// Short signed tokens of the authentication journeys (21 §4, J3-C rule 8; EC-3, EC-4, EC-24).
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createAuthTokenCodec,
  LOGIN_TOKEN_TTL_SECONDS,
  SIGNUP_TOKEN_TTL_SECONDS,
  type LoginTokenContent,
  type SignupTokenContent,
} from "../src/platform/auth-tokens.ts";
import { TOKEN_SIGNING_SECRET } from "./helpers.ts";

const NOW = new Date("2026-09-28T10:00:00Z");
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000);

const LOGIN: LoginTokenContent = {
  ref: "6f1c2b0e-4a7d-4c1e-9b3a-2d5e8f7a1c90",
  email: "someone@example.test",
  phrase: "harbour lantern",
};

const SIGNUP: SignupTokenContent = {
  verifiedAt: NOW_SECONDS,
  authUserId: "0b6f7d1e-2c3a-4e5f-8a9b-1c2d3e4f5a6b",
  email: "someone@example.test",
  door: "creator",
};

const codec = createAuthTokenCodec(TOKEN_SIGNING_SECRET);

function secondsLater(seconds: number): Date {
  return new Date(NOW.getTime() + seconds * 1000);
}

/** The signed part and the signature of a token. */
function partsOf(token: string): { payload: string; signature: string } {
  const separator = token.lastIndexOf(".");
  return {
    payload: token.slice(0, separator),
    signature: token.slice(separator + 1),
  };
}

/** A token of any content, signed with the right key: what a key leak would allow. */
function signedWith(secret: string, content: unknown): string {
  const payload = Buffer.from(JSON.stringify(content), "utf8").toString(
    "base64url",
  );
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("base64")
    .replace(/=/g, "");
  return `${payload}.${signature}`;
}

describe("login journey token (15 min)", () => {
  it("reads back what it issued, with its type, version and expiry", () => {
    const token = codec.issueLogin(LOGIN, NOW);
    expect(codec.readLogin(token, NOW)).toEqual({
      ...LOGIN,
      typ: "login",
      v: 1,
      exp: NOW_SECONDS + LOGIN_TOKEN_TTL_SECONDS,
    });
    expect(LOGIN_TOKEN_TTL_SECONDS).toBe(900);
  });

  it("expires with the value it signs, not with a cookie attribute", () => {
    const token = codec.issueLogin(LOGIN, NOW);
    expect(codec.readLogin(token, secondsLater(899))).not.toBeNull();
    expect(codec.readLogin(token, secondsLater(900))).toBeNull();
  });

  it("never carries a code: only the reference, the address and the phrase", () => {
    const token = codec.issueLogin(LOGIN, NOW);
    const content = JSON.parse(
      Buffer.from(partsOf(token).payload, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    expect(Object.keys(content).sort()).toEqual(
      ["email", "exp", "phrase", "ref", "typ", "v"].sort(),
    );
  });
});

describe("sign-up token (30 min, EC-4)", () => {
  it("reads back what it issued", () => {
    const token = codec.issueSignup(SIGNUP, NOW);
    expect(codec.readSignup(token, NOW)).toEqual({
      ...SIGNUP,
      typ: "signup",
      v: 1,
      exp: NOW_SECONDS + SIGNUP_TOKEN_TTL_SECONDS,
    });
    expect(codec.readSignup(token, secondsLater(1799))).not.toBeNull();
    expect(codec.readSignup(token, secondsLater(1800))).toBeNull();
  });
});

describe("refusals", () => {
  it("never accepts a login token as a sign-up token, nor the reverse", () => {
    expect(codec.readSignup(codec.issueLogin(LOGIN, NOW), NOW)).toBeNull();
    expect(codec.readLogin(codec.issueSignup(SIGNUP, NOW), NOW)).toBeNull();
  });

  it("refuses a token altered by one character, in its content or its signature", () => {
    const token = codec.issueLogin(LOGIN, NOW);
    const { payload, signature } = partsOf(token);
    const flip = (text: string, index: number) =>
      `${text.slice(0, index)}${text[index] === "A" ? "B" : "A"}${text.slice(index + 1)}`;
    expect(codec.readLogin(`${flip(payload, 5)}.${signature}`, NOW)).toBeNull();
    expect(codec.readLogin(`${payload}.${flip(signature, 0)}`, NOW)).toBeNull();
    expect(codec.readLogin(`${payload}.`, NOW)).toBeNull();
    expect(codec.readLogin(payload, NOW)).toBeNull();
  });

  it("refuses a token signed with another key (a rotation loses the journeys in progress)", () => {
    const other = createAuthTokenCodec(
      "another-signing-secret-for-tests-0123456789",
    );
    expect(codec.readLogin(other.issueLogin(LOGIN, NOW), NOW)).toBeNull();
  });

  it("refuses an absent, empty or oversized value", () => {
    expect(codec.readLogin(undefined, NOW)).toBeNull();
    expect(codec.readLogin("", NOW)).toBeNull();
    expect(codec.readLogin("a".repeat(2_049), NOW)).toBeNull();
  });

  it.each<[string, Record<string, unknown>]>([
    ["another version", { typ: "login", v: 2, exp: NOW_SECONDS + 60 }],
    [
      "an unknown field",
      { typ: "login", v: 1, exp: NOW_SECONDS + 60, code: "123456" },
    ],
    ["an expiry in the past", { typ: "login", v: 1, exp: NOW_SECONDS - 1 }],
    [
      "a reference that is not a uuid v4",
      { typ: "login", v: 1, exp: NOW_SECONDS + 60, ref: "1" },
    ],
  ])("refuses a correctly signed token with %s", (_case, content) => {
    const token = signedWith(TOKEN_SIGNING_SECRET, { ...LOGIN, ...content });
    expect(codec.readLogin(token, NOW)).toBeNull();
  });

  it("refuses a correctly signed value that is not JSON", () => {
    const payload = Buffer.from("not json", "utf8").toString("base64url");
    const signature = createHmac("sha256", TOKEN_SIGNING_SECRET)
      .update(payload)
      .digest("base64")
      .replace(/=/g, "");
    expect(codec.readLogin(`${payload}.${signature}`, NOW)).toBeNull();
  });

  it("keeps type, version and expiry even if the content tries to set them", () => {
    const forged = {
      ...LOGIN,
      typ: "signup",
      exp: NOW_SECONDS + 999_999,
    } as unknown as LoginTokenContent;
    const token = codec.issueLogin(forged, NOW);
    expect(codec.readLogin(token, NOW)?.exp).toBe(
      NOW_SECONDS + LOGIN_TOKEN_TTL_SECONDS,
    );
    expect(codec.readSignup(token, NOW)).toBeNull();
  });
});

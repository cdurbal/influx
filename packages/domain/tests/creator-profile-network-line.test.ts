import { describe, expect, it } from "vitest";
import {
  checkProfileUrl,
  handleKey,
  normalizeHandle,
  normalizePseudonym,
} from "../src/creator-profile/index.ts";

const INSTAGRAM = ["instagram.com"];
const FACEBOOK = ["facebook.com", "fb.com"];

describe("L2D-U3 profile URL of a network line (RG43, CA12)", () => {
  it("accepts the host of the network and its subdomains", () => {
    expect(
      checkProfileUrl("https://instagram.com/maison.aube", INSTAGRAM),
    ).toEqual({ ok: true, url: "https://instagram.com/maison.aube" });
    expect(
      checkProfileUrl("https://www.instagram.com/maison.aube", INSTAGRAM).ok,
    ).toBe(true);
    expect(checkProfileUrl("https://fb.com/maison", FACEBOOK).ok).toBe(true);
    expect(
      checkProfileUrl("https://WWW.Instagram.COM:443/maison", INSTAGRAM).ok,
    ).toBe(true);
  });

  it("refuses an Instagram line whose URL points to TikTok with a message of its own", () => {
    expect(
      checkProfileUrl("https://www.tiktok.com/@maison.aube", INSTAGRAM),
    ).toEqual({ ok: false, reason: "wrong_network" });
  });

  it("refuses a host that only ends like the network's host", () => {
    expect(checkProfileUrl("https://notinstagram.com/x", INSTAGRAM)).toEqual({
      ok: false,
      reason: "wrong_network",
    });
    expect(
      checkProfileUrl("https://instagram.com.evil.example/x", INSTAGRAM),
    ).toEqual({ ok: false, reason: "wrong_network" });
    expect(
      checkProfileUrl("https://evil.example/?u=instagram.com", INSTAGRAM),
    ).toEqual({ ok: false, reason: "wrong_network" });
  });

  it("refuses an authority that is not a plain host name, as a browser would read it (L2DS-1)", () => {
    for (const url of [
      "https://evil.example\\.instagram.com/x",
      "https://evil.example%5C.instagram.com/x",
      "https://evil.example%5c.instagram.com/x",
      "https://[::1]/x",
      "https://instagram.com:/x",
      "https://instagram.com:123456/x",
    ]) {
      expect(checkProfileUrl(url, INSTAGRAM)).toEqual({
        ok: false,
        reason: "invalid_shape",
      });
      expect(checkProfileUrl(url, []).ok).toBe(false);
    }
    expect(
      checkProfileUrl("https://www.instagram.com:8443/maison", INSTAGRAM),
    ).toEqual({ ok: true, url: "https://www.instagram.com:8443/maison" });
  });

  it("leaves a network without any listed host free (07 l. 289)", () => {
    expect(checkProfileUrl("https://exemple.org/moi", []).ok).toBe(true);
  });

  it("refuses what is not an https address with a host, as the database does", () => {
    const refusal = (url: string) => {
      const result = checkProfileUrl(url, []);
      return result.ok ? null : result.reason;
    };
    expect(refusal("")).toBe("empty");
    expect(refusal("   ")).toBe("empty");
    expect(refusal("http://instagram.com/x")).toBe("invalid_shape");
    expect(refusal("instagram.com/x")).toBe("invalid_shape");
    expect(refusal("https://instagram.com/a b")).toBe("invalid_shape");
    expect(refusal("https://instagram.com/a\nb")).toBe("invalid_shape");
    expect(refusal("https:///path")).toBe("no_host");
    expect(refusal("https://user:secret@instagram.com/x")).toBe("credentials");
    expect(refusal(`https://exemple.org/${"a".repeat(500)}`)).toBe("too_long");
  });

  it("returns the URL outside its margins", () => {
    expect(
      checkProfileUrl("  https://instagram.com/maison  ", INSTAGRAM),
    ).toEqual({ ok: true, url: "https://instagram.com/maison" });
  });
});

describe("L2D-U3 handle and pseudonym (RG30, RG42, RG44)", () => {
  it("keeps a handle outside its margins, up to 100 characters", () => {
    expect(normalizeHandle("  @maison.aube ")).toEqual({
      ok: true,
      value: "@maison.aube",
    });
    expect(normalizeHandle("a".repeat(100)).ok).toBe(true);
    expect(normalizeHandle("a".repeat(101))).toEqual({
      ok: false,
      reason: "too_long",
    });
  });

  it("refuses an empty handle and a control character", () => {
    expect(normalizeHandle("   ")).toEqual({ ok: false, reason: "empty" });
    expect(normalizeHandle("maison\naube")).toEqual({
      ok: false,
      reason: "invalid_characters",
    });
  });

  it("counts characters as a person does, not code units", () => {
    expect(normalizeHandle("😀".repeat(100)).ok).toBe(true);
    expect(normalizeHandle("😀".repeat(101)).ok).toBe(false);
  });

  it("keeps a pseudonym to 60 characters", () => {
    expect(normalizePseudonym("a".repeat(60)).ok).toBe(true);
    expect(normalizePseudonym("a".repeat(61))).toEqual({
      ok: false,
      reason: "too_long",
    });
  });

  it("compares handles of one network by case only", () => {
    expect(handleKey(" Maison.Aube ")).toBe(handleKey("maison.aube"));
    expect(handleKey("maison.aube")).not.toBe(handleKey("maison_aube"));
  });
});

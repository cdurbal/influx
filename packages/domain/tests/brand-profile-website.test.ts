import { describe, expect, it } from "vitest";
import { normalizeWebsiteDomain } from "../src/brand-profile/index.ts";

describe("CA4 and RG17 website reduced to a domain", () => {
  it("reduces the address of the acceptance case to its domain, and says it was reduced", () => {
    expect(
      normalizeWebsiteDomain("https://exemple.com/contact?utm=abc"),
    ).toEqual({ ok: true, domain: "exemple.com", reduced: true });
  });

  it("drops protocol, path, parameter, anchor, port and credentials", () => {
    for (const typed of [
      "http://exemple.com",
      "//exemple.com/a/b",
      "exemple.com/a",
      "exemple.com?x=1",
      "exemple.com#top",
      "exemple.com:8080",
      "https://user:secret@exemple.com:443/x",
      "EXEMPLE.com.",
      "  https://Exemple.COM/  ",
    ]) {
      expect(normalizeWebsiteDomain(typed)).toMatchObject({
        ok: true,
        domain: "exemple.com",
        reduced: true,
      });
    }
  });

  it("keeps a bare domain as typed, unreduced", () => {
    expect(normalizeWebsiteDomain("exemple.com")).toEqual({
      ok: true,
      domain: "exemple.com",
      reduced: false,
    });
    expect(normalizeWebsiteDomain("shop.maison-aube.co.uk")).toMatchObject({
      ok: true,
      domain: "shop.maison-aube.co.uk",
    });
  });

  it("accepts an international domain name as typed", () => {
    expect(normalizeWebsiteDomain("https://café.fr/menu")).toMatchObject({
      ok: true,
      domain: "café.fr",
    });
  });
});

describe("edge case 2 invalid host refused", () => {
  it("refuses an empty value with its own reason", () => {
    expect(normalizeWebsiteDomain("   ")).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("refuses what holds no valid host", () => {
    for (const typed of [
      "localhost",
      "https://localhost:3000",
      "192.168.0.1",
      "http://10.0.0.1/admin",
      "[::1]",
      "exemple",
      "exem ple.com",
      "-exemple.com",
      "exemple-.com",
      "exemple..com",
      ".com",
      "exemple.c",
      "exe_mple.com",
      "javascript:alert(1)",
      "mailto:contact@exemple.com",
      "data:text/html,<b>x</b>",
      "https://",
      "https:///path",
      `${"a".repeat(64)}.com`,
    ]) {
      expect(normalizeWebsiteDomain(typed), typed).toEqual({
        ok: false,
        reason: "invalid_host",
      });
    }
  });

  it("refuses a domain over 100 characters", () => {
    const label = "a".repeat(60);
    expect(normalizeWebsiteDomain(`${label}.${label}.com`)).toEqual({
      ok: false,
      reason: "too_long",
    });
    expect(
      normalizeWebsiteDomain(`${"a".repeat(60)}.${"b".repeat(35)}.com`),
    ).toMatchObject({ ok: true });
  });
});

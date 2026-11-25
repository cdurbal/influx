import { describe, expect, it } from "vitest";
import {
  CONTACT_SIGNALS,
  detectDirectContact,
  isUnusualWebsiteDomain,
  PHONE_MIN_DIGITS,
} from "../src/brand-profile/index.ts";

describe("RG19 the direct contacts of a public text are signalled", () => {
  it("signals an e-mail address, also spelled out", () => {
    expect(detectDirectContact("Écrivez à contact@maison-aube.fr")).toEqual([
      "email",
    ]);
    expect(detectDirectContact("contact [at] maison-aube [dot] fr")).toEqual([
      "email",
    ]);
    expect(detectDirectContact("nom (arobase) exemple point fr")).toEqual([
      "email",
    ]);
  });

  it("signals a link, a bare domain and a link written without scheme", () => {
    expect(
      detectDirectContact("Voir https://maison-aube.fr/contact"),
    ).toContain("url");
    expect(detectDirectContact("www.maison-aube.fr")).toEqual([
      "url",
      "domain",
    ]);
    expect(detectDirectContact("Notre site : maison-aube.fr")).toEqual([
      "domain",
    ]);
    expect(detectDirectContact("SHOP.MAISON.COM")).toEqual(["domain"]);
    expect(detectDirectContact("wa.me/33612345678")).toContain("url");
  });

  it("signals a telephone number from 8 digits, whatever its separators", () => {
    expect(PHONE_MIN_DIGITS).toBe(8);
    for (const text of [
      "Appelez le 06 12 34 56 78",
      "+33 (0)6.12.34.56.78",
      "tel 0612345678",
      "+1-415-555-0100",
      "٠٦١٢٣٤٥٦٧٨",
    ]) {
      expect(detectDirectContact(text), text).toContain("phone");
    }
    expect(
      detectDirectContact("Fondée en 1998, 120 salariés, 12 000 clients"),
    ).toEqual([]);
  });

  it("signals a handle and a messenger, but not an e-mail as a handle", () => {
    expect(detectDirectContact("Suivez-nous @maison_aube")).toEqual(["handle"]);
    expect(
      detectDirectContact("Ajoutez-nous sur WhatsApp ou Telegram"),
    ).toEqual(["messenger"]);
    expect(detectDirectContact("a@b.fr")).toEqual(["email"]);
    // the local part of an address is no domain, whatever its dots
    expect(detectDirectContact("secret.contact@exemple.test")).toEqual([
      "email",
    ]);
  });

  it("returns each signal once, in the closed order", () => {
    const all = detectDirectContact(
      "x@y.fr https://y.fr y.fr 06 12 34 56 78 @yy whatsapp",
    );
    expect(all).toEqual([...CONTACT_SIGNALS]);
    expect(detectDirectContact("a@b.fr c@d.fr")).toEqual(["email"]);
  });

  it("leaves an ordinary presentation alone, a missing space after a full stop included", () => {
    expect(detectDirectContact(null)).toEqual([]);
    expect(detectDirectContact("   ")).toEqual([]);
    expect(
      detectDirectContact(
        "Nous créons du matériel durable.Nous cherchons des créateurs sportifs, e.g. trail ou vélo. S.A.S. fondée en 2012.",
      ),
    ).toEqual([]);
  });

  it("never returns the text that matched", () => {
    const signals = detectDirectContact("secret@exemple.fr");
    expect(JSON.stringify(signals)).not.toContain("secret");
  });
});

describe("L2BS-8 an unusual website domain is an alert, never a refusal", () => {
  it("flags a non-ASCII domain and a punycode one", () => {
    expect(isUnusualWebsiteDomain("maisôn-aube.fr")).toBe(true);
    expect(isUnusualWebsiteDomain("аpple.com")).toBe(true);
    expect(isUnusualWebsiteDomain("xn--maisn-aube-1db.fr")).toBe(true);
    expect(isUnusualWebsiteDomain("shop.xn--80ak6aa92e.com")).toBe(true);
  });

  it("leaves a plain ASCII domain, and an empty one, alone", () => {
    expect(isUnusualWebsiteDomain("maison-aube.fr")).toBe(false);
    expect(isUnusualWebsiteDomain("axn--b.fr")).toBe(false);
    expect(isUnusualWebsiteDomain("")).toBe(false);
    expect(isUnusualWebsiteDomain(null)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  detectDirectContact as detectFromBrand,
  isUnusualWebsiteDomain,
} from "../src/brand-profile/index.ts";
import {
  detectDirectContact,
  locateDirectContact,
} from "../src/creator-profile/index.ts";

describe("L2D-U6 the detection is shared between brand and creator (07 RG27, RG28)", () => {
  it("is the very function of the brand side, behaviour unchanged", () => {
    expect(detectFromBrand).toBe(detectDirectContact);
    expect(typeof isUnusualWebsiteDomain).toBe("function");
  });

  it("signals the pseudonym of a creator in a bio", () => {
    expect(detectDirectContact("Retrouvez-moi sur @maison.aube")).toEqual([
      "handle",
    ]);
    expect(
      detectDirectContact("Écrivez à moi@exemple.fr ou au +33 6 12 34 56 78"),
    ).toEqual(["email", "phone"]);
    expect(detectDirectContact("Contenu beauté, ton posé.")).toEqual([]);
  });

  it("gives the type and the position of a finding, never its text", () => {
    const text = "Ecrivez moi@exemple.fr";
    const found = locateDirectContact(text);
    expect(found.map((f) => f.signal)).toEqual(["email"]);
    expect(found[0]).toEqual({ signal: "email", start: 8, end: 22 });
    for (const finding of found) {
      expect(Object.keys(finding).sort()).toEqual(["end", "signal", "start"]);
    }
  });

  it("lists every occurrence in the order of the text", () => {
    const text = "@aube puis @lune, ou www.exemple.fr";
    const found = locateDirectContact(text);
    expect(found.map((f) => [f.signal, f.start, f.end])).toEqual([
      ["handle", 0, 5],
      ["handle", 11, 16],
      ["url", 21, 25],
      ["domain", 21, 35],
    ]);
  });

  it("reports positions in the text as typed, not in its normalised form", () => {
    const text = "ｔｏｉ ｍｏｉ@exemple.fr";
    const found = locateDirectContact(text);
    expect(found).toHaveLength(1);
    const [finding] = found;
    expect(finding?.signal).toBe("email");
    expect(text.slice(finding?.start, finding?.end)).toBe("ｍｏｉ@exemple.fr");
  });

  it("finds the same signals as detectDirectContact, and nothing in an empty text", () => {
    const sample =
      "contact [at] maison [dot] fr, WhatsApp, https://x.example, @pseudo, 01 02 03 04 05";
    const kinds = new Set(locateDirectContact(sample).map((f) => f.signal));
    expect([...kinds].sort()).toEqual([...detectDirectContact(sample)].sort());
    expect(locateDirectContact("")).toEqual([]);
    expect(locateDirectContact(null)).toEqual([]);
    expect(locateDirectContact("   ")).toEqual([]);
  });
});

// 05 RG128 to RG134, CA73: the word lists and the draw of the matching phrase.
import { UI_LOCALES } from "@influx/contracts/auth";
import { describe, expect, it } from "vitest";
import { drawMatchingPhrase } from "../src/domains/identity/matching-phrase.ts";
import { MATCHING_PHRASE_WORDS } from "../src/domains/identity/matching-phrase-words.ts";

/** RG133 point 2: lower-case letters of the language; French accents allowed, no ligature. */
const ALLOWED_LETTERS = {
  fr: /^[a-zàâäçéèêëîïôöùûüÿ]{3,7}$/u,
  en: /^[a-z]{3,7}$/,
} as const;

function withoutAccents(word: string): string {
  return word.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Levenshtein distance (insertion, deletion, substitution). */
function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      const substitution =
        (previous[j - 1] ?? 0) + (left[i - 1] === right[j - 1] ? 0 : 1);
      current.push(
        Math.min(
          (previous[j] ?? 0) + 1,
          (current[j - 1] ?? 0) + 1,
          substitution,
        ),
      );
    }
    previous = current;
  }
  return previous[right.length] ?? 0;
}

describe.each(UI_LOCALES)("RG133 on the %s list (CA73)", (locale) => {
  const words = MATCHING_PHRASE_WORDS[locale];

  it("holds 256 words, without duplicate (criterion 1)", () => {
    expect(words).toHaveLength(256);
    expect(new Set(words).size).toBe(256);
  });

  it("holds words of 3 to 7 allowed letters only (criterion 2)", () => {
    expect(words.filter((word) => !ALLOWED_LETTERS[locale].test(word))).toEqual(
      [],
    );
  });

  it("keeps every pair at an edit distance of 2 at least, accents removed (criterion 3)", () => {
    const plain = words.map(withoutAccents);
    const tooClose: string[] = [];
    for (let i = 0; i < plain.length; i += 1) {
      for (let j = i + 1; j < plain.length; j += 1) {
        if (editDistance(plain[i] ?? "", plain[j] ?? "") < 2) {
          tooClose.push(`${words[i]} / ${words[j]}`);
        }
      }
    }
    expect(tooClose).toEqual([]);
  });
});

describe("the draw of the phrase (RG128, RG132)", () => {
  it("gives two distinct words of the page's list, in lower case, separated by a space", () => {
    for (const locale of UI_LOCALES) {
      for (let run = 0; run < 200; run += 1) {
        const phrase = drawMatchingPhrase(locale);
        const parts = phrase.split(" ");
        expect(parts).toHaveLength(2);
        const [first = "", second = ""] = parts;
        expect(first).not.toBe(second);
        expect(MATCHING_PHRASE_WORDS[locale]).toContain(first);
        expect(MATCHING_PHRASE_WORDS[locale]).toContain(second);
        expect(phrase).toBe(phrase.toLowerCase());
      }
    }
  });

  it("draws the second word among the 255 others, uniformly (the first word is skipped)", () => {
    const words = MATCHING_PHRASE_WORDS.en;
    // First index 10; offsets 9, 10 and 254 map to words 9, 11 and 255.
    const draws = (offset: number) => {
      const indexes = [10, offset];
      return drawMatchingPhrase("en", () => indexes.shift() ?? 0);
    };
    expect(draws(9)).toBe(`${words[10]} ${words[9]}`);
    expect(draws(10)).toBe(`${words[10]} ${words[11]}`);
    expect(draws(254)).toBe(`${words[10]} ${words[255]}`);
  });

  it("asks the random source for 256 then 255 possibilities", () => {
    const bounds: number[] = [];
    drawMatchingPhrase("fr", (max) => {
      bounds.push(max);
      return 0;
    });
    expect(bounds).toEqual([256, 255]);
  });
});

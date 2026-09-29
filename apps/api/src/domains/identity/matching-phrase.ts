// The matching phrase (docs/mvp/05 RG128 to RG132; 03 A-6): two distinct words of the closed
// list of the PAGE's language, drawn with node:crypto, in lower case, separated by a space. It is
// never derived from the address, the account, the time, the code or a counter.
import type { UiLocale } from "@influx/contracts/auth";
import { randomInt } from "node:crypto";
import { MATCHING_PHRASE_WORDS } from "./matching-phrase-words.ts";

/** Draws a uniform index below `max`; injectable for the tests only. */
export type RandomIndex = (max: number) => number;

export function drawMatchingPhrase(
  locale: UiLocale,
  randomIndex: RandomIndex = randomInt,
): string {
  const words = MATCHING_PHRASE_WORDS[locale];
  const first = randomIndex(words.length);
  // RG128: the second word is uniform among the 255 others.
  const offset = randomIndex(words.length - 1);
  const second = offset >= first ? offset + 1 : offset;
  const firstWord = words[first];
  const secondWord = words[second];
  if (firstWord === undefined || secondWord === undefined) {
    throw new Error("matching phrase index out of range");
  }
  return `${firstWord} ${secondWord}`;
}

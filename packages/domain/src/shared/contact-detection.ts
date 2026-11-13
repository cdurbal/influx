// What a moderator is told about the public texts of a brand or a creator (docs/mvp/06 RG19; 07 RG27,
// RG28; jalons/l2c/file.md A7; L2BS-8). Pure, computed at the read, never stored, never a refusal: the
// detection SIGNALS and the moderator decides (RG19). No list of countries, registries or domain
// suffixes: a signal is a shape, and a false alarm costs one look where a miss costs a published
// contact (RG19, D40, D46). The output is a closed set of codes, and positions at most: the text that
// matched is never returned (nothing to log, 07 RG28). Shared by the brand and the creator profile.

/** What a public text may hold that RG19 forbids (a postal address is not detected, A7). */
export const CONTACT_SIGNALS = [
  "email",
  "url",
  "domain",
  "phone",
  "handle",
  "messenger",
] as const;

export type ContactSignal = (typeof CONTACT_SIGNALS)[number];

/** Digits (any script) a number needs to count as a telephone number (A7: 8 or more). */
export const PHONE_MIN_DIGITS = 8;

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu;
/** `name [at] host (dot) com`, `name (arobase) host`: an address written to dodge the filters. */
const SPELLED_EMAIL = /[[(]\s*(?:at|arobase)\s*[\])]|[[(]\s*dot\s*[\])]/giu;
const URL_SCHEME =
  /(?:\b[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\b(?:mailto|tel|sms|wa\.me|t\.me)[:/])/giu;
/**
 * A bare domain: labels, a dot, a suffix of letters in one case (`maison-aube.fr`, `MAISON.FR`).
 * `activité.Nous` (a missing space after a full stop) has a capitalised suffix: not a domain.
 */
const BARE_DOMAIN =
  /(?<![\p{L}\p{N}@.-])[\p{L}\p{N}][\p{L}\p{N}-]*(?:\.[\p{L}\p{N}][\p{L}\p{N}-]*)*\.(?:\p{Ll}{2,24}|\p{Lu}{2,24})(?![\p{L}\p{N}@])/gu;
const PHONE_RUN = /\+?\p{Nd}(?:[\p{Nd}\s.\-()/]{6,}\p{Nd})/gu;
const HANDLE = /(?<![\p{L}\p{N}_.@])@[\p{L}\p{N}_.]{2,}/gu;
const MESSENGER =
  /\b(?:whats\s?app|telegram|skype|wechat|discord|snap\s?chat|viber|messenger)\b/giu;

function digitCount(run: string): number {
  return (run.match(/\p{Nd}/gu) ?? []).length;
}

/** Where a signal was found: a code and a range, never the text itself. */
export type ContactFinding = {
  readonly signal: ContactSignal;
  /** First UTF-16 code unit of the range, in the text as it was typed. */
  readonly start: number;
  /** Code unit after the last one of the range. */
  readonly end: number;
};

type Range = readonly [start: number, end: number];

/** Every range of the normalised text where a signal shows, signals in the order of CONTACT_SIGNALS. */
function scan(typed: string): { signal: ContactSignal; range: Range }[] {
  const found: { signal: ContactSignal; range: Range }[] = [];
  const add = (
    signal: ContactSignal,
    pattern: RegExp,
    keep: (match: string) => boolean = () => true,
  ): void => {
    for (const match of typed.matchAll(pattern)) {
      if (keep(match[0])) {
        found.push({
          signal,
          range: [match.index, match.index + match[0].length],
        });
      }
    }
  };
  add("email", EMAIL);
  add("email", SPELLED_EMAIL);
  add("url", URL_SCHEME);
  add("domain", BARE_DOMAIN);
  add("phone", PHONE_RUN, (run) => digitCount(run) >= PHONE_MIN_DIGITS);
  add("handle", HANDLE);
  add("messenger", MESSENGER);
  return found;
}

/**
 * The direct-contact signals of one public text, in the order of CONTACT_SIGNALS, each once. An
 * empty or absent text has none.
 */
export function detectDirectContact(
  text: string | null | undefined,
): readonly ContactSignal[] {
  if (text === null || text === undefined || text.trim() === "") {
    return [];
  }
  const found = new Set(scan(text.normalize("NFKC")).map((hit) => hit.signal));
  return CONTACT_SIGNALS.filter((signal) => found.has(signal));
}

/**
 * For each code unit of the normalised text, the range of the typed text it comes from. Built per
 * grapheme (a composition never crosses one); when the pieces do not add up to the normalised text,
 * the offsets are clamped to the typed text instead, which is still inside it.
 */
function originsOf(text: string, typed: string): Range[] {
  const origins: Range[] = [];
  let rebuilt = "";
  for (const { segment, index } of new Intl.Segmenter().segment(text)) {
    const chunk = segment.normalize("NFKC");
    rebuilt += chunk;
    for (let unit = 0; unit < chunk.length; unit += 1) {
      origins.push([index, index + segment.length]);
    }
  }
  if (rebuilt === typed) return origins;
  return Array.from({ length: typed.length }, (_, unit): Range => [
    Math.min(unit, text.length),
    Math.min(unit + 1, text.length),
  ]);
}

/**
 * Every place a signal shows in a public text (07 RG28: the type and the position, never the text),
 * in the order of the text. Positions are in the text as it was typed. An empty or absent text has
 * none. The same signals as detectDirectContact, each as often as it occurs.
 */
export function locateDirectContact(
  text: string | null | undefined,
): readonly ContactFinding[] {
  if (text === null || text === undefined || text.trim() === "") {
    return [];
  }
  const typed = text.normalize("NFKC");
  const origins = originsOf(text, typed);
  return scan(typed)
    .map(({ signal, range: [from, to] }): ContactFinding => {
      const first = origins[from] ?? [text.length, text.length];
      const last = origins[to - 1] ?? first;
      return { signal, start: first[0], end: last[1] };
    })
    .sort(
      (a, b) =>
        a.start - b.start ||
        a.end - b.end ||
        CONTACT_SIGNALS.indexOf(a.signal) - CONTACT_SIGNALS.indexOf(b.signal),
    );
}

/**
 * Where a detector of another shape (a campaign amount, 09 RG23) found something: it reads the
 * normalised text and returns ranges in it, which come back as ranges of the text as it was typed,
 * the same way locateDirectContact does. Positions only, never the text.
 */
export function locateInNormalised(
  text: string | null | undefined,
  find: (normalised: string) => readonly Range[],
): readonly { readonly start: number; readonly end: number }[] {
  if (text === null || text === undefined || text.trim() === "") {
    return [];
  }
  const typed = text.normalize("NFKC");
  const origins = originsOf(text, typed);
  return find(typed).map(([from, to]) => {
    const first = origins[from] ?? [text.length, text.length];
    const last = origins[to - 1] ?? first;
    return { start: first[0], end: last[1] };
  });
}

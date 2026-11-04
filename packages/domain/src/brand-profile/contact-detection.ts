// What a moderator is told about the public texts of a brand (docs/mvp/06 RG19; jalons/l2c/file.md
// A7; L2BS-8). Pure, computed at the read, never stored, never a refusal: the detection SIGNALS and
// the moderator decides (RG19). No list of countries, registries or domain suffixes: a signal is a
// shape, and a false alarm costs one look where a miss costs a published contact (RG19, D40, D46).
// The output is a closed set of codes: the text that matched is never returned (nothing to log).

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

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/u;
/** `name [at] host (dot) com`, `name (arobase) host`: an address written to dodge the filters. */
const SPELLED_EMAIL = /[[(]\s*(?:at|arobase)\s*[\])]|[[(]\s*dot\s*[\])]/iu;
const URL_SCHEME =
  /(?:\b[a-z][a-z0-9+.-]*:\/\/|\bwww\.|\b(?:mailto|tel|sms|wa\.me|t\.me)[:/])/iu;
/**
 * A bare domain: labels, a dot, a suffix of letters in one case (`maison-aube.fr`, `MAISON.FR`).
 * `activité.Nous` (a missing space after a full stop) has a capitalised suffix: not a domain.
 */
const BARE_DOMAIN =
  /(?<![\p{L}\p{N}@.-])[\p{L}\p{N}][\p{L}\p{N}-]*(?:\.[\p{L}\p{N}][\p{L}\p{N}-]*)*\.(?:\p{Ll}{2,24}|\p{Lu}{2,24})(?![\p{L}\p{N}@])/u;
const PHONE_RUN = /\+?\p{Nd}(?:[\p{Nd}\s.\-()/]{6,}\p{Nd})/gu;
const HANDLE = /(?<![\p{L}\p{N}_.@])@[\p{L}\p{N}_.]{2,}/u;
const MESSENGER =
  /\b(?:whats\s?app|telegram|skype|wechat|discord|snap\s?chat|viber|messenger)\b/iu;

function digitCount(run: string): number {
  return (run.match(/\p{Nd}/gu) ?? []).length;
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
  const typed = text.normalize("NFKC");
  const found = new Set<ContactSignal>();
  if (EMAIL.test(typed) || SPELLED_EMAIL.test(typed)) found.add("email");
  if (URL_SCHEME.test(typed)) found.add("url");
  if (BARE_DOMAIN.test(typed)) found.add("domain");
  if ((typed.match(PHONE_RUN) ?? []).some((run) => digitCount(run) >= 8)) {
    found.add("phone");
  }
  if (HANDLE.test(typed)) found.add("handle");
  if (MESSENGER.test(typed)) found.add("messenger");
  return CONTACT_SIGNALS.filter((signal) => found.has(signal));
}

/**
 * L2BS-8: a website domain that is not plain ASCII, or an internationalised one written as
 * punycode (`xn--`), can pass for another brand's domain (a homograph). An alert, never a refusal.
 */
export function isUnusualWebsiteDomain(
  domain: string | null | undefined,
): boolean {
  if (domain === null || domain === undefined || domain === "") {
    return false;
  }
  return /[^ -~]/u.test(domain) || /(?:^|\.)xn--/i.test(domain);
}

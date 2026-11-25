// A verification opened by an agent, and the proof of a brand by its login address (decision D83, A and
// A-bis; docs/mvp/06 RG51; jalons/l2f/modele.md §1 point 14, §6, l2f/textes.md « Ouverture »,
// « Messageries grand public »; 0234). The reason of the agent is a closed list (`opening_reasons`);
// the consumer mailboxes are a table that only a migration extends: a login address on one of them, or
// on one of their subdomains, never proves the domain of a brand. The sentences are the translation
// files', by code; the backoffice speaks French only (D36).

/** Who opened a request (`verification_requests.opened_by`, 0234). */
export const VERIFICATION_OPENERS = ["member", "agent"] as const;
export type VerificationOpener = (typeof VERIFICATION_OPENERS)[number];

/** `verification.opening_reasons` (0234), in the order of `position`; `other` asks for a comment (1 to 1 000). */
export const OPENING_REASONS = [
  { code: "invited_by_agent", requiresComment: false },
  { code: "existing_client", requiresComment: false },
  { code: "past_collaboration", requiresComment: false },
  { code: "other", requiresComment: true },
] as const;
export type OpeningReasonCode = (typeof OPENING_REASONS)[number]["code"];

/** `verification.ownership_codes.observed_channel` (0234): the two ways a code is found, and the login address (A-bis). */
export const OBSERVED_CHANNELS = [
  "dns_txt",
  "web_page",
  "login_address",
] as const;
export type ObservedChannel = (typeof OBSERVED_CHANNELS)[number];

/**
 * `verification.consumer_email_domains` (0234), in the order of the annexe `l2f/textes.md`: the
 * messageries a person holds in his own name, which prove nothing about a company. Lower case, no `@`.
 */
export const CONSUMER_EMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.fr",
  "hotmail.com",
  "hotmail.fr",
  "live.com",
  "live.fr",
  "msn.com",
  "yahoo.com",
  "yahoo.fr",
  "ymail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "gmx.com",
  "gmx.de",
  "gmx.fr",
  "gmx.net",
  "web.de",
  "t-online.de",
  "mail.com",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
  "mail.ru",
  "orange.fr",
  "wanadoo.fr",
  "free.fr",
  "sfr.fr",
  "laposte.net",
  "libero.it",
  "qq.com",
  "163.com",
  "naver.com",
  "fastmail.com",
  "tutanota.com",
  "hey.com",
  "seznam.cz",
  "btinternet.com",
  "comcast.net",
] as const;

/**
 * Whether the domain of a login address is a consumer mailbox, or a subdomain of one (EC-L2F-09-6).
 * The domain is read from the verified address by the database and never typed; this is the same
 * comparison, for a screen that must word it.
 */
export function isConsumerEmailDomain(domain: string): boolean {
  const lowered = domain.trim().toLowerCase();
  return CONSUMER_EMAIL_DOMAINS.some(
    (consumer) => lowered === consumer || lowered.endsWith(`.${consumer}`),
  );
}

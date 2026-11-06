// The direct-contact detection of a public text is shared with the creator profile (docs/mvp/07
// RG27, RG28): it lives in ../shared/contact-detection.ts and is re-exported here, unchanged for
// the brand side (docs/mvp/06 RG19; jalons/l2c/file.md A7; L2BS-8).
export {
  CONTACT_SIGNALS,
  detectDirectContact,
  PHONE_MIN_DIGITS,
} from "../shared/contact-detection.ts";
export type { ContactSignal } from "../shared/contact-detection.ts";

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

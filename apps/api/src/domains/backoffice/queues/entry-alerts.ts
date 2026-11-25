// The alerts of an entry of queue 1 (docs/mvp/06 RG19, RG25, RG70; jalons/l2c/file.md A7; L2BS-8),
// assembled from values the repository read. Pure: the detection is packages/domain's, the
// duplicates are the database's (profiles.advertiser_duplicate_candidates, 0210), nothing is stored.
// An alert informs, it never refuses: the moderator decides (RG19, RG70).
import type {
  ReviewAlert,
  ReviewAlertCode,
} from "@influx/contracts/backoffice-queues";
import {
  detectDirectContact,
  type ContactSignal,
  isUnusualWebsiteDomain,
} from "@influx/domain/brand-profile";

/** What the moderator examines: the pending proposal of a field when there is one, else the live value. */
export type ExaminedValues = {
  brandName: string;
  presentation: string | null;
  websiteDomain: string | null;
};

/** RG19 on the public texts that are free text: the trading name and the presentation. */
export function contactAlerts(examined: ExaminedValues): ReviewAlert[] {
  const alerts: ReviewAlert[] = [];
  const fields = [
    ["advertiser.brand_name", examined.brandName],
    ["advertiser.presentation", examined.presentation],
  ] as const;
  for (const [field, text] of fields) {
    const signals = detectDirectContact(text);
    if (signals.length > 0) {
      alerts.push({ code: "direct_contact", field, signals: [...signals] });
    }
  }
  return alerts;
}

/**
 * RG19 on the message the agent writes to the brand (reason `other`, file.md A6): the kinds of
 * direct contact it holds. The text goes into an e-mail with no link (RG158), so one refuses it.
 */
export function memberMessageSignals(message: string): ContactSignal[] {
  return [...detectDirectContact(message)];
}

/** L2BS-8: a domain that is not plain ASCII, or written as punycode. */
export function domainAlerts(examined: ExaminedValues): ReviewAlert[] {
  return isUnusualWebsiteDomain(examined.websiteDomain)
    ? [{ code: "unusual_website_domain", field: "advertiser.website_domain" }]
    : [];
}

/** The codes of the list line (06 RG63), in the closed order of the contract. */
export function alertCodesOf(
  examined: ExaminedValues,
  duplicates: { brandName: boolean; domain: boolean },
): ReviewAlertCode[] {
  const codes: ReviewAlertCode[] = [];
  if (contactAlerts(examined).length > 0) codes.push("direct_contact");
  if (duplicates.brandName) codes.push("duplicate_brand");
  if (duplicates.domain) codes.push("duplicate_domain");
  if (domainAlerts(examined).length > 0) codes.push("unusual_website_domain");
  return codes;
}

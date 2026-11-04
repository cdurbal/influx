// The mapping of an INFLUX account to a Brevo contact (docs/mvp/16 §M4, RG141 to RG143, with the
// acquisition attributes of EC-11) and the output check of every body sent to Brevo (16 RG137):
// a name outside the closed lists below REFUSES the call; nothing is ever cleaned silently.
// RG142: a field absent from INFLUX is sent empty (""), never filled with an invented value; the
// defaults are those of the §M4 table itself.
import type {
  BrandProfileAttributes,
  BrevoSubject,
  SubjectAccount,
} from "../../repository.ts";

export type { BrevoSubject } from "../../repository.ts";

/** 16 §M4 + EC-11: the closed list of contact attributes. Documented there, and nowhere else. */
export const BREVO_CONTACT_ATTRIBUTES = [
  "INFLUX_ACCOUNT_ID",
  "PROFILE_TYPE",
  "DECLARED_STATUS",
  "LANGUAGE",
  "COUNTRY",
  "COMPANY",
  "SIGNED_UP_AT",
  "SIGNUP_SOURCE",
  "FUNNEL_STAGE",
  "PROFILE_COMPLETENESS",
  "MAIN_TOPIC",
  "SECTOR",
  "COMPANY_SIZE",
  "TARGET_MARKETS",
  "PROFILE_STATUS",
  "VERIFIED_LEVEL",
  "MARKETING_CONSENT",
  "CONSENT_AT",
  "CONSENT_SOURCE",
  "LAST_MARKETING_SENT_AT",
  "MARKETING_SENDS_30D",
  "UTM_SOURCE",
  "UTM_MEDIUM",
  "UTM_CAMPAIGN",
  "REFERRER_DOMAIN",
  "HEARD_FROM",
] as const;

export type BrevoContactAttribute = (typeof BREVO_CONTACT_ATTRIBUTES)[number];

/**
 * The fields of the body of operation 1 (`POST /contacts`); `emailBlacklisted` only ever false,
 * on a consent given again (J6T-3).
 */
const CONTACT_BODY_FIELDS = new Set([
  "email",
  "attributes",
  "listIds",
  "updateEnabled",
  "emailBlacklisted",
]);
/** The fields of the body of operation 2 (`PUT /contacts/{email}`): the unsubscription only. */
export const UNSUBSCRIBE_BODY_FIELDS = new Set(["emailBlacklisted"]);
/** The fields of the body of the address change (decision 5 of J7), and its only attribute. */
const EMAIL_CHANGE_BODY_FIELDS = new Set(["attributes"]);
const EMAIL_CHANGE_ATTRIBUTES: ReadonlySet<string> = new Set(["EMAIL"]);
/** The fields of the body of operation 6 (`POST /smtp/email`), and its parameters. */
const TRANSACTIONAL_BODY_FIELDS = new Set([
  "sender",
  "to",
  "templateId",
  "params",
  "tags",
]);
export const TRANSACTIONAL_PARAMS = ["LANGUAGE"] as const;
/** Operation 6 of an e-mail written by INFLUX itself (16 RG67): its text, no template. */
const RENDERED_TRANSACTIONAL_BODY_FIELDS = new Set([
  "sender",
  "to",
  "subject",
  "htmlContent",
  "textContent",
  "tags",
]);
/**
 * 16 RG158, RG160 point 5: anything that could be a link, whatever its form, an e-mail address
 * (`@`) or a domain name (a dot between a letter or digit and two letters: `influx.example`).
 */
const LINK_PATTERN =
  /<a[\s>]|href\s*=|[a-z][a-z0-9+.-]*:\/\/|mailto:|www\.|@|[a-z0-9-]\.[a-z]{2,}/i;

export type BrevoContactBody = {
  email: string;
  attributes: Record<string, string | number | boolean>;
  listIds: number[];
  updateEnabled: true;
};

/** 16 §M4: fr or en, en by default. */
export function languageOf(account: SubjectAccount): "fr" | "en" {
  return account.preferredLanguage === "fr" ? "fr" : "en";
}

/**
 * Operation 1: the body of the contact, by the closed mapping of 16 §M4 and EC-11. A list id null
 * is a missing setting (05 RG164): the body is described, never sent. `profile`: the live profile
 * of a brand (0212; 06 RG79), null for a creator or a brand without one: its attributes are then
 * sent empty (RG81, 16 RG142), the funnel stage and the completeness at their defaults.
 */
export function mapContact(
  account: SubjectAccount,
  subject: BrevoSubject,
  listId: number | null,
  profile: BrandProfileAttributes | null = null,
): BrevoContactBody {
  const attributes: Record<BrevoContactAttribute, string | number | boolean> = {
    INFLUX_ACCOUNT_ID: account.id,
    PROFILE_TYPE: account.role ?? "",
    DECLARED_STATUS: account.declaredStatus,
    LANGUAGE: languageOf(account),
    COUNTRY: account.countryCode,
    // 16 RG142, 05 RG88: never a creator's name in "company"
    COMPANY: account.role === "advertiser" ? (subject.company ?? "") : "",
    SIGNED_UP_AT: subject.signedUpAt,
    // 05 RG120, RG122: "direct" by default (§M4), "invitation" through a member invitation (D54)
    SIGNUP_SOURCE: subject.viaInvitation ? "invitation" : "direct",
    // 06 RG78: a brand is "profile_completed" from its first publication, "registered" before
    FUNNEL_STAGE:
      profile?.everPublished === true ? "profile_completed" : "registered",
    PROFILE_COMPLETENESS: profile?.completenessPercent ?? 0,
    MAIN_TOPIC: profile?.mainTopic ?? "",
    SECTOR: profile?.primarySector ?? "",
    COMPANY_SIZE: profile?.companySizeBand ?? "",
    // ISO 3166-1 codes in the order of the brand's slots, comma-separated (16 §M4)
    TARGET_MARKETS: profile?.targetMarkets.join(",") ?? "",
    PROFILE_STATUS: profile?.status ?? "",
    VERIFIED_LEVEL: "none",
    MARKETING_CONSENT: account.marketingEmailConsent,
    CONSENT_AT: subject.consentAt ?? "",
    CONSENT_SOURCE: subject.consentSource ?? "",
    LAST_MARKETING_SENT_AT: "",
    MARKETING_SENDS_30D: 0,
    UTM_SOURCE: subject.utmSource ?? "",
    UTM_MEDIUM: subject.utmMedium ?? "",
    UTM_CAMPAIGN: subject.utmCampaign ?? "",
    REFERRER_DOMAIN: subject.referrerDomain ?? "",
    HEARD_FROM: subject.heardFrom ?? "",
  };
  return {
    email: subject.email,
    attributes,
    listIds: listId === null ? [] : [listId],
    updateEnabled: true,
  };
}

function outside(
  names: Iterable<string>,
  allowed: ReadonlySet<string>,
): string[] {
  return [...names].filter((name) => !allowed.has(name));
}

const CONTACT_ATTRIBUTE_SET: ReadonlySet<string> = new Set(
  BREVO_CONTACT_ATTRIBUTES,
);
const TRANSACTIONAL_PARAM_SET: ReadonlySet<string> = new Set(
  TRANSACTIONAL_PARAMS,
);

/** 16 RG137 on operation 1: the names refused, sorted; empty when the body may leave. */
export function checkContactOutput(body: Record<string, unknown>): string[] {
  const attributes =
    typeof body.attributes === "object" && body.attributes !== null
      ? Object.keys(body.attributes)
      : [];
  return [
    ...outside(Object.keys(body), CONTACT_BODY_FIELDS),
    ...outside(attributes, CONTACT_ATTRIBUTE_SET),
    // operation 1 never blacklists: that is operation 2
    ...("emailBlacklisted" in body && body.emailBlacklisted !== false
      ? ["emailBlacklisted"]
      : []),
  ].sort();
}

/** 16 RG137 on the address change: the names refused, sorted; only the new address may leave. */
export function checkEmailChangeOutput(
  body: Record<string, unknown>,
): string[] {
  const attributes =
    typeof body.attributes === "object" && body.attributes !== null
      ? Object.keys(body.attributes)
      : [];
  return [
    ...outside(Object.keys(body), EMAIL_CHANGE_BODY_FIELDS),
    ...outside(attributes, EMAIL_CHANGE_ATTRIBUTES),
  ].sort();
}

/** 16 RG137 on operation 6: the names refused, sorted. */
export function checkTransactionalOutput(
  body: Record<string, unknown>,
): string[] {
  const params =
    typeof body.params === "object" && body.params !== null
      ? Object.keys(body.params)
      : [];
  return [
    ...outside(Object.keys(body), TRANSACTIONAL_BODY_FIELDS),
    ...outside(params, TRANSACTIONAL_PARAM_SET),
  ].sort();
}

/**
 * 16 RG137 on operation 6 of an e-mail written by INFLUX (auth.new_device, privacy.request_received):
 * the names refused, sorted; a text that holds anything like a link is refused by its name too
 * (RG158, RG160).
 */
export function checkRenderedTransactionalOutput(
  body: Record<string, unknown>,
): string[] {
  const linked = ["subject", "htmlContent", "textContent"].filter((name) => {
    const value = body[name];
    return typeof value === "string" && LINK_PATTERN.test(value);
  });
  return [
    ...outside(Object.keys(body), RENDERED_TRANSACTIONAL_BODY_FIELDS),
    ...linked,
  ].sort();
}

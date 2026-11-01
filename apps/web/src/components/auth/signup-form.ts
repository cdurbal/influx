// Screen 3 of the journey as plain functions (docs/mvp/17 §3.4, §3.5; 05 RG4, RG10 to RG25, RG31,
// RG32, RG110, RG120, RG121, D63). The checks are those of packages/contracts/src/signup.ts, which
// apps/api applies again (RG10): the browser's check is a comfort, never the only one. Nothing here
// carries an amount, a rate or a commission (05 RG9).
import type { RelayResult } from "@influx/web-platform/relay-client";
import type { SignupDoor, UiLocale } from "@influx/contracts/auth";
import {
  CONSENT_WORDING_KEYS,
  companyNameSchema,
  countryCodeSchema,
  normalizeInvitationCode,
  normalizeReferrerDomain,
  normalizeUtmValue,
  signupBodySchema,
  type DeclaredStatus,
  type HeardFrom,
  type SignupBodyInput,
  type SignupResponse,
} from "@influx/contracts/signup";

/** The source of acquisition as the request carries it (05 RG120): already normalised. */
export type AcquisitionInput = NonNullable<SignupBodyInput["acquisition"]>;

/** The answers of screen 3, as typed: nothing is lost on an error (05 RG111). */
export type SignupDraft = {
  companyName: string;
  /** "" until a country is chosen: the list starts with an empty option (05 RG11, RG17). */
  countryCode: string;
  /** Preselected with the language of the page, still a choice (05 RG11). */
  preferredLanguage: UiLocale;
  /** "" until chosen: nothing is preselected (05 RG18). */
  declaredStatus: DeclaredStatus | "";
  adultAttested: boolean;
  termsAccepted: boolean;
  marketingConsent: boolean;
  /** The optional "How did you hear about INFLUX?" (05 RG120); "" when not answered. */
  heardFrom: HeardFrom | "";
};

/** 05 RG11, RG17: no checkbox is ever pre-checked, the language is the page's. */
export function emptySignupDraft(pageLocale: UiLocale): SignupDraft {
  return {
    companyName: "",
    countryCode: "",
    preferredLanguage: pageLocale,
    declaredStatus: "",
    adultAttested: false,
    termsAccepted: false,
    marketingConsent: false,
    heardFrom: "",
  };
}

/**
 * 05 RG4: a change of door unticks the consent (an agreement given under one wording is not valid
 * under another) and clears the fields of the door left. The country is cleared too: the country
 * of a company and a country of residence are two different answers. Same door: nothing changes.
 */
export function draftAfterDoorChange(
  draft: SignupDraft,
  from: SignupDoor | null,
  to: SignupDoor,
): SignupDraft {
  if (from === to) {
    return draft;
  }
  return {
    ...draft,
    companyName: "",
    countryCode: "",
    declaredStatus: "",
    adultAttested: false,
    marketingConsent: false,
  };
}

/**
 * D66 (05 RG111, RG130): the answers of screen 3 carried to the other language, except the two
 * boxes ticked under a wording: the consent (RG32, the exact wording shown is recorded) and the
 * acceptance of the terms (read in the page's language). The person ticks them again, under the
 * wording now on screen. The preferred language stays: it is a choice (RG11).
 */
export function draftAfterLanguageChange(draft: SignupDraft): SignupDraft {
  return { ...draft, termsAccepted: false, marketingConsent: false };
}

export type SignupField =
  | "companyName"
  | "countryCode"
  | "declaredStatus"
  | "adultAttested"
  | "termsAccepted"
  | "marketingConsent";

export type SignupFieldError = "required" | "tooLong" | "invalid";

export type SignupFieldIssue = { field: SignupField; error: SignupFieldError };

/** The fields of each door, in the order of the screen: the focus goes to the first invalid one. */
export const SIGNUP_FIELDS: Readonly<
  Record<SignupDoor, readonly SignupField[]>
> = {
  advertiser: [
    "companyName",
    "countryCode",
    "termsAccepted",
    "marketingConsent",
  ],
  creator: [
    "countryCode",
    "declaredStatus",
    "adultAttested",
    "termsAccepted",
    "marketingConsent",
  ],
};

/** 05 RG11, RG13: the rule of the contract, read as one message (required before too long). */
function companyNameError(value: string): SignupFieldError | null {
  const parsed = companyNameSchema.safeParse(value);
  if (parsed.success) {
    return null;
  }
  const issues = parsed.error.issues;
  if (issues.some((issue) => issue.message === "required")) {
    return "required";
  }
  if (
    issues.some(
      (issue) => issue.message === "too_long" || issue.code === "too_big",
    )
  ) {
    return "tooLong";
  }
  // A control character (a pasted tab or line break): the database refuses it too.
  return "invalid";
}

function fieldError(
  field: SignupField,
  draft: SignupDraft,
): SignupFieldError | null {
  switch (field) {
    case "companyName":
      return companyNameError(draft.companyName);
    case "countryCode":
      return countryCodeSchema.safeParse(draft.countryCode).success
        ? null
        : "required";
    case "declaredStatus":
      return draft.declaredStatus === "" ? "required" : null;
    case "adultAttested":
      return draft.adultAttested ? null : "required";
    case "termsAccepted":
      return draft.termsAccepted ? null : "required";
    case "marketingConsent":
      // D63, RG124: required in both doors; without it no account is created.
      return draft.marketingConsent ? null : "required";
  }
}

/** Every invalid field of a door, in the order of the screen (17 §3.5: listed AND per field). */
export function validateSignupDraft(
  door: SignupDoor,
  draft: SignupDraft,
): SignupFieldIssue[] {
  return SIGNUP_FIELDS[door].flatMap((field) => {
    const error = fieldError(field, draft);
    return error === null ? [] : [{ field, error }];
  });
}

/** What the request carries besides the answers of the screen. */
export type SignupContext = {
  /** The `id` of the terms version shown (05 RG24). */
  termsVersionId: string;
  /** The exact text of the consent label shown (05 RG32), from CONSENT_WORDING_KEYS[door]. */
  consentWording: string;
  /** Language of the page where the label was shown (05 RG32). */
  displayLocale: UiLocale;
  /** Captured on arrival (05 RG120, RG121), already normalised. */
  acquisition: AcquisitionInput | undefined;
};

/**
 * The body of POST /v1/signup, or null when the answers are not complete (call
 * validateSignupDraft first). The body is checked against the contract before it leaves: what
 * the contract refuses is never sent.
 */
export function buildSignupBody(
  door: SignupDoor,
  draft: SignupDraft,
  context: SignupContext,
): SignupBodyInput | null {
  const country = countryCodeSchema.safeParse(draft.countryCode);
  if (!country.success || !draft.termsAccepted) {
    return null;
  }
  const acquisition = withHeardFrom(context.acquisition, draft.heardFrom);
  const common = {
    countryCode: country.data,
    preferredLanguage: draft.preferredLanguage,
    termsVersionId: context.termsVersionId,
    termsAccepted: true as const,
    marketingConsent: draft.marketingConsent,
    consentWording: context.consentWording,
    displayLocale: context.displayLocale,
    ...(acquisition === undefined ? {} : { acquisition }),
  };
  let body: SignupBodyInput;
  if (door === "advertiser") {
    // 05 RG22: no declared status is sent; apps/api records `business` for a brand.
    body = {
      role: "advertiser",
      companyName: draft.companyName,
      ...common,
      consentWordingKey: CONSENT_WORDING_KEYS.advertiser,
    };
  } else {
    if (draft.declaredStatus === "" || !draft.adultAttested) {
      return null;
    }
    body = {
      role: "creator",
      ...common,
      declaredStatus: draft.declaredStatus,
      adultAttested: true,
      consentWordingKey: CONSENT_WORDING_KEYS.creator,
    };
  }
  return signupBodySchema.safeParse(body).success ? body : null;
}

function withHeardFrom(
  acquisition: AcquisitionInput | undefined,
  heardFrom: HeardFrom | "",
): AcquisitionInput | undefined {
  if (heardFrom === "") {
    return acquisition;
  }
  return { ...acquisition, heardFrom };
}

/** UTM parameters read on arrival (05 RG120). */
const UTM_PARAMETERS = [
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
] as const;

/** Host name of a referring page, or null (no referrer, unreadable, or this very site). */
function referrerHostOf(referrer: string, ownHost: string): string | null {
  if (referrer === "") {
    return null;
  }
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    // Not an absolute URL: there is no site of origin to record. Nothing to report.
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null;
  }
  return url.hostname === ownHost ? null : url.hostname;
}

/**
 * The code of a member invitation link (05 RG116, RG119; 21 §J8 commit 7): in the FRAGMENT
 * (`#invitation=<code>`), which no server, log nor Referer receives. Null when absent or malformed.
 */
export function invitationCodeOf(hash: string): string | null {
  const raw = new URLSearchParams(hash.replace(/^#/, "")).get("invitation");
  return raw === null ? null : normalizeInvitationCode(raw);
}

/**
 * The source of acquisition of this visit (05 RG120, D55, 21 EC-11): the UTM parameters of the
 * address, the DOMAIN of the referring site, never its full address, and the code of an invitation
 * link (fragment). Read once, on arrival, kept in memory for the journey only, never stored in the
 * browser (RG121). Every value is normalised as the contract does; a value it would drop is not
 * sent. Undefined when empty.
 */
export function acquisitionFromVisit(
  search: string,
  referrer: string,
  ownHost: string,
  hash = "",
): AcquisitionInput | undefined {
  const parameters = new URLSearchParams(search);
  const acquisition: AcquisitionInput = {};
  for (const [parameter, field] of UTM_PARAMETERS) {
    const raw = parameters.get(parameter);
    const value = raw === null ? null : normalizeUtmValue(raw);
    if (value !== null) {
      acquisition[field] = value;
    }
  }
  const host = referrerHostOf(referrer, ownHost);
  const domain = host === null ? null : normalizeReferrerDomain(host);
  if (domain !== null) {
    acquisition.referrerDomain = domain;
  }
  const invitationCode = invitationCodeOf(hash);
  if (invitationCode !== null) {
    acquisition.invitationCode = invitationCode;
  }
  return Object.keys(acquisition).length === 0 ? undefined : acquisition;
}

/** What screen 3 does with the answer of POST /v1/signup (21 §5.2, J5 commit 4). */
export type SignupResult =
  | { kind: "signedUp"; role: SignupDoor }
  | { kind: "countryBlocked" }
  | { kind: "termsOutdated" }
  | { kind: "accountUnavailable" }
  | { kind: "sessionLost" }
  | { kind: "unavailable" };

export function signupResultOf(
  result: RelayResult<SignupResponse>,
): SignupResult {
  if (result.kind === "unauthenticated") {
    // No valid sign-up token (expired, other browser): the journey starts again from the address.
    return { kind: "sessionLost" };
  }
  if (result.kind === "failed") {
    return { kind: "unavailable" };
  }
  switch (result.data.outcome) {
    case "signed_up":
      return { kind: "signedUp", role: result.data.role };
    case "country_blocked":
      return { kind: "countryBlocked" };
    case "terms_outdated":
      return { kind: "termsOutdated" };
    case "account_unavailable":
      return { kind: "accountUnavailable" };
    case "terms_not_published":
      // 05 RG29: nobody can sign up; the screen says so as a service failure, answers kept.
      return { kind: "unavailable" };
  }
}

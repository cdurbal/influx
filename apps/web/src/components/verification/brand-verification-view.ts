// What the screens of the verification of a brand show, decided outside the components (docs/mvp/06
// RG46 to RG54, CA26 to CA29; 17 §4.2; jalons/l2e, commit 20). Pure functions, unit-tested
// (tests/brand-verification-view.test.ts): the step of the journey, the state of block 4 of the profile,
// the written label of the dated badge, the text and the next step of a refusal, the internal block of
// RG46 as a form. The API and the database decide who is verified and when, and refuse a request
// without a domain (CA26): nothing here grants, computes a period or reads a register.
//
// The front does not import @influx/domain: the sentences are the translation files', mot pour mot
// `06` RG84 for the badge (`brandProfile.badge.*`), and `l2e/modele.md` §5 for the reasons (hypothesis
// D34, read by a lawyer before `production`). No amount, rate, net or price (CLAUDE.md §2, D48, D78).
import {
  ISO_COUNTRY_CODES,
  type CountryCode,
} from "@influx/contracts/countries";
import {
  BRAND_REJECTION_REASON_CODES,
  type BrandInternalDetails,
  type BrandRejectionReasonCode,
  type BrandVerificationResponse,
  type OwnBadge,
  type OwnRefusal,
  type OwnRequest,
} from "@influx/contracts/verification";
import { rowRequestOf, type RowRequest } from "./verification-view";

// --- The dated badge ---------------------------------------------------------------------------

/**
 * The key, in `brandProfile`, of the written label of the badge (06 RG84): « Marque vérifiée le {date} —
 * domaine et immatriculation contrôlés. » or « … vérification à rafraîchir. ». The date is in both, a
 * badge without a date is a badge that lies by omission (RG53); a badge that is not current is written
 * as such, with its own icon, never by a colour (RG97).
 */
export type BrandBadgeKey = "badge.label" | "badge.toRefresh";

export function brandBadgeKeyOf(badge: OwnBadge): BrandBadgeKey {
  return badge.state === "active" ? "badge.label" : "badge.toRefresh";
}

/** The badge needs an action of the brand (renew it): not a plain, current badge. */
export function isBrandBadgeCurrent(badge: OwnBadge): boolean {
  return badge.state === "active";
}

// --- A refusal: its text and what the brand can do next ------------------------------------------

/** What the brand can do after a refusal; the texts are `brand.refusal.next.*` (and `refusal.next.contact`). */
export type BrandNextStep =
  "retryCode" | "fixDetails" | "retryLater" | "contact";

const NEXT_STEP: Readonly<Record<BrandRejectionReasonCode, BrandNextStep>> = {
  domain_code_not_found: "retryCode",
  registration_not_found: "fixDetails",
  registration_unverifiable_country: "retryLater",
  name_mismatch: "fixDetails",
  account_unavailable: "contact",
  other: "contact",
};

function isBrandReason(code: string): code is BrandRejectionReasonCode {
  return (BRAND_REJECTION_REASON_CODES as readonly string[]).includes(code);
}

/** What a refusal says: the typed reason (any code outside the brand list reads as `other`), the next step, the agent's words. */
export type BrandRefusalView = {
  reason: BrandRejectionReasonCode;
  next: BrandNextStep;
  /** The agent's own message, only for `other` and only when he wrote one (06 RG59). */
  agentMessage: string | null;
};

export function brandRefusalViewOf(refusal: OwnRefusal): BrandRefusalView {
  const reason = isBrandReason(refusal.reasonCode)
    ? refusal.reasonCode
    : "other";
  const message = refusal.message.trim();
  return {
    reason,
    next: NEXT_STEP[reason],
    agentMessage: reason === "other" && message !== "" ? refusal.message : null,
  };
}

/** Whether a refusal leaves the request open again: not when only the team can say what is next. */
export function canRestartBrandRequest(view: BrandRefusalView): boolean {
  return view.next !== "contact";
}

// --- The state of the brand's one request and badge ------------------------------------------------

/** What the state of the brand is, from the answer of the API alone (never from what the screen remembers). */
export type BrandState = {
  /** The badge, whatever its displayed state. */
  badge: OwnBadge | null;
  /** The request as its row shows it (`started`, `requested`, `refused`, `expired`), or null. */
  request: RowRequest | null;
};

export function brandStateOf(response: BrandVerificationResponse): BrandState {
  return {
    badge: response.badge,
    request: response.request === null ? null : rowRequestOf(response.request),
  };
}

/** The badge is to be refreshed: the journey is a renewal (06 RG54). */
export function isBrandRefresh(badge: OwnBadge | null): boolean {
  return badge !== null && badge.state !== "active";
}

// --- The steps of the journey ----------------------------------------------------------------------

/**
 * Where the brand is on its request (06 RG49 to RG52): `affirm`, what the badge states and what will be
 * shown with it, before anything is asked; `publish`, a draft that holds its domain code and asks for the
 * internal block; `sent`, the request waits for an agent; `done`, the badge stands.
 */
export type BrandStage = "affirm" | "publish" | "sent" | "done";

export type BrandJourney = {
  stage: BrandStage;
  /** The draft (`publish`) or the pending request (`sent`); null elsewhere. */
  request: OwnRequest | null;
  /** The draft holds no live code: it ran out, a new one is generated (06 RG51). */
  codeExpired: boolean;
  badge: OwnBadge | null;
  /** The badge is « à rafraîchir »: the journey is a renewal. */
  refresh: boolean;
  /** The first screen, after a refusal or an expiry: what happened to the last request. */
  previous: RowRequest | null;
};

export function brandJourneyOf(
  response: BrandVerificationResponse,
): BrandJourney {
  const { badge, request } = brandStateOf(response);
  const base = {
    badge,
    refresh: isBrandRefresh(badge),
    previous: null,
    codeExpired: false,
  };
  if (request?.kind === "started") {
    return {
      ...base,
      stage: "publish",
      request: request.request,
      codeExpired: request.request.code === null,
    };
  }
  if (request?.kind === "requested") {
    return { ...base, stage: "sent", request: request.request };
  }
  if (badge?.state === "active") {
    return { ...base, stage: "done", request: null };
  }
  return { ...base, stage: "affirm", request: null, previous: request };
}

export const BRAND_STEP_COUNT = 3;

/** The position of a stage among the three screens (the follow-up, sent or done, is the third). */
export function brandStepNumberOf(stage: BrandStage): number {
  return stage === "affirm" ? 1 : stage === "publish" ? 2 : 3;
}

// --- Block 4 of the profile ----------------------------------------------------------------------------

/** The one button of block 4, a link to the journey; the labels are `brandBlock.cta.*`. */
export type BrandBlockAction = "start" | "resume" | "restart" | "refresh";

export type BrandBlock = BrandState & {
  action: BrandBlockAction | null;
  /**
   * The badge cannot be asked for: no domain on the profile (06 CA26). The publication stays possible; the
   * block says it BEFORE any button.
   */
  needsDomain: boolean;
};

/**
 * What block 4 offers. Nothing while a request waits for an agent or once the badge stands; a draft is
 * taken back whatever the profile holds; every NEW request needs the domain of the profile (CA26: the API
 * refuses it too, and says so).
 */
export function brandBlockOf(
  response: BrandVerificationResponse,
  hasDomain: boolean,
): BrandBlock {
  const state = brandStateOf(response);
  let action: BrandBlockAction | null;
  if (state.request?.kind === "requested") {
    action = null;
  } else if (state.request?.kind === "started") {
    action = "resume";
  } else if (state.badge !== null) {
    action = isBrandRefresh(state.badge) ? "refresh" : null;
  } else if (state.request?.kind === "refused") {
    action = canRestartBrandRequest(brandRefusalViewOf(state.request.refusal))
      ? "restart"
      : null;
  } else if (state.request?.kind === "expired") {
    action = "restart";
  } else {
    action = "start";
  }
  const needsDomain =
    !hasDomain &&
    (action === "start" || action === "restart" || action === "refresh");
  return { ...state, action: needsDomain ? null : action, needsDomain };
}

export const BRAND_CTA_KEYS = {
  start: "brandBlock.cta.start",
  resume: "brandBlock.cta.resume",
  restart: "brandBlock.cta.restart",
  refresh: "brandBlock.cta.refresh",
} as const satisfies Record<BrandBlockAction, string>;

// --- The internal block, as a form (06 RG46, RG47) ---------------------------------------------------------

/** The three fields as typed; the block is asked at the request and never at the creation of the profile. */
export type DetailsDraft = {
  legalName: string;
  /** A code of the list of countries, or "" while none is chosen. */
  registrationCountryCode: CountryCode | "";
  registrationNumber: string;
};

/** The country a select gave, as a code of the list; anything else reads as « none chosen ». */
export function countryOf(code: string): CountryCode | "" {
  return (ISO_COUNTRY_CODES as readonly string[]).includes(code)
    ? (code as CountryCode)
    : "";
}

export const DETAILS_FIELDS = [
  "legalName",
  "registrationCountryCode",
  "registrationNumber",
] as const satisfies readonly (keyof DetailsDraft)[];

export type DetailsField = (typeof DETAILS_FIELDS)[number];

export function detailsDraftOf(
  details: BrandInternalDetails | null,
): DetailsDraft {
  return {
    legalName: details?.legalName ?? "",
    registrationCountryCode: details?.registrationCountryCode ?? "",
    registrationNumber: details?.registrationNumber ?? "",
  };
}

/** The fields still empty, in the order of the form: all three are needed to ask (06 RG46); no format is checked here. */
export function emptyDetailsOf(draft: DetailsDraft): DetailsField[] {
  return DETAILS_FIELDS.filter((field) => draft[field].trim() === "");
}

/** The block as the API takes it: edges trimmed, nothing else changed; null while a field is still empty. */
export function detailsBodyOf(
  draft: DetailsDraft,
): BrandInternalDetails | null {
  if (
    emptyDetailsOf(draft).length > 0 ||
    draft.registrationCountryCode === ""
  ) {
    return null;
  }
  return {
    legalName: draft.legalName.trim(),
    registrationCountryCode: draft.registrationCountryCode,
    registrationNumber: draft.registrationNumber.trim(),
  };
}

/** The form holds what the API holds already: there is nothing to save before the request goes. */
export function isSavedDetails(
  draft: DetailsDraft,
  saved: BrandInternalDetails | null,
): boolean {
  if (saved === null) {
    return false;
  }
  const body = detailsBodyOf(draft);
  return (
    body !== null &&
    DETAILS_FIELDS.every((field) => body[field] === saved[field])
  );
}

/** The id of the control of a field, for the focus on the first one that is missing. */
export const DETAILS_CONTROL_IDS: Readonly<Record<DetailsField, string>> = {
  legalName: "brand-legal-name",
  registrationCountryCode: "brand-registration-country",
  registrationNumber: "brand-registration-number",
};

/** The key, in `brand.details`, of the texts of each field. */
export const DETAILS_LABEL_KEYS = {
  legalName: "legalName",
  registrationCountryCode: "country",
  registrationNumber: "number",
} as const satisfies Record<DetailsField, string>;

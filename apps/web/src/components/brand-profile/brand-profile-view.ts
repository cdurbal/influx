// The rules of the screen "mon profil de marque" that are not apps/api's (docs/mvp/17 §4.2; 06 RG14,
// RG83, RG85): the draft the form holds, the patch of what changed, the checks the browser makes
// with the very schema the API validates with (RG14), which message an answer calls for, which
// state allows editing. Pure functions, unit-tested (tests/brand-profile-view.test.ts); the
// components and the hook only display and call. The score, the missing fields and the reduction
// of the website to a domain are the API's (packages/domain): nothing of them is computed here.
// Nothing here carries an amount, a rate or a price (CLAUDE.md §2, D48, D78).
import {
  BRAND_LOGO_MAX_UPLOAD_BYTES,
  BRAND_LOGO_REJECTIONS,
  updateBrandProfileBodySchema,
  type BrandLogoRejection,
  type BrandProfileResponse,
  type BrandProfileStatus,
  type UpdateBrandProfileBody,
} from "@influx/contracts/brand-profile";
import type { RelayResult } from "@influx/web-platform/relay-client";

// --- The draft ----------------------------------------------------------------------------------

/** What the form holds, field by field; texts as typed, lists as chosen, `null` for "not chosen". */
export type BrandDraft = {
  companyName: string;
  primarySector: string | null;
  secondarySectors: string[];
  companySize: string | null;
  targetMarkets: string[];
  workingLanguages: string[];
  website: string;
  presentation: string;
  topics: string[];
  networks: string[];
  formats: string[];
  usageRights: string[];
  exclusivityBand: string | null;
  offersNonMonetary: boolean | null;
  audienceCountries: string[];
  collaborationRhythm: string | null;
  contactRole: string | null;
  contactFirstName: string;
  contactEmail: string;
  contactPhone: string;
  contactUrl: string;
};

export type DraftKey = keyof BrandDraft;

/** The fields in the order of the form (17 §4.2). */
export const DRAFT_KEYS: readonly DraftKey[] = [
  "companyName",
  "primarySector",
  "secondarySectors",
  "companySize",
  "targetMarkets",
  "workingLanguages",
  "website",
  "presentation",
  "topics",
  "networks",
  "formats",
  "usageRights",
  "exclusivityBand",
  "offersNonMonetary",
  "audienceCountries",
  "collaborationRhythm",
  "contactRole",
  "contactFirstName",
  "contactEmail",
  "contactPhone",
  "contactUrl",
];

export function draftOf(profile: BrandProfileResponse): BrandDraft {
  return {
    companyName: profile.companyName,
    primarySector: profile.primarySector,
    secondarySectors: [...profile.secondarySectors],
    companySize: profile.companySize,
    targetMarkets: [...profile.targetMarkets],
    workingLanguages: [...profile.workingLanguages],
    website: profile.website ?? "",
    presentation: profile.presentation ?? "",
    topics: [...profile.topics],
    networks: [...profile.networks],
    formats: [...profile.formats],
    usageRights: [...profile.usageRights],
    exclusivityBand: profile.exclusivityBand,
    offersNonMonetary: profile.offersNonMonetary,
    audienceCountries: [...profile.audienceCountries],
    collaborationRhythm: profile.collaborationRhythm,
    contactRole: profile.contactRole,
    contactFirstName: profile.contact.firstName ?? "",
    contactEmail: profile.contact.email ?? "",
    contactPhone: profile.contact.phone ?? "",
    contactUrl: profile.contact.url ?? "",
  };
}

type DraftValue = BrandDraft[DraftKey];

/** Two values of a field are the same: a list is compared in order, element by element. */
export function sameValue(first: DraftValue, second: DraftValue): boolean {
  if (Array.isArray(first) && Array.isArray(second)) {
    return (
      first.length === second.length &&
      first.every((item, index) => item === second[index])
    );
  }
  return first === second;
}

// --- The patch of the autosave (06 RG83) --------------------------------------------------------

/** Why a field is not accepted, as a key of `brandProfile.fieldErrors`. */
export type FieldError =
  "required" | "invalid" | "unknown" | "website" | "companyName";

export type FieldErrors = Partial<Record<DraftKey, FieldError>>;

const CONTACT_KEYS = {
  contactFirstName: "firstName",
  contactEmail: "email",
  contactPhone: "phone",
  contactUrl: "url",
} as const satisfies Partial<Record<DraftKey, string>>;

/** A text emptied: the API wants `null`, not an empty string, to clear a value. */
function textOrNull(value: string): string | null {
  return value.trim() === "" ? null : value.trim();
}

/** The part of the body that one field makes (an object the schema reads), or its refusal. */
function fragmentOf(
  key: DraftKey,
  draft: BrandDraft,
): { fragment: Record<string, unknown> } | { error: FieldError } {
  switch (key) {
    case "companyName":
      return draft.companyName.trim() === ""
        ? { error: "companyName" }
        : { fragment: { companyName: draft.companyName.trim() } };
    case "website":
      return { fragment: { website: textOrNull(draft.website) } };
    case "presentation":
      // The text is kept as typed (line breaks and margins): the API empties a blank one.
      return {
        fragment: {
          presentation: draft.presentation === "" ? null : draft.presentation,
        },
      };
    case "contactFirstName":
    case "contactEmail":
    case "contactPhone":
    case "contactUrl":
      return {
        fragment: {
          contact: { [CONTACT_KEYS[key]]: textOrNull(draft[key]) },
        },
      };
    default:
      return { fragment: { [key]: draft[key] } };
  }
}

function mergeFragment(
  patch: Record<string, unknown>,
  fragment: Record<string, unknown>,
): void {
  for (const [name, value] of Object.entries(fragment)) {
    const previous = patch[name];
    patch[name] =
      name === "contact" && typeof previous === "object" && previous !== null
        ? { ...previous, ...(value as object) }
        : value;
  }
}

export type PatchPlan = {
  /** What to send: the valid changes, `null` when there is nothing to send. */
  body: UpdateBrandProfileBody | null;
  /** The fields that changed and are sent (to mark as saved once the API accepted them). */
  keys: DraftKey[];
  /** The changed fields the browser refuses, each with its reason; not sent, kept in the form. */
  refused: FieldErrors;
};

/**
 * The autosave of what changed since the last answer of the API (06 RG83): each changed field is
 * checked alone with the schema of the API (RG14), so that one wrong field never holds back the
 * others, and the ones accepted make the body. `skip`: the fields already in error, left alone until
 * the member changes them.
 */
export function planPatch(
  draft: BrandDraft,
  saved: BrandDraft,
  skip: FieldErrors = {},
): PatchPlan {
  const patch: Record<string, unknown> = {};
  const keys: DraftKey[] = [];
  const refused: FieldErrors = {};
  for (const key of DRAFT_KEYS) {
    // A field the member has not changed since it was refused waits for the member (no loop).
    if (sameValue(draft[key], saved[key]) || skip[key] !== undefined) {
      continue;
    }
    const made = fragmentOf(key, draft);
    if ("error" in made) {
      refused[key] = made.error;
      continue;
    }
    if (!updateBrandProfileBodySchema.safeParse(made.fragment).success) {
      refused[key] = "invalid";
      continue;
    }
    mergeFragment(patch, made.fragment);
    keys.push(key);
  }
  const parsed = updateBrandProfileBodySchema.safeParse(patch);
  return {
    body: keys.length > 0 && parsed.success ? parsed.data : null,
    keys,
    refused,
  };
}

/** The body of one field alone: what a refused patch is split into to find the wrong field. */
export function singleFieldPatch(
  key: DraftKey,
  draft: BrandDraft,
): UpdateBrandProfileBody | null {
  const made = fragmentOf(key, draft);
  if ("error" in made) {
    return null;
  }
  const parsed = updateBrandProfileBodySchema.safeParse(made.fragment);
  return parsed.success ? parsed.data : null;
}

/** The reason of a field refused by the API (a 400 on its own), from the issues of the answer. */
export function fieldErrorOf(
  key: DraftKey,
  result: RelayResult<unknown>,
): FieldError {
  const issues = result.kind === "failed" ? (result.issues ?? []) : [];
  if (key === "website" || issues.includes("invalid_host")) {
    return "website";
  }
  if (issues.includes("unknown")) {
    return "unknown";
  }
  return key === "companyName" ? "companyName" : "invalid";
}

/**
 * After the API accepted the fields sent: they are the new reference of the next patch. The website
 * is the one text the screen replaces by the answer (it shows the domain kept, RG17, CA4), and only
 * when the member has not typed on since; the other texts stay as typed (the margins of a name
 * being typed must not vanish under the cursor).
 */
export function afterSave(
  draft: BrandDraft,
  saved: BrandDraft,
  sent: BrandDraft,
  keys: readonly DraftKey[],
  domainKept: string,
): { draft: BrandDraft; saved: BrandDraft } {
  const nextSaved: BrandDraft = { ...saved };
  const nextDraft: BrandDraft = { ...draft };
  for (const key of keys) {
    Object.assign(nextSaved, { [key]: sent[key] });
  }
  if (keys.includes("website") && draft.website === sent.website) {
    nextDraft.website = domainKept;
    nextSaved.website = domainKept;
  }
  return { draft: nextDraft, saved: nextSaved };
}

// --- Where each field stands -------------------------------------------------------------------

export type SectionId = "identity" | "expectations" | "contact";

export const SECTION_IDS: readonly SectionId[] = [
  "identity",
  "expectations",
  "contact",
];

const SECTION_OF_KEY: Readonly<Record<DraftKey, SectionId>> = {
  companyName: "identity",
  primarySector: "identity",
  secondarySectors: "identity",
  companySize: "identity",
  targetMarkets: "identity",
  workingLanguages: "identity",
  website: "identity",
  presentation: "identity",
  topics: "expectations",
  networks: "expectations",
  formats: "expectations",
  usageRights: "expectations",
  exclusivityBand: "expectations",
  offersNonMonetary: "expectations",
  audienceCountries: "expectations",
  collaborationRhythm: "expectations",
  contactRole: "contact",
  contactFirstName: "contact",
  contactEmail: "contact",
  contactPhone: "contact",
  contactUrl: "contact",
};

/** A required field of the API (`missingRequired`) is a field of the form, but for two names. */
export type RequiredCode = BrandProfileResponse["missingRequired"][number];

const KEY_OF_REQUIRED: Readonly<Record<RequiredCode, DraftKey | "country">> = {
  legalName: "companyName",
  primarySector: "primarySector",
  companySize: "companySize",
  country: "country",
  targetMarkets: "targetMarkets",
  workingLanguages: "workingLanguages",
  presentation: "presentation",
  topics: "topics",
  networks: "networks",
  formats: "formats",
  audienceCountries: "audienceCountries",
  contactRole: "contactRole",
};

/** The label of a required field: the key of `brandProfile.fields` that names it. */
export function labelKeyOfRequired(code: RequiredCode): DraftKey | "country" {
  return KEY_OF_REQUIRED[code];
}

/** The section a required field is in (the accordion opens it before the focus goes there). */
export function sectionOfRequired(code: RequiredCode): SectionId {
  const key = KEY_OF_REQUIRED[code];
  return key === "country" ? "identity" : SECTION_OF_KEY[key];
}

/**
 * The id of the first control of a field: `brand-profile-<code>` with the code of the API for a
 * required field (the screen focuses the first missing one by it, RG85), the name of the field
 * otherwise.
 */
export function controlIdOf(key: DraftKey): string {
  return `brand-profile-${key === "companyName" ? "legalName" : key}`;
}

/** The id of the control of a required field, to focus it. */
export function controlIdOfRequired(code: RequiredCode): string {
  return `brand-profile-${code}`;
}

/** The fields of the form flagged "required" in the writing (06 RG15, RG27, RG35). */
export const REQUIRED_KEYS: ReadonlySet<DraftKey> = new Set<DraftKey>([
  "companyName",
  "primarySector",
  "companySize",
  "targetMarkets",
  "workingLanguages",
  "presentation",
  "topics",
  "networks",
  "formats",
  "audienceCountries",
  "contactRole",
]);

/** The fields refused by name, from the required fields the API says are missing (RG5, RG61). */
export function missingErrors(missing: readonly RequiredCode[]): FieldErrors {
  const errors: FieldErrors = {};
  for (const code of missing) {
    const key = KEY_OF_REQUIRED[code];
    if (key !== "country") {
      errors[key] = "required";
    }
  }
  return errors;
}

// --- The states of the profile (06 RG3; 17 §4.2) -------------------------------------------------

/**
 * The states the brand may still edit and submit from: the API answers 409 to a write on a
 * published or a suspended profile until the review of L2C (EC-L2B-07-1).
 */
export function isEditable(status: BrandProfileStatus): boolean {
  return status !== "published" && status !== "suspended";
}

/** The sentence under "État : …" for a status; the draft, the pending and the rejected have theirs. */
export type StatusTextKey =
  "draft" | "pendingSince" | "published" | "rejectedReason" | "suspended";

export function statusTextKeyOf(status: BrandProfileStatus): StatusTextKey {
  switch (status) {
    case "draft":
      return "draft";
    case "pending_review":
      return "pendingSince";
    case "published":
      return "published";
    case "rejected":
      return "rejectedReason";
    case "suspended":
      return "suspended";
  }
}

// --- The state of the profile outside the form (home, column) ------------------------------------

/**
 * What the home and the column of the shell need of the profile (17 §2.3, §2.4): the state, the
 * date it was submitted, and the required fields still missing. The score is not here: the rail
 * and the home write the state and name what is missing, they do not grade it.
 */
export type BrandProfileSummary = Pick<
  BrandProfileResponse,
  "status" | "submittedAt" | "missingRequired"
>;

export function summaryOf(profile: BrandProfileResponse): BrandProfileSummary {
  return {
    status: profile.status,
    submittedAt: profile.submittedAt,
    missingRequired: [...profile.missingRequired],
  };
}

/** What the member is invited to do next on the profile; null when nothing is theirs to do. */
export type NextProfileAction = "complete" | "submit";

/**
 * "Compléter mon profil" while a required field of a draft or a refused profile is missing,
 * "Soumettre" once it is complete; nothing for a profile under review (it is written, not asked),
 * published or suspended.
 */
export function nextActionOf(
  summary: BrandProfileSummary,
): NextProfileAction | null {
  if (summary.status !== "draft" && summary.status !== "rejected") {
    return null;
  }
  return summary.missingRequired.length > 0 ? "complete" : "submit";
}

// --- Dates and answers --------------------------------------------------------------------------

/** The time of the last save as the language writes it ("14 h 07", "2:07 PM"), RG83. */
export function formatSavedTime(at: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(at);
}

/** Whether a failed call is worth trying again by itself (the network, the service, a limit). */
export function isRetryable(result: RelayResult<unknown>): boolean {
  if (result.kind !== "failed") {
    return false;
  }
  return (
    result.code === undefined ||
    result.code === "service_unavailable" ||
    result.code === "internal_error" ||
    result.code === "rate_limited"
  );
}

// --- The logo (06 RG15, cas limites 2 et 6; D80) -----------------------------------------------

/**
 * Why a deposit did not give a logo, as the key of its message (`brandProfile.logo.errors.<key>`):
 * the six typed reasons of the API, a file the browser saw too big or empty before sending, the
 * daily quota, a profile no longer editable, or the service (network, Storage) that did not answer.
 */
export type LogoFailure =
  BrandLogoRejection | "tooLarge" | "quota" | "locked" | "unavailable";

/** Only a file the relay would refuse is stopped here (size, nothing to read); the rest is the API's. */
export function logoFileProblem(sizeInBytes: number): LogoFailure | null {
  if (sizeInBytes === 0) {
    return "empty";
  }
  return sizeInBytes > BRAND_LOGO_MAX_UPLOAD_BYTES ? "tooLarge" : null;
}

function isLogoRejection(
  issue: string | undefined,
): issue is BrandLogoRejection {
  return (BRAND_LOGO_REJECTIONS as readonly string[]).includes(issue ?? "");
}

/**
 * Which message a refused deposit or removal calls for, from the code and the issues of the error
 * envelope. Only `unavailable` leaves the file worth sending again (CA45, cas limite 6): every
 * other cause needs another file, another day, or nothing at all.
 */
export function logoFailureOf(failure: {
  code?: string;
  issues?: readonly string[];
}): LogoFailure {
  switch (failure.code) {
    case "image_rejected": {
      const reason = failure.issues?.[0];
      return isLogoRejection(reason) ? reason : "undecodable";
    }
    case "payload_too_large":
      return "tooLarge";
    case "upload_quota_exceeded":
      return "quota";
    case "conflict":
      return "locked";
    default:
      return "unavailable";
  }
}

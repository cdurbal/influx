// The rules of the screen "mon profil" (creator) that are not apps/api's (docs/mvp/17 §5.2; 07 RG14,
// RG16, RG25 to RG40, RG111, RG112; jalons/l2d, commit 12): the draft the form holds, the patch of
// what changed, the checks the browser makes with the very schema the API validates with (RG14),
// which message an answer calls for, which section holds which required field, which state allows
// editing. Pure functions, unit-tested (tests/creator-profile-view.test.ts); the components and the
// hook only display and call. The score, the missing fields and the detection are the API's
// (packages/domain): nothing of them is computed here. Nothing here carries an amount, a rate, a
// net or a price (CLAUDE.md §2, D48, D78).
import {
  updateCreatorProfileBodySchema,
  type CreatorProfileResponse,
  type CreatorTextWarning,
  type UpdateCreatorProfileBody,
} from "@influx/contracts/creator-profile";
import type { RelayResult } from "@influx/web-platform/relay-client";

// --- The draft ----------------------------------------------------------------------------------

/** What the form holds for blocks 1 and 2, field by field; texts as typed, `null` for "not chosen". */
export type CreatorDraft = {
  headline: string;
  bio: string;
  collaborationExperience: string | null;
  legalFirstName: string;
  legalLastName: string;
  contactPhone: string;
  contactEmail: string;
  city: string;
  primaryTopic: string | null;
  secondaryTopics: string[];
  tones: string[];
  publicationLanguages: string[];
  travelScope: string | null;
};

export type DraftKey = keyof CreatorDraft;

/** The fields in the order of the form (17 §5.2). */
export const DRAFT_KEYS: readonly DraftKey[] = [
  "headline",
  "bio",
  "collaborationExperience",
  "legalFirstName",
  "legalLastName",
  "contactPhone",
  "contactEmail",
  "city",
  "primaryTopic",
  "secondaryTopics",
  "tones",
  "publicationLanguages",
  "travelScope",
];

export function draftOf(profile: CreatorProfileResponse): CreatorDraft {
  return {
    headline: profile.headline ?? "",
    bio: profile.bio ?? "",
    collaborationExperience: profile.collaborationExperience,
    legalFirstName: profile.identity.legalFirstName ?? "",
    legalLastName: profile.identity.legalLastName ?? "",
    contactPhone: profile.identity.contactPhone ?? "",
    contactEmail: profile.identity.contactEmail ?? "",
    city: profile.identity.city ?? "",
    primaryTopic: profile.primaryTopic,
    secondaryTopics: [...profile.secondaryTopics],
    tones: [...profile.tones],
    publicationLanguages: [...profile.publicationLanguages],
    travelScope: profile.travelScope,
  };
}

type DraftValue = CreatorDraft[DraftKey];

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

// --- The patch of the autosave (07 RG111) -----------------------------------------------------

/** Why a field is not accepted, as a key of `creatorProfile.issues`. */
export type FieldError = "invalid" | "unknown";

export type FieldErrors = Partial<Record<DraftKey, FieldError>>;

const IDENTITY_KEYS = {
  legalFirstName: "legalFirstName",
  legalLastName: "legalLastName",
  contactPhone: "contactPhone",
  contactEmail: "contactEmail",
  city: "city",
} as const satisfies Partial<Record<DraftKey, string>>;

/** A text emptied: the API wants `null`, not an empty string, to clear a value. */
function textOrNull(value: string): string | null {
  return value.trim() === "" ? null : value.trim();
}

/** The part of the body that one field makes (an object the schema reads). */
function fragmentOf(
  key: DraftKey,
  draft: CreatorDraft,
): Record<string, unknown> {
  switch (key) {
    case "headline":
      return { headline: textOrNull(draft.headline) };
    case "bio":
      // The text is kept as typed (line breaks): the API empties a blank one.
      return { bio: draft.bio.trim() === "" ? null : draft.bio };
    case "legalFirstName":
    case "legalLastName":
    case "contactPhone":
    case "contactEmail":
    case "city":
      return { identity: { [IDENTITY_KEYS[key]]: textOrNull(draft[key]) } };
    default:
      return { [key]: draft[key] };
  }
}

function mergeFragment(
  patch: Record<string, unknown>,
  fragment: Record<string, unknown>,
): void {
  for (const [name, value] of Object.entries(fragment)) {
    const previous = patch[name];
    patch[name] =
      name === "identity" && typeof previous === "object" && previous !== null
        ? { ...previous, ...(value as object) }
        : value;
  }
}

export type PatchPlan = {
  /** What to send: the valid changes, `null` when there is nothing to send. */
  body: UpdateCreatorProfileBody | null;
  /** The fields that changed and are sent (to mark as saved once the API accepted them). */
  keys: DraftKey[];
  /** The changed fields the browser refuses, each with its reason; not sent, kept in the form. */
  refused: FieldErrors;
};

/**
 * The autosave of what changed since the last answer of the API (07 RG111): each changed field is
 * checked alone with the schema of the API (RG14), so that one wrong field never holds back the
 * others, and the ones accepted make the body. `skip`: the fields already in error, left alone until
 * the member changes them.
 */
export function planPatch(
  draft: CreatorDraft,
  saved: CreatorDraft,
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
    const fragment = fragmentOf(key, draft);
    if (!updateCreatorProfileBodySchema.safeParse(fragment).success) {
      refused[key] = "invalid";
      continue;
    }
    mergeFragment(patch, fragment);
    keys.push(key);
  }
  const parsed = updateCreatorProfileBodySchema.safeParse(patch);
  return {
    body: keys.length > 0 && parsed.success ? parsed.data : null,
    keys,
    refused,
  };
}

/** The body of one field alone: what a refused patch is split into to find the wrong field. */
export function singleFieldPatch(
  key: DraftKey,
  draft: CreatorDraft,
): UpdateCreatorProfileBody | null {
  const parsed = updateCreatorProfileBodySchema.safeParse(
    fragmentOf(key, draft),
  );
  return parsed.success ? parsed.data : null;
}

/** The reason of a field refused by the API (a 400 on its own), from the issues of the answer. */
export function fieldErrorOf(result: RelayResult<unknown>): FieldError {
  const issues = result.kind === "failed" ? (result.issues ?? []) : [];
  return issues.includes("unknown") ? "unknown" : "invalid";
}

/**
 * After the API accepted the fields sent: they are the new reference of the next patch. The API
 * takes the main topic out of the secondary ones (07 RG33): when either list was sent, the
 * secondary topics the form shows are the answer's, unless the member has typed on since.
 */
export function afterSave(
  draft: CreatorDraft,
  saved: CreatorDraft,
  sent: CreatorDraft,
  keys: readonly DraftKey[],
  answer: Pick<CreatorProfileResponse, "secondaryTopics">,
): { draft: CreatorDraft; saved: CreatorDraft } {
  const nextSaved: CreatorDraft = { ...saved };
  const nextDraft: CreatorDraft = { ...draft };
  for (const key of keys) {
    Object.assign(nextSaved, { [key]: sent[key] });
  }
  if (keys.includes("primaryTopic") || keys.includes("secondaryTopics")) {
    nextSaved.secondaryTopics = [...answer.secondaryTopics];
    if (sameValue(draft.secondaryTopics, sent.secondaryTopics)) {
      nextDraft.secondaryTopics = [...answer.secondaryTopics];
    }
  }
  return { draft: nextDraft, saved: nextSaved };
}

// --- Where each section and each required field stands ------------------------------------------

export type SectionId =
  "presentation" | "editorial" | "networks" | "audience" | "offer";

/** The five sections of the summary, in the order of the form (17 §5.2). */
export const SECTION_IDS: readonly SectionId[] = [
  "presentation",
  "editorial",
  "networks",
  "audience",
  "offer",
];

/** The sections the screen holds so far: the others are told "coming soon" (commit 14: audience and offer). */
export const BUILT_SECTIONS: ReadonlySet<SectionId> = new Set<SectionId>([
  "presentation",
  "editorial",
  "networks",
]);

export type RequiredCode = CreatorProfileResponse["missingRequired"][number];

const SECTION_OF_REQUIRED: Readonly<Record<RequiredCode, SectionId>> = {
  headline: "presentation",
  bio: "presentation",
  primaryTopic: "editorial",
  publicationLanguages: "editorial",
  // taken from the account: the section that shows it
  residenceCountry: "editorial",
  networkLines: "networks",
  primaryAccount: "networks",
  handle: "networks",
  profileUrl: "networks",
  followers: "networks",
  figuresDate: "networks",
  mainAudienceCountry: "audience",
  mainAudienceShare: "audience",
  formats: "offer",
  availability: "offer",
};

export function sectionOfRequired(code: RequiredCode): SectionId {
  return SECTION_OF_REQUIRED[code];
}

/** A section is complete when none of its required fields is missing. */
export function isSectionComplete(
  section: SectionId,
  missing: readonly RequiredCode[],
): boolean {
  return !missing.some((code) => SECTION_OF_REQUIRED[code] === section);
}

/** The id of a section, the target of its anchor in the summary. */
export function sectionAnchorOf(section: SectionId): string {
  return `creator-section-${section}`;
}

/** The id of the control of a field, for the focus and the label. */
export function controlIdOf(key: DraftKey): string {
  return `creator-profile-${key}`;
}

/** The profile can be edited: it has its storefront, and no state but the draft exists at L2D (07 RG111). */
export function isEditable(
  profile: Pick<CreatorProfileResponse, "alias" | "status">,
): boolean {
  return profile.alias !== null && profile.status === "draft";
}

/** Whether the detection saw an identifying element in a public text (07 RG27): a warning, never an error. */
export function hasTextWarning(
  field: CreatorTextWarning["field"],
  warnings: readonly CreatorTextWarning[],
): boolean {
  return warnings.some((warning) => warning.field === field);
}

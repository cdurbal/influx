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
  // Block 5, "Mon offre" (commit 14): the formats, the two lists of usage rights (a right is in one
  // only, 07 RG73), the delivery, the exclusivity, the non-monetary counterpart, the availability and
  // the refused sectors. No tariff exists (D78).
  formats: string[];
  usageIncluded: string[];
  usageOptional: string[];
  deliveryLead: string | null;
  maxExclusivity: string | null;
  acceptsNonMonetary: boolean;
  availability: string | null;
  refusedSectors: string[];
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
  "formats",
  "usageIncluded",
  "usageOptional",
  "deliveryLead",
  "maxExclusivity",
  "acceptsNonMonetary",
  "availability",
  "refusedSectors",
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
    formats: [...profile.formats],
    usageIncluded: usageCodesOf(profile, "included"),
    usageOptional: usageCodesOf(profile, "optional"),
    deliveryLead: profile.deliveryLead,
    maxExclusivity: profile.maxExclusivity,
    acceptsNonMonetary: profile.acceptsNonMonetary,
    availability: profile.availability,
    refusedSectors: [...profile.refusedSectors],
  };
}

/** The codes of the usage rights offered one way, in the order stored (07 RG73: two lists, never one). */
function usageCodesOf(
  profile: Pick<CreatorProfileResponse, "usageRights">,
  inclusion: "included" | "optional",
): string[] {
  return profile.usageRights
    .filter((right) => right.inclusion === inclusion)
    .map((right) => right.code);
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
    case "usageIncluded":
    case "usageOptional":
      // The API replaces the whole list of rights: both lists travel together, a right once (RG73).
      return {
        usageRights: [
          ...draft.usageIncluded.map((code) => ({
            code,
            inclusion: "included" as const,
          })),
          ...draft.usageOptional
            .filter((code) => !draft.usageIncluded.includes(code))
            .map((code) => ({ code, inclusion: "optional" as const })),
        ],
      };
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
  | "presentation"
  | "editorial"
  | "networks"
  | "audience"
  | "offer"
  | "portfolio"
  | "trust";

/** The five sections of the form built so far, in the order of the form (17 §5.2). */
export const SECTION_IDS: readonly SectionId[] = [
  "presentation",
  "editorial",
  "networks",
  "audience",
  "offer",
];

/**
 * What the summary of the page and the count of what is missing go by: the five sections plus the
 * portfolio (block 6) and the trust block (block 7), required since L2G (RG77, RG16): the screen of
 * L2G (commit 13) draws all seven.
 */
export const SUMMARY_SECTION_IDS: readonly SectionId[] = [
  ...SECTION_IDS,
  "portfolio",
  "trust",
];

/**
 * The sections of the form of L2D (blocks 1 to 5), all built since commit 14. Blocks 6 and 7 came with
 * L2G (commit 13): they are in `SUMMARY_SECTION_IDS` and the summary names all seven.
 */
export const BUILT_SECTIONS: ReadonlySet<SectionId> = new Set<SectionId>([
  "presentation",
  "editorial",
  "networks",
  "audience",
  "offer",
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
  portfolio: "portfolio",
  accountVerified: "trust",
};

export function sectionOfRequired(code: RequiredCode): SectionId {
  return SECTION_OF_REQUIRED[code];
}

/** How many required fields a section still lacks (the home card names the sections, not the fields). */
export type SectionCount = { section: SectionId; count: number };

/**
 * What is missing, counted by section in the order of the form; a section with nothing missing is
 * left out (L2DU-3). The sections are those of `SECTION_OF_REQUIRED`: the front never decides what
 * is required, the API does.
 */
export function missingBySectionOf(
  missing: readonly RequiredCode[],
): SectionCount[] {
  return SUMMARY_SECTION_IDS.map((section) => ({
    section,
    count: missing.filter((code) => SECTION_OF_REQUIRED[code] === section)
      .length,
  })).filter((entry) => entry.count > 0);
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

/**
 * The profile can be edited: it has its storefront and it is open to writing (07 RG111). A draft and a
 * refused profile are; a published one too, where a change of a moderated field waits for its review
 * and the rest is immediate (RG9, CA48, CA49). A profile waiting for its decision (RG10) and a
 * suspended one are frozen.
 */
export function isEditable(
  profile: Pick<CreatorProfileResponse, "alias" | "status">,
): boolean {
  return (
    profile.alias !== null &&
    (profile.status === "draft" ||
      profile.status === "rejected" ||
      profile.status === "published")
  );
}

// --- The summary of the home and of the column (commit 15) --------------------------------------

/**
 * What the home and the column of the space say of the profile: the alias, the state, the score and
 * what is missing. The completeness is the creator's own, never shown to a brand (07 RG90); no tariff
 * exists to be summarised (D78).
 */
export type CreatorProfileSummary = Pick<
  CreatorProfileResponse,
  "status" | "alias" | "missingRequired"
> & { score: number };

export function creatorSummaryOf(
  profile: CreatorProfileResponse,
): CreatorProfileSummary {
  return {
    status: profile.status,
    alias: profile.alias,
    missingRequired: [...profile.missingRequired],
    score: profile.completeness.score,
  };
}

/**
 * The way to the profile: "Compléter" while a required field is missing, "Voir" once none is; the
 * submission itself is on the profile page (L2G, commit 13).
 */
export type CreatorNextAction = "complete" | "review";

export function creatorNextActionOf(
  summary: Pick<CreatorProfileSummary, "missingRequired">,
): CreatorNextAction {
  return summary.missingRequired.length > 0 ? "complete" : "review";
}

/** Whether the detection saw an identifying element in a public text (07 RG27): a warning, never an error. */
export function hasTextWarning(
  field: CreatorTextWarning["field"],
  warnings: readonly CreatorTextWarning[],
): boolean {
  return warnings.some((warning) => warning.field === field);
}

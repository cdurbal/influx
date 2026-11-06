// The creator profile of the member's own account: read and autosave of blocks 1, 2 and 5 (docs/mvp/07
// RG1, RG2, RG14, RG16, RG25 to RG40, RG64 to RG76, RG86 to RG91, CA2; jalons/l2d, commit 08). The
// rules live elsewhere and are only called here:
// - completeness, required fields and the detection of an identifying element in a public text:
//   packages/domain (a `*Completeness*` function outside it fails a guard, stockage.md §9);
// - closed lists, caps, `none`, the shape of every value: the database (0216, 0217), which arbitrates;
//   this file checks first only to say WHICH field is wrong;
// - the alias, the status, the bands derived from exact figures and the date of the availability: the
//   system's, written by no member and by no route of this file (invariant 7 of the fiche).
// There is no submission and no publication at L2D (the status stays `draft`), no tariff (D78, D48),
// and no network line or audience here (commit 09: networks.ts; read here for the completeness).
import {
  creatorProfileResponseSchema,
  type CreatorProfileResponse,
  type CreatorTextWarning,
  type UpdateCreatorProfileBody,
  type UpdateCreatorProfileResponse,
} from "@influx/contracts/creator-profile";
import type { ValidationIssue } from "@influx/contracts/errors";
import {
  creatorProfileCompleteness,
  locateDirectContact,
  missingCreatorRequiredFields,
  type CreatorProfileInput,
} from "@influx/domain/creator-profile";
import type { Transaction } from "../../../db/index.ts";
import { sqlStateOf } from "../../../db/sql-state.ts";
import { ApiError, RequestValidationError } from "../../../platform/errors.ts";
import {
  CREATOR_PROFILE_LISTS,
  lockOwnCreatorStorefront,
  readActiveCreatorReferences,
  readOwnCreatorProfile,
  replaceCreatorProfileList,
  replaceCreatorUsageRights,
  storeCreatorScore,
  updateCreatorIdentity,
  updateCreatorStorefrontColumns,
  type ActiveCreatorReferences,
  type CreatorIdentityChanges,
  type StoredCreatorProfile,
} from "./repository.ts";

/**
 * The states a creator may write in. A published profile has a regime of its own (a moderated field
 * waits for review, 07 RG10), which arrives with the submission at L2G: until then nothing publishes,
 * and a state this code does not know is as frozen as a suspended one (EC-L2D-08-3).
 */
const WRITABLE_STATUSES: ReadonlySet<string> = new Set([
  "draft",
  "pending_review",
  "rejected",
]);

/**
 * Locks the storefront for the rest of the transaction (two saves at the same moment are serialised)
 * and refuses a write when the profile is not in a state a creator writes in, or does not exist: an
 * empty draft the member cannot create (0216 §5.3). Shared by the autosave and the network routes.
 */
export async function lockWritableCreatorProfile(
  tx: Transaction,
): Promise<void> {
  const status = await lockOwnCreatorStorefront(tx);
  if (status === null || !WRITABLE_STATUSES.has(status)) {
    throw new ApiError("conflict");
  }
}

/** The profile as packages/domain reads it: the entered values, never a decision of INFLUX (RG88). */
function profileInputOf(stored: StoredCreatorProfile): CreatorProfileInput {
  return {
    headline: stored.headline,
    bio: stored.bio,
    primaryTopicCode: stored.primaryTopic,
    secondaryTopicCodes: stored.lists.secondaryTopics,
    toneCodes: stored.lists.tones,
    publicationLanguages: stored.lists.publicationLanguages,
    residenceCountryCode: stored.residenceCountry,
    travelScope: stored.travelScope,
    networkLines: stored.lines.map((line) => ({
      networkCode: line.networkCode,
      isPrimary: line.isPrimary,
      handle: line.handle,
      profileUrl: line.profileUrl,
      followersCount: line.followersCount,
      postsLast30Days: line.postsLast30Days,
      avgCommentsPerPost: line.avgCommentsPerPost,
      avgReachPerPost: line.avgReachPerPost,
      figuresConfirmedAt: line.figuresMeasuredAt,
      audienceCountries: line.audienceCountries,
      audienceAges: line.audienceAges,
      audienceGenders: line.audienceGenders,
    })),
    offerLines: stored.lists.formats.map((format) => ({
      networkCode: format.networkCode,
      formatCode: format.code,
    })),
    usageRights: stored.lists.usageRights,
    maxExclusivityBand: stored.maxExclusivity,
    availabilityBand: stored.availability,
  };
}

/** The score of the stored profile, as packages/domain computes it (07 RG86 to RG88). */
function scoreOf(stored: StoredCreatorProfile) {
  return creatorProfileCompleteness(profileInputOf(stored));
}

/**
 * The identifying elements the detection sees in the two public texts (07 RG27, RG28): the signal and
 * its place, never the text. Computed here, answered, forgotten: nothing is stored, nothing logged.
 */
function warningsOf(stored: StoredCreatorProfile): CreatorTextWarning[] {
  return (["headline", "bio"] as const).flatMap((field) =>
    locateDirectContact(stored[field]).map((finding): CreatorTextWarning => ({
      field,
      signal: finding.signal,
      start: finding.start,
      end: finding.end,
    })),
  );
}

/** The answer of both routes, from the stored profile and the active reference codes. */
function viewOf(
  stored: StoredCreatorProfile,
  references: ActiveCreatorReferences,
): CreatorProfileResponse {
  return creatorProfileResponseSchema.parse({
    status: stored.status,
    alias: stored.alias,
    residenceCountry: stored.residenceCountry,
    preferredLanguage: stored.preferredLanguage,
    headline: stored.headline,
    bio: stored.bio,
    collaborationExperience: stored.collaborationExperience,
    primaryTopic: stored.primaryTopic,
    secondaryTopics: stored.lists.secondaryTopics,
    tones: stored.lists.tones,
    publicationLanguages: stored.lists.publicationLanguages,
    residenceRegion: stored.residenceRegion,
    travelScope: stored.travelScope,
    formats: stored.lists.formats.map((format) => format.code),
    usageRights: stored.lists.usageRights,
    deliveryLead: stored.deliveryLead,
    maxExclusivity: stored.maxExclusivity,
    acceptsNonMonetary: stored.acceptsNonMonetary,
    availability: stored.availability,
    availabilityDeclaredAt: stored.availabilityDeclaredAt,
    refusedSectors: stored.lists.refusedSectors,
    identity: stored.identity,
    completeness: scoreOf(stored),
    missingRequired: missingCreatorRequiredFields(profileInputOf(stored)),
    warnings: warningsOf(stored),
    references,
  });
}

/** A text that is only margins is no text: it empties the field (the database refuses a blank). */
function nullIfBlank(value: string | null): string | null {
  return value === null || value.trim() === "" ? null : value;
}

/** Same, for a field the body may leave out: an absent key stays absent. */
function nullIfBlankOrAbsent(
  value: string | null | undefined,
): string | null | undefined {
  return value === undefined ? undefined : nullIfBlank(value);
}

/**
 * GET: the profile of the session's own account. A creator without a storefront reads as an empty
 * draft (the role was granted after the sign-up); the account being gone, null.
 */
export async function readCreatorProfile(
  tx: Transaction,
): Promise<CreatorProfileResponse | null> {
  const stored = await readOwnCreatorProfile(tx);
  if (stored === null) {
    return null;
  }
  return viewOf(
    stored,
    await readActiveCreatorReferences(tx, stored.residenceCountry),
  );
}

/** Codes outside the active reference lists, one issue per field (never the value, RG14). */
function unknownCodeIssues(
  body: UpdateCreatorProfileBody,
  references: ActiveCreatorReferences,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const check = (path: string, codes: readonly string[], active: string[]) => {
    const known = new Set(active);
    if (codes.some((code) => !known.has(code))) {
      issues.push({ path, issue: "unknown" });
    }
  };
  if (body.primaryTopic !== undefined && body.primaryTopic !== null) {
    check("primaryTopic", [body.primaryTopic], references.topics);
  }
  if (body.secondaryTopics !== undefined) {
    check("secondaryTopics", body.secondaryTopics, references.topics);
  }
  if (body.tones !== undefined) {
    check("tones", body.tones, references.tones);
  }
  if (body.publicationLanguages !== undefined) {
    check(
      "publicationLanguages",
      body.publicationLanguages,
      references.languages,
    );
  }
  if (body.residenceRegion !== undefined && body.residenceRegion !== null) {
    check("residenceRegion", [body.residenceRegion], references.regions);
  }
  if (body.formats !== undefined) {
    check(
      "formats",
      body.formats,
      references.formats.map((format) => format.code),
    );
  }
  if (body.usageRights !== undefined) {
    check(
      "usageRights",
      body.usageRights.map((right) => right.code),
      references.usageRights,
    );
  }
  if (body.refusedSectors !== undefined) {
    check("refusedSectors", body.refusedSectors, references.sectors);
  }
  return issues;
}

/** The identity changes of the body: a blank text empties the field, a code or a number is as sent. */
function identityChangesOf(
  identity: NonNullable<UpdateCreatorProfileBody["identity"]>,
): CreatorIdentityChanges {
  return {
    legalFirstName: nullIfBlankOrAbsent(identity.legalFirstName),
    legalLastName: nullIfBlankOrAbsent(identity.legalLastName),
    contactEmail: identity.contactEmail,
    contactPhone: identity.contactPhone,
    addressLine: nullIfBlankOrAbsent(identity.addressLine),
    postalCode: identity.postalCode,
    city: nullIfBlankOrAbsent(identity.city),
    addressCountry: identity.addressCountry,
  };
}

/**
 * PATCH: autosave of what changed, in ONE transaction (the storefront locked first). The main topic is
 * removed from the secondary ones (07 RG33: once, whichever list the creator touched); lists are
 * replaced as a whole; the completeness is recomputed by packages/domain and stored (RG86). Country
 * and language are the account's and are never written here (RG2, CA2). The answer carries the
 * non-blocking warnings of the detection (RG27), which are never stored.
 */
export async function saveCreatorProfile(
  tx: Transaction,
  body: UpdateCreatorProfileBody,
): Promise<UpdateCreatorProfileResponse> {
  await lockWritableCreatorProfile(tx);
  const before = await readOwnCreatorProfile(tx);
  if (before === null) {
    throw new ApiError("not_found");
  }
  const references = await readActiveCreatorReferences(
    tx,
    before.residenceCountry,
  );
  const issues = unknownCodeIssues(body, references);
  if (issues.length > 0) {
    throw new RequestValidationError(issues);
  }

  const primaryTopic =
    body.primaryTopic === undefined ? before.primaryTopic : body.primaryTopic;
  // the main topic is not repeated among the secondary ones, whichever of the two changed
  const requestedSecondary =
    body.secondaryTopics === undefined
      ? before.lists.secondaryTopics
      : body.secondaryTopics;
  const secondaryTopics = requestedSecondary.filter(
    (code) => code !== primaryTopic,
  );
  const secondaryChanged =
    body.secondaryTopics !== undefined ||
    secondaryTopics.length !== before.lists.secondaryTopics.length;

  try {
    await updateCreatorStorefrontColumns(tx, {
      headline: nullIfBlankOrAbsent(body.headline),
      bio: nullIfBlankOrAbsent(body.bio),
      collaborationExperience: body.collaborationExperience,
      primaryTopic: body.primaryTopic,
      residenceRegion: body.residenceRegion,
      travelScope: body.travelScope,
      deliveryLead: body.deliveryLead,
      maxExclusivity: body.maxExclusivity,
      acceptsNonMonetary: body.acceptsNonMonetary,
      availability: body.availability,
    });
    if (secondaryChanged) {
      await replaceCreatorProfileList(tx, "secondaryTopics", secondaryTopics);
    }
    for (const name of Object.keys(
      CREATOR_PROFILE_LISTS,
    ) as (keyof typeof CREATOR_PROFILE_LISTS)[]) {
      if (name === "secondaryTopics") {
        continue;
      }
      const codes = body[name];
      if (codes !== undefined) {
        await replaceCreatorProfileList(tx, name, codes);
      }
    }
    if (body.usageRights !== undefined) {
      await replaceCreatorUsageRights(tx, body.usageRights);
    }
    if (body.identity !== undefined) {
      await updateCreatorIdentity(tx, identityChangesOf(body.identity));
    }
  } catch (error) {
    // What the checks above cannot know: a constraint the database holds (0216, 0217), or the guard.
    const state = sqlStateOf(error);
    if (state === "23514" || state === "23503" || state === "22023") {
      throw new RequestValidationError([{ path: "", issue: "invalid" }]);
    }
    if (state === "55000") {
      throw new ApiError("conflict");
    }
    throw error;
  }

  const stored = await readOwnCreatorProfile(tx);
  if (stored === null) {
    throw new ApiError("not_found");
  }
  await storeCreatorScore(tx, scoreOf(stored).score);
  return viewOf(stored, references);
}

/**
 * The completeness after a change of a network line or of the audience (commit 09), recomputed by
 * packages/domain and stored (RG86); the one door to the score besides the autosave. With it, the
 * required fields still missing, in the order of the form (RG90).
 */
export async function refreshStoredCreatorScore(
  tx: Transaction,
): Promise<CreatorProfileProgress> {
  const stored = await readOwnCreatorProfile(tx);
  if (stored === null) {
    throw new ApiError("not_found");
  }
  const progress = progressOf(stored);
  await storeCreatorScore(tx, progress.completeness.score);
  return progress;
}

/** The same, read only: what a GET of the lines answers, nothing stored. */
export async function readCreatorProgress(
  tx: Transaction,
): Promise<CreatorProfileProgress> {
  const stored = await readOwnCreatorProfile(tx);
  if (stored === null) {
    throw new ApiError("not_found");
  }
  return progressOf(stored);
}

/** The completeness and the required fields still missing (07 RG86 to RG90). */
export type CreatorProfileProgress = {
  completeness: CreatorProfileResponse["completeness"];
  missingRequired: CreatorProfileResponse["missingRequired"];
};

function progressOf(stored: StoredCreatorProfile): CreatorProfileProgress {
  return {
    completeness: creatorProfileResponseSchema.shape.completeness.parse(
      scoreOf(stored),
    ),
    missingRequired: creatorProfileResponseSchema.shape.missingRequired.parse(
      missingCreatorRequiredFields(profileInputOf(stored)),
    ),
  };
}

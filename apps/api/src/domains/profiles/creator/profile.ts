// The creator profile of the member's own account: read and autosave of blocks 1, 2 and 5 (docs/mvp/07
// RG1, RG2, RG14, RG16, RG25 to RG40, RG64 to RG76, RG86 to RG91, CA2; jalons/l2d, commit 08). The
// rules live elsewhere and are only called here:
// - completeness, required fields and the detection of an identifying element in a public text:
//   packages/domain (a `*Completeness*` function outside it fails a guard, stockage.md §9);
// - closed lists, caps, `none`, the shape of every value: the database (0216, 0217), which arbitrates;
//   this file checks first only to say WHICH field is wrong;
// - the alias, the status, the bands derived from exact figures and the date of the availability: the
//   system's, written by no member and by no route of this file (invariant 7 of the fiche).
// And, from L2G commit 08, the submission, the regime of a published profile and the switch of RG8:
// - POST submit: the door of 0243 lists what is missing (RG4, RG90, nothing written) or opens the entry
//   of queue 2; the status is moved by that door alone, never by a write of the member (L2DS-4);
// - a PUBLISHED profile (RG9): a change of its title or its bio waits for review, the validated version
//   being the one served (CA48); every other field is immediate (CA49); `suspended` is frozen;
// - the refusal and the revisions waiting are served to their owner (RG10), never the agent, the lock
//   nor the internal comment (T14).
// There is no tariff (D78, D48), and no network line or audience here (networks.ts; read here for the
// completeness).
import {
  CREATOR_REJECTION_NEXT_STEP_OF,
  creatorProfileResponseSchema,
  creatorRejectionReasonCodeSchema,
  creatorVisibilityResponseSchema,
  submitCreatorProfileResponseSchema,
  type CreatorProfileResponse,
  type CreatorTextWarning,
  type CreatorVisibilityResponse,
  type SubmitCreatorProfileResponse,
  type UpdateCreatorProfileBody,
  type UpdateCreatorProfileResponse,
} from "@influx/contracts/creator-profile";
import type { ValidationIssue } from "@influx/contracts/errors";
import {
  creatorProfileCompleteness,
  locateDirectContact,
  missingCreatorRequiredFields,
  portfolioInputOf,
  type CreatorProfileInput,
} from "@influx/domain/creator-profile";
import type { Transaction } from "../../../db/index.ts";
import {
  sqlDetailOf,
  sqlMessageOf,
  sqlStateOf,
} from "../../../db/sql-state.ts";
import { ApiError, RequestValidationError } from "../../../platform/errors.ts";
import {
  CREATOR_PROFILE_LISTS,
  lockOwnCreatorStorefront,
  readActiveCreatorReferences,
  readOwnCreatorProfile,
  recordOwnCreatorProfileChange,
  replaceCreatorProfileList,
  replaceCreatorUsageRights,
  setOwnCreatorSearchable,
  submitOwnCreatorProfile,
  submitOwnCreatorRevision,
  updateCreatorIdentity,
  updateCreatorStorefrontColumns,
  type ActiveCreatorReferences,
  type CreatorIdentityChanges,
  type StoredCreatorProfile,
} from "./repository.ts";

/**
 * The states a creator writes in. A published profile has the regime of RG9 (a moderated field waits for
 * review, the others are immediate); `suspended` is frozen, and so is a state this code does not know
 * (EC-L2D-08-3).
 */
const WRITABLE_STATUSES: ReadonlySet<string> = new Set([
  "draft",
  "pending_review",
  "published",
  "rejected",
]);

/**
 * Locks the storefront for the rest of the transaction (two saves at the same moment are serialised)
 * and refuses a write when the profile is not in a state a creator writes in, or does not exist: an
 * empty draft the member cannot create (0216 §5.3). Shared by the autosave and the network routes;
 * answers the status, which a published profile reads differently (RG9).
 */
export async function lockWritableCreatorProfile(
  tx: Transaction,
): Promise<string> {
  const status = await lockOwnCreatorStorefront(tx);
  if (status === null || !WRITABLE_STATUSES.has(status)) {
    throw new ApiError("conflict");
  }
  return status;
}

/**
 * A write the guard of 0243 refused on a moderated field (55000 `moderated_field`, the field code in
 * the DETAIL): a conflict naming the field, never its value. Null for any other error.
 */
export function moderatedFieldConflict(error: unknown): ApiError | null {
  if (
    sqlStateOf(error) !== "55000" ||
    sqlMessageOf(error) !== "moderated_field"
  ) {
    return null;
  }
  const field = (sqlDetailOf(error) ?? "").replace(/^creator\./, "");
  return new ApiError("conflict", [{ path: field, issue: "moderated_field" }]);
}

/** The database's code of a required field (snake_case) as the contract names it (camelCase). */
function requiredFieldOf(code: string): string {
  return code.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
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
    badgeRequested: stored.badgeRequested,
    // L2G 07: the visuals deposited, counted by packages/domain (RG4, RG88)
    ...portfolioInputOf(stored.portfolio),
    // L2G 08 (08 RG16): an active « Compte vérifié », read by the list of the required fields only
    accountVerified: stored.accountVerified,
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
function warningsOf(texts: Texts): CreatorTextWarning[] {
  return (["headline", "bio"] as const).flatMap((field) =>
    locateDirectContact(texts[field]).map((finding): CreatorTextWarning => ({
      field,
      signal: finding.signal,
      start: finding.start,
      end: finding.end,
    })),
  );
}

type Texts = { headline: string | null; bio: string | null };

/**
 * The two texts as their owner reads them: on a published profile, what he typed while it waits for
 * review (CA48), else what is stored. A brand is served the stored ones, never these.
 */
function textsOf(stored: StoredCreatorProfile): Texts {
  const typed = (field: "headline" | "bio"): string | null => {
    const revision = stored.pendingRevisions.find(
      (pending) => pending.fieldCode === `creator.${field}`,
    );
    return typeof revision?.proposed === "string"
      ? revision.proposed
      : stored[field];
  };
  return { headline: typed("headline"), bio: typed("bio") };
}

/**
 * The last refusal while it stands (RG10, CA51): a refused submission of a profile that is still
 * `rejected`, a refused revision of a profile that is still `published`. The step is the catalogue's.
 */
function refusalOf(
  stored: StoredCreatorProfile,
): CreatorProfileResponse["refusal"] {
  const refusal = stored.lastRefusal;
  if (
    refusal === null ||
    (refusal.kind === "submission" ? "rejected" : "published") !== stored.status
  ) {
    return null;
  }
  const reasonCode = creatorRejectionReasonCodeSchema.parse(refusal.reasonCode);
  return {
    kind: refusal.kind,
    reasonCode,
    nextStep: CREATOR_REJECTION_NEXT_STEP_OF[reasonCode],
    memberMessage: refusal.memberMessage,
    decidedAt: refusal.decidedAt,
  };
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
    headline: textsOf(stored).headline,
    bio: textsOf(stored).bio,
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
    isSearchable: stored.isSearchable,
    refusal: refusalOf(stored),
    pendingRevisions: stored.pendingRevisions.map((pending) => ({
      field: pending.fieldCode.replace(/^creator\./, ""),
      rowKey: pending.rowKey,
    })),
    warnings: warningsOf(textsOf(stored)),
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
 * replaced as a whole; on a PUBLISHED profile the title and the bio go to review while the validated
 * ones stay served (RG9, CA48), every other field being saved at once (CA49); the stored completeness is recomputed by the database (RG86, 0243
 * record_own_creator_profile_change, its copy held equal to packages/domain by parity). Country
 * and language are the account's and are never written here (RG2, CA2). The answer carries the
 * non-blocking warnings of the detection (RG27), which are never stored.
 */
export async function saveCreatorProfile(
  tx: Transaction,
  body: UpdateCreatorProfileBody,
): Promise<UpdateCreatorProfileResponse> {
  const status = await lockWritableCreatorProfile(tx);
  const published = status === "published";
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
    const texts = {
      headline: nullIfBlankOrAbsent(body.headline),
      bio: nullIfBlankOrAbsent(body.bio),
    };
    if (published) {
      // RG9: a text of a published profile waits for review, the live row keeps the validated one
      for (const field of ["headline", "bio"] as const) {
        const value = texts[field];
        if (value !== undefined) {
          await submitOwnCreatorRevision(tx, `creator.${field}`, null, value);
        }
      }
    }
    await updateCreatorStorefrontColumns(tx, {
      headline: published ? undefined : texts.headline,
      bio: published ? undefined : texts.bio,
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
    const detail = sqlDetailOf(error);
    if (
      state === "23514" &&
      published &&
      (detail === "headline" || detail === "bio")
    ) {
      // the door of RG9 refuses a title or a bio a published profile cannot do without (RG16, RG90)
      throw new RequestValidationError([{ path: detail, issue: "required" }]);
    }
    if (state === "23514" || state === "23503" || state === "22023") {
      throw new RequestValidationError([{ path: "", issue: "invalid" }]);
    }
    if (state === "55000") {
      throw moderatedFieldConflict(error) ?? new ApiError("conflict");
    }
    throw error;
  }

  const stored = await readOwnCreatorProfile(tx);
  if (stored === null) {
    throw new ApiError("not_found");
  }
  await recordOwnCreatorProfileChange(tx);
  return viewOf(stored, references);
}

/**
 * POST submit: "Publier mon profil" (07 RG4, RG10). The door of 0243 answers the required fields still
 * missing, in the order of the form (nothing is written: the profile keeps its state, RG90), or moves a
 * `draft` or `rejected` profile to `pending_review` and opens its entry in queue 2; a profile already
 * waiting answers as it is. A published or suspended one is left by a decision of INFLUX alone (RG5): 409.
 * The detection of RG27 only warns: a bio holding an identifier is submitted and signalled to the agent.
 */
export async function submitCreatorProfile(
  tx: Transaction,
): Promise<SubmitCreatorProfileResponse> {
  let result: { status: string; missing: string[] };
  try {
    result = await submitOwnCreatorProfile(tx);
  } catch (error) {
    const state = sqlStateOf(error);
    if (state === "42501") {
      throw new ApiError("not_found");
    }
    if (state === "55000") {
      throw new ApiError("conflict");
    }
    throw error;
  }
  return submitCreatorProfileResponseSchema.parse({
    status: result.status,
    missing: result.missing.map(requiredFieldOf),
  });
}

/**
 * PUT visibility: the switch « visible dans la recherche » (07 RG8), in any state but `suspended`. A
 * column the member writes himself; no effect is readable before the search of Lot 3.
 */
export async function setCreatorVisibility(
  tx: Transaction,
  isSearchable: boolean,
): Promise<CreatorVisibilityResponse> {
  const status = await lockOwnCreatorStorefront(tx);
  if (status === null) {
    throw new ApiError("not_found");
  }
  if (status === "suspended") {
    throw new ApiError("conflict");
  }
  let stored: boolean | null;
  try {
    stored = await setOwnCreatorSearchable(tx, isSearchable);
  } catch (error) {
    if (sqlStateOf(error) === "55000") {
      throw new ApiError("conflict");
    }
    throw error;
  }
  if (stored === null) {
    throw new ApiError("not_found");
  }
  return creatorVisibilityResponseSchema.parse({ isSearchable: stored });
}

/**
 * The completeness after a change of a network line or of the audience (commit 09): shown as
 * packages/domain computes it, stored as the database recomputes it (RG86, 0243); the one door to the
 * score besides the autosave. With it, the
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
  await recordOwnCreatorProfileChange(tx);
  return progress;
}

/**
 * The same after a change of the portfolio (L2G 07): the score stored by the database, and what the
 * answer of the deposit or of the removal carries (the visuals deposited, the score shown, the status).
 */
export async function refreshCreatorScoreAfterPortfolio(
  tx: Transaction,
): Promise<{
  deposited: number;
  completeness: CreatorProfileResponse["completeness"];
  status: CreatorProfileResponse["status"];
}> {
  const stored = await readOwnCreatorProfile(tx);
  if (stored === null) {
    throw new ApiError("not_found");
  }
  await recordOwnCreatorProfileChange(tx);
  return {
    deposited: portfolioInputOf(stored.portfolio).portfolioDeposited ?? 0,
    completeness: progressOf(stored).completeness,
    status: creatorProfileResponseSchema.shape.status.parse(stored.status),
  };
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

// The brand profile of the member's own account: read, autosave, submit (docs/mvp/06 RG2, RG5,
// RG14, RG17, RG57 to RG61, CA1 to CA7; jalons/l2b, commit 07; the regime of a published profile,
// 06 RG9, CA15, CA16, jalons/l2c commit 13). The rules live elsewhere and are only called here:
// - completeness, required fields and the reduction of the website to a domain: packages/domain
//   (a `*Completeness*` function outside it fails a guard, stockage.md §9);
// - closed lists, caps, `none`, domain shape, state transitions: the database (0202, 0203), which
//   arbitrates; this file checks first only to say WHICH field is wrong;
// - the regime of a PUBLISHED profile (06 RG9): a moderated field is proposed through the door of the
//   database (0209) and waits for review, the live row keeps the validated value; a field with
//   immediate effect is written at once and emits ONE lead.updated (RG78). The guard of the database
//   refuses the same writes around the API (L2BS-1).
// No amount, rate or price appears here (CLAUDE.md §2, D48, D78): the indicative budget is not
// offered, the logo has its own route (commit 09), and a badge request FILED counts in the completeness
// (06 RG59; L2E commit 15), never a badge obtained.
import {
  brandProfileResponseSchema,
  type BrandProfileResponse,
  type SubmitBrandProfileResponse,
  type UpdateBrandProfileBody,
  type UpdateBrandProfileResponse,
} from "@influx/contracts/brand-profile";
import type { ValidationIssue } from "@influx/contracts/errors";
import {
  BRAND_PROFILE_REQUIRED_FIELDS,
  brandProfileCompleteness,
  missingRequiredFields,
  normalizeWebsiteDomain,
  type BrandProfileRequiredField,
} from "@influx/domain/brand-profile";
import type { Transaction } from "../../db/index.ts";
import { sqlStateOf } from "../../db/sql-state.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import { uiLocaleSchema } from "@influx/contracts/auth";
import {
  rejectionReasonOf,
  rejectionReasonPreview,
} from "./brand-decision-email.ts";
import {
  proposeRevision,
  readLastRefusal,
  readPendingChanges,
  recordImmediateChange,
} from "./revisions/repository.ts";
import {
  BRAND_PROFILE_LISTS,
  detailOf,
  lockOwnBrandProfile,
  readActiveReferences,
  readOwnBrandProfile,
  renameCompany,
  replaceBrandProfileList,
  storeScore,
  submitOwnBrandProfile,
  updateBrandProfileColumns,
  upsertContact,
  type ActiveReferences,
  type BrandProfileColumns,
  type BrandProfileListName,
  type ContactChanges,
  type StoredBrandProfile,
} from "./repository.ts";

/**
 * How a write to the profile of each state goes (jalons/l2c/file.md A3, A4; 06 RG9):
 * - `direct`: draft, under review (the token of the review changes, the agent reads again), refused;
 * - `revision`: published, a moderated field waits for review, the others apply at once;
 * - `frozen`: suspended (and any state this code does not know): refused, the guard of the base too.
 */
type WriteRegime = "direct" | "revision" | "frozen";

function regimeOf(status: string): WriteRegime {
  switch (status) {
    case "draft":
    case "pending_review":
    case "rejected":
      return "direct";
    case "published":
      return "revision";
    default:
      return "frozen";
  }
}

/** The reference list each list of the profile draws its codes from. */
const REFERENCE_OF_LIST: Record<BrandProfileListName, keyof ActiveReferences> =
  {
    secondarySectors: "sectors",
    targetMarkets: "countries",
    workingLanguages: "languages",
    topics: "topics",
    networks: "networks",
    formats: "formats",
    audienceCountries: "countries",
    usageRights: "usageRights",
  };

function requiredInputOf(stored: StoredBrandProfile) {
  return {
    legalName: stored.legalName,
    primarySector: stored.primarySector,
    companySize: stored.companySize,
    country: stored.country,
    targetMarkets: stored.lists.targetMarkets,
    workingLanguages: stored.lists.workingLanguages,
    presentation: stored.presentation,
    topics: stored.lists.topics,
    networks: stored.lists.networks,
    formats: stored.lists.formats,
    audienceCountries: stored.lists.audienceCountries,
    contactRole: stored.contactRole,
  };
}

/** The score of the stored profile, as packages/domain computes it (06 RG57 to RG59). */
function scoreOf(stored: StoredBrandProfile) {
  return brandProfileCompleteness({
    ...requiredInputOf(stored),
    // An active row of profiles.brand_logo_objects (0204; its own routes, brand-logo.ts).
    hasLogo: stored.hasLogo,
    usageRights: stored.lists.usageRights,
    websiteDomain: stored.websiteDomain,
    // a request filed counts, never a badge obtained (06 RG59, CA36)
    badgeRequested: stored.badgeRequested,
    contactPhone: stored.contact.phone,
    contactEmail: stored.contact.email,
  });
}

/** What a published profile holds besides its validated values (06 RG9, RG10). */
type ReviewState = Pick<BrandProfileResponse, "pendingChanges" | "refusal">;

/**
 * The changes waiting for review and the last refusal, the message of the reason in the language of
 * the account (06 RG66, CA20; the same translation files as the e-mail of the decision).
 */
async function readReviewState(
  tx: Transaction,
  stored: StoredBrandProfile,
): Promise<ReviewState> {
  const pendingChanges = await readPendingChanges(tx);
  const last = await readLastRefusal(tx);
  const reason = last === null ? null : rejectionReasonOf(last.reasonCode);
  if (last === null || reason === null) {
    return { pendingChanges, refusal: null };
  }
  const preview = rejectionReasonPreview(
    uiLocaleSchema.parse(stored.preferredLanguage),
    reason,
  );
  return {
    pendingChanges,
    refusal: {
      kind: last.kind,
      reasonCode: reason,
      message: preview.message,
      // only `other` carries a text of the agent (06 RG66); never the internal comment (D46)
      memberMessage: reason === "other" ? last.memberMessage : null,
      fields: last.fields,
      decidedAt: last.decidedAt,
    },
  };
}

/** The answer of the three routes, from the stored profile and the active reference codes. */
function viewOf(
  stored: StoredBrandProfile,
  references: ActiveReferences,
  review: ReviewState,
): BrandProfileResponse {
  return brandProfileResponseSchema.parse({
    status: stored.status,
    submittedAt: stored.submittedAt,
    companyName: stored.legalName,
    country: stored.country,
    preferredLanguage: stored.preferredLanguage,
    primarySector: stored.primarySector,
    secondarySectors: stored.lists.secondarySectors,
    companySize: stored.companySize,
    targetMarkets: stored.lists.targetMarkets,
    workingLanguages: stored.lists.workingLanguages,
    website: stored.websiteDomain,
    presentation: stored.presentation,
    topics: stored.lists.topics,
    networks: stored.lists.networks,
    formats: stored.lists.formats,
    audienceCountries: stored.lists.audienceCountries,
    usageRights: stored.lists.usageRights,
    exclusivityBand: stored.exclusivityBand,
    collaborationRhythm: stored.collaborationRhythm,
    offersNonMonetary: stored.offersNonMonetary,
    contactRole: stored.contactRole,
    contact: stored.contact,
    signInEmail: stored.signInEmail,
    completeness: scoreOf(stored),
    missingRequired: missingRequiredFields(requiredInputOf(stored)),
    references,
    pendingChanges: review.pendingChanges,
    refusal: review.refusal,
  });
}

/** A text that is only margins is no text: it empties the field (the database refuses a blank). */
function nullIfBlank(value: string | null): string | null {
  return value === null || value.trim() === "" ? null : value;
}

/** GET: the profile of the session's own account, or null when the account holds none. */
export async function readBrandProfile(
  tx: Transaction,
): Promise<BrandProfileResponse | null> {
  const stored = await readOwnBrandProfile(tx);
  if (stored === null) {
    return null;
  }
  return viewOf(
    stored,
    await readActiveReferences(tx),
    await readReviewState(tx, stored),
  );
}

/** Codes outside the active reference lists, one issue per list (never the value, RG14). */
function unknownCodeIssues(
  body: UpdateBrandProfileBody,
  references: ActiveReferences,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const check = (path: string, codes: readonly string[], active: string[]) => {
    const known = new Set(active);
    if (codes.some((code) => !known.has(code))) {
      issues.push({ path, issue: "unknown" });
    }
  };
  if (body.primarySector !== undefined && body.primarySector !== null) {
    check("primarySector", [body.primarySector], references.sectors);
  }
  for (const name of Object.keys(
    BRAND_PROFILE_LISTS,
  ) as BrandProfileListName[]) {
    const codes = body[name];
    if (codes !== undefined) {
      check(name, codes, references[REFERENCE_OF_LIST[name]]);
    }
  }
  return issues;
}

/**
 * The required fields a save on a PUBLISHED profile would empty (EC-L2C-01-2): a published profile
 * never goes back below what a submission requires, so the API refuses it, naming the key of the
 * body; the database rechecks at every publication. Only fields this body touches are named.
 */
function emptiedRequiredIssues(
  stored: StoredBrandProfile,
  body: UpdateBrandProfileBody,
): ValidationIssue[] {
  const current = requiredInputOf(stored);
  const merged = {
    ...current,
    legalName: body.companyName ?? current.legalName,
    primarySector:
      body.primarySector === undefined
        ? current.primarySector
        : body.primarySector,
    companySize:
      body.companySize === undefined ? current.companySize : body.companySize,
    targetMarkets: body.targetMarkets ?? current.targetMarkets,
    workingLanguages: body.workingLanguages ?? current.workingLanguages,
    presentation:
      body.presentation === undefined
        ? current.presentation
        : nullIfBlank(body.presentation),
    topics: body.topics ?? current.topics,
    networks: body.networks ?? current.networks,
    formats: body.formats ?? current.formats,
    audienceCountries: body.audienceCountries ?? current.audienceCountries,
    contactRole:
      body.contactRole === undefined ? current.contactRole : body.contactRole,
  };
  return missingRequiredFields(merged)
    .filter((field) =>
      Object.hasOwn(body, field === "legalName" ? "companyName" : field),
    )
    .map((field) => ({
      path: field === "legalName" ? "companyName" : field,
      issue: "required",
    }));
}

/** What a save changes at once on a published profile: the fields with immediate effect (06 RG9). */
function immediateSnapshotOf(stored: StoredBrandProfile): string {
  return JSON.stringify([
    stored.companySize,
    stored.exclusivityBand,
    stored.collaborationRhythm,
    stored.offersNonMonetary,
    stored.lists,
    stored.contact,
  ]);
}

/**
 * PATCH: autosave of what changed, in ONE transaction (the row locked first). The trading name goes
 * through the door of the account (CA3), the website is reduced to its domain (RG17, CA4), lists
 * are replaced as a whole, the completeness is recomputed by packages/domain and stored (RG57).
 * By state (06 RG9; file.md A3): written at once before publication and while it is examined (the
 * agent reads again); on a PUBLISHED profile a moderated field is proposed, the validated value stays
 * and the answer shows it with the change waiting (CA15), a field with immediate effect applies at
 * once with ONE lead.updated (CA16, RG78); suspended is refused (conflict).
 */
export async function saveBrandProfile(
  tx: Transaction,
  body: UpdateBrandProfileBody,
): Promise<UpdateBrandProfileResponse> {
  const status = await lockOwnBrandProfile(tx);
  if (status === null) {
    throw new ApiError("not_found");
  }
  const regime = regimeOf(status);
  if (regime === "frozen") {
    throw new ApiError("conflict");
  }
  const before = await readOwnBrandProfile(tx);
  if (before === null) {
    throw new ApiError("not_found");
  }
  const references = await readActiveReferences(tx);
  const issues = unknownCodeIssues(body, references);

  let websiteDomain: string | null | undefined;
  let websiteNormalized = false;
  if (body.website !== undefined) {
    const typed = body.website === null ? "" : body.website;
    if (typed.trim() === "") {
      websiteDomain = null;
    } else {
      const reduced = normalizeWebsiteDomain(typed);
      if (reduced.ok) {
        websiteDomain = reduced.domain;
        websiteNormalized = reduced.reduced;
      } else {
        issues.push({ path: "website", issue: reduced.reason });
      }
    }
  }
  if (regime === "revision") {
    issues.push(...emptiedRequiredIssues(before, body));
  }
  if (issues.length > 0) {
    throw new RequestValidationError(issues);
  }

  const presentation =
    body.presentation === undefined
      ? undefined
      : nullIfBlank(body.presentation);
  try {
    if (body.companyName !== undefined) {
      // the same door in both regimes: published, it proposes the name and keeps the validated one
      await renameCompany(tx, body.companyName);
    }
    if (regime === "revision") {
      if (body.primarySector !== undefined) {
        await proposeRevision(tx, "primarySector", body.primarySector);
      }
      if (presentation !== undefined) {
        await proposeRevision(tx, "presentation", presentation);
      }
      if (websiteDomain !== undefined) {
        await proposeRevision(tx, "website", websiteDomain);
      }
      if (body.contactRole !== undefined) {
        await proposeRevision(tx, "contactRole", body.contactRole);
      }
    }
    const columns: BrandProfileColumns = {
      companySize: body.companySize,
      exclusivityBand: body.exclusivityBand,
      collaborationRhythm: body.collaborationRhythm,
      offersNonMonetary: body.offersNonMonetary,
      ...(regime === "direct"
        ? {
            primarySector: body.primarySector,
            websiteDomain,
            presentation,
            contactRole: body.contactRole,
          }
        : {}),
    };
    await updateBrandProfileColumns(tx, columns);
    for (const name of Object.keys(
      BRAND_PROFILE_LISTS,
    ) as BrandProfileListName[]) {
      const codes = body[name];
      if (codes !== undefined) {
        await replaceBrandProfileList(tx, name, codes);
      }
    }
    if (body.contact !== undefined) {
      const contact: ContactChanges = {
        firstName:
          body.contact.firstName === undefined
            ? undefined
            : nullIfBlank(body.contact.firstName),
        email: body.contact.email,
        phone: body.contact.phone,
        url: body.contact.url,
      };
      await upsertContact(tx, contact);
    }
  } catch (error) {
    // What the checks above cannot know: a constraint the database holds (0106, 0202), or the guard.
    const state = sqlStateOf(error);
    if (state === "23514" || state === "23503" || state === "22023") {
      throw new RequestValidationError([{ path: "", issue: "invalid" }]);
    }
    if (state === "55000") {
      throw new ApiError("conflict");
    }
    throw error;
  }

  const stored = await readOwnBrandProfile(tx);
  if (stored === null) {
    throw new ApiError("not_found");
  }
  await storeScore(tx, scoreOf(stored).score);
  // RG78: ONE lead.updated per save that changed a validated value; none for a proposal alone
  if (
    regime === "revision" &&
    immediateSnapshotOf(before) !== immediateSnapshotOf(stored)
  ) {
    await recordImmediateChange(tx);
  }
  return {
    ...viewOf(stored, references, await readReviewState(tx, stored)),
    websiteNormalized,
  };
}

/**
 * Locks the profile row and checks it may be written, returning whether it is published: no profile
 * is "no such route" (T14); a suspended one (or an unknown state) is a conflict. A published profile
 * is writable: the doors of the database decide what applies at once and what waits (06 RG9).
 */
export async function lockEditableBrandProfile(
  tx: Transaction,
): Promise<"published" | "other"> {
  const status = await lockOwnBrandProfile(tx);
  if (status === null) {
    throw new ApiError("not_found");
  }
  if (regimeOf(status) === "frozen") {
    throw new ApiError("conflict");
  }
  return status === "published" ? "published" : "other";
}

/** The completeness after a change of the logo, recomputed by packages/domain and stored (RG57). */
export async function refreshStoredScore(
  tx: Transaction,
): Promise<BrandProfileResponse["completeness"]> {
  const stored = await readOwnBrandProfile(tx);
  if (stored === null) {
    throw new ApiError("not_found");
  }
  const completeness = scoreOf(stored);
  await storeScore(tx, completeness.score);
  return brandProfileResponseSchema.shape.completeness.parse(completeness);
}

/** `legal_name` of the database, `legalName` of the contract and of packages/domain. */
function requiredFieldOfDetail(
  detail: string | null,
): BrandProfileRequiredField | null {
  if (detail === null) {
    return null;
  }
  const camel = detail.replace(/_([a-z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  );
  return (BRAND_PROFILE_REQUIRED_FIELDS as readonly string[]).includes(camel)
    ? (camel as BrandProfileRequiredField)
    : null;
}

/**
 * POST submit (RG5, CA6, CA7): draft or rejected to pending_review, if no required field is missing.
 * The database decides and journals (`profile.submitted`); a refusal names EVERY missing field,
 * read before the attempt from packages/domain, the one the database found otherwise.
 */
export async function submitBrandProfile(
  tx: Transaction,
): Promise<SubmitBrandProfileResponse> {
  const before = await readOwnBrandProfile(tx);
  if (before === null) {
    throw new ApiError("not_found");
  }
  const missing = missingRequiredFields(requiredInputOf(before));
  let outcome;
  try {
    outcome = await submitOwnBrandProfile(tx);
  } catch (error) {
    switch (sqlStateOf(error)) {
      case "23514": {
        const found = requiredFieldOfDetail(detailOf(error));
        const fields =
          missing.length > 0 ? missing : found === null ? [] : [found];
        if (fields.length === 0) {
          throw error;
        }
        throw new RequestValidationError(
          fields.map((field) => ({ path: field, issue: "required" })),
        );
      }
      case "55000":
        throw new ApiError("conflict");
      case "42501":
        throw new ApiError("not_found");
      default:
        throw error;
    }
  }
  const stored = await readOwnBrandProfile(tx);
  if (stored === null) {
    throw new ApiError("not_found");
  }
  return {
    ...viewOf(
      stored,
      await readActiveReferences(tx),
      await readReviewState(tx, stored),
    ),
    changed: outcome.changed,
  };
}

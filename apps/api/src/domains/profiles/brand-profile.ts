// The brand profile of the member's own account: read, autosave, submit (docs/mvp/06 RG2, RG5,
// RG14, RG17, RG57 to RG61, CA1 to CA7; jalons/l2b, commit 07). The rules live elsewhere and are
// only called here:
// - completeness, required fields and the reduction of the website to a domain: packages/domain
//   (a `*Completeness*` function outside it fails a guard, stockage.md §9);
// - closed lists, caps, `none`, domain shape, state transitions: the database (0202, 0203), which
//   arbitrates; this file checks first only to say WHICH field is wrong.
// No amount, rate or price appears here (CLAUDE.md §2, D48, D78): the indicative budget and the
// badge are not offered (answer A of jalon L2B), the logo has its own route (commit 09).
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

/** Written only while the profile is waiting for the brand or for INFLUX; see `saveBrandProfile`. */
const EDITABLE_STATUSES: ReadonlySet<string> = new Set([
  "draft",
  "pending_review",
  "rejected",
]);

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
    badgeRequested: false,
    contactPhone: stored.contact.phone,
    contactEmail: stored.contact.email,
  });
}

/** The answer of the three routes, from the stored profile and the active reference codes. */
function viewOf(
  stored: StoredBrandProfile,
  references: ActiveReferences,
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
  return viewOf(stored, await readActiveReferences(tx));
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
 * PATCH: autosave of what changed, in ONE transaction (the row locked first). The trading name goes
 * through the door of the account (CA3), the website is reduced to its domain (RG17, CA4), lists
 * are replaced as a whole, the completeness is recomputed by packages/domain and stored (RG57).
 * Edits stop at `published` and `suspended`: a change to a published profile needs the review of
 * L2C (06 RG9), which does not exist yet (EC-L2B-07-1).
 */
export async function saveBrandProfile(
  tx: Transaction,
  body: UpdateBrandProfileBody,
): Promise<UpdateBrandProfileResponse> {
  const status = await lockOwnBrandProfile(tx);
  if (status === null) {
    throw new ApiError("not_found");
  }
  if (!EDITABLE_STATUSES.has(status)) {
    throw new ApiError("conflict");
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
  if (issues.length > 0) {
    throw new RequestValidationError(issues);
  }

  try {
    if (body.companyName !== undefined) {
      await renameCompany(tx, body.companyName);
    }
    const columns: BrandProfileColumns = {
      primarySector: body.primarySector,
      companySize: body.companySize,
      websiteDomain,
      presentation:
        body.presentation === undefined
          ? undefined
          : nullIfBlank(body.presentation),
      exclusivityBand: body.exclusivityBand,
      collaborationRhythm: body.collaborationRhythm,
      offersNonMonetary: body.offersNonMonetary,
      contactRole: body.contactRole,
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
    // What the checks above cannot know: a constraint the database holds (0106, 0202).
    const state = sqlStateOf(error);
    if (state === "23514" || state === "23503" || state === "22023") {
      throw new RequestValidationError([{ path: "", issue: "invalid" }]);
    }
    throw error;
  }

  const stored = await readOwnBrandProfile(tx);
  if (stored === null) {
    throw new ApiError("not_found");
  }
  await storeScore(tx, scoreOf(stored).score);
  return {
    ...viewOf(stored, references),
    websiteNormalized,
  };
}

/**
 * Locks the profile row and checks it may be edited (the same states as the autosave): no profile
 * is "no such route" (T14), a published or suspended one waits for the review of L2C (EC-L2B-07-1).
 */
export async function lockEditableBrandProfile(tx: Transaction): Promise<void> {
  const status = await lockOwnBrandProfile(tx);
  if (status === null) {
    throw new ApiError("not_found");
  }
  if (!EDITABLE_STATUSES.has(status)) {
    throw new ApiError("conflict");
  }
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
    ...viewOf(stored, await readActiveReferences(tx)),
    changed: outcome.changed,
  };
}

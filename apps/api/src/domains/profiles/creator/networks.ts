// The network lines of the creator profile, their figures and their exact audience (docs/mvp/07 RG41 to
// RG61, RG113 to RG116, CA10 to CA12, CA18, CA26, CA27; jalons/l2d/modele.md; commit 09). Blocks 3 and 4
// of the screen. Same rules as the autosave of profile.ts:
// - the account is the session's, a line is reached by its identifier AND the account (another
//   creator's line is an unknown one, 18 T14.1, T14.2);
// - the rules are packages/domain's (handle, pseudonym, URL against the hosts of the network, audience
//   sums); the database arbitrates (closed lists, uniqueness, sums at commit) and this file only says
//   WHICH field is wrong;
// - the date of the figures is the database's: a metric typed alone leaves it as it is and the answer
//   asks the screen for `creatorProfile.figures.confirmAll`; only "Confirmer mes chiffres" renews it
//   (RG50, RG116, EC-L2D-6). The source of the figures is never touched here;
// - the bands derived from the figures are read back for the MAIN line only, for its owner (RG22);
// - nothing typed is ever logged or stored besides the line itself: a refusal names a field and a
//   rule, never the value (RG14, D60);
// - on a PUBLISHED profile (07 RG9, L2G 08): the figures and the audience are immediate (CA49); a new
//   line is saved unlisted and waits for review (`creator.network_line`), the handle and the URL of a
//   listed line wait too (`creator.network_handle`, `creator.network_url`), the validated ones being
//   served meanwhile (CA48). The handle of a line holding an active « Compte vérifié » is immediate:
//   queue 6 alone controls it (modele point 6). The guard of 0243 refuses everything else.
import {
  CREATOR_FIGURES_CONFIRM_NOTICE,
  creatorNetworkLineSchema,
  creatorNetworksResponseSchema,
  type ConfirmCreatorFiguresBody,
  type CreateCreatorNetworkBody,
  type CreatorNetworkLine,
  type CreatorNetworksResponse,
  type PutCreatorNetworkAudienceBody,
  type UpdateCreatorNetworkBody,
} from "@influx/contracts/creator-profile";
import type { ValidationIssue } from "@influx/contracts/errors";
import {
  audienceRemainder,
  checkProfileUrl,
  isAudienceSumAllowed,
  normalizeHandle,
  normalizePseudonym,
  type NetworkTextResult,
} from "@influx/domain/creator-profile";
import type { Transaction } from "../../../db/index.ts";
import { sqlConstraintOf, sqlStateOf } from "../../../db/sql-state.ts";
import { ApiError, RequestValidationError } from "../../../platform/errors.ts";
import {
  lockWritableCreatorProfile,
  moderatedFieldConflict,
  readCreatorProgress,
  refreshStoredCreatorScore,
} from "./profile.ts";
import {
  confirmOwnNetworkFigures,
  deleteNetworkLine,
  insertNetworkLine,
  readActiveAgeBandCodes,
  readNetworkHosts,
  readOwnLineModeration,
  readOwnNetworkLines,
  replaceNetworkAudience,
  settleAudienceSums,
  submitOwnCreatorRevision,
  uncheckPrimaryNetworkLines,
  updateNetworkLineColumns,
  type NetworkLineColumns,
  type StoredNetworkLine,
} from "./repository.ts";

/** The three priority metrics (07 RG113): changing one of them alone does not renew the date. */
const PRIORITY_METRICS = [
  "followersCount",
  "postsLast30Days",
  "avgCommentsPerPost",
] as const;

type Notices = CreatorNetworksResponse["notices"];

/** The line as the screen reads it: the audience in its three dimensions, what is left to "others". */
function lineViewOf(line: StoredNetworkLine): CreatorNetworkLine {
  const main = line.countries.find((country) => country.slot === 0);
  const others = line.countries.filter((country) => country.slot !== 0);
  return creatorNetworkLineSchema.parse({
    id: line.id,
    networkCode: line.networkCode,
    isPrimary: line.isPrimary,
    handle: line.handle,
    pseudonym: line.pseudonym,
    profileUrl: line.profileUrl,
    followersCount: line.followersCount,
    postsLast30Days: line.postsLast30Days,
    avgCommentsPerPost: line.avgCommentsPerPost,
    avgReachPerPost: line.avgReachPerPost,
    engagementRateBp: line.engagementRateBp,
    figuresSource: line.figuresSource,
    figuresMeasuredAt: line.figuresMeasuredAt,
    audience: {
      mainCountry:
        main === undefined ? null : { code: main.code, share: main.share },
      otherCountries: others.map((country) => ({
        code: country.code,
        share: country.share ?? 0,
      })),
      ages: line.ages,
      genders: line.genders,
    },
    remainders: {
      countries: audienceRemainder(line.countries.map((c) => c.share)),
      ages: audienceRemainder(line.ages.map((a) => a.share)),
      genders: audienceRemainder(line.genders.map((g) => g.share)),
    },
    bands: line.bands,
  });
}

/** The answer of every route: the lines as saved, the recomputed (and stored) completeness, the notices. */
async function answerAfterWrite(
  tx: Transaction,
  lineId: string | null,
  notices: Notices,
): Promise<CreatorNetworksResponse> {
  const lines = (await readOwnNetworkLines(tx)).map(lineViewOf);
  const progress = await refreshStoredCreatorScore(tx);
  return creatorNetworksResponseSchema.parse({
    lines,
    lineId,
    completeness: progress.completeness,
    missingRequired: progress.missingRequired,
    notices,
  });
}

/** GET: the lines of the session's own account; nothing is stored by a read. */
export async function readCreatorNetworks(
  tx: Transaction,
): Promise<CreatorNetworksResponse> {
  const lines = (await readOwnNetworkLines(tx)).map(lineViewOf);
  const progress = await readCreatorProgress(tx);
  return creatorNetworksResponseSchema.parse({
    lines,
    lineId: null,
    completeness: progress.completeness,
    missingRequired: progress.missingRequired,
    notices: [],
  });
}

/** A typed text of the line through the domain's rule; a blank one empties the field. */
function textOf(
  path: string,
  value: string | null | undefined,
  normalize: (input: string) => NetworkTextResult,
  issues: ValidationIssue[],
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value.trim() === "") {
    return null;
  }
  const result = normalize(value);
  if (!result.ok) {
    issues.push({ path, issue: result.reason });
    return undefined;
  }
  return result.value;
}

/** The columns of a body, each text through packages/domain and the URL against the hosts of its network (CA12). */
function columnsOf(
  body: UpdateCreatorNetworkBody,
  hosts: readonly string[],
): NetworkLineColumns {
  const issues: ValidationIssue[] = [];
  const handle = textOf("handle", body.handle, normalizeHandle, issues);
  const pseudonym = textOf(
    "pseudonym",
    body.pseudonym,
    normalizePseudonym,
    issues,
  );
  let profileUrl: string | null | undefined;
  if (body.profileUrl !== undefined) {
    if (body.profileUrl === null || body.profileUrl.trim() === "") {
      profileUrl = null;
    } else {
      const checked = checkProfileUrl(body.profileUrl, hosts);
      if (checked.ok) {
        profileUrl = checked.url;
      } else {
        issues.push({ path: "profileUrl", issue: checked.reason });
      }
    }
  }
  if (issues.length > 0) {
    throw new RequestValidationError(issues);
  }
  return {
    isPrimary: body.isPrimary,
    handle,
    pseudonym,
    profileUrl,
    followersCount: body.followersCount,
    postsLast30Days: body.postsLast30Days,
    avgCommentsPerPost: body.avgCommentsPerPost,
    avgReachPerPost: body.avgReachPerPost,
    engagementRateBp: body.engagementRateBp,
  };
}

/** The audience table a deferred sum constraint belongs to, as the dimension the screen knows. */
function dimensionOfSumConstraint(constraint: string | null): string {
  if (constraint === "creator_audience_countries_share_sum") {
    return "countries";
  }
  if (constraint === "creator_audience_ages_share_sum") {
    return "ages";
  }
  if (constraint === "creator_audience_genders_share_sum") {
    return "genders";
  }
  return "";
}

/** What the database holds that the checks above cannot know, as the request's fault or a conflict. */
function refusalOf(error: unknown): never {
  const state = sqlStateOf(error);
  const constraint = sqlConstraintOf(error);
  if (state === "23505") {
    if (constraint === "creator_social_accounts_handle_unique") {
      // RG42: a handle once per network, whatever its case
      throw new RequestValidationError([
        { path: "handle", issue: "duplicate" },
      ]);
    }
    throw new ApiError("conflict");
  }
  if (state === "23514") {
    if (constraint === "creator_social_accounts_profile_url_host") {
      throw new RequestValidationError([
        { path: "profileUrl", issue: "wrong_network" },
      ]);
    }
    if (constraint?.endsWith("_share_sum") === true) {
      throw new RequestValidationError([
        {
          path: dimensionOfSumConstraint(constraint),
          issue: "sum_exceeds_100",
        },
      ]);
    }
    throw new RequestValidationError([{ path: "", issue: "invalid" }]);
  }
  if (state === "23503" || state === "22023") {
    throw new RequestValidationError([{ path: "", issue: "invalid" }]);
  }
  if (state === "55000") {
    throw moderatedFieldConflict(error) ?? new ApiError("conflict");
  }
  throw error;
}

/** Whether a metric of the three was given and differs from what the line held (07 RG116). */
function priorityMetricChanged(
  before: Partial<Record<(typeof PRIORITY_METRICS)[number], number | null>>,
  columns: NetworkLineColumns,
): boolean {
  return PRIORITY_METRICS.some(
    (metric) =>
      columns[metric] !== undefined &&
      columns[metric] !== (before[metric] ?? null),
  );
}

function confirmNotice(changed: boolean): Notices {
  return changed ? [CREATOR_FIGURES_CONFIRM_NOTICE] : [];
}

/**
 * POST: a new line (07 RG41, RG42, CA10). A new main line unchecks the old one in the same save
 * (CA11). Figures typed here leave the date empty: the answer asks for the confirmation (RG116).
 */
export async function createCreatorNetwork(
  tx: Transaction,
  body: CreateCreatorNetworkBody,
): Promise<CreatorNetworksResponse> {
  const status = await lockWritableCreatorProfile(tx);
  const network = await readNetworkHosts(tx, body.networkCode, true);
  if (network === null) {
    throw new RequestValidationError([
      { path: "networkCode", issue: "unknown" },
    ]);
  }
  const columns = columnsOf(body, network.hosts);
  let lineId: string;
  try {
    if (columns.isPrimary === true) {
      await uncheckPrimaryNetworkLines(tx, null);
    }
    lineId = await insertNetworkLine(tx, body.networkCode, columns);
    if (status === "published") {
      // RG9: the line is listed by the decision that follows, never by its author
      await submitOwnCreatorRevision(tx, "creator.network_line", lineId, {});
    }
  } catch (error) {
    return refusalOf(error);
  }
  return answerAfterWrite(
    tx,
    lineId,
    confirmNotice(priorityMetricChanged({}, columns)),
  );
}

/** PATCH: what changed on a line of the account; the network of a line never changes (a deletion, then a new line). */
export async function updateCreatorNetwork(
  tx: Transaction,
  lineId: string,
  body: UpdateCreatorNetworkBody,
): Promise<CreatorNetworksResponse> {
  const status = await lockWritableCreatorProfile(tx);
  const [before] = await readOwnNetworkLines(tx, lineId);
  if (before === undefined) {
    throw new ApiError("not_found");
  }
  const network = await readNetworkHosts(tx, before.networkCode, false);
  const typed = columnsOf(body, network?.hosts ?? []);
  // RG9: the handle and the URL of a line listed on a published profile wait for review
  const moderation =
    status === "published" ? await readOwnLineModeration(tx, lineId) : null;
  const handleWaits =
    moderation?.listed === true &&
    !moderation.accountVerified &&
    typed.handle !== undefined;
  const urlWaits =
    moderation?.listed === true && typed.profileUrl !== undefined;
  if (
    (handleWaits && typed.handle === null) ||
    (urlWaits && typed.profileUrl === null)
  ) {
    // a line of a published profile keeps both (RG16): the same refusal as the revision's
    throw new RequestValidationError([
      {
        path: handleWaits && typed.handle === null ? "handle" : "profileUrl",
        issue: "required",
      },
    ]);
  }
  const columns: NetworkLineColumns = {
    ...typed,
    handle: handleWaits ? undefined : typed.handle,
    profileUrl: urlWaits ? undefined : typed.profileUrl,
  };
  try {
    if (handleWaits) {
      await submitOwnCreatorRevision(
        tx,
        "creator.network_handle",
        lineId,
        typed.handle,
      );
    }
    if (urlWaits) {
      await submitOwnCreatorRevision(
        tx,
        "creator.network_url",
        lineId,
        typed.profileUrl,
      );
    }
    if (columns.isPrimary === true) {
      await uncheckPrimaryNetworkLines(tx, lineId);
    }
    await updateNetworkLineColumns(tx, lineId, columns);
  } catch (error) {
    return refusalOf(error);
  }
  return answerAfterWrite(
    tx,
    lineId,
    confirmNotice(priorityMetricChanged(before, typed)),
  );
}

/** DELETE: a line of the account with its audience; no other line becomes the main one by itself. */
export async function removeCreatorNetwork(
  tx: Transaction,
  lineId: string,
): Promise<CreatorNetworksResponse> {
  await lockWritableCreatorProfile(tx);
  if (!(await deleteNetworkLine(tx, lineId))) {
    throw new ApiError("not_found");
  }
  return answerAfterWrite(tx, null, []);
}

/**
 * POST .../figures: "Confirmer mes chiffres" (07 RG50, RG116, CA18, EC-L2D-6): the three metrics
 * together, null for a metric not declared, the date set by the database and by nothing else.
 */
export async function confirmCreatorNetworkFigures(
  tx: Transaction,
  lineId: string,
  body: ConfirmCreatorFiguresBody,
): Promise<CreatorNetworksResponse> {
  await lockWritableCreatorProfile(tx);
  const [line] = await readOwnNetworkLines(tx, lineId);
  if (line === undefined) {
    throw new ApiError("not_found");
  }
  try {
    await confirmOwnNetworkFigures(tx, lineId, body);
  } catch (error) {
    if (sqlStateOf(error) === "42501") {
      throw new ApiError("not_found");
    }
    return refusalOf(error);
  }
  return answerAfterWrite(tx, lineId, []);
}

function hasDuplicate(codes: readonly string[]): boolean {
  return new Set(codes).size !== codes.length;
}

/**
 * PUT .../audience: the whole exact audience of a line (07 RG56 to RG61). A dimension over 100 is
 * refused (CA26); under 100 it is saved and the rest is answered as "others", never completed (CA27).
 */
export async function putCreatorNetworkAudience(
  tx: Transaction,
  lineId: string,
  body: PutCreatorNetworkAudienceBody,
): Promise<CreatorNetworksResponse> {
  await lockWritableCreatorProfile(tx);
  const [line] = await readOwnNetworkLines(tx, lineId);
  if (line === undefined) {
    throw new ApiError("not_found");
  }
  const countries = [
    ...(body.mainCountry === null
      ? []
      : [
          {
            slot: 0,
            code: body.mainCountry.code,
            share: body.mainCountry.share,
          },
        ]),
    ...body.otherCountries.map((country, index) => ({
      slot: index + 1,
      code: country.code,
      share: country.share as number | null,
    })),
  ];
  const issues: ValidationIssue[] = [];
  if (body.mainCountry === null && body.otherCountries.length > 0) {
    issues.push({ path: "mainCountry", issue: "required" });
  }
  if (hasDuplicate(countries.map((country) => country.code))) {
    issues.push({ path: "otherCountries", issue: "duplicate" });
  }
  if (hasDuplicate(body.ages.map((age) => age.code))) {
    issues.push({ path: "ages", issue: "duplicate" });
  } else {
    const known = new Set(await readActiveAgeBandCodes(tx));
    if (body.ages.some((age) => !known.has(age.code))) {
      issues.push({ path: "ages", issue: "unknown" });
    }
  }
  if (hasDuplicate(body.genders.map((gender) => gender.code))) {
    issues.push({ path: "genders", issue: "duplicate" });
  }
  const dimensions = [
    ["countries", countries.map((country) => country.share)],
    ["ages", body.ages.map((age) => age.share)],
    ["genders", body.genders.map((gender) => gender.share)],
  ] as const;
  for (const [path, shares] of dimensions) {
    if (!isAudienceSumAllowed(shares)) {
      issues.push({ path, issue: "sum_exceeds_100" });
    }
  }
  if (issues.length > 0) {
    throw new RequestValidationError(issues);
  }
  try {
    await replaceNetworkAudience(tx, lineId, {
      countries,
      ages: body.ages,
      genders: body.genders,
    });
    await settleAudienceSums(tx);
  } catch (error) {
    return refusalOf(error);
  }
  return answerAfterWrite(tx, lineId, []);
}

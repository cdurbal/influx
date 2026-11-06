// The rules of block 3 of "mon profil" (creator: the network lines and the three priority metrics;
// docs/mvp/07 RG41 to RG50, RG113 to RG116, CA10 to CA12, CA18; jalons/l2d, commit 13) that are not
// apps/api's: the draft of a line (what the form holds, as typed), the patch of what changed, the checks
// the browser makes before the call with the schemas of the API (RG14), the figures date line (source
// AND date, RG49) and the staleness after 90 days (RG50). Pure functions, unit-tested
// (tests/creator-networks-view.test.ts); the hook and the components only call and display. The bands,
// the score and the date of the figures are the API's: nothing of them is computed here.
//
// The front does not import @influx/domain (guarded by apps/api/tests/domain-guards.test.ts: "no front
// yet"): the two small input rules below repeat packages/domain/src/creator-profile (basis-points.ts,
// network-line.ts) for the typed text only; the database and the API decide again (EC-L2D-13-1). A
// percentage is read and written by its DIGITS, never by arithmetic (docs/mvp/18 T16.1). No amount,
// rate, net or price anywhere (CLAUDE.md §2, D48, D78).
import {
  CREATOR_PROFILE_URL_MAX_LENGTH,
  confirmCreatorFiguresBodySchema,
  updateCreatorNetworkBodySchema,
  type ConfirmCreatorFiguresBody,
  type CreatorNetworkLine,
  type UpdateCreatorNetworkBody,
} from "@influx/contracts/creator-profile";
import type { RelayResult } from "@influx/web-platform/relay-client";

// --- The draft of a line ---------------------------------------------------------------------

/** What the form holds for one line, field by field, as typed ("" is a field left empty). */
export type NetworkLineDraft = {
  handle: string;
  pseudonym: string;
  profileUrl: string;
  followers: string;
  posts: string;
  comments: string;
  reach: string;
  engagement: string;
};

export type LineFieldKey = keyof NetworkLineDraft;

/** The fields in the order of the form: identity of the account, then the metrics (RG113). */
export const LINE_FIELD_KEYS: readonly LineFieldKey[] = [
  "handle",
  "profileUrl",
  "pseudonym",
  "followers",
  "posts",
  "comments",
  "reach",
  "engagement",
];

/** The three priority metrics, always in this order and always first (RG113). */
export const PRIORITY_FIELD_KEYS = ["followers", "posts", "comments"] as const;

/** The two secondary indicators, shown after the three (RG113, D61). */
export const SECONDARY_FIELD_KEYS = ["reach", "engagement"] as const;

// --- The two typed inputs that are not whole texts ---------------------------------------------

/** A count (followers, posts, comments, reach): digits only, as the API wants an integer from zero (RG46, RG116). */
const TYPED_COUNT = /^\d{1,15}$/u;

/** Digits, then at most one separator (point or comma) and digits. */
const TYPED_PERCENTAGE = /^(\d+)(?:[.,](\d+))?$/u;

const BASIS_POINTS_LIMIT = 10000;

/** A typed count as a number; `null` when blank (not declared), `undefined` when it is not a count. */
export function countOf(text: string): number | null | undefined {
  const typed = text.trim();
  if (typed === "") {
    return null;
  }
  if (!TYPED_COUNT.test(typed)) {
    return undefined;
  }
  const value = Number(typed);
  return Number.isSafeInteger(value) ? value : undefined;
}

/**
 * A typed engagement ("3.5", "3,50", "12", "100") in basis points, by joining the whole digits to
 * the two decimal ones (EC-L2D-8): no division, no multiplication. `null` when blank, `undefined`
 * when it is not a percentage from 0 to 100 with two decimals at most.
 */
export function engagementBasisPointsOf(
  text: string,
): number | null | undefined {
  const typed = text.trim();
  if (typed === "") {
    return null;
  }
  const parts = TYPED_PERCENTAGE.exec(typed);
  if (parts === null) {
    return undefined;
  }
  const whole = parts[1] ?? "";
  const decimals = parts[2] ?? "";
  if (decimals.length > 2) {
    return undefined;
  }
  const basisPoints = Number(whole + decimals.padEnd(2, "0"));
  return basisPoints > BASIS_POINTS_LIMIT ? undefined : basisPoints;
}

/** Basis points back to the typed form ("350" is "3.5", "1200" is "12"), again by the digits alone. */
export function engagementTextOf(basisPoints: number | null): string {
  if (
    basisPoints === null ||
    !Number.isInteger(basisPoints) ||
    basisPoints < 0 ||
    basisPoints > BASIS_POINTS_LIMIT
  ) {
    return "";
  }
  const digits = String(basisPoints).padStart(3, "0");
  const whole = digits.slice(0, -2);
  const decimals = digits.slice(-2).replace(/0+$/u, "");
  return decimals === "" ? whole : `${whole}.${decimals}`;
}

/**
 * The shape of a profile link, the part of RG43 the browser can tell alone: the secure scheme, a host, no space
 * or control character, no credentials, within the ceiling. Which host belongs to which network is the
 * database's (`reference.network_url_hosts`): a link to another network comes back from the API as
 * `wrong_network` and has its own message (CA12, EC-L2D-13-2).
 */
export function isProfileUrlShape(text: string): boolean {
  const url = text.trim();
  if (Array.from(url).length > CREATOR_PROFILE_URL_MAX_LENGTH) {
    return false;
  }
  if (!/^https:\/\/[^\s\p{Cc}]+$/u.test(url)) {
    return false;
  }
  const authority = /^https:\/\/([^/?#]*)/u.exec(url)?.[1] ?? "";
  return authority !== "" && !authority.includes("@");
}

// --- The draft of a line, from the line and back ---------------------------------------------

function countText(value: number | null): string {
  return value === null ? "" : String(value);
}

export function lineDraftOf(line: CreatorNetworkLine): NetworkLineDraft {
  return {
    handle: line.handle ?? "",
    pseudonym: line.pseudonym ?? "",
    profileUrl: line.profileUrl ?? "",
    followers: countText(line.followersCount),
    posts: countText(line.postsLast30Days),
    comments: countText(line.avgCommentsPerPost),
    reach: countText(line.avgReachPerPost),
    engagement: engagementTextOf(line.engagementRateBp),
  };
}

/** Two drafts of a line are the same field by field. */
export function sameLineValue(
  first: NetworkLineDraft,
  second: NetworkLineDraft,
  key: LineFieldKey,
): boolean {
  return first[key].trim() === second[key].trim();
}

// --- The patch of the autosave of a line --------------------------------------------------------

/** Why a field of a line is not accepted, as a key of `creatorProfile.issues`. */
export type LineFieldError =
  | "invalid"
  | "count"
  | "percentage"
  | "url_shape"
  | "wrong_network"
  | "duplicate";

export type LineFieldErrors = Partial<Record<LineFieldKey, LineFieldError>>;

/** A text emptied: the API wants `null`, not an empty string, to clear a value. */
function textOrNull(text: string): string | null {
  return text.trim() === "" ? null : text.trim();
}

const COUNT_BODY_KEYS = {
  followers: "followersCount",
  posts: "postsLast30Days",
  comments: "avgCommentsPerPost",
  reach: "avgReachPerPost",
} as const;

/** The part of the body one field makes, or the reason the browser refuses what was typed. */
function fragmentOf(
  key: LineFieldKey,
  draft: NetworkLineDraft,
): { body: Record<string, unknown> } | { error: LineFieldError } {
  switch (key) {
    case "handle":
      return { body: { handle: textOrNull(draft.handle) } };
    case "pseudonym":
      return { body: { pseudonym: textOrNull(draft.pseudonym) } };
    case "profileUrl": {
      const url = textOrNull(draft.profileUrl);
      return url !== null && !isProfileUrlShape(url)
        ? { error: "url_shape" }
        : { body: { profileUrl: url } };
    }
    case "engagement": {
      const basisPoints = engagementBasisPointsOf(draft.engagement);
      return basisPoints === undefined
        ? { error: "percentage" }
        : { body: { engagementRateBp: basisPoints } };
    }
    case "followers":
    case "posts":
    case "comments":
    case "reach": {
      const count = countOf(draft[key]);
      return count === undefined
        ? { error: "count" }
        : { body: { [COUNT_BODY_KEYS[key]]: count } };
    }
  }
}

export type LinePatchPlan = {
  /** What to send: the valid changes, `null` when there is nothing to send. */
  body: UpdateCreatorNetworkBody | null;
  /** The fields that changed and are sent (to mark as saved once the API accepted them). */
  keys: LineFieldKey[];
  /** The changed fields the browser refuses, each with its reason; not sent, kept in the form. */
  refused: LineFieldErrors;
};

/**
 * The autosave of what changed on a line since the last answer of the API (07 RG111): each changed field
 * is checked alone, so that one wrong field never holds back the others. `skip`: the fields already in
 * error, left alone until the member changes them.
 */
export function planLinePatch(
  draft: NetworkLineDraft,
  saved: NetworkLineDraft,
  skip: LineFieldErrors = {},
): LinePatchPlan {
  const patch: Record<string, unknown> = {};
  const keys: LineFieldKey[] = [];
  const refused: LineFieldErrors = {};
  for (const key of LINE_FIELD_KEYS) {
    if (sameLineValue(draft, saved, key) || skip[key] !== undefined) {
      continue;
    }
    const fragment = fragmentOf(key, draft);
    if ("error" in fragment) {
      refused[key] = fragment.error;
      continue;
    }
    const checked = updateCreatorNetworkBodySchema.safeParse(fragment.body);
    if (!checked.success) {
      refused[key] = "invalid";
      continue;
    }
    Object.assign(patch, fragment.body);
    keys.push(key);
  }
  const parsed = updateCreatorNetworkBodySchema.safeParse(patch);
  return {
    body: keys.length > 0 && parsed.success ? parsed.data : null,
    keys,
    refused,
  };
}

/** The body of one field alone: what a refused patch is split into to find the wrong field. */
export function singleLinePatch(
  key: LineFieldKey,
  draft: NetworkLineDraft,
): UpdateCreatorNetworkBody | null {
  const fragment = fragmentOf(key, draft);
  if ("error" in fragment) {
    return null;
  }
  const parsed = updateCreatorNetworkBodySchema.safeParse(fragment.body);
  return parsed.success ? parsed.data : null;
}

/**
 * The body of "Confirmer mes chiffres": the three priority metrics together, a blank one meaning
 * "not declared" (EC-L2D-6). A typed value that is not a count is refused and named, nothing is sent.
 */
export function planConfirmation(
  draft: NetworkLineDraft,
):
  | { body: ConfirmCreatorFiguresBody; refused: null }
  | { body: null; refused: LineFieldErrors } {
  const refused: LineFieldErrors = {};
  const counts: Record<(typeof PRIORITY_FIELD_KEYS)[number], number | null> = {
    followers: null,
    posts: null,
    comments: null,
  };
  for (const key of PRIORITY_FIELD_KEYS) {
    const count = countOf(draft[key]);
    if (count === undefined) {
      refused[key] = "count";
    } else {
      counts[key] = count;
    }
  }
  if (Object.keys(refused).length > 0) {
    return { body: null, refused };
  }
  const parsed = confirmCreatorFiguresBodySchema.safeParse({
    followersCount: counts.followers,
    postsLast30Days: counts.posts,
    avgCommentsPerPost: counts.comments,
  });
  return parsed.success
    ? { body: parsed.data, refused: null }
    : { body: null, refused: { followers: "invalid" } };
}

/**
 * The reason a patch was refused by the API, from the issues of its answer (never a value): a link to
 * another network (CA12) and a handle already declared (RG42) have their own message.
 */
export function lineErrorsOf(
  result: RelayResult<unknown>,
  keys: readonly LineFieldKey[],
): LineFieldErrors {
  const issues = result.kind === "failed" ? (result.issues ?? []) : [];
  const errors: LineFieldErrors = {};
  if (issues.includes("wrong_network") && keys.includes("profileUrl")) {
    errors.profileUrl = "wrong_network";
  }
  if (issues.includes("duplicate") && keys.includes("handle")) {
    errors.handle = "duplicate";
  }
  if (Object.keys(errors).length === 0 && keys.length === 1) {
    // a single field was sent: the refusal is that field's
    errors[keys[0]!] = "invalid";
  }
  return errors;
}

/** After the API accepted `keys`: the fields sent are the new reference of the next patch. */
export function afterLineSave(
  saved: NetworkLineDraft,
  sent: NetworkLineDraft,
  keys: readonly LineFieldKey[],
): NetworkLineDraft {
  const next: NetworkLineDraft = { ...saved };
  for (const key of keys) {
    next[key] = sent[key];
  }
  return next;
}

// --- The date of the figures (RG49, RG50) ------------------------------------------------------

/** After this many days a line says its figures are to be refreshed (RG50); never hidden, never deleted. */
export const FIGURES_STALE_AFTER_DAYS = 90;

const MILLISECONDS_PER_DAY = 86_400_000;

/** Whether the figures of a line date from more than 90 days: a comparison of dates, nothing more. */
export function areFiguresStale(measuredAt: string | null, now: Date): boolean {
  if (measuredAt === null) {
    return false;
  }
  const elapsed = now.getTime() - new Date(measuredAt).getTime();
  return elapsed > FIGURES_STALE_AFTER_DAYS * MILLISECONDS_PER_DAY;
}

/** The date of the figures, written in the language of the page (RG49: always beside a figure). */
export function formatFiguresDate(measuredAt: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
    new Date(measuredAt),
  );
}

/** Whether the line holds at least one of the three priority figures: the source and the date are then said. */
export function holdsPriorityFigure(line: CreatorNetworkLine): boolean {
  return (
    line.followersCount !== null ||
    line.postsLast30Days !== null ||
    line.avgCommentsPerPost !== null
  );
}

/** Whether the line holds all three priority figures: "Confirmer mes chiffres" then only dates them (L2DU-8). */
export function holdsEveryPriorityFigure(line: CreatorNetworkLine): boolean {
  return (
    line.followersCount !== null &&
    line.postsLast30Days !== null &&
    line.avgCommentsPerPost !== null
  );
}

// --- The lines, as a list -------------------------------------------------------------------

/** The network codes the creator may still add: the reference list, each code once, in its order. */
export function networkCodesOf(
  formats: readonly { networkCode: string | null }[],
): string[] {
  const codes: string[] = [];
  for (const format of formats) {
    if (format.networkCode !== null && !codes.includes(format.networkCode)) {
      codes.push(format.networkCode);
    }
  }
  return codes;
}

/** The control id of a field of a line, for the label, the focus and the error. */
export function lineControlIdOf(lineId: string, key: LineFieldKey): string {
  return `creator-network-${lineId}-${key}`;
}

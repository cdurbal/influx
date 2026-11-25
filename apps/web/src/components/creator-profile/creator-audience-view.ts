// The rules of block 4 of "mon profil" (creator: the audience of each network line; docs/mvp/07 RG55 to
// RG61, CA26 to CA28; jalons/l2d, commit 14) that are not apps/api's: the draft of a line's audience
// (what the form holds, as typed), the body of the autosave (the whole audience is replaced in one
// call), the checks the browser makes before it with the schema of the API (RG14), and the reason an
// answer refused. Pure functions, unit-tested (tests/creator-audience-view.test.ts); the hook and the
// components only call and display. The "others" left over by a dimension is the API's (`remainders`):
// it is shown, never added to a share (RG57). Nothing here carries an amount, a rate, a net or a price
// (CLAUDE.md §2, D48, D78).
//
// The front does not import @influx/domain (apps/api/tests/domain-guards.test.ts): `audienceSumOf`
// below repeats packages/domain/src/creator-profile/audience.ts (`audienceSum`, a share not typed yet
// counts for nothing) so that a total over 100 is told before the call; the API and the database
// decide again (EC-L2D-13-1).
import {
  CREATOR_AUDIENCE_GENDER_CODES,
  CREATOR_AUDIENCE_OTHER_COUNTRIES_MAX,
  CREATOR_AUDIENCE_OTHER_COUNTRY_MIN_SHARE,
  putCreatorNetworkAudienceBodySchema,
  type CreatorNetworkLine,
  type PutCreatorNetworkAudienceBody,
} from "@influx/contracts/creator-profile";
import type { RelayResult } from "@influx/web-platform/relay-client";
import { countOf } from "./creator-networks-view";

/**
 * The age bands the form offers (07 RG60): exactly these four, none under 18. The list lives in the
 * database (`reference.age_bands`) and is not in an answer of the API: the codes are repeated here for
 * the labels, and an unknown code comes back as `unknown` (EC-L2D-14-1).
 */
export const AUDIENCE_AGE_CODES = [
  "18_24",
  "25_34",
  "35_44",
  "45_plus",
] as const;

/** The genders of an audience (07 RG61): women, men, others or not declared; always about the audience. */
export const AUDIENCE_GENDER_CODES = CREATOR_AUDIENCE_GENDER_CODES;

/** The other countries a line can hold (07 RG56) and the smallest share one weighs. */
export const OTHER_COUNTRIES_MAX = CREATOR_AUDIENCE_OTHER_COUNTRIES_MAX;
export const OTHER_COUNTRY_MIN_SHARE = CREATOR_AUDIENCE_OTHER_COUNTRY_MIN_SHARE;

/** The four dimensions a share is typed in. */
export type AudienceDimension = "countries" | "ages" | "genders";

// --- The draft of an audience ------------------------------------------------------------------

/** A country and its share, as typed: `code` "" is a row without a country yet, `share` "" a share not typed. */
export type AudienceRow = { code: string; share: string };

export type AudienceDraft = {
  main: AudienceRow;
  others: AudienceRow[];
  /** The share of each age band, by code ("" is not typed). */
  ages: Record<string, string>;
  /** The share of each gender, by code ("" is not typed). */
  genders: Record<string, string>;
};

function shareText(share: number | null): string {
  return share === null ? "" : String(share);
}

export function audienceDraftOf(
  audience: CreatorNetworkLine["audience"],
): AudienceDraft {
  return {
    main: {
      code: audience.mainCountry?.code ?? "",
      share: shareText(audience.mainCountry?.share ?? null),
    },
    others: audience.otherCountries.map((country) => ({
      code: country.code,
      share: String(country.share),
    })),
    ages: Object.fromEntries(
      audience.ages.map((age) => [age.code, String(age.share)]),
    ),
    genders: Object.fromEntries(
      audience.genders.map((gender) => [gender.code, String(gender.share)]),
    ),
  };
}

/** A row of the countries counts once it has its country and its share: the others are on their way. */
function isCompleteRow(row: AudienceRow): boolean {
  return row.code !== "" && row.share.trim() !== "";
}

function typedEntries(
  shares: Readonly<Record<string, string>>,
): [string, string][] {
  return Object.entries(shares)
    .map(([code, share]): [string, string] => [code, share.trim()])
    .filter(([, share]) => share !== "")
    .sort(([first], [second]) => first.localeCompare(second));
}

/** What the API would hold for this draft, as text: two drafts with the same text are the same audience. */
function signatureOf(draft: AudienceDraft): string {
  return JSON.stringify([
    draft.main.code,
    draft.main.share.trim(),
    draft.others
      .filter(isCompleteRow)
      .map((row) => [row.code, row.share.trim()]),
    typedEntries(draft.ages),
    typedEntries(draft.genders),
  ]);
}

export function sameAudience(first: AudienceDraft, second: AudienceDraft) {
  return signatureOf(first) === signatureOf(second);
}

// --- The body of the autosave ------------------------------------------------------------------

/** Why an audience is not accepted, as a key of `creatorProfile.issues`. */
export type AudienceIssue =
  | "share"
  | "share_min"
  | "sum_exceeds_100"
  | "duplicate"
  | "required"
  | "invalid"
  | "unknown";

/** Where the reason shows: under the field it is about, or under the whole audience. */
export type AudienceErrors = Partial<
  Record<
    | "mainCountry"
    | "mainShare"
    | "others"
    | "countries"
    | "ages"
    | "genders"
    | "form",
    AudienceIssue
  >
>;

/** A typed share: a whole number from 0 to 100, `null` when blank, `undefined` when it is not one. */
function shareOf(text: string): number | null | undefined {
  const share = countOf(text);
  return share === undefined || (share !== null && share > 100)
    ? undefined
    : share;
}

/** The sum of the shares typed in one dimension; a share not typed yet counts for nothing (twin of `audienceSum`). */
export function audienceSumOf(shares: readonly string[]): number {
  return shares.reduce((sum, text) => sum + (shareOf(text) ?? 0), 0);
}

const SUM_MAX = 100;

/** The shares typed for the codes of a dimension; `null` when one of them is not a whole number from 0 to 100. */
function parseShares(
  shares: Readonly<Record<string, string>>,
): { code: string; share: number }[] | null {
  const parsed: { code: string; share: number }[] = [];
  for (const [code, text] of typedEntries(shares)) {
    const share = shareOf(text);
    if (share === undefined || share === null) {
      return null;
    }
    parsed.push({ code, share });
  }
  return parsed;
}

export type AudiencePlan = {
  /** What to send, `null` when nothing changed or something is refused. */
  body: PutCreatorNetworkAudienceBody | null;
  /** What the browser refuses, each under its field; nothing is sent while there is one. */
  errors: AudienceErrors;
};

/**
 * The autosave of an audience: the whole of it is replaced, so the body is the draft as a whole. A row
 * of countries without its share, or a share without its country on an "other" row, is on its way and
 * left out; the main country may wait for its share (EC-L2D-04-4). 140 is refused, 60 is accepted
 * (CA26, CA27): the rest reads "others" and is never completed (RG57).
 */
export function planAudience(
  draft: AudienceDraft,
  saved: AudienceDraft,
): AudiencePlan {
  if (sameAudience(draft, saved)) {
    return { body: null, errors: {} };
  }
  const errors: AudienceErrors = {};

  const mainShare = shareOf(draft.main.share);
  if (mainShare === undefined) {
    errors.mainShare = "share";
  }
  if (draft.main.code === "" && draft.main.share.trim() !== "") {
    errors.mainCountry = "required";
  }
  const mainCountry =
    draft.main.code === ""
      ? null
      : { code: draft.main.code, share: mainShare ?? null };

  const otherCountries: { code: string; share: number }[] = [];
  for (const row of draft.others.filter(isCompleteRow)) {
    const share = shareOf(row.share);
    if (share === undefined || share === null) {
      errors.others = "share";
    } else if (share < OTHER_COUNTRY_MIN_SHARE) {
      errors.others ??= "share_min";
    } else {
      otherCountries.push({ code: row.code, share });
    }
  }
  const codes = [
    ...(mainCountry === null ? [] : [mainCountry.code]),
    ...otherCountries.map((country) => country.code),
  ];
  if (new Set(codes).size !== codes.length) {
    errors.others ??= "duplicate";
  }
  if (
    draft.main.code === "" &&
    otherCountries.length > 0 &&
    errors.mainCountry === undefined
  ) {
    errors.mainCountry = "required";
  }

  const ages = parseShares(draft.ages);
  const genders = parseShares(draft.genders);
  if (ages === null) {
    errors.ages = "share";
  }
  if (genders === null) {
    errors.genders = "share";
  }

  if (
    audienceSumOf([draft.main.share, ...draft.others.map((row) => row.share)]) >
    SUM_MAX
  ) {
    errors.countries = "sum_exceeds_100";
  }
  if (audienceSumOf(Object.values(draft.ages)) > SUM_MAX) {
    errors.ages ??= "sum_exceeds_100";
  }
  if (audienceSumOf(Object.values(draft.genders)) > SUM_MAX) {
    errors.genders ??= "sum_exceeds_100";
  }
  if (Object.keys(errors).length > 0) {
    return { body: null, errors };
  }
  const checked = putCreatorNetworkAudienceBodySchema.safeParse({
    mainCountry,
    otherCountries,
    ages: ages ?? [],
    genders: genders ?? [],
  });
  return checked.success
    ? { body: checked.data, errors }
    : { body: null, errors: { form: "invalid" } };
}

/** The reason an answer refused the audience, from the issues of its answer (never a value). */
export function audienceIssueOf(result: RelayResult<unknown>): AudienceIssue {
  const issues = result.kind === "failed" ? (result.issues ?? []) : [];
  for (const issue of [
    "sum_exceeds_100",
    "duplicate",
    "required",
    "unknown",
  ] as const) {
    if (issues.includes(issue)) {
      return issue;
    }
  }
  return "invalid";
}

// --- What the form displays --------------------------------------------------------------------

/** The "others" a dimension leaves (07 RG57), as the API says it, shown only once the dimension holds a share. */
export function remainderOf(
  line: Pick<CreatorNetworkLine, "audience" | "remainders">,
  dimension: AudienceDimension,
): number | null {
  const held =
    dimension === "countries"
      ? line.audience.mainCountry !== null &&
        line.audience.mainCountry.share !== null
      : line.audience[dimension].length > 0;
  return held ? line.remainders[dimension] : null;
}

/** The control id of a field of the audience of a line, for the label, the focus and the error. */
export function audienceControlIdOf(lineId: string, field: string): string {
  return `creator-audience-${lineId}-${field}`;
}

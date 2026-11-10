// « Lancer la vérification » on the record of a member, in words and in checks (docs/mvp/06 RG51; 15 RG36;
// jalons/l2f/modele.md §5, §6; l2f-fiche invariants 9, 12; D83 A; L2F-20): pure functions of
// src/components/AccountOpeningBlock.tsx, without a browser. The database decides (the level, the reason,
// the account, the internal block, the request taken over); this module only words, orders, pre-checks what
// the agent typed so that an obviously wrong ask is not sent, and says what the member will receive.
// « Audience vérifiée » is never offered. No handle, no figure; the comment of the agent is never echoed.
import { ISO_COUNTRY_CODES } from "@influx/contracts/countries";
import {
  OPENING_REASON_CODES,
  VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH,
  VERIFICATION_LEGAL_NAME_MAX_LENGTH,
  VERIFICATION_REGISTRATION_NUMBER_MAX_LENGTH,
  type AccountOpeningRow,
  type OpenVerificationForMemberBody,
  type OpeningReasonCode,
} from "@influx/contracts/verification";
import { messages } from "@/messages/fr";
import { networkName } from "./account-badges-view";
import { countryName } from "./view-model";

const t = messages.accountOpening;

/** A request waits in a state the agent reads; a line without one offers the opening. */
export type OpeningTarget = AccountOpeningRow;

/** « Compte vérifié · Instagram », or « Marque vérifiée » (a brand has no network). */
export function targetName(target: OpeningTarget): string {
  if (target.level === "brand_verified" || target.networkCode === null) {
    return t.brandName;
  }
  return `${messages.verificationQueue.levels.account_verified} · ${networkName(target.networkCode)}`;
}

/** The lines first, in the order of the database (level, then network); the brand has no line. */
export function sortedTargets(
  openings: readonly OpeningTarget[],
): OpeningTarget[] {
  const rank = (row: OpeningTarget) => (row.level === "brand_verified" ? 1 : 0);
  return [...openings].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.networkCode ?? "").localeCompare(b.networkCode ?? ""),
  );
}

/** The request already open, with its origin, in words; « aucune » when the line has none. */
export function requestWords(target: OpeningTarget): string {
  if (target.request === null) {
    return t.noRequest;
  }
  return t.request[target.request.openedBy]?.[target.request.status] ?? "";
}

/** The queue view a request of this target waits in. */
export function queueAddressOf(
  target: OpeningTarget,
  requestId: string,
): string {
  return target.level === "brand_verified"
    ? `/files/verifications-marques/${requestId}`
    : `/files/verifications-createurs/${requestId}`;
}

/** A brand without a domain cannot be opened (the database would refuse: `website_domain_required`). */
export function isBlockedBrand(target: OpeningTarget): boolean {
  return target.brand !== null && !target.brand.hasWebsiteDomain;
}

/** Whether the three fields of the internal block are asked: only a brand that holds none. */
export function asksInternalDetails(target: OpeningTarget): boolean {
  return target.brand !== null && !target.brand.hasInternalDetails;
}

export function reasonWords(code: string): string {
  return t.reasons[code] ?? code;
}

export const OPENING_REASONS: readonly OpeningReasonCode[] =
  OPENING_REASON_CODES;

/** The countries of registration, by name (a select, never a typed code). */
export const COUNTRY_OPTIONS: readonly { code: string; name: string }[] = [
  ...ISO_COUNTRY_CODES,
]
  .map((code) => ({ code, name: countryName(code) }))
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));

/** What the agent typed, as it stands in the form. */
export type OpeningDraft = {
  reasonCode: string;
  comment: string;
  legalName: string;
  registrationCountryCode: string;
  registrationNumber: string;
};

export const EMPTY_OPENING_DRAFT: OpeningDraft = {
  reasonCode: "",
  comment: "",
  legalName: "",
  registrationCountryCode: "",
  registrationNumber: "",
};

export type OpeningField =
  "reason" | "comment" | "legalName" | "country" | "number";

export type OpeningOutcome =
  | { ok: true; body: OpenVerificationForMemberBody }
  | { ok: false; field: OpeningField; error: string };

/**
 * What the agent typed, checked as the contract and the database check it: a reason of the closed list,
 * its comment (1 to 1 000 characters, required for `other`) and, for a brand that holds no internal block,
 * its three fields together. The level and the line come from the target, never from a field.
 */
export function openingOutcome(
  target: OpeningTarget,
  draft: OpeningDraft,
): OpeningOutcome {
  const reason = OPENING_REASONS.find((code) => code === draft.reasonCode);
  if (reason === undefined) {
    return {
      ok: false,
      field: "reason",
      error: messages.common.reasonPlaceholder,
    };
  }
  const comment = draft.comment.trim();
  if (reason === "other" && comment === "") {
    return { ok: false, field: "comment", error: t.commentMissing };
  }
  if (comment.length > VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH) {
    return {
      ok: false,
      field: "comment",
      error: t.commentTooLong(VERIFICATION_INTERNAL_COMMENT_MAX_LENGTH),
    };
  }
  const base = {
    openingReasonCode: reason,
    ...(comment === "" ? {} : { openingComment: comment }),
  } as const;
  if (target.level === "account_verified") {
    if (target.socialAccountId === null) {
      return {
        ok: false,
        field: "reason",
        error: t.refusals.invalid_level ?? "",
      };
    }
    return {
      ok: true,
      body: {
        level: "account_verified",
        socialAccountId: target.socialAccountId,
        ...base,
      },
    };
  }
  if (!asksInternalDetails(target)) {
    return {
      ok: true,
      body: { level: "brand_verified", socialAccountId: null, ...base },
    };
  }
  const legalName = draft.legalName.trim();
  if (
    legalName === "" ||
    legalName.length > VERIFICATION_LEGAL_NAME_MAX_LENGTH
  ) {
    return { ok: false, field: "legalName", error: t.legalNameInvalid };
  }
  const country = ISO_COUNTRY_CODES.find(
    (code) => code === draft.registrationCountryCode,
  );
  if (country === undefined) {
    return { ok: false, field: "country", error: t.countryInvalid };
  }
  const number = draft.registrationNumber.trim();
  if (
    number === "" ||
    number.length > VERIFICATION_REGISTRATION_NUMBER_MAX_LENGTH
  ) {
    return { ok: false, field: "number", error: t.numberInvalid };
  }
  return {
    ok: true,
    body: {
      level: "brand_verified",
      socialAccountId: null,
      ...base,
      legalName,
      registrationCountryCode: country,
      registrationNumber: number,
    },
  };
}

/** What the member will receive, line by line, before the gesture (the text of the e-mail never carries a code). */
export function recapLines(target: OpeningTarget): string[] {
  return [
    target.level === "brand_verified"
      ? t.recapBrand
      : t.recapCreator(
          target.networkCode === null ? "" : networkName(target.networkCode),
        ),
    t.recapNoCode,
    t.recapTakeover,
    t.recapInternal,
  ];
}

/** The sentence once the request waits: created, or taken over (never doubled). */
export function openedNotice(target: OpeningTarget, created: boolean): string {
  return created
    ? t.created(targetName(target))
    : t.takenOver(targetName(target));
}

/**
 * The refusal of the opening in words, by the issues the details of the error name (never a value):
 * a 409 on `request` or a 400 on a field. Null leaves the generic sentence of the screen.
 */
export function openingRefusal(
  code: string | undefined,
  issues: readonly string[],
): string | null {
  if (code === "not_found") {
    return t.notFound;
  }
  for (const issue of issues) {
    const words = t.refusals[issue];
    if (words !== undefined) {
      return words;
    }
  }
  return null;
}

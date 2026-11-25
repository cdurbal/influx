// Bounds of what an agent types and of what a member sends to be verified (docs/mvp/08 RG25, RG38,
// RG38bis, RG54, RG57; 06 RG51, RG52; jalons/l2e/modele.md §3). The database holds the same bounds
// as checks and as the arguments of its functions (0221, 0222, 0224): the schemas and the screens
// read these constants, never a copy, and a database test holds the two equal (L2E-U1).
import { trimmedLength } from "../brand-profile/required.ts";

/** The handle an agent types after reading it online (0224: 1 to 100, no control character). */
export const OBSERVED_HANDLE_MAX_LENGTH = 100;
/** The internal comment of a decision, for agents only (0224: 1 to 1 000). */
export const INTERNAL_COMMENT_MAX_LENGTH = 1000;
/** The message the member receives, required for `other` and `terms_breach` (0224: 20 to 500). */
export const MEMBER_MESSAGE_MIN_LENGTH = 20;
export const MEMBER_MESSAGE_MAX_LENGTH = 500;
/** The text of a contest, written by the creator (0232: 1 to 1 000 printable characters). */
export const DISPUTE_TEXT_MAX_LENGTH = 1000;
/** The legal name and registration number of a brand (0222: 1 to 160, 1 to 40). */
export const LEGAL_NAME_MAX_LENGTH = 160;
export const REGISTRATION_NUMBER_MAX_LENGTH = 40;

/** Postgres `integer`: the number of publications of the last 30 days is stored in one. */
export const POSTS_LAST_30_DAYS_MAX = 2_147_483_647;
/** One 10 000th: the engagement is kept in basis points, 0 to 100 % (0221, cas limite 2). */
export const OBSERVED_ENGAGEMENT_BP_MAX = 10_000;

/** The alphabet of an ownership code: 31 signs, none that can be mistaken for another (0222). */
export const OWNERSHIP_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
/** `INFLUX-` and eight signs of the alphabet, nothing else, no link, no coordinate (RG22). */
export const OWNERSHIP_CODE_PATTERN =
  /^INFLUX-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/u;

/* eslint-disable no-control-regex -- the point is to refuse them */
const CONTROL_CHARACTER = /[\u0000-\u001F\u007F]/u;
const TEXT_CONTROL_CHARACTER =
  /[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u;
/* eslint-enable no-control-regex */

/** Whether a string is an ownership code as 0222 issues it. */
export function isOwnershipCode(value: string): boolean {
  return OWNERSHIP_CODE_PATTERN.test(value);
}

/** The handle as the agent typed it, margins out: 1 to 100 characters, no control character. */
export function isObservedHandle(value: string): boolean {
  const typed = value.trim();
  return (
    typed.length >= 1 &&
    [...typed].length <= OBSERVED_HANDLE_MAX_LENGTH &&
    !CONTROL_CHARACTER.test(typed)
  );
}

/** A free text of a decision (internal comment, member message): printable, not blank. */
function isPrintableText(value: string, min: number, max: number): boolean {
  const length = [...value].length;
  return (
    length >= min &&
    length <= max &&
    trimmedLength(value) > 0 &&
    !TEXT_CONTROL_CHARACTER.test(value)
  );
}

export function isInternalComment(value: string): boolean {
  return isPrintableText(value, 1, INTERNAL_COMMENT_MAX_LENGTH);
}

export function isMemberMessage(value: string): boolean {
  return isPrintableText(
    value,
    MEMBER_MESSAGE_MIN_LENGTH,
    MEMBER_MESSAGE_MAX_LENGTH,
  );
}

/** The text of a contest as 0232 holds it: printable, not blank, 1 to 1 000 characters (the contact rule is the dispute's, not this check's). */
export function isDisputeText(value: string): boolean {
  return isPrintableText(value, 1, DISPUTE_TEXT_MAX_LENGTH);
}

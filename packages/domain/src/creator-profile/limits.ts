// Bounds of the public texts and the typed values of a creator profile (docs/mvp/07 RG25, RG26,
// RG30, RG43, RG44; jalons/l2d/modele.md). The database holds the same bounds as its checks
// (0216, 0217): the schemas and the screens read these constants, never a copy.
import { trimmedLength } from "../brand-profile/required.ts";

/** Short title (RG25: 20 to 120 characters). */
export const HEADLINE_MIN_LENGTH = 20;
export const HEADLINE_MAX_LENGTH = 120;
/** Bio (RG26: 150 to 800 characters). */
export const BIO_MIN_LENGTH = 150;
export const BIO_MAX_LENGTH = 800;
/** Handle of a network line (RG44: 100 characters at most). */
export const HANDLE_MAX_LENGTH = 100;
/** Pseudonym of a network line (RG30: 60 characters at most). */
export const PSEUDONYM_MAX_LENGTH = 60;
/** Profile URL of a network line (0217: 500 characters at most). */
export const PROFILE_URL_MAX_LENGTH = 500;

/** Whether the short title is long enough to count as entered (RG25, RG87). */
export function hasHeadline(value: string | null | undefined): boolean {
  return trimmedLength(value) >= HEADLINE_MIN_LENGTH;
}

/** Whether the bio reaches the minimum of RG26 (RG87: "bio of 150 characters or more"). */
export function hasBio(value: string | null | undefined): boolean {
  return trimmedLength(value) >= BIO_MIN_LENGTH;
}

/** Whether a short title is inside the bounds of RG25: what a save accepts. */
export function isHeadlineLengthAllowed(value: string): boolean {
  const length = trimmedLength(value);
  return length >= HEADLINE_MIN_LENGTH && length <= HEADLINE_MAX_LENGTH;
}

/** Whether a bio is inside the bounds of RG26: what a save accepts. */
export function isBioLengthAllowed(value: string): boolean {
  const length = trimmedLength(value);
  return length >= BIO_MIN_LENGTH && length <= BIO_MAX_LENGTH;
}

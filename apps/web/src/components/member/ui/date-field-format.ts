// The writing of a civil date in the field of a date (C47; docs/mvp/archives/jalons/rub/modele-ux.md §3): the order of the
// parts follows the language (day, month, year for `fr` and `en`, month then day for `en-US` alone), the
// separators typed are `/`, `.` or `-`, eight digits alone are read too (a numeric keypad has no `/`), the year has
// four digits and an impossible date (31/02) is refused. What leaves is an ISO civil date or nothing. Pure
// functions, no clock and no time zone: a date here is three numbers, never an instant.

export type DateOrder = "dmy" | "mdy";

/** `en-US` is the one language that says the month first; `fr` and `en` (the British use, D25) say the day first. */
export function dateOrderOf(locale: string): DateOrder {
  return locale.toLowerCase() === "en-us" ? "mdy" : "dmy";
}

const SEPARATED = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/;
const EIGHT_DIGITS = /^(\d{2})(\d{2})(\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

const FIRST_YEAR = 1000;

function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one; the date is built in UTC, so that no zone moves it.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const two = (value: number): string => String(value).padStart(2, "0");

/** The ISO civil date of what was typed, or `null` when it is not a date of this order. */
export function parseDateText(text: string, order: DateOrder): string | null {
  const typed = text.trim();
  const match = SEPARATED.exec(typed) ?? EIGHT_DIGITS.exec(typed);
  if (match === null) {
    return null;
  }
  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = Number(match[3]);
  const day = order === "dmy" ? first : second;
  const month = order === "dmy" ? second : first;
  if (
    year < FIRST_YEAR ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return null;
  }
  return `${year}-${two(month)}-${two(day)}`;
}

/** What the field shows of an ISO civil date once it is left: `15/01/2027` (day first) or `01/15/2027` (month first). */
export function formatDateIso(iso: string, order: DateOrder): string {
  const match = ISO_DATE.exec(iso);
  if (match === null) {
    return "";
  }
  const [, year, month, day] = match;
  return order === "dmy"
    ? `${day}/${month}/${year}`
    : `${month}/${day}/${year}`;
}

/** An ISO civil date inside its bounds: both bounds are optional and inclusive (ISO dates compare as text). */
export function isDateWithin(iso: string, min?: string, max?: string): boolean {
  return (min === undefined || iso >= min) && (max === undefined || iso <= max);
}

/** What a typed text is: an ISO date inside the bounds, a date outside them, a text that is no date, or nothing typed. */
export type DateReading =
  | { kind: "empty" }
  | { kind: "valid"; iso: string }
  | { kind: "range" }
  | { kind: "format" };

/** Reads the text of the field against the order of the language and the bounds of the screen. */
export function readDateText(
  text: string,
  order: DateOrder,
  min?: string,
  max?: string,
): DateReading {
  if (text.trim() === "") {
    return { kind: "empty" };
  }
  const iso = parseDateText(text, order);
  if (iso === null) {
    return { kind: "format" };
  }
  return isDateWithin(iso, min, max)
    ? { kind: "valid", iso }
    : { kind: "range" };
}

/** What leaves the field for a reading: its ISO date, or nothing. */
export function dateValueOf(reading: DateReading): string | null {
  return reading.kind === "valid" ? reading.iso : null;
}

/**
 * Whether the screen takes the field back from the typed text (a reset, a load): its value changed since the
 * previous rendering and is not the one the text makes. A bound that moves changes the reading, not the value:
 * the text stays.
 */
export function isDraftTakenBack(
  previousValue: string | null,
  value: string | null,
  reading: DateReading,
): boolean {
  return previousValue !== value && dateValueOf(reading) !== value;
}

/** The refusal said under the field: once the field has been left, never while it is typed. */
export function dateRefusalOf(
  reading: DateReading,
  left: boolean,
): "format" | "range" | null {
  return left && (reading.kind === "format" || reading.kind === "range")
    ? reading.kind
    : null;
}

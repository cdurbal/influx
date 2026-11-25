// The settings of the badge cycle and their bounds (docs/mvp/08 RG69, RG70, RG77, RG100; jalons/l2f/
// modele.md §4; 0221, 0230, 0232 `backoffice.operational_settings`). The table is the SOURCE of every
// value (RG100): a function of this package takes its number as an argument, and nothing here is read
// at run time. This list holds what the table checks, a whole number between `min` and `max`, and the
// value it starts with, so that a test holds the two equal and an administrator's screen can say the
// range. A value outside the range is refused by the table (23514).
export type VerificationParameter = {
  readonly key: string;
  readonly min: number;
  readonly max: number;
  /** The value of the first migration; the administrator moves it, and this one is then only history. */
  readonly start: number;
};

export const VERIFICATION_PARAMETERS = [
  /** Days after `expires_at` a badge stays visible « à rafraîchir » or « à reconfirmer » (RG70). */
  { key: "badge_grace_days", min: 0, max: 365, start: 30 },
  /** Days before `expires_at` the reminder is sent, once (RG70 « J-15 »). */
  { key: "badge_reminder_days", min: 1, max: 90, start: 15 },
  /** Days after the notification a contest may be filed (RG77). */
  { key: "dispute_window_days", min: 1, max: 365, start: 30 },
  /** Hours after the submission before the decider of a refusal may judge it alone (EC-L2F-10). */
  { key: "dispute_reflection_hours", min: 24, max: 168, start: 24 },
] as const satisfies readonly VerificationParameter[];

export type VerificationParameterKey =
  (typeof VERIFICATION_PARAMETERS)[number]["key"];

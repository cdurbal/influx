// What the e-mail privacy.erasure_completed needs of an executed erasure (D72; 0150 DZ-3), read by
// privacy.read_erasure_notification_subject() on the E-5 pool (execution.ts): the address held since
// the execution, the account's language and time zone, and the instant of the deletion. A type of
// its own, so that the Brevo connector names it without importing the repository of the domain.
export type ErasureNotificationSubject = {
  email: string;
  preferredLanguage: string | null;
  timeZone: string;
  /** ISO 8601, the instant of the erasure. */
  erasedAt: string;
};

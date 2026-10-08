// The addresses of the browser journeys: one per journey, new at each run (the run identifier is
// set once by playwright.config.ts and inherited by the workers). apps/api runs in `redirect`
// mode and delivers a code to these addresses only (BREVO_TEST_RECIPIENTS): any other address of
// a journey would be set aside, never sent.

export const E2E_RUN_VARIABLE = "INFLUX_E2E_RUN";

export const MAILBOXES = [
  "brand-nominal",
  "creator-nominal",
  "reload-code",
  "reload-details-door",
  "reload-details-sign-in",
  "language",
  "change-address",
  "resume-gives-up",
  "banner-open-mobile",
  "banner-open-desktop",
] as const;

export type Mailbox = (typeof MAILBOXES)[number];

function runId(): string {
  const value = process.env[E2E_RUN_VARIABLE];
  if (value === undefined || value === "") {
    throw new Error(
      `${E2E_RUN_VARIABLE} is not set: run through playwright.config.ts`,
    );
  }
  return value;
}

export function mailboxAddress(mailbox: Mailbox): string {
  return `e2e-${runId()}-${mailbox}@example.test`;
}

export function mailboxAddresses(): string[] {
  return MAILBOXES.map(mailboxAddress);
}

// D69 (founder, 2026-10-18): the welcome e-mails (05 RG86) and the notice of a changed address
// (RG58) are written by INFLUX from its translation files, Brevo only carries them (16 RG67). Each
// text exists in both languages, is accepted by the output check of the rendered e-mails (no link of
// any kind, RG158), and holds nothing RG86 and D48 forbid: no amount, no percentage.
import { describe, expect, it } from "vitest";
import { renderEmailChangedNoticeEmail } from "../src/domains/identity/email-changed-notice-email.ts";
import { renderWelcomeEmail } from "../src/domains/identity/welcome-email.ts";
import { checkRenderedTransactionalOutput } from "../src/domains/leads/connectors/brevo/index.ts";
import type { RenderedEmail } from "../src/domains/identity/login-code-email.ts";

const LOCALES = ["fr", "en"] as const;

function bodyOf(email: RenderedEmail) {
  return {
    sender: { name: "INFLUX", email: "no-reply@tx.influx.example" },
    to: [{ email: "lena-k7q2@example.test" }],
    subject: email.subject,
    htmlContent: email.html,
    textContent: email.text,
    tags: ["account.welcome_creator"],
  };
}

const RENDERED: readonly [string, (locale: "fr" | "en") => RenderedEmail][] = [
  [
    "welcome advertiser",
    (locale) => renderWelcomeEmail({ locale, role: "advertiser" }),
  ],
  [
    "welcome creator",
    (locale) => renderWelcomeEmail({ locale, role: "creator" }),
  ],
  [
    "notice to the previous address",
    (locale) => renderEmailChangedNoticeEmail({ locale, side: "previous" }),
  ],
  [
    "notice to the current address",
    (locale) => renderEmailChangedNoticeEmail({ locale, side: "current" }),
  ],
];

describe("D69: the queue e-mails written by INFLUX", () => {
  it.each(
    RENDERED.flatMap(([name, render]) =>
      LOCALES.map((locale) => [name, locale, render] as const),
    ),
  )(
    "%s (%s): accepted by the output check, no amount nor percentage",
    (_name, locale, render) => {
      const email = render(locale);
      expect(checkRenderedTransactionalOutput(bodyOf(email))).toEqual([]);
      expect(email.html).toContain(`<html lang="${locale}">`);
      expect(email.text).not.toMatch(/%|€|\$|\d+ ?(EUR|USD|GBP)/);
      expect(email.text.split("\n").at(-1)).toMatch(
        locale === "fr"
          ? /Il ne s'agit pas d'un e-mail commercial\.$/
          : /not a marketing email\.$/,
      );
    },
  );

  it("one text per role (RG86): the two welcomes differ, and say which account was created", () => {
    const advertiser = renderWelcomeEmail({ locale: "fr", role: "advertiser" });
    const creator = renderWelcomeEmail({ locale: "fr", role: "creator" });
    expect(advertiser.text).toContain("Votre compte marque est créé");
    expect(creator.text).toContain("Votre compte créateur est créé");
    expect(advertiser.text).not.toBe(creator.text);
  });

  it("the notice tells each side its own fact, and escapes nothing into the HTML", () => {
    const previous = renderEmailChangedNoticeEmail({
      locale: "en",
      side: "previous",
    });
    const current = renderEmailChangedNoticeEmail({
      locale: "en",
      side: "current",
    });
    expect(previous.text).toContain("can no longer be used to sign in");
    expect(current.text).toContain("you now sign in with this address");
    expect(current.html).toContain("&quot;My sessions&quot;");
  });
});

// The e-mails auth.email_change_confirm_old and auth.email_change_confirm_new (05 RG58; 16 §H,
// RG67; 03 A-11; J7 decision 5): one code per side, typed in the member space, never a link nor an
// address in the body; the subject and the preheader never hold the code (CA76).
import { describe, expect, it } from "vitest";
import { renderEmailChangeEmail } from "../src/domains/identity/email-change-email.ts";

const REQUESTED_AT = new Date("2026-10-14T09:30:00Z");

function render(
  overrides: Partial<Parameters<typeof renderEmailChangeEmail>[0]> = {},
) {
  return renderEmailChangeEmail({
    side: "old",
    locale: "fr",
    code: "604218",
    requestedAt: REQUESTED_AT,
    timeZone: "UTC",
    ...overrides,
  });
}

describe("content and order (title, code, validity, context, not you, never, reason)", () => {
  it("writes the French text of the old side, the code alone on its line", () => {
    const { subject, text } = render();
    expect(subject).toBe(
      "Confirmez le changement d'adresse de votre compte INFLUX",
    );
    expect(text.split("\n").filter((line) => line !== "")).toEqual([
      "Changement d'adresse : confirmation depuis votre adresse actuelle",
      "Saisissez ce code dans votre espace INFLUX, à l'étape « adresse actuelle » :",
      "604218",
      "Ce code est valable 24 heures. Le changement n'a lieu qu'une fois confirmé aussi depuis la nouvelle adresse ; d'ici là, vous vous connectez toujours avec cette adresse-ci.",
      "Demande reçue le 14 octobre 2026 à 09:30 (UTC).",
      "Vous n'avez rien demandé ? Ne saisissez pas ce code et fermez toutes vos sessions depuis votre espace INFLUX : sans ce code, l'adresse de votre compte ne peut pas changer.",
      "INFLUX ne vous demandera jamais ce code, ni par téléphone, ni par e-mail, ni par message. Ne le communiquez à personne.",
      "Vous recevez cet e-mail parce que un changement de l'adresse de votre compte INFLUX a été demandé. Il ne s'agit pas d'un e-mail commercial.",
    ]);
  });

  it("writes the English text of the new side", () => {
    const { subject, text } = render({ side: "new", locale: "en" });
    expect(subject).toBe("Confirm your new INFLUX address");
    expect(text).toContain(
      "Enter this code in your INFLUX space, at the “new address” step:",
    );
    expect(text).toContain(
      "Request received on October 14, 2026 at 9:30 AM (UTC).",
    );
    expect(text).toContain(
      "this address was given as the new address of an INFLUX account",
    );
  });

  it("the two sides say different things in each language (A-11: the reader knows which step)", () => {
    for (const locale of ["fr", "en"] as const) {
      const old = render({ locale, side: "old" });
      const fresh = render({ locale, side: "new" });
      expect(old.subject).not.toBe(fresh.subject);
      expect(old.text).not.toBe(fresh.text);
    }
  });
});

describe("what never appears (decision 5, CA76, 16 RG158)", () => {
  it("no code in the subject nor in the preheader; the code in the body only", () => {
    for (const locale of ["fr", "en"] as const) {
      for (const side of ["old", "new"] as const) {
        const { subject, html, text } = render({ locale, side });
        expect(subject).not.toContain("604218");
        const preheader = /<div style="display:none">([^<]*)<\/div>/.exec(
          html,
        )?.[1];
        expect(preheader).toBeDefined();
        expect(preheader).not.toContain("604218");
        expect(text).toContain("604218");
        expect(html).toContain("604218");
      }
    }
  });

  it("no address, no link, no image: the code is typed in the space, never followed", () => {
    for (const locale of ["fr", "en"] as const) {
      for (const side of ["old", "new"] as const) {
        const { html, text } = render({ locale, side });
        for (const body of [html, text]) {
          expect(body).not.toContain("@");
          expect(body).not.toMatch(/https?:|<a |<img /i);
        }
      }
    }
  });

  it("escapes the HTML of every text", () => {
    const { html } = render({ code: "<b>1</b>" });
    expect(html).toContain("&lt;b&gt;1&lt;/b&gt;");
    expect(html).not.toContain("<b>1</b>");
  });
});

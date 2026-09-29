// The e-mail auth.login_code (16 RG156, RG158, RG159; 05 RG135; CA76).
import { describe, expect, it } from "vitest";
import {
  browserLabel,
  renderLoginCodeEmail,
} from "../src/domains/identity/login-code-email.ts";

const REQUESTED_AT = new Date("2026-09-28T21:05:00Z");

function render(
  overrides: Partial<Parameters<typeof renderLoginCodeEmail>[0]> = {},
) {
  return renderLoginCodeEmail({
    locale: "fr",
    code: "482913",
    phrase: "ancre lune",
    requestedAt: REQUESTED_AT,
    timeZone: "UTC",
    browser: "firefox.windows",
    ...overrides,
  });
}

describe("16 RG156: content and order", () => {
  it("writes the French text in the imposed order, the code alone on its line", () => {
    const { subject, text } = render();
    expect(subject).toBe("Votre code de connexion INFLUX");
    const lines = text.split("\n").filter((line) => line !== "");
    expect(lines).toEqual([
      "Votre code de connexion",
      "Saisissez ce code sur l'écran INFLUX où vous l'avez demandé :",
      "482913",
      "Phrase de correspondance : ancre lune",
      "Elle doit être identique à celle affichée sur cet écran. Si elle est différente, ne saisissez pas ce code.",
      "Ce code est valable 10 minutes et une seule fois, uniquement dans l'onglet où vous l'avez demandé.",
      "Demande reçue le 28 septembre 2026 à 21:05 (UTC), depuis Firefox sur Windows.",
      "Vous n'avez rien demandé ? Ignorez cet e-mail : sans ce code, personne ne peut se connecter à INFLUX avec votre adresse.",
      "INFLUX ne vous demandera jamais ce code, ni par téléphone, ni par e-mail, ni par message. Ne le communiquez à personne.",
      // The exact texts of 16 RG155 and RG156 give "parce que un" (no elision): reported.
      "Vous recevez cet e-mail parce que un code de connexion a été demandé pour cette adresse sur INFLUX. Il ne s'agit pas d'un e-mail commercial.",
    ]);
  });

  it("writes the English text, the phrase kept as shown on the page (RG129)", () => {
    const { subject, text } = render({ locale: "en", phrase: "ancre lune" });
    expect(subject).toBe("Your INFLUX sign-in code");
    expect(text).toContain("Matching phrase: ancre lune");
    expect(text).toContain(
      "Request received on September 28, 2026 at 9:05 PM (UTC) from Firefox on Windows.",
    );
    expect(text).toContain(
      "You are receiving this email because a sign-in code was requested for this address on INFLUX.",
    );
  });

  it("writes the context without the browser when it is unidentified (RG135)", () => {
    const { text } = render({ browser: "unidentified.unidentified" });
    expect(text).toContain("Demande reçue le 28 septembre 2026 à 21:05 (UTC).");
    expect(text).not.toContain("navigateur");
    expect(browserLabel("fr", "unidentified.unidentified")).toBeNull();
  });

  it("writes the hour in the given time zone, with its name", () => {
    const { text } = render({ timeZone: "America/Sao_Paulo", locale: "en" });
    expect(text).toContain("at 6:05 PM (GMT-3)");
  });
});

describe("what the e-mail never holds (RG158, CA76, 03 A-7)", () => {
  it("keeps the code and the phrase out of the subject and the preheader", () => {
    for (const locale of ["fr", "en"] as const) {
      const { subject, html } = render({ locale });
      const preheader = /<div style="display:none">([^<]*)<\/div>/.exec(
        html,
      )?.[1];
      expect(preheader).toBeDefined();
      for (const value of ["482913", "ancre", "lune"]) {
        expect(subject).not.toContain(value);
        expect(preheader).not.toContain(value);
      }
    }
  });

  it("holds no link, no image, no country and no address", () => {
    for (const locale of ["fr", "en"] as const) {
      const { html, text } = render({ locale });
      for (const body of [html, text]) {
        expect(body).not.toMatch(/https?:|www\.|href|<a[\s>]|<img/i);
        expect(body).not.toMatch(/\b\d{1,3}(?:\.\d{1,3}){3}\b/);
        expect(body).not.toMatch(/@/);
      }
    }
  });

  it("escapes what it writes into the HTML version", () => {
    const { html } = render({ phrase: "<b>x</b> & y" });
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt; &amp; y");
    expect(html).not.toContain("<b>x</b>");
  });

  it("writes the same paragraphs in the text and the HTML versions", () => {
    const { html, text } = render();
    for (const line of text.split("\n").filter((item) => item !== "")) {
      expect(html).toContain(
        line.replaceAll("'", "&#39;").replaceAll('"', "&quot;"),
      );
    }
  });
});

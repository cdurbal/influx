// The e-mail auth.new_device, "nouveau navigateur" (16 RG157, RG158; 05 RG141, RG142, RG144; 21
// EC-43): the exact texts of RG157 in both languages, the browser named by its summary (or "un
// navigateur non identifié"), the date and time in the given zone, and NOTHING of what is forbidden:
// no link of any kind, no country, no place, no IP address, never "appareil inconnu" nor
// "connexion suspecte".
import { USER_AGENT_SUMMARIES } from "@influx/contracts/user-agent";
import { describe, expect, it } from "vitest";
import { renderNewDeviceEmail } from "../src/domains/identity/new-device-email.ts";

const SIGNED_IN_AT = new Date("2026-10-14T09:30:00Z");

function render(
  overrides: Partial<Parameters<typeof renderNewDeviceEmail>[0]> = {},
) {
  return renderNewDeviceEmail({
    locale: "fr",
    signedInAt: SIGNED_IN_AT,
    timeZone: "UTC",
    browser: "safari.ios",
    ...overrides,
  });
}

describe("content and order (16 RG157)", () => {
  it("writes the French text, steps numbered, the reason last", () => {
    const { subject, text } = render();
    expect(subject).toBe("Nouvelle connexion à votre compte INFLUX");
    expect(text.split("\n").filter((line) => line !== "")).toEqual([
      "Nouvelle connexion depuis un nouveau navigateur",
      "Une connexion à votre compte INFLUX a eu lieu le 14 octobre 2026 à 09:30 (UTC) depuis Safari sur iOS. Ce navigateur n'avait pas été utilisé sur votre compte au cours des 30 derniers jours.",
      "Si c'était vous, vous n'avez rien à faire.",
      "Si ce n'était pas vous :",
      "1. Sécurisez d'abord votre boîte e-mail (changez son mot de passe) : c'est elle qui reçoit vos codes de connexion.",
      "2. Connectez-vous à INFLUX, ouvrez « Mes sessions » et choisissez « Fermer toutes les sessions ».",
      "3. Si vous ne parvenez pas à vous connecter, contactez INFLUX depuis l'aide de l'écran de connexion.",
      "INFLUX ne vous demandera jamais votre code de connexion.",
      "Vous recevez cet e-mail parce que une connexion à votre compte INFLUX a eu lieu depuis un nouveau navigateur. Il ne s'agit pas d'un e-mail commercial.",
    ]);
  });

  it("writes the English text, the preheader naming the browser", () => {
    const { subject, text, html } = render({
      locale: "en",
      browser: "firefox.windows",
    });
    expect(subject).toBe("New sign-in to your INFLUX account");
    expect(text).toContain(
      "Someone signed in to your INFLUX account on October 14, 2026 at 9:30 AM (UTC) from Firefox on Windows.",
    );
    expect(text).toContain("If this wasn't you:");
    expect(html).toContain(
      '<div style="display:none">From Firefox on Windows. If this was you, there is nothing to do.</div>',
    );
    expect(html).toContain("<ol><li>First secure your email inbox");
  });

  it("names an unidentified summary 'un navigateur non identifié' (never left out)", () => {
    expect(render({ browser: "unidentified.unidentified" }).text).toContain(
      "depuis un navigateur non identifié.",
    );
    expect(
      render({ locale: "en", browser: "unidentified.unidentified" }).text,
    ).toContain("from an unidentified browser.");
  });

  it("writes the time in the given zone, and names it", () => {
    const { text } = render({ timeZone: "Europe/Paris" });
    expect(text).toContain("le 14 octobre 2026 à 11:30 (UTC+2)");
  });
});

describe("what never appears (16 RG158; 05 RG144; EC-43)", () => {
  const FORBIDDEN = [
    /<a[\s>]/i,
    /href/i,
    /https?:/i,
    /mailto:/i,
    /www\./i,
    /<img/i,
    /\bpays\b/i,
    /\bcountry\b/i,
    // "a eu lieu" (took place) is the text of RG157; "lieu" as a place is forbidden
    /(?<!eu )\blieu\b/i,
    /\blocation\b/i,
    /appareil inconnu/i,
    /unknown device/i,
    /suspect/i,
    /\bIP\b/,
  ];

  it("no link, image, place, country, IP nor alarming word, for any summary and language", () => {
    for (const locale of ["fr", "en"] as const) {
      for (const browser of USER_AGENT_SUMMARIES) {
        const { subject, html, text } = render({ locale, browser });
        for (const pattern of FORBIDDEN) {
          expect(`${subject}\n${html}\n${text}`, String(pattern)).not.toMatch(
            pattern,
          );
        }
      }
    }
  });

  it("escapes the html", () => {
    const { html } = render();
    expect(html).not.toContain("« Mes sessions »".replace("«", "<"));
    expect(html).toMatch(/^<!doctype html><html lang="fr">/);
  });
});

// The e-mail privacy.erasure_completed, the answer to an erasure (D72, 16 RG160 bis, T7): the exact
// texts of RG160 bis in both languages and their order, the date in the account's time zone with its
// name, and NOTHING of what is forbidden: no link, no address, no domain, no figure beyond the date
// of the deletion, no identifier, no commercial content.
import { describe, expect, it } from "vitest";
import { renderErasureCompletedEmail } from "../src/domains/privacy/erasure-completed-email.ts";

const ERASED_AT = new Date("2026-10-28T09:30:00Z");

function render(
  overrides: Partial<Parameters<typeof renderErasureCompletedEmail>[0]> = {},
) {
  return renderErasureCompletedEmail({
    locale: "fr",
    erasedAt: ERASED_AT,
    timeZone: "UTC",
    ...overrides,
  });
}

describe("content and order (16 RG160 bis)", () => {
  it("writes the French text: done, deleted, kept, new account, not you, the reason last", () => {
    const { subject, text } = render();
    expect(subject).toBe("Votre compte INFLUX est supprimé");
    expect(text.split("\n").filter((line) => line !== "")).toEqual([
      "Votre compte INFLUX est supprimé",
      "Votre compte INFLUX a été supprimé, à votre demande, le 28 octobre 2026 à 09:30 (UTC). Vous êtes déconnecté de tous vos appareils et vous ne pouvez plus vous connecter avec ce compte.",
      "Ce qui a été supprimé : vos informations de profil et de contact, vos sessions de connexion et vos fichiers d'export de données ont été supprimés ou rendus anonymes. Nous avons aussi demandé à nos prestataires d'e-mails et de prospection de supprimer votre contact.",
      "Ce qui est conservé, sous une forme qui ne vous nomme plus, et pourquoi : le journal d'activité de la plateforme, pour la sécurité et pour prouver que nous respectons nos obligations ; la trace de votre acceptation des conditions d'utilisation et de votre consentement, pour pouvoir démontrer qu'ils ont été respectés ; les e-mails déjà envoyés et le journal de leurs envois, pour garder la trace de nos communications. S'il en existe, vos mises en relation, affaires et conversations avec des marques ou des créateurs sont conservées de la même façon, sans vous nommer.",
      "Une nouvelle inscription avec la même adresse crée un compte entièrement nouveau : rien de votre ancien compte n'y est repris.",
      "Vous n'êtes pas à l'origine de cette suppression ? Elle a été confirmée par un code envoyé à cette adresse. Signalez-le à INFLUX depuis l'aide de l'écran de connexion, en indiquant la date de cet e-mail.",
      "Vous recevez cet e-mail parce que vous avez supprimé votre compte INFLUX. Il ne s'agit pas d'un e-mail commercial.",
    ]);
  });

  it("writes the English text in the account's time zone, with its name", () => {
    const { subject, text, html } = render({
      locale: "en",
      timeZone: "America/Toronto",
    });
    expect(subject).toBe("Your INFLUX account has been deleted");
    const lines = text.split("\n").filter((line) => line !== "");
    expect(lines[0]).toBe("Your INFLUX account has been deleted");
    expect(lines[1]).toMatch(
      /^Your INFLUX account was deleted, at your request, on October 28, 2026 at 5:30\sAM \(EDT\)\. You have been signed out of all your devices/,
    );
    expect(lines[2]).toMatch(/^What was deleted:/);
    expect(lines[3]).toMatch(
      /^What is kept, in a form that no longer names you/,
    );
    expect(lines[4]).toMatch(/^Signing up again with the same address/);
    expect(lines[5]).toMatch(/^Didn't ask for this deletion\?/);
    expect(lines[6]).toBe(
      "You are receiving this email because you deleted your INFLUX account. This is not a marketing email.",
    );
    expect(html).toContain('<html lang="en">');
    expect(html).toContain(
      '<div style="display:none">Your account was deleted on October 28, 2026.</div>',
    );
  });

  it("dates the deletion in the zone of the account, the day included", () => {
    const late = new Date("2026-10-28T23:30:00Z");
    expect(render({ erasedAt: late, timeZone: "Asia/Tokyo" }).text).toContain(
      "le 29 octobre 2026 à 08:30 (",
    );
  });
});

describe("nothing of what is forbidden (16 RG160 bis, RG158)", () => {
  const FORBIDDEN = [
    /<a[\s>]/i,
    /href/i,
    /https?:/i,
    /www\./i,
    /mailto:/i,
    /@/,
    /[a-z0-9-]\.[a-z]{2,}/i,
    /[0-9a-f]{8}-[0-9a-f]{4}-/i,
    /preuve légale|valeur probante|horodatage certifié/i,
    /legal proof|probative|certified timestamp/i,
    /RGPD|GDPR|article/i,
    /%/,
    /promo|offre|offer|discount/i,
  ];

  it.each(["fr", "en"] as const)("%s", (locale) => {
    const { subject, text, html } = render({ locale });
    for (const pattern of FORBIDDEN) {
      expect(subject, String(pattern)).not.toMatch(pattern);
      expect(text, String(pattern)).not.toMatch(pattern);
      // the head of the page is markup of ours, the check holds on the body
      expect(html.slice(html.indexOf("<body>")), String(pattern)).not.toMatch(
        pattern,
      );
    }
  });
});

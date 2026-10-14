// The e-mail privacy.request_received, the acknowledgement of a "mes données" request (16 RG160,
// CA117): the exact texts of RG160 in both languages, the variant of the type (what is kept for an
// erasure only), the dates in the account's time zone, a deadline never later than the database's,
// and NOTHING of what is forbidden: no link, no address, no domain, no promise of execution, no
// internal goal, none of the words of 17 §6.3.
import { describe, expect, it } from "vitest";
import {
  deadlineTimeZone,
  renderDataRequestReceivedEmail,
} from "../src/domains/identity/data-request-received-email.ts";

const RECEIVED_AT = new Date("2026-10-14T09:30:00Z");
const DUE_AT = new Date("2026-11-13T09:30:00Z");

function render(
  overrides: Partial<Parameters<typeof renderDataRequestReceivedEmail>[0]> = {},
) {
  return renderDataRequestReceivedEmail({
    locale: "fr",
    type: "access",
    receivedAt: RECEIVED_AT,
    dueAt: DUE_AT,
    timeZone: "UTC",
    ...overrides,
  });
}

describe("content and order (16 RG160 point 6)", () => {
  it("writes the French text of an export, without what is kept, the reason last", () => {
    const { subject, text } = render();
    expect(subject).toBe(
      "Votre demande d'export de données INFLUX est bien reçue",
    );
    expect(text.split("\n").filter((line) => line !== "")).toEqual([
      "Demande d'export de vos données reçue",
      "Nous avons bien reçu votre demande d'export de vos données personnelles, déposée depuis votre espace INFLUX le 14 octobre 2026 à 09:30 (UTC).",
      "Rien n'est envoyé automatiquement : une personne de l'équipe INFLUX traite votre demande et prépare un fichier lisible avec les données personnelles que nous détenons sur vous. Nous vous indiquerons comment le récupérer de façon sécurisée ; il ne vous sera jamais envoyé en pièce jointe.",
      "Nous vous répondrons à cette adresse au plus tard le 13 novembre 2026.",
      "Vous pouvez suivre cette demande dans votre espace INFLUX, rubrique « Mes données ».",
      "Vous n'êtes pas à l'origine de cette demande ? Elle a été confirmée par un code envoyé à cette adresse :",
      "1. Sécurisez d'abord votre boîte e-mail (changez son mot de passe).",
      "2. Connectez-vous à INFLUX, ouvrez « Mes sessions » et choisissez « Fermer toutes les sessions ».",
      "3. Signalez-le ensuite à INFLUX depuis l'aide de l'écran de connexion, en indiquant la date de la demande.",
      "INFLUX ne vous demandera jamais votre code de connexion.",
      "Vous recevez cet e-mail parce que une demande concernant vos données personnelles a été déposée depuis votre compte INFLUX. Il ne s'agit pas d'un e-mail commercial.",
    ]);
  });

  it("CA117: an erasure in English in America/Toronto, what is kept before the deadline", () => {
    const { subject, text, html } = render({
      locale: "en",
      type: "erasure",
      timeZone: "America/Toronto",
    });
    expect(subject).toBe(
      "Your INFLUX account deletion request has been received",
    );
    const lines = text.split("\n").filter((line) => line !== "");
    expect(lines[0]).toBe("Account deletion request received");
    expect(lines[1]).toMatch(
      /^We have received your request to delete your INFLUX account, submitted from your account on October 14, 2026 at 5:30\sAM \(EDT\)\.$/,
    );
    expect(lines[2]).toBe(
      "Nothing is deleted automatically: a member of the INFLUX team handles your request. Until then, your account remains active and you can still sign in.",
    );
    expect(lines[3]).toMatch(/^Some information is not erased but kept/);
    expect(lines[4]).toBe(
      "We will reply to this address by November 13, 2026 at the latest.",
    );
    expect(html).toContain(
      '<div style="display:none">A member of the INFLUX team will handle it. You will hear from us by November 13, 2026 at the latest.</div>',
    );
    expect(html).toContain("<ol><li>First secure your email inbox");
  });
});

describe("the deadline is never later than the database's (16 RG160, variables)", () => {
  it("a zone ahead of UTC that would move it to the next day writes the UTC date", () => {
    const due = new Date("2026-11-13T21:00:00Z");
    expect(deadlineTimeZone(due, "Asia/Tokyo")).toBe("UTC");
    expect(render({ dueAt: due, timeZone: "Asia/Tokyo" }).text).toContain(
      "au plus tard le 13 novembre 2026.",
    );
  });

  it("a zone behind UTC keeps its own (earlier) date", () => {
    const due = new Date("2026-11-13T02:00:00Z");
    expect(deadlineTimeZone(due, "America/Toronto")).toBe("America/Toronto");
    expect(render({ dueAt: due, timeZone: "America/Toronto" }).text).toContain(
      "au plus tard le 12 novembre 2026.",
    );
  });
});

describe("nothing of what is forbidden (16 RG160 points 5 and interdits)", () => {
  const FORBIDDEN = [
    /<a[\s>]/i,
    /href/i,
    /https?:/i,
    /www\./i,
    /mailto:/i,
    /@/,
    /[a-z0-9-]\.[a-z]{2,}/i,
    /preuve légale|valeur probante|horodatage certifié/i,
    /legal proof|probative|certified timestamp/i,
    /10 jours|10 days|ouvrés|business days/i,
    /RGPD|GDPR|article/i,
    /a été supprimé le|sera supprimé le|have been deleted|will be deleted on/i,
    /%/,
  ];

  it.each([
    ["fr", "access"],
    ["fr", "erasure"],
    ["en", "access"],
    ["en", "erasure"],
  ] as const)("%s %s", (locale, type) => {
    const { subject, text, html } = render({ locale, type });
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

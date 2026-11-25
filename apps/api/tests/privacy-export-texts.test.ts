// The texts of an export (J8 commit 8; runbook demandes-rgpd §4): the notice stored in the file
// (both languages, the same 15 categories as the database's file, each with its purpose, legal
// basis, retention and source; small enough for privacy.execute_request) and the e-mail
// privacy.export_ready (where and until when, in the account's time zone; no link, no attachment,
// no domain, no address).
import { describe, expect, it } from "vitest";
import { renderExportReadyEmail } from "../src/domains/privacy/export-ready-email.ts";
import {
  DATA_EXPORT_CATEGORIES,
  exportNotice,
  noticeLocaleOf,
} from "../src/domains/privacy/notice.ts";

/** 0136: privacy.execute_request() refuses a notice over 64 KiB. */
const NOTICE_MAX_BYTES = 64 * 1024;

const LINK = /https?:|www\.|[a-z0-9-]+\.(?:com|fr|io|test|net|org)\b|@/i;

function keysOf(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    keysOf(child, prefix === "" ? key : `${prefix}.${key}`),
  );
}

describe("the notice of an export (art. 15(1) a-h and 15(2))", () => {
  it("has the same keys in French and in English, the language named", () => {
    const fr = exportNotice("fr");
    const en = exportNotice("en");
    expect(keysOf(fr).sort()).toEqual(keysOf(en).sort());
    expect(fr.language).toBe("fr");
    expect(en.language).toBe("en");
  });

  it("describes exactly the 15 categories of the file, each with its five answers", () => {
    for (const locale of ["fr", "en"] as const) {
      const categories = exportNotice(locale).categories as Record<
        string,
        Record<string, string>
      >;
      expect(Object.keys(categories)).toEqual([...DATA_EXPORT_CATEGORIES]);
      for (const entry of Object.values(categories)) {
        expect(Object.keys(entry).sort()).toEqual([
          "content",
          "label",
          "legal_basis",
          "purpose",
          "retention",
          "source",
        ]);
        for (const text of Object.values(entry)) {
          expect(text.trim().length).toBeGreaterThan(2);
        }
      }
    }
  });

  it("says who receives the data, the transfers, the rights, the complaint and the absence of automated decision", () => {
    for (const locale of ["fr", "en"] as const) {
      const notice = exportNotice(locale);
      for (const key of [
        "about",
        "format",
        "excluded",
        "recipients",
        "transfers",
        "rights",
        "complaint",
        "automated_decisions",
      ]) {
        expect(typeof notice[key], `${locale}.${key}`).toBe("string");
      }
      expect(String(notice.complaint)).toContain(
        "Information Commissioner's Office",
      );
      expect(String(notice.recipients)).toContain("Apollo.io");
    }
  });

  it("fits the bound of the database and carries no link nor address", () => {
    for (const locale of ["fr", "en"] as const) {
      const serialized = JSON.stringify(exportNotice(locale));
      expect(Buffer.byteLength(serialized, "utf8")).toBeLessThan(
        NOTICE_MAX_BYTES,
      );
      // Apollo.io is a name, not a link: removed before the check.
      expect(serialized.replaceAll("Apollo.io", "Apollo")).not.toMatch(LINK);
    }
  });

  it("is written in the account's UI language, English for any other value", () => {
    expect(noticeLocaleOf("fr")).toBe("fr");
    expect(noticeLocaleOf("en")).toBe("en");
    expect(noticeLocaleOf("de")).toBe("en");
    expect(noticeLocaleOf(null)).toBe("en");
  });
});

describe("the e-mail privacy.export_ready", () => {
  const EXPIRES_AT = new Date("2026-10-23T09:30:00Z");

  it("writes where and until when in French, the reason last", () => {
    const { subject, text } = renderExportReadyEmail({
      locale: "fr",
      expiresAt: EXPIRES_AT,
      timeZone: "UTC",
    });
    expect(subject).toBe("Votre export de données INFLUX est disponible");
    const lines = text.split("\n").filter((line) => line !== "");
    expect(lines[0]).toBe("Votre export de données est prêt");
    expect(lines[1]).toBe(
      "Le fichier des données personnelles que nous détenons sur vous est disponible dans votre espace INFLUX, rubrique « Mes données », jusqu'au 23 octobre 2026 à 09:30 (UTC).",
    );
    expect(lines.at(-1)).toBe(
      "Vous recevez cet e-mail parce que vous avez demandé l'export de vos données personnelles depuis votre compte INFLUX. Il ne s'agit pas d'un e-mail commercial.",
    );
  });

  it("dates the deadline in the account's time zone, with its name, in English", () => {
    const { text, html } = renderExportReadyEmail({
      locale: "en",
      expiresAt: EXPIRES_AT,
      timeZone: "America/Toronto",
    });
    expect(text).toMatch(
      /under "My data", until October 23, 2026 at 5:30\sAM \(EDT\)\./,
    );
    expect(html).toContain("<h1>Your data export is ready</h1>");
    expect(html).toContain("&quot;My data&quot;");
  });

  it("carries no link, no domain, no address, never the word attachment as an offer", () => {
    for (const locale of ["fr", "en"] as const) {
      const { subject, text, html } = renderExportReadyEmail({
        locale,
        expiresAt: EXPIRES_AT,
        timeZone: "Europe/Paris",
      });
      for (const part of [subject, text, html.replace(/<[^>]+>/g, " ")]) {
        expect(part).not.toMatch(LINK);
      }
      expect(html).not.toMatch(/<a\s|href=|src=/i);
    }
  });
});

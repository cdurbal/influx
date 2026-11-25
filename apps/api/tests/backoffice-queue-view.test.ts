// The pieces of the queue API that need no database (docs/mvp/06 RG19, RG66, RG70; 15 RG34;
// jalons/l2c/file.md A6, A7; commit 11): the parity of the closed lists with their twins, the
// preview of a refusal message, the alerts of a line, the cursor of the list.
import {
  CONTACT_SIGNAL_CODES,
  REJECTION_REASON_CODES,
  REVIEW_ALERT_CODES,
} from "@influx/contracts/backoffice-queues";
import { CONTACT_SIGNALS } from "@influx/domain/brand-profile";
import { describe, expect, it } from "vitest";
import {
  decodeEntryCursor,
  encodeEntryCursor,
} from "../src/domains/backoffice/queues-routes.ts";
import {
  alertCodesOf,
  contactAlerts,
  domainAlerts,
} from "../src/domains/backoffice/queues/entry-alerts.ts";
import {
  rejectionReasonOf,
  rejectionReasonPreview,
} from "../src/domains/profiles/brand-decision-email.ts";
import french from "../src/locales/fr/email.json" with { type: "json" };

describe("the closed lists of the contract are their twins (file.md A6, A7)", () => {
  it("the contact signals are the domain's, in its order", () => {
    expect([...CONTACT_SIGNAL_CODES]).toEqual([...CONTACT_SIGNALS]);
  });

  it("the refusal reasons are the translation files' keys, in both languages, each with its message and next step", () => {
    expect([...REJECTION_REASON_CODES].sort()).toEqual(
      Object.keys(french.email.profileDecision.reason).sort(),
    );
    for (const locale of ["fr", "en"] as const) {
      for (const code of REJECTION_REASON_CODES) {
        expect(rejectionReasonOf(code)).toBe(code);
        const preview = rejectionReasonPreview(locale, code);
        expect(preview.message.length, `${locale} ${code}`).toBeGreaterThan(10);
        expect(preview.nextStep.length, `${locale} ${code}`).toBeGreaterThan(
          10,
        );
      }
    }
    expect(rejectionReasonOf("no_such_reason")).toBeNull();
    expect(rejectionReasonPreview("fr", "sector_inconsistent").message).toBe(
      "Le secteur déclaré ne correspond pas à votre activité.",
    );
  });
});

describe("the alerts of an entry (06 RG19, RG25, RG70, L2BS-8)", () => {
  const plain = {
    brandName: "Maison Aube",
    presentation: "Du matériel durable pour les sorties en montagne.",
    websiteDomain: "maison-aube.fr",
  };

  it("raises none for an ordinary brand", () => {
    expect(contactAlerts(plain)).toEqual([]);
    expect(domainAlerts(plain)).toEqual([]);
    expect(alertCodesOf(plain, { brandName: false, domain: false })).toEqual(
      [],
    );
  });

  it("names the field and the kind of signal for a contact in the name or the presentation, never the text", () => {
    const alerts = contactAlerts({
      ...plain,
      brandName: "Maison Aube contact@maison-aube.fr",
      presentation: "Appelez le 06 12 34 56 78",
    });
    expect(alerts).toEqual([
      {
        code: "direct_contact",
        field: "advertiser.brand_name",
        signals: ["email"],
      },
      {
        code: "direct_contact",
        field: "advertiser.presentation",
        signals: ["phone"],
      },
    ]);
    expect(JSON.stringify(alerts)).not.toContain("maison-aube.fr");
  });

  it("gives the codes of a line in the closed order of the contract", () => {
    const codes = alertCodesOf(
      { ...plain, presentation: "@maison_aube", websiteDomain: "maisôn.fr" },
      { brandName: true, domain: true },
    );
    expect(codes).toEqual([...REVIEW_ALERT_CODES]);
  });
});

describe("the cursor of the list (15 RG34)", () => {
  const cursor = {
    dueAt: "2026-11-02T09:00:00.123456Z",
    createdAt: "2026-11-01T09:00:00.654321Z",
    id: "5b1d6f3e-0a52-4c8e-9f0e-2f6a1c7d9b10",
  };

  it("keeps the microseconds of both instants and the identifier, and carries nothing else", () => {
    const encoded = encodeEntryCursor(cursor);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeEntryCursor(encoded)).toEqual(cursor);
  });

  it("refuses what the server did not issue", () => {
    for (const forged of [
      "",
      "bm90IGEgY3Vyc29y",
      Buffer.from("2026-11-02T09:00:00Z|2026-11-01T09:00:00Z|x").toString(
        "base64url",
      ),
      Buffer.from(
        `${cursor.dueAt}|${cursor.createdAt}|${cursor.id}; drop`,
      ).toString("base64url"),
    ]) {
      expect(decodeEntryCursor(forged), forged).toBeNull();
    }
  });
});

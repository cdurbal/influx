// L2C commit 09 (06 RG66, RG69; jalons/l2c-fiche invariant 10): the e-mail profile.decision, one text
// per decision and per reason in each language, from the translation files, without any link
// (RG158), amount nor template. The connector is in brevo-connector.test.ts, the real queue in
// db-tests/tm1-brevo-connector.test.ts.
import { describe, expect, it } from "vitest";
import { checkRenderedTransactionalOutput } from "../src/domains/leads/connectors/brevo/mapping.ts";
import {
  rejectionReasonOf,
  renderBrandDecisionEmail,
  type RejectionReasonCode,
} from "../src/domains/profiles/brand-decision-email.ts";
import english from "../src/locales/en/email.json" with { type: "json" };
import french from "../src/locales/fr/email.json" with { type: "json" };

const REASONS = [
  "contact_in_public_field",
  "presentation_insufficient",
  "logo_non_compliant",
  "misleading_brand_name",
  "sector_inconsistent",
  "illicit_content",
  "duplicate_brand",
  "other",
] as const satisfies readonly RejectionReasonCode[];

const CONTACT_REASONS: readonly string[] = [
  "misleading_brand_name",
  "illicit_content",
  "duplicate_brand",
  "other",
];

const MESSAGE = "Votre numéro de TVA ne correspond à aucune entreprise connue.";

function bodyOf(email: ReturnType<typeof renderBrandDecisionEmail>) {
  return {
    sender: { name: "INFLUX", email: "no-reply@tx.influx.example" },
    to: [{ email: "lena@example.test" }],
    subject: email.subject,
    htmlContent: email.html,
    textContent: email.text,
    tags: ["profile.decision"],
  };
}

describe("06 RG66: the closed list of reasons, in both languages", () => {
  it("the translation files hold exactly the eight reasons of the table, in the same keys", () => {
    for (const messages of [french, english]) {
      expect(Object.keys(messages.email.profileDecision.reason).sort()).toEqual(
        [...REASONS].sort(),
      );
    }
    expect(Object.keys(french.email.profileDecision)).toEqual(
      Object.keys(english.email.profileDecision),
    );
  });

  it("rejectionReasonOf accepts the list and nothing else", () => {
    for (const reason of REASONS) {
      expect(rejectionReasonOf(reason)).toBe(reason);
    }
    for (const outside of ["", "made_up", "constructor", "toString"]) {
      expect(rejectionReasonOf(outside)).toBeNull();
    }
  });

  it("gives the messages of RG66 word for word in French", () => {
    const reason = french.email.profileDecision.reason;
    expect(reason.contact_in_public_field).toBe(
      "Votre présentation contient une adresse, un numéro ou un lien de contact. Les coordonnées ne sont visibles qu'une fois la mise en relation ouverte.",
    );
    expect(reason.presentation_insufficient).toBe(
      "Votre présentation ne permet pas à un créateur de comprendre votre activité.",
    );
    expect(reason.logo_non_compliant).toBe(
      "Votre logo comporte des coordonnées ou n'est pas lisible.",
    );
    expect(reason.misleading_brand_name).toBe(
      "Le nom déclaré correspond à une marque que vous ne semblez pas représenter.",
    );
    expect(reason.sector_inconsistent).toBe(
      "Le secteur déclaré ne correspond pas à votre activité.",
    );
    expect(reason.duplicate_brand).toBe(
      "Cette marque dispose déjà d'un compte INFLUX.",
    );
  });
});

describe("profile.decision: what is written", () => {
  for (const locale of ["fr", "en"] as const) {
    const texts = (locale === "fr" ? french : english).email.profileDecision;

    it(`${locale}: a publication, passing the output check of the connector`, () => {
      const email = renderBrandDecisionEmail({ locale, decision: "published" });
      expect(email.subject).toBe(texts.published.subject);
      expect(email.html).toContain(`<html lang="${locale}">`);
      expect(email.html).not.toMatch(/href|https?:|www\.|@/i);
      expect(checkRenderedTransactionalOutput(bodyOf(email))).toEqual([]);
    });

    for (const reason of REASONS) {
      it(`${locale}: a refusal for ${reason}, its message and a next step, no link`, () => {
        const email = renderBrandDecisionEmail({
          locale,
          decision: "rejected",
          reason,
          memberMessage: reason === "other" ? MESSAGE : null,
        });
        expect(email.subject).toBe(texts.rejected.subject);
        expect(email.text).toContain(texts.reason[reason]);
        expect(email.text).toContain(
          CONTACT_REASONS.includes(reason)
            ? texts.nextStep.contact
            : texts.nextStep.fix,
        );
        expect(email.text.includes(MESSAGE)).toBe(reason === "other");
        expect(email.html).not.toMatch(/href|https?:|www\.|@/i);
        expect(checkRenderedTransactionalOutput(bodyOf(email))).toEqual([]);
      });
    }
  }

  it("the message of a reason other than other is never added to the text", () => {
    const email = renderBrandDecisionEmail({
      locale: "fr",
      decision: "rejected",
      reason: "logo_non_compliant",
      memberMessage: MESSAGE,
    });
    expect(email.text).not.toContain(MESSAGE);
    expect(email.html).not.toContain(MESSAGE);
  });

  it("the message of the agent is plain text: escaped, one paragraph per line, never a template", () => {
    const email = renderBrandDecisionEmail({
      locale: "fr",
      decision: "rejected",
      reason: "other",
      memberMessage:
        "Première ligne {reason} <i>a</i>.\r\n\r\nSeconde & dernière ligne.",
    });
    expect(email.html).toContain(
      "<p>Première ligne {reason} &lt;i&gt;a&lt;/i&gt;.</p>",
    );
    expect(email.html).toContain("<p>Seconde &amp; dernière ligne.</p>");
    expect(email.text).toContain("Première ligne {reason} <i>a</i>.");
  });
});

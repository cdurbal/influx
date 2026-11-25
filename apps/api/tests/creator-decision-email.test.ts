// L2G commit 10 (07 RG96, RG79, RG99; jalons/l2g/modele.md EC-L2G-8, textes.md): the e-mails
// creator_profile.decision and portfolio.decision, one text per decision and per reason in each
// language, from the translation files, without any link (RG158), amount nor template. The
// connector is in brevo-connector.test.ts, the real queue in db-tests/tm1-brevo-connector.test.ts.
import { PORTFOLIO_REJECTION_REASON_CODES } from "@influx/contracts/creator-portfolio";
import {
  CREATOR_REJECTION_NEXT_STEP_OF,
  CREATOR_REJECTION_REASON_CODES,
} from "@influx/contracts/creator-profile";
import { describe, expect, it } from "vitest";
import { checkRenderedTransactionalOutput } from "../src/domains/leads/connectors/brevo/mapping.ts";
import {
  creatorRejectionReasonOf,
  PORTFOLIO_REFUSED_RETENTION_DAYS,
  portfolioRejectionReasonOf,
  renderCreatorProfileDecisionEmail,
  renderPortfolioDecisionEmail,
} from "../src/domains/profiles/creator/decision-email.ts";
import english from "../src/locales/en/email.json" with { type: "json" };
import french from "../src/locales/fr/email.json" with { type: "json" };

const LOCALES = ["fr", "en"] as const;
const MESSAGE = "Merci de nous écrire pour préciser la nature de vos contenus.";

function bodyOf(
  email: { subject: string; html: string; text: string },
  code: string,
) {
  return {
    sender: { name: "INFLUX", email: "no-reply@tx.influx.example" },
    to: [{ email: "lena@example.test" }],
    subject: email.subject,
    htmlContent: email.html,
    textContent: email.text,
    tags: [code],
  };
}

/** Every string leaf of a translation block, with its path. */
function leaves(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") {
    return [[path, value]];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => leaves(child, path === "" ? key : `${path}.${key}`),
  );
}

describe("the translation files: the closed lists of RG96 and RG79, in both languages", () => {
  it("hold exactly the reasons of the contracts and the same keys in French and English", () => {
    for (const messages of [french, english]) {
      expect(
        Object.keys(messages.email.creatorProfileDecision.reason).sort(),
      ).toEqual([...CREATOR_REJECTION_REASON_CODES].sort());
      expect(
        Object.keys(messages.email.portfolioDecision.reason).sort(),
      ).toEqual([...PORTFOLIO_REJECTION_REASON_CODES].sort());
    }
    for (const block of [
      "creatorProfileDecision",
      "portfolioDecision",
    ] as const) {
      expect(leaves(french.email[block]).map(([path]) => path)).toEqual(
        leaves(english.email[block]).map(([path]) => path),
      );
    }
  });

  it("no text, in any language, can be taken for a link, an address or a handle by the output check (RG158)", () => {
    for (const messages of [french, english]) {
      for (const block of [
        messages.email.creatorProfileDecision,
        messages.email.portfolioDecision,
      ]) {
        for (const [path, text] of leaves(block)) {
          expect(
            checkRenderedTransactionalOutput({ subject: text }),
            path,
          ).toEqual([]);
          expect(text, path).not.toContain("@");
        }
      }
    }
  });

  it("the closed lists are read exactly: nothing outside them is a reason", () => {
    for (const reason of CREATOR_REJECTION_REASON_CODES) {
      expect(creatorRejectionReasonOf(reason)).toBe(reason);
    }
    for (const reason of PORTFOLIO_REJECTION_REASON_CODES) {
      expect(portfolioRejectionReasonOf(reason)).toBe(reason);
    }
    for (const outside of ["", "made_up", "constructor", "toString", "other"]) {
      expect(portfolioRejectionReasonOf(outside)).toBeNull();
    }
    for (const outside of [
      "",
      "made_up",
      "constructor",
      "toString",
      "watermark",
    ]) {
      expect(creatorRejectionReasonOf(outside)).toBeNull();
    }
  });

  it("gives the messages of 07 RG96 word for word in French", () => {
    const reason = french.email.creatorProfileDecision.reason;
    expect(reason.bio_insufficient).toBe(
      "Votre bio ne permet pas à une marque de comprendre ce que vous faites.",
    );
    expect(reason.portfolio_insufficient).toBe(
      "Il faut au moins 3 éléments déposés pour publier votre profil.",
    );
    expect(reason.age_doubt).toBe(
      "INFLUX est réservé aux personnes majeures : nous ne pouvons pas publier votre profil en l'état.",
    );
  });
});

describe("creator_profile.decision: what is written", () => {
  for (const locale of LOCALES) {
    const texts = (locale === "fr" ? french : english).email
      .creatorProfileDecision;

    it(`${locale}: a first publication says the anonymous version is shown, and what is reviewed afterwards`, () => {
      const email = renderCreatorProfileDecisionEmail({
        locale,
        kind: "submission",
        decision: "published",
      });
      expect(email.subject).toBe(texts.published.subject);
      expect(email.html).toContain(`<html lang="${locale}">`);
      expect(email.text).toContain(texts.published.body);
      expect(email.text).toContain(texts.published.edit);
      expect(email.html).not.toMatch(/href|https?:|www\.|@/i);
      expect(
        checkRenderedTransactionalOutput(
          bodyOf(email, "creator_profile.decision"),
        ),
      ).toEqual([]);
    });

    it(`${locale}: a published revision and a refused revision speak of the change`, () => {
      const approved = renderCreatorProfileDecisionEmail({
        locale,
        kind: "revision",
        decision: "published",
      });
      expect(approved.subject).toBe(texts.revisionApproved.subject);
      expect(approved.text).not.toContain(texts.published.edit);
      const refused = renderCreatorProfileDecisionEmail({
        locale,
        kind: "revision",
        decision: "rejected",
        reason: "figures_inconsistent",
        memberMessage: null,
      });
      expect(refused.subject).toBe(texts.revisionRejected.subject);
      expect(refused.text).toContain(texts.revisionRejected.body);
      expect(refused.text).toContain(texts.reason.figures_inconsistent);
    });

    for (const reason of CREATOR_REJECTION_REASON_CODES) {
      for (const kind of ["submission", "revision"] as const) {
        it(`${locale}: a refusal of a ${kind} for ${reason}, its message and a next step, no link`, () => {
          const email = renderCreatorProfileDecisionEmail({
            locale,
            kind,
            decision: "rejected",
            reason,
            memberMessage: reason === "other" ? MESSAGE : null,
          });
          expect(email.subject).toBe(
            kind === "submission"
              ? texts.rejected.subject
              : texts.revisionRejected.subject,
          );
          expect(email.text).toContain(texts.reason[reason]);
          expect(email.text).toContain(
            texts.nextStep[CREATOR_REJECTION_NEXT_STEP_OF[reason]],
          );
          expect(email.text.includes(MESSAGE)).toBe(reason === "other");
          expect(email.html).not.toMatch(/href|https?:|www\.|@/i);
          expect(
            checkRenderedTransactionalOutput(
              bodyOf(email, "creator_profile.decision"),
            ),
          ).toEqual([]);
        });
      }
    }
  }

  it("the message of a reason other than other is never added to the text", () => {
    const email = renderCreatorProfileDecisionEmail({
      locale: "fr",
      kind: "submission",
      decision: "rejected",
      reason: "bio_insufficient",
      memberMessage: MESSAGE,
    });
    expect(email.text).not.toContain(MESSAGE);
    expect(email.html).not.toContain(MESSAGE);
  });

  it("the message of the agent is plain text: escaped, one paragraph per line, never a template", () => {
    const email = renderCreatorProfileDecisionEmail({
      locale: "fr",
      kind: "submission",
      decision: "rejected",
      reason: "other",
      memberMessage:
        "Première ligne <b>{date}</b> & suite.\n\n  Seconde ligne.  ",
    });
    expect(email.html).toContain(
      "<p>Première ligne &lt;b&gt;{date}&lt;/b&gt; &amp; suite.</p><p>Seconde ligne.</p>",
    );
    expect(email.text).toContain("Première ligne <b>{date}</b> & suite.");
  });
});

describe("portfolio.decision: what is written", () => {
  for (const locale of LOCALES) {
    const texts = (locale === "fr" ? french : english).email.portfolioDecision;

    it(`${locale}: an approval names the day of the deposit, a replacement says what it replaces`, () => {
      const plain = renderPortfolioDecisionEmail({
        locale,
        decision: "approved",
        replacement: false,
        depositedOn: "2026-11-09",
      });
      expect(plain.subject).toBe(texts.approved.subject);
      expect(plain.text).toContain(
        locale === "fr"
          ? "déposé le 9 novembre 2026"
          : "uploaded on November 9, 2026",
      );
      expect(plain.text).not.toContain(texts.approved.replacement);
      const replacing = renderPortfolioDecisionEmail({
        locale,
        decision: "approved",
        replacement: true,
        depositedOn: "2026-11-09",
      });
      expect(replacing.text).toContain(texts.approved.replacement);
      for (const email of [plain, replacing]) {
        expect(
          checkRenderedTransactionalOutput(bodyOf(email, "portfolio.decision")),
        ).toEqual([]);
      }
    });

    for (const reason of PORTFOLIO_REJECTION_REASON_CODES) {
      it(`${locale}: a refusal for ${reason}, its message, the retention of the file, no link`, () => {
        const email = renderPortfolioDecisionEmail({
          locale,
          decision: "rejected",
          reason,
          replacement: false,
          depositedOn: "2026-01-05",
        });
        expect(email.subject).toBe(texts.rejected.subject);
        expect(email.text).toContain(texts.reason[reason]);
        expect(email.text).toContain(
          `${PORTFOLIO_REFUSED_RETENTION_DAYS} ${locale === "fr" ? "jours" : "days"}`,
        );
        expect(email.text).not.toContain(texts.rejected.replacement);
        expect(email.html).not.toMatch(/href|https?:|www\.|@/i);
        expect(
          checkRenderedTransactionalOutput(bodyOf(email, "portfolio.decision")),
        ).toEqual([]);
      });
    }

    it(`${locale}: a refused replacement says the previous visual stays in place`, () => {
      const email = renderPortfolioDecisionEmail({
        locale,
        decision: "rejected",
        reason: "watermark",
        replacement: true,
        depositedOn: "2026-11-09",
      });
      expect(email.text).toContain(texts.rejected.replacement);
    });
  }

  it("the retention of a refused file is the one the base keeps (30 days, 07 Q9, D79 (8))", () => {
    expect(PORTFOLIO_REFUSED_RETENTION_DAYS).toBe(30);
  });

  it("a day that is not YYYY-MM-DD is a programming error, never a guessed date", () => {
    for (const depositedOn of [
      "",
      "09/11/2026",
      "2026-11-9",
      "Mon Nov 09 2026",
    ]) {
      expect(() =>
        renderPortfolioDecisionEmail({
          locale: "fr",
          decision: "approved",
          replacement: false,
          depositedOn,
        }),
      ).toThrow("depositedOn is not a day");
    }
  });
});

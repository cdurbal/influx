// L2F commit 12 (08 RG93, RG94; jalons/l2f/modele.md §4 "Outbox" and annex textes.md; EC-L2F-16): the
// eight e-mails of the life of the badge, one text per kind, per population and per reason in each
// language, from the translation files, without any link (RG158), figure, handle nor template. The
// connector is in brevo-connector.test.ts, the real queue and the parity with the database in
// db-tests/verification-badge-emails.test.ts. Raw bodies, as the connector sends them (L2CT-8).
import { REVOCATION_REASONS } from "@influx/domain/verification";
import { describe, expect, it } from "vitest";
import { checkRenderedTransactionalOutput } from "../src/domains/leads/connectors/brevo/mapping.ts";
import type { VerificationEmailLevel } from "../src/domains/verification/verification-email.ts";
import {
  disputeOutcomeOf,
  renderBadgeNoticeEmail,
  revocationReasonOf,
  type BadgeNoticeInput,
  type RevocationReasonCode,
} from "../src/domains/verification/badge-notice-email.ts";
import english from "../src/locales/en/email.json" with { type: "json" };
import french from "../src/locales/fr/email.json" with { type: "json" };

const LOCALES = ["fr", "en"] as const;
const EXPIRES_AT = new Date("2027-02-01T10:00:00.000Z");
const GRACE_ENDS_AT = new Date("2027-03-03T10:00:00.000Z");
const RESTORED_AT = new Date("2026-11-09T09:00:00.000Z");

const OUTCOMES = [
  "decision_confirmed",
  "new_request_needed",
  "other",
  "decision_overturned",
] as const;

const AUDIENCE = {
  level: "audience_verified",
  networkName: "Instagram",
} as const;
const BRAND = { level: "brand_verified", networkName: null } as const;

function bodyOf(email: ReturnType<typeof renderBadgeNoticeEmail>) {
  return {
    sender: { name: "INFLUX", email: "no-reply@tx.influx.example" },
    to: [{ email: "lena@example.test" }],
    subject: email.subject,
    htmlContent: email.html,
    textContent: email.text,
    tags: ["verification.badge"],
  };
}

function keysOf(value: object): string[] {
  return Object.keys(value).sort();
}

type Distribute<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;
function render(
  locale: (typeof LOCALES)[number],
  population: {
    readonly level: VerificationEmailLevel;
    readonly networkName: string | null;
  },
  input: Distribute<BadgeNoticeInput, "locale" | "level" | "networkName">,
) {
  return renderBadgeNoticeEmail({
    locale,
    ...population,
    ...input,
  } as BadgeNoticeInput);
}

describe("the closed lists, in both languages (modele §2, annex textes.md)", () => {
  it("the translation files hold the seven reasons of a withdrawal of the domain, the four outcomes of an appeal, and the same keys in both languages", () => {
    const codes = REVOCATION_REASONS.map((reason) => reason.code).sort();
    for (const messages of [french, english]) {
      expect(keysOf(messages.email.badgeNotice.revoked.reason)).toEqual(codes);
      expect(keysOf(messages.email.badgeNotice.disputeOutcome.outcome)).toEqual(
        [...OUTCOMES].sort(),
      );
    }
    for (const [name, value] of Object.entries(french.email.badgeNotice)) {
      expect(keysOf(value as object), name).toEqual(
        keysOf(
          (english.email.badgeNotice as Record<string, object>)[name] ?? {},
        ),
      );
    }
    expect(keysOf(french.email.badgeNotice)).toEqual(
      keysOf(english.email.badgeNotice),
    );
  });

  it("reads a reason or an outcome from the lists only", () => {
    for (const reason of REVOCATION_REASONS) {
      expect(revocationReasonOf(reason.code)).toBe(reason.code);
    }
    expect(revocationReasonOf("pirate")).toBeNull();
    expect(revocationReasonOf("toString")).toBeNull();
    for (const outcome of OUTCOMES) {
      expect(disputeOutcomeOf(outcome)).toBe(outcome);
    }
    expect(disputeOutcomeOf("pirate")).toBeNull();
  });

  it("gives the reasons of a withdrawal word for word (annex textes.md)", () => {
    const fr = french.email.badgeNotice.revoked.reason;
    const en = english.email.badgeNotice.revoked.reason;
    expect(fr.influx_error).toBe(
      "INFLUX a accordé ce badge par erreur. Vous n'y êtes pour rien et nous vous présentons nos excuses.",
    );
    expect(en.influx_error).toBe(
      "INFLUX granted this badge by mistake. You are not at fault, and we apologise.",
    );
    expect(fr.forged_evidence).toBe(
      "Une pièce ou une information fournie pour cette vérification s'est révélée inexacte.",
    );
    expect(en.company_dissolved).toBe(
      "The company has been struck off the public register.",
    );
    expect(fr.domain_transferred).toBe(
      "Le domaine de votre site a changé de titulaire.",
    );
  });
});

describe("what is written", () => {
  it("the reminder, « à rafraîchir » and expiry of an audience: the sentences of 08 RG93, with the dates", () => {
    const expected = {
      fr: [
        "Votre audience vérifiée arrive à échéance le 1 février 2027. Déposez une capture récente pour la conserver.",
        "Votre audience vérifiée est à rafraîchir. Elle reste affichée avec sa date jusqu'au 3 mars 2027.",
        "Votre audience vérifiée a expiré. Vos chiffres sont de nouveau affichés comme déclarés.",
      ],
      en: [
        "Your verified audience expires on February 1, 2027. Upload a recent screenshot to keep it.",
        "Your verified audience needs refreshing. It stays visible with its date until March 3, 2027.",
        "Your verified audience has expired. Your figures are shown as declared again.",
      ],
    } as const;
    for (const locale of LOCALES) {
      const emails = [
        render(locale, AUDIENCE, {
          kind: "expiry_reminder",
          expiresAt: EXPIRES_AT,
        }),
        render(locale, AUDIENCE, {
          kind: "expiry_to_refresh",
          graceEndsAt: GRACE_ENDS_AT,
        }),
        render(locale, AUDIENCE, { kind: "expiry_removed" }),
      ];
      emails.forEach((email, index) => {
        expect(email.text).toContain(expected[locale][index]);
        expect(email.html).toContain("<p>");
        expect(checkRenderedTransactionalOutput(bodyOf(email))).toEqual([]);
      });
    }
  });

  it("the same three for a brand: the subjects and sentences of annex textes.md", () => {
    const fr = [
      render("fr", BRAND, { kind: "expiry_reminder", expiresAt: EXPIRES_AT }),
      render("fr", BRAND, {
        kind: "expiry_to_refresh",
        graceEndsAt: GRACE_ENDS_AT,
      }),
      render("fr", BRAND, { kind: "expiry_removed" }),
    ];
    expect(fr.map((email) => email.subject)).toEqual([
      "Votre badge Marque vérifiée arrive à échéance",
      "Votre badge Marque vérifiée est à rafraîchir",
      "Votre badge Marque vérifiée a expiré",
    ]);
    expect(fr[0]?.text).toContain(
      "Votre badge « Marque vérifiée » arrive à échéance le 1 février 2027. Redemandez la vérification depuis votre espace INFLUX pour le conserver.",
    );
    expect(fr[1]?.text).toContain(
      "Il reste affiché avec sa date jusqu'au 3 mars 2027.",
    );
    expect(fr[2]?.text).toContain(
      "Vous pouvez redemander la vérification depuis votre espace INFLUX.",
    );
    const en = [
      render("en", BRAND, { kind: "expiry_reminder", expiresAt: EXPIRES_AT }),
      render("en", BRAND, {
        kind: "expiry_to_refresh",
        graceEndsAt: GRACE_ENDS_AT,
      }),
      render("en", BRAND, { kind: "expiry_removed" }),
    ];
    expect(en.map((email) => email.subject)).toEqual([
      "Your Brand verified badge is about to expire",
      "Your Brand verified badge needs refreshing",
      "Your Brand verified badge has expired",
    ]);
    expect(en[0]?.text).toContain(
      'Your "Brand verified" badge expires on February 1, 2027. Request verification again from your INFLUX space to keep it.',
    );
  });

  it("a withdrawal says its reason in each language, for the seven reasons, and apologises for influx_error", () => {
    for (const locale of LOCALES) {
      const messages = locale === "fr" ? french : english;
      for (const reason of REVOCATION_REASONS) {
        const email = render(
          locale,
          reason.levels.includes("brand_verified") &&
            !reason.levels.includes("account_verified")
            ? BRAND
            : AUDIENCE,
          {
            kind: "revoked",
            reason: reason.code as RevocationReasonCode,
            memberMessage: reason.requiresMemberMessage
              ? "Un message de l'équipe."
              : null,
            disputeWindowDays: null,
          },
        );
        expect(email.subject).toBe(messages.email.badgeNotice.revoked.subject);
        expect(email.text).toContain(
          messages.email.badgeNotice.revoked.reason[
            reason.code as RevocationReasonCode
          ],
        );
      }
    }
  });

  it("the appeal window is said to a creator only, in the singular for one day", () => {
    const creator = render("fr", AUDIENCE, {
      kind: "revoked",
      reason: "owner_changed",
      memberMessage: null,
      disputeWindowDays: 30,
    });
    expect(creator.text).toContain(
      "Vous pouvez contester cette décision pendant 30 jours.",
    );
    expect(
      render("en", AUDIENCE, {
        kind: "revoked",
        reason: "owner_changed",
        memberMessage: null,
        disputeWindowDays: 1,
      }).text,
    ).toContain("You can appeal this decision for 1 day.");
    for (const days of [null, 30]) {
      expect(
        render("fr", BRAND, {
          kind: "revoked",
          reason: "company_dissolved",
          memberMessage: null,
          disputeWindowDays: days,
        }).text.includes("contester"),
      ).toBe(false);
    }
  });

  it("the agent's message is added one paragraph per line, escaped, never a template", () => {
    const email = render("fr", AUDIENCE, {
      kind: "revoked",
      reason: "terms_breach",
      memberMessage: "Ligne <b>un</b> {badge}\n\nLigne deux & fin",
      disputeWindowDays: null,
    });
    expect(email.html).toContain("<p>Ligne &lt;b&gt;un&lt;/b&gt; {badge}</p>");
    expect(email.html).toContain("<p>Ligne deux &amp; fin</p>");
    expect(email.html).not.toContain("<b>");
    expect(email.text).toContain("Ligne deux & fin");
  });

  it("an appeal received names the badge; the outcomes say the original reason, the date handed back or the team's message", () => {
    expect(render("fr", AUDIENCE, { kind: "dispute_received" }).text).toContain(
      "Nous avons bien reçu votre contestation concernant le badge « Audience vérifiée — Instagram ». Nous la réexaminons et vous écrivons dès qu'elle est tranchée.",
    );
    expect(render("en", AUDIENCE, { kind: "dispute_received" }).text).toContain(
      'We have received your appeal about the "Audience verified — Instagram" badge. We are reviewing it and will write to you once it is decided.',
    );

    const confirmed = render("fr", AUDIENCE, {
      kind: "dispute_outcome",
      outcome: {
        code: "decision_confirmed",
        contested: { decision: "refusal", code: "evidence_too_old" },
      },
    });
    expect(confirmed.text).toContain(
      "Après réexamen, la décision est maintenue pour son motif initial : La période affichée sur votre capture se termine il y a plus de 30 jours.",
    );
    expect(
      render("en", AUDIENCE, {
        kind: "dispute_outcome",
        outcome: {
          code: "decision_confirmed",
          contested: { decision: "revocation", code: "influx_error" },
        },
      }).text,
    ).toContain(
      "After review, the decision stands for its original reason: INFLUX granted this badge by mistake.",
    );
    expect(
      render("fr", AUDIENCE, {
        kind: "dispute_outcome",
        outcome: { code: "new_request_needed" },
      }).text,
    ).toContain(
      "vous pouvez déposer une nouvelle demande depuis votre espace INFLUX.",
    );
    const other = render("en", AUDIENCE, {
      kind: "dispute_outcome",
      outcome: {
        code: "other",
        memberMessage: "Please send a fresh screenshot.",
      },
    });
    expect(other.text).toContain(
      "After review, the decision stands. The message from the INFLUX team:",
    );
    expect(other.text).toContain("Please send a fresh screenshot.");
    expect(
      render("fr", AUDIENCE, {
        kind: "dispute_outcome",
        outcome: { code: "decision_overturned", restoredAt: RESTORED_AT },
      }).text,
    ).toContain(
      "INFLUX revient sur sa décision et vous présente ses excuses : votre badge « Audience vérifiée — Instagram » est accordé à la date du 9 novembre 2026.",
    );
  });

  it("the proof to reconfirm names the network; the opening by an agent speaks to a creator and to a brand, with no code", () => {
    const account = {
      level: "account_verified",
      networkName: "TikTok",
    } as const;
    expect(
      render("fr", account, { kind: "reconfirm_required" }).text,
    ).toContain(
      "Vous avez modifié l'identifiant de votre compte TikTok. Pour conserver votre badge, refaites la preuve de propriété depuis votre espace INFLUX.",
    );
    expect(
      render("en", account, { kind: "reconfirm_required" }).text,
    ).toContain(
      "You changed the handle of your TikTok account. To keep your badge, prove ownership again from your INFLUX space.",
    );
    const creator = render("fr", account, { kind: "agent_opened_notice" });
    expect(creator.subject).toBe(
      "Votre commercial INFLUX a lancé votre vérification",
    );
    expect(creator.text).toContain(
      "Votre commercial INFLUX a lancé la vérification de votre compte TikTok. Retrouvez dans votre espace INFLUX le code à publier.",
    );
    const brand = render("en", BRAND, { kind: "agent_opened_notice" });
    expect(brand.text).toContain(
      "Your INFLUX salesperson started the verification of your brand. If anything is needed from you, it is shown in your INFLUX space.",
    );
    expect(brand.text).not.toMatch(/code/i);
  });

  it("a creator badge e-mail without its network is refused, never written with a hole", () => {
    expect(() =>
      renderBadgeNoticeEmail({
        locale: "fr",
        level: "account_verified",
        networkName: null,
        kind: "reconfirm_required",
      }),
    ).toThrow("names its network");
  });

  it("every e-mail of every kind, in both languages, leaves without link, figure of an audience, handle or amount, with its subject as title and its reason of receipt", () => {
    const inputs: Distribute<
      BadgeNoticeInput,
      "locale" | "level" | "networkName"
    >[] = [
      { kind: "expiry_reminder", expiresAt: EXPIRES_AT },
      { kind: "expiry_to_refresh", graceEndsAt: GRACE_ENDS_AT },
      { kind: "expiry_removed" },
      {
        kind: "revoked",
        reason: "influx_error",
        memberMessage: null,
        disputeWindowDays: 30,
      },
      { kind: "dispute_received" },
      {
        kind: "dispute_outcome",
        outcome: { code: "decision_overturned", restoredAt: RESTORED_AT },
      },
      { kind: "reconfirm_required" },
      { kind: "agent_opened_notice" },
    ];
    for (const locale of LOCALES) {
      for (const input of inputs) {
        for (const population of [AUDIENCE, BRAND]) {
          const email = render(locale, population, input);
          const body = bodyOf(email);
          expect(
            checkRenderedTransactionalOutput(body),
            `${locale} ${input.kind}`,
          ).toEqual([]);
          expect(email.text.startsWith(email.subject)).toBe(true);
          expect(email.text).toContain(
            locale === "fr"
              ? "Vous recevez cet e-mail parce que"
              : "You are receiving this email because",
          );
          expect(email.text).not.toMatch(/https?:|www\.|@|€|\$/u);
          expect(email.text).not.toMatch(/\{|\}/u);
        }
      }
    }
  });
});

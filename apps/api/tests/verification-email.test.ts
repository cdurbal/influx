// L2E commit 16 (08 RG93, RG94, RG29; jalons/l2e/modele.md §5; EC-L2E-3): the five e-mails of the
// verification, one text per kind and per reason in each language, from the translation files,
// without any link (RG158), amount, figure nor template. The connector is in
// brevo-connector.test.ts, the real queue in db-tests/tm1-brevo-connector.test.ts, and the parity of
// the reasons with the database in the same file.
import { describe, expect, it } from "vitest";
import { checkRenderedTransactionalOutput } from "../src/domains/leads/connectors/brevo/mapping.ts";
import {
  renderVerificationEmail,
  verificationLevelOf,
  verificationNetworkOf,
  verificationReasonOf,
  type VerificationEmailInput,
  type VerificationReason,
} from "../src/domains/verification/verification-email.ts";
import english from "../src/locales/en/email.json" with { type: "json" };
import french from "../src/locales/fr/email.json" with { type: "json" };

const CREATOR_REASONS = [
  "missing_evidence",
  "evidence_too_old",
  "evidence_unreadable",
  "evidence_wrong_source",
  "evidence_too_wide",
  "ownership_not_proven",
  "account_not_public",
  "ownership_prerequisite",
  "evidence_inconsistent",
  "evidence_suspected_forgery",
  "shared_account",
  "agency_managed",
  "terms_breach",
  "minor",
  "account_unavailable",
  "other",
] as const;

const BRAND_REASONS = [
  "domain_code_not_found",
  "registration_not_found",
  "registration_unverifiable_country",
  "name_mismatch",
  "account_unavailable",
  "other",
] as const;

const NETWORKS = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "linkedin",
  "x",
  "snapchat",
  "twitch",
  "pinterest",
  "threads",
];

const LOCALES = ["fr", "en"] as const;
const MESSAGE = "Merci de préciser votre activité.";
const GRANTED_AT = new Date("2026-11-03T10:00:00.000Z");
const EXPIRES_AT = new Date("2027-02-01T10:00:00.000Z");

function bodyOf(email: ReturnType<typeof renderVerificationEmail>) {
  return {
    sender: { name: "INFLUX", email: "no-reply@tx.influx.example" },
    to: [{ email: "lena@example.test" }],
    subject: email.subject,
    htmlContent: email.html,
    textContent: email.text,
    tags: ["verification.decision"],
  };
}

function keysOf(value: object): string[] {
  return Object.keys(value).sort();
}

describe("the closed lists, in both languages (08 RG57; 06 RG51, RG52; modele §5)", () => {
  it("the translation files hold exactly the sixteen creator reasons and the six brand reasons, and the same keys in both languages", () => {
    for (const messages of [french, english]) {
      expect(
        keysOf(messages.email.verificationDecision.reason.creator),
      ).toEqual([...CREATOR_REASONS].sort());
      expect(keysOf(messages.email.verificationDecision.reason.brand)).toEqual(
        [...BRAND_REASONS].sort(),
      );
      expect(keysOf(messages.email.verificationNotice.network)).toEqual(
        [...NETWORKS].sort(),
      );
    }
    expect(keysOf(french.email.verificationNotice)).toEqual(
      keysOf(english.email.verificationNotice),
    );
    expect(keysOf(french.email.verificationDecision)).toEqual(
      keysOf(english.email.verificationDecision),
    );
    expect(keysOf(french.email.verificationDecision.nextStep)).toEqual(
      keysOf(english.email.verificationDecision.nextStep),
    );
  });

  it("gives the messages of 08 RG57 and modele §5 word for word in French", () => {
    const creator = french.email.verificationDecision.reason.creator;
    const brand = french.email.verificationDecision.reason.brand;
    expect(creator.missing_evidence).toBe(
      "Aucune pièce n'a été jointe à votre demande.",
    );
    expect(creator.evidence_too_old).toBe(
      "La période affichée sur votre capture se termine il y a plus de 30 jours.",
    );
    expect(creator.ownership_not_proven).toBe(
      "Le code de vérification n'a pas été trouvé sur votre profil.",
    );
    expect(creator.agency_managed).toBe(
      "Les comptes gérés par une agence ne sont pas pris en charge pour le moment.",
    );
    expect(creator.account_unavailable).toBe(
      "Votre demande ne peut pas être traitée tant que votre compte est suspendu.",
    );
    expect(creator.terms_breach).toBe(
      "Votre profil ne respecte pas les conditions d'utilisation d'INFLUX.",
    );
    expect(creator.minor).toBe(
      "INFLUX est réservé aux personnes majeures : nous ne pouvons pas traiter votre demande.",
    );
    expect(brand.domain_code_not_found).toBe(
      "Nous n'avons trouvé le code ni dans les enregistrements DNS de votre domaine, ni sur une page de votre site.",
    );
    expect(brand.registration_not_found).toBe(
      "Cette immatriculation est introuvable dans le registre public de votre pays.",
    );
    expect(brand.name_mismatch).toBe(
      "La raison sociale saisie ne correspond pas à celle du registre.",
    );
  });

  it("gives the messages of modele §5 word for word in English", () => {
    const brand = english.email.verificationDecision.reason.brand;
    expect(brand.registration_unverifiable_country).toBe(
      "Registration cannot be checked in this country: INFLUX does not yet consult a free public register there. You can request the badge again once a source is added.",
    );
    expect(english.email.verificationDecision.reason.creator.minor).toBe(
      "INFLUX is for adults only: we cannot process your request.",
    );
  });

  it("verificationReasonOf keeps the two populations apart and accepts nothing outside the lists", () => {
    for (const code of CREATOR_REASONS) {
      expect(verificationReasonOf("audience_verified", code)).toEqual({
        population: "creator",
        code,
      });
      expect(verificationReasonOf("account_verified", code)).toEqual({
        population: "creator",
        code,
      });
    }
    for (const code of BRAND_REASONS) {
      expect(verificationReasonOf("brand_verified", code)).toEqual({
        population: "brand",
        code,
      });
    }
    // a creator reason never explains a brand refusal, and conversely
    expect(verificationReasonOf("brand_verified", "minor")).toBeNull();
    expect(
      verificationReasonOf("brand_verified", "evidence_too_wide"),
    ).toBeNull();
    expect(
      verificationReasonOf("audience_verified", "name_mismatch"),
    ).toBeNull();
    for (const outside of [
      "",
      "made_up",
      "constructor",
      "toString",
      "__proto__",
    ]) {
      expect(verificationReasonOf("audience_verified", outside)).toBeNull();
      expect(verificationReasonOf("brand_verified", outside)).toBeNull();
    }
  });

  it("the level and the network are read from the closed lists only", () => {
    expect(verificationLevelOf("audience_verified")).toBe("audience_verified");
    expect(verificationLevelOf("gold")).toBeNull();
    expect(verificationLevelOf("constructor")).toBeNull();
    for (const code of NETWORKS) {
      expect(verificationNetworkOf("fr", code)).not.toBeNull();
      expect(verificationNetworkOf("en", code)).not.toBeNull();
    }
    expect(verificationNetworkOf("fr", "myspace")).toBeNull();
    expect(verificationNetworkOf("fr", "constructor")).toBeNull();
    expect(verificationNetworkOf("fr", null)).toBeNull();
  });
});

describe("what is written", () => {
  for (const locale of LOCALES) {
    const notice = (locale === "fr" ? french : english).email
      .verificationNotice;
    const decision = (locale === "fr" ? french : english).email
      .verificationDecision;
    const common = {
      locale,
      level: "audience_verified",
      networkName: "Instagram",
    } as const;

    const inputs: readonly (readonly [string, VerificationEmailInput])[] = [
      ["received", { ...common, kind: "received" }],
      [
        "code generated (network)",
        {
          ...common,
          kind: "code_issued",
          codeKind: "network",
          expiresAt: EXPIRES_AT,
        },
      ],
      [
        "code generated (domain)",
        {
          locale,
          level: "brand_verified",
          networkName: null,
          kind: "code_issued",
          codeKind: "domain",
          expiresAt: EXPIRES_AT,
        },
      ],
      [
        "granted, account",
        {
          ...common,
          level: "account_verified",
          kind: "granted",
          grantedAt: GRANTED_AT,
          expiresAt: null,
        },
      ],
      [
        "granted, audience",
        {
          ...common,
          kind: "granted",
          grantedAt: GRANTED_AT,
          expiresAt: EXPIRES_AT,
        },
      ],
      [
        "granted, brand",
        {
          locale,
          level: "brand_verified",
          networkName: null,
          kind: "granted",
          grantedAt: GRANTED_AT,
          expiresAt: EXPIRES_AT,
        },
      ],
      ["expired", { ...common, kind: "expired" }],
    ];

    for (const [name, input] of inputs) {
      it(`${locale}: ${name}, accepted by the output check, in the language, closed by the transactional line, no link, no code, no amount`, () => {
        const email = renderVerificationEmail(input);
        expect(email.html).toContain(`<html lang="${locale}">`);
        expect(email.html).not.toMatch(/href|https?:|www\.|@/i);
        expect(checkRenderedTransactionalOutput(bodyOf(email))).toEqual([]);
        expect(email.text).not.toMatch(/INFLUX-[A-Z0-9]{8}/);
        expect(email.text).not.toMatch(/%|€|\$|\d+ ?(EUR|USD|GBP)/);
        expect(email.text.split("\n").at(-1)).toMatch(
          locale === "fr"
            ? /Il ne s'agit pas d'un e-mail commercial\.$/
            : /not a marketing email\.$/,
        );
      });
    }

    it(`${locale}: received and code generated tell RG29, in the words of the file`, () => {
      for (const [name, input] of inputs.filter(
        ([label]) =>
          label.startsWith("received") || label.startsWith("code generated"),
      )) {
        expect(renderVerificationEmail(input).text, name).toContain(
          notice.neverAsk,
        );
      }
    });

    it(`${locale}: a granted badge says what, where and when, never a figure, and an audience one says what INFLUX does not claim`, () => {
      const audience = renderVerificationEmail({
        ...common,
        kind: "granted",
        grantedAt: GRANTED_AT,
        expiresAt: EXPIRES_AT,
      });
      expect(audience.subject).toBe(decision.granted.subject);
      expect(audience.text).toContain(
        locale === "fr"
          ? "Audience vérifiée — Instagram"
          : "Audience verified — Instagram",
      );
      expect(audience.text).toContain(
        locale === "fr" ? "3 novembre 2026" : "November 3, 2026",
      );
      expect(audience.text).toContain(
        locale === "fr"
          ? "INFLUX ne se prononce pas sur l'authenticité des abonnés."
          : "INFLUX makes no claim about follower authenticity.",
      );
      expect(audience.text).toContain(
        locale === "fr" ? "1 février 2027" : "February 1, 2027",
      );
      const account = renderVerificationEmail({
        ...common,
        level: "account_verified",
        kind: "granted",
        grantedAt: GRANTED_AT,
        expiresAt: null,
      });
      // a badge of account has no expiry to announce, and no word on followers
      expect(account.text).not.toContain(
        locale === "fr" ? "valable jusqu'au" : "valid until",
      );
      expect(account.text).not.toMatch(/abonnés|followers/);
    });

    it(`${locale}: a creator e-mail without its network is refused, a brand one needs none`, () => {
      expect(() =>
        renderVerificationEmail({
          ...common,
          networkName: null,
          kind: "received",
        }),
      ).toThrow(/names its network/);
      expect(() =>
        renderVerificationEmail({
          locale,
          level: "brand_verified",
          networkName: null,
          kind: "received",
        }),
      ).not.toThrow();
    });

    const reasons: readonly VerificationReason[] = [
      ...CREATOR_REASONS.map(
        (code) => ({ population: "creator", code }) as const,
      ),
      ...BRAND_REASONS.map((code) => ({ population: "brand", code }) as const),
    ];
    for (const reason of reasons) {
      it(`${locale}: a refusal for ${reason.population} ${reason.code}: its message, never an empty explanation, no link`, () => {
        const text =
          reason.population === "brand"
            ? decision.reason.brand[reason.code]
            : decision.reason.creator[reason.code];
        const email = renderVerificationEmail({
          locale,
          level:
            reason.population === "brand"
              ? "brand_verified"
              : "audience_verified",
          networkName: reason.population === "brand" ? null : "Instagram",
          kind: "rejected",
          reason,
          memberMessage:
            reason.code === "other" || reason.code === "terms_breach"
              ? MESSAGE
              : null,
        });
        expect(email.subject).toBe(decision.rejected.subject);
        expect(email.text).toContain(text);
        expect(email.html).not.toMatch(/href|https?:|www\.|@/i);
        expect(checkRenderedTransactionalOutput(bodyOf(email))).toEqual([]);
      });
    }
  }

  it("the agent's text is added for other and terms_breach only, escaped, one paragraph per line, never a template", () => {
    for (const code of ["other", "terms_breach"] as const) {
      const email = renderVerificationEmail({
        locale: "fr",
        level: "audience_verified",
        networkName: "Instagram",
        kind: "rejected",
        reason: { population: "creator", code },
        memberMessage:
          "Première ligne {reason} <i>a</i>.\r\n\r\nSeconde & dernière ligne.",
      });
      expect(email.html).toContain(
        "<p>Première ligne {reason} &lt;i&gt;a&lt;/i&gt;.</p>",
      );
      expect(email.html).toContain("<p>Seconde &amp; dernière ligne.</p>");
      expect(email.text).toContain("Première ligne {reason} <i>a</i>.");
    }
    for (const code of [
      "minor",
      "missing_evidence",
      "agency_managed",
    ] as const) {
      const email = renderVerificationEmail({
        locale: "fr",
        level: "audience_verified",
        networkName: "Instagram",
        kind: "rejected",
        reason: { population: "creator", code },
        memberMessage: MESSAGE,
      });
      expect(email.text).not.toContain(MESSAGE);
      expect(email.html).not.toContain(MESSAGE);
    }
  });

  it("what the member can do next follows RG57's last column: redeposit, restart, make public, ask for the account badge first, contact INFLUX, or nothing", () => {
    const fr = french.email.verificationDecision.nextStep;
    const next = (code: (typeof CREATOR_REASONS)[number]) =>
      renderVerificationEmail({
        locale: "fr",
        level: "audience_verified",
        networkName: "Instagram",
        kind: "rejected",
        reason: { population: "creator", code },
        memberMessage: MESSAGE,
      }).text;
    expect(next("evidence_too_wide")).toContain(fr.redeposit);
    expect(next("ownership_not_proven")).toContain(fr.restartOwnership);
    expect(next("account_not_public")).toContain(fr.makePublic);
    expect(next("ownership_prerequisite")).toContain(fr.askOwnershipFirst);
    expect(next("shared_account")).toContain(fr.contact);
    expect(next("agency_managed")).toContain(fr.none);
    expect(next("minor")).toContain(fr.none);
    const brand = (code: (typeof BRAND_REASONS)[number]) =>
      renderVerificationEmail({
        locale: "fr",
        level: "brand_verified",
        networkName: null,
        kind: "rejected",
        reason: { population: "brand", code },
        memberMessage: MESSAGE,
      }).text;
    expect(brand("name_mismatch")).toContain(fr.retryBrand);
    expect(brand("other")).toContain(fr.contact);
    // the message already says it can be asked again: no second sentence to contradict it
    const unverifiable = brand("registration_unverifiable_country");
    for (const sentence of Object.values(fr)) {
      expect(unverifiable).not.toContain(sentence);
    }
  });

  it("the date is the account's, in its time zone", () => {
    const at = new Date("2026-11-03T23:30:00.000Z");
    const input = {
      locale: "fr",
      level: "account_verified",
      networkName: "Instagram",
      kind: "granted",
      grantedAt: at,
      expiresAt: null,
    } as const;
    expect(
      renderVerificationEmail({ ...input, timeZone: "UTC" }).text,
    ).toContain("3 novembre 2026");
    expect(
      renderVerificationEmail({ ...input, timeZone: "Europe/Paris" }).text,
    ).toContain("4 novembre 2026");
  });
});

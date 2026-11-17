// L3C commit 06 (09 RG90, RG93, RG94; jalons/l3c/modele.md §8): the e-mail campaign.decision, one text
// per decision code and per reason in each language, from the translation files, without any link
// (RG158), amount (D48, D78) nor template; then the Brevo connector that writes it from the facts the
// base serves (leads.read_brevo_campaign_decision, 0310), against the Brevo double on the loopback.
// The real queue is in db-tests/tm1-brevo-connector.test.ts and leads-campaign-reads.test.ts.
import {
  startBrevoDouble,
  type BrevoDouble,
} from "@influx/test-kit/brevo-double";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  CAMPAIGN_DECISION_EMAIL_CODES,
  campaignDecisionEmailCodeOf,
  campaignFieldOf,
  campaignReasonNeedsMessage,
  campaignRejectionReasonOf,
  campaignRejectionReasonPreview,
  campaignTypeOf,
  interventionReasonOf,
  renderCampaignDecisionEmail,
  type CampaignDecisionEmailCode,
  type CampaignDecisionEmailInput,
  type CampaignFieldCode,
  type CampaignRejectionReasonCode,
  type CampaignTypeCode,
  type InterventionReasonCode,
} from "../src/domains/campaigns/campaign-decision-email.ts";
import type { Connector } from "../src/domains/leads/connector.ts";
import {
  checkRenderedTransactionalOutput,
  createBrevoConnectors,
} from "../src/domains/leads/connectors/brevo/index.ts";
import type {
  AttemptState,
  BrevoCampaignDecision,
  ClaimedLine,
  SubjectAccount,
} from "../src/domains/leads/repository.ts";
import english from "../src/locales/en/email.json" with { type: "json" };
import french from "../src/locales/fr/email.json" with { type: "json" };

const LOCALES = ["fr", "en"] as const;

/** The fourteen reasons of RG90 (campaigns.rejection_reasons, 0303). */
const REASONS = [
  "contact_in_text",
  "amount_in_text",
  "link_in_text",
  "brief_insufficient",
  "deliverables_inconsistent",
  "budget_inconsistent",
  "calendar_invalid",
  "creator_personal_criterion",
  "minor_audience",
  "concealed_advertising",
  "duplicate",
  "sensitive_authorizations_missing",
  "illicit_content",
  "other",
] as const satisfies readonly CampaignRejectionReasonCode[];

const CONTACT_REASONS: readonly string[] = [
  "sensitive_authorizations_missing",
  "illicit_content",
  "other",
];

/** The seven types of reference.campaign_types (0303). */
const TYPES = [
  "product_placement",
  "ugc_delivered",
  "product_review",
  "ambassador",
  "contest",
  "event_presence",
  "affiliate_program",
] as const satisfies readonly CampaignTypeCode[];

/** The fields a correction may name (campaigns.agent_interventions_field_code, 0309). */
const FIELDS = [
  "title",
  "campaign_type",
  "public_summary",
  "brief",
  "internal_reference",
  "product_description",
  "product_sector",
  "restrictions",
  "key_messages",
  "product_is_sent",
  "product_value_band",
  "creator_keeps_product",
  "shipping_costs_borne_by",
  "deliverables",
  "usage_rights",
  "usage_rights_duration",
  "usage_rights_territory",
  "exclusivity",
  "content_review_delay",
  "audience_countries",
  "audience_languages",
  "audience_bands",
  "audience_age_bands",
  "audience_gender",
  "audience_topics",
  "currency",
  "remuneration_kind",
  "budget_band",
  "creators_wanted",
  "total_budget",
  "applications_close_on",
  "content_due_on",
  "starts_on",
  "ends_on",
  "max_applications",
  "requested_items",
] as const satisfies readonly CampaignFieldCode[];

const INTERVENTION_REASONS = [
  "brand_request",
  "entry_error",
  "non_compliant_content",
  "other",
] as const satisfies readonly InterventionReasonCode[];

const MESSAGE =
  "Votre campagne présente un produit dont la vente est interdite dans les pays visés.";

function inputOf(
  code: CampaignDecisionEmailCode,
  locale: "fr" | "en",
): CampaignDecisionEmailInput {
  const common = {
    locale,
    type: "product_review" as const,
    occurredOn: "2026-11-14",
  };
  switch (code) {
    case "rejected":
      return {
        ...common,
        code,
        reason: "other",
        memberMessage: MESSAGE,
      };
    case "paused_by_influx":
    case "resumed_by_influx":
    case "closed_by_influx":
      return { ...common, code, reason: "brand_request" };
    case "corrected":
      return { ...common, code, reason: "entry_error", field: "brief" };
    default:
      return { ...common, code };
  }
}

function bodyOf(email: ReturnType<typeof renderCampaignDecisionEmail>) {
  return {
    sender: { name: "INFLUX", email: "no-reply@tx.influx.example" },
    to: [{ email: "lena@example.test" }],
    subject: email.subject,
    htmlContent: email.html,
    textContent: email.text,
    tags: ["campaign.decision"],
  };
}

/** The keys of an object, recursively, as paths. */
function pathsOf(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    pathsOf(child, prefix === "" ? key : `${prefix}.${key}`),
  );
}

describe("L3C-T6: 09 RG90, RG94: the closed lists, in both languages", () => {
  it("the translation files hold exactly the fourteen reasons, seven types, fields and four intervention reasons, under the same keys", () => {
    for (const messages of [french, english]) {
      const texts = messages.email.campaignDecision;
      expect(Object.keys(texts.reason).sort()).toEqual([...REASONS].sort());
      expect(Object.keys(texts.type).sort()).toEqual([...TYPES].sort());
      expect(Object.keys(texts.field).sort()).toEqual([...FIELDS].sort());
      expect(Object.keys(texts.interventionReason).sort()).toEqual(
        [...INTERVENTION_REASONS].sort(),
      );
    }
    expect(pathsOf(french.email.campaignDecision).sort()).toEqual(
      pathsOf(english.email.campaignDecision).sort(),
    );
  });

  it("the helpers accept the closed lists and nothing else, never guessing", () => {
    for (const reason of REASONS) {
      expect(campaignRejectionReasonOf(reason)).toBe(reason);
    }
    for (const code of CAMPAIGN_DECISION_EMAIL_CODES) {
      expect(campaignDecisionEmailCodeOf(code)).toBe(code);
    }
    expect(CAMPAIGN_DECISION_EMAIL_CODES).toEqual([
      "published",
      "rejected",
      "paused_by_influx",
      "resumed_by_influx",
      "closed_by_influx",
      "closed_automatically",
      "corrected",
      "created_for_brand",
    ]);
    for (const type of TYPES) expect(campaignTypeOf(type)).toBe(type);
    for (const field of FIELDS) expect(campaignFieldOf(field)).toBe(field);
    for (const reason of INTERVENTION_REASONS) {
      expect(interventionReasonOf(reason)).toBe(reason);
    }
    for (const unknown of ["made_up", "toString", "__proto__", "", "Other"]) {
      expect(campaignRejectionReasonOf(unknown)).toBeNull();
      expect(campaignDecisionEmailCodeOf(unknown)).toBeNull();
      expect(campaignTypeOf(unknown)).toBeNull();
      expect(campaignFieldOf(unknown)).toBeNull();
      expect(interventionReasonOf(unknown)).toBeNull();
    }
    // the message of the agent: illicit_content and other only (campaigns.rejection_reasons)
    expect(
      REASONS.filter((reason) => campaignReasonNeedsMessage(reason)),
    ).toEqual(["illicit_content", "other"]);
  });
});

describe("L3C-T6: one text per decision code and language, accepted by the output check", () => {
  it.each(
    CAMPAIGN_DECISION_EMAIL_CODES.flatMap((code) =>
      LOCALES.map((locale) => [code, locale] as const),
    ),
  )(
    "%s (%s): no link of any kind (RG158), no amount nor percentage (D48, D78), the language and the day",
    (code, locale) => {
      const email = renderCampaignDecisionEmail(inputOf(code, locale));
      expect(checkRenderedTransactionalOutput(bodyOf(email))).toEqual([]);
      expect(email.html).toContain(`<html lang="${locale}">`);
      expect(email.text).not.toMatch(/%|€|\$|\d+ ?(EUR|USD|GBP)/);
      expect(email.text).toContain(
        locale === "fr" ? "14 novembre 2026" : "November 14, 2026",
      );
      expect(email.text.split("\n").at(-1)).toMatch(
        locale === "fr"
          ? /Il ne s'agit pas d'un e-mail commercial\.$/
          : /not a marketing email\.$/,
      );
    },
  );

  it("each decision has a subject of its own, except the two closures that tell the same fact", () => {
    const subjects = CAMPAIGN_DECISION_EMAIL_CODES.map(
      (code) => renderCampaignDecisionEmail(inputOf(code, "fr")).subject,
    );
    expect(new Set(subjects).size).toBe(subjects.length - 1);
    expect(
      renderCampaignDecisionEmail(inputOf("closed_by_influx", "fr")).subject,
    ).toBe(
      renderCampaignDecisionEmail(inputOf("closed_automatically", "fr"))
        .subject,
    );
    // …but the body of the automatic one names no agent and no reason
    const automatic = renderCampaignDecisionEmail(
      inputOf("closed_automatically", "fr"),
    ).text;
    expect(automatic).toContain("clôturée automatiquement");
    expect(automatic).not.toContain("Un commercial INFLUX");
  });

  it("names the type of the campaign in its language, never a title", () => {
    for (const type of TYPES) {
      for (const locale of LOCALES) {
        const email = renderCampaignDecisionEmail({
          locale,
          code: "published",
          type,
          occurredOn: "2026-11-14",
        });
        const label = (locale === "fr" ? french : english).email
          .campaignDecision.type[type];
        expect(email.text).toContain(label);
      }
    }
  });
});

describe("L3C-T6: 09 RG90: a refusal speaks with the message of its reason, word for word", () => {
  it("the table of RG90, in French, under D78 for the amount and the budget band", () => {
    const text = (reason: CampaignRejectionReasonCode) =>
      renderCampaignDecisionEmail({
        locale: "fr",
        code: "rejected",
        type: "contest",
        occurredOn: "2026-11-14",
        reason,
        memberMessage: MESSAGE,
      }).text;
    expect(text("contact_in_text")).toContain(
      "Votre campagne contient une adresse, un numéro, un lien ou une invitation à vous contacter en dehors d'INFLUX.",
    );
    expect(text("amount_in_text")).toContain(
      "Un montant figure dans votre texte. Les montants se déclarent dans le bloc budget, qui n'est jamais publié.",
    );
    expect(text("link_in_text")).toContain(
      "Les liens ne sont pas acceptés dans une campagne. Votre site figure déjà sur votre profil.",
    );
    expect(text("brief_insufficient")).toContain(
      "Votre brief ne permet pas à un créateur de comprendre ce que vous attendez.",
    );
    expect(text("deliverables_inconsistent")).toContain(
      "Les formats demandés ne correspondent pas aux réseaux visés.",
    );
    expect(text("budget_inconsistent")).toContain(
      "La tranche de budget déclarée n'est pas exploitable en l'état.",
    );
    expect(text("calendar_invalid")).toContain(
      "Les dates de votre campagne ne sont plus valides.",
    );
    expect(text("creator_personal_criterion")).toContain(
      "Le ciblage porte sur l'audience, jamais sur le créateur.",
    );
    expect(text("concealed_advertising")).toContain(
      "Une campagne ne peut pas demander de présenter un contenu rémunéré comme un avis spontané.",
    );
    expect(text("duplicate")).toContain(
      "Une campagne identique est déjà publiée.",
    );
    expect(text("sensitive_authorizations_missing")).toContain(
      "Nous n'avons pas pu vérifier vos autorisations pour ce type de produit.",
    );
  });

  it.each(
    REASONS.flatMap((reason) =>
      LOCALES.map((locale) => [reason, locale] as const),
    ),
  )(
    "%s (%s): the reason, then the next step of its row (fix or contact)",
    (reason, locale) => {
      const email = renderCampaignDecisionEmail({
        locale,
        code: "rejected",
        type: "ambassador",
        occurredOn: "2026-11-14",
        reason,
        memberMessage: MESSAGE,
      });
      expect(checkRenderedTransactionalOutput(bodyOf(email))).toEqual([]);
      const texts = (locale === "fr" ? french : english).email.campaignDecision;
      expect(email.text).toContain(texts.reason[reason]);
      expect(email.text).toContain(
        CONTACT_REASONS.includes(reason)
          ? texts.nextStep.contact
          : texts.nextStep.fix,
      );
      expect(email.text).not.toContain(
        CONTACT_REASONS.includes(reason)
          ? texts.nextStep.fix
          : texts.nextStep.contact,
      );
    },
  );

  it("the text of the agent follows illicit_content and other only, escaped in the HTML part, never for another reason", () => {
    const render = (reason: CampaignRejectionReasonCode, message: string) =>
      renderCampaignDecisionEmail({
        locale: "fr",
        code: "rejected",
        type: "contest",
        occurredOn: "2026-11-14",
        reason,
        memberMessage: message,
      });
    for (const reason of ["illicit_content", "other"] as const) {
      const email = render(
        reason,
        "Un <b>produit</b> & un autre.\n\nSecond paragraphe.",
      );
      expect(email.text).toContain("Un <b>produit</b> & un autre.");
      expect(email.text).toContain("Second paragraphe.");
      expect(email.html).toContain(
        "Un &lt;b&gt;produit&lt;/b&gt; &amp; un autre.",
      );
      expect(email.html).not.toContain("<b>");
    }
    for (const reason of REASONS.filter(
      (candidate) => !campaignReasonNeedsMessage(candidate),
    )) {
      expect(render(reason, MESSAGE).text).not.toContain(MESSAGE);
    }
  });

  it("the preview of a refusal reads the same translation files as the e-mail", () => {
    for (const locale of LOCALES) {
      for (const reason of REASONS) {
        const preview = campaignRejectionReasonPreview(locale, reason);
        const email = renderCampaignDecisionEmail({
          locale,
          code: "rejected",
          type: "contest",
          occurredOn: "2026-11-14",
          reason,
          memberMessage: MESSAGE,
        });
        expect(email.text).toContain(preview.message);
        expect(email.text).toContain(preview.nextStep);
      }
    }
  });
});

describe("L3C-T6: 09 RG94: an intervention tells the brand its typed reason, never a value nor an agent", () => {
  it("a pause, a resumption, a closure and a correction carry the sentence of the reason read", () => {
    for (const code of [
      "paused_by_influx",
      "resumed_by_influx",
      "closed_by_influx",
      "corrected",
    ] as const) {
      for (const reason of INTERVENTION_REASONS) {
        const email = renderCampaignDecisionEmail(
          code === "corrected"
            ? {
                locale: "en",
                code,
                type: "contest",
                occurredOn: "2026-11-14",
                reason,
                field: "title",
              }
            : {
                locale: "en",
                code,
                type: "contest",
                occurredOn: "2026-11-14",
                reason,
              },
        );
        expect(email.text).toContain(
          english.email.campaignDecision.interventionReason[reason],
        );
        expect(checkRenderedTransactionalOutput(bodyOf(email))).toEqual([]);
      }
    }
  });

  it("a correction names the field it changed by its label, in the language of the brand", () => {
    const render = (locale: "fr" | "en", field: CampaignFieldCode) =>
      renderCampaignDecisionEmail({
        locale,
        code: "corrected",
        type: "product_review",
        occurredOn: "2026-11-14",
        reason: "entry_error",
        field,
      }).text;
    expect(render("fr", "public_summary")).toContain(
      "le champ « Résumé public » de votre campagne de type « Test de produit et avis »",
    );
    expect(render("en", "applications_close_on")).toContain(
      "the “Application deadline” field of your “Product test and review” campaign",
    );
  });

  it("a creation for the brand and an automatic closure carry no reason sentence", () => {
    for (const code of ["created_for_brand", "closed_automatically"] as const) {
      const text = renderCampaignDecisionEmail(inputOf(code, "fr")).text;
      for (const sentence of Object.values(
        french.email.campaignDecision.interventionReason,
      )) {
        expect(text).not.toContain(sentence);
      }
    }
  });
});

// the connector ----------------------------------------------------------------------------------

const ACCOUNT = "4f6c2a51-93d7-4b8e-a1c0-7e2d9b3f5a68";
const CAMPAIGN = "9d1e2f3a-4b5c-4d6e-8f7a-8b9c0d1e2f3a";
const ENTRY = "5c0d1e2f-3a4b-4c5d-8e6f-7a8b9c0d1e2f";
const EMAIL = "lena-k7q2@example.test";

let double: BrevoDouble;
let reads: string[];

function account(overrides: Partial<SubjectAccount> = {}): SubjectAccount {
  return {
    id: ACCOUNT,
    status: "active",
    role: "advertiser",
    declaredStatus: "business",
    countryCode: "BE",
    preferredLanguage: "fr",
    emailVerified: true,
    marketingEmailConsent: false,
    commercialProspectionConsent: false,
    ...overrides,
  };
}

function state(overrides: Partial<SubjectAccount> = {}): AttemptState {
  return {
    attempt: 1,
    account: account(overrides),
    settings: { brevo_list_ids: { advertisers: 2, creators: 3 } },
  };
}

let nextLine = 1;

function decided(
  emailCode: string,
  key: Record<string, string> = { entry_id: ENTRY },
): ClaimedLine {
  const id = String(nextLine++);
  const event = `0a1b2c3d-0000-4000-8000-${id.padStart(12, "0")}`;
  return {
    id,
    eventId: event,
    eventType: "campaign.decision",
    destination: "brevo_transactional",
    subjectKey: `account:${ACCOUNT}`,
    priority: 100,
    payload: {
      event_id: event,
      account_id: ACCOUNT,
      campaign_id: CAMPAIGN,
      email_code: emailCode,
      ...key,
    },
    idempotencyKey: `campaign.decision:${key.entry_id ?? key.intervention_id ?? CAMPAIGN}`,
  };
}

const PUBLISHED: BrevoCampaignDecision = {
  emailCode: "published",
  campaignType: "product_review",
  occurredOn: "2026-11-14",
  reasonCode: null,
  memberMessage: null,
  fieldCode: null,
  preferredLanguage: "fr",
};

function connector(
  decision: BrevoCampaignDecision | null,
  settings: { testRecipients?: string[] } = {},
): Connector {
  return createBrevoConnectors(
    {
      mode: "redirect",
      testRecipients: settings.testRecipients ?? [EMAIL],
      apiKey: "local-double-key",
      baseUrl: double.baseUrl,
      senderTransactional: "no-reply@tx.influx.example",
      suppressionListId: null,
    },
    {
      logger: { error: () => {} },
      readSubject: (claimed) => {
        reads.push(`subject:${claimed.id}`);
        return Promise.resolve({
          email: EMAIL,
          signedUpAt: "2026-10-09T08:15:00.000Z",
          company: null,
          utmSource: null,
          utmMedium: null,
          utmCampaign: null,
          referrerDomain: null,
          heardFrom: null,
          viaInvitation: false,
          consentAt: null,
          consentSource: null,
          welcomeSent: false,
          previousEmail: null,
          externalContactId: null,
          suppressed: false,
          signedInAt: null,
          browser: null,
          timeZone: "UTC",
          dataRequest: null,
          exportExpiresAt: null,
        });
      },
      readErasureSubject: () => Promise.resolve(null),
      readErasureNotificationSubject: () => Promise.resolve(null),
      readProfileDecision: () => Promise.resolve(null),
      readCreatorProfileDecision: () => Promise.resolve(null),
      readPortfolioDecision: () => Promise.resolve(null),
      readCreatorProfile: () => Promise.resolve(null),
      readBrandProfile: () => Promise.resolve(null),
      readVerificationEmail: () => Promise.resolve(null),
      readBadgeEmail: () => Promise.resolve(null),
      readVerifiedBadge: () => Promise.resolve(null),
      readCampaignAttributes: () => Promise.resolve(null),
      readCampaignDecision: (claimed) => {
        reads.push(`decision:${claimed.id}`);
        return Promise.resolve(decision);
      },
    },
  ).transactional;
}

async function prepare(transactional: Connector, claimed: ClaimedLine) {
  return transactional.prepare(claimed, state());
}

async function send(transactional: Connector, claimed: ClaimedLine) {
  const preparation = await prepare(transactional, claimed);
  if (preparation.kind !== "mapped") {
    throw new Error(`expected a mapped line, got ${preparation.kind}`);
  }
  return preparation.send();
}

beforeAll(async () => {
  double = await startBrevoDouble();
});

afterAll(async () => {
  await double.close();
});

beforeEach(() => {
  double.reset();
  reads = [];
});

describe("L3C-T6: 09 RG93: the connector writes the e-mail of a decision from the facts read", () => {
  it("a publication leaves by the event type of its line, in the language read, with the key of the decision, whatever the marketing consent", async () => {
    const claimed = decided("published");
    const result = await send(
      connector({ ...PUBLISHED, preferredLanguage: "en" }),
      claimed,
    );
    expect(result).toMatchObject({ kind: "succeeded", locale: "en" });
    const [message] = double.delivered;
    expect(message?.body).toMatchObject({
      to: [{ email: EMAIL }],
      subject: "Your INFLUX campaign is published",
      tags: ["campaign.decision"],
    });
    expect(message?.body.templateId).toBeUndefined();
    expect(message?.headers["idempotency-key"]).toBe(
      `campaign.decision:${ENTRY}`,
    );
    expect(message?.body.textContent).toContain("“Product test and review”");
    expect(message?.body.textContent).toContain("November 14, 2026");
    // the address comes from the subject read, the decision from its own read, nothing else
    expect(reads).toEqual([`subject:${claimed.id}`, `decision:${claimed.id}`]);
  });

  it("each code of the closed list is written, in French, from the facts and never from the payload", async () => {
    const facts: readonly [string, Partial<BrevoCampaignDecision>, string][] = [
      ["rejected", { reasonCode: "duplicate" }, "n'a pas été publiée"],
      ["paused_by_influx", { reasonCode: "brand_request" }, "est en pause"],
      ["resumed_by_influx", { reasonCode: "entry_error" }, "est reprise"],
      ["closed_by_influx", { reasonCode: "other" }, "est clôturée"],
      ["closed_automatically", {}, "clôturée automatiquement"],
      [
        "corrected",
        { reasonCode: "entry_error", fieldCode: "ends_on" },
        "Fin de la période",
      ],
      ["created_for_brand", { reasonCode: "brand_request" }, "brouillon"],
    ];
    for (const [emailCode, overrides, expected] of facts) {
      double.reset();
      const claimed = decided(emailCode, { intervention_id: ENTRY });
      const result = await send(
        connector({ ...PUBLISHED, emailCode, ...overrides }),
        claimed,
      );
      expect(result.kind).toBe("succeeded");
      expect(double.delivered[0]?.body.textContent).toContain(expected);
    }
  });

  it("the message of the agent (other, illicit_content) is escaped in the HTML part", async () => {
    await send(
      connector({
        ...PUBLISHED,
        emailCode: "rejected",
        reasonCode: "illicit_content",
        memberMessage: "Ce produit <b>mélange</b> deux régimes & deux pays.",
      }),
      decided("rejected"),
    );
    const [message] = double.delivered;
    expect(message?.body.htmlContent).toContain(
      "Ce produit &lt;b&gt;mélange&lt;/b&gt; deux régimes &amp; deux pays.",
    );
    expect(message?.body.htmlContent).not.toContain("<b>");
  });

  it("a message of the agent that looks like a link is refused by the output check, nothing sent", async () => {
    for (const memberMessage of [
      "Voyez notre page sur https://exemple.invalid/marque pour comprendre.",
      "Écrivez-nous à contact@exemple.invalid pour en discuter ensemble.",
      "Passez par exemple.com pour corriger votre campagne de marque.",
    ]) {
      const transactional = connector({
        ...PUBLISHED,
        emailCode: "rejected",
        reasonCode: "other",
        memberMessage,
      });
      const prepared = await prepare(transactional, decided("rejected"));
      expect(prepared.kind === "mapped" && prepared.description).toMatchObject({
        operation: "send_transactional",
        rejectedAttributeNames: ["htmlContent", "textContent"],
      });
      expect(await send(transactional, decided("rejected"))).toEqual({
        kind: "failed",
        errorCode: "output_check_rejected",
      });
    }
    expect(double.requests).toHaveLength(0);
  });

  it("fails visibly, nothing sent: no such act, a code, type, reason or field outside the lists, a refusal needing its message without it", async () => {
    const failure = async (facts: BrevoCampaignDecision | null) =>
      prepare(connector(facts), decided("rejected"));
    const rejected = { ...PUBLISHED, emailCode: "rejected" };
    expect(await failure(null)).toEqual({
      kind: "fail",
      errorCode: "decision_not_found",
    });
    expect(await failure({ ...PUBLISHED, emailCode: "withdrawn" })).toEqual({
      kind: "fail",
      errorCode: "decision_unknown",
    });
    expect(await failure({ ...PUBLISHED, campaignType: null })).toEqual({
      kind: "fail",
      errorCode: "campaign_type_unknown",
    });
    expect(await failure({ ...PUBLISHED, campaignType: "made_up" })).toEqual({
      kind: "fail",
      errorCode: "campaign_type_unknown",
    });
    expect(await failure({ ...rejected, reasonCode: "made_up" })).toEqual({
      kind: "fail",
      errorCode: "rejection_reason_unknown",
    });
    expect(await failure({ ...rejected, reasonCode: null })).toEqual({
      kind: "fail",
      errorCode: "rejection_reason_unknown",
    });
    for (const reasonCode of ["other", "illicit_content"]) {
      expect(await failure({ ...rejected, reasonCode })).toEqual({
        kind: "fail",
        errorCode: "member_message_missing",
      });
    }
    const paused = { ...PUBLISHED, emailCode: "paused_by_influx" };
    expect(await failure({ ...paused, reasonCode: "made_up" })).toEqual({
      kind: "fail",
      errorCode: "intervention_reason_unknown",
    });
    const corrected = {
      ...PUBLISHED,
      emailCode: "corrected",
      reasonCode: "entry_error",
    };
    expect(await failure({ ...corrected, fieldCode: null })).toEqual({
      kind: "fail",
      errorCode: "campaign_field_unknown",
    });
    expect(await failure({ ...corrected, fieldCode: "made_up" })).toEqual({
      kind: "fail",
      errorCode: "campaign_field_unknown",
    });
    expect(double.requests).toHaveLength(0);
  });

  it("an account that is not active gets nothing and its decision is not read", async () => {
    const transactional = connector(PUBLISHED);
    expect(
      (
        await transactional.prepare(
          decided("published"),
          state({ status: "deleted" }),
        )
      ).kind,
    ).toBe("skip");
    expect(reads.filter((read) => read.startsWith("decision:"))).toEqual([]);
  });

  it("redirect: an address outside BREVO_TEST_RECIPIENTS is skipped_non_production", async () => {
    const transactional = connector(PUBLISHED, {
      testRecipients: ["someone-else@example.test"],
    });
    expect(await prepare(transactional, decided("published"))).toEqual({
      kind: "skip",
      reason: "skipped_non_production",
    });
  });
});

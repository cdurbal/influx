// Queue 7, « campagnes à valider », in words and in checks (docs/mvp/09 RG5, RG6, RG21 to RG23, RG85, RG87 to RG95;
// 15 RG27 C1 to C8; 17b §3.8; jalons/l3c/modele.md §1, §3, §4; l3c-fiche invariants 2, 5, 12; L3C-08): pure
// functions of src/components/campaign-queue-view.ts and campaign-review-view.ts, without a browser. The
// database says who holds an entry, which phase the review is in, which version a decision binds and which
// reasons exist; these only word and gather: the words of a line, the facts of the brand and of the campaign,
// the budget by the label of its band alone (D78), the alerts, the phase, the draft of the three decisions and
// their checks, what a refused call means.
import {
  CAMPAIGN_DECISION_CONFLICT_ISSUES,
  CAMPAIGN_REJECTION_REASON_CODES,
  type CampaignEntryRow,
  type CampaignFields,
  type CampaignReviewReason,
  type OpenCampaignEntryResponse,
} from "@influx/contracts/campaign-review";
import type { RelayResult } from "@influx/web-platform/relay-client";
import { describe, expect, it } from "vitest";
import {
  campaignAlertNote,
  campaignBrandWords,
  campaignCategoryWords,
  campaignReviewWords,
  campaignTitleWords,
} from "../src/components/campaign-queue-view";
import {
  alertLine,
  brandFacts,
  briefOf,
  budgetWords,
  campaignFacts,
  closedLines,
  decisionKindOf,
  defaultOwnerOf,
  duplicateLine,
  firstOpinionOf,
  firstReviewCheck,
  forwardedLines,
  ownerOptions,
  publishCheck,
  publishedLines,
  reasonPreview,
  rejectCheck,
  rejectedLines,
  reviewBanner,
} from "../src/components/campaign-review-view";
import { claimedRefusalOf } from "../src/components/claimed-entry-view";
import { EMPTY_DRAFT } from "../src/components/verification-decision-view";
import { messages } from "../src/messages/fr";

const TOKEN = "c".repeat(64);
const ME = "55555555-5555-4555-8555-555555555555";
const LOU = "66666666-6666-4666-8666-666666666666";
const t = messages.campaignReview;

const REASONS: CampaignReviewReason[] = [
  {
    code: "brief_insufficient",
    position: 4,
    requiresMemberMessage: false,
    message:
      "Votre brief ne permet pas à un créateur de comprendre la mission.",
    nextStepMessage: "Complétez le brief, puis soumettez de nouveau.",
  },
  {
    code: "other",
    position: 14,
    requiresMemberMessage: true,
    message: "Nous ne pouvons pas publier votre campagne en l’état.",
    nextStepMessage: "Écrivez-nous pour en discuter.",
  },
];

function fields(changes: Partial<CampaignFields> = {}): CampaignFields {
  return {
    title: "Gamme de soins du visage",
    campaignType: "product_review",
    publicSummary: "Nous cherchons des créateurs beauté.",
    brief: "Ligne un du brief.\nLigne deux, jamais coupée.",
    internalReference: "REF-12",
    productDescription: "Trois soins du visage.",
    productSector: "beauty_personal_care",
    sectorIsSensitive: false,
    restrictions: null,
    keyMessages: ["Message un", "Message deux"],
    productIsSent: true,
    creatorKeepsProduct: true,
    shippingCostsBorneBy: "brand",
    deliverables: [
      { networkCode: "instagram", formatCode: "instagram_reel", quantity: 2 },
    ],
    usageRights: "organic_repost",
    usageRightsDuration: "3m",
    usageRightsTerritoryScope: "selected_countries",
    usageRightsTerritories: ["FR", "BE"],
    exclusivity: "le_1m",
    contentReviewDelay: "5bd",
    contentDueOn: "2026-12-05",
    audienceGender: null,
    audienceCountries: ["FR"],
    audienceLanguages: ["fr"],
    audienceBands: [],
    audienceAgeBands: [],
    audienceTopics: ["beauty"],
    remunerationKind: "cash",
    budgetBandLabelKey: "price_band.1000_2500",
    creatorsWanted: 3,
    applicationsCloseOn: "2026-11-25",
    startsOn: "2026-12-12",
    endsOn: "2027-01-09",
    maxApplications: null,
    requestedItems: [],
    ...changes,
  };
}

type ReviewChanges = Partial<OpenCampaignEntryResponse["entry"]["review"]>;

function view(
  changes: Partial<OpenCampaignEntryResponse> = {},
  review: ReviewChanges = {},
): OpenCampaignEntryResponse {
  return {
    asOf: "2026-11-10T10:00:00.000Z",
    outcome: "claimed",
    reviewToken: TOKEN,
    entry: {
      id: "7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22",
      state: "open",
      createdAt: "2026-11-10T08:00:00.000Z",
      slaDueAt: "2026-11-11T08:00:00.000Z",
      escalateAt: null,
      overdue: false,
      claim: {
        holder: { accountId: ME, displayName: "Alice" },
        claimedAt: "2026-11-10T09:00:00.000Z",
        claimExpiresAt: "2026-11-10T09:30:00.000Z",
        heldByCaller: true,
      },
      lastForcedRelease: null,
      decision: null,
      review: {
        phase: "single",
        enhancedReview: false,
        firstReviewer: null,
        firstReviewedAt: null,
        firstOpinion: null,
        ...review,
      },
    },
    campaignId: "88888888-8888-4888-8888-888888888888",
    brand: {
      accountId: "44444444-4444-4444-8444-444444444444",
      name: "Maison Aurore",
      countryCode: "FR",
      preferredLanguage: "fr",
      owner: { accountId: LOU, displayName: "Lou" },
      verified: true,
      publishedCount: 3,
    },
    campaign: fields(),
    status: "pending_review",
    alerts: [],
    duplicateOf: null,
    reasons: REASONS,
    responsibles: [
      { accountId: ME, displayName: "Alice" },
      { accountId: LOU, displayName: "Lou" },
    ],
    ...changes,
  };
}

function row(changes: Partial<CampaignEntryRow> = {}): CampaignEntryRow {
  return {
    id: "7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22",
    campaignId: "88888888-8888-4888-8888-888888888888",
    advertiserAccountId: "44444444-4444-4444-8444-444444444444",
    brandName: "Maison Aurore",
    title: "Gamme de soins du visage",
    campaignType: "product_review",
    sectorCode: "beauty_personal_care",
    enhancedReview: false,
    phase: "single",
    firstReviewer: null,
    createdAt: "2026-11-10T08:00:00.000Z",
    slaDueAt: "2026-11-11T08:00:00.000Z",
    escalateAt: null,
    overdue: false,
    owner: null,
    claim: {
      holder: null,
      claimedAt: null,
      claimExpiresAt: null,
      heldByCaller: false,
    },
    alerts: [],
    ...changes,
  };
}

function failed(
  code: string,
  issues: string[],
): Exclude<RelayResult<unknown>, { kind: "ok" }> {
  return { kind: "failed", code, issues };
}

function factOf(
  facts: readonly { key: string; value: string }[],
  key: string,
): string {
  return facts.find((fact) => fact.key === key)?.value ?? "";
}

describe("L3C-08 queue 7, the list: the words of a line (17b §2.7 line 6, 09 RG87)", () => {
  it("names the brand, the title and the category, and says when one is missing", () => {
    expect(campaignBrandWords(row())).toBe("Maison Aurore");
    expect(campaignTitleWords(row())).toBe("Gamme de soins du visage");
    expect(campaignCategoryWords(row())).toBe("Product review");
    const bare = row({ brandName: null, title: "  ", campaignType: null });
    expect(campaignBrandWords(bare)).toBe(messages.campaignQueue.unknownBrand);
    expect(campaignTitleWords(bare)).toBe(messages.campaignQueue.untitled);
    expect(campaignCategoryWords(bare)).toBe(messages.campaignQueue.none);
  });

  it("writes the phase of the review, the second naming the first examiner", () => {
    const q = messages.campaignQueue.review;
    expect(campaignReviewWords(row())).toBe(q.single);
    expect(campaignReviewWords(row({ phase: "first" }))).toBe(q.first);
    expect(
      campaignReviewWords(
        row({
          phase: "second",
          firstReviewer: { accountId: LOU, displayName: "Lou" },
        }),
      ),
    ).toBe(q.second("Lou"));
    expect(campaignReviewWords(row({ phase: "second" }))).toBe(q.second(null));
  });

  it("puts the alerts in a line of their own, informative, and nothing when there is none", () => {
    expect(campaignAlertNote(row())).toBeNull();
    const note = campaignAlertNote(
      row({ alerts: ["contact", "amount", "duplicate"] }),
    );
    expect(note).toBe(
      messages.queueList.alertLine(
        [
          messages.campaignQueue.alerts.contact,
          messages.campaignQueue.alerts.amount,
          messages.campaignQueue.alerts.duplicate,
        ].join(" · "),
      ),
    );
  });
});

describe("L3C-08 queue 7, the campaign as the agent reads it (09 blocks 1 to 7; D78)", () => {
  it("reads the budget by the label of its band alone: no bound, no currency, no amount, a key unknown said", () => {
    expect(budgetWords("price_band.100_250")).toBe("100 à 250");
    expect(budgetWords("price_band.50000_plus")).toBe("50 000 et plus");
    expect(budgetWords("price_band.7_8")).toBe(t.unknownBand);
    expect(budgetWords(null)).toBeNull();
    const text = campaignFacts(view())
      .map((fact) => fact.value)
      .join("\n");
    expect(factOf(campaignFacts(view()), "budget")).toBe("1 000 à 2 500");
    for (const forbidden of ["€", "EUR", "%", "commission", "net"]) {
      expect(text, forbidden).not.toContain(forbidden);
    }
    expect(
      factOf(
        campaignFacts(view({ campaign: fields({ budgetBandLabelKey: null }) })),
        "budget",
      ),
    ).toBe(t.unset);
  });

  it("gives the brand, its verification and its published campaigns, without an e-mail or a phone", () => {
    const facts = brandFacts(view());
    expect(factOf(facts, "brandName")).toBe("Maison Aurore");
    expect(factOf(facts, "country")).toBe("France");
    expect(factOf(facts, "language")).toBe("français");
    expect(factOf(facts, "verified")).toBe(t.verified.yes);
    expect(factOf(facts, "published")).toBe("3");
    expect(factOf(facts, "owner")).toBe("Lou");
    const bare = view({
      brand: { ...view().brand, verified: false, owner: null, name: null },
    });
    expect(factOf(brandFacts(bare), "verified")).toBe(t.verified.no);
    expect(factOf(brandFacts(bare), "owner")).toBe(t.unset);
    expect(factOf(brandFacts(bare), "brandName")).toBe(t.unset);
  });

  it("writes the campaign in the order of the form, the texts keeping their line breaks and the sensitive sector said", () => {
    const facts = campaignFacts(view());
    expect(facts.map((fact) => fact.key)).toEqual([
      "category",
      "sector",
      "reference",
      "remuneration",
      "budget",
      "creatorsWanted",
      "period",
      "applicationsClose",
      "contentDue",
      "deliverables",
      "usage",
      "exclusivity",
      "reviewDelay",
      "productSent",
      "keepsProduct",
      "shipping",
      "audience",
      "maxApplications",
      "publicSummary",
      "productDescription",
      "restrictions",
      "keyMessages",
    ]);
    expect(factOf(facts, "remuneration")).toBe(t.remunerationKinds.cash);
    expect(factOf(facts, "period")).toBe("du 12/12/2026 au 09/01/2027");
    expect(factOf(facts, "applicationsClose")).toBe("25/11/2026");
    expect(factOf(facts, "deliverables")).toBe("2 × Instagram, Instagram reel");
    expect(factOf(facts, "usage")).toBe(
      "Organic repost · 3 mois · pays choisis (France, Belgique)",
    );
    expect(factOf(facts, "keyMessages")).toBe("1. Message un\n2. Message deux");
    expect(factOf(facts, "restrictions")).toBe(t.unset);
    expect(facts.find((fact) => fact.key === "keyMessages")?.multiline).toBe(
      true,
    );
    const sensitive = campaignFacts(
      view({ campaign: fields({ sectorIsSensitive: true }) }),
    );
    expect(factOf(sensitive, "sector")).toBe(
      `Beauty personal care (${t.sensitive})`,
    );
  });

  it("serves the brief whole, without a cut, and says when there is none", () => {
    expect(briefOf(view())).toBe(
      "Ligne un du brief.\nLigne deux, jamais coupée.",
    );
    const long = "mot ".repeat(2_000);
    expect(briefOf(view({ campaign: fields({ brief: long }) }))).toBe(long);
    expect(briefOf(view({ campaign: fields({ brief: "  " }) }))).toBeNull();
    expect(briefOf(view({ campaign: fields({ brief: null }) }))).toBeNull();
  });

  it("words an alert by its field and its nature, never by the text, the key message by its rank", () => {
    expect(
      alertLine({
        code: "contact",
        field: "brief",
        position: null,
        signals: ["email", "phone"],
      }),
    ).toBe(t.alerts.contact("Brief", "adresse e-mail, numéro de téléphone"));
    expect(
      alertLine({
        code: "link",
        field: "keyMessages",
        position: 1,
        signals: ["url"],
      }),
    ).toBe(t.alerts.link(t.alerts.keyMessageOf("Messages clés", 2), "lien"));
    expect(
      alertLine({
        code: "amount",
        field: "publicSummary",
        position: null,
        signals: ["amount"],
      }),
    ).toBe(t.alerts.amount("Résumé public"));
  });

  it("says the duplicate as information and never as a refusal", () => {
    expect(duplicateLine(view())).toBeNull();
    const line = duplicateLine(
      view({
        duplicateOf: {
          campaignId: "99999999-9999-4999-8999-999999999999",
          title: "Gamme de soins",
          status: "published",
        },
      }),
    );
    expect(line).toContain("« Gamme de soins »");
    expect(line).toContain("publiée");
    expect(line).toContain("Information, pas un refus.");
  });
});

describe("L3C-08 queue 7, the enhanced review in two times (09 RG85, CA56, CA57; 17b §3.8)", () => {
  const sensitive = { enhancedReview: true } as const;

  it("says nothing of a campaign of one examination, and publishes it directly", () => {
    expect(reviewBanner(view(), "deciding")).toBeNull();
    expect(decisionKindOf(view())).toBe("publish");
  });

  it("makes the main button of time 1 pass the campaign on, never publish it", () => {
    const first = view({}, { ...sensitive, phase: "first" });
    expect(decisionKindOf(first)).toBe("forward");
    expect(reviewBanner(first, "deciding")?.lines).toEqual([
      t.enhanced.title,
      t.enhanced.firstYou,
    ]);
    expect(reviewBanner(first, "readOnly")?.lines).toEqual([
      t.enhanced.title,
      t.enhanced.first,
    ]);
  });

  it("names the first examiner at time 2 and makes the main button publish", () => {
    const second = view(
      {},
      {
        ...sensitive,
        phase: "second",
        firstReviewer: { accountId: LOU, displayName: "Lou" },
        firstReviewedAt: "2026-11-10T09:30:00.000Z",
        firstOpinion: "Autorisations vérifiées, rien à redire.",
      },
    );
    expect(decisionKindOf(second)).toBe("publish");
    const lines = reviewBanner(second, "deciding")?.lines ?? [];
    expect(lines[1]).toContain("1ᵉʳ avis de Lou");
    expect(lines).toContain(t.enhanced.secondYou);
    expect(firstOpinionOf(second)).toBe(
      "Autorisations vérifiées, rien à redire.",
    );
    // a closed entry carries no banner
    expect(reviewBanner(second, "closed")).toBeNull();
  });

  it("reads the opinion only where the API served it", () => {
    expect(firstOpinionOf(view({}, { firstOpinion: null }))).toBeNull();
    expect(firstOpinionOf(view({}, { firstOpinion: "  " }))).toBeNull();
  });

  it("asks a reasoned opinion of 20 to 1 000 characters, trimmed, bound to the version read", () => {
    expect(firstReviewCheck("trop court", TOKEN)).toEqual({
      ok: false,
      problem: { field: "opinion", text: t.decision.opinionTooShort },
    });
    expect(firstReviewCheck(`${"a".repeat(1001)}`, TOKEN)).toEqual({
      ok: false,
      problem: { field: "opinion", text: t.decision.opinionTooLong },
    });
    const opinion = "Les autorisations du secteur sont complètes.";
    expect(firstReviewCheck(`  ${opinion}  `, TOKEN)).toEqual({
      ok: true,
      body: { reviewToken: TOKEN, opinion },
    });
  });
});

describe("L3C-08 queue 7, the decision: the responsible, the publication, the refusal (09 RG5, RG6, RG89 to RG92)", () => {
  it("lists the commercials the API names and proposes the caller, never anyone else", () => {
    expect(ownerOptions(view()).map((option) => option.label)).toEqual([
      "Alice",
      "Lou",
    ]);
    expect(defaultOwnerOf(view())).toBe(ME);
    // the caller is not among the responsibles: the agent picks
    expect(
      defaultOwnerOf(
        view({ responsibles: [{ accountId: LOU, displayName: "Lou" }] }),
      ),
    ).toBeNull();
    // a colleague holds the entry: nobody is proposed
    const read = view();
    expect(
      defaultOwnerOf({
        ...read,
        entry: {
          ...read.entry,
          claim: { ...read.entry.claim, heldByCaller: false },
        },
      }),
    ).toBeNull();
  });

  it("demands a responsible of the list before publishing: a campaign without one is one nobody will sell", () => {
    const responsibles = view().responsibles;
    expect(publishCheck(EMPTY_DRAFT, null, responsibles, TOKEN)).toEqual({
      ok: false,
      problem: { field: "owner", text: t.decision.ownerRequired },
    });
    expect(publishCheck(EMPTY_DRAFT, null, [], TOKEN)).toEqual({
      ok: false,
      problem: { field: "owner", text: t.decision.ownerNone },
    });
    expect(
      publishCheck(
        EMPTY_DRAFT,
        "77777777-7777-4777-8777-777777777777",
        responsibles,
        TOKEN,
      ),
    ).toEqual({
      ok: false,
      problem: { field: "owner", text: t.decision.ownerInvalid },
    });
    expect(publishCheck(EMPTY_DRAFT, ME, responsibles, TOKEN)).toEqual({
      ok: true,
      body: { reviewToken: TOKEN, ownerAgentId: ME },
    });
  });

  it("sends the internal comment only when it holds something, and within its bound", () => {
    const responsibles = view().responsibles;
    expect(
      publishCheck(
        { ...EMPTY_DRAFT, internalComment: "  À suivre  " },
        ME,
        responsibles,
        TOKEN,
      ),
    ).toEqual({
      ok: true,
      body: {
        reviewToken: TOKEN,
        ownerAgentId: ME,
        internalComment: "À suivre",
      },
    });
    expect(
      publishCheck(
        { ...EMPTY_DRAFT, internalComment: "x".repeat(1001) },
        ME,
        responsibles,
        TOKEN,
      ),
    ).toEqual({
      ok: false,
      problem: {
        field: "internalComment",
        text: t.decision.commentTooLong,
      },
    });
  });

  it("refuses with a reason of the list the opening returned, the message to the brand only for the reasons that ask for it", () => {
    expect(rejectCheck(EMPTY_DRAFT, null, REASONS, TOKEN)).toEqual({
      ok: false,
      problem: { field: "reason", text: t.decision.reasonRequired },
    });
    expect(rejectCheck(EMPTY_DRAFT, "duplicate", REASONS, TOKEN)).toEqual({
      ok: false,
      problem: { field: "reason", text: t.decision.reasonRequired },
    });
    expect(
      rejectCheck(
        { ...EMPTY_DRAFT, memberMessage: "ignoré" },
        "brief_insufficient",
        REASONS,
        TOKEN,
      ),
    ).toEqual({
      ok: true,
      body: { reviewToken: TOKEN, reasonCode: "brief_insufficient" },
    });
    expect(rejectCheck(EMPTY_DRAFT, "other", REASONS, TOKEN)).toEqual({
      ok: false,
      problem: { field: "memberMessage", text: t.decision.otherTooShort },
    });
    expect(
      rejectCheck(
        { ...EMPTY_DRAFT, memberMessage: "x".repeat(501) },
        "other",
        REASONS,
        TOKEN,
      ),
    ).toEqual({
      ok: false,
      problem: { field: "memberMessage", text: t.decision.otherTooLong },
    });
    const message = "Merci de préciser le calendrier de la campagne.";
    expect(
      rejectCheck(
        { ...EMPTY_DRAFT, memberMessage: ` ${message} `, internalComment: "n" },
        "other",
        REASONS,
        TOKEN,
      ),
    ).toEqual({
      ok: true,
      body: {
        reviewToken: TOKEN,
        reasonCode: "other",
        internalComment: "n",
        memberMessage: message,
      },
    });
  });

  it("shows the sentence the brand will read, the agent's own text after it for the reason that has one", () => {
    const [plain, other] = REASONS;
    if (plain === undefined || other === undefined) {
      throw new Error("two reasons expected");
    }
    expect(reasonPreview(plain, { memberMessage: "ignoré" })).toEqual({
      paragraphs: [plain.message],
      nextStep: plain.nextStepMessage,
    });
    expect(reasonPreview(other, { memberMessage: "  Mon texte  " })).toEqual({
      paragraphs: [other.message, "Mon texte"],
      nextStep: other.nextStepMessage,
    });
  });

  it("labels every reason of the closed list of 09 RG90, in its order", () => {
    expect(Object.keys(t.decision.reasonLabels)).toEqual([
      ...CAMPAIGN_REJECTION_REASON_CODES,
    ]);
  });

  it("confirms what was decided in a sentence, the late decision marked", () => {
    expect(publishedLines(view(), false)).toEqual([
      t.decision.publishedNotice("Gamme de soins du visage"),
    ]);
    expect(publishedLines(view(), true)).toContain(t.decision.lateMark);
    expect(forwardedLines(view())).toEqual([
      t.decision.forwardedNotice("Gamme de soins du visage"),
    ]);
    expect(rejectedLines(view(), "brief_insufficient", false)).toEqual([
      t.decision.rejectedNotice(
        "Gamme de soins du visage",
        "brief insuffisant",
      ),
    ]);
    expect(rejectedLines(view(), "other", true)).toContain(t.decision.lateMark);
  });
});

describe("L3C-08 queue 7, a closed entry (09 RG5, 15 C8)", () => {
  it("says how it ended, by whom, the reason and the lateness", () => {
    const base = view();
    const closed = view({
      entry: {
        ...base.entry,
        state: "rejected",
        decision: {
          decidedAt: "2026-11-10T12:00:00.000Z",
          decidedBy: { accountId: LOU, displayName: "Lou" },
          late: true,
          rejectionReasonCode: "brief_insufficient",
          memberMessage: null,
        },
      },
    });
    const lines = closedLines(closed);
    expect(lines[0]).toBe(t.closed.rejected);
    expect(lines[1]).toContain("Décidée par Lou");
    expect(lines).toContain(t.closed.late);
    expect(lines).toContain(t.closed.reason("Brief insuffisant"));
    expect(
      closedLines(view({ entry: { ...base.entry, state: "published" } }))[0],
    ).toBe(t.closed.published);
  });
});

describe("L3C-08 queue 7, what a refused call means", () => {
  it("reads the entry again on a lost claim or a stale version, as the other queues do", () => {
    for (const [issue, why] of [
      ["stale_token", "stale"],
      ["claim_lifted", "lifted"],
      ["claim_not_held", "notHeld"],
      ["entry_closed", "closed"],
      ["held_by_other", "heldByOther"],
    ] as const) {
      expect(claimedRefusalOf(failed("conflict", [issue]), "campaign")).toEqual(
        {
          kind: "reopen",
          why,
        },
      );
    }
  });

  it("words the issues of queue 7 as a sentence and keeps the typed text", () => {
    const r = messages.claimedReview.refusals;
    const expected: Record<string, string> = {
      campaign_state: r.campaignState,
      campaign_closed: r.campaignClosed,
      not_enhanced_review: r.notEnhancedReview,
      enhanced_review_required: r.enhancedReviewRequired,
      enhanced_review: r.enhancedReview,
      first_review_given: r.firstReviewGiven,
      brand_not_publishable: r.brandNotPublishable,
      calendar_passed: r.calendarPassed,
      live_campaign_cap: r.liveCampaignCap,
    };
    for (const issue of Object.keys(expected)) {
      expect(CAMPAIGN_DECISION_CONFLICT_ISSUES as readonly string[]).toContain(
        issue,
      );
    }
    for (const [issue, text] of Object.entries(expected)) {
      expect(text).not.toBe("");
      expect(claimedRefusalOf(failed("conflict", [issue]), "campaign")).toEqual(
        {
          kind: "text",
          text,
          field: null,
        },
      );
    }
  });

  it("says a suspended brand in the very words of 17b §3.8", () => {
    expect(messages.claimedReview.refusals.brandNotPublishable).toContain(
      "La marque a été suspendue. Cette campagne ne peut pas être publiée.",
    );
    expect(t.suspended.text).toContain(
      "La marque a été suspendue. Cette campagne ne peut pas être publiée.",
    );
  });

  it("tells a value the database refused on its own field: the opinion, the responsible, the message", () => {
    const opinion = claimedRefusalOf(
      failed("validation_failed", ["invalid_opinion"]),
      "campaign",
    );
    expect(opinion.kind === "text" && opinion.field).toBe("opinion");
    const owner = claimedRefusalOf(
      failed("validation_failed", ["invalid_owner_agent"]),
      "campaign",
    );
    expect(owner.kind === "text" && owner.field).toBe("owner");
    const contact = claimedRefusalOf(
      failed("validation_failed", ["direct_contact"]),
      "campaign",
    );
    expect(contact.kind === "text" && contact.field).toBe("memberMessage");
  });
});

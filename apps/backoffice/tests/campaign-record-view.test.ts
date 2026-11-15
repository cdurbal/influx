// The record of a campaign, in words and in checks (docs/mvp/09 RG1, RG8, RG9, RG83, RG93, RG94, CA60, CA61; 17b
// §3.5 block 4, §3.8; jalons/l3c/modele.md §5, §6; l3c-fiche invariants 6, 12; L3C-09): pure functions of
// src/components/campaign-record-view.ts, without a browser. The database says which state allows which act and
// which value a field accepts; these only word and gather: the cycle, the internal block (no figure: the total
// budget is « non communiqué », the band is its label), the history in sentences, the fields offered to the
// correction (never a figure, a band or the currency), the checks of the three forms, what a refusal means.
import {
  CAMPAIGN_CORRECTABLE_FIELDS,
  CAMPAIGN_DECISION_CONFLICT_ISSUES,
  CAMPAIGN_UNSERVED_VALUE_FIELDS,
  type CampaignFields,
  type CampaignRecordResponse,
} from "@influx/contracts/campaign-review";
import { describe, expect, it } from "vitest";
import {
  accountHref,
  actFailureOf,
  actionsNote,
  actionsOf,
  CAMPAIGN_TYPE_CODES,
  CORRECTABLE_FIELDS,
  correctedNotice,
  correctionCheck,
  creationCheck,
  currentWords,
  cycleFacts,
  EMPTY_CORRECTION,
  EMPTY_PASSAGE,
  entryHref,
  historyLines,
  informedLine,
  initialText,
  internalFacts,
  openEntryIdOf,
  passageCheck,
  publicFacts,
  recordHref,
  specOf,
} from "../src/components/campaign-record-view";
import { campaignFacts } from "../src/components/campaign-review-view";
import { messages } from "../src/messages/fr";

const ME = "55555555-5555-4555-8555-555555555555";
const LOU = "66666666-6666-4666-8666-666666666666";
const ACCOUNT = "44444444-4444-4444-8444-444444444444";
const CAMPAIGN = "88888888-8888-4888-8888-888888888888";
const t = messages.campaignRecord;

function fields(changes: Partial<CampaignFields> = {}): CampaignFields {
  return {
    title: "Gamme de soins du visage",
    campaignType: "product_review",
    publicSummary: "Nous cherchons des créateurs beauté.",
    brief: "Ligne un du brief.",
    internalReference: "REF-12",
    productDescription: "Trois soins du visage.",
    productSector: "beauty_personal_care",
    sectorIsSensitive: false,
    restrictions: null,
    keyMessages: ["Message un", "Message deux"],
    productIsSent: true,
    creatorKeepsProduct: null,
    shippingCostsBorneBy: "brand",
    deliverables: [
      { networkCode: "instagram", formatCode: "instagram_reel", quantity: 2 },
    ],
    usageRights: "organic_repost",
    usageRightsDuration: "3m",
    usageRightsTerritoryScope: "worldwide",
    usageRightsTerritories: [],
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

function record(
  changes: Partial<CampaignRecordResponse> = {},
  cycle: Partial<CampaignRecordResponse["cycle"]> = {},
): CampaignRecordResponse {
  return {
    asOf: "2026-11-10T10:00:00.000Z",
    id: CAMPAIGN,
    brand: {
      accountId: ACCOUNT,
      name: "Maison Aurore",
      countryCode: "FR",
      preferredLanguage: "fr",
      owner: { accountId: LOU, displayName: "Lou" },
      verified: true,
      publishedCount: 3,
    },
    cycle: {
      status: "draft",
      submittedAt: null,
      createdAt: "2026-11-01T08:00:00.000Z",
      updatedAt: "2026-11-01T09:00:00.000Z",
      firstPublishedAt: null,
      pausedAt: null,
      pauseOrigin: null,
      closedAt: null,
      owner: null,
      snapshotVersion: null,
      ...cycle,
    },
    fields: fields(),
    alerts: [],
    duplicateOf: null,
    entries: [],
    interventions: [],
    ...changes,
  };
}

function labelled(facts: readonly { label: string; value: string }[]) {
  return Object.fromEntries(facts.map((fact) => [fact.label, fact.value]));
}

describe("L3C-U9.1: the addresses", () => {
  it("the record sits under the accounts, the entry under the queue, the brand on its own record", () => {
    expect(recordHref(CAMPAIGN)).toBe(`/inscrits/campagnes/${CAMPAIGN}`);
    expect(entryHref("e1")).toBe("/files/campagnes/e1");
    expect(accountHref(ACCOUNT)).toBe(`/inscrits/${ACCOUNT}`);
  });
});

describe("L3C-U9.2: the cycle and the internal block (09 RG3, RG83, D48, D78)", () => {
  it("a draft says its state and who is responsible, and nothing of a publication", () => {
    const shown = labelled(cycleFacts(record()));
    expect(shown[t.cycle.status]).toBe("brouillon");
    expect(shown[t.cycle.owner]).toBe(t.cycle.ownerNone);
    expect(shown[t.cycle.snapshot]).toBe(t.cycle.snapshotNone);
    expect(shown[t.cycle.firstPublishedAt]).toBeUndefined();
    expect(shown[t.cycle.pausedAt]).toBeUndefined();
    expect(shown[t.cycle.closedAt]).toBeUndefined();
  });

  it("a campaign paused by INFLUX says since when and who asked; a closed one says when", () => {
    const paused = labelled(
      cycleFacts(
        record(
          {},
          {
            status: "paused",
            firstPublishedAt: "2026-11-05T08:00:00.000Z",
            pausedAt: "2026-11-08T08:00:00.000Z",
            pauseOrigin: "influx",
            owner: { accountId: ME, displayName: "Alice" },
            snapshotVersion: 2,
          },
        ),
      ),
    );
    expect(paused[t.cycle.status]).toBe("en pause");
    expect(paused[t.cycle.pauseOrigin]).toBe("INFLUX");
    expect(paused[t.cycle.owner]).toBe("Alice");
    expect(paused[t.cycle.snapshot]).toBe("version 2");
    const closed = labelled(
      cycleFacts(
        record({}, { status: "closed", closedAt: "2026-11-09T08:00:00.000Z" }),
      ),
    );
    expect(closed[t.cycle.closedAt]).toBeDefined();
    expect(closed[t.cycle.pausedAt]).toBeUndefined();
  });

  it("the internal block gives the total as « non communiqué », the band by its label, the reference, the responsible; never a figure", () => {
    const shown = labelled(internalFacts(record()));
    expect(shown[t.internal.totalBudget]).toBe("non communiqué");
    expect(shown[t.internal.band]).toBe("1 000 à 2 500");
    expect(shown[t.internal.reference]).toBe("REF-12");
    expect(shown[t.internal.owner]).toBe(t.cycle.ownerNone);
    const all = JSON.stringify(internalFacts(record()));
    for (const forbidden of ["€", "EUR", "commission", "net créateur", "%"]) {
      expect(all, forbidden).not.toContain(forbidden);
    }
    const empty = labelled(
      internalFacts(
        record({
          fields: fields({ budgetBandLabelKey: null, internalReference: null }),
        }),
      ),
    );
    expect(empty[t.internal.band]).toBe(messages.campaignReview.unset);
    expect(empty[t.internal.reference]).toBe(messages.campaignReview.unset);
  });

  it("the campaign facts leave out the reference and the band, which the internal block holds", () => {
    const shown = publicFacts(campaignFacts({ campaign: fields() }), fields());
    const keys = shown.map((fact) => fact.key);
    expect(keys).not.toContain("reference");
    expect(keys).not.toContain("budget");
    expect(keys).toContain("category");
    expect(keys).toContain("deliverables");
    // one wording for the type of campaign, the one of the list the correction offers
    expect(shown.find((fact) => fact.key === "category")?.value).toBe(
      "Test de produit et avis",
    );
  });
});

describe("L3C-U9.3: the history of the decisions and the interventions (09 RG93, RG94)", () => {
  it("lists the entries and the interventions, the most recent first, an open entry carrying its address", () => {
    const lines = historyLines(
      record({
        entries: [
          {
            id: "e-old",
            state: "rejected",
            createdAt: "2026-11-02T08:00:00.000Z",
            closedAt: "2026-11-03T08:00:00.000Z",
            decision: {
              decidedAt: "2026-11-03T08:00:00.000Z",
              decidedBy: { accountId: LOU, displayName: "Lou" },
              late: true,
              rejectionReasonCode: "brief_insufficient",
              memberMessage: null,
            },
            firstReviewedBy: null,
            firstReviewedAt: null,
          },
          {
            id: "e-open",
            state: "open",
            createdAt: "2026-11-06T08:00:00.000Z",
            closedAt: null,
            decision: null,
            firstReviewedBy: { accountId: ME, displayName: "Alice" },
            firstReviewedAt: "2026-11-06T12:00:00.000Z",
          },
        ],
        interventions: [
          {
            id: "i1",
            kind: "paused",
            fieldCode: null,
            oldValueJson: null,
            newValueJson: null,
            reasonCode: "brand_request",
            agent: { accountId: LOU, displayName: "Lou" },
            createdAt: "2026-11-08T08:00:00.000Z",
          },
        ],
      }),
    );
    expect(lines.map((line) => line.key)).toEqual([
      "intervention-i1",
      "first-e-open",
      "entry-e-open",
      "entry-e-old",
    ]);
    expect(lines[0]?.text).toContain("Mise en pause");
    expect(lines[0]?.text).toContain("Lou");
    expect(lines[0]?.text).toContain("À la demande de la marque");
    expect(lines[1]?.text).toContain("avis favorable de Alice");
    expect(lines[2]?.entryId).toBe("e-open");
    expect(lines[3]?.text).toContain("Brief insuffisant");
    expect(lines[3]?.text).toContain("après l’échéance");
    expect(lines[3]?.entryId).toBeNull();
  });

  it("a correction keeps the old and the new value in words; a figure, a band or the currency keeps none", () => {
    const base = {
      id: "i2",
      kind: "corrected" as const,
      reasonCode: "entry_error" as const,
      agent: null,
      createdAt: "2026-11-08T08:00:00.000Z",
    };
    const [title] = historyLines(
      record({
        interventions: [
          {
            ...base,
            fieldCode: "title",
            oldValueJson: JSON.stringify("Ancien titre"),
            newValueJson: JSON.stringify("Nouveau titre"),
          },
        ],
      }),
    );
    expect(title?.text).toContain("Champ corrigé");
    expect(title?.text).toContain("un agent");
    expect(title?.text).toContain("Champ : Titre.");
    expect(title?.text).toContain("Ancienne valeur : Ancien titre.");
    expect(title?.text).toContain("Nouvelle valeur : Nouveau titre.");
    const [kind, days, yes] = historyLines(
      record({
        interventions: [
          {
            ...base,
            id: "k",
            fieldCode: "remuneration_kind",
            oldValueJson: JSON.stringify("cash"),
            newValueJson: JSON.stringify("gift_only"),
            createdAt: "2026-11-08T10:00:00.000Z",
          },
          {
            ...base,
            id: "d",
            fieldCode: "ends_on",
            oldValueJson: JSON.stringify("2027-01-09"),
            newValueJson: "null",
            createdAt: "2026-11-08T09:00:00.000Z",
          },
          {
            ...base,
            id: "y",
            fieldCode: "product_is_sent",
            oldValueJson: "true",
            newValueJson: "false",
          },
        ],
      }),
    );
    expect(kind?.text).toContain("Ancienne valeur : Numéraire.");
    expect(kind?.text).toContain("Nouvelle valeur : Produit offert seul.");
    expect(days?.text).toContain("Ancienne valeur : 09/01/2027.");
    expect(days?.text).toContain("Nouvelle valeur : vide.");
    expect(yes?.text).toContain(
      "Ancienne valeur : oui. Nouvelle valeur : non.",
    );
    for (const code of CAMPAIGN_UNSERVED_VALUE_FIELDS) {
      const [line] = historyLines(
        record({
          interventions: [
            {
              ...base,
              fieldCode: code,
              oldValueJson: null,
              newValueJson: null,
            },
          ],
        }),
      );
      expect(line?.text, code).toContain(t.history.valuesNotServed.trim());
      expect(line?.text, code).not.toContain("Ancienne valeur");
    }
  });

  it("an empty history is empty; a withdrawn entry and a publication are worded", () => {
    expect(historyLines(record())).toEqual([]);
    const lines = historyLines(
      record({
        entries: [
          {
            id: "w",
            state: "withdrawn",
            createdAt: "2026-11-02T08:00:00.000Z",
            closedAt: "2026-11-04T08:00:00.000Z",
            decision: null,
            firstReviewedBy: null,
            firstReviewedAt: null,
          },
          {
            id: "p",
            state: "published",
            createdAt: "2026-11-05T08:00:00.000Z",
            closedAt: "2026-11-05T10:00:00.000Z",
            decision: {
              decidedAt: "2026-11-05T10:00:00.000Z",
              decidedBy: { accountId: ME, displayName: "Alice" },
              late: false,
              rejectionReasonCode: null,
              memberMessage: null,
            },
            firstReviewedBy: null,
            firstReviewedAt: null,
          },
        ],
      }),
    );
    expect(lines[0]?.text).toContain("Publiée");
    expect(lines[0]?.text).toContain("Alice");
    expect(lines[1]?.text).toContain("retirée de la file");
  });
});

describe("L3C-U9.4: what a state allows (09 RG3, RG8, RG9, modele §5, §6)", () => {
  it("offers the correction to a draft, a refused or a pending campaign; pause and closing to a published one; resumption and closing to a paused one; nothing to a closed one", () => {
    expect(actionsOf("draft")).toEqual(["correct"]);
    expect(actionsOf("rejected")).toEqual(["correct"]);
    expect(actionsOf("pending_review")).toEqual(["correct"]);
    expect(actionsOf("published")).toEqual(["pause", "close"]);
    expect(actionsOf("paused")).toEqual(["resume", "close"]);
    expect(actionsOf("closed")).toEqual([]);
  });

  it("says why a published or paused campaign is not corrected, and that a closing is final", () => {
    expect(actionsNote("published")).toBe(t.actions.frozen);
    expect(actionsNote("paused")).toBe(t.actions.frozen);
    expect(actionsNote("closed")).toBe(t.actions.closedNote);
    expect(actionsNote("draft")).toBeNull();
    expect(actionsNote("pending_review")).toBeNull();
  });

  it("finds the open entry of a pending campaign, and the language the brand is told in", () => {
    expect(openEntryIdOf(record())).toBeNull();
    expect(
      openEntryIdOf(
        record({
          entries: [
            {
              id: "e",
              state: "open",
              createdAt: "2026-11-06T08:00:00.000Z",
              closedAt: null,
              decision: null,
              firstReviewedBy: null,
              firstReviewedAt: null,
            },
          ],
        }),
      ),
    ).toBe("e");
    expect(informedLine(record())).toBe(
      "La marque en est informée par e-mail, en français.",
    );
    expect(
      informedLine(
        record({ brand: { ...record().brand, preferredLanguage: "en" } }),
      ),
    ).toBe("La marque en est informée par e-mail, en anglais.");
  });
});

describe("L3C-U9.5: the fields offered to the correction (invariant 12)", () => {
  it("never offers a figure, a band, the currency, a list of reference codes, the deliverables or the territory", () => {
    const offered = CORRECTABLE_FIELDS.map((spec) => spec.code) as string[];
    for (const code of [
      "total_budget",
      "budget_band",
      "currency",
      "product_value_band",
      "product_sector",
      "audience_countries",
      "audience_languages",
      "audience_topics",
      "deliverables",
      "usage_rights_territory",
    ]) {
      expect(offered, code).not.toContain(code);
    }
    expect(new Set(offered).size).toBe(offered.length);
    for (const code of offered) {
      expect(CAMPAIGN_CORRECTABLE_FIELDS as readonly string[], code).toContain(
        code,
      );
      expect(t.fields[code], code).toBeDefined();
    }
  });

  it("the campaign types are the seven of 09 RG18, each worded", () => {
    expect(CAMPAIGN_TYPE_CODES).toHaveLength(7);
    for (const code of CAMPAIGN_TYPE_CODES) {
      expect(t.campaignTypes[code], code).toBeDefined();
    }
  });

  it("shows the value kept now in words and starts the editor on it", () => {
    const f = fields({ creatorKeepsProduct: false });
    const of = (code: Parameters<typeof specOf>[0]) => {
      const spec = specOf(code);
      if (spec === null) {
        throw new Error(`no spec for ${code}`);
      }
      return spec;
    };
    expect(currentWords(of("title"), f)).toBe("Gamme de soins du visage");
    expect(currentWords(of("campaign_type"), f)).toBe(
      "Test de produit et avis",
    );
    expect(currentWords(of("restrictions"), f)).toBe(t.correct.currentEmpty);
    expect(currentWords(of("product_is_sent"), f)).toBe("oui");
    expect(currentWords(of("creator_keeps_product"), f)).toBe("non");
    expect(currentWords(of("creators_wanted"), f)).toBe("3");
    expect(currentWords(of("ends_on"), f)).toBe("09/01/2027");
    expect(currentWords(of("key_messages"), f)).toBe(
      "1. Message un\n2. Message deux",
    );
    expect(initialText(of("key_messages"), f)).toBe("Message un\nMessage deux");
    expect(initialText(of("product_is_sent"), f)).toBe("yes");
    expect(initialText(of("creator_keeps_product"), f)).toBe("no");
    expect(initialText(of("max_applications"), f)).toBe("");
    expect(initialText(of("ends_on"), f)).toBe("2027-01-09");
  });
});

describe("L3C-U9.6: the correction of ONE field (09 RG94, CA60)", () => {
  const f = fields();
  const base = {
    ...EMPTY_CORRECTION,
    fieldCode: "title" as const,
    text: "Un nouveau titre",
    reasonCode: "entry_error" as const,
  };

  function problemOf(draft: Parameters<typeof correctionCheck>[0]) {
    const checked = correctionCheck(draft, f);
    if (checked.ok) {
      throw new Error("expected a problem");
    }
    return checked.problem;
  }

  it("asks for the field, then a value, then a reason: in that order, each on its own field", () => {
    expect(problemOf(EMPTY_CORRECTION)).toEqual({
      field: "field",
      text: t.correct.fieldRequired,
    });
    expect(problemOf({ ...base, text: "   " })).toEqual({
      field: "value",
      text: t.correct.valueRequired,
    });
    expect(problemOf({ ...base, reasonCode: null })).toEqual({
      field: "reason",
      text: t.actions.reasonRequired,
    });
  });

  it("types the value by the kind of the field", () => {
    const ok = (draft: Parameters<typeof correctionCheck>[0]) => {
      const checked = correctionCheck(draft, f);
      if (!checked.ok) {
        throw new Error(checked.problem.text);
      }
      return checked.body;
    };
    expect(ok(base)).toEqual({
      fieldCode: "title",
      value: "Un nouveau titre",
      reasonCode: "entry_error",
    });
    expect(
      ok({ ...base, fieldCode: "creators_wanted", text: " 12 " }).value,
    ).toBe(12);
    expect(
      ok({ ...base, fieldCode: "product_is_sent", text: "no" }).value,
    ).toBe(false);
    expect(
      ok({ ...base, fieldCode: "ends_on", text: "2027-02-01" }).value,
    ).toBe("2027-02-01");
    expect(
      ok({ ...base, fieldCode: "campaign_type", text: "contest" }).value,
    ).toBe("contest");
    expect(
      ok({
        ...base,
        fieldCode: "key_messages",
        text: " Un \n\n Deux \r\n Trois ",
      }).value,
    ).toEqual(["Un", "Deux", "Trois"]);
  });

  it("refuses what the kind refuses: a number out of range, a date that does not exist, a code outside the list, six messages", () => {
    const at = (fieldCode: string, text: string) =>
      problemOf({
        ...base,
        fieldCode: fieldCode as (typeof base)["fieldCode"],
        text,
      });
    expect(at("creators_wanted", "12,5").text).toBe(t.correct.integerInvalid);
    expect(at("creators_wanted", "-3").text).toBe(t.correct.integerInvalid);
    expect(at("creators_wanted", "32768").text).toBe(t.correct.integerInvalid);
    expect(at("ends_on", "2027-02-30").text).toBe(t.correct.dateInvalid);
    expect(at("ends_on", "09/01/2027").text).toBe(t.correct.dateInvalid);
    expect(at("campaign_type", "other").text).toBe(t.correct.optionInvalid);
    expect(at("campaign_type", "").text).toBe(t.correct.valueRequired);
    expect(at("product_is_sent", "").text).toBe(t.correct.valueRequired);
    expect(at("key_messages", "1\n2\n3\n4\n5\n6").text).toBe(
      t.correct.linesTooMany,
    );
  });

  it("refuses a value identical to the one kept, so that no correction is recorded for nothing", () => {
    expect(
      problemOf({ ...base, text: "  Gamme de soins du visage " }).text,
    ).toBe(t.correct.valueUnchanged);
    expect(
      problemOf({
        ...base,
        fieldCode: "key_messages",
        text: "Message un\nMessage deux",
      }).text,
    ).toBe(t.correct.valueUnchanged);
    expect(
      problemOf({ ...base, fieldCode: "product_is_sent", text: "yes" }).text,
    ).toBe(t.correct.valueUnchanged);
  });

  it("« Autre » demands the internal comment, which is bounded; the other reasons send it only when typed", () => {
    expect(problemOf({ ...base, reasonCode: "other" })).toEqual({
      field: "comment",
      text: t.actions.commentRequired,
    });
    expect(
      problemOf({ ...base, reasonCode: "other", comment: "x".repeat(1001) })
        .text,
    ).toBe(t.actions.commentTooLong);
    const withComment = correctionCheck(
      { ...base, reasonCode: "other", comment: " Demande orale de la marque " },
      f,
    );
    expect(withComment.ok && withComment.body.internalComment).toBe(
      "Demande orale de la marque",
    );
    const without = correctionCheck({ ...base, comment: "   " }, f);
    expect(without.ok && "internalComment" in without.body).toBe(false);
  });
});

describe("L3C-U9.7: the passages and the draft for a brand (09 RG1, RG8, RG9, CA61)", () => {
  it("a passage asks for a reason of the closed list, and a comment for « Autre »", () => {
    const none = passageCheck(EMPTY_PASSAGE);
    expect(!none.ok && none.problem.field).toBe("reason");
    const other = passageCheck({ reasonCode: "other", comment: "" });
    expect(!other.ok && other.problem.field).toBe("comment");
    expect(passageCheck({ reasonCode: "brand_request", comment: "" })).toEqual({
      ok: true,
      body: { reasonCode: "brand_request" },
    });
    expect(
      passageCheck({ reasonCode: "other", comment: " Doublon constaté " }),
    ).toEqual({
      ok: true,
      body: { reasonCode: "other", internalComment: "Doublon constaté" },
    });
  });

  it("the draft needs a title of 1 to 140 characters and one of the seven types, nothing else", () => {
    const bad = (title: string, type: string) => {
      const checked = creationCheck(ACCOUNT, title, type);
      return checked.ok ? null : checked.problem;
    };
    expect(bad("  ", "contest")).toEqual({
      field: "title",
      text: t.create.titleRequired,
    });
    expect(bad("x".repeat(141), "contest")?.text).toBe(t.create.titleTooLong);
    expect(bad("Un titre", "")).toEqual({
      field: "type",
      text: t.create.typeRequired,
    });
    expect(bad("Un titre", "other")?.field).toBe("type");
    expect(creationCheck(ACCOUNT, "  Un titre ", "contest")).toEqual({
      ok: true,
      body: {
        advertiserAccountId: ACCOUNT,
        title: "Un titre",
        campaignType: "contest",
      },
    });
  });
});

describe("L3C-U9.8: what the notices and the refusals say", () => {
  it("a correction under the agent's own claim says the version changed", () => {
    expect(correctedNotice(null)).toBe(t.correct.done);
    expect(correctedNotice("a".repeat(64))).toBe(t.correct.doneHeld);
  });

  it("each refusal of the acts of the record has its own sentence, and a conflict reads the record again", () => {
    const refusals = messages.claimedReview.refusals;
    const cases: [string, string][] = [
      ["campaign_not_pausable", refusals.campaignNotPausable],
      ["campaign_not_resumable", refusals.campaignNotResumable],
      ["campaign_not_closable", refusals.campaignNotClosable],
      ["campaign_not_correctable", refusals.campaignNotCorrectable],
      ["brand_not_active", refusals.brandNotActive],
      ["campaign_closed", refusals.campaignClosed],
      ["first_review_given", refusals.firstReviewGiven],
      ["claim_not_held", t.failures.claimNeeded],
      ["held_by_other", t.failures.claimNeeded],
    ];
    for (const [issue, text] of cases) {
      expect(text, issue).not.toBe("");
      expect(actFailureOf("conflict", [issue])).toEqual({
        text,
        readsAgain: true,
      });
    }
    // the five issues the contract already named and the screens had not worded
    for (const issue of [
      "campaign_not_pausable",
      "campaign_not_resumable",
      "campaign_not_closable",
      "campaign_not_correctable",
      "brand_not_active",
    ]) {
      expect(CAMPAIGN_DECISION_CONFLICT_ISSUES as readonly string[]).toContain(
        issue,
      );
    }
  });

  it("a value the database refused is told on the form, without reading the record again", () => {
    expect(actFailureOf("validation_failed", ["invalid_value"])).toEqual({
      text: t.failures.valueRefused,
      readsAgain: false,
    });
    expect(actFailureOf("validation_failed", ["unchanged"])?.text).toBe(
      t.failures.unchanged,
    );
    expect(actFailureOf("validation_failed", ["invalid_title"])?.text).toBe(
      t.failures.titleRefused,
    );
    expect(
      actFailureOf("validation_failed", ["invalid_campaign_type"])?.text,
    ).toBe(t.failures.typeRefused);
    expect(
      actFailureOf("validation_failed", ["invalid_internal_comment"])?.text,
    ).toBe(t.failures.commentRefused);
  });

  it("an account the agent holds is told so; anything else keeps the common sentence", () => {
    expect(actFailureOf("forbidden", ["conflict_of_interest"])?.text).toBe(
      messages.claimedReview.errors.conflictOfInterest,
    );
    expect(actFailureOf("forbidden", [])).toBeNull();
    expect(actFailureOf("conflict", ["something_new"])).toBeNull();
    expect(actFailureOf("rate_limited", [])).toBeNull();
    expect(actFailureOf(undefined, [])).toBeNull();
  });
});

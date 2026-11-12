// Queue 2, « profils créateur à valider », in words and in checks (docs/mvp/07 RG4 to RG10, RG16, RG93 to RG99;
// 15 RG27 C1 to C8; 17b §2.7 line 2; jalons/l2g/modele.md §1, §3 « 0244 »; L2G-15): pure functions of
// src/components/creator-queue-view.ts and creator-review-view.ts, without a browser. The database says who
// holds an entry, which version a decision binds and which reasons exist; these only word and gather: the
// filters and the words of a line, the facts of the profile as validated, the network lines (layer I, exact
// figures with their source), the revisions side by side, the alerts, the draft of a refusal and its checks.
import type {
  CreatorEntryRow,
  CreatorReviewedProfile,
  CreatorReviewReason,
  OpenCreatorEntryResponse,
} from "@influx/contracts/creator-queues";
import type { RelayResult } from "@influx/web-platform/relay-client";
import { describe, expect, it } from "vitest";
import { claimedRefusalOf } from "../src/components/claimed-entry-view";
import {
  alertNote,
  badgesWords,
  creatorOwnFilters,
  modifiedWords,
  networksWords,
} from "../src/components/creator-queue-view";
import {
  alertLine,
  basisPointsWords,
  closedLines,
  lineView,
  modifiedFieldsWords,
  profileFacts,
  profileTitle,
  publishCheck,
  publishedLines,
  reasonPreview,
  rejectCheck,
  rejectedLines,
  revisionRows,
  visualFacts,
  visualName,
} from "../src/components/creator-review-view";
import { EMPTY_DRAFT } from "../src/components/verification-decision-view";
import { messages } from "../src/messages/fr";

const TOKEN = "b".repeat(64);
const t = messages.creatorReview;
const VISUAL_1 = "11111111-1111-4111-8111-111111111111";
const VISUAL_2 = "22222222-2222-4222-8222-222222222222";

function profile(
  changes: Partial<CreatorReviewedProfile> = {},
): CreatorReviewedProfile {
  return {
    alias: "Créateur 4821",
    status: "pending_review",
    firstPublishedAt: null,
    completenessPercent: 92,
    headline: "Créatrice de tutoriels cuisine végétale",
    bio: "Je partage des recettes simples.\nChaque semaine, une vidéo.",
    primaryTopic: "food",
    residenceRegion: null,
    travelScope: "domestic",
    collaborationExperience: null,
    deliveryLead: "lt_7d",
    maxExclusivity: null,
    acceptsNonMonetary: true,
    availability: "lt_1m",
    lists: {
      secondaryTopics: ["health_wellness"],
      tones: [],
      publicationLanguages: ["fr", "en"],
      formats: ["instagram_reel"],
      usageRights: [{ code: "organic_social", inclusion: "included" }],
      refusedSectors: [],
    },
    lines: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        networkCode: "instagram",
        isPrimary: true,
        listed: true,
        handle: "cuisine_verte",
        pseudonym: null,
        profileUrl: "https://www.instagram.com/cuisine_verte",
        followers: 48123,
        postsLast30Days: 12,
        avgComments: 30,
        avgReach: null,
        engagementRateBp: 350,
        figuresSource: "agent_observed",
        figuresMeasuredAt: "2026-11-02T09:00:00.000Z",
        badge: "account_verified",
      },
    ],
    visuals: [
      {
        id: VISUAL_1,
        state: "approved",
        displayOrder: 1,
        caption: "Mon plat du jour",
        brandDeclared: true,
        replacesItemId: null,
        width: 1080,
        height: 1350,
        byteSize: 204_800,
        createdAt: "2026-11-01T10:00:00.000Z",
      },
      {
        id: VISUAL_2,
        state: "pending",
        displayOrder: null,
        caption: null,
        brandDeclared: false,
        replacesItemId: VISUAL_1,
        width: 1080,
        height: 1080,
        byteSize: 100,
        createdAt: "2026-11-03T10:00:00.000Z",
      },
    ],
    ...changes,
  };
}

const REASONS: CreatorReviewReason[] = [
  {
    code: "bio_insufficient",
    position: 2,
    requiresMemberMessage: false,
    message:
      "Votre bio ne permet pas à une marque de comprendre ce que vous faites.",
    nextStep: "fix",
    nextStepMessage:
      "Complétez votre bio, puis soumettez de nouveau votre profil.",
  },
  {
    code: "other",
    position: 10,
    requiresMemberMessage: true,
    message: "Nous ne pouvons pas publier votre profil en l’état.",
    nextStep: "contact",
    nextStepMessage: "Écrivez-nous pour en discuter.",
  },
];

function view(
  changes: Partial<OpenCreatorEntryResponse> = {},
): OpenCreatorEntryResponse {
  return {
    asOf: "2026-11-10T10:00:00.000Z",
    outcome: "claimed",
    reviewToken: TOKEN,
    entry: {
      id: "7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22",
      kind: "submission",
      state: "open",
      createdAt: "2026-11-10T08:00:00.000Z",
      slaDueAt: "2026-11-11T08:00:00.000Z",
      escalateAt: null,
      overdue: false,
      claim: {
        holder: null,
        claimedAt: null,
        claimExpiresAt: null,
        heldByCaller: true,
      },
      lastForcedRelease: null,
      decision: null,
    },
    account: {
      id: "44444444-4444-4444-8444-444444444444",
      countryCode: "FR",
      preferredLanguage: "fr",
      owner: null,
    },
    profile: profile(),
    revisions: [],
    alerts: [],
    reasons: REASONS,
    ...changes,
  };
}

function row(changes: Partial<CreatorEntryRow> = {}): CreatorEntryRow {
  return {
    id: "7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22",
    accountId: "44444444-4444-4444-8444-444444444444",
    kind: "submission",
    createdAt: "2026-11-10T08:00:00.000Z",
    slaDueAt: "2026-11-11T08:00:00.000Z",
    escalateAt: null,
    overdue: false,
    alias: "Créateur 4821",
    countryCode: "FR",
    networks: ["instagram", "tiktok"],
    badges: [{ networkCode: "instagram", level: "account_verified" }],
    completenessPercent: 92,
    modifiedFields: [],
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

describe("L2G-15 queue 2, the list: filters and words of a line (17b §2.7 line 2)", () => {
  it("offers the origin, the country, the network and the badge, each option a code the API accepts", () => {
    const filters = creatorOwnFilters();
    expect(filters.map((filter) => filter.key)).toEqual([
      "kind",
      "country",
      "network",
      "badge",
    ]);
    const byKey = (key: string) =>
      filters.find((filter) => filter.key === key)?.options ?? [];
    expect(byKey("kind").map((option) => option.value)).toEqual([
      "submission",
      "revision",
    ]);
    expect(byKey("badge").map((option) => option.value)).toEqual([
      "with",
      "without",
    ]);
    expect(byKey("network").map((option) => option.value)).toContain(
      "instagram",
    );
    for (const filter of filters) {
      expect(filter.label).not.toBe("");
      for (const option of filter.options) {
        expect(option.label).not.toBe("");
      }
    }
  });

  it("words the networks declared, the badges in force and the fields a revision changes, never a handle or a figure", () => {
    expect(networksWords(row())).toBe("Instagram, TikTok");
    expect(networksWords(row({ networks: [] }))).toBe(
      messages.creatorQueue.none,
    );
    expect(badgesWords(row())).toBe("Compte vérifié (Instagram)");
    expect(badgesWords(row({ badges: [] }))).toBe(messages.creatorQueue.none);
    expect(modifiedWords(row())).toBe(messages.creatorQueue.wholeProfile);
    expect(
      modifiedWords(row({ modifiedFields: ["headline", "network_handle"] })),
    ).toBe("Titre court, Pseudo");
  });

  it("writes the alerts of a row in a line of their own, and nothing when there is none (07 RG93)", () => {
    expect(alertNote(row())).toBeNull();
    expect(alertNote(row({ alerts: ["direct_contact"] }))).toBe(
      messages.queueList.alertLine(messages.creatorQueue.alerts.direct_contact),
    );
  });
});

describe("L2G-15 queue 2, the decision screen: the profile as validated and its lines (07 RG9, RG22, RG49)", () => {
  it("shows the title and the bio as moderated fields, so that a pending revision is marked beside them", () => {
    const facts = profileFacts(view());
    expect(facts.find((fact) => fact.key === "headline")?.field).toBe(
      "headline",
    );
    const bio = facts.find((fact) => fact.key === "bio");
    expect(bio?.field).toBe("bio");
    expect(bio?.multiline).toBe(true);
    expect(facts.filter((fact) => fact.field !== null)).toHaveLength(2);
  });

  it("titles block ① « Le profil soumis » on a first submission and « Le profil validé (version en ligne) » on a revision (L2GU-9)", () => {
    const first = view();
    expect(first.entry.kind).toBe("submission");
    expect(profileTitle(first)).toBe("Le profil soumis");
    const revision = view({ entry: { ...first.entry, kind: "revision" } });
    expect(profileTitle(revision)).toBe("Le profil validé (version en ligne)");
  });

  it("words an empty value as « non renseigné », a list as its codes, a right with its inclusion", () => {
    const facts = profileFacts(
      view({
        profile: profile({
          headline: null,
          primaryTopic: null,
          lists: {
            secondaryTopics: [],
            tones: [],
            publicationLanguages: ["fr", "en"],
            formats: ["instagram_reel", "ugc_video"],
            usageRights: [{ code: "paid_ads", inclusion: "optional" }],
            refusedSectors: [],
          },
        }),
      }),
    );
    const value = (key: string) =>
      facts.find((fact) => fact.key === key)?.value;
    expect(value("headline")).toBe(t.unset);
    expect(value("primaryTopic")).toBe(t.unset);
    expect(value("secondaryTopics")).toBe(t.none);
    expect(value("publicationLanguages")).toBe("français, anglais");
    expect(value("formats")).toBe("Instagram reel, Ugc video");
    expect(value("usageRights")).toBe("Paid ads (en option)");
    expect(value("acceptsNonMonetary")).toBe(t.yes);
    expect(value("travelScope")).toBe("Dans son pays");
    expect(value("deliveryLead")).toBe("Moins de 7 jours");
    expect(value("availability")).toBe("Disponible sous moins d’un mois");
  });

  it("carries no handle, address or figure in the facts of the profile: they belong to the marked block of the lines", () => {
    const text = JSON.stringify(profileFacts(view()));
    expect(text).not.toContain("cuisine_verte");
    expect(text).not.toContain("instagram.com");
    expect(text).not.toContain("48123");
    expect(text).not.toContain("48 123");
  });

  it("gives a line its exact figures, their source and their date, the engagement in percent, and the badge in force (RG49, RG50)", () => {
    const shown = lineView(view().profile.lines[0]!);
    expect(shown.title).toBe(`Instagram · ${t.lines.primary}`);
    const value = (key: string) =>
      shown.facts.find((fact) => fact.key === key)?.value;
    expect(value("handle")).toBe("cuisine_verte");
    expect(value("url")).toBe("https://www.instagram.com/cuisine_verte");
    // a non-breaking thin space groups the thousands in French
    expect(value("followers")?.replace(/\s/g, " ")).toBe("48 123");
    expect(value("engagement")).toBe("3,5 %");
    expect(value("source")).toBe(t.lines.sources.agent_observed);
    expect(value("badge")).toBe("Compte vérifié");
    expect(value("reach")).toBe(t.unset);
    expect(value("status")).toBe(t.lines.listed);
  });

  it("writes basis points as a percentage from their digits, without computing", () => {
    expect(basisPointsWords(350)).toBe("3,5");
    expect(basisPointsWords(1205)).toBe("12,05");
    expect(basisPointsWords(400)).toBe("4");
    expect(basisPointsWords(5)).toBe("0,05");
    expect(basisPointsWords(0)).toBe("0");
  });

  it("says in words that a line added to a published profile waits for its validation, and that a line has no badge", () => {
    const line = {
      ...view().profile.lines[0]!,
      isPrimary: false,
      listed: false,
      badge: null,
    };
    const shown = lineView(line);
    expect(shown.title).toBe("Instagram");
    expect(shown.facts.find((fact) => fact.key === "status")?.value).toBe(
      t.lines.unlisted,
    );
    expect(shown.facts.find((fact) => fact.key === "badge")?.value).toBe(
      t.lines.noBadge,
    );
  });

  it("numbers the visuals by their place, and says « en attente » for one that has none yet", () => {
    const { visuals } = view().profile;
    expect(visualName(visuals, VISUAL_1)).toBe("Visuel 1");
    expect(visualName(visuals, VISUAL_2)).toBe(t.visuals.unordered);
    const facts = visualFacts(visuals[0]!);
    expect(facts).toContain(t.visuals.states.approved);
    expect(facts).toContain("1080 × 1350 px");
    expect(facts).toContain("200 Ko");
    expect(facts).toContain(t.visuals.declared);
    expect(visualFacts(visuals[1]!)).toContain(t.visuals.replacement);
  });
});

describe("L2G-15 queue 2, the revisions side by side with the validated version (07 RG9, CA48)", () => {
  it("puts the validated value next to the proposed one for a text, a caption and a line added", () => {
    const rows = revisionRows(
      view({
        entry: { ...view().entry, kind: "revision" },
        revisions: [
          {
            id: "a1",
            field: "headline",
            rowKey: null,
            submittedAt: "2026-11-09T10:00:00.000Z",
            validated: { kind: "text", text: "Ancien titre" },
            proposed: { kind: "text", text: "Nouveau titre" },
          },
          {
            id: "a2",
            field: "portfolio_caption",
            rowKey: VISUAL_1,
            submittedAt: "2026-11-09T10:00:00.000Z",
            validated: {
              kind: "caption",
              caption: "Mon plat du jour",
              brandDeclared: false,
            },
            proposed: {
              kind: "caption",
              caption: "Plat de saison",
              brandDeclared: true,
            },
          },
          {
            id: "a3",
            field: "network_line",
            rowKey: "33333333-3333-4333-8333-333333333334",
            submittedAt: "2026-11-09T10:00:00.000Z",
            validated: null,
            proposed: { kind: "line", networkCode: "tiktok" },
          },
        ],
      }),
    );
    expect(rows.map((row) => row.label)).toEqual([
      "Titre court",
      "Légende d’un visuel (visuel 1)",
      "Réseau ajouté",
    ]);
    expect(rows[0]).toMatchObject({
      validated: "Ancien titre",
      proposed: "Nouveau titre",
    });
    expect(rows[1]?.validated).toBe(
      `Mon plat du jour — ${t.written.notDeclared}`,
    );
    expect(rows[1]?.proposed).toBe(`Plat de saison — ${t.written.declared}`);
    expect(rows[2]?.validated).toBe(t.written.noneListed);
    expect(rows[2]?.proposed).toBe("Réseau ajouté : TikTok");
  });

  it("sums the fields changed in one sentence, each once, and says nothing for a first submission", () => {
    const revision = (id: string, field: "bio" | "headline") => ({
      id,
      field,
      rowKey: null,
      submittedAt: "2026-11-09T10:00:00.000Z",
      validated: null,
      proposed: { kind: "text" as const, text: "x" },
    });
    expect(modifiedFieldsWords({ revisions: [] })).toBeNull();
    expect(
      modifiedFieldsWords({
        revisions: [
          revision("1", "bio"),
          revision("2", "headline"),
          revision("3", "bio"),
        ],
      }),
    ).toBe("Champs modifiés depuis la dernière validation : Bio, Titre court.");
  });
});

describe("L2G-15 queue 2, the alerts and a closed entry (07 RG93; 15 C8)", () => {
  it("names the field and the kind of signal, never the text; a caption names its visual", () => {
    const visuals = view().profile.visuals;
    expect(
      alertLine(
        {
          code: "direct_contact",
          field: "bio",
          rowKey: null,
          signals: ["email", "handle"],
        },
        visuals,
      ),
    ).toBe("Coordonnée possible dans « Bio » (adresse e-mail, pseudo).");
    expect(
      alertLine(
        {
          code: "direct_contact",
          field: "portfolio_caption",
          rowKey: VISUAL_1,
          signals: ["url"],
        },
        visuals,
      ),
    ).toBe("Coordonnée possible dans « légende du visuel 1 » (lien).");
  });

  it("says how a closed entry ended: the state, who, the reason in its label, and that it was late", () => {
    const lines = closedLines(
      view({
        entry: {
          ...view().entry,
          state: "rejected",
          decision: {
            decidedAt: "2026-11-11T09:00:00.000Z",
            decidedBy: { accountId: "z", displayName: "Alice" },
            late: true,
            rejectionReasonCode: "bio_insufficient",
            memberMessage: null,
            internalComment: null,
          },
        },
      }),
    );
    expect(lines[0]).toBe(t.closed.rejected);
    expect(lines[1]).toContain("Alice");
    expect(lines).toContain(t.closed.late);
    expect(lines).toContain(
      t.closed.reason("Bio trop courte ou incompréhensible"),
    );
    expect(
      closedLines(view({ entry: { ...view().entry, state: "published" } }))[0],
    ).toBe(t.closed.published);
  });
});

describe("L2G-15 queue 2, a decision is bound to the version read and to a reason of the closed list (07 RG5, RG10, RG96 to RG98)", () => {
  it("publishes with the token alone, and with the comment only when it holds something, within the bound", () => {
    expect(publishCheck(EMPTY_DRAFT, TOKEN)).toEqual({
      ok: true,
      body: { reviewToken: TOKEN },
    });
    expect(
      publishCheck({ ...EMPTY_DRAFT, internalComment: "  vu  " }, TOKEN),
    ).toEqual({
      ok: true,
      body: { reviewToken: TOKEN, internalComment: "vu" },
    });
    const long = publishCheck(
      { ...EMPTY_DRAFT, internalComment: "x".repeat(1001) },
      TOKEN,
    );
    expect(long).toEqual({
      ok: false,
      problem: { field: "internalComment", text: t.decision.commentTooLong },
    });
  });

  it("refuses nothing without a reason of the list the opening returned", () => {
    expect(rejectCheck(EMPTY_DRAFT, null, REASONS, TOKEN)).toEqual({
      ok: false,
      problem: { field: "reason", text: t.decision.reasonRequired },
    });
    expect(rejectCheck(EMPTY_DRAFT, "age_doubt", REASONS, TOKEN).ok).toBe(
      false,
    );
  });

  it("sends a reason that asks for no message without one, even when the agent typed one before changing his mind", () => {
    const checked = rejectCheck(
      { ...EMPTY_DRAFT, memberMessage: "texte resté dans le brouillon" },
      "bio_insufficient",
      REASONS,
      TOKEN,
    );
    expect(checked).toEqual({
      ok: true,
      body: { reviewToken: TOKEN, reasonCode: "bio_insufficient" },
    });
  });

  it("asks « Autre » for a message of 20 to 500 characters, trimmed, and keeps the internal comment apart", () => {
    const tooShort = rejectCheck(
      { ...EMPTY_DRAFT, memberMessage: "trop court" },
      "other",
      REASONS,
      TOKEN,
    );
    expect(tooShort).toEqual({
      ok: false,
      problem: { field: "memberMessage", text: t.decision.otherTooShort },
    });
    const tooLong = rejectCheck(
      { ...EMPTY_DRAFT, memberMessage: "x".repeat(501) },
      "other",
      REASONS,
      TOKEN,
    );
    expect(tooLong.ok).toBe(false);
    const message = "Votre profil ne correspond pas à nos critères actuels.";
    expect(
      rejectCheck(
        {
          ...EMPTY_DRAFT,
          memberMessage: `  ${message}  `,
          internalComment: "RAS",
        },
        "other",
        REASONS,
        TOKEN,
      ),
    ).toEqual({
      ok: true,
      body: {
        reviewToken: TOKEN,
        reasonCode: "other",
        internalComment: "RAS",
        memberMessage: message,
      },
    });
  });

  it("shows what the creator will read: the sentence of the reason, his agent's own text for « Autre », then the next step", () => {
    const bio = reasonPreview(REASONS[0]!, EMPTY_DRAFT);
    expect(bio.paragraphs).toEqual([REASONS[0]!.message]);
    expect(bio.nextStep).toBe(REASONS[0]!.nextStepMessage);
    const other = reasonPreview(REASONS[1]!, {
      memberMessage: "  Merci de nous écrire.  ",
    });
    expect(other.paragraphs).toEqual([
      REASONS[1]!.message,
      "Merci de nous écrire.",
    ]);
  });

  it("confirms a decision in a sentence above the next entry, and marks one taken after its deadline", () => {
    expect(publishedLines(view(), false)).toEqual([
      t.decision.publishedNotice("Créateur 4821"),
    ]);
    expect(publishedLines(view(), true)).toContain(t.decision.lateMark);
    expect(rejectedLines(view(), "bio_insufficient", false)).toEqual([
      t.decision.rejectedNotice(
        "Créateur 4821",
        "bio trop courte ou incompréhensible",
      ),
    ]);
    expect(rejectedLines(view(), "other", true)).toContain(t.decision.lateMark);
  });

  it("labels every reason of the closed list, in the order and with the words of 07 RG96", () => {
    const codes = [
      "identifier_in_text",
      "bio_insufficient",
      "portfolio_insufficient",
      "portfolio_non_compliant",
      "network_link_inconsistent",
      "figures_inconsistent",
      "topic_inconsistent",
      "illicit_content",
      "age_doubt",
      "other",
    ];
    expect(Object.keys(t.decision.reasonLabels)).toEqual(codes);
  });
});

describe("L2G-15 queue 2, what a refused call means", () => {
  it("reads the entry again on a lost claim or a stale version, as the other queues do", () => {
    for (const [issue, why] of [
      ["stale_token", "stale"],
      ["claim_lifted", "lifted"],
      ["claim_not_held", "notHeld"],
      ["entry_closed", "closed"],
      ["held_by_other", "heldByOther"],
    ] as const) {
      expect(claimedRefusalOf(failed("conflict", [issue]), "creator")).toEqual({
        kind: "reopen",
        why,
      });
    }
  });

  it("words the refusals of 0244 as a sentence and keeps the typed text: a profile out of state, a field missing, a handle under a badge", () => {
    const expected: Record<string, string> = {
      profile_state: messages.claimedReview.refusals.profileState,
      required_field_missing:
        messages.claimedReview.refusals.requiredFieldMissing,
      verified_handle: messages.claimedReview.refusals.verifiedHandle,
      not_replaceable: messages.claimedReview.refusals.notReplaceable,
    };
    for (const [issue, text] of Object.entries(expected)) {
      expect(text).not.toBe("");
      expect(claimedRefusalOf(failed("conflict", [issue]), "creator")).toEqual({
        kind: "text",
        text,
        field: null,
      });
    }
  });

  it("tells a direct contact of the message to the creator on its own field", () => {
    const refusal = claimedRefusalOf(
      failed("validation_failed", ["direct_contact"]),
      "creator",
    );
    expect(refusal.kind === "text" && refusal.field).toBe("memberMessage");
  });
});

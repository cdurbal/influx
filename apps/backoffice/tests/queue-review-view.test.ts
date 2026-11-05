// The decision screen of queue 1 in words, checks and keys (docs/mvp/06 RG6, RG9, RG19, RG65, RG66; 15
// RG27 C1 to C8, RG114 to RG116; 17b §2.4 to §2.6, §4.3; jalons/l2c/file.md A3, A6, A8, A9; L2C-17):
// pure functions of src/components/queue-review-view.ts and queue-review-facts.ts, without a browser.
// The server decides who holds the entry, which version a decision binds and which message is
// acceptable; these only word, check the bounds the contract holds, and say what a refusal means.
import type {
  OpenEntryResponse,
  ReviewReason,
} from "@influx/contracts/backoffice-queues";
import type { RelayResult } from "@influx/web-platform/relay-client";
import { describe, expect, it } from "vitest";
import {
  alertLine,
  changesBetween,
  humanCode,
  logoLine,
  profileFacts,
  revisionRows,
} from "../src/components/queue-review-facts";
import {
  chainNoticeFor,
  claimBanner,
  clockOffset,
  closedLines,
  decisionNotice,
  EMPTY_DRAFT,
  expiryOf,
  messagePreview,
  modeOf,
  openFailure,
  overdueBanner,
  publishCheck,
  refusalOf,
  rejectCheck,
  reviewShortcutOf,
  stashChainNotice,
  withClaimExpiry,
} from "../src/components/queue-review-view";
import { messages } from "../src/messages/fr";

const t = messages.queueReview;
const AS_OF = "2026-11-04T10:00:00.000Z";
const ME = "7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22";
const OTHER = "0a9b8c7d-1e2f-4a3b-8c4d-5e6f7a8b9c0d";
const TOKEN = "a".repeat(64);
const minutes = (count: number) =>
  new Date(Date.parse(AS_OF) + count * 60_000).toISOString();

const REASONS: ReviewReason[] = [
  {
    code: "presentation_insufficient",
    position: 2,
    requiresMemberMessage: false,
    message: "Votre présentation ne permet pas de comprendre votre activité.",
    nextStep: "Complétez-la.",
  },
  {
    code: "other",
    position: 8,
    requiresMemberMessage: true,
    message: "Le message de l’équipe INFLUX :",
    nextStep: "Corrigez.",
  },
];

function view(
  patch: {
    outcome?: OpenEntryResponse["outcome"];
    token?: string | null;
    state?: OpenEntryResponse["entry"]["state"];
    claim?: Partial<OpenEntryResponse["entry"]["claim"]>;
    overdue?: boolean;
    presentation?: string | null;
    revisions?: OpenEntryResponse["revisions"];
  } = {},
): OpenEntryResponse {
  return {
    asOf: AS_OF,
    outcome: patch.outcome ?? "claimed",
    reviewToken: patch.token === undefined ? TOKEN : patch.token,
    entry: {
      id: OTHER,
      kind: patch.revisions === undefined ? "submission" : "revision",
      state: patch.state ?? "open",
      createdAt: minutes(-480),
      slaDueAt: minutes(patch.overdue === true ? -192 : 120),
      escalateAt: null,
      overdue: patch.overdue === true,
      claim: {
        holder: { accountId: ME, displayName: "Lou" },
        claimedAt: minutes(-5),
        claimExpiresAt: minutes(25),
        heldByCaller: true,
        ...patch.claim,
      },
      lastForcedRelease: null,
      decision: null,
    },
    account: {
      id: ME,
      countryCode: "FR",
      preferredLanguage: "fr",
      owner: null,
    },
    profile: {
      status: "pending_review",
      submittedAt: AS_OF,
      firstPublishedAt: null,
      completenessPercent: 80,
      brandName: "Maison Test",
      primarySector: "sports_leisure",
      companySize: "11_50",
      websiteDomain: "maison.example",
      presentation:
        patch.presentation === undefined ? "Du matériel." : patch.presentation,
      exclusivityBand: null,
      collaborationRhythm: null,
      offersNonMonetary: null,
      contactRole: "marketing",
      lists: {
        secondarySectors: [],
        targetMarkets: ["FR", "BE"],
        workingLanguages: ["fr"],
        topics: ["fashion"],
        networks: ["instagram"],
        formats: [],
        audienceCountries: [],
        usageRights: [],
      },
      logos: {
        active: {
          id: ME,
          byteSize: 20_480,
          width: 400,
          height: 300,
          activatedAt: AS_OF,
        },
        inReview: null,
      },
      contact: { firstName: "Contact", email: null, phone: null, url: null },
    },
    revisions: patch.revisions ?? [],
    alerts: [],
    reasons: REASONS,
  };
}

type Failed = Exclude<RelayResult<unknown>, { kind: "ok" }>;
const failed = (code: string, issues: string[] = []): Failed => ({
  kind: "failed",
  code,
  issues,
});

describe("the mode and the banners (17b §2.4)", () => {
  it("decides when the claim is the caller's and a token came back", () => {
    expect(modeOf(view())).toBe("deciding");
    expect(modeOf(view({ outcome: "held" }))).toBe("deciding");
    expect(claimBanner(view())?.lines[0]).toMatch(
      /^Vous avez pris cette entrée en charge à /,
    );
  });

  it("reads, with the holder's name and one sentence, when a colleague holds it: information, not an error", () => {
    const read = view({
      outcome: "read_only",
      token: null,
      claim: {
        holder: { accountId: OTHER, displayName: "Marie" },
        heldByCaller: false,
      },
    });
    expect(modeOf(read)).toBe("readOnly");
    const banner = claimBanner(read);
    expect(banner?.tone).toBe("info");
    expect(banner?.lines[0]).toMatch(/^En cours — Marie, depuis /);
    expect(banner?.lines[1]).toBe(t.banner.readOnly);
  });

  it("never decides without a token, and a closed entry has no claim banner", () => {
    expect(modeOf(view({ token: null }))).toBe("readOnly");
    const closed = view({ outcome: "closed", token: null, state: "published" });
    expect(modeOf(closed)).toBe("closed");
    expect(claimBanner(closed)).toBeNull();
    expect(overdueBanner(closed)).toBeNull();
    expect(closedLines(closed)[0]).toBe(t.closed.published);
  });

  it("says the delay in words, from the instant of the database, and that a decision stays possible", () => {
    const banner = overdueBanner(view({ overdue: true }));
    expect(banner?.tone).toBe("alert");
    expect(banner?.lines[0]).toBe(t.banner.overdue("3 h 12"));
    expect(overdueBanner(view())).toBeNull();
  });
});

describe("the delay of the claim (15 C3, file.md A9)", () => {
  const offset = clockOffset(AS_OF, Date.parse(AS_OF) + 7_000);

  it("keeps the browser clock out of it: the offset corrects it", () => {
    expect(offset).toBe(-7_000);
  });

  it("reminds three minutes before it falls, then says it fell", () => {
    const at = (claimIn: number, clock = Date.parse(AS_OF) + 7_000) =>
      expiryOf(
        view({ claim: { claimExpiresAt: minutes(claimIn) } }),
        clock,
        offset,
      );
    expect(at(25)).toEqual({ kind: "ok" });
    expect(at(3)).toEqual({ kind: "soon", minutes: 3 });
    expect(at(2.5)).toEqual({ kind: "soon", minutes: 3 });
    expect(at(0.2)).toEqual({ kind: "soon", minutes: 1 });
    expect(at(-1)).toEqual({ kind: "expired" });
  });

  it("is silent for a colleague's claim and for an extension: the new expiry replaces the old", () => {
    const read = view({ outcome: "read_only", token: null });
    expect(expiryOf(read, Date.parse(AS_OF), 0)).toEqual({ kind: "none" });
    const extended = withClaimExpiry(
      view({ claim: { claimExpiresAt: minutes(2) } }),
      minutes(32),
    );
    expect(expiryOf(extended, Date.parse(AS_OF), 0)).toEqual({ kind: "ok" });
  });
});

describe("the refusal and its message (06 RG66, 15 C6, RG116)", () => {
  it("refuses a refusal without a reason of the list, with the sentence", () => {
    const none = rejectCheck(EMPTY_DRAFT, REASONS, TOKEN);
    expect(none).toEqual({
      ok: false,
      field: "reason",
      error: t.decision.reasonRequired,
    });
    const unknown = rejectCheck(
      { ...EMPTY_DRAFT, reasonCode: "illicit_content" },
      REASONS,
      TOKEN,
    );
    expect(unknown.ok).toBe(false);
  });

  it("sends the reason alone, with the version read, and the comment only when it holds something", () => {
    const draft = {
      ...EMPTY_DRAFT,
      reasonCode: "presentation_insufficient" as const,
    };
    expect(rejectCheck(draft, REASONS, TOKEN)).toEqual({
      ok: true,
      body: { reviewToken: TOKEN, reasonCode: "presentation_insufficient" },
    });
    expect(
      rejectCheck(
        {
          ...draft,
          internalComment: "  vu au téléphone  ",
          memberMessage: "ignoré par la base",
        },
        REASONS,
        TOKEN,
      ),
    ).toEqual({
      ok: true,
      body: {
        reviewToken: TOKEN,
        reasonCode: "presentation_insufficient",
        internalComment: "vu au téléphone",
      },
    });
  });

  it("asks the agent's own text for « Autre », 20 to 500 characters, trimmed", () => {
    const draft = { ...EMPTY_DRAFT, reasonCode: "other" as const };
    expect(rejectCheck(draft, REASONS, TOKEN)).toMatchObject({
      ok: false,
      field: "memberMessage",
      error: t.decision.otherTooShort,
    });
    expect(
      rejectCheck(
        { ...draft, memberMessage: `  ${"a".repeat(19)}  ` },
        REASONS,
        TOKEN,
      ),
    ).toMatchObject({ ok: false, field: "memberMessage" });
    expect(
      rejectCheck({ ...draft, memberMessage: "a".repeat(501) }, REASONS, TOKEN),
    ).toMatchObject({ ok: false, error: t.decision.otherTooLong });
    const sent = rejectCheck(
      { ...draft, memberMessage: ` ${"a".repeat(20)} ` },
      REASONS,
      TOKEN,
    );
    expect(sent).toMatchObject({
      ok: true,
      body: { reasonCode: "other", memberMessage: "a".repeat(20) },
    });
  });

  it("bounds the internal comment, for the publication too", () => {
    const long = { ...EMPTY_DRAFT, internalComment: "c".repeat(1001) };
    expect(publishCheck(long, TOKEN)).toMatchObject({
      ok: false,
      field: "internalComment",
    });
    expect(publishCheck(EMPTY_DRAFT, TOKEN)).toEqual({
      ok: true,
      body: { reviewToken: TOKEN },
    });
    expect(
      publishCheck({ ...EMPTY_DRAFT, internalComment: "ok" }, TOKEN),
    ).toEqual({
      ok: true,
      body: { reviewToken: TOKEN, internalComment: "ok" },
    });
  });

  it("shows what the brand will read: the sentence of the reason, the agent's text for « Autre », what to do", () => {
    const other = REASONS[1];
    if (other === undefined) throw new Error("fixture");
    expect(
      messagePreview(other, {
        ...EMPTY_DRAFT,
        reasonCode: "other",
        memberMessage: " Dites-nous ce que vous vendez. ",
      }),
    ).toEqual({
      paragraphs: [
        "Le message de l’équipe INFLUX :",
        "Dites-nous ce que vous vendez.",
      ],
      nextStep: "Corrigez.",
    });
    const plain = REASONS[0];
    if (plain === undefined) throw new Error("fixture");
    expect(
      messagePreview(plain, {
        ...EMPTY_DRAFT,
        memberMessage: "pas pour ce motif",
      }).paragraphs,
    ).toEqual([plain.message]);
  });
});

describe("what a refused call means (commit 12 routes)", () => {
  it("reads the entry again on a lost claim, a lifted claim, a stale version, a closed entry, a colleague's claim", () => {
    const cases: [string, string][] = [
      ["held_by_other", "heldByOther"],
      ["claim_lifted", "lifted"],
      ["claim_not_held", "notHeld"],
      ["stale_token", "stale"],
      ["entry_closed", "closed"],
      ["profile_state", "profileState"],
    ];
    for (const [issue, why] of cases) {
      expect(refusalOf(failed("conflict", [issue]))).toEqual({
        kind: "reopen",
        why,
      });
    }
  });

  it("finds the issue even when the holder's name rode along as another word", () => {
    expect(refusalOf(failed("conflict", ["held_by_other", "alice"]))).toEqual({
      kind: "reopen",
      why: "heldByOther",
    });
  });

  it("says a missing required field and a direct contact as sentences, the second on the message field", () => {
    expect(refusalOf(failed("conflict", ["required_field_missing"]))).toEqual({
      kind: "text",
      text: t.decision.requiredMissing,
      field: null,
    });
    expect(refusalOf(failed("validation_failed", ["direct_contact"]))).toEqual({
      kind: "text",
      text: t.decision.otherDirectContact,
      field: "memberMessage",
    });
    expect(
      refusalOf(failed("validation_failed", ["invalid_reason"])),
    ).toMatchObject({ field: "reason" });
  });

  it("names the conflict of interest, signs out on 401, and falls back to the common sentences", () => {
    expect(
      refusalOf(failed("forbidden", ["conflict_of_interest"])),
    ).toMatchObject({
      text: t.errors.conflictOfInterest,
    });
    expect(refusalOf({ kind: "unauthenticated" })).toEqual({
      kind: "signedOut",
    });
    expect(refusalOf(failed("internal_error"))).toEqual({
      kind: "text",
      text: messages.failure.unavailable,
      field: null,
    });
    expect(refusalOf({ kind: "failed" })).toMatchObject({ kind: "text" });
  });

  it("says why an entry could not be opened, with a retry for the failure only", () => {
    expect(openFailure(failed("not_found"))).toEqual({
      text: t.errors.notFound,
      retry: false,
    });
    expect(openFailure(failed("forbidden", ["conflict_of_interest"]))).toEqual({
      text: t.errors.conflictOfInterest,
      retry: false,
    });
    expect(openFailure(failed("forbidden"))).toEqual({
      text: t.errors.forbidden,
      retry: false,
    });
    expect(openFailure({ kind: "failed" })).toEqual({
      text: t.errors.unavailable,
      retry: true,
    });
    expect(openFailure({ kind: "unauthenticated" })).toBe("signedOut");
  });
});

describe("the keyboard (15 RG114, RG115, RG116)", () => {
  const key = (
    name: string,
    target: { tagName: string; isContentEditable: boolean } | null = null,
    extra = {},
  ) =>
    reviewShortcutOf({
      key: name,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      target,
      ...extra,
    });

  it("maps v, r, l and ? to the gestures that open a panel or give the entry back, never to a decision", () => {
    expect(key("v")).toBe("publish");
    expect(key("r")).toBe("reject");
    expect(key("l")).toBe("release");
    expect(key("?")).toBe("help");
    expect(key("x")).toBeNull();
  });

  it("leaves the letters to a field, but Échap works inside one: it closes the panel and loses nothing", () => {
    const field = { tagName: "TEXTAREA", isContentEditable: false };
    expect(key("r", field)).toBeNull();
    expect(key("Escape", field)).toBe("escape");
    expect(key("v", null, { ctrlKey: true })).toBeNull();
    expect(key("Escape", null, { ctrlKey: true })).toBeNull();
  });
});

describe("the exit (17b §2.6)", () => {
  it("writes what was decided, with the reason of a refusal and the mark of a late decision", () => {
    expect(decisionNotice("published", "Maison Test", null, false)).toEqual([
      t.decision.publishedNotice("Maison Test"),
    ]);
    const lines = decisionNotice(
      "rejected",
      "Maison Test",
      "duplicate_brand",
      true,
    );
    expect(lines[0]).toContain("doublon d’une marque déjà inscrite");
    expect(lines[1]).toBe(t.decision.lateMark);
  });

  it("keeps the confirmation for the next entry only, and lets it go", () => {
    stashChainNotice({ forEntry: ME, decidedEntry: OTHER, lines: ["ok"] });
    expect(chainNoticeFor(ME)?.decidedEntry).toBe(OTHER);
    expect(chainNoticeFor(OTHER)).toBeNull();
    stashChainNotice(null);
    expect(chainNoticeFor(ME)).toBeNull();
  });
});

describe("what the agent reads (06 RG9, RG19; L2BS-1)", () => {
  it("words a code of a reference list and the characteristics of a logo, never its bytes", () => {
    expect(humanCode("sports_leisure")).toBe("Sports leisure");
    expect(
      logoLine({
        byteSize: 20_480,
        width: 400,
        height: 300,
        activatedAt: null,
      }),
    ).toBe("400 × 300 px · 20 Ko");
    expect(
      logoLine({
        byteSize: null,
        width: null,
        height: null,
        activatedAt: null,
      }),
    ).toBe("caractéristiques indisponibles");
  });

  it("writes the profile as validated: countries by name, a band without a headcount, the unset said", () => {
    const facts = new Map(
      profileFacts(view({ presentation: null })).map((f) => [f.key, f.value]),
    );
    expect(facts.get("targetMarkets")).toBe("France, Belgique");
    expect(facts.get("companySize")).toBe("11 à 50 personnes");
    expect(facts.get("presentation")).toBe(t.unset);
    expect(facts.get("formats")).toBe(t.none);
    expect(facts.get("brandName")).toBe("Maison Test");
  });

  it("puts the validated value next to the proposed one, a removal and a logo said as such", () => {
    const rows = revisionRows([
      {
        id: ME,
        fieldCode: "advertiser.presentation",
        submittedAt: AS_OF,
        validated: { kind: "text", text: "Avant" },
        proposed: { kind: "text", text: "Après" },
      },
      {
        id: OTHER,
        fieldCode: "advertiser.website_domain",
        submittedAt: AS_OF,
        validated: { kind: "text", text: "a.example" },
        proposed: { kind: "text", text: null },
      },
      {
        id: "11111111-1111-4111-8111-111111111111",
        fieldCode: "advertiser.logo",
        submittedAt: AS_OF,
        validated: { kind: "logo", logoObjectId: ME },
        proposed: { kind: "logo", logoObjectId: OTHER },
      },
    ]);
    expect(rows[0]).toMatchObject({
      validated: "Avant",
      proposed: "Après",
      multiline: true,
    });
    expect(rows[1]?.proposed).toBe(t.written.removed);
    expect(rows[2]).toMatchObject({
      validated: t.written.logoCurrent,
      proposed: t.written.logoNew,
    });
  });

  it("words the alerts by field and kind, never by the text found", () => {
    expect(
      alertLine({
        code: "direct_contact",
        field: "advertiser.presentation",
        signals: ["email", "phone"],
      }),
    ).toBe(
      "Coordonnée possible dans « Présentation » (adresse e-mail, numéro de téléphone).",
    );
    expect(
      alertLine({
        code: "duplicate_brand",
        matches: [{ accountId: ME, brandName: "Maison Test" }],
      }),
    ).toContain("Maison Test");
    expect(
      alertLine({
        code: "unusual_website_domain",
        field: "advertiser.website_domain",
      }),
    ).toBe(t.alerts.unusual_website_domain);
  });

  it("tells what changed between two readings, and nothing when nothing did (modifié après examen)", () => {
    const before = view();
    expect(changesBetween(before, view()).labels).toEqual([]);
    const after = changesBetween(
      before,
      view({ presentation: "Un tout autre texte." }),
    );
    expect(after.labels).toEqual([t.facts.presentation]);
    expect(after.keys.has("presentation")).toBe(true);
    expect(after.keys.has("brandName")).toBe(false);
  });
});

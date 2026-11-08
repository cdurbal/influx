// The decision screen of a creator's verification request in words, checks and keys (docs/mvp/08 RG25, RG36
// to RG38bis, RG41, RG42, RG43 to RG59, CA13, CA14, CA25 to CA33; 17b §3.7; jalons/l2e/modele.md §4, §5, -19;
// L2E-22): pure functions of src/components/verification-decision-view.ts, without a browser. The
// database says who holds the request, which version a decision binds, whether a period or a code is
// acceptable and where the gap alert stands; these only word, gather what the agent TYPED (nothing is
// ever pre-filled) and say what a refusal means.
import {
  BRAND_REJECTION_REASON_CODES,
  CREATOR_REJECTION_REASON_CODES,
  VERIFICATION_REEXAMINE_REASON_CODES,
  verificationOpenResponseSchema,
  type CompareFiguresResponse,
  type VerificationOpenResponse,
  type VerificationReasonRow,
} from "@influx/contracts/verification";
import type { RelayResult } from "@influx/web-platform/relay-client";
import { describe, expect, it } from "vitest";
import { stashChainNotice } from "../src/components/queue-review-view";
import {
  accountGrantCheck,
  audienceGrantCheck,
  closedLines,
  compareCheck,
  comparisonRows,
  EMPTY_DRAFT,
  expiryOf,
  figuresKeyOf,
  grantedNotice,
  isDecisionBlocked,
  messagePreview,
  modeOf,
  openFailure,
  parseCount,
  parsePercentAsBasisPoints,
  profileLinkOf,
  reexamineCheck,
  reexaminedNotice,
  refusalOf,
  releaseStepOf,
  rejectCheck,
  rejectedNotice,
  stopsEverything,
  type Draft,
} from "../src/components/verification-decision-view";
import { messages } from "../src/messages/fr";

const t = messages.verificationReview;
const AS_OF = "2026-11-08T10:00:00.000Z";
const ME = "7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22";
const TOKEN = "b".repeat(64);
const REQUEST = "11111111-2222-4333-8444-555555555555";
const minutes = (count: number) =>
  new Date(Date.parse(AS_OF) + count * 60_000).toISOString();

function viewOf(
  changes: {
    outcome?: VerificationOpenResponse["outcome"];
    status?: VerificationOpenResponse["entry"]["status"];
    level?: VerificationOpenResponse["entry"]["level"];
    token?: string | null;
    claimExpiresAt?: string | null;
  } = {},
): VerificationOpenResponse {
  const outcome = changes.outcome ?? "claimed";
  return verificationOpenResponseSchema.parse({
    asOf: AS_OF,
    outcome,
    reviewToken: "token" in changes ? changes.token : TOKEN,
    entry: {
      id: REQUEST,
      level: changes.level ?? "audience_verified",
      networkCode: "instagram",
      status: changes.status ?? "pending",
      submittedAt: minutes(-90),
      slaDueAt: minutes(120),
      escalateAt: minutes(600),
      overdue: false,
      claim: {
        holder: { accountId: ME, displayName: "Lou" },
        claimedAt: minutes(-2),
        claimExpiresAt:
          "claimExpiresAt" in changes ? changes.claimExpiresAt : minutes(28),
        heldByCaller: true,
      },
      lastForcedRelease: null,
      reexamine: null,
      decision: null,
    },
    account: {
      id: ME,
      countryCode: "BE",
      preferredLanguage: "fr",
      owner: null,
    },
    dossier: null,
    reasons: [],
  });
}

const REASONS: VerificationReasonRow[] = [
  {
    code: "evidence_unreadable",
    position: 1,
    requiresMemberMessage: false,
    escalatesToAdmin: false,
    purgesEvidence: false,
    message: "La pièce déposée est illisible ou incomplète.",
    nextStep: "Vous pouvez déposer une nouvelle capture.",
  },
  {
    code: "minor",
    position: 2,
    requiresMemberMessage: false,
    escalatesToAdmin: true,
    purgesEvidence: false,
    message: "INFLUX est réservé aux personnes majeures.",
    nextStep: null,
  },
  {
    code: "other",
    position: 3,
    requiresMemberMessage: true,
    escalatesToAdmin: false,
    purgesEvidence: false,
    message: "Votre demande n’a pas pu aboutir.",
    nextStep: null,
  },
];

const TYPED: Draft = {
  ...EMPTY_DRAFT,
  handle: " camille_cuisine ",
  followers: "47 300",
  posts: "12",
  comments: "85",
  periodStart: "2026-10-08",
  periodEnd: "2026-11-06",
};

type Failed = Exclude<RelayResult<unknown>, { kind: "ok" }>;
const failed = (code: string, issues: string[] = []): Failed =>
  ({
    kind: "failed",
    code,
    issues,
  }) as Failed;

describe("L2E-22: the three modes of the screen and the claim (08 RG43, RG64)", () => {
  it("decides only with the claim and its token, reads when a colleague holds it, and is closed once left the queue", () => {
    expect(modeOf(viewOf())).toBe("deciding");
    expect(modeOf(viewOf({ outcome: "held" }))).toBe("deciding");
    expect(modeOf(viewOf({ outcome: "read_only", token: null }))).toBe(
      "readOnly",
    );
    expect(modeOf(viewOf({ token: null }))).toBe("readOnly");
    expect(modeOf(viewOf({ status: "approved", token: null }))).toBe("closed");
    expect(modeOf(viewOf({ outcome: "closed", token: null }))).toBe("closed");
  });

  it("reminds three minutes before the claim falls and says so when it fell, only while the request is decided here", () => {
    const offset = 0;
    const at = Date.parse(AS_OF);
    expect(expiryOf(viewOf(), at, offset)).toEqual({ kind: "ok" });
    expect(
      expiryOf(viewOf({ claimExpiresAt: minutes(2) }), at, offset),
    ).toEqual({ kind: "soon", minutes: 2 });
    expect(
      expiryOf(viewOf({ claimExpiresAt: minutes(-1) }), at, offset),
    ).toEqual({ kind: "expired" });
    expect(
      expiryOf(viewOf({ outcome: "read_only", token: null }), at, offset),
    ).toEqual({ kind: "none" });
  });
});

describe("L2E-22: nothing is pre-filled, everything the agent typed is checked by the bounds the contract holds (CA25, RG25, RG38, RG38bis)", () => {
  it("starts with every field empty, and carries no declared figure in what the opening sends", () => {
    expect(EMPTY_DRAFT).toEqual({
      handle: "",
      code: "",
      domain: "",
      channel: null,
      registrySourceId: null,
      followers: "",
      periodStart: "",
      periodEnd: "",
      posts: "",
      comments: "",
      engagement: "",
      internalComment: "",
      reasonCode: null,
      memberMessage: "",
      stopConfirmed: false,
      reexamineCode: null,
    });
    const dossier = {
      codeExpiresAt: null,
      creator: { handle: "h", pseudonym: "p", profileUrl: null },
      brand: null,
      evidence: [],
      history: [],
      badges: [],
      alerts: [],
      declared: { followers: 86_000 },
    };
    expect(
      verificationOpenResponseSchema.safeParse({ ...viewOf(), dossier })
        .success,
    ).toBe(false);
  });

  it("reads a count as digits only, spaces of a thousands separator allowed, never a sign nor a decimal; zero is a figure", () => {
    expect(parseCount("47 300")).toBe(47_300);
    expect(parseCount("0")).toBe(0);
    expect(parseCount(" 12 ")).toBe(12);
    for (const refused of ["", "-3", "1.5", "1,5", "12k", "1e3", "abc"]) {
      expect(parseCount(refused)).toBe(null);
    }
  });

  it("reads a percentage as basis points, 0 to 100, two decimals at most", () => {
    expect(parsePercentAsBasisPoints("8")).toBe(800);
    expect(parsePercentAsBasisPoints("12,5")).toBe(1250);
    expect(parsePercentAsBasisPoints("12.34")).toBe(1234);
    expect(parsePercentAsBasisPoints("100")).toBe(10_000);
    expect(parsePercentAsBasisPoints("0")).toBe(0);
    for (const refused of ["", "100,01", "101", "-1", "1.234", "abc"]) {
      expect(parsePercentAsBasisPoints(refused)).toBe(null);
    }
  });

  it("checks the account grant: the handle, then the code in its shape; the code is sent as typed and never compared here (CA13, CA14)", () => {
    expect(accountGrantCheck(EMPTY_DRAFT, TOKEN)).toEqual({
      ok: false,
      problem: { field: "handle", text: t.problems.handle },
    });
    const noCode = { ...EMPTY_DRAFT, handle: "camille" };
    expect(accountGrantCheck(noCode, TOKEN)).toEqual({
      ok: false,
      problem: { field: "code", text: t.problems.code },
    });
    expect(
      accountGrantCheck({ ...noCode, code: "INFLUX-0O1IL2AB" }, TOKEN),
    ).toEqual({
      ok: false,
      problem: { field: "code", text: t.problems.codeShape },
    });
    expect(
      accountGrantCheck(
        {
          ...noCode,
          code: " INFLUX-K7M2QX9A ",
          internalComment: "  profil public lu  ",
        },
        TOKEN,
      ),
    ).toEqual({
      ok: true,
      body: {
        reviewToken: TOKEN,
        observedCode: "INFLUX-K7M2QX9A",
        observedHandle: "camille",
        internalComment: "profil public lu",
      },
    });
  });

  it("checks the audience grant in the order of D61, the period, and leaves the engagement facultative (RG36 to RG38bis)", () => {
    expect(audienceGrantCheck(EMPTY_DRAFT, TOKEN)).toMatchObject({
      ok: false,
      problem: { field: "handle" },
    });
    const field = (changes: Partial<Draft>) =>
      audienceGrantCheck({ ...TYPED, ...changes }, TOKEN);
    expect(field({ followers: "" })).toMatchObject({
      problem: { field: "followers" },
    });
    expect(field({ posts: "-1" })).toMatchObject({
      problem: { field: "posts" },
    });
    expect(field({ comments: "" })).toMatchObject({
      problem: { field: "comments" },
    });
    expect(field({ engagement: "101" })).toMatchObject({
      problem: { field: "engagement" },
    });
    expect(field({ periodStart: "" })).toMatchObject({
      problem: { field: "period", text: t.problems.period },
    });
    expect(field({ periodStart: "2026-11-07" })).toMatchObject({
      problem: { field: "period", text: t.problems.periodOrder },
    });
    expect(field({})).toEqual({
      ok: true,
      body: {
        reviewToken: TOKEN,
        followers: 47_300,
        postsLast30Days: 12,
        avgComments: 85,
        engagementBp: null,
        periodStart: "2026-10-08",
        periodEnd: "2026-11-06",
        observedHandle: "camille_cuisine",
      },
    });
    expect(field({ engagement: "4,25", comments: "0" })).toMatchObject({
      ok: true,
      body: { engagementBp: 425, avgComments: 0 },
    });
    expect(field({ internalComment: "x".repeat(1001) })).toMatchObject({
      problem: { field: "internalComment" },
    });
  });

  it("sends the figures alone to the comparison, and tells a comparison made on other figures by their key (modele -19)", () => {
    expect(compareCheck(TYPED, TOKEN)).toEqual({
      ok: true,
      body: {
        reviewToken: TOKEN,
        followers: 47_300,
        postsLast30Days: 12,
        avgComments: 85,
        engagementBp: null,
      },
    });
    expect(figuresKeyOf(TYPED)).toBe(figuresKeyOf({ ...TYPED, handle: "x" }));
    expect(figuresKeyOf(TYPED)).not.toBe(
      figuresKeyOf({ ...TYPED, followers: "47 301" }),
    );
  });

  it("shows the gap as a subtraction, observed minus declared, and what is not declared or not typed in words", () => {
    const result: CompareFiguresResponse = {
      declared: {
        followers: 50_000,
        postsLast30Days: 12,
        avgComments: null,
        engagementBp: 500,
      },
      gapAlertPercent: 30,
      alert: false,
    };
    const rows = comparisonRows(
      {
        followers: 47_300,
        postsLast30Days: 12,
        avgComments: 85,
        engagementBp: 450,
      },
      result,
    );
    expect(rows.map((row) => [row.key, row.gap])).toEqual([
      ["followers", "−2 700"],
      ["postsLast30Days", t.comparison.noGap],
      ["avgComments", t.comparison.notDeclared],
      ["engagementBp", "−0,5 pt"],
    ]);
    expect(rows[2]?.declared).toBe(t.comparison.notDeclared);
    const open = comparisonRows(
      { followers: 1, postsLast30Days: 0, avgComments: 0, engagementBp: null },
      result,
    );
    expect(open[3]).toMatchObject({
      observed: t.comparison.notTyped,
      gap: t.comparison.notTyped,
    });
  });
});

describe("L2E-22: the refusal, the reason and the message the creator will read (08 RG56 to RG59)", () => {
  it("never refuses without a reason of the list the opening returned, and asks the stop of `minor` to be confirmed", () => {
    expect(rejectCheck(EMPTY_DRAFT, REASONS, TOKEN)).toEqual({
      ok: false,
      problem: { field: "reason", text: t.decision.reasonRequired },
    });
    expect(
      rejectCheck(
        { ...EMPTY_DRAFT, reasonCode: "terms_breach" },
        REASONS,
        TOKEN,
      ),
    ).toMatchObject({ problem: { field: "reason" } });
    const minor = { ...EMPTY_DRAFT, reasonCode: "minor" as const };
    expect(stopsEverything(REASONS[1] as VerificationReasonRow)).toBe(true);
    expect(rejectCheck(minor, REASONS, TOKEN)).toEqual({
      ok: false,
      problem: { field: "stop", text: t.decision.stopRequired },
    });
    expect(
      rejectCheck({ ...minor, stopConfirmed: true }, REASONS, TOKEN),
    ).toEqual({
      ok: true,
      body: { reviewToken: TOKEN, reasonCode: "minor" },
    });
  });

  it("sends the agent's own text for the reasons that ask for it only, 20 to 500 characters, and drops it for the others", () => {
    const base = { ...EMPTY_DRAFT, memberMessage: "x".repeat(40) };
    expect(
      rejectCheck(
        { ...base, reasonCode: "evidence_unreadable" },
        REASONS,
        TOKEN,
      ),
    ).toEqual({
      ok: true,
      body: { reviewToken: TOKEN, reasonCode: "evidence_unreadable" },
    });
    const other = { ...base, reasonCode: "other" as const };
    expect(
      rejectCheck({ ...other, memberMessage: " court " }, REASONS, TOKEN),
    ).toMatchObject({
      problem: { field: "memberMessage", text: t.decision.messageTooShort },
    });
    expect(
      rejectCheck({ ...other, memberMessage: "x".repeat(501) }, REASONS, TOKEN),
    ).toMatchObject({ problem: { text: t.decision.messageTooLong } });
    expect(
      rejectCheck({ ...other, internalComment: " vu " }, REASONS, TOKEN),
    ).toEqual({
      ok: true,
      body: {
        reviewToken: TOKEN,
        reasonCode: "other",
        internalComment: "vu",
        memberMessage: "x".repeat(40),
      },
    });
  });

  it("writes under the reason the very sentence of the e-mail, then the agent's own text, then what the creator can do", () => {
    const [unreadable, , other] = REASONS as [
      VerificationReasonRow,
      VerificationReasonRow,
      VerificationReasonRow,
    ];
    expect(messagePreview(unreadable, EMPTY_DRAFT)).toEqual({
      paragraphs: [unreadable.message],
      nextStep: unreadable.nextStep,
    });
    expect(
      messagePreview(other, { ...EMPTY_DRAFT, memberMessage: " Bonjour. " }),
    ).toEqual({
      paragraphs: [other.message, "Bonjour."],
      nextStep: t.decision.nextStepNone,
    });
    // a text typed then a reason that has no use for it: what is written is only the sentence
    expect(
      messagePreview(unreadable, { ...EMPTY_DRAFT, memberMessage: "Bonjour" })
        .paragraphs,
    ).toEqual([unreadable.message]);
  });

  it("holds a reason apart only from the internal list for « à réexaminer », and sends it with the token and nothing else", () => {
    expect(reexamineCheck(EMPTY_DRAFT, TOKEN)).toEqual({
      ok: false,
      problem: { field: "reexamine", text: t.decision.reexamineRequired },
    });
    expect(
      reexamineCheck(
        {
          ...EMPTY_DRAFT,
          reexamineCode: "storage_unavailable",
          internalComment: "non",
        },
        TOKEN,
      ),
    ).toEqual({
      ok: true,
      body: { reviewToken: TOKEN, reasonCode: "storage_unavailable" },
    });
  });

  it("labels every reason of the closed lists, creator and brand, and every internal one", () => {
    for (const code of [
      ...CREATOR_REJECTION_REASON_CODES,
      ...BRAND_REJECTION_REASON_CODES,
    ]) {
      expect(t.decision.reasonLabels[code], code).toBeTruthy();
    }
    for (const code of VERIFICATION_REEXAMINE_REASON_CODES) {
      expect(t.decision.reexamineReasons[code], code).toBeTruthy();
    }
  });
});

describe("L2E-22: what a refused call means, and what stays (08 RG116, RG64)", () => {
  it("reads the request again, with the reason in a sentence, when the claim or the version or the request is gone", () => {
    for (const [issue, why] of [
      ["held_by_other", "heldByOther"],
      ["claim_lifted", "lifted"],
      ["claim_not_held", "notHeld"],
      ["stale_token", "stale"],
      ["entry_closed", "closed"],
    ] as const) {
      expect(refusalOf(failed("conflict", [issue]))).toEqual({
        kind: "reopen",
        why,
      });
    }
  });

  it("puts a refusal of the typed text under its field, and of the account or the evidence in a sentence", () => {
    expect(refusalOf(failed("validation_failed", ["code_mismatch"]))).toEqual({
      kind: "text",
      text: t.problems.codeMismatch,
      field: "code",
    });
    expect(refusalOf(failed("validation_failed", ["period_future"]))).toEqual({
      kind: "text",
      text: t.problems.periodRefused,
      field: "period",
    });
    expect(
      refusalOf(failed("validation_failed", ["direct_contact"])),
    ).toMatchObject({ field: "memberMessage" });
    expect(refusalOf(failed("conflict", ["ownership_prerequisite"]))).toEqual({
      kind: "text",
      text: t.problems.prerequisite,
      field: null,
    });
    expect(refusalOf(failed("conflict", ["account_unavailable"]))).toEqual({
      kind: "text",
      text: t.notices.accountUnavailable,
      field: null,
    });
    expect(refusalOf({ kind: "unauthenticated" } as Failed)).toEqual({
      kind: "signedOut",
    });
  });

  it("says a conflict of interest in clear, on an opening and on a decision (L2E-14: 403 `conflict_of_interest`)", () => {
    const refused = failed("forbidden", ["conflict_of_interest"]);
    expect(openFailure(refused)).toEqual({
      text: t.errors.conflictOfInterest,
      retry: false,
    });
    expect(refusalOf(refused)).toMatchObject({
      text: t.errors.conflictOfInterest,
    });
    expect(openFailure(failed("not_found"))).toEqual({
      text: t.errors.notFound,
      retry: false,
    });
    expect(openFailure(failed("internal_error"))).toEqual({
      text: t.errors.unavailable,
      retry: true,
    });
  });

  it("tells a Storage that does not answer apart from a failed piece: only `decision_blocked` blocks the decision (D82 (5))", () => {
    expect(
      isDecisionBlocked(failed("service_unavailable", ["decision_blocked"])),
    ).toBe(true);
    expect(isDecisionBlocked(failed("service_unavailable"))).toBe(false);
    expect(isDecisionBlocked(failed("not_found"))).toBe(false);
  });
});

describe("L2E-22: the profile link and the exit of a decision (L2DS-1; 17b §2.6)", () => {
  it("makes a link of a profile address only when it is https with a plain authority (the shape of 0220), else the identifier stays text", () => {
    expect(profileLinkOf("https://www.instagram.com/camille")).toBe(
      "https://www.instagram.com/camille",
    );
    expect(profileLinkOf("https://example.com:8443/a")).toBe(
      "https://example.com:8443/a",
    );
    for (const refused of [
      null,
      "",
      "http://www.instagram.com/camille",
      "javascript:alert(1)",
      "https://user@evil.example/",
      "https://evil.example\\@www.instagram.com/",
      "https://www.instagram.com%5C@evil.example/",
      "https://[::1]/",
      "//www.instagram.com/camille",
    ]) {
      expect(profileLinkOf(refused), String(refused)).toBe(null);
    }
  });

  it("confirms in a sentence what was decided: a grant, a second constat of one handle, a refusal, a closure, a mark; late and escalated said", () => {
    const view = viewOf();
    expect(grantedNotice(view, "granted", false)).toEqual([
      t.decision.grantedNotice("Audience vérifiée", "Instagram"),
    ]);
    expect(grantedNotice(view, "handle_already_verified", true)).toEqual([
      t.decision.alreadyVerified,
      t.decision.lateMark,
    ]);
    expect(rejectedNotice(view, "minor", "rejected", true, true)).toEqual([
      t.decision.refusedNotice("Instagram", "créateur mineur"),
      t.decision.escalatedMark,
      t.decision.lateMark,
    ]);
    expect(
      rejectedNotice(view, "account_unavailable", "closed", false, false),
    ).toEqual([
      t.decision.closedNotice(
        "Instagram",
        "compte suspendu ou en cours de suppression",
      ),
    ]);
    expect(reexaminedNotice(view)).toEqual([
      t.decision.reexaminedNotice("Instagram"),
    ]);
    stashChainNotice(null);
  });

  it("writes how a closed request ended, by whom, and whether late", () => {
    const view = viewOf({ status: "rejected", token: null, outcome: "closed" });
    const closed: VerificationOpenResponse = {
      ...view,
      entry: {
        ...view.entry,
        decision: {
          decidedAt: AS_OF,
          decidedBy: { accountId: ME, displayName: "Lou" },
          late: true,
          status: "rejected",
          reasonCode: "evidence_unreadable",
          memberMessage: null,
          internalComment: null,
        },
      },
    };
    const lines = closedLines(closed);
    expect(lines[0]).toBe(t.closed.rejected);
    expect(lines.join(" ")).toContain("Lou");
    expect(lines).toContain(t.closed.late);
    expect(lines).toContain(
      t.closed.reason("Pièce illisible, rognée ou incomplète"),
    );
  });
});

describe("giving the request back with work typed on the screen (L2EU-7)", () => {
  it("gives it back at once when nothing was typed, and asks first as soon as one field holds something", () => {
    expect(releaseStepOf(EMPTY_DRAFT)).toBe("release");
    const typed: Partial<Draft>[] = [
      { handle: "camille_cuisine" },
      { code: "INFLUX-" },
      { followers: "47300" },
      { internalComment: "x" },
      { channel: "dns_txt" },
      { registrySourceId: "11111111-2222-4333-8444-555555555555" },
      { stopConfirmed: true },
    ];
    for (const change of typed) {
      expect(
        releaseStepOf({ ...EMPTY_DRAFT, ...change }),
        JSON.stringify(change),
      ).toBe("confirm");
    }
  });

  it("words the panel, with a way to keep the request that loses nothing", () => {
    expect(t.release.keep).toBe("Garder la demande");
    expect(t.release.lead).toMatch(/perdu/);
    expect(t.shortcuts.release).toMatch(/confirmation/);
  });
});

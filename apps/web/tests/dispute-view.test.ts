// What the screens of a creator's contests show (docs/mvp/08 RG10, RG19, RG73, RG77, CA52, CA53;
// jalons/l2f/modele.md §1 points 5, 7 to 9, l2f/textes.md; commit 17): the decisions a row offers to
// contest, what a withdrawal says (INFLUX's apologies for its own error), the body of a contest and what a
// refused call means, the outcome sentence, and the translation files against the annex, mot pour mot, in
// both languages. Pure functions and files, no browser.
import {
  CREATOR_REJECTION_REASON_CODES,
  DISPUTE_OUTCOME_REASON_CODES,
  DISPUTE_REASON_CODES,
  REVOCATION_REASON_CODES,
  type ContestableDecision,
  type CreatorVerificationLine,
  type OwnDispute,
  type OwnDisputesResponse,
} from "@influx/contracts/verification";
import { describe, expect, it } from "vitest";
import {
  APPEAL_REASONS,
  EMPTY_APPEAL_DRAFT,
  appealBodyOf,
  appealFailureOf,
  appealProblemOf,
  appealReasonRequiresText,
  contestableOfTarget,
  contestablesOfRow,
  disputeOfTarget,
  isDisputeOpen,
  latestDisputeOfRow,
  outcomeViewOf,
  revocationViewOf,
  targetOfDecision,
} from "@/components/verification/dispute-view";
import enVerification from "@/locales/en/verification.json";
import frVerification from "@/locales/fr/verification.json";

const REQUEST_ID = "5c1f0a3e-8a47-4c0b-9b53-0e2b9a1d7f10";
const BADGE_ID = "0d6c1b9e-3f7a-4c52-9a1e-6b2f8d4c7e10";
const OTHER_ID = "a3b7c9d1-2e4f-4a6b-8c0d-1e2f3a4b5c6d";

function refusal(
  extra: Partial<Extract<ContestableDecision, { kind: "refusal" }>> = {},
): ContestableDecision {
  return {
    kind: "refusal",
    requestId: REQUEST_ID,
    level: "account_verified",
    networkCode: "instagram",
    reasonCode: "ownership_not_proven",
    decidedAt: "2026-11-01T09:00:00Z",
    closesAt: "2026-12-01T09:00:00Z",
    ...extra,
  };
}

function revocation(
  extra: Partial<Extract<ContestableDecision, { kind: "revocation" }>> = {},
): ContestableDecision {
  return {
    kind: "revocation",
    badgeId: BADGE_ID,
    level: "audience_verified",
    networkCode: "instagram",
    reasonCode: "influx_error",
    memberMessage: null,
    decidedAt: "2026-11-02T09:00:00Z",
    closesAt: "2026-12-02T09:00:00Z",
    ...extra,
  };
}

function dispute(extra: Partial<OwnDispute> = {}): OwnDispute {
  return {
    id: OTHER_ID,
    requestId: REQUEST_ID,
    badgeId: null,
    level: "account_verified",
    networkCode: "instagram",
    reasonCode: "misread",
    text: null,
    submittedAt: "2026-11-03T09:00:00Z",
    state: "open",
    outcome: null,
    ...extra,
  };
}

function answer(
  contestable: ContestableDecision[],
  disputes: OwnDispute[] = [],
): OwnDisputesResponse {
  return {
    asOf: "2026-11-05T09:00:00Z",
    windowDays: 30,
    contestable,
    disputes,
  };
}

describe("the decisions a row offers to contest (08 RG77, CA52)", () => {
  it("keeps the decisions of the network and the level of the row, and none when the contests could not be read", () => {
    const disputes = answer([
      refusal(),
      revocation(),
      revocation({ badgeId: OTHER_ID, networkCode: "tiktok" }),
    ]);
    expect(
      contestablesOfRow(disputes, "instagram", "account_verified").map(
        (decision) => decision.kind,
      ),
    ).toEqual(["refusal"]);
    expect(
      contestablesOfRow(disputes, "instagram", "audience_verified").map(
        (decision) => decision.kind,
      ),
    ).toEqual(["revocation"]);
    expect(contestablesOfRow(disputes, "tiktok", "account_verified")).toEqual(
      [],
    );
    expect(contestablesOfRow(null, "instagram", "account_verified")).toEqual(
      [],
    );
  });

  it("names the decision by its own identifier, a refusal by its request and a withdrawal by its badge", () => {
    expect(targetOfDecision(refusal())).toEqual({
      kind: "refusal",
      requestId: REQUEST_ID,
    });
    expect(targetOfDecision(revocation())).toEqual({
      kind: "revocation",
      badgeId: BADGE_ID,
    });
    const disputes = answer([refusal(), revocation()]);
    expect(
      contestableOfTarget(disputes, { kind: "refusal", requestId: REQUEST_ID })
        ?.kind,
    ).toBe("refusal");
    expect(
      contestableOfTarget(disputes, { kind: "revocation", badgeId: BADGE_ID })
        ?.kind,
    ).toBe("revocation");
    // a decision that is not his, or an unknown one, is none (T14)
    expect(
      contestableOfTarget(disputes, { kind: "refusal", requestId: OTHER_ID }),
    ).toBeNull();
    // a request's identifier is never read as a badge's
    expect(
      contestableOfTarget(disputes, {
        kind: "revocation",
        badgeId: REQUEST_ID,
      }),
    ).toBeNull();
  });

  it("finds the contest of a decision, and the latest contest of a row", () => {
    const first = dispute({ id: "11111111-1111-4111-8111-111111111111" });
    const second = dispute({
      id: "22222222-2222-4222-8222-222222222222",
      requestId: null,
      badgeId: BADGE_ID,
      level: "audience_verified",
      submittedAt: "2026-11-04T09:00:00Z",
    });
    const third = dispute({
      id: "33333333-3333-4333-8333-333333333333",
      requestId: null,
      badgeId: OTHER_ID,
      level: "audience_verified",
      submittedAt: "2026-11-09T09:00:00Z",
    });
    const disputes = answer([], [first, second, third]);
    expect(
      disputeOfTarget(disputes, { kind: "refusal", requestId: REQUEST_ID }),
    ).toBe(first);
    expect(
      disputeOfTarget(disputes, { kind: "revocation", badgeId: BADGE_ID }),
    ).toBe(second);
    expect(
      disputeOfTarget(disputes, { kind: "refusal", requestId: OTHER_ID }),
    ).toBeNull();
    expect(latestDisputeOfRow(disputes, "instagram", "audience_verified")).toBe(
      third,
    );
    expect(latestDisputeOfRow(disputes, "instagram", "account_verified")).toBe(
      first,
    );
    expect(
      latestDisputeOfRow(disputes, "tiktok", "account_verified"),
    ).toBeNull();
    expect(
      latestDisputeOfRow(null, "instagram", "account_verified"),
    ).toBeNull();
    expect(isDisputeOpen(first)).toBe(true);
    expect(isDisputeOpen(dispute({ state: "withdrawn" }))).toBe(false);
  });
});

describe("what a withdrawal says (08 RG73, l2f/textes.md « Retrait »)", () => {
  it("reads the reason of the closed list, and the agent's own message only when the API gave one", () => {
    const bare = revocationViewOf(
      revocation() as Extract<ContestableDecision, { kind: "revocation" }>,
    );
    expect(bare).toEqual({ reason: "influx_error", message: null });
    const worded = revocationViewOf(
      revocation({
        reasonCode: "terms_breach",
        memberMessage: "Votre profil a été signalé pour des propos répétés.",
      }) as Extract<ContestableDecision, { kind: "revocation" }>,
    );
    expect(worded.reason).toBe("terms_breach");
    expect(worded.message).toBe(
      "Votre profil a été signalé pour des propos répétés.",
    );
    // blank is no message
    expect(
      revocationViewOf(
        revocation({ memberMessage: "   " }) as Extract<
          ContestableDecision,
          { kind: "revocation" }
        >,
      ).message,
    ).toBeNull();
  });

  it("writes every reason of the list in both languages, INFLUX's apologies for its own error and no accusation (RG73)", () => {
    for (const texts of [frVerification, enVerification]) {
      expect(Object.keys(texts.revocation.reason)).toEqual([
        ...REVOCATION_REASON_CODES,
      ]);
    }
    expect(frVerification.revocation.reason.influx_error).toBe(
      "INFLUX a accordé ce badge par erreur. Vous n'y êtes pour rien et nous vous présentons nos excuses.",
    );
    expect(enVerification.revocation.reason.influx_error).toBe(
      "INFLUX granted this badge by mistake. You are not at fault, and we apologise.",
    );
    expect(frVerification.revocation.reason.forged_evidence).toBe(
      "Une pièce ou une information fournie pour cette vérification s'est révélée inexacte.",
    );
    expect(enVerification.revocation.reason.terms_breach).toBe(
      "Your profile does not comply with the INFLUX terms of use.",
    );
  });
});

describe("the body of a contest (08 RG19, RG77, l2f/modele.md §1 point 7)", () => {
  it("offers the four reasons of the closed list, in the order of the table, and asks for his words with « autre » only", () => {
    expect([...APPEAL_REASONS]).toEqual([...DISPUTE_REASON_CODES]);
    expect(APPEAL_REASONS.filter(appealReasonRequiresText)).toEqual(["other"]);
    expect(appealProblemOf(EMPTY_APPEAL_DRAFT)).toBe("reason");
    expect(appealProblemOf({ reasonCode: "misread", text: "" })).toBeNull();
    expect(appealProblemOf({ reasonCode: "other", text: "   " })).toBe("text");
    expect(
      appealProblemOf({ reasonCode: "other", text: "Mon compte" }),
    ).toBeNull();
  });

  it("names the decision by its identifier, trims his words and leaves them out when empty", () => {
    expect(
      appealBodyOf(
        { kind: "refusal", requestId: REQUEST_ID },
        { reasonCode: "misread", text: "  " },
      ),
    ).toEqual({ requestId: REQUEST_ID, reasonCode: "misread" });
    expect(
      appealBodyOf(
        { kind: "revocation", badgeId: BADGE_ID },
        { reasonCode: "other", text: "  La pièce était lisible.  " },
      ),
    ).toEqual({
      badgeId: BADGE_ID,
      reasonCode: "other",
      text: "La pièce était lisible.",
    });
    expect(
      appealBodyOf(
        { kind: "refusal", requestId: REQUEST_ID },
        EMPTY_APPEAL_DRAFT,
      ),
    ).toBeNull();
    expect(
      appealBodyOf(
        { kind: "refusal", requestId: REQUEST_ID },
        { reasonCode: "other", text: "" },
      ),
    ).toBeNull();
  });
});

describe("what a refused contest means (0232, RG19)", () => {
  const failed = (code: string, ...issues: string[]) =>
    ({ kind: "failed", code, issues }) as const;

  it("tells the three refusals of the door apart, and reads the decision again after each", () => {
    expect(appealFailureOf(failed("conflict", "already_disputed"))).toEqual({
      key: "alreadyDisputed",
      reload: true,
    });
    expect(
      appealFailureOf(failed("conflict", "dispute_window_closed")),
    ).toEqual({ key: "windowClosed", reload: true });
    expect(appealFailureOf(failed("conflict", "not_disputable"))).toEqual({
      key: "notDisputable",
      reload: true,
    });
    expect(appealFailureOf(failed("not_found"))).toEqual({
      key: "gone",
      reload: true,
    });
  });

  it("says a contact in the text is refused, without echoing it, and keeps the screen as it is", () => {
    expect(
      appealFailureOf(failed("validation_failed", "direct_contact")),
    ).toEqual({ key: "directContact", reload: false });
    expect(
      appealFailureOf(failed("validation_failed", "text_required")).key,
    ).toBe("textRequired");
    expect(
      appealFailureOf(failed("validation_failed", "invalid_text")).key,
    ).toBe("invalidText");
    expect(
      appealFailureOf(failed("validation_failed", "invalid_reason")).key,
    ).toBe("invalidReason");
  });

  it("reads any other failure as the service not answering", () => {
    expect(appealFailureOf({ kind: "failed" })).toEqual({
      key: "unavailable",
      reload: false,
    });
    expect(appealFailureOf(failed("internal_error"))).toEqual({
      key: "unavailable",
      reload: false,
    });
  });

  it("writes each of them in both languages", () => {
    for (const texts of [frVerification, enVerification]) {
      for (const key of [
        "notDisputable",
        "alreadyDisputed",
        "windowClosed",
        "gone",
        "directContact",
        "textRequired",
        "invalidText",
        "invalidReason",
        "unavailable",
      ] as const) {
        expect(texts.appeal.failure[key].length, key).toBeGreaterThan(10);
      }
    }
  });
});

function lineWithRefusal(): CreatorVerificationLine {
  return {
    networkCode: "instagram",
    badges: [],
    requests: [
      {
        id: REQUEST_ID,
        level: "account_verified",
        status: "rejected",
        networkCode: "instagram",
        createdAt: "2026-10-30T09:00:00Z",
        submittedAt: "2026-10-30T09:05:00Z",
        code: null,
        evidence: [],
        refusal: {
          reasonCode: "evidence_unreadable",
          message: "",
          decidedAt: "2026-11-01T09:00:00Z",
        },
      },
    ],
  };
}

describe("the outcome of a contest (08 RG77, CA53, l2f/textes.md « Issue »)", () => {
  const decided = (
    state: "upheld" | "overturned",
    reasonCode: (typeof DISPUTE_OUTCOME_REASON_CODES)[number],
    memberMessage: string | null = null,
    extra: Partial<OwnDispute> = {},
  ) =>
    dispute({
      state,
      outcome: {
        result: state,
        reasonCode,
        memberMessage,
        decidedAt: "2026-11-06T09:00:00Z",
      },
      ...extra,
    });

  it("says nothing while the contest waits, and the badge given back with its new date when it is overturned", () => {
    expect(outcomeViewOf(dispute(), [])).toBeNull();
    expect(
      outcomeViewOf(decided("overturned", "decision_overturned"), []),
    ).toEqual({
      key: "decision_overturned",
      level: "account_verified",
      decidedAt: "2026-11-06T09:00:00Z",
    });
  });

  it("names the initial reason of a refusal still held by the lines, and says the decision stands without it for a withdrawal (EC-L2F-17-1)", () => {
    expect(
      outcomeViewOf(decided("upheld", "decision_confirmed"), [
        lineWithRefusal(),
      ]),
    ).toEqual({ key: "decision_confirmed", reason: "evidence_unreadable" });
    expect(
      outcomeViewOf(
        decided("upheld", "decision_confirmed", null, {
          requestId: null,
          badgeId: BADGE_ID,
        }),
        [lineWithRefusal()],
      ),
    ).toEqual({ key: "decision_confirmedBare" });
    expect(outcomeViewOf(decided("upheld", "decision_confirmed"), [])).toEqual({
      key: "decision_confirmedBare",
    });
  });

  it("points at a new request, or carries the team's own message for « autre »", () => {
    expect(outcomeViewOf(decided("upheld", "new_request_needed"), [])).toEqual({
      key: "new_request_needed",
    });
    expect(
      outcomeViewOf(
        decided(
          "upheld",
          "other",
          "Nous gardons cette décision pour ce motif.",
        ),
        [],
      ),
    ).toEqual({
      key: "other",
      message: "Nous gardons cette décision pour ce motif.",
    });
  });

  it("holds every sentence of the annex mot pour mot in French and in English, and a key per outcome code", () => {
    for (const texts of [frVerification, enVerification]) {
      for (const code of DISPUTE_OUTCOME_REASON_CODES) {
        expect(texts.appeal.outcome).toHaveProperty(code);
      }
    }
    const fr = frVerification.appeal;
    const en = enVerification.appeal;
    expect(fr.outcome.decision_confirmed).toBe(
      "Après réexamen, la décision est maintenue pour son motif initial : {reason}",
    );
    expect(en.outcome.decision_confirmed).toBe(
      "After review, the decision stands for its original reason: {reason}",
    );
    expect(fr.outcome.new_request_needed).toBe(
      "Après réexamen, votre contestation ne peut aboutir en l'état : vous pouvez déposer une nouvelle demande depuis votre espace INFLUX.",
    );
    expect(en.outcome.new_request_needed).toBe(
      "After review, your appeal cannot succeed as it stands: you can submit a new request from your INFLUX space.",
    );
    expect(fr.outcome.other).toBe(
      "Après réexamen, la décision est maintenue. Le message de l'équipe INFLUX :",
    );
    expect(en.outcome.other).toBe(
      "After review, the decision stands. The message from the INFLUX team:",
    );
    expect(fr.outcome.decision_overturned).toBe(
      "Après réexamen, INFLUX revient sur sa décision et vous présente ses excuses : votre badge « {badge} » est accordé à la date du {date}.",
    );
    expect(en.outcome.decision_overturned).toBe(
      'After review, INFLUX reverses its decision and apologises: your "{badge}" badge is granted as of {date}.',
    );
    expect(fr.sent.received).toBe(
      "Nous avons bien reçu votre contestation concernant le badge « {badge} ». Nous la réexaminons et vous écrivons dès qu'elle est tranchée.",
    );
    expect(en.sent.received).toBe(
      'We have received your appeal about the "{badge}" badge. We are reviewing it and will write to you once it is decided.',
    );
  });

  it("writes the four reasons of the contest as the annex does, in both languages", () => {
    for (const texts of [frVerification, enVerification]) {
      expect(Object.keys(texts.appeal.reason)).toEqual([
        ...DISPUTE_REASON_CODES,
      ]);
    }
    expect(frVerification.appeal.reason).toEqual({
      misread: "Ma pièce ou mon profil a été mal lu",
      evidence_valid: "Ma pièce respectait les consignes",
      reason_wrong: "Le motif ne correspond pas à ma situation",
      other: "Autre raison (à préciser)",
    });
    expect(enVerification.appeal.reason).toEqual({
      misread: "My evidence or profile was misread",
      evidence_valid: "My evidence met the instructions",
      reason_wrong: "The reason does not fit my situation",
      other: "Another reason (please explain)",
    });
  });

  it("writes the window in days from the setting, one day in the singular, and every creator refusal reason is still written for the outcome", () => {
    expect(frVerification.appeal.window).toContain("{days, plural,");
    expect(enVerification.appeal.window).toContain("{days, plural,");
    for (const code of CREATOR_REJECTION_REASON_CODES) {
      expect(frVerification.refusal.reason).toHaveProperty(code);
    }
  });
});

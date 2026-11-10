// The decisions of queues 5 and 6 (docs/mvp/08 RG77, RG78, CA52 to CA54; 15 RG27 C6; jalons/l2f, commit
// 19): pure functions of src/components/dispute-decision-view.ts and identifier-decision-view.ts. What the
// agent types is checked and gathered, never pre-filled (CA25); what an overturn sends depends on what was
// contested; the handle is typed again at every overturn (0228). The database decides the rest.
import type {
  DisputeOpenResponse,
  DisputeOutcomeReasonRow,
} from "@influx/contracts/verification";
import { describe, expect, it } from "vitest";
import {
  overturnCheck,
  overturnTargetOf,
  upholdCheck,
  upholdReasonsOf,
} from "../src/components/dispute-decision-view";
import {
  confirmCheck,
  proofCheck,
} from "../src/components/identifier-decision-view";
import {
  EMPTY_DRAFT,
  type Draft,
} from "../src/components/verification-decision-view";

const TOKEN = "b".repeat(64);

const REASONS: DisputeOutcomeReasonRow[] = [
  {
    code: "decision_confirmed",
    outcome: "upheld",
    position: 1,
    requiresMemberMessage: false,
    message: "Après réexamen, la décision est maintenue.",
  },
  {
    code: "other",
    outcome: "upheld",
    position: 3,
    requiresMemberMessage: true,
    message: "Après réexamen, la décision est maintenue. Le message :",
  },
  {
    code: "decision_overturned",
    outcome: "overturned",
    position: 4,
    requiresMemberMessage: false,
    message: "Après réexamen, INFLUX revient sur sa décision.",
  },
];

function draft(changes: Partial<Draft>): Draft {
  return { ...EMPTY_DRAFT, ...changes };
}

function viewOf(
  kind: "refusal" | "revocation",
  level: "account_verified" | "audience_verified",
  served = true,
): DisputeOpenResponse {
  return {
    entry: { kind, level },
    dossier: served ? { kind } : null,
    outcomeReasons: REASONS,
  } as unknown as DisputeOpenResponse;
}

describe("L2F-19 queue 5: what is contested decides what an overturn types", () => {
  it("names the target by the kind and the level, and none before the dossier is served", () => {
    expect(overturnTargetOf(viewOf("refusal", "account_verified"))).toBe(
      "refusal_account",
    );
    expect(overturnTargetOf(viewOf("refusal", "audience_verified"))).toBe(
      "refusal_audience",
    );
    expect(overturnTargetOf(viewOf("revocation", "account_verified"))).toBe(
      "revocation",
    );
    expect(
      overturnTargetOf(viewOf("refusal", "account_verified", false)),
    ).toBeNull();
  });

  it("sends the handle alone for a withdrawal, the code and the handle for an account, the figures for an audience", () => {
    expect(overturnCheck("revocation", draft({}), TOKEN)).toMatchObject({
      ok: false,
      problem: { field: "handle" },
    });
    expect(
      overturnCheck("revocation", draft({ handle: " noa_tiktok " }), TOKEN),
    ).toEqual({
      ok: true,
      body: {
        target: "revocation",
        reviewToken: TOKEN,
        observedHandle: "noa_tiktok",
      },
    });
    expect(
      overturnCheck("refusal_account", draft({ handle: "noa" }), TOKEN),
    ).toMatchObject({ ok: false, problem: { field: "code" } });
    expect(
      overturnCheck(
        "refusal_account",
        draft({
          handle: "noa",
          code: "INFLUX-ABCDEFGH",
          internalComment: "ok",
        }),
        TOKEN,
      ),
    ).toEqual({
      ok: true,
      body: {
        target: "refusal_account",
        reviewToken: TOKEN,
        observedCode: "INFLUX-ABCDEFGH",
        observedHandle: "noa",
        internalComment: "ok",
      },
    });
    const audience = overturnCheck(
      "refusal_audience",
      draft({
        handle: "noa",
        followers: "47 300",
        posts: "12",
        comments: "85",
        periodStart: "2026-10-01",
        periodEnd: "2026-10-30",
      }),
      TOKEN,
    );
    expect(audience.ok && audience.body).toMatchObject({
      target: "refusal_audience",
      followers: 47300,
      postsLast30Days: 12,
      avgComments: 85,
      periodStart: "2026-10-01",
      periodEnd: "2026-10-30",
      observedHandle: "noa",
    });
    expect(
      overturnCheck("refusal_audience", draft({ handle: "noa" }), TOKEN),
    ).toMatchObject({ ok: false, problem: { field: "followers" } });
  });
});

describe("L2F-19 queue 5: confirming a decision with a motive of the closed list", () => {
  it("offers the upheld motives only, and asks for one", () => {
    expect(
      upholdReasonsOf(viewOf("refusal", "account_verified")).map((r) => r.code),
    ).toEqual(["decision_confirmed", "other"]);
    const reasons = upholdReasonsOf(viewOf("refusal", "account_verified"));
    expect(upholdCheck(draft({}), null, reasons, TOKEN)).toMatchObject({
      ok: false,
      problem: { field: "reason" },
    });
    // a motive of the overturned ones is not an upheld motive
    expect(
      upholdCheck(draft({}), "decision_overturned", reasons, TOKEN).ok,
    ).toBe(false);
  });

  it("sends the team's text for the motive that requires it only, 20 to 500 characters", () => {
    const reasons = upholdReasonsOf(viewOf("refusal", "account_verified"));
    expect(
      upholdCheck(draft({}), "decision_confirmed", reasons, TOKEN),
    ).toEqual({
      ok: true,
      body: { reviewToken: TOKEN, outcomeReasonCode: "decision_confirmed" },
    });
    // typed text for a motive that takes none is not sent (the API would refuse it)
    expect(
      upholdCheck(
        draft({ memberMessage: "Un texte qui ne part pas." }),
        "decision_confirmed",
        reasons,
        TOKEN,
      ),
    ).toEqual({
      ok: true,
      body: { reviewToken: TOKEN, outcomeReasonCode: "decision_confirmed" },
    });
    expect(
      upholdCheck(
        draft({ memberMessage: "trop court" }),
        "other",
        reasons,
        TOKEN,
      ),
    ).toMatchObject({ ok: false, problem: { field: "memberMessage" } });
    expect(
      upholdCheck(
        draft({ memberMessage: "x".repeat(501) }),
        "other",
        reasons,
        TOKEN,
      ),
    ).toMatchObject({ ok: false, problem: { field: "memberMessage" } });
    expect(
      upholdCheck(
        draft({ memberMessage: "Votre pièce ne montre pas le profil." }),
        "other",
        reasons,
        TOKEN,
      ),
    ).toEqual({
      ok: true,
      body: {
        reviewToken: TOKEN,
        outcomeReasonCode: "other",
        memberMessage: "Votre pièce ne montre pas le profil.",
      },
    });
  });
});

describe("L2F-19 queue 6: the same account, or a new proof", () => {
  it("types the handle read for « même compte », and nothing for a new proof", () => {
    expect(confirmCheck(draft({}), TOKEN)).toMatchObject({
      ok: false,
      problem: { field: "handle" },
    });
    expect(confirmCheck(draft({ handle: "noa_new" }), TOKEN)).toEqual({
      ok: true,
      body: { reviewToken: TOKEN, observedHandle: "noa_new" },
    });
    expect(proofCheck(draft({ handle: "ignored" }), TOKEN)).toEqual({
      ok: true,
      body: { reviewToken: TOKEN },
    });
    expect(
      proofCheck(draft({ internalComment: "x".repeat(1001) }), TOKEN),
    ).toMatchObject({ ok: false, problem: { field: "internalComment" } });
  });
});

// The refusals of queues 5 and 6 and of the member's contest, as the API answers them (docs/mvp/08 RG77,
// RG78; jalons/l2f/modele.md §3 "0232", "0233"; l2f commit 14). The database says each refusal by its
// SQLSTATE, MESSAGE and DETAIL; these cases walk the ones no database test can reach without a team of one
// person or a clock (the reflection delay, the decider while another person exists), and the closed list
// of the codes the contract names.
import { VERIFICATION_REFUSAL_ISSUES } from "@influx/contracts/verification";
import { describe, expect, it } from "vitest";
import { agentRefusalOf } from "../src/domains/backoffice/verification-queues/refusals.ts";
import { disputeRefusalOf } from "../src/domains/verification/disputes.ts";
import { disputeOutcomePreview } from "../src/domains/verification/badge-notice-email.ts";
import { ApiError, RequestValidationError } from "../src/platform/errors.ts";

/** A database error as drizzle wraps it: the driver error is its `cause`. */
function sqlError(code: string, message: string, detail?: string): Error {
  const driver = Object.assign(new Error(message), {
    code,
    ...(detail === undefined ? {} : { detail }),
  });
  return new Error("Failed query", { cause: driver });
}

const NO_TRANSACTION = undefined as never;

async function agentAnswer(error: unknown): Promise<unknown> {
  return agentRefusalOf(NO_TRANSACTION, error, "entry", "caller");
}

describe("L2F-14: the codes of queues 5 and 6 (0232, 0233)", () => {
  it("answers every 55000 the contests and the identifier changes say on the path `entry`, as a 409", async () => {
    for (const issue of [
      "reviewer_is_decider",
      "restore_expired",
      "line_deleted",
      "handle_already_verified",
      "badge_not_holding",
      "ownership_prerequisite",
      "entry_closed",
      "stale_token",
      "missing_evidence",
    ]) {
      expect(VERIFICATION_REFUSAL_ISSUES as readonly string[], issue).toContain(
        issue,
      );
      const answered = await agentAnswer(sqlError("55000", issue, issue));
      expect(answered, issue).toBeInstanceOf(ApiError);
      expect((answered as ApiError).details, issue).toEqual([
        { path: "entry", issue },
      ]);
    }
  });

  it("serves the seconds left of the reflection delay beside the issue, and never a DETAIL it does not know", async () => {
    const waiting = (await agentAnswer(
      sqlError("55000", "reflection_delay", "3600"),
    )) as ApiError;
    expect(waiting.details).toEqual([
      { path: "entry", issue: "reflection_delay" },
      { path: "entry.reflectionSeconds", issue: "3600" },
    ]);
    // an unknown DETAIL is an internal error, never a made-up issue
    const unknown = sqlError("55000", "whatever", "something_else");
    expect(await agentAnswer(unknown)).toBe(unknown);
    // 42501 is the answer of an unknown address
    const forbidden = await agentAnswer(sqlError("42501", "forbidden"));
    expect(forbidden).toBeInstanceOf(ApiError);
    expect((forbidden as ApiError).code).toBe("not_found");
  });

  it("maps the mismatch of the handle typed (0228) to its field and an issue of its own", async () => {
    const answered = await agentAnswer(
      sqlError("22023", "observed_handle_mismatch", "observed_handle_mismatch"),
    );
    expect(answered).toBeInstanceOf(RequestValidationError);
    expect((answered as RequestValidationError).issues).toEqual([
      { path: "observedHandle", issue: "invalid_observed_handle_mismatch" },
    ]);
  });
});

describe("L2F-14: the refusals of the creator's contest (0232 submit_own_dispute)", () => {
  it("carries the closing instant of the window with the code, and the two other issues, as a 409", () => {
    const closed = disputeRefusalOf(
      sqlError("55000", "dispute_window_closed", "2026-12-01T10:00:00Z"),
    ) as ApiError;
    expect(closed.details).toEqual([
      { path: "dispute", issue: "dispute_window_closed" },
      { path: "dispute.closesAt", issue: "2026-12-01T10:00:00Z" },
    ]);
    for (const issue of ["not_disputable", "already_disputed"]) {
      const answered = disputeRefusalOf(
        sqlError("55000", issue, issue),
      ) as ApiError;
      expect(answered.details, issue).toEqual([{ path: "dispute", issue }]);
    }
  });

  it("answers an unknown, foreign or non-creator decision as an address that does not exist, and a bad reason or text as a 400", () => {
    const forbidden = disputeRefusalOf(
      sqlError("42501", "forbidden"),
    ) as ApiError;
    expect(forbidden.code).toBe("not_found");
    const reason = disputeRefusalOf(
      sqlError("22023", "reason", "reason"),
    ) as RequestValidationError;
    expect(reason.issues).toEqual([
      { path: "reasonCode", issue: "invalid_reason" },
    ]);
    const text = disputeRefusalOf(
      sqlError("22023", "text", "text"),
    ) as RequestValidationError;
    expect(text.issues).toEqual([{ path: "text", issue: "invalid_text" }]);
  });
});

describe("L2F-14: what the agent reads before an outcome is what the creator receives (RG77)", () => {
  const base = {
    level: "account_verified" as const,
    networkName: "Instagram",
    restoredAt: new Date("2026-11-10T12:00:00Z"),
  };

  it("words each outcome from the files of the e-mail, in the creator's language, with the reason the decision stood on", () => {
    const confirmed = disputeOutcomePreview({
      ...base,
      locale: "fr",
      outcomeCode: "decision_confirmed",
      contested: { decision: "revocation", code: "owner_changed" },
    });
    expect(confirmed).toContain("Après réexamen");
    expect(confirmed).toContain("a changé de titulaire");
    const english = disputeOutcomePreview({
      ...base,
      locale: "en",
      outcomeCode: "decision_overturned",
      contested: null,
    });
    expect(english).toContain("After review");
    expect(english).toContain("2026");
    // the team's own message follows `other`: only the sentence is a preview
    expect(
      disputeOutcomePreview({
        ...base,
        locale: "fr",
        outcomeCode: "other",
        contested: null,
      }),
    ).toContain("Le message de l'équipe INFLUX");
  });

  it("gives nothing for a code outside the closed list, nor for a confirmed decision whose reason is unknown", () => {
    expect(
      disputeOutcomePreview({
        ...base,
        locale: "fr",
        outcomeCode: "invented",
        contested: null,
      }),
    ).toBeNull();
    expect(
      disputeOutcomePreview({
        ...base,
        locale: "fr",
        outcomeCode: "decision_confirmed",
        contested: null,
      }),
    ).toBeNull();
  });
});

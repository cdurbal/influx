// The refusals of the opening of a verification by an agent and of the grant on the login address, as the
// API answers them (docs/mvp/06 RG51; jalons/l2f/modele.md §6, D83 A and A-bis; 0234; l2f commit 15). The
// database says each refusal by its SQLSTATE, MESSAGE and DETAIL; these cases walk every one of them
// without a database, and the closed list of the codes the contract names.
import { VERIFICATION_REFUSAL_ISSUES } from "@influx/contracts/verification";
import { describe, expect, it } from "vitest";
import {
  agentRefusalOf,
  openingRefusalOf,
} from "../src/domains/backoffice/verification-queues/refusals.ts";
import {
  ApiError,
  RequestValidationError,
  RetryLaterError,
} from "../src/platform/errors.ts";

/** A database error as drizzle wraps it: the driver error is its `cause`. */
function sqlError(code: string, message: string, detail?: string): Error {
  const driver = Object.assign(new Error(message), {
    code,
    ...(detail === undefined ? {} : { detail }),
  });
  return new Error("Failed query", { cause: driver });
}

function validation(error: unknown) {
  expect(error).toBeInstanceOf(RequestValidationError);
  return (error as RequestValidationError).issues;
}

describe("L2F-15: the opening of a verification by an agent (0234, D83 A)", () => {
  it("answers the refusals of the account and of the member's own history as a 409 on `request`", () => {
    for (const issue of [
      "account_unavailable",
      "already_verified",
      "rejection_cap",
    ]) {
      expect(VERIFICATION_REFUSAL_ISSUES as readonly string[]).toContain(issue);
      const answered = openingRefusalOf(sqlError("55000", issue, issue));
      expect(answered, issue).toBeInstanceOf(ApiError);
      expect((answered as ApiError).details, issue).toEqual([
        { path: "request", issue },
      ]);
    }
    for (const issue of [
      "website_domain_required",
      "internal_details_required",
    ]) {
      const answered = openingRefusalOf(sqlError("23514", issue, issue));
      expect((answered as ApiError).details, issue).toEqual([
        { path: "request", issue },
      ]);
    }
  });

  it("keeps the seconds of `retry_after` for the header, the date and the bare message of a duplicate", () => {
    const later = openingRefusalOf(
      sqlError("55000", "retry_after", "3600"),
    ) as RetryLaterError;
    expect(later).toBeInstanceOf(RetryLaterError);
    expect(later.retryAfterSeconds).toBe(3600);
    expect(later.details).toEqual([{ path: "request", issue: "retry_after" }]);
    const dated = openingRefusalOf(
      sqlError("55000", "duplicate_request", "2026-11-09T10:00:00Z"),
    ) as ApiError;
    expect(dated.details).toEqual([
      { path: "request", issue: "duplicate_request" },
      { path: "submittedAt", issue: "2026-11-09T10:00:00Z" },
    ]);
    const bare = openingRefusalOf(
      sqlError("55000", "duplicate_request"),
    ) as ApiError;
    expect(bare.details).toEqual([
      { path: "request", issue: "duplicate_request" },
    ]);
  });

  it("says 42501 as the answer of an unknown account, and names the body field of each 22023", () => {
    const forbidden = openingRefusalOf(sqlError("42501", "forbidden"));
    expect((forbidden as ApiError).code).toBe("not_found");
    expect(
      validation(openingRefusalOf(sqlError("22023", "level", "level"))),
    ).toEqual([{ path: "level", issue: "invalid_level" }]);
    expect(
      validation(openingRefusalOf(sqlError("22023", "reason", "reason"))),
    ).toEqual([{ path: "openingReasonCode", issue: "invalid_reason" }]);
    expect(
      validation(
        openingRefusalOf(
          sqlError("22023", "opening_comment", "opening_comment"),
        ),
      ),
    ).toEqual([{ path: "openingComment", issue: "invalid_opening_comment" }]);
    // the internal block: the field when one value is wrong, the block when it is already on the record
    for (const [detail, path] of [
      ["legal_name", "legalName"],
      ["registration_country_code", "registrationCountryCode"],
      ["registration_number", "registrationNumber"],
    ] as const) {
      expect(
        validation(
          openingRefusalOf(
            sqlError("22023", "internal_details_invalid", detail),
          ),
        ),
        detail,
      ).toEqual([{ path, issue: "invalid_internal_details" }]);
    }
    expect(
      validation(
        openingRefusalOf(
          sqlError(
            "22023",
            "internal_details_invalid",
            "internal_details_present",
          ),
        ),
      ),
    ).toEqual([{ path: "internalDetails", issue: "internal_details_present" }]);
  });

  it("never invents an issue: an unknown DETAIL or code is an internal error, unchanged", () => {
    for (const unknown of [
      sqlError("55000", "whatever", "something_else"),
      sqlError("23514", "whatever", "something_else"),
      sqlError("22023", "whatever", "something_else"),
      sqlError("22023", "internal_details_invalid", "something_else"),
      sqlError("XX000", "boom"),
    ]) {
      expect(openingRefusalOf(unknown)).toBe(unknown);
    }
  });
});

describe("L2F-15: the grant on the login address (0234, D83 A-bis)", () => {
  it("answers `login_address_ineligible` with its reason as a word, never the address nor its domain", async () => {
    expect(VERIFICATION_REFUSAL_ISSUES as readonly string[]).toContain(
      "login_address_ineligible",
    );
    for (const reason of ["unverified", "consumer_domain", "other_domain"]) {
      const answered = (await agentRefusalOf(
        undefined as never,
        sqlError("55000", "login_address_ineligible", reason),
        "entry",
        "caller",
      )) as ApiError;
      expect(answered, reason).toBeInstanceOf(ApiError);
      expect(answered.details, reason).toEqual([
        { path: "entry", issue: "login_address_ineligible" },
        { path: "entry.loginAddress", issue: reason },
      ]);
    }
  });

  it("does not take another message for it, nor a reason outside its three words", async () => {
    for (const unknown of [
      sqlError("55000", "login_address_ineligible", "gmail.com"),
      sqlError("55000", "whatever", "consumer_domain"),
    ]) {
      expect(
        await agentRefusalOf(undefined as never, unknown, "entry", "caller"),
      ).toBe(unknown);
    }
  });
});

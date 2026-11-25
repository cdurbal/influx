// The refusals of the doors of queue 9, the plain text of the message of a brand, AL23 and the contract of the
// closure, as the API answers them (docs/mvp/15 C2, RG36, AL23; 17b I13; jalons/l3g/modele.md §5; l3g-fiche
// invariants 11, 14; L3FS-7; l3g commit 10). The database says each refusal by its SQLSTATE, MESSAGE and DETAIL;
// the cases walk each mapping without a database (the routes are proved on the local stack by
// db-tests/team-selection-queue-route.test.ts).
import {
  closeTeamSelectionRequestSchema,
  TEAM_SELECTION_CLOSE_REASONS,
  teamSelectionEntriesQuerySchema,
} from "@influx/contracts/backoffice-queues";
import { describe, expect, it } from "vitest";
import { teamSelectionDeadlineAlerts } from "../src/domains/backoffice/alerts.ts";
import { plainTextOf } from "../src/domains/backoffice/team-selection-queue/plain-text.ts";
import { teamSelectionRefusalOf } from "../src/domains/backoffice/team-selection-queue/refusals.ts";
import { ApiError, RequestValidationError } from "../src/platform/errors.ts";

/** A database error as drizzle wraps it: the driver error is its `cause`. */
function sqlError(code: string, message: string, detail?: string): Error {
  const driver = Object.assign(new Error(message), {
    code,
    ...(detail === undefined ? {} : { detail }),
  });
  return new Error("Failed query", { cause: driver });
}

/** A transaction that answers the display name of the holder. */
function transaction(rows: Record<string, unknown>[]): never {
  return { execute: async () => rows } as never;
}

const HOLDER = "0f6e1a3c-7a52-4f3b-9d4a-2b1f6c0d8e91";

async function answered(
  error: unknown,
  rows: Record<string, unknown>[] = [],
): Promise<unknown> {
  return teamSelectionRefusalOf(transaction(rows), error);
}

describe("L3G-10: the refusals of the four doors of queue 9 (0330)", () => {
  it("answers 42501 forbidden as an unknown request, and leaves a missing right (another message) a fault", async () => {
    const forbidden = await answered(sqlError("42501", "forbidden"));
    expect(forbidden).toBeInstanceOf(ApiError);
    expect((forbidden as ApiError).code).toBe("not_found");
    const missing = sqlError("42501", "permission denied for table x");
    expect(await answered(missing)).toBe(missing);
  });

  it("answers 55P03 with the account of a live holder as 409 held_by_other and his name, and without one as claim_not_held", async () => {
    const other = await answered(sqlError("55P03", "no_live_claim", HOLDER), [
      { display_name: "Alix" },
    ]);
    expect((other as ApiError).code).toBe("conflict");
    expect((other as ApiError).details).toEqual([
      { path: "claim", issue: "held_by_other" },
      { path: "claim.holder", issue: "Alix" },
    ]);
    const nameless = await answered(
      sqlError("55P03", "no_live_claim", HOLDER),
      [{ display_name: null }],
    );
    expect((nameless as ApiError).details).toEqual([
      { path: "claim", issue: "held_by_other" },
    ]);
    for (const detail of ["none", undefined]) {
      const free = await answered(sqlError("55P03", "no_live_claim", detail));
      expect((free as ApiError).code).toBe("conflict");
      expect((free as ApiError).details).toEqual([
        { path: "claim", issue: "claim_not_held" },
      ]);
    }
  });

  it("answers 55000 entry_closed as 409 on `entry`, and a setting the base lacks as 503, nothing the caller can mend", async () => {
    const closed = await answered(
      sqlError("55000", "entry_closed", "entry_closed"),
    );
    expect((closed as ApiError).code).toBe("conflict");
    expect((closed as ApiError).details).toEqual([
      { path: "entry", issue: "entry_closed" },
    ]);
    const unset = await answered(
      sqlError("55000", "claim_expiry_minutes is not set"),
    );
    expect((unset as ApiError).code).toBe("service_unavailable");
  });

  it("answers 22023 reason and note as 400 on their fields, and anything else unchanged", async () => {
    const reason = await answered(
      sqlError("22023", "invalid_parameter", "reason"),
    );
    expect(reason).toBeInstanceOf(RequestValidationError);
    expect((reason as RequestValidationError).issues).toEqual([
      { path: "reasonCode", issue: "invalid_reason" },
    ]);
    const note = await answered(sqlError("22023", "invalid_parameter", "note"));
    expect((note as RequestValidationError).issues).toEqual([
      { path: "note", issue: "invalid_note" },
    ]);
    for (const error of [
      sqlError("22023", "invalid_parameter", "filters"),
      sqlError("23505", "duplicate"),
      new Error("plain"),
    ]) {
      expect(await answered(error)).toBe(error);
    }
  });
});

describe("L3G-10: the message of a brand is plain text (L3FS-7; fiche invariant 11)", () => {
  const BIDI = [0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d]
    .concat([0x202e, 0x2066, 0x2067, 0x2068, 0x2069])
    .map((codePoint) => String.fromCodePoint(codePoint));

  it("takes out every bidirectional control, which flip the order of what surrounds them", () => {
    for (const control of BIDI) {
      expect(plainTextOf(`a${control}b`)).toBe("ab");
    }
    expect(plainTextOf(BIDI.join(""))).toBe("");
  });

  it("takes out the control characters, keeps the tab and the line breaks, and folds a carriage return into a line feed", () => {
    const bell = String.fromCodePoint(0x07);
    const escape = String.fromCodePoint(0x1b);
    const delete_ = String.fromCodePoint(0x7f);
    const c1 = String.fromCodePoint(0x85);
    expect(plainTextOf(`a${bell}b${escape}c${delete_}d${c1}e`)).toBe("abcde");
    expect(plainTextOf("one\ttwo\nthree\r\nfour\rfive")).toBe(
      "one\ttwo\nthree\nfour\nfive",
    );
  });

  it("leaves markup, links, emoji and every other script as the characters they are, and drops a lone surrogate", () => {
    const text =
      "<script>alert(1)</script> [x](https://example.test) 👩‍👩‍👧 مرحبا 你好";
    expect(plainTextOf(text)).toBe(text);
    const lone = String.fromCharCode(0xd800);
    expect(plainTextOf(`a${lone}b`)).toBe("ab");
    expect(plainTextOf("")).toBe("");
  });
});

describe("L3G-10: AL23, the requests of queue 9 past their deadline (15 §F)", () => {
  it("is up with its count and its oldest deadline, and down when no request is past it", () => {
    expect(
      teamSelectionDeadlineAlerts({
        count: 3,
        since: "2026-11-20T09:00:00.000Z",
      }),
    ).toEqual([
      {
        code: "AL23",
        cause: "selection_past_deadline",
        destination: null,
        setting: null,
        count: 3,
        since: "2026-11-20T09:00:00.000Z",
      },
    ]);
    expect(teamSelectionDeadlineAlerts({ count: 0, since: null })).toEqual([]);
  });
});

describe("L3G-10: the closure and the list of queue 9, as a closed contract (17b I13; 15 RG34)", () => {
  it("holds the six reasons of 0330 and refuses the two the arbitration set aside", () => {
    expect([...TEAM_SELECTION_CLOSE_REASONS].sort()).toEqual([
      "campaign_closed",
      "contact_details_in_text",
      "duplicate",
      "motive_insufficient",
      "off_brief",
      "other",
    ]);
    for (const reasonCode of ["budget_mismatch", "suspected_circumvention"]) {
      expect(
        closeTeamSelectionRequestSchema.safeParse({ reasonCode }).success,
      ).toBe(false);
    }
  });

  it("asks a note of 10 to 500 characters for `other` alone, trimmed, without a NUL character", () => {
    const parse = (body: unknown) =>
      closeTeamSelectionRequestSchema.safeParse(body);
    expect(parse({ reasonCode: "duplicate" }).success).toBe(true);
    expect(parse({ reasonCode: "duplicate", note: "A note" }).success).toBe(
      false,
    );
    expect(parse({ reasonCode: "other" }).success).toBe(false);
    expect(parse({ reasonCode: "other", note: "         short" }).success).toBe(
      false,
    );
    expect(parse({ reasonCode: "other", note: "x".repeat(501) }).success).toBe(
      false,
    );
    expect(
      parse({
        reasonCode: "other",
        note: `ten ${String.fromCharCode(0)} chars`,
      }).success,
    ).toBe(false);
    const ok = parse({ reasonCode: "other", note: `  ${"x".repeat(10)}  ` });
    expect(ok.success && ok.data.note).toBe("x".repeat(10));
    expect(
      parse({ reasonCode: "other", note: "x".repeat(10), extra: 1 }).success,
    ).toBe(false);
  });

  it("caps the page, takes no other key and keeps the period in order", () => {
    const parse = (query: unknown) =>
      teamSelectionEntriesQuerySchema.safeParse(query);
    expect(parse({}).success && parse({}).data?.limit).toBe(20);
    expect(parse({ limit: "50" }).success).toBe(true);
    expect(parse({ limit: "51" }).success).toBe(false);
    expect(parse({ state: "closed" }).success).toBe(false);
    expect(
      parse({
        from: "2026-11-21T00:00:00.000Z",
        to: "2026-11-20T00:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(parse({ holder: "me", overdue: "true" }).success).toBe(true);
    expect(parse({ holder: "someone" }).success).toBe(false);
  });
});

// The refusals, the alerts, the cursor and the previews of queues 2 and 3, and the refusal of a role change,
// as the API answers them (docs/mvp/07 RG93, RG94, RG96 to RG98; 15 C2, RG36; jalons/l2g/modele.md §3
// "Erreurs", EC-L2G-10-1, EC-L2G-12; l2g commit 11). The database says each refusal by its SQLSTATE,
// MESSAGE and DETAIL; the cases walk each mapping without a database (the routes are proved on the local
// stack by db-tests/t14-creator-queue-route.test.ts).
import {
  CREATOR_DECISION_CONFLICT_ISSUES,
  creatorEntriesQuerySchema,
  decidedEntryResponseSchema,
  portfolioEntriesSearchSchema,
  rejectPortfolioItemRequestSchema,
} from "@influx/contracts/creator-queues";
import { CREATOR_REJECTION_REASON_CODES } from "@influx/contracts/creator-profile";
import { PORTFOLIO_REJECTION_REASON_CODES } from "@influx/contracts/creator-portfolio";
import { describe, expect, it } from "vitest";
import { confirmRefusalOf } from "../src/domains/backoffice/actions-dual-control-routes.ts";
import {
  alertCodesOf,
  reviewAlertsOf,
} from "../src/domains/backoffice/creator-queues/alerts.ts";
import {
  decodeCursor,
  encodeCursor,
} from "../src/domains/backoffice/creator-queues/lists/repository.ts";
import { creatorRefusalOf } from "../src/domains/backoffice/creator-queues/refusals.ts";
import {
  creatorRejectionReasonPreview,
  portfolioRejectionReasonPreview,
} from "../src/domains/profiles/creator/decision-email.ts";
import { ApiError, RequestValidationError } from "../src/platform/errors.ts";

/** A database error as drizzle wraps it: the driver error is its `cause`. */
function sqlError(code: string, message: string, detail?: string): Error {
  const driver = Object.assign(new Error(message), {
    code,
    ...(detail === undefined ? {} : { detail }),
  });
  return new Error("Failed query", { cause: driver });
}

/** A transaction that answers the display name of the holder, or what a lifted claim reads. */
function transaction(rows: Record<string, unknown>[]): never {
  return { execute: async () => rows } as never;
}

const HOLDER = "0f6e1a3c-7a52-4f3b-9d4a-2b1f6c0d8e91";

async function answered(
  error: unknown,
  queue: "profiles_creator" | "portfolio_moderation" = "profiles_creator",
  rows: Record<string, unknown>[] = [],
): Promise<unknown> {
  return creatorRefusalOf(transaction(rows), queue, error, "entry", "caller");
}

describe("L2G-11: the refusals of the doors of queues 2 and 3 (0244)", () => {
  it("answers 42501 as an unknown entry, whatever the cause: unknown, uploading, own account, held, role (T14.3, T14.4)", async () => {
    const forbidden = await answered(sqlError("42501", "forbidden"));
    expect(forbidden).toBeInstanceOf(ApiError);
    expect((forbidden as ApiError).code).toBe("not_found");
    expect((forbidden as ApiError).details).toBeUndefined();
  });

  it("answers the 55000 of the doors on the path `entry`: closed, stale token, profile state, replacement that is no longer one", async () => {
    for (const issue of [
      "entry_closed",
      "stale_token",
      "profile_state",
      "not_replaceable",
    ]) {
      expect(CREATOR_DECISION_CONFLICT_ISSUES as readonly string[]).toContain(
        issue,
      );
      const found = await answered(sqlError("55000", issue, issue));
      expect(found, issue).toBeInstanceOf(ApiError);
      expect((found as ApiError).code).toBe("conflict");
      expect((found as ApiError).details).toEqual([{ path: "entry", issue }]);
    }
  });

  it("answers `verified_handle`, which the database says by MESSAGE (its DETAIL is the field code), as a 409 on `entry` (EC-L2G-04-5)", async () => {
    const found = await answered(
      sqlError("55000", "verified_handle", "creator.network_handle"),
    );
    expect((found as ApiError).code).toBe("conflict");
    expect((found as ApiError).details).toEqual([
      { path: "entry", issue: "verified_handle" },
    ]);
    expect(CREATOR_DECISION_CONFLICT_ISSUES).toContain("verified_handle");
  });

  it("returns a 55000 it does not know unchanged, never a guessed code (a 500 whose log holds no value)", async () => {
    const unknown = sqlError("55000", "something_else", "something_else");
    expect(await answered(unknown)).toBe(unknown);
    const bare = sqlError("55000", "no_detail");
    expect(await answered(bare)).toBe(bare);
  });

  it("answers a missing required field at the publication of a submission as a 409 on the field, never its value", async () => {
    const found = await answered(
      sqlError("23514", "required field missing: portfolio", "portfolio"),
    );
    expect((found as ApiError).code).toBe("conflict");
    expect((found as ApiError).details).toEqual([
      { path: "portfolio", issue: "required_field_missing" },
    ]);
    // a constraint of an applied value names no field of ours: unchanged
    const constraint = sqlError(
      "23514",
      "violates check",
      "Failing row contains (secret)",
    );
    expect(await answered(constraint)).toBe(constraint);
  });

  it("answers 55P03 with the name of the live holder (C2), `claim_not_held`, or `claim_lifted` (A8)", async () => {
    const held = await answered(
      sqlError("55P03", "no_live_claim", HOLDER),
      "profiles_creator",
      [{ display_name: "Camille" }],
    );
    expect((held as ApiError).details).toEqual([
      { path: "claim", issue: "held_by_other" },
      { path: "claim.holder", issue: "Camille" },
    ]);
    const nobody = await answered(
      sqlError("55P03", "no_live_claim", "none"),
      "profiles_creator",
      [{ dispossessed: false }],
    );
    expect((nobody as ApiError).details).toEqual([
      { path: "claim", issue: "claim_not_held" },
    ]);
    // the notice of a lifted claim reads the table of the queue it belongs to
    for (const queue of ["profiles_creator", "portfolio_moderation"] as const) {
      const lifted = await answered(
        sqlError("55P03", "no_live_claim", "none"),
        queue,
        [{ dispossessed: true }],
      );
      expect((lifted as ApiError).details, queue).toEqual([
        { path: "claim", issue: "claim_lifted" },
      ]);
    }
  });

  it("answers 22023 as a 400 on the body field its MESSAGE names, and nothing it does not know", async () => {
    for (const [message, path] of [
      ["reason", "reasonCode"],
      ["member_message", "memberMessage"],
      ["internal_comment", "internalComment"],
    ] as const) {
      const found = await answered(sqlError("22023", message, message));
      expect(found, message).toBeInstanceOf(RequestValidationError);
      expect((found as RequestValidationError).issues).toEqual([
        { path, issue: `invalid_${message}` },
      ]);
    }
    const unknown = sqlError("22023", "caption", "caption");
    expect(await answered(unknown)).toBe(unknown);
  });
});

describe("L2G-11: the role change of an account whose profile is not a draft (L2DS-6, 0243)", () => {
  it("answers 55000 creator_profile_not_draft as a 409 on `account`, and leaves the other refusals as they were", () => {
    const refused = confirmRefusalOf(
      sqlError(
        "55000",
        "creator_profile_not_draft",
        "creator_profile_not_draft",
      ),
    );
    expect(refused).toBeInstanceOf(ApiError);
    expect((refused as ApiError).code).toBe("conflict");
    expect((refused as ApiError).details).toEqual([
      { path: "account", issue: "creator_profile_not_draft" },
    ]);
    const badge = confirmRefusalOf(
      sqlError("55000", "badge_not_holding", "badge_not_holding"),
    );
    expect((badge as ApiError).details).toEqual([
      { path: "badge", issue: "badge_not_holding" },
    ]);
    const other = sqlError("55000", "other", "other");
    expect(confirmRefusalOf(other)).toBe(other);
    const forbidden = sqlError("42501", "forbidden");
    expect(confirmRefusalOf(forbidden)).toBe(forbidden);
  });
});

describe("L2G-11: the alerts name the field and the kind of signal, never the text (EC-L2G-12, 07 RG27, RG28)", () => {
  it("raises `direct_contact` on a title, a bio or a caption that shows an address, a link, a number or a handle", () => {
    expect(
      alertCodesOf({
        headline: "Cuisine végétale",
        bio: null,
        captions: [null],
      }),
    ).toEqual([]);
    for (const text of [
      "écrivez à moi@exemple.test",
      "mon site https://exemple.test/moi",
      "appelez le 06 12 34 56 78",
      "retrouvez-moi sur @cuisine_vegetale",
    ]) {
      expect(
        alertCodesOf({ headline: text, bio: null, captions: [] }),
        text,
      ).toEqual(["direct_contact"]);
      expect(
        alertCodesOf({ headline: null, bio: null, captions: [null, text] }),
        text,
      ).toEqual(["direct_contact"]);
    }
  });

  it("says in a decision view which field, which visual and which signals, in the order of the contract", () => {
    const alerts = reviewAlertsOf({
      headline: "Cuisine",
      bio: "Mon @compte et moi@exemple.test",
      captions: [
        { rowKey: "7f1b2c3d-0000-4000-8000-000000000001", text: "Une recette" },
        {
          rowKey: "7f1b2c3d-0000-4000-8000-000000000002",
          text: "www.exemple.test",
        },
      ],
    });
    expect(alerts).toEqual([
      {
        code: "direct_contact",
        field: "bio",
        rowKey: null,
        signals: ["email", "handle"],
      },
      {
        code: "direct_contact",
        field: "portfolio_caption",
        rowKey: "7f1b2c3d-0000-4000-8000-000000000002",
        signals: ["url", "domain"],
      },
    ]);
    // nothing of the text that matched is in what is served
    expect(JSON.stringify(alerts)).not.toContain("exemple");
    expect(JSON.stringify(alerts)).not.toContain("compte");
  });
});

describe("L2G-11: the cursor of the lists, opaque and strict", () => {
  const cursor = {
    dueAt: "2026-11-11T08:00:00.123456Z",
    createdAt: "2026-11-10T09:30:00.654321Z",
    id: "0f6e1a3c-7a52-4f3b-9d4a-2b1f6c0d8e91",
  };

  it("round-trips the sort key to the microsecond, and refuses anything the server did not issue", () => {
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
    expect(decodeCursor("not-a-cursor")).toBeNull();
    expect(
      decodeCursor(
        Buffer.from("2026-11-11|2026-11-10|x", "utf8").toString("base64url"),
      ),
    ).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });
});

describe("L2G-11: what the screen reads of a reason is what the creator receives (EC-L2G-10-1)", () => {
  it("serves every reason of RG96 and of the grid of RG79 in both languages, with no @ and the step that follows", () => {
    for (const locale of ["fr", "en"] as const) {
      for (const code of CREATOR_REJECTION_REASON_CODES) {
        const preview = creatorRejectionReasonPreview(locale, code);
        expect(preview.message, `${locale} ${code}`).not.toBe("");
        expect(preview.message).not.toContain("@");
        expect(preview.nextStepMessage).not.toContain("@");
        expect(["fix", "contact"]).toContain(preview.nextStep);
      }
      for (const code of PORTFOLIO_REJECTION_REASON_CODES) {
        const message = portfolioRejectionReasonPreview(locale, code);
        expect(message, `${locale} ${code}`).not.toBe("");
        expect(message).not.toContain("@");
      }
    }
    expect(
      creatorRejectionReasonPreview("en", "identifier_in_text").message,
    ).toContain("at sign");
    expect(
      creatorRejectionReasonPreview("fr", "identifier_in_text").message,
    ).toContain("arobase");
    expect(portfolioRejectionReasonPreview("fr", "handle_in_image")).toContain(
      "arobase",
    );
    expect(creatorRejectionReasonPreview("fr", "age_doubt").nextStep).toBe(
      "contact",
    );
    expect(
      creatorRejectionReasonPreview("fr", "bio_insufficient").nextStep,
    ).toBe("fix");
  });
});

describe("L2G-11: the closed schemas of the queues (contract)", () => {
  it("refuses a period that ends before it starts, a limit past the cap, and a key it does not know", () => {
    expect(
      creatorEntriesQuerySchema.safeParse({
        from: "2026-11-12T00:00:00Z",
        to: "2026-11-11T00:00:00Z",
      }).success,
    ).toBe(false);
    expect(creatorEntriesQuerySchema.safeParse({ limit: "51" }).success).toBe(
      false,
    );
    expect(creatorEntriesQuerySchema.safeParse({ handle: "x" }).success).toBe(
      false,
    );
    expect(creatorEntriesQuerySchema.parse({}).limit).toBe(20);
    expect(
      portfolioEntriesSearchSchema.safeParse({ kind: "other" }).success,
    ).toBe(false);
    expect(
      portfolioEntriesSearchSchema.safeParse({
        kind: "replacement",
        account: "x",
      }).success,
    ).toBe(false);
  });

  it("asks for a reason of the grid to refuse a visual, never `other`, and no message to the creator (RG79, RG97)", () => {
    const token = "a".repeat(64);
    expect(
      rejectPortfolioItemRequestSchema.safeParse({
        reviewToken: token,
        reasonCode: "watermark",
      }).success,
    ).toBe(true);
    expect(
      rejectPortfolioItemRequestSchema.safeParse({
        reviewToken: token,
        reasonCode: "other",
      }).success,
    ).toBe(false);
    expect(
      rejectPortfolioItemRequestSchema.safeParse({
        reviewToken: token,
        reasonCode: "watermark",
        memberMessage: "Un message que la grille n'accepte pas.",
      }).success,
    ).toBe(false);
  });

  it("answers a decision with the instant and the lateness the database gave, and the entry to open next", () => {
    expect(
      decidedEntryResponseSchema.safeParse({
        decidedAt: "2026-11-11T09:00:00.000Z",
        late: false,
        next: null,
      }).success,
    ).toBe(true);
    expect(
      decidedEntryResponseSchema.safeParse({
        decidedAt: "2026-11-11T09:00:00.000Z",
        late: false,
        next: null,
        decidedBy: "x",
      }).success,
    ).toBe(false);
  });
});

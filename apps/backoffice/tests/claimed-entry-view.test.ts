// What queues 5 and 6 share on their decision screens (docs/mvp/08 RG77, RG78; 15 RG27 C1 to C8; 17b §2.4;
// jalons/l2f, commit 19): pure functions of src/components/claimed-entry-view.ts and claimed-queue-view.ts,
// without a browser. The database says who holds an entry and who may judge a contest; these only word and
// gather: the mode, the banners, what a refused call means, the lists' filters and sorts.
import type { RelayResult } from "@influx/web-platform/relay-client";
import { describe, expect, it } from "vitest";
import {
  claimedBanner,
  claimedExpiryOf,
  claimedModeOf,
  claimedOverdueBanner,
  claimedRefusalOf,
  withClaimedExpiry,
  type ClaimedView,
} from "../src/components/claimed-entry-view";
import {
  disputeOwnFilters,
  disputeSortOf,
  identifierOwnFilters,
  identifierSortOf,
  sortedColumnOf,
} from "../src/components/claimed-queue-view";
import { QUEUE_ADDRESS } from "../src/components/queue-view-model";
import { messages } from "../src/messages/fr";

const AS_OF = "2026-11-10T10:00:00.000Z";
const t = messages.claimedReview;

function view(changes: {
  outcome?: ClaimedView["outcome"];
  token?: string | null;
  state?: string;
  overdue?: boolean;
  holder?: string | null;
  claimExpiresAt?: string | null;
}): ClaimedView {
  const holder = changes.holder === undefined ? null : changes.holder;
  return {
    asOf: AS_OF,
    outcome: changes.outcome ?? "claimed",
    reviewToken: changes.token === undefined ? "a".repeat(64) : changes.token,
    entry: {
      id: "7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22",
      state: changes.state ?? "open",
      slaDueAt: "2026-11-10T08:00:00.000Z",
      escalateAt: "2026-11-11T08:00:00.000Z",
      overdue: changes.overdue ?? false,
      claim: {
        holder:
          holder === null ? null : { accountId: "x", displayName: holder },
        claimedAt: holder === null ? null : "2026-11-10T09:00:00.000Z",
        claimExpiresAt: changes.claimExpiresAt ?? null,
        heldByCaller: false,
      },
      lastForcedRelease: null,
    },
  };
}

function failed(
  code: string,
  issues: string[],
): Exclude<RelayResult<unknown>, { kind: "ok" }> {
  return { kind: "failed", code, issues };
}

describe("L2F-19 claimed entry: the mode and the banners", () => {
  it("decides only with a live claim and a token, reads otherwise, and closes with the state", () => {
    expect(claimedModeOf(view({}))).toBe("deciding");
    expect(claimedModeOf(view({ outcome: "held" }))).toBe("deciding");
    expect(claimedModeOf(view({ outcome: "read_only", token: null }))).toBe(
      "readOnly",
    );
    expect(claimedModeOf(view({ token: null }))).toBe("readOnly");
    expect(claimedModeOf(view({ state: "upheld" }))).toBe("closed");
    expect(claimedModeOf(view({ outcome: "closed" }))).toBe("closed");
  });

  it("says the caller is the decider when nobody holds a read-only contest, and names a colleague who does (I14)", () => {
    const decider = claimedBanner(
      view({ outcome: "read_only", token: null, holder: null }),
    );
    expect(decider?.lines).toEqual([t.decider]);
    const colleague = claimedBanner(
      view({ outcome: "read_only", token: null, holder: "Noa" }),
    );
    expect(colleague?.lines[0]).toContain("Noa");
    expect(colleague?.lines).toContain(messages.queueReview.banner.readOnly);
    expect(claimedBanner(view({ state: "overturned" }))).toBeNull();
  });

  it("marks an entry past its deadline in clear, still decidable, and says nothing of a closed one", () => {
    expect(claimedOverdueBanner(view({ overdue: true }))?.tone).toBe("alert");
    expect(claimedOverdueBanner(view({ overdue: false }))).toBeNull();
    expect(
      claimedOverdueBanner(view({ overdue: true, state: "upheld" })),
    ).toBeNull();
  });

  it("reminds three minutes before the claim falls, then says it fell, from the instant of the database", () => {
    const base = Date.parse(AS_OF);
    const soon = view({ claimExpiresAt: "2026-11-10T10:02:00.000Z" });
    expect(claimedExpiryOf(soon, base, 0)).toEqual({
      kind: "soon",
      minutes: 2,
    });
    expect(
      claimedExpiryOf(
        view({ claimExpiresAt: "2026-11-10T10:20:00.000Z" }),
        base,
        0,
      ),
    ).toEqual({ kind: "ok" });
    expect(claimedExpiryOf(soon, base + 180_000, 0)).toEqual({
      kind: "expired",
    });
    // a browser clock behind by one minute is corrected by the offset taken at the opening
    expect(claimedExpiryOf(soon, base - 60_000, 60_000)).toEqual({
      kind: "soon",
      minutes: 2,
    });
    expect(claimedExpiryOf(view({ token: null }), base, 0)).toEqual({
      kind: "none",
    });
    expect(
      withClaimedExpiry(soon, "2026-11-10T10:30:00.000Z").entry.claim
        .claimExpiresAt,
    ).toBe("2026-11-10T10:30:00.000Z");
  });
});

describe("L2F-19 claimed entry: what a refused call means", () => {
  it("reads the dossier again on a lost claim, a stale version or a closed entry", () => {
    for (const [issue, why] of [
      ["stale_token", "stale"],
      ["claim_lifted", "lifted"],
      ["claim_not_held", "notHeld"],
      ["entry_closed", "closed"],
      ["held_by_other", "heldByOther"],
    ] as const) {
      expect(claimedRefusalOf(failed("conflict", [issue]))).toEqual({
        kind: "reopen",
        why,
      });
    }
  });

  it("words the refusals of 0232 and 0233 as a sentence, never as an error screen", () => {
    const expected: Record<string, string> = {
      reviewer_is_decider: t.refusals.reviewerIsDecider,
      reflection_delay: t.refusals.reflectionDelay,
      restore_expired: t.refusals.restoreExpired,
      line_deleted: t.refusals.lineDeleted,
      handle_already_verified: t.refusals.handleAlreadyVerified,
      badge_not_holding: t.refusals.badgeNotHolding,
      ownership_prerequisite: t.refusals.ownershipPrerequisite,
      missing_evidence: t.refusals.missingEvidence,
    };
    for (const [issue, text] of Object.entries(expected)) {
      expect(claimedRefusalOf(failed("conflict", [issue]))).toEqual({
        kind: "text",
        text,
        field: null,
      });
    }
  });

  it("tells a handle that does not match the declared one on its own field, whichever issue the API names", () => {
    expect(
      claimedRefusalOf(
        failed("validation_failed", ["invalid_observed_handle_mismatch"]),
      ),
    ).toEqual({
      kind: "text",
      text: t.refusals.handleMismatch,
      field: "handle",
    });
    const plain = claimedRefusalOf(
      failed("validation_failed", ["invalid_observed_handle"]),
    );
    expect(plain.kind === "text" && plain.field).toBe("handle");
    expect(claimedRefusalOf({ kind: "unauthenticated" })).toEqual({
      kind: "signedOut",
    });
  });
});

describe("L2F-19 queues 5 and 6 lists: filters, sorts and addresses", () => {
  it("offers the sorts each list can honour, the level for the contests only, no alert filter key", () => {
    const sortKeys = (own: ReturnType<typeof disputeOwnFilters>) =>
      own
        .find((filter) => filter.key === "sort")
        ?.options.map((option) => option.value);
    expect(sortKeys(disputeOwnFilters())).toEqual(["sla", "level", "network"]);
    expect(sortKeys(identifierOwnFilters())).toEqual(["sla", "network"]);
    expect(disputeOwnFilters().map((filter) => filter.key)).toEqual([
      "sort",
      "level",
      "network",
      "kind",
    ]);
    expect(identifierOwnFilters().map((filter) => filter.key)).toEqual([
      "sort",
      "network",
    ]);
  });

  it("falls back to the oldest first when the sort asked is not the list's, and marks the column the sort follows", () => {
    expect(disputeSortOf({ sort: "level" })).toBe("level");
    expect(identifierSortOf({ sort: "level" })).toBe("age");
    expect(sortedColumnOf("age", "submitted")).toBe("submitted");
    expect(sortedColumnOf("age", "opened")).toBe("opened");
    expect(sortedColumnOf("sla", "opened")).toBe("due");
  });

  it("gives each queue its own address in the rail and on the dashboard", () => {
    expect(QUEUE_ADDRESS.verification_disputes).toBe("/files/contestations");
    expect(QUEUE_ADDRESS.identity_change_review).toBe(
      "/files/identifiants-modifies",
    );
  });
});

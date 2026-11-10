// The badges of an account in words and the ask for a withdrawal in checks (docs/mvp/08 RG70, RG73 to
// RG77; 06 RG55; 15 RG75; jalons/l2f, commit 18): pure functions of
// src/components/account-badges-view.ts, without a browser. The database holds the reasons of a level and
// refuses a withdrawal that is not held; these only word the state (never a colour alone), order the list,
// pre-check what was typed and say what a withdrawal does before it is asked for.
import {
  REVOCATION_REASON_CODES,
  VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH,
  VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH,
  type AccountBadgeRow,
  type AccountBadgesResponse,
} from "@influx/contracts/verification";
import { describe, expect, it } from "vitest";
import {
  badgeName,
  canRequestWithdrawal,
  dateWords,
  hasLiveRequest,
  pendingWords,
  reasonsFor,
  recapLines,
  revokedForWords,
  sortedBadges,
  stateWords,
  withdrawalOutcome,
  withdrawalRefusal,
} from "../src/components/account-badges-view";
import { messages } from "../src/messages/fr";

const t = messages.accountBadges;

function badge(changes: Partial<AccountBadgeRow> = {}): AccountBadgeRow {
  return {
    id: "aaaaaaaa-2222-4333-8444-555555555551",
    level: "account_verified",
    networkCode: "instagram",
    state: "active",
    grantedAt: "2026-09-01T10:00:00.000Z",
    expiresAt: null,
    endedAt: null,
    revokedAt: null,
    revocationReasonCode: null,
    pendingRevocation: null,
    dispute: null,
    ...changes,
  };
}

const REASONS: AccountBadgesResponse["reasons"] = [
  {
    code: "forged_evidence",
    position: 1,
    levels: ["account_verified", "audience_verified", "brand_verified"],
    requiresMemberMessage: false,
    escalatesToAdmin: true,
    message: "Une pièce fournie s’est révélée inexacte.",
  },
  {
    code: "account_closed",
    position: 2,
    levels: ["account_verified", "audience_verified"],
    requiresMemberMessage: false,
    escalatesToAdmin: false,
    message: "Le compte de réseau n’est plus accessible.",
  },
  {
    code: "terms_breach",
    position: 4,
    levels: ["account_verified", "audience_verified", "brand_verified"],
    requiresMemberMessage: true,
    escalatesToAdmin: true,
    message: "Votre profil ne respecte pas les conditions d’utilisation.",
  },
  {
    code: "company_dissolved",
    position: 6,
    levels: ["brand_verified"],
    requiresMemberMessage: false,
    escalatesToAdmin: false,
    message: "La société a été radiée du registre public.",
  },
];

describe("L2F-18 the state and the date of a badge are written", () => {
  it("names the level and the network, and a brand's badge carries no network", () => {
    expect(badgeName(badge())).toBe("Compte vérifié · Instagram");
    expect(badgeName(badge({ level: "audience_verified" }))).toBe(
      "Audience vérifiée · Instagram",
    );
    expect(
      badgeName(badge({ level: "brand_verified", networkCode: null })),
    ).toBe("Marque vérifiée");
  });

  it("writes every state of the table, and a code it does not know as it is", () => {
    expect(
      [
        "active",
        "to_refresh",
        "to_reconfirm",
        "expired",
        "revoked",
        "replaced",
      ].map(stateWords),
    ).toEqual([
      "actif",
      "à rafraîchir",
      "à reconfirmer",
      "expiré",
      "retiré",
      "remplacé",
    ]);
    expect(stateWords("unknown_state")).toBe("unknown_state");
  });

  it("dates a badge by what it is: no expiry for an account, an expiry, a past one, an end", () => {
    expect(dateWords(badge())).toBe(t.date.neverExpires);
    expect(
      dateWords(
        badge({
          level: "audience_verified",
          expiresAt: "2026-12-01T00:00:00.000Z",
        }),
      ),
    ).toMatch(/^expire le \d{2}\/\d{2}\/\d{4}$/);
    expect(
      dateWords(
        badge({ state: "to_refresh", expiresAt: "2026-10-01T00:00:00.000Z" }),
      ),
    ).toMatch(/^échéance dépassée le /);
    expect(
      dateWords(
        badge({ state: "revoked", revokedAt: "2026-11-05T09:00:00.000Z" }),
      ),
    ).toMatch(/^retiré le /);
    expect(
      dateWords(
        badge({ state: "expired", endedAt: "2026-11-06T09:00:00.000Z" }),
      ),
    ).toMatch(/^expiré le /);
    expect(
      dateWords(
        badge({ state: "replaced", endedAt: "2026-11-07T09:00:00.000Z" }),
      ),
    ).toMatch(/^remplacé le /);
  });

  it("gives the reason of a withdrawal executed in the agent's words, and none to a badge that stands", () => {
    expect(
      revokedForWords(
        badge({ state: "revoked", revocationReasonCode: "influx_error" }),
      ),
    ).toBe("motif : Badge accordé par erreur par INFLUX");
    expect(revokedForWords(badge())).toBeNull();
  });

  it("lists the badges that stand first, each group newest first", () => {
    const ordered = sortedBadges([
      badge({
        id: "old-expired",
        state: "expired",
        grantedAt: "2026-01-01T00:00:00.000Z",
      }),
      badge({ id: "held-old", grantedAt: "2026-02-01T00:00:00.000Z" }),
      badge({
        id: "revoked",
        state: "revoked",
        grantedAt: "2026-08-01T00:00:00.000Z",
      }),
      badge({
        id: "held-new",
        state: "to_refresh",
        grantedAt: "2026-09-01T00:00:00.000Z",
      }),
    ]).map((row) => row.id);
    expect(ordered).toEqual(["held-new", "held-old", "revoked", "old-expired"]);
  });
});

describe("L2F-18 the ask for a withdrawal is offered for a badge that stands, once", () => {
  it("offers it for the three states that hold, and for no other", () => {
    expect(
      (["active", "to_refresh", "to_reconfirm"] as const).map((state) =>
        canRequestWithdrawal(badge({ state })),
      ),
    ).toEqual([true, true, true]);
    expect(
      (["expired", "revoked", "replaced"] as const).map((state) =>
        canRequestWithdrawal(badge({ state })),
      ),
    ).toEqual([false, false, false]);
  });

  it("holds it back while a request lives, and offers it again once the last one has no effect", () => {
    const waiting = badge({
      pendingRevocation: {
        dualControlRequestId: "bbbbbbbb-2222-4333-8444-555555555551",
        state: "pending",
      },
    });
    expect(hasLiveRequest(waiting)).toBe(true);
    expect(canRequestWithdrawal(waiting)).toBe(false);
    expect(pendingWords(waiting)).toBe(t.pending.pending);
    const abandoned = badge({
      pendingRevocation: {
        dualControlRequestId: "bbbbbbbb-2222-4333-8444-555555555551",
        state: "expired",
      },
    });
    expect(canRequestWithdrawal(abandoned)).toBe(true);
    expect(pendingWords(abandoned)).toBe(t.pending.expired);
    expect(pendingWords(badge())).toBeNull();
  });
});

describe("L2F-18 the reasons and the message are those of the level, checked as the database checks them", () => {
  it("offers a brand's badge the brand reasons and a creator's the creator ones, in the order of the table", () => {
    expect(reasonsFor(REASONS, "brand_verified").map((r) => r.code)).toEqual([
      "forged_evidence",
      "terms_breach",
      "company_dissolved",
    ]);
    expect(reasonsFor(REASONS, "account_verified").map((r) => r.code)).toEqual([
      "forged_evidence",
      "account_closed",
      "terms_breach",
    ]);
  });

  it("asks for a reason of the level, and sends no message for a reason that does not ask for one", () => {
    const input = { badge: badge(), reasons: REASONS, memberMessage: "ignoré" };
    expect(withdrawalOutcome({ ...input, reasonCode: "" })).toEqual({
      ok: false,
      error: messages.common.reasonPlaceholder,
    });
    // a brand reason for a creator's badge
    expect(
      withdrawalOutcome({ ...input, reasonCode: "company_dissolved" }).ok,
    ).toBe(false);
    expect(
      withdrawalOutcome({ ...input, reasonCode: "forged_evidence" }),
    ).toEqual({
      ok: true,
      body: { reasonCode: "forged_evidence" },
    });
  });

  it("requires the agent's own message, 20 to 500 characters, for the reason that asks for it", () => {
    const input = {
      badge: badge(),
      reasons: REASONS,
      reasonCode: "terms_breach",
    };
    const refused = {
      ok: false,
      error: t.memberMessageInvalid(
        VERIFICATION_MEMBER_MESSAGE_MIN_LENGTH,
        VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH,
      ),
    };
    expect(
      withdrawalOutcome({ ...input, memberMessage: "   trop court   " }),
    ).toEqual(refused);
    expect(
      withdrawalOutcome({
        ...input,
        memberMessage: "x".repeat(VERIFICATION_MEMBER_MESSAGE_MAX_LENGTH + 1),
      }),
    ).toEqual(refused);
    const message = "Votre profil enfreint les conditions d’utilisation.";
    expect(
      withdrawalOutcome({ ...input, memberMessage: `  ${message}  ` }),
    ).toEqual({
      ok: true,
      body: { reasonCode: "terms_breach", memberMessage: message },
    });
  });

  it("says in words that a refusal of the database leaves nothing withdrawn", () => {
    expect(withdrawalRefusal("conflict")).toBe(t.refused);
    expect(withdrawalRefusal("forbidden")).toBeNull();
    expect(withdrawalRefusal(undefined)).toBeNull();
  });
});

describe("L2F-18 what a withdrawal does is said before the gesture, and the 2V screen knows every consequence", () => {
  it("adds the audience that leaves with a « Compte vérifié », and says it cannot be undone", () => {
    expect(recapLines(badge())).toContain(t.recap.cascade);
    expect(recapLines(badge({ level: "audience_verified" }))).not.toContain(
      t.recap.cascade,
    );
    expect(
      recapLines(badge({ level: "brand_verified", networkCode: null })),
    ).not.toContain(t.recap.cascade);
    expect(recapLines(badge()).at(-1)).toBe(t.recap.irreversible);
  });

  it("words on the 2V screen the action, every reason of the closed list and every consequence apps/api sends", () => {
    const dual = messages.dualControl;
    expect(dual.actions["verification.revoke_badge"]).toBeTruthy();
    for (const code of REVOCATION_REASON_CODES) {
      expect(dual.reasons[code], code).toBeTruthy();
    }
    for (const code of [
      "badge_withdrawn",
      "audience_badge_withdrawn",
      "public_row_recomputed",
      "member_notified",
      "member_may_appeal",
    ]) {
      expect(dual.consequences[code], code).toBeTruthy();
    }
  });
});

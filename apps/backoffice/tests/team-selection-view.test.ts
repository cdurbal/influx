// L3G-T12 (docs/mvp/10 RG61, RG84; 15 C1 to C3, AL23; 17b I13; jalons/l3g/modele.md §5, §8; l3g-fiche invariants 11, 12,
// 13): the pure parts of queue 9, without a browser. The message of a brand is plain text (the bidirectional controls and
// the control characters go, line breaks stay), an opening becomes the shape the claimed queues share (the caller decides
// only when the claim is his, a colleague's is read, a closed request is closed), the closure is checked before it is sent
// (a reason of the closed list, a note of 10 to 500 characters for « Autre » alone), a refusal is worded by what the base
// said, the rail holds the queue. No amount, tariff or creator anywhere (D48, D78).
import {
  openTeamSelectionResponseSchema,
  teamSelectionEntryRowSchema,
  TEAM_SELECTION_CLOSE_REASONS,
} from "@influx/contracts/backoffice-queues";
import { describe, expect, it } from "vitest";
import { activePlaceOf, navItemsOf } from "../src/components/bo-nav";
import {
  claimedModeOf,
  claimedRefusalOf,
} from "../src/components/claimed-entry-view";
import {
  closedLines,
  closeCheck,
  closureWords,
  criteriaTexts,
  entrySubtitle,
  entryTitle,
  listRowOf,
  plainText,
  selectionBrandWords,
  teamSelectionViewOf,
} from "../src/components/team-selection-view";
import { messages } from "../src/messages/fr";

const ID = "7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22";
const AGENT = "0c2b7a54-3a45-4d57-8f0e-6f1d2a9b3c11";
const NOW = "2026-11-21T10:00:00.000Z";
const r = messages.teamSelectionReview;

/** An opening as apps/api serves it, parsed by the contract itself so that the fixture cannot drift from it. */
function opening(
  overrides: Record<string, unknown> = {},
  request: Record<string, unknown> = {},
) {
  return openTeamSelectionResponseSchema.parse({
    asOf: NOW,
    outcome: "claimed",
    holder: { accountId: AGENT, displayName: "Alice" },
    claimedAt: NOW,
    claimExpiresAt: "2026-11-21T10:30:00.000Z",
    request: {
      id: ID,
      advertiserAccountId: AGENT,
      brandName: "Maison Aurore",
      campaign: null,
      language: "fr",
      filters: { F1: "beauty", F3: ["instagram"] },
      message: "Des créateurs comme ceux-ci, merci.",
      state: "open",
      createdAt: "2026-11-20T09:00:00.000Z",
      slaDueAt: "2026-11-21T09:00:00.000Z",
      overdue: true,
      closure: null,
      ...request,
    },
    ...overrides,
  });
}

describe("L3G-T12: the message of a brand is plain text (L3FS-7)", () => {
  it("removes the bidirectional controls and the control characters, keeps the line breaks", () => {
    const hidden = "a‮b⁦c‏d\u0000e\u0007f\ng\th";
    expect(plainText(hidden)).toBe("abcdef\ng\th");
    expect(plainText("Bonjour Zoé — 10 €")).toBe("Bonjour Zoé — 10 €");
  });
});

describe("L3G-T12: an opening in the shape of the claimed queues", () => {
  it("decides when the claim is the caller's, reads a colleague's, and closes a closed request", () => {
    const mine = teamSelectionViewOf(opening());
    expect(claimedModeOf(mine)).toBe("deciding");
    expect(mine.entry.claim.heldByCaller).toBe(true);
    expect(
      claimedModeOf(teamSelectionViewOf(opening({ outcome: "held" }))),
    ).toBe("deciding");

    const colleague = teamSelectionViewOf(
      opening({
        outcome: "read_only",
        holder: { accountId: ID, displayName: "Bob" },
      }),
    );
    expect(claimedModeOf(colleague)).toBe("readOnly");
    expect(colleague.entry.claim.heldByCaller).toBe(false);
    expect(colleague.reviewToken).toBeNull();

    const closed = teamSelectionViewOf(
      opening(
        {
          outcome: "closed",
          holder: null,
          claimedAt: null,
          claimExpiresAt: null,
        },
        {
          state: "closed",
          closure: {
            closedAt: NOW,
            closedBy: { accountId: AGENT, displayName: "Alice" },
            reasonCode: "other",
            note: "Traitée par téléphone.",
          },
        },
      ),
    );
    expect(claimedModeOf(closed)).toBe("closed");
  });

  it("titles the request by its brand, and its criteria are the chips of the search, none says so", () => {
    const view = teamSelectionViewOf(opening());
    expect(entryTitle(view)).toBe("Demande de sélection — Maison Aurore");
    expect(entrySubtitle(view)).toContain("Sans campagne d’origine");
    expect(entrySubtitle(view)).toContain("français");
    expect(criteriaTexts(view.request)).toHaveLength(2);
    expect(criteriaTexts({ filters: {} })).toEqual([]);
    expect(
      entryTitle(teamSelectionViewOf(opening({}, { brandName: null }))),
    ).toBe(r.title(null));
  });

  it("words the list row without the message, and gives it no stage of escalation", () => {
    const row = teamSelectionEntryRowSchema.parse({
      id: ID,
      advertiserAccountId: AGENT,
      brandName: null,
      campaignId: null,
      campaignTitle: null,
      language: "en",
      createdAt: NOW,
      slaDueAt: NOW,
      overdue: false,
      owner: null,
      claim: {
        holder: null,
        claimedAt: null,
        claimExpiresAt: null,
        heldByCaller: false,
      },
    });
    expect(selectionBrandWords(row)).toBe(
      messages.teamSelectionQueue.unknownBrand,
    );
    expect(listRowOf(row).escalateAt).toBeNull();
    expect(Object.keys(row)).not.toContain("message");
  });
});

describe("L3G-T12: the closure is checked before it is sent (17b I13)", () => {
  it("asks for a reason of the closed list, and sends no note with another reason than « Autre »", () => {
    expect(closeCheck(null, "")).toEqual({
      ok: false,
      problem: { field: "reason", text: r.decision.reasonRequired },
    });
    for (const code of TEAM_SELECTION_CLOSE_REASONS) {
      expect(r.decision.reasons[code]).toBeTruthy();
    }
    expect(closeCheck("duplicate", "ignorée")).toEqual({
      ok: true,
      body: { reasonCode: "duplicate" },
    });
  });

  it("demands a trimmed note of 10 to 500 characters for « Autre », hidden controls removed", () => {
    const short = closeCheck("other", "  trop bref ");
    expect(short.ok).toBe(false);
    expect(short.ok ? null : short.problem.field).toBe("note");
    expect(closeCheck("other", "x".repeat(501)).ok).toBe(false);
    expect(closeCheck("other", "‮          ").ok).toBe(false);
    expect(closeCheck("other", "  Traitée par téléphone.  ")).toEqual({
      ok: true,
      body: { reasonCode: "other", note: "Traitée par téléphone." },
    });
  });

  it("says what was closed and why, and how a closed request ended", () => {
    const view = teamSelectionViewOf(opening());
    expect(closedLines(view, "campaign_closed")).toEqual([
      "Demande de Maison Aurore close : campagne close.",
    ]);
    const words = closureWords({
      closedAt: NOW,
      closedBy: null,
      reasonCode: "other",
      note: "Bonjour‮",
    });
    expect(words.line).toContain("Autre");
    expect(words.note).toBe("Bonjour");
  });
});

describe("L3G-T12: a refusal of the queue is worded by what the base said", () => {
  it("reads the claim and the closed request again, and words the 400 on the reason and the note", () => {
    const failed = (code: string, issues: string[]) =>
      ({ kind: "failed", status: 409, code, issues }) as never;
    expect(
      claimedRefusalOf(
        failed("conflict", ["held_by_other", "Bob"]),
        "teamSelection",
      ),
    ).toEqual({
      kind: "reopen",
      why: "heldByOther",
    });
    expect(
      claimedRefusalOf(failed("conflict", ["claim_not_held"]), "teamSelection"),
    ).toEqual({
      kind: "reopen",
      why: "notHeld",
    });
    expect(
      claimedRefusalOf(failed("conflict", ["entry_closed"]), "teamSelection"),
    ).toEqual({
      kind: "reopen",
      why: "closed",
    });
    expect(
      claimedRefusalOf(
        failed("validation_failed", ["invalid_note"]),
        "teamSelection",
      ),
    ).toEqual({ kind: "text", text: r.decision.noteInvalid, field: "note" });
    expect(
      claimedRefusalOf(
        failed("validation_failed", ["invalid_reason"]),
        "teamSelection",
      ),
    ).toEqual({
      kind: "text",
      text: r.decision.reasonInvalid,
      field: "reason",
    });
  });
});

describe("L3G-T12: the rail holds queue 9 for an agent and an admin", () => {
  it("opens the queue under Files, current on a request", () => {
    for (const role of ["agent", "admin"] as const) {
      const queues = navItemsOf(role).find((item) => item.key === "queues");
      expect(queues?.sections.map((section) => section.key)).toContain(
        "teamSelectionQueue",
      );
    }
    expect(activePlaceOf(`/files/selections-equipe/${ID}`)).toEqual({
      entry: "queues",
      section: "teamSelectionQueue",
    });
  });
});

describe("L3G-fix-1: the microcopy of the queue 9 (J6)", () => {
  it("J6: a closed request reads « Clôturée », « Autre » is short in a sentence, every reason has its short form", () => {
    for (const code of Object.keys(r.decision.reasons)) {
      expect(r.decision.reasonsShort[code], code).toBeDefined();
    }
    const view = teamSelectionViewOf(opening());
    expect(closedLines(view, "other")).toEqual([
      "Demande de Maison Aurore close : autre.",
    ]);
    const words = closureWords({
      closedAt: NOW,
      closedBy: null,
      reasonCode: "other",
      note: null,
    });
    expect(words.line).toMatch(/^Clôturée le .+ — motif : Autre.$/);
    expect(words.line).not.toContain("obligatoire");
    expect(JSON.stringify(messages.identifiedSearch)).not.toMatch(/Lot d/);
    expect(JSON.stringify(r.decision.noProposal)).not.toMatch(/lot d/i);
  });
});

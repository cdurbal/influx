// Queue 3, « visuels de portfolio à modérer », in words and in checks (docs/mvp/07 RG77 to RG85, RG93, RG95 to
// RG97; 15 RG27 C1 to C8; 17b §2.7 line 3; jalons/l2g/modele.md §1 points 2, 10, 12, §3 « 0244 »; L2G-16): pure
// functions of src/components/portfolio-queue-view.ts and portfolio-review-view.ts, without a browser. The
// database says who holds an entry, which version a decision binds and which reasons exist; these only word and
// gather: the filters and the words of a line (never a thumbnail), the entry that IS the visual given the shape
// of the claimed screens, the grid of RG79 as written, the reasons of the refusal, the checks of a decision.
import { INTERNAL_COMMENT_MAX_LENGTH } from "@influx/contracts/backoffice-queues";
import {
  PORTFOLIO_ENTRY_KINDS,
  type OpenPortfolioItemResponse,
  type PortfolioEntryRow,
  type PortfolioReviewReason,
} from "@influx/contracts/creator-queues";
import { describe, expect, it } from "vitest";
import {
  claimedModeOf,
  claimedRefusalOf,
} from "../src/components/claimed-entry-view";
import {
  depositedWords,
  kindWords,
  PORTFOLIO_REVIEW_LIST,
  portfolioOwnFilters,
  profileFilterHref,
  visualCountWords,
} from "../src/components/portfolio-queue-view";
import {
  alertLine,
  approveCheck,
  approvedLines,
  captionWords,
  closedLines,
  gridRows,
  portfolioFacts,
  portfolioViewOf,
  reasonChoices,
  rejectCheck,
  rejectedLines,
} from "../src/components/portfolio-review-view";
import { chipWords, filtersOf } from "../src/components/queue-view-model";
import { EMPTY_DRAFT } from "../src/components/verification-decision-view";
import { messages } from "../src/messages/fr";

const TOKEN = "c".repeat(64);
const ACCOUNT = "44444444-4444-4444-8444-444444444444";
const ITEM = "7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22";
const t = messages.portfolioReview;

const REASONS: PortfolioReviewReason[] = [
  {
    code: "caption_identifier",
    position: 8,
    gridControl: null,
    message: "La légende contient un pseudo, un @, un lien ou un nom.",
  },
  {
    code: "text_naming_account_or_brand",
    position: 4,
    gridControl: 4,
    message: "Un texte du visuel cite votre compte.",
  },
  {
    code: "watermark",
    position: 1,
    gridControl: 1,
    message: "Le visuel porte un filigrane.",
  },
];

function row(changes: Partial<PortfolioEntryRow> = {}): PortfolioEntryRow {
  return {
    id: ITEM,
    accountId: ACCOUNT,
    alias: "Créateur 4821",
    kind: "deposit",
    createdAt: "2026-11-10T08:00:00.000Z",
    slaDueAt: "2026-11-11T08:00:00.000Z",
    escalateAt: null,
    overdue: false,
    visualCount: 3,
    owner: null,
    claim: {
      holder: null,
      claimedAt: null,
      claimExpiresAt: null,
      heldByCaller: false,
    },
    alerts: [],
    ...changes,
  };
}

function opened(
  changes: Partial<OpenPortfolioItemResponse["item"]> = {},
  outcome: OpenPortfolioItemResponse["outcome"] = "claimed",
): OpenPortfolioItemResponse {
  return {
    asOf: "2026-11-10T10:00:00.000Z",
    outcome,
    reviewToken: outcome === "claimed" ? TOKEN : null,
    item: {
      id: ITEM,
      kind: "deposit",
      state: "pending",
      createdAt: "2026-11-10T08:00:00.000Z",
      slaDueAt: "2026-11-11T08:00:00.000Z",
      escalateAt: null,
      overdue: false,
      claim: {
        holder: null,
        claimedAt: null,
        claimExpiresAt: null,
        heldByCaller: true,
      },
      lastForcedRelease: null,
      decision: null,
      width: 1080,
      height: 1350,
      byteSize: 204_800,
      caption: "Mon plat du jour",
      brandDeclared: true,
      replaces: null,
      ...changes,
    },
    account: {
      id: ACCOUNT,
      alias: "Créateur 4821",
      countryCode: "FR",
      preferredLanguage: "fr",
      owner: null,
    },
    alerts: [],
    reasons: REASONS,
  };
}

describe("L2G-16 queue 3, the list: filters and words of a line (17b §2.7 line 3)", () => {
  it("offers the profile, which names a record and has no list, and the type, each option a code the API accepts", () => {
    const filters = portfolioOwnFilters();
    expect(filters.map((filter) => filter.key)).toEqual(["account", "kind"]);
    const [account, kind] = filters;
    expect(account?.options).toEqual([]);
    expect(account?.byIdentifier?.chipValue).toBe(
      messages.portfolioQueue.filters.accountChip,
    );
    expect(kind?.options.map((option) => option.value)).toEqual([
      ...PORTFOLIO_ENTRY_KINDS,
    ]);
    for (const option of kind?.options ?? []) {
      expect(option.label).not.toBe(option.value);
    }
  });

  it("keeps the profile of an address when it is an identifier, and drops anything else (15 RG121)", () => {
    const own = portfolioOwnFilters();
    const read = (value: string) => (name: string) =>
      name === "account" ? value : null;
    expect(filtersOf(read(ACCOUNT), own)).toEqual({ account: ACCOUNT });
    expect(filtersOf(read("not-an-identifier"), own)).toEqual({});
    // the chip says what the filter is, without an identifier in the words (a link that names one record)
    expect(chipWords("account", ACCOUNT, own)).toEqual({
      name: messages.portfolioQueue.filters.account,
      value: messages.portfolioQueue.filters.accountChip,
    });
    expect(
      filtersOf((name) => (name === "kind" ? "replacement" : null), own),
    ).toEqual({ kind: "replacement" });
    expect(
      filtersOf((name) => (name === "kind" ? "other" : null), own),
    ).toEqual({});
  });

  it("leads the alias of a row to the visuals of that profile alone", () => {
    expect(profileFilterHref(ACCOUNT)).toBe(
      `${PORTFOLIO_REVIEW_LIST}?account=${ACCOUNT}`,
    );
  });

  it("words the kind, the date of the deposit and the visuals of the profile; the list holds no thumbnail, caption or handle", () => {
    expect(kindWords("deposit")).toBe("Premier dépôt");
    expect(kindWords("replacement")).toBe("Remplacement");
    expect(depositedWords(row())).toMatch(/10/);
    expect(visualCountWords(row({ visualCount: 1 }))).toBe("1 visuel");
    expect(visualCountWords(row({ visualCount: 8 }))).toBe("8 visuels");
    expect(Object.keys(row()).sort()).toEqual(
      [
        "accountId",
        "alerts",
        "alias",
        "claim",
        "createdAt",
        "escalateAt",
        "id",
        "kind",
        "overdue",
        "owner",
        "slaDueAt",
        "visualCount",
      ].sort(),
    );
  });
});

describe("L2G-16 queue 3, the entry that IS the visual, given the shape of the claimed screens", () => {
  it("reads a pending visual as an open entry and a decided or withdrawn one as a closed entry", () => {
    expect(portfolioViewOf(opened()).entry.state).toBe("open");
    expect(claimedModeOf(portfolioViewOf(opened()))).toBe("deciding");
    for (const state of ["approved", "rejected", "withdrawn"] as const) {
      const view = portfolioViewOf(opened({ state }, "closed"));
      expect(view.entry.state).toBe(state);
      expect(claimedModeOf(view)).toBe("closed");
    }
  });

  it("reads an entry held by a colleague as read-only, never as deciding", () => {
    const view = portfolioViewOf(
      opened(
        {
          claim: {
            holder: { accountId: ACCOUNT, displayName: "Alice" },
            claimedAt: "2026-11-10T09:00:00.000Z",
            claimExpiresAt: "2026-11-10T09:30:00.000Z",
            heldByCaller: false,
          },
        },
        "read_only",
      ),
    );
    expect(claimedModeOf(view)).toBe("readOnly");
  });

  it("carries the claim, the deadlines and the identifier of the visual, nothing else of it", () => {
    const view = portfolioViewOf(opened({ overdue: true }));
    expect(view.entry).toEqual({
      id: ITEM,
      state: "open",
      slaDueAt: "2026-11-11T08:00:00.000Z",
      escalateAt: null,
      overdue: true,
      claim: view.item.claim,
      lastForcedRelease: null,
    });
  });

  it("tells a replacement that cannot take the place of its original as a sentence, not an error screen (07 RG81)", () => {
    const refusal = claimedRefusalOf(
      { kind: "failed", code: "conflict", issues: ["not_replaceable"] },
      "portfolio",
    );
    expect(refusal).toEqual({
      kind: "text",
      text: messages.claimedReview.refusals.notReplaceable,
      field: null,
    });
  });
});

describe("L2G-16 queue 3, the decision screen: the visual, its profile and its caption", () => {
  it("shows an alias, a country and the kind, never a handle, a figure or an address", () => {
    const facts = portfolioFacts(opened());
    const value = (key: string) =>
      facts.find((fact) => fact.key === key)?.value;
    expect(value("alias")).toBe("Créateur 4821");
    expect(value("country")).toBe("France");
    expect(value("language")).toBe("français");
    expect(value("kind")).toBe("Premier dépôt");
    expect(value("size")).toBe("1080 × 1350 px · 200 Ko");
    expect(value("replaces")).toBeUndefined();
  });

  it("names the approved visual a replacement takes the place of, by its place in the order and its caption (07 RG81)", () => {
    const facts = portfolioFacts(
      opened({
        kind: "replacement",
        replaces: { id: ACCOUNT, displayOrder: 2, caption: " Avant " },
      }),
    );
    expect(facts.find((fact) => fact.key === "replaces")?.value).toContain(
      "visuel 2 (légende : Avant)",
    );
    const waiting = portfolioFacts(
      opened({
        replaces: { id: ACCOUNT, displayOrder: null, caption: null },
      }),
    );
    expect(
      waiting.find((fact) => fact.key === "replaces")?.value,
    ).not.toContain("légende");
  });

  it("says the caption and whether the creator declared the right to name a brand in it (07 RG82, RG83)", () => {
    expect(captionWords(opened())).toEqual({
      caption: "Mon plat du jour",
      declaration: t.caption.declared,
    });
    expect(
      captionWords(opened({ caption: null, brandDeclared: false })),
    ).toEqual({ caption: t.caption.none, declaration: t.caption.notDeclared });
    expect(captionWords(opened({ caption: "  " })).caption).toBe(
      t.caption.none,
    );
  });

  it("writes an alert in a sentence naming the caption and the kind of signal, never the text that matched", () => {
    const line = alertLine({
      code: "direct_contact",
      field: "portfolio_caption",
      rowKey: ITEM,
      signals: ["email", "url"],
    });
    expect(line).toBe(
      t.alerts.direct_contact(t.alerts.captionField, "adresse e-mail, lien"),
    );
  });
});

describe("L2G-16 queue 3, the grid of RG79 as written (07 RG79, RG82, RG83)", () => {
  it("shows the nine controls in order, the face rule (6) and the metadata rule (8) included", () => {
    const rows = gridRows();
    expect(rows.map((control) => control.number)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    expect(rows.find((control) => control.number === 6)?.label).toMatch(
      /Visage : admis/,
    );
    expect(rows.find((control) => control.number === 8)?.label).toMatch(
      /Métadonnées : supprimées au dépôt/,
    );
  });

  it("gives a refusal reason to every control but 6 and 8, and none of them twice", () => {
    const rows = gridRows();
    expect(
      rows.filter((control) => control.code === null).map((c) => c.number),
    ).toEqual([6, 8]);
    const codes = rows.flatMap((control) =>
      control.code === null ? [] : [control.code],
    );
    expect(new Set(codes).size).toBe(codes.length);
    for (const control of rows) {
      expect(control.rule).toBe(
        control.code === null ? t.grid.noRefusal : t.grid.refusedIf,
      );
    }
  });

  it("labels each reason of the grid with the words of the grid, so that the radio buttons read as the table does", () => {
    for (const control of gridRows()) {
      if (control.code !== null) {
        expect(t.decision.reasonLabels[control.code]).toBe(control.label);
      }
    }
    for (const control of t.grid.captionRows) {
      expect(t.decision.reasonLabels[control.code]).toBe(control.label);
    }
  });
});

describe("L2G-16 queue 3, the refusal: a reason of the grid, no message (07 RG79, RG97)", () => {
  it("lists the reasons in the order of the database, each under the number of its control, the caption reasons alone", () => {
    const choices = reasonChoices(REASONS);
    expect(choices.map((choice) => choice.code)).toEqual([
      "watermark",
      "text_naming_account_or_brand",
      "caption_identifier",
    ]);
    expect(choices[0]?.label).toBe("1 · Filigrane, signature, logo personnel");
    expect(choices[1]?.label.startsWith("4 · ")).toBe(true);
    expect(choices[2]?.label).toBe("Légende : élément identifiant");
    expect(choices[0]?.message).toBe("Le visuel porte un filigrane.");
  });

  it("refuses without a reason of the list the opening returned, and says so on the reason", () => {
    for (const code of [null, "illicit_content"] as const) {
      expect(rejectCheck(EMPTY_DRAFT, code, REASONS, TOKEN)).toEqual({
        ok: false,
        problem: { field: "reason", text: t.decision.reasonRequired },
      });
    }
  });

  it("sends the version examined, the reason and the internal comment alone: never a message to the creator", () => {
    expect(rejectCheck(EMPTY_DRAFT, "watermark", REASONS, TOKEN)).toEqual({
      ok: true,
      body: { reviewToken: TOKEN, reasonCode: "watermark" },
    });
    const checked = rejectCheck(
      { ...EMPTY_DRAFT, memberMessage: "bonjour", internalComment: " note " },
      "watermark",
      REASONS,
      TOKEN,
    );
    expect(checked).toEqual({
      ok: true,
      body: {
        reviewToken: TOKEN,
        reasonCode: "watermark",
        internalComment: "note",
      },
    });
    expect(JSON.stringify(checked)).not.toContain("bonjour");
  });

  it("approves with the version examined and a comment only when it holds something, within its bound", () => {
    expect(approveCheck(EMPTY_DRAFT, TOKEN)).toEqual({
      ok: true,
      body: { reviewToken: TOKEN },
    });
    expect(
      approveCheck({ ...EMPTY_DRAFT, internalComment: "  " }, TOKEN),
    ).toEqual({ ok: true, body: { reviewToken: TOKEN } });
    expect(
      approveCheck({ ...EMPTY_DRAFT, internalComment: "RAS" }, TOKEN),
    ).toEqual({
      ok: true,
      body: { reviewToken: TOKEN, internalComment: "RAS" },
    });
    const tooLong = "x".repeat(INTERNAL_COMMENT_MAX_LENGTH + 1);
    for (const checked of [
      approveCheck({ ...EMPTY_DRAFT, internalComment: tooLong }, TOKEN),
      rejectCheck(
        { ...EMPTY_DRAFT, internalComment: tooLong },
        "watermark",
        REASONS,
        TOKEN,
      ),
    ]) {
      expect(checked.ok).toBe(false);
      if (!checked.ok) {
        expect(checked.problem.field).toBe("internalComment");
      }
    }
  });
});

describe("L2G-16 queue 3, a closed entry and the exit (07 RG78; 15 C8; 17b §2.6)", () => {
  it("says how a visual left the queue, by whom, after its deadline or not, and with which reason of the grid", () => {
    const decided = (state: "approved" | "rejected") =>
      closedLines(
        opened({
          state,
          decision: {
            decidedAt: "2026-11-10T11:00:00.000Z",
            decidedBy: { accountId: ACCOUNT, displayName: "Alice" },
            late: true,
            rejectionReasonCode: state === "rejected" ? "watermark" : null,
            internalComment: null,
          },
        }),
      );
    const approved = decided("approved");
    expect(approved[0]).toBe(t.closed.approved);
    expect(approved[1]).toContain("Alice");
    expect(approved).toContain(t.closed.late);
    const rejected = decided("rejected");
    expect(rejected[0]).toBe(t.closed.rejected);
    expect(rejected.at(-1)).toBe(
      t.closed.reason("Filigrane, signature, logo personnel"),
    );
    expect(closedLines(opened({ state: "withdrawn" }))).toEqual([
      t.closed.withdrawn,
    ]);
  });

  it("confirms what was decided in a sentence, and marks a decision made after its deadline", () => {
    const view = opened();
    expect(approvedLines(view, false)).toEqual([
      t.decision.approvedNotice("Créateur 4821"),
    ]);
    expect(rejectedLines(view, "watermark", true)).toEqual([
      t.decision.rejectedNotice(
        "Créateur 4821",
        "filigrane, signature, logo personnel",
      ),
      messages.creatorReview.decision.lateMark,
    ]);
  });
});

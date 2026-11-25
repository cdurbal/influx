// The rules of block 6 of "mon profil" (creator), the portfolio, that are not apps/api's, and of the
// card of the publication (docs/mvp/07 RG4, RG5, RG8, RG10, RG77 to RG84, RG90, RG96; 17 §5.2; jalons/
// l2g, commit 13): which message a failed deposit calls for, what the browser stops before sending,
// what the list shows and in which order, the order the API takes after a move, the caption sent, the
// state of the card, the refusal told, where the button leads, and the translations of both blocks
// (every code of the contracts has its text, and the screen says what the e-mails say, EC-L2G-10-1).
// Pure functions, no browser.
import {
  PORTFOLIO_CONFLICT_ISSUES,
  PORTFOLIO_MAX_UPLOAD_BYTES,
  PORTFOLIO_REJECTION_REASON_CODES,
  PORTFOLIO_UPLOAD_REJECTIONS,
  type PortfolioItem,
} from "@influx/contracts/creator-portfolio";
import {
  CREATOR_MODERATED_FIELDS,
  CREATOR_REJECTION_REASON_CODES,
} from "@influx/contracts/creator-profile";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  captionPlanOf,
  captionSaveOf,
  orderAfterMove,
  placedIdsOf,
  portfolioFailureOf,
  portfolioFileProblem,
  portfolioViewOf,
} from "@/components/creator-profile/creator-portfolio-view";
import { isEditable } from "@/components/creator-profile/creator-profile-view";
import {
  accountVerifiedOf,
  firstMissingAnchorOf,
  frozenNoticeKeyOf,
  hasPublicationNotices,
  pendingFieldsOf,
  PROFILE_PARTS_ORDER,
  publicationModeOf,
  refusalViewOf,
} from "@/components/creator-profile/creator-publication-view";
import enCreatorProfile from "@/locales/en/creator-profile.json";
import frCreatorProfile from "@/locales/fr/creator-profile.json";

const ID = (digit: string) =>
  `${digit.repeat(8)}-aaaa-4aaa-8aaa-${digit.repeat(12)}`;

function item(
  overrides: Partial<PortfolioItem> & { id: string },
): PortfolioItem {
  return {
    state: "approved",
    displayOrder: null,
    caption: null,
    brandDeclared: false,
    width: 1080,
    height: 1350,
    byteSize: 90_000,
    replacesItemId: null,
    replacementPending: false,
    captionPending: false,
    reasonCode: null,
    deleteAfter: null,
    createdAt: "2026-11-10T10:00:00.000Z",
    decidedAt: null,
    ...overrides,
  };
}

describe("L2G-13: what a deposit that did not work calls for (07 RG77, RG81, RG111)", () => {
  it("names the reason of a refused file, one message per reason of the API", () => {
    for (const reason of PORTFOLIO_UPLOAD_REJECTIONS) {
      expect(
        portfolioFailureOf({ code: "image_rejected", issues: [reason] }),
        reason,
      ).toBe(reason);
    }
    // an unknown reason is an image that cannot be read, never an empty message
    expect(
      portfolioFailureOf({ code: "image_rejected", issues: ["other"] }),
    ).toBe("undecodable");
    expect(portfolioFailureOf({ code: "image_rejected" })).toBe("undecodable");
  });

  it("names the issue of a 409, and any other 409 as a conflict", () => {
    for (const issue of PORTFOLIO_CONFLICT_ISSUES) {
      expect(portfolioFailureOf({ code: "conflict", issues: [issue] })).toBe(
        issue,
      );
    }
    expect(portfolioFailureOf({ code: "conflict" })).toBe("conflict");
    expect(portfolioFailureOf({ code: "conflict", issues: ["x"] })).toBe(
      "conflict",
    );
  });

  it("tells the quota and the size, and leaves the rest to the service not answering", () => {
    expect(portfolioFailureOf({ code: "upload_quota_exceeded" })).toBe("quota");
    expect(portfolioFailureOf({ code: "payload_too_large" })).toBe("tooLarge");
    expect(portfolioFailureOf({ code: "service_unavailable" })).toBe(
      "unavailable",
    );
    expect(portfolioFailureOf({})).toBe("unavailable");
  });

  it("stops in the browser only a file with nothing to read or over 8 MiB", () => {
    expect(portfolioFileProblem(0)).toBe("empty");
    expect(portfolioFileProblem(1)).toBeNull();
    expect(portfolioFileProblem(PORTFOLIO_MAX_UPLOAD_BYTES)).toBeNull();
    expect(portfolioFileProblem(PORTFOLIO_MAX_UPLOAD_BYTES + 1)).toBe(
      "tooLarge",
    );
  });
});

describe("L2G-13: what the list shows (07 RG78, RG81, RG84)", () => {
  it("lists the pending and approved visuals in the creator's order and the refused ones apart, latest first", () => {
    const view = portfolioViewOf([
      item({ id: ID("1"), state: "pending", displayOrder: 3 }),
      item({ id: ID("2"), state: "approved", displayOrder: 1 }),
      item({ id: ID("3"), state: "approved", displayOrder: 2 }),
      item({
        id: ID("4"),
        state: "rejected",
        reasonCode: "watermark",
        createdAt: "2026-11-09T10:00:00.000Z",
      }),
      item({
        id: ID("5"),
        state: "rejected",
        reasonCode: "handle_in_image",
        createdAt: "2026-11-11T10:00:00.000Z",
      }),
      item({ id: ID("6"), state: "withdrawn" }),
      item({ id: ID("7"), state: "purging" }),
    ]);
    expect(view.placed.map((shown) => shown.item.id)).toEqual([
      ID("2"),
      ID("3"),
      ID("1"),
    ]);
    expect(view.placed.map((shown) => shown.state)).toEqual([
      "approved",
      "approved",
      "pending",
    ]);
    expect(view.refused.map((shown) => shown.item.id)).toEqual([
      ID("5"),
      ID("4"),
    ]);
  });

  it("shows a pending replacement beside its approved visual, not as a place of its own (RG81)", () => {
    const view = portfolioViewOf([
      item({
        id: ID("1"),
        state: "approved",
        displayOrder: 1,
        replacementPending: true,
      }),
      item({ id: ID("2"), state: "pending", replacesItemId: ID("1") }),
    ]);
    expect(view.placed).toHaveLength(1);
    expect(view.placed[0]?.replacement?.id).toBe(ID("2"));
  });

  it("keeps a pending visual whose original is no longer approved as a place of its own", () => {
    const view = portfolioViewOf([
      item({
        id: ID("2"),
        state: "pending",
        displayOrder: 1,
        replacesItemId: ID("1"),
      }),
    ]);
    expect(view.placed).toHaveLength(1);
    expect(view.placed[0]?.replacement).toBeNull();
  });
});

describe("L2G-13: the order the API takes (07 RG84)", () => {
  const items = [
    item({ id: ID("1"), state: "pending", displayOrder: 2 }),
    item({ id: ID("2"), displayOrder: 1 }),
    item({ id: ID("3"), displayOrder: 3 }),
    item({ id: ID("4"), state: "rejected" }),
    item({ id: ID("5"), state: "pending", replacesItemId: ID("2") }),
  ];

  it("lists every placed visual once, in the creator's order, and nothing else", () => {
    expect(placedIdsOf(items)).toEqual([ID("2"), ID("1"), ID("3")]);
  });

  it("moves a visual by one place, and says nothing to send at the end it moves to", () => {
    const ids = [ID("2"), ID("1"), ID("3")];
    expect(orderAfterMove(ids, ID("1"), -1)).toEqual([
      ID("1"),
      ID("2"),
      ID("3"),
    ]);
    expect(orderAfterMove(ids, ID("1"), 1)).toEqual([
      ID("2"),
      ID("3"),
      ID("1"),
    ]);
    expect(orderAfterMove(ids, ID("2"), -1)).toBeNull();
    expect(orderAfterMove(ids, ID("3"), 1)).toBeNull();
    expect(orderAfterMove(ids, ID("9"), 1)).toBeNull();
    expect(ids).toEqual([ID("2"), ID("1"), ID("3")]);
  });
});

describe("L2G-13: the caption sent (07 RG82, RG83)", () => {
  it("sends a blank as no caption, and drops the declaration that means nothing without one", () => {
    expect(captionPlanOf({ caption: "   ", brandDeclared: true })).toEqual({
      ok: true,
      body: { caption: null, brandDeclared: false },
    });
  });

  it("sends a caption as typed, trimmed, with the box as ticked and never pre-ticked", () => {
    expect(
      captionPlanOf({ caption: " Mon plat du jour ", brandDeclared: false }),
    ).toEqual({
      ok: true,
      body: { caption: "Mon plat du jour", brandDeclared: false },
    });
    expect(
      captionPlanOf({ caption: "Avec une marque", brandDeclared: true }),
    ).toEqual({
      ok: true,
      body: { caption: "Avec une marque", brandDeclared: true },
    });
  });

  it("refuses a caption over 200 characters or on two lines, with the schema of the API", () => {
    expect(
      captionPlanOf({ caption: "a".repeat(200), brandDeclared: false }).ok,
    ).toBe(true);
    expect(
      captionPlanOf({ caption: "a".repeat(201), brandDeclared: false }),
    ).toEqual({ ok: false, issue: "invalid" });
    expect(
      captionPlanOf({ caption: "une\nligne", brandDeclared: false }),
    ).toEqual({ ok: false, issue: "invalid" });
  });
});

describe("L2GU-5: the caption not yet saved is told (07 RG9)", () => {
  const base = { caption: "Mon plat", brandDeclared: false };

  it("tells nothing and keeps the button secondary while the caption is as saved", () => {
    expect(captionSaveOf(base, base, false)).toEqual({
      unsaved: false,
      variant: "secondary",
    });
  });

  it("tells a changed caption or a changed box, and turns the button primary", () => {
    expect(
      captionSaveOf({ ...base, caption: "Mon plat du jour" }, base, false),
    ).toEqual({ unsaved: true, variant: "primary" });
    expect(
      captionSaveOf({ ...base, brandDeclared: true }, base, false),
    ).toEqual({ unsaved: true, variant: "primary" });
  });

  it("still tells the change when a gesture runs or the profile is frozen, but leaves the button secondary", () => {
    expect(captionSaveOf({ ...base, caption: "Autre" }, base, true)).toEqual({
      unsaved: true,
      variant: "secondary",
    });
  });
});

describe("L2G-13: the card of the publication (07 RG4, RG5, RG9, RG10)", () => {
  it("offers the button to a draft and to a refused profile, the answer to a waiting one", () => {
    expect(publicationModeOf("draft")).toBe("submit");
    expect(publicationModeOf("rejected")).toBe("submit");
    expect(publicationModeOf("pending_review")).toBe("waiting");
    expect(publicationModeOf("published")).toBe("published");
    expect(publicationModeOf("suspended")).toBe("suspended");
  });

  it("lets the creator edit a draft, a refused and a published profile, and freezes a waiting and a suspended one (RG9, RG10)", () => {
    const alias = "7K3M9X";
    expect(isEditable({ alias, status: "draft" })).toBe(true);
    expect(isEditable({ alias, status: "rejected" })).toBe(true);
    expect(isEditable({ alias, status: "published" })).toBe(true);
    expect(isEditable({ alias, status: "pending_review" })).toBe(false);
    expect(isEditable({ alias, status: "suspended" })).toBe(false);
    expect(isEditable({ alias: null, status: "published" })).toBe(false);
  });

  it("tells a refused submission while the profile is refused, a refused revision while it is published", () => {
    const refusal = {
      kind: "submission" as const,
      reasonCode: "bio_insufficient" as const,
      nextStep: "fix" as const,
      memberMessage: null,
      decidedAt: "2026-11-11T10:00:00.000Z",
    };
    expect(refusalViewOf({ status: "rejected", refusal })).toEqual({
      kind: "submission",
      reasonKey: "rejection.bio_insufficient",
      nextStep: "fix",
      memberMessage: null,
    });
    // submitted again, or published since: the old refusal is told no more
    expect(refusalViewOf({ status: "pending_review", refusal })).toBeNull();
    expect(refusalViewOf({ status: "published", refusal })).toBeNull();
    const revision = { ...refusal, kind: "revision" as const };
    expect(
      refusalViewOf({ status: "published", refusal: revision })?.kind,
    ).toBe("revision");
    expect(refusalViewOf({ status: "rejected", refusal: revision })).toBeNull();
    expect(refusalViewOf({ status: "draft", refusal: null })).toBeNull();
  });

  it("carries the free message of the reason `other` and nothing else of the agent", () => {
    const view = refusalViewOf({
      status: "rejected",
      refusal: {
        kind: "submission",
        reasonCode: "other",
        nextStep: "contact",
        memberMessage: "Merci de nous écrire à propos de votre profil.",
        decidedAt: "2026-11-11T10:00:00.000Z",
      },
    });
    expect(view?.memberMessage).toBe(
      "Merci de nous écrire à propos de votre profil.",
    );
    expect(Object.keys(view ?? {}).sort()).toEqual([
      "kind",
      "memberMessage",
      "nextStep",
      "reasonKey",
    ]);
  });

  it("names the fields whose change waits, each once, in the order the API gives them", () => {
    expect(
      pendingFieldsOf([
        { field: "bio", rowKey: null },
        { field: "portfolio_caption", rowKey: ID("1") },
        { field: "portfolio_caption", rowKey: ID("2") },
        { field: "headline", rowKey: null },
      ]),
    ).toEqual(["bio", "portfolio_caption", "headline"]);
    expect(pendingFieldsOf([])).toEqual([]);
  });

  it("leads to the section of the first field missing, and to none when nothing is", () => {
    expect(firstMissingAnchorOf(["bio", "portfolio"])).toBe(
      "creator-section-presentation",
    );
    expect(firstMissingAnchorOf(["portfolio", "accountVerified"])).toBe(
      "creator-section-portfolio",
    );
    expect(firstMissingAnchorOf(["accountVerified"])).toBe(
      "creator-section-trust",
    );
    expect(firstMissingAnchorOf([])).toBeNull();
  });

  it("reads the verified account from what is no longer missing (08 RG16)", () => {
    expect(accountVerifiedOf(["bio"])).toBe(true);
    expect(accountVerifiedOf(["bio", "accountVerified"])).toBe(false);
  });

  it("keeps the document in the order the summary needs: refusal, completeness, summary, form, notices, then the action (L2GU-1)", () => {
    expect([...PROFILE_PARTS_ORDER]).toEqual([
      "refusal",
      "progress",
      "summary",
      "form",
      "notices",
      "action",
    ]);
  });

  it("tells why the form is frozen for a profile under review and for a suspended one, and for no other (L2GU-3)", () => {
    expect(frozenNoticeKeyOf("pending_review")).toBe("frozen.pending_review");
    expect(frozenNoticeKeyOf("suspended")).toBe("frozen.suspended");
    for (const status of ["draft", "rejected", "published"] as const) {
      expect(frozenNoticeKeyOf(status), status).toBeNull();
    }
  });

  it("keeps the answer awaited and the changes waiting out of the sticky card, and shows none when nothing waits (L2GU-2)", () => {
    const revision = [{ field: "bio" as const, rowKey: null }];
    expect(
      hasPublicationNotices({ status: "pending_review", pendingRevisions: [] }),
    ).toBe(true);
    expect(
      hasPublicationNotices({
        status: "published",
        pendingRevisions: revision,
      }),
    ).toBe(true);
    expect(
      hasPublicationNotices({ status: "published", pendingRevisions: [] }),
    ).toBe(false);
    expect(
      hasPublicationNotices({ status: "draft", pendingRevisions: revision }),
    ).toBe(false);
  });
});

describe("L2G-13: the translations of the blocks (07 RG112; textes.md; EC-L2G-10-1)", () => {
  const messages = { fr: frCreatorProfile, en: enCreatorProfile } as const;

  function keysOf(value: unknown, prefix = ""): string[] {
    if (typeof value !== "object" || value === null) {
      return [prefix];
    }
    return Object.entries(value).flatMap(([key, child]) =>
      keysOf(child, prefix === "" ? key : `${prefix}.${key}`),
    );
  }

  it("holds the same keys in French and in English", () => {
    expect(keysOf(messages.en).sort()).toEqual(keysOf(messages.fr).sort());
  });

  it("holds a text for every code of the contracts the screen tells", () => {
    for (const locale of ["fr", "en"] as const) {
      const own = messages[locale];
      for (const code of PORTFOLIO_REJECTION_REASON_CODES) {
        expect(own.portfolio.reason[code], `${locale} ${code}`).toBeTruthy();
      }
      for (const code of CREATOR_REJECTION_REASON_CODES) {
        expect(own.rejection[code], `${locale} ${code}`).toBeTruthy();
      }
      for (const code of [
        ...PORTFOLIO_UPLOAD_REJECTIONS,
        ...PORTFOLIO_CONFLICT_ISSUES,
        "tooLarge",
        "quota",
        "conflict",
        "unavailable",
        "captionInvalid",
      ] as const) {
        expect(own.portfolio.errors[code], `${locale} ${code}`).toBeTruthy();
      }
      for (const field of CREATOR_MODERATED_FIELDS) {
        expect(own.revisionField[field], `${locale} ${field}`).toBeTruthy();
      }
      for (const status of [
        "draft",
        "pending_review",
        "published",
        "rejected",
        "suspended",
      ] as const) {
        expect(own.state[status], `${locale} ${status}`).toBeTruthy();
      }
    }
  });

  it("keeps the refusal of a change in two sentences: the reason alone, then what stays published (L2GU-7)", () => {
    for (const locale of ["fr", "en"] as const) {
      const { status } = messages[locale];
      expect(status.revisionRejected, locale).toMatch(/{reason}$/);
      expect(status.revisionRejected, locale).not.toBe("");
      expect(status.revisionKept, locale).toBeTruthy();
      expect(status.revisionRejected, locale).not.toContain(
        status.revisionKept,
      );
    }
  });

  it("explains the frozen form, the review before publication and the box of the brand (L2GU-3, L2GU-16)", () => {
    expect(messages.fr.frozen.pending_review).toBe(
      "Votre profil est en cours de validation : il ne peut pas être modifié avant la réponse de l'équipe INFLUX.",
    );
    expect(messages.fr.publish.review).toBe(
      "Un commercial INFLUX relit votre profil avant de le publier.",
    );
    expect(messages.fr.portfolio.brandConsentHelp).toBe(
      "Sans cette case, la légende est publiée sans le nom de la marque, ou refusée.",
    );
    for (const locale of ["fr", "en"] as const) {
      expect(messages[locale].frozen.suspended, locale).toBeTruthy();
    }
  });

  it("names each gesture of a card with its position, and writes the removal in two steps (L2GU-4, L2GU-18)", () => {
    for (const locale of ["fr", "en"] as const) {
      const { portfolio } = messages[locale];
      for (const key of [
        "removeNamed",
        "removeNow",
        "removeKeepNamed",
        "replaceNamed",
        "saveCaptionNamed",
      ] as const) {
        expect(portfolio[key], `${locale} ${key}`).toContain("{position}");
      }
      expect(portfolio.removeConfirm, locale).toMatch(/\?$/);
      expect(portfolio.removeKeep, locale).toBeTruthy();
      expect(portfolio.unsaved, locale).toBeTruthy();
    }
    expect(messages.fr.portfolio.errors.quota).toMatch(
      /Réessayez plus tard\.$/,
    );
    expect(messages.en.portfolio.errors.quota).toMatch(/try again later\.$/);
  });

  it("says the label of the draft as the founder chose it (L2DU-15)", () => {
    expect(messages.fr.state.draft).toBe("En cours de saisie");
    expect(messages.en.state.draft).toBe("In progress");
  });

  it("says on the screen what the e-mails of the decisions say, at sign included (EC-L2G-10-1)", () => {
    for (const locale of ["fr", "en"] as const) {
      const email = JSON.parse(
        readFileSync(`../api/src/locales/${locale}/email.json`, "utf8"),
      ) as {
        email: {
          creatorProfileDecision: {
            reason: Record<string, string>;
            nextStep: Record<string, string>;
          };
          portfolioDecision: { reason: Record<string, string> };
        };
      };
      const own = messages[locale];
      for (const code of CREATOR_REJECTION_REASON_CODES) {
        expect(own.rejection[code], `${locale} ${code}`).toBe(
          email.email.creatorProfileDecision.reason[code],
        );
      }
      for (const code of PORTFOLIO_REJECTION_REASON_CODES) {
        expect(own.portfolio.reason[code], `${locale} ${code}`).toBe(
          email.email.portfolioDecision.reason[code],
        );
      }
      expect(own.refusal.fix).toBe(
        email.email.creatorProfileDecision.nextStep.fix,
      );
      expect(own.refusal.contact).toBe(
        email.email.creatorProfileDecision.nextStep.contact,
      );
      // no sign of an address, a link or a handle in the texts of the screen (RG158, D69)
      const texts = [
        ...Object.values(own.rejection),
        ...Object.values(own.portfolio.reason),
      ];
      for (const text of texts) {
        expect(text).not.toMatch(/[@]|https?:/);
      }
    }
  });
});

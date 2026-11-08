// What the screens of the verification of a creator's account show, decided outside the components
// (docs/mvp/08 RG1 to RG7, RG10, RG12, RG13, RG32, RG34, RG56, RG57, RG60, RG87, RG93, RG96; jalons/l2e,
// commits 18 and 19): the state of
// a network line, a row per level and never a global badge; the step of the journey read back from the
// API; the written label of a badge; the text and the next step of a refusal; the failure of a call and
// the delay left; the dates; the translation files against RG93, mot pour mot, and against the words
// a badge never carries (RG6). Pure functions and files, no browser.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CREATOR_REJECTION_REASON_CODES,
  VERIFICATION_EVIDENCE_REJECTIONS,
  type CreatorVerificationLine,
  type OwnBadge,
  type OwnEvidence,
  type OwnRefusal,
  type OwnRequest,
} from "@influx/contracts/verification";
import { describe, expect, it } from "vitest";
import {
  AUDIENCE_CTA_KEYS,
  AUDIENCE_STEP_COUNT,
  EVIDENCE_MAX_MEBIBYTES,
  OWNERSHIP_STEP_COUNT,
  audienceActionOf,
  audienceJourneyOf,
  audienceStepNumberOf,
  badgeKeysOf,
  canRestartOwnership,
  evidenceFailureOf,
  evidenceFileProblem,
  expectedPieceKeyOf,
  failureOf,
  formatByteSize,
  formatCalendarDay,
  formatDelay,
  formatVerificationDate,
  hostLineIdsOf,
  isCancellable,
  isOwnershipEstablished,
  levelRowOf,
  lineOfNetwork,
  missingIdentifierOf,
  ownershipActionOf,
  ownershipJourneyOf,
  refusalViewOf,
  stepNumberOf,
} from "@/components/verification/verification-view";
import enVerification from "@/locales/en/verification.json";
import frVerification from "@/locales/fr/verification.json";

const REQUEST_ID = "5c1f0a3e-8a47-4c0b-9b53-0e2b9a1d7f10";
const BADGE_AT = "2026-03-03T10:15:00Z";

function badge(
  level: OwnBadge["level"],
  state: OwnBadge["state"],
  extra: Partial<OwnBadge> = {},
): OwnBadge {
  return {
    level,
    networkCode: "instagram",
    state,
    grantedAt: BADGE_AT,
    periodStart: null,
    periodEnd: null,
    evidenceSource:
      level === "audience_verified" ? "native_dashboard" : "public_profile",
    expiresAt: null,
    ...extra,
  };
}

function request(
  status: OwnRequest["status"],
  extra: Partial<OwnRequest> = {},
): OwnRequest {
  return {
    id: REQUEST_ID,
    level: "account_verified",
    status,
    networkCode: "instagram",
    createdAt: "2026-03-01T09:00:00Z",
    submittedAt: null,
    code: null,
    evidence: [],
    refusal: null,
    ...extra,
  };
}

function refused(
  reasonCode: OwnRefusal["reasonCode"],
  message = "",
): OwnRequest {
  return request("rejected", {
    submittedAt: "2026-03-01T09:05:00Z",
    refusal: { reasonCode, message, decidedAt: "2026-03-02T08:00:00Z" },
  });
}

function line(
  badges: OwnBadge[] = [],
  requests: OwnRequest[] = [],
): CreatorVerificationLine {
  return { networkCode: "instagram", badges, requests };
}

const LIVE_CODE = {
  code: "INFLUX-K7M2QX9A",
  expiresAt: "2026-03-08T09:00:00Z",
} as const;

const SENT = { submittedAt: "2026-03-01T09:05:00Z" } as const;

describe("a row per level of a network line (08 RG13)", () => {
  it("finds the line of a network, or none, and reads each level on its own", () => {
    const held = line(
      [badge("account_verified", "active")],
      [
        request("pending", {
          level: "audience_verified",
          submittedAt: "2026-03-04T08:00:00Z",
        }),
      ],
    );
    expect(lineOfNetwork([held], "instagram")).toBe(held);
    expect(lineOfNetwork([held], "tiktok")).toBeNull();
    const account = levelRowOf(held, "account_verified");
    const audience = levelRowOf(held, "audience_verified");
    expect(account.badge?.level).toBe("account_verified");
    expect(account.request).toBeNull();
    expect(audience.badge).toBeNull();
    expect(audience.request?.kind).toBe("requested");
  });

  it("reads each status of a request as the row writes it, a withdrawn or granted one as nothing", () => {
    const kind = (
      status: OwnRequest["status"],
      extra: Partial<OwnRequest> = {},
    ) =>
      levelRowOf(line([], [request(status, extra)]), "account_verified").request
        ?.kind ?? null;
    expect(kind("draft", { code: LIVE_CODE })).toBe("started");
    expect(kind("pending", SENT)).toBe("requested");
    expect(kind("expired")).toBe("expired");
    expect(kind("cancelled")).toBeNull();
    expect(kind("approved")).toBeNull();
    // a refusal is a refusal only with its reason; a closure for an unavailable account reads alike
    expect(
      kind("closed", {
        refusal: {
          reasonCode: "account_unavailable",
          message: "",
          decidedAt: "2026-03-02T08:00:00Z",
        },
      }),
    ).toBe("refused");
    expect(kind("rejected")).toBeNull();
  });

  it("dates a request sent by its submission and a draft by its creation", () => {
    const sent = levelRowOf(
      line([], [request("pending", SENT)]),
      "account_verified",
    ).request;
    expect(sent?.kind === "requested" && sent.since).toBe(
      "2026-03-01T09:05:00Z",
    );
    const draft = levelRowOf(
      line([], [request("draft", { code: LIVE_CODE })]),
      "account_verified",
    ).request;
    expect(draft?.kind === "started" && draft.since).toBe(
      "2026-03-01T09:00:00Z",
    );
  });

  it("says the ownership is established only by an account badge that stands (the prerequisite of RG12)", () => {
    expect(isOwnershipEstablished(line())).toBe(false);
    expect(
      isOwnershipEstablished(line([badge("account_verified", "active")])),
    ).toBe(true);
    expect(
      isOwnershipEstablished(line([badge("account_verified", "to_reconfirm")])),
    ).toBe(false);
    // the audience of another level proves nothing of the account
    expect(
      isOwnershipEstablished(line([badge("audience_verified", "active")])),
    ).toBe(false);
  });

  it("lets the main line speak for a network held on several lines, else the first listed", () => {
    const hosts = hostLineIdsOf([
      { id: "a", networkCode: "instagram", isPrimary: false },
      { id: "b", networkCode: "instagram", isPrimary: true },
      { id: "c", networkCode: "tiktok", isPrimary: false },
      { id: "d", networkCode: "tiktok", isPrimary: false },
    ]);
    expect([...hosts].sort()).toEqual(["b", "c"]);
    expect(hostLineIdsOf([]).size).toBe(0);
  });
});

describe("the written label of a badge (08 RG4, RG10, RG93, RG97)", () => {
  it("keys the label and the explanation of each state a creator reads on his own line", () => {
    expect(badgeKeysOf(badge("account_verified", "active"))).toEqual({
      label: "verif.badge.accountVerified.label",
      help: "verif.badge.accountVerified.help",
      needsAction: false,
    });
    expect(badgeKeysOf(badge("audience_verified", "active"))).toEqual({
      label: "verif.badge.audienceVerified.label",
      help: "verif.badge.audienceVerified.help",
      needsAction: false,
    });
    expect(badgeKeysOf(badge("audience_verified", "to_refresh"))).toEqual({
      label: "verif.badge.toRefresh",
      help: "verif.badge.audienceVerified.help",
      needsAction: true,
    });
    expect(badgeKeysOf(badge("account_verified", "to_reconfirm"))).toEqual({
      label: "verif.badge.toReconfirm",
      help: null,
      needsAction: true,
    });
  });

  it("writes no label for a state a level never has, nor for the brand's badge", () => {
    expect(badgeKeysOf(badge("account_verified", "to_refresh"))).toBeNull();
    expect(badgeKeysOf(badge("audience_verified", "to_reconfirm"))).toBeNull();
    expect(badgeKeysOf(badge("brand_verified", "active"))).toBeNull();
  });
});

describe("a refusal: its text and what the creator can do next (08 RG56, RG57)", () => {
  const refusal = (
    reasonCode: OwnRefusal["reasonCode"],
    message = "",
  ): OwnRefusal => ({ reasonCode, message, decidedAt: BADGE_AT });

  it("gives every reason of the closed list a next step, and only the restartable ones reopen the journey", () => {
    for (const code of CREATOR_REJECTION_REASON_CODES) {
      const view = refusalViewOf(refusal(code));
      expect(view.reason).toBe(code);
      expect(canRestartOwnership(view), code).toBe(
        code === "ownership_not_proven" || code === "account_not_public",
      );
    }
    expect(refusalViewOf(refusal("agency_managed")).next).toBe("none");
    expect(refusalViewOf(refusal("minor")).next).toBe("none");
  });

  it("carries the agent's own words for the two reasons that have them, never for a typed one", () => {
    const words = "Votre profil montre un compte partagé avec une marque.";
    expect(refusalViewOf(refusal("other", words)).agentMessage).toBe(words);
    expect(refusalViewOf(refusal("terms_breach", words)).agentMessage).toBe(
      words,
    );
    // a typed reason has an empty message on the member's side (EC-L2E-12-2): the screen writes the text
    expect(
      refusalViewOf(refusal("ownership_not_proven")).agentMessage,
    ).toBeNull();
    // a blank message is no message
    expect(refusalViewOf(refusal("other", "   ")).agentMessage).toBeNull();
  });

  it("reads a reason of the brands' list on a creator's request as `other`, never as a blank", () => {
    const view = refusalViewOf(refusal("name_mismatch"));
    expect(view.reason).toBe("other");
    expect(view.next).toBe("contact");
  });

  it("has a text for every reason and every next step, in both languages", () => {
    for (const texts of [frVerification, enVerification]) {
      expect(Object.keys(texts.refusal.reason).sort()).toEqual(
        [...CREATOR_REJECTION_REASON_CODES].sort(),
      );
      for (const code of CREATOR_REJECTION_REASON_CODES) {
        const { next } = refusalViewOf(refusal(code));
        expect(Object.keys(texts.refusal.next), code).toContain(next);
      }
    }
  });
});

describe("the step of the ownership journey, read back from the API", () => {
  it("starts at the first screen when nothing was asked, and tells what happened to the last request", () => {
    const empty = ownershipJourneyOf(line());
    expect(empty).toMatchObject({
      step: "affirm",
      request: null,
      previous: null,
      codeExpired: false,
    });
    const after = ownershipJourneyOf(
      line([], [refused("ownership_not_proven")]),
    );
    expect(after.step).toBe("affirm");
    expect(after.previous?.kind).toBe("refused");
    expect(
      ownershipJourneyOf(line([], [request("expired")])).previous?.kind,
    ).toBe("expired");
  });

  it("takes a draft back at the code, a request sent at the confirmation, a granted badge at the end", () => {
    const draft = ownershipJourneyOf(
      line([], [request("draft", { code: LIVE_CODE })]),
    );
    expect(draft).toMatchObject({ step: "code", codeExpired: false });
    expect(draft.request?.code?.code).toBe("INFLUX-K7M2QX9A");
    const ranOut = ownershipJourneyOf(line([], [request("draft")]));
    expect(ranOut).toMatchObject({ step: "code", codeExpired: true });
    const sent = ownershipJourneyOf(line([], [request("pending", SENT)]));
    expect(sent.step).toBe("confirm");
    const done = ownershipJourneyOf(
      line([badge("account_verified", "active")]),
    );
    expect(done).toMatchObject({ step: "done", request: null });
  });

  it("puts a badge to reconfirm back at the first screen, with the badge to write", () => {
    const reconfirm = ownershipJourneyOf(
      line([badge("account_verified", "to_reconfirm")]),
    );
    expect(reconfirm.step).toBe("affirm");
    expect(reconfirm.badge?.state).toBe("to_reconfirm");
  });

  it("lets an open request win over the badge it renews, and ignores the audience's requests", () => {
    const renewing = ownershipJourneyOf(
      line(
        [badge("account_verified", "to_reconfirm")],
        [request("pending", { submittedAt: "2026-03-05T09:00:00Z" })],
      ),
    );
    expect(renewing.step).toBe("confirm");
    const audienceOnly = ownershipJourneyOf(
      line(
        [],
        [
          request("pending", {
            level: "audience_verified",
            submittedAt: BADGE_AT,
          }),
        ],
      ),
    );
    expect(audienceOnly.step).toBe("affirm");
  });

  it("numbers the screens one to three, the end counting as the third, and cancels before a decision only", () => {
    expect(OWNERSHIP_STEP_COUNT).toBe(3);
    expect(
      (["affirm", "code", "confirm", "done"] as const).map(stepNumberOf),
    ).toEqual([1, 2, 3, 3]);
    expect(isCancellable(request("draft"))).toBe(true);
    expect(isCancellable(request("pending"))).toBe(true);
    for (const status of [
      "approved",
      "rejected",
      "cancelled",
      "expired",
      "closed",
    ] as const) {
      expect(isCancellable(request(status)), status).toBe(false);
    }
  });
});

describe("the one action of the ownership row", () => {
  const action = (badges: OwnBadge[], requests: OwnRequest[]) =>
    ownershipActionOf(levelRowOf(line(badges, requests), "account_verified"));

  it("offers to start, to resume or to renew, never twice for one request", () => {
    expect(action([], [])).toBe("start");
    expect(action([], [request("draft", { code: LIVE_CODE })])).toBe("resume");
    expect(action([], [request("draft")])).toBe("renew");
    expect(action([], [request("expired")])).toBe("renew");
  });

  it("offers nothing while a request waits for an agent or once the badge stands", () => {
    expect(action([], [request("pending", SENT)])).toBeNull();
    expect(action([badge("account_verified", "active")], [])).toBeNull();
  });

  it("offers to reconfirm a badge that asks for it, and to ask again only after a refusal that allows it", () => {
    expect(action([badge("account_verified", "to_reconfirm")], [])).toBe(
      "reconfirm",
    );
    expect(action([], [refused("ownership_not_proven")])).toBe("restart");
    expect(action([], [refused("account_not_public")])).toBe("restart");
    expect(action([], [refused("shared_account")])).toBeNull();
    expect(action([], [refused("minor")])).toBeNull();
  });
});

describe("the failure of a call (08 RG14, RG22, RG60, CA12, CA37, CA38)", () => {
  const failed = (
    code: string,
    issues: string[] = [],
    retryAfterSeconds?: number,
  ) =>
    failureOf({
      kind: "failed",
      code,
      issues,
      ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
    });

  it("carries the delay of Retry-After for a request asked again too soon", () => {
    expect(failed("conflict", ["retry_after"], 3600)).toEqual({
      key: "retryLater",
      retryAfterSeconds: 3600,
      reload: false,
    });
    // no header: the delay is not invented
    expect(failed("conflict", ["retry_after"]).retryAfterSeconds).toBeNull();
  });

  it("names the cap, the code that ran out, the account already verified and the one unavailable", () => {
    expect(failed("conflict", ["rejection_cap"]).key).toBe("cap");
    expect(failed("conflict", ["code_expired"])).toMatchObject({
      key: "expired",
      reload: true,
    });
    expect(failed("conflict", ["already_verified"])).toMatchObject({
      key: "alreadyVerified",
      reload: true,
    });
    expect(failed("conflict", ["account_unavailable"])).toMatchObject({
      key: "accountUnavailable",
      reload: true,
    });
  });

  it("reads the screen again when the request is no longer in the state it was drawn in", () => {
    expect(failed("conflict", ["duplicate_request"])).toMatchObject({
      key: "duplicate",
      reload: true,
    });
    for (const issue of ["request_not_draft", "stale_token", "entry_closed"]) {
      expect(failed("conflict", [issue])).toMatchObject({
        key: "notDraft",
        reload: true,
      });
    }
    expect(failed("not_found")).toMatchObject({ key: "gone", reload: true });
  });

  it("falls back on the service being unavailable, for anything it does not know", () => {
    expect(failed("internal_error")).toEqual({
      key: "unavailable",
      retryAfterSeconds: null,
      reload: false,
    });
    expect(failed("conflict", ["something_new"]).key).toBe("unavailable");
    expect(failureOf({ kind: "failed" }).key).toBe("unavailable");
  });
});

/** The language puts a no-break space between a number and its unit: the test reads a plain one. */
const plain = (text: string) => text.replace(/[  ]/g, " ");

describe("dates and delays, in the language of the page (08 RG4, RG60, EC-L2E-9)", () => {
  it("writes the complete date of a decision, day included", () => {
    expect(formatVerificationDate("2026-03-03T12:00:00Z", "fr")).toBe(
      "3 mars 2026",
    );
    expect(formatVerificationDate("2026-03-03T12:00:00Z", "en")).toBe(
      "March 3, 2026",
    );
  });

  it("writes a calendar day of a period as the UTC day it names, whatever the time zone", () => {
    expect(formatCalendarDay("2026-02-01", "fr")).toBe("1 février 2026");
    expect(formatCalendarDay("2026-02-28", "en")).toBe("February 28, 2026");
  });

  it("rounds the delay up to the unit: minutes under an hour, hours under two days, days beyond", () => {
    expect(plain(formatDelay(1, "fr"))).toBe("1 minute");
    expect(plain(formatDelay(61, "en"))).toBe("2 minutes");
    expect(plain(formatDelay(3599, "fr"))).toBe("60 minutes");
    expect(plain(formatDelay(3600, "fr"))).toBe("1 heure");
    expect(plain(formatDelay(86_399, "fr"))).toBe("24 heures");
    expect(plain(formatDelay(86_400, "en"))).toBe("24 hours");
    expect(plain(formatDelay(2 * 86_400 - 1, "en"))).toBe("48 hours");
    expect(plain(formatDelay(2 * 86_400, "fr"))).toBe("2 jours");
    expect(plain(formatDelay(2 * 86_400 + 1, "en"))).toBe("3 days");
  });
});

// --- The audience journey (commit 19) -------------------------------------------------------------

const PIECE_ID = "0c9d6f0e-3b1a-4d7e-8a52-6f1e2b3c4d5e";

function piece(state: OwnEvidence["state"], id = PIECE_ID): OwnEvidence {
  return {
    id,
    state,
    createdAt: "2026-03-01T09:00:00Z",
    width: 600,
    height: 300,
    byteSize: 34_200,
  };
}

function audienceRequest(
  status: OwnRequest["status"],
  extra: Partial<OwnRequest> = {},
): OwnRequest {
  return request(status, { level: "audience_verified", ...extra });
}

function audienceRefused(reason: OwnRefusal["reasonCode"]): OwnRequest {
  return audienceRequest("rejected", {
    submittedAt: "2026-03-01T09:05:00Z",
    refusal: {
      reasonCode: reason,
      message: "",
      decidedAt: "2026-03-02T08:00:00Z",
    },
  });
}

const OWNED = badge("account_verified", "active");

describe("where the audience journey stands, read from the API (08 RG12, RG95, RG96)", () => {
  it("writes the condition before any deposit while the ownership of the account is not established (RG12)", () => {
    for (const held of [
      line(),
      line([badge("account_verified", "to_reconfirm")]),
      line([], [refused("ownership_not_proven")]),
    ]) {
      const journey = audienceJourneyOf(held);
      expect(journey.stage).toBe("locked");
      expect(journey.request).toBeNull();
      expect(audienceStepNumberOf(journey.stage)).toBeNull();
    }
  });

  it("opens on what the badge states, before any request exists, once the account is verified (RG96)", () => {
    const journey = audienceJourneyOf(line([OWNED]));
    expect(journey).toMatchObject({
      stage: "affirm",
      request: null,
      refresh: false,
      previous: null,
    });
    expect(audienceStepNumberOf("affirm")).toBe(1);
  });

  it("takes a draft back at its deposit, with the pieces an agent will read and no other", () => {
    const journey = audienceJourneyOf(
      line(
        [OWNED],
        [
          audienceRequest("draft", {
            evidence: [
              piece("active", PIECE_ID),
              piece("pending", "11111111-1111-4111-8111-111111111111"),
            ],
          }),
        ],
      ),
    );
    expect(journey.stage).toBe("deposit");
    expect(journey.pieces.map((one) => one.id)).toEqual([PIECE_ID]);
    expect(audienceStepNumberOf("deposit")).toBe(2);
  });

  it("shows the follow-up of a request sent, and of a badge granted, as the third screen", () => {
    const sent = audienceJourneyOf(
      line([OWNED], [audienceRequest("pending", SENT)]),
    );
    expect(sent.stage).toBe("sent");
    expect(sent.request?.status).toBe("pending");
    const granted = audienceJourneyOf(
      line([OWNED, badge("audience_verified", "active")]),
    );
    expect(granted.stage).toBe("done");
    expect(audienceStepNumberOf("sent")).toBe(3);
    expect(audienceStepNumberOf("done")).toBe(AUDIENCE_STEP_COUNT);
  });

  it("keeps the first screen after a refusal, with it, and offers a renewal for a badge to refresh", () => {
    const refusal = audienceJourneyOf(
      line([OWNED], [audienceRefused("evidence_too_wide")]),
    );
    expect(refusal.stage).toBe("affirm");
    expect(refusal.previous?.kind).toBe("refused");
    const refresh = audienceJourneyOf(
      line([OWNED, badge("audience_verified", "to_refresh")]),
    );
    expect(refresh).toMatchObject({ stage: "affirm", refresh: true });
  });
});

describe("the button of the audience row (08 RG12, RG57)", () => {
  const rowOf = (held: CreatorVerificationLine) =>
    levelRowOf(held, "audience_verified");

  it("offers none before the ownership stands, and none while an agent has the request", () => {
    expect(audienceActionOf(rowOf(line()), false)).toBeNull();
    expect(
      audienceActionOf(
        rowOf(line([OWNED], [audienceRequest("pending", SENT)])),
        true,
      ),
    ).toBeNull();
  });

  it("starts the first request, resumes a draft, renews a badge to refresh, and leaves a current badge alone", () => {
    expect(audienceActionOf(rowOf(line([OWNED])), true)).toBe("start");
    expect(
      audienceActionOf(rowOf(line([OWNED], [audienceRequest("draft")])), true),
    ).toBe("resume");
    expect(
      audienceActionOf(
        rowOf(line([OWNED, badge("audience_verified", "to_refresh")])),
        true,
      ),
    ).toBe("refresh");
    expect(
      audienceActionOf(
        rowOf(line([OWNED, badge("audience_verified", "active")])),
        true,
      ),
    ).toBeNull();
  });

  it("offers a new deposit after a refusal that points at the evidence or at the account to make public, never after one that points elsewhere", () => {
    const after = (reason: OwnRefusal["reasonCode"]) =>
      audienceActionOf(rowOf(line([OWNED], [audienceRefused(reason)])), true);
    for (const reason of [
      "missing_evidence",
      "evidence_too_old",
      "evidence_unreadable",
      "evidence_wrong_source",
      "evidence_too_wide",
      "account_not_public",
    ] as const) {
      expect(after(reason), reason).toBe("restart");
    }
    for (const reason of [
      "ownership_prerequisite",
      "evidence_suspected_forgery",
      "agency_managed",
      "minor",
    ] as const) {
      expect(after(reason), reason).toBeNull();
    }
  });

  it("writes every action in the translation files, both languages", () => {
    for (const key of Object.values(AUDIENCE_CTA_KEYS)) {
      const name = key.split(".").slice(-1)[0] ?? "";
      expect(frVerification.line.cta).toHaveProperty(name);
      expect(enVerification.line.cta).toHaveProperty(name);
    }
  });
});

describe("the identifier a network line still lacks (L2EU-3)", () => {
  it("names the handle first, then the link, and nothing once both are written", () => {
    expect(missingIdentifierOf({ handle: null, profileUrl: null })).toBe(
      "handle",
    );
    expect(
      missingIdentifierOf({ handle: "  ", profileUrl: "https://x.y/z" }),
    ).toBe("handle");
    expect(missingIdentifierOf({ handle: "camille", profileUrl: null })).toBe(
      "profileUrl",
    );
    expect(missingIdentifierOf({ handle: "camille", profileUrl: " " })).toBe(
      "profileUrl",
    );
    expect(
      missingIdentifierOf({ handle: "camille", profileUrl: "https://x.y/z" }),
    ).toBeNull();
  });

  it("writes the link to the field in both languages", () => {
    expect(frVerification.line.cta.fillIdentifier).toBe(
      "Renseigner le pseudo et le lien",
    );
    expect(enVerification.line.cta.fillIdentifier).toBeTruthy();
  });
});

describe("the piece expected on each network (08 RG32)", () => {
  it("names Instagram, TikTok and YouTube, and the equivalent native tool of any other network", () => {
    expect(expectedPieceKeyOf("instagram")).toBe("instagram");
    expect(expectedPieceKeyOf("tiktok")).toBe("tiktok");
    expect(expectedPieceKeyOf("youtube")).toBe("youtube");
    expect(expectedPieceKeyOf("twitch")).toBe("other");
    for (const key of ["instagram", "tiktok", "youtube", "other"] as const) {
      expect(frVerification.audience.deposit.expected).toHaveProperty(key);
      expect(enVerification.audience.deposit.expected).toHaveProperty(key);
    }
  });
});

describe("a refused deposit, told by its cause (08 RG34, RG95, CA67)", () => {
  const failed = (
    code: string | undefined,
    issues: string[] = [],
    retryAfterSeconds?: number,
  ) => ({
    kind: "failed" as const,
    code,
    issues,
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  });

  it("stops a file with nothing to read or over the cap before it leaves, and lets the API decide the rest", () => {
    expect(evidenceFileProblem(0)?.key).toBe("empty");
    expect(evidenceFileProblem(8_388_609)?.key).toBe("tooLarge");
    expect(evidenceFileProblem(8_388_608)).toBeNull();
    expect(evidenceFileProblem(1)).toBeNull();
    expect(EVIDENCE_MAX_MEBIBYTES).toBe(8);
  });

  it("gives each typed reason of an image its own message, a PDF included (the type is read in the bytes)", () => {
    for (const reason of VERIFICATION_EVIDENCE_REJECTIONS) {
      const failure = evidenceFailureOf(failed("image_rejected", [reason]));
      expect(failure.key).toBe(reason);
      expect(failure.retryable).toBe(false);
      expect(frVerification.audience.errors).toHaveProperty(reason);
      expect(enVerification.audience.errors).toHaveProperty(reason);
    }
    expect(
      evidenceFailureOf(failed("image_rejected", ["something_new"])).key,
    ).toBe("undecodable");
    expect(frVerification.audience.errors.unsupported_type).toContain("PDF");
    expect(enVerification.audience.errors.unsupported_type).toContain("PDF");
  });

  it("says the daily quota with the delay left, a full request, a request no more a draft, and one that is gone", () => {
    expect(
      evidenceFailureOf(failed("upload_quota_exceeded", [], 7_200)),
    ).toMatchObject({
      key: "quota",
      retryAfterSeconds: 7_200,
      stopsQueue: true,
    });
    expect(
      evidenceFailureOf(failed("conflict", ["evidence_cap"])),
    ).toMatchObject({ key: "cap", stopsQueue: true, reload: true });
    expect(
      evidenceFailureOf(failed("conflict", ["request_not_draft"])),
    ).toMatchObject({ key: "notDraft", stopsQueue: true, reload: true });
    expect(evidenceFailureOf(failed("not_found"))).toMatchObject({
      key: "gone",
      reload: true,
    });
    expect(evidenceFailureOf(failed("payload_too_large")).key).toBe("tooLarge");
  });

  it("keeps a file for another try only when the service did not answer", () => {
    for (const result of [
      { kind: "failed" as const },
      failed("service_unavailable"),
      failed("internal_error"),
    ]) {
      expect(evidenceFailureOf(result)).toMatchObject({
        key: "unavailable",
        retryable: true,
        stopsQueue: false,
      });
    }
  });

  it("tells the refusals of the audience request itself: the prerequisite, a missing piece, a full request", () => {
    for (const [issue, key] of [
      ["ownership_prerequisite", "ownershipPrerequisite"],
      ["missing_evidence", "missingEvidence"],
      ["evidence_cap", "evidenceCap"],
    ] as const) {
      expect(failureOf(failed("conflict", [issue]))).toMatchObject({
        key,
        reload: true,
      });
      expect(frVerification.failure).toHaveProperty(key);
      expect(enVerification.failure).toHaveProperty(key);
    }
  });

  it("writes the size of a piece for the language, in kilobytes then megabytes", () => {
    expect(formatByteSize(34_200, "en")).toBe("34 kB");
    expect(formatByteSize(300, "en")).toBe("1 kB");
    expect(formatByteSize(2_450_000, "en")).toBe("2.5 MB");
    expect(formatByteSize(2_450_000, "fr")).toMatch(/^2,5\s?Mo$/);
  });
});

// --- The translation files -----------------------------------------------------------------------

const SPEC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "docs",
  "mvp",
  "08-verification-et-badge.md",
);

/** The table of RG93 of the specification: key, French, English, exactly as written there. */
function rg93(): { key: string; fr: string; en: string }[] {
  const text = readFileSync(SPEC, "utf8");
  const start = text.indexOf("**RG93**");
  const end = text.indexOf("**RG94**");
  return text
    .slice(start, end)
    .split("\n")
    .flatMap((row) => {
      const cells = row.split("|").map((cell) => cell.trim());
      const key = /^`(verif\.[A-Za-z.]+)`$/.exec(cells[1] ?? "")?.[1];
      return key === undefined
        ? []
        : [{ key, fr: cells[2] ?? "", en: cells[3] ?? "" }];
    });
}

/** The node of a dotted key; `verif.badge.accountVerified` is an object of two leaves, its text is the `label`. */
function leafOf(texts: unknown, key: string): string | undefined {
  let node: unknown = texts;
  for (const part of key.split(".")) {
    node = (node as Record<string, unknown> | undefined)?.[part];
  }
  if (typeof node === "string") {
    return node;
  }
  const label = (node as { label?: unknown } | undefined)?.label;
  return typeof label === "string" ? label : undefined;
}

/** Every leaf of a file as `dotted.key` and its text. */
function leavesOf(node: unknown, prefix = ""): [string, string][] {
  if (typeof node === "string") {
    return [[prefix, node]];
  }
  return Object.entries(node as Record<string, unknown>).flatMap(
    ([key, child]) => leavesOf(child, prefix === "" ? key : `${prefix}.${key}`),
  );
}

describe("the translation files of the verification (08 RG6, RG93; fiche invariant 12)", () => {
  it("holds the twenty-two keys of RG93 mot pour mot, in French and in English", () => {
    const table = rg93();
    expect(table).toHaveLength(22);
    for (const { key, fr, en } of table) {
      expect(leafOf(frVerification, key), `fr ${key}`).toBe(fr);
      expect(leafOf(enVerification, key), `en ${key}`).toBe(en);
    }
  });

  it("holds the same keys in both languages, the placeholders included", () => {
    const fr = leavesOf(frVerification);
    const en = leavesOf(enVerification);
    expect(fr.map(([key]) => key)).toEqual(en.map(([key]) => key));
    const placeholders = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    for (const [index, [key, text]] of fr.entries()) {
      expect(placeholders(en[index]?.[1] ?? ""), key).toEqual(
        placeholders(text),
      );
    }
  });

  it("carries no superlative, no mention of trust or certification and no star (RG6), no amount, rate or price (RG8)", () => {
    const forbidden =
      /certifi|confiance|trust|premium|top cr[ée]ateur|top creator|recommand|recommend|★|⭐|[€$£]|\b\d+\s?%|tarif|\bprix\b|\bprice\b|commission/i;
    for (const texts of [frVerification, enVerification]) {
      for (const [key, text] of leavesOf(texts)) {
        expect(forbidden.exec(text)?.[0], key).toBeUndefined();
      }
    }
  });

  it("holds the capture instructions of RG87 mot pour mot, in French, and their English twin", () => {
    const text = readFileSync(SPEC, "utf8");
    const rg87 = text
      .slice(text.indexOf("**RG87**"), text.indexOf("**RG88**"))
      .split(/\r?\n/)
      .filter((row) => row.startsWith(">"))
      .map((row) => row.replace(/^>\s?/, ""))
      .join(" ");
    const parts = [
      ...rg87.matchAll(/\*([^*]+?)\s:\*\s([^*]+?)(?=\s\*|$)/g),
    ].map((match) => ({
      title: match[1] ?? "",
      text: match[2]?.trim() ?? "",
    }));
    expect(parts).toHaveLength(3);
    const written = frVerification.audience.deposit.instructions;
    for (const [index, part] of (["see", "hide", "never"] as const).entries()) {
      expect(written[part].title).toBe(parts[index]?.title);
      expect(written[part].text.toLowerCase()).toBe(
        (parts[index]?.text ?? "").toLowerCase(),
      );
    }
    expect(enVerification.audience.deposit.instructions).toHaveProperty("see");
  });

  it("says the follower authenticity is not claimed, beside the badge and in the list of what it does not state", () => {
    expect(frVerification.verif.badge.audienceVerified.help).toContain(
      "INFLUX ne se prononce pas sur l'authenticité des abonnés",
    );
    expect(frVerification.ownership.affirm.not.authenticity).toBe(
      "INFLUX ne se prononce pas sur l'authenticité des abonnés.",
    );
    expect(enVerification.ownership.affirm.not.authenticity).toBe(
      "INFLUX makes no claim about follower authenticity.",
    );
  });
});

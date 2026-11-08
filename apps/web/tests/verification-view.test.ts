// What the screens of the verification of a creator's account show, decided outside the components
// (docs/mvp/08 RG1 to RG7, RG10, RG13, RG56, RG57, RG60, RG93, RG96; jalons/l2e, commit 18): the state of
// a network line, a row per level and never a global badge; the step of the journey read back from the
// API; the written label of a badge; the text and the next step of a refusal; the failure of a call and
// the delay left; the dates; the translation files against RG93, mot pour mot, and against the words
// a badge never carries (RG6). Pure functions and files, no browser.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CREATOR_REJECTION_REASON_CODES,
  type CreatorVerificationLine,
  type OwnBadge,
  type OwnRefusal,
  type OwnRequest,
} from "@influx/contracts/verification";
import { describe, expect, it } from "vitest";
import {
  OWNERSHIP_STEP_COUNT,
  badgeKeysOf,
  canRestartOwnership,
  failureOf,
  formatCalendarDay,
  formatDelay,
  formatVerificationDate,
  hostLineIdsOf,
  isCancellable,
  isOwnershipEstablished,
  levelRowOf,
  lineOfNetwork,
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

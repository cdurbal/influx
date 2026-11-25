import { describe, expect, it } from "vitest";
import {
  badgeStateLabelKey,
  checkDisputeText,
  checkRevocationReason,
  CONSUMER_EMAIL_DOMAINS,
  disputeReasonRequiresText,
  disputeWindow,
  graceEndsAt,
  isConsumerEmailDomain,
  isDisputable,
  isInRenewalWindow,
  memberNextStep,
  OPENING_REASONS,
  REVOCATION_REASON_CODES,
  REVOCATION_REASONS,
  revocationReasonsFor,
  VERIFICATION_BADGE_STATES,
  VERIFICATION_LEVELS,
  VERIFICATION_PARAMETERS,
  type BadgeViewer,
} from "../src/verification/index.ts";

const DAY = 86_400_000;
const NOTIFIED = new Date("2026-10-01T09:30:00.000Z");
const message = (length: number) => "m".repeat(length);

describe("L2F-U1 the label of every state of a badge (08 RG10, RG70, RG73, RG78, RG93, RG97)", () => {
  it("gives the written key of « à rafraîchir » and « à reconfirmer » (RG93), the brand's own line for its badge", () => {
    const key = (level: string, state: string, viewer: BadgeViewer = "owner") =>
      badgeStateLabelKey({
        level: level as never,
        state: state as never,
        viewer,
      });
    expect(key("audience_verified", "to_refresh")).toBe(
      "verif.badge.toRefresh",
    );
    expect(key("account_verified", "to_reconfirm")).toBe(
      "verif.badge.toReconfirm",
    );
    expect(key("brand_verified", "to_refresh", "advertiser")).toBe(
      "brandProfile.badge.toRefresh",
    );
    expect(key("account_verified", "active")).toBe(
      "verif.badge.accountVerified",
    );
  });

  it("tells the owner of an audience that it expired, and of a creator badge that it was removed, in the words of RG10", () => {
    expect(
      badgeStateLabelKey({
        level: "audience_verified",
        state: "expired",
        viewer: "owner",
      }),
    ).toBe("verif.expiry.removed");
    for (const level of ["account_verified", "audience_verified"] as const) {
      expect(
        badgeStateLabelKey({ level, state: "revoked", viewer: "owner" }),
      ).toBe("verif.revoked.notice");
    }
  });

  it("says nothing on the web of the end of a brand badge, of an account badge that expired, of a replaced one, nor to an advertiser", () => {
    for (const viewer of ["owner", "advertiser"] as const) {
      expect(
        badgeStateLabelKey({
          level: "brand_verified",
          state: "expired",
          viewer,
        }),
      ).toBeNull();
      expect(
        badgeStateLabelKey({
          level: "brand_verified",
          state: "revoked",
          viewer,
        }),
      ).toBeNull();
      expect(
        badgeStateLabelKey({
          level: "audience_verified",
          state: "replaced",
          viewer,
        }),
      ).toBeNull();
    }
    expect(
      badgeStateLabelKey({
        level: "account_verified",
        state: "expired",
        viewer: "owner",
      }),
    ).toBeNull();
    for (const state of ["expired", "revoked"] as const) {
      expect(
        badgeStateLabelKey({
          level: "audience_verified",
          state,
          viewer: "advertiser",
        }),
      ).toBeNull();
    }
  });

  it("names a key for every displayed state and none that reads as a global or a premium badge (RG6, RG13, RG97)", () => {
    const keys = VERIFICATION_LEVELS.flatMap((level) =>
      VERIFICATION_BADGE_STATES.map((state) =>
        badgeStateLabelKey({ level, state, viewer: "owner" }),
      ),
    ).filter((key): key is NonNullable<typeof key> => key !== null);
    expect(new Set(keys).size).toBeGreaterThanOrEqual(8);
    expect(keys.join(" ")).not.toMatch(
      /global|premium|trust|certif|top|star/iu,
    );
  });

  it("ends the grace after the configured days, whatever they are, and opens the renewal window at the reminder instant", () => {
    const expiresAt = new Date("2027-01-30T08:00:00.000Z");
    expect(graceEndsAt({ expiresAt, graceDays: 30 }).toISOString()).toBe(
      "2027-03-01T08:00:00.000Z",
    );
    expect(graceEndsAt({ expiresAt, graceDays: 0 })).toEqual(expiresAt);
    const reminder = new Date(expiresAt.getTime() - 15 * DAY);
    expect(
      isInRenewalWindow({ expiresAt, now: reminder, reminderDays: 15 }),
    ).toBe(true);
    expect(
      isInRenewalWindow({
        expiresAt,
        now: new Date(reminder.getTime() - 1),
        reminderDays: 15,
      }),
    ).toBe(false);
    expect(
      isInRenewalWindow({
        expiresAt,
        now: new Date(reminder.getTime() - 1),
        reminderDays: 16,
      }),
    ).toBe(true);
  });
});

describe("L2F-U2 the window of a contest and what is contestable (08 RG77, CA52; 06 l. 718)", () => {
  it("accepts a contest at 30 days, the closing instant included, and refuses it from the next instant", () => {
    const closing = new Date(NOTIFIED.getTime() + 30 * DAY);
    const window = (now: Date) =>
      disputeWindow({ notifiedAt: NOTIFIED, now, windowDays: 30 });
    expect(window(new Date(NOTIFIED.getTime() + 29 * DAY)).open).toBe(true);
    expect(window(closing)).toEqual({ open: true, closesAt: closing });
    expect(window(new Date(closing.getTime() + 1)).open).toBe(false);
    expect(window(new Date(NOTIFIED.getTime() + 31 * DAY)).open).toBe(false);
  });

  it("moves with the setting alone: the same instant is open at 45 days and closed at 30", () => {
    const now = new Date(NOTIFIED.getTime() + 40 * DAY);
    expect(
      disputeWindow({ notifiedAt: NOTIFIED, now, windowDays: 45 }).open,
    ).toBe(true);
    expect(
      disputeWindow({ notifiedAt: NOTIFIED, now, windowDays: 30 }).open,
    ).toBe(false);
  });

  it("contests a creator's refusal and the withdrawal under 2V of a badge by name, nothing else, and nothing of a brand's (modele points 4, 8)", () => {
    const refusal = (
      level: "account_verified" | "audience_verified" | "brand_verified",
      requestStatus: "rejected" | "closed" | "approved" | "cancelled",
    ) => isDisputable({ kind: "refusal", level, requestStatus });
    expect(refusal("account_verified", "rejected")).toBe(true);
    expect(refusal("audience_verified", "rejected")).toBe(true);
    expect(refusal("audience_verified", "closed")).toBe(false);
    expect(refusal("account_verified", "approved")).toBe(false);
    expect(refusal("brand_verified", "rejected")).toBe(false);
    const withdrawal = (
      badgeState: "revoked" | "expired",
      byDualControl: boolean,
    ) =>
      isDisputable({
        kind: "revocation",
        level: "audience_verified",
        badgeState,
        byDualControl,
      });
    expect(withdrawal("revoked", true)).toBe(true);
    expect(withdrawal("revoked", false)).toBe(false);
    expect(withdrawal("expired", true)).toBe(false);
    expect(
      isDisputable({
        kind: "revocation",
        level: "brand_verified",
        badgeState: "revoked",
        byDualControl: true,
      }),
    ).toBe(false);
  });

  it("asks for the text of `other` only, 1 to 1 000 printable characters, and refuses a contact, a @pseudo being admitted (modele point 7)", () => {
    expect(disputeReasonRequiresText("other")).toBe(true);
    expect(disputeReasonRequiresText("misread")).toBe(false);
    const check = (reasonCode: string, text: string | null) =>
      checkDisputeText({ reasonCode, text });
    expect(check("misread", null)).toEqual({ ok: true });
    expect(check("other", null)).toEqual({
      ok: false,
      refusal: "text_required",
    });
    expect(check("other", "   ")).toEqual({
      ok: false,
      refusal: "text_invalid",
    });
    expect(check("misread", "x".repeat(1001))).toEqual({
      ok: false,
      refusal: "text_invalid",
    });
    expect(check("misread", "x".repeat(1000))).toEqual({ ok: true });
    expect(check("misread", "bad\u0007text")).toEqual({
      ok: false,
      refusal: "text_invalid",
    });
    expect(check("other", "My account is @maison.aube, as shown.")).toEqual({
      ok: true,
    });
    for (const text of [
      "Write me at anna@example.com please",
      "See https://example.com/proof",
      "My site is maison-aube.fr",
      "Call +33 6 12 34 56 78",
    ]) {
      expect(check("other", text), text).toEqual({
        ok: false,
        refusal: "contact_detected",
      });
    }
  });
});

describe("L2F-U3 the reasons of a withdrawal, by level (08 RG73, RG74; 06 RG55)", () => {
  it("offers five reasons for a creator badge and five for a brand badge, influx_error to both", () => {
    const codes = (level: (typeof VERIFICATION_LEVELS)[number]) =>
      revocationReasonsFor(level).map((reason) => reason.code);
    expect(codes("account_verified")).toEqual([
      "forged_evidence",
      "account_closed",
      "owner_changed",
      "terms_breach",
      "influx_error",
    ]);
    expect(codes("audience_verified")).toEqual(codes("account_verified"));
    expect(codes("brand_verified")).toEqual([
      "forged_evidence",
      "terms_breach",
      "influx_error",
      "company_dissolved",
      "domain_transferred",
    ]);
    expect(REVOCATION_REASONS.map((reason) => reason.code)).toEqual([
      ...REVOCATION_REASON_CODES,
    ]);
  });

  it("refuses a reason that is not one of the level, in the first place", () => {
    expect(
      checkRevocationReason({
        level: "account_verified",
        reasonCode: "company_dissolved",
        memberMessage: null,
      }),
    ).toEqual({ ok: false, refusal: "reason" });
    expect(
      checkRevocationReason({
        level: "brand_verified",
        reasonCode: "account_closed",
        memberMessage: message(30),
      }),
    ).toEqual({ ok: false, refusal: "reason" });
    expect(
      checkRevocationReason({
        level: "audience_verified",
        reasonCode: "other",
        memberMessage: null,
      }),
    ).toEqual({ ok: false, refusal: "reason" });
  });

  it("asks for the agent's message exactly where the reason requires it, 20 to 500 characters", () => {
    const check = (reasonCode: string, memberMessage: string | null) =>
      checkRevocationReason({
        level: "audience_verified",
        reasonCode,
        memberMessage,
      });
    expect(check("terms_breach", null)).toEqual({
      ok: false,
      refusal: "member_message",
    });
    expect(check("terms_breach", message(19))).toEqual({
      ok: false,
      refusal: "member_message",
    });
    expect(check("terms_breach", message(501))).toEqual({
      ok: false,
      refusal: "member_message",
    });
    expect(check("terms_breach", message(20))).toEqual({
      ok: true,
      escalatesToAdmin: true,
    });
    expect(check("influx_error", message(30))).toEqual({
      ok: false,
      refusal: "member_message",
    });
    expect(check("account_closed", null)).toEqual({
      ok: true,
      escalatesToAdmin: false,
    });
  });

  it("escalates to an administrator the four reasons RG73 escalates", () => {
    const escalated = REVOCATION_REASONS.filter(
      (reason) => reason.escalatesToAdmin,
    ).map((reason) => reason.code);
    expect(escalated).toEqual([
      "forged_evidence",
      "owner_changed",
      "terms_breach",
      "influx_error",
    ]);
  });
});

describe("L2F-U4 what the member is offered next (08 RG10, RG70, RG78; EC-L2F-13)", () => {
  const now = new Date("2027-01-20T12:00:00.000Z");
  const next = (
    level: (typeof VERIFICATION_LEVELS)[number],
    state: (typeof VERIFICATION_BADGE_STATES)[number] | null,
    expiresAt: Date | null = null,
    at: Date = now,
  ) =>
    memberNextStep({
      level,
      badge: state === null ? null : { state, expiresAt },
      now: at,
      reminderDays: 15,
    });

  it("proposes the usual request when nothing is held, and nothing for an account badge, which never expires", () => {
    expect(next("audience_verified", null)).toBe("request");
    expect(next("account_verified", "active")).toBe("none");
    expect(
      next("account_verified", "active", new Date(now.getTime() - DAY)),
    ).toBe("none");
  });

  it("proposes to renew an active audience or brand badge from the reminder instant, not before", () => {
    const expiresAt = new Date("2027-02-04T12:00:00.000Z");
    expect(next("audience_verified", "active", expiresAt)).toBe("renew");
    expect(next("brand_verified", "active", expiresAt)).toBe("renew");
    expect(
      next(
        "audience_verified",
        "active",
        expiresAt,
        new Date(expiresAt.getTime() - 15 * DAY - 1),
      ),
    ).toBe("none");
    expect(next("audience_verified", "active", null)).toBe("none");
  });

  it("proposes to refresh a badge to refresh, to reconfirm one to reconfirm, to ask again once a badge ended", () => {
    expect(next("audience_verified", "to_refresh")).toBe("refresh");
    expect(next("brand_verified", "to_refresh")).toBe("refresh");
    expect(next("account_verified", "to_reconfirm")).toBe("reconfirm");
    expect(next("audience_verified", "expired")).toBe("request_again");
    expect(next("account_verified", "revoked")).toBe("request_again");
    expect(next("audience_verified", "replaced")).toBe("none");
  });
});

describe("L2F-U1 the agent's reasons, the consumer mailboxes and the settings (D83; 0221, 0230, 0232, 0234)", () => {
  it("lists four reasons of opening, a comment being asked for `other` alone", () => {
    expect(OPENING_REASONS.map((reason) => reason.code)).toEqual([
      "invited_by_agent",
      "existing_client",
      "past_collaboration",
      "other",
    ]);
    expect(
      OPENING_REASONS.filter((reason) => reason.requiresComment).map(
        (reason) => reason.code,
      ),
    ).toEqual(["other"]);
  });

  it("refuses a consumer mailbox and its subdomains, never a company domain that merely ends alike", () => {
    expect(CONSUMER_EMAIL_DOMAINS).toHaveLength(45);
    expect(new Set(CONSUMER_EMAIL_DOMAINS).size).toBe(45);
    expect(isConsumerEmailDomain("gmail.com")).toBe(true);
    expect(isConsumerEmailDomain("  Gmail.COM ")).toBe(true);
    expect(isConsumerEmailDomain("mail.gmail.com")).toBe(true);
    expect(isConsumerEmailDomain("maison-aube.fr")).toBe(false);
    expect(isConsumerEmailDomain("notgmail.com")).toBe(false);
    expect(isConsumerEmailDomain("gmail.com.maison-aube.fr")).toBe(false);
  });

  it("holds each setting between its bounds, its starting value inside", () => {
    expect(VERIFICATION_PARAMETERS.map((parameter) => parameter.key)).toEqual([
      "badge_grace_days",
      "badge_reminder_days",
      "dispute_window_days",
      "dispute_reflection_hours",
    ]);
    for (const parameter of VERIFICATION_PARAMETERS) {
      expect(parameter.min, parameter.key).toBeLessThanOrEqual(parameter.start);
      expect(parameter.start, parameter.key).toBeLessThanOrEqual(parameter.max);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  badgeDisplay,
  isInternalComment,
  isMemberMessage,
  isObservedHandle,
  isOwnershipCode,
  OWNERSHIP_CODE_ALPHABET,
  VERIFICATION_BADGE_STATES,
  VERIFICATION_LEVELS,
  type BadgeViewer,
} from "../src/verification/index.ts";

const VIEWERS: readonly BadgeViewer[] = ["owner", "advertiser"];

describe("L2E-U4 the label of every state of a badge (08 RG10, RG70, RG78, RG93, RG97)", () => {
  it("gives the key of the sentence of RG93 for each displayed state, the date and the network being the screen's", () => {
    const key = (level: string, state: string, viewer: BadgeViewer) =>
      badgeDisplay({
        level: level as never,
        state: state as never,
        viewer,
      })?.labelKey ?? null;
    expect(key("account_verified", "active", "advertiser")).toBe(
      "verif.badge.accountVerified",
    );
    expect(key("audience_verified", "active", "advertiser")).toBe(
      "verif.badge.audienceVerified",
    );
    expect(key("audience_verified", "to_refresh", "advertiser")).toBe(
      "verif.badge.toRefresh",
    );
    expect(key("account_verified", "to_reconfirm", "owner")).toBe(
      "verif.badge.toReconfirm",
    );
    expect(key("brand_verified", "active", "owner")).toBe(
      "brandProfile.badge.label",
    );
    expect(key("brand_verified", "to_refresh", "advertiser")).toBe(
      "brandProfile.badge.toRefresh",
    );
  });

  it("shows nothing of an expired, revoked or replaced badge, to anyone (RG70, RG76)", () => {
    for (const level of VERIFICATION_LEVELS) {
      for (const state of ["expired", "revoked", "replaced"] as const) {
        for (const viewer of VIEWERS) {
          expect(
            badgeDisplay({ level, state, viewer }),
            `${level} ${state}`,
          ).toBeNull();
        }
      }
    }
  });

  it("shows a badge to reconfirm to its owner only, and only on the account level (RG78)", () => {
    expect(
      badgeDisplay({
        level: "account_verified",
        state: "to_reconfirm",
        viewer: "advertiser",
      }),
    ).toBeNull();
    expect(
      badgeDisplay({
        level: "audience_verified",
        state: "to_reconfirm",
        viewer: "owner",
      }),
    ).toBeNull();
  });

  it("writes every state that is not current as a state to act on, and no label stands for two levels", () => {
    const labels = new Map<string, string>();
    for (const level of VERIFICATION_LEVELS) {
      for (const state of VERIFICATION_BADGE_STATES) {
        const display = badgeDisplay({ level, state, viewer: "owner" });
        if (display === null) continue;
        expect(display.needsAction, `${level} ${state}`).toBe(
          state === "to_refresh" || state === "to_reconfirm",
        );
        const owner = labels.get(display.labelKey);
        expect(owner === undefined || owner === level).toBe(true);
        labels.set(display.labelKey, level);
      }
    }
    expect([...labels.keys()].sort()).toEqual([
      "brandProfile.badge.label",
      "brandProfile.badge.toRefresh",
      "verif.badge.accountVerified",
      "verif.badge.audienceVerified",
      "verif.badge.toReconfirm",
      "verif.badge.toRefresh",
    ]);
  });

  it("keeps the explanation of RG7 next to both creator badges, and no key says global, premium or trust (RG6, RG13)", () => {
    expect(
      badgeDisplay({
        level: "audience_verified",
        state: "active",
        viewer: "advertiser",
      })?.helpKey,
    ).toBe("verif.badge.audienceVerified.help");
    expect(
      badgeDisplay({
        level: "account_verified",
        state: "active",
        viewer: "advertiser",
      })?.helpKey,
    ).toBe("verif.badge.accountVerified.help");
    const everyKey = VERIFICATION_LEVELS.flatMap((level) =>
      VERIFICATION_BADGE_STATES.flatMap((state) =>
        VIEWERS.flatMap((viewer) => {
          const display = badgeDisplay({ level, state, viewer });
          return display === null ? [] : [display.labelKey, display.helpKey];
        }),
      ),
    ).join(" ");
    expect(everyKey).not.toMatch(/global|premium|trust|certif|top|star/iu);
  });
});

describe("L2E-U1 the bounds of what an agent types (0222, 0224)", () => {
  it("reads an ownership code as 0222 issues it: INFLUX- and eight signs of the 31", () => {
    expect(OWNERSHIP_CODE_ALPHABET).toHaveLength(31);
    expect(isOwnershipCode("INFLUX-23456789")).toBe(true);
    expect(isOwnershipCode("INFLUX-ABCDEFGH")).toBe(true);
    for (const wrong of [
      "INFLUX-2345678",
      "INFLUX-234567890",
      "INFLUX-0123456I",
      "influx-23456789",
      "INFLUX-2345678O",
      "INFLUX-23456789 ",
      "https://x.test/INFLUX-23456789",
    ]) {
      expect(isOwnershipCode(wrong), wrong).toBe(false);
    }
  });

  it("holds the handle to 1 to 100 characters without control character, margins out", () => {
    expect(isObservedHandle("maison.aube")).toBe(true);
    expect(isObservedHandle("  maison.aube  ")).toBe(true);
    expect(isObservedHandle("a".repeat(100))).toBe(true);
    expect(isObservedHandle("a".repeat(101))).toBe(false);
    expect(isObservedHandle("   ")).toBe(false);
    expect(isObservedHandle("")).toBe(false);
    expect(isObservedHandle("mai\nson")).toBe(false);
    expect(isObservedHandle("mai\u007Fson")).toBe(false);
  });

  it("holds the internal comment to 1 to 1 000 printable characters and the member message to 20 to 500", () => {
    expect(isInternalComment("Capture lisible.")).toBe(true);
    expect(isInternalComment("x".repeat(1000))).toBe(true);
    expect(isInternalComment("x".repeat(1001))).toBe(false);
    expect(isInternalComment("")).toBe(false);
    expect(isInternalComment("   ")).toBe(false);
    expect(isInternalComment("line\u0001")).toBe(false);
    expect(isInternalComment("two\nlines")).toBe(true);
    expect(isMemberMessage("x".repeat(19))).toBe(false);
    expect(isMemberMessage("x".repeat(20))).toBe(true);
    expect(isMemberMessage("x".repeat(500))).toBe(true);
    expect(isMemberMessage("x".repeat(501))).toBe(false);
    expect(isMemberMessage(" ".repeat(30))).toBe(false);
  });
});

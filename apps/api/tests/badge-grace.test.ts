// The end of the grace of a member's badge (docs/mvp/08 RG70, RG93; jalons/l2f/modele.md §1 point 1;
// L2F commit 13): the instant the domain's graceEndsAt() gives for the expiry and the days of the
// parameter, for a badge « à rafraîchir » or « à reconfirmer » only; and whether an active badge is in its
// reminder window (L2F fix-1). No database here: the days and the instant come in.
import { describe, expect, it } from "vitest";
import {
  graceEndOf,
  isInGrace,
  mayBeRenewable,
  renewableOf,
} from "../src/domains/verification/badge-grace.ts";

const EXPIRES = "2026-03-03T10:15:00.000Z";

describe("graceEndOf: expiry plus the days of grace, for the two states of the grace period", () => {
  it("adds the days of the parameter to the expiry of a badge « à rafraîchir » or « à reconfirmer »", () => {
    for (const state of ["to_refresh", "to_reconfirm"]) {
      expect(isInGrace(state)).toBe(true);
      expect(graceEndOf({ state, expiresAt: EXPIRES, graceDays: 30 })).toBe(
        "2026-04-02T10:15:00.000Z",
      );
    }
    // the parameter may be 0: the badge disappears at its expiry
    expect(
      graceEndOf({ state: "to_refresh", expiresAt: EXPIRES, graceDays: 0 }),
    ).toBe(EXPIRES);
  });

  it("is null for a badge that is current, one that ended and one that never expires", () => {
    for (const state of ["active", "expired", "revoked", "replaced"]) {
      expect(isInGrace(state)).toBe(false);
      expect(
        graceEndOf({ state, expiresAt: EXPIRES, graceDays: 30 }),
      ).toBeNull();
    }
    expect(
      graceEndOf({ state: "to_refresh", expiresAt: null, graceDays: 30 }),
    ).toBeNull();
    // the days were not read (the badge was not in its grace): nothing is guessed
    expect(
      graceEndOf({ state: "to_refresh", expiresAt: EXPIRES, graceDays: null }),
    ).toBeNull();
  });
});

describe("renewableOf: an active badge from expiry minus the reminder days (08 RG70 « J-15 »; L2F fix-1, 0240)", () => {
  it("is true from the opening of the window, the instant included, and false before it", () => {
    const at = (iso: string) =>
      renewableOf({
        state: "active",
        expiresAt: EXPIRES,
        reminderDays: 15,
        asOf: iso,
      });
    expect(at("2026-02-16T10:15:00.000Z")).toBe(true);
    expect(at("2026-03-01T00:00:00.000Z")).toBe(true);
    expect(at("2026-02-16T10:14:59.999Z")).toBe(false);
  });

  it("is false for any other state, a badge with no expiry, and when the days were not read", () => {
    const asOf = "2026-03-01T00:00:00.000Z";
    for (const state of [
      "to_refresh",
      "to_reconfirm",
      "expired",
      "revoked",
      "replaced",
    ]) {
      expect(mayBeRenewable({ state, expiresAt: EXPIRES })).toBe(false);
      expect(
        renewableOf({ state, expiresAt: EXPIRES, reminderDays: 15, asOf }),
      ).toBe(false);
    }
    expect(mayBeRenewable({ state: "active", expiresAt: null })).toBe(false);
    expect(
      renewableOf({ state: "active", expiresAt: null, reminderDays: 15, asOf }),
    ).toBe(false);
    expect(
      renewableOf({
        state: "active",
        expiresAt: EXPIRES,
        reminderDays: null,
        asOf,
      }),
    ).toBe(false);
  });
});

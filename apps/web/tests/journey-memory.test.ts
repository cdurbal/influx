// Where a journey resumes (D66; docs/mvp/05 RG111, RG130; 17 §3 "Changement de langue"): after a
// reload, from GET /v1/auth/journey (resumedStepOf); after a change of language, from the module
// variable of journey-memory.ts. Plain functions; the real journey is the Playwright run of J5
// commit 6.
import { RESEND_DELAY_SECONDS } from "@influx/contracts/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  codeStepOf,
  firstStepOf,
  languagePageOf,
  resendSecondsLeft,
  resumedStepOf,
} from "@/components/auth/auth-steps";
import {
  forget,
  remember,
  snapshotFits,
  takeForLocale,
  type JourneySnapshot,
} from "@/components/auth/journey-memory";
import {
  draftAfterLanguageChange,
  emptySignupDraft,
} from "@/components/auth/signup-form";

const NOW = Date.UTC(2026, 9, 8, 10, 0, 0);
const EMAIL = "resume@example.test";

function snapshot(overrides: Partial<JourneySnapshot> = {}): JourneySnapshot {
  return {
    locale: "fr",
    entry: "signup",
    door: "creator",
    step: { kind: "details", email: EMAIL },
    email: EMAIL,
    draft: { ...emptySignupDraft("fr"), countryCode: "FR" },
    ...overrides,
  };
}

afterEach(() => {
  forget();
});

describe("resumedStepOf: a reload (D66, RG111)", () => {
  it("starts from the beginning without a journey: door choice or address", () => {
    const none = { step: "none" } as const;
    expect(resumedStepOf(none, "signup", null, NOW)).toEqual({
      kind: "door",
      detailsEmail: null,
    });
    expect(resumedStepOf(none, "signup", "advertiser", NOW)).toEqual({
      kind: "email",
      message: null,
    });
    expect(resumedStepOf(none, "signIn", null, NOW)).toEqual({
      kind: "email",
      message: null,
    });
  });

  it("resumes at the code with the address, the phrase and the delay left", () => {
    expect(
      resumedStepOf(
        {
          step: "code",
          email: EMAIL,
          matchingPhrase: "blue harbour",
          retryAfterSeconds: 25,
        },
        "signup",
        "creator",
        NOW,
      ),
    ).toEqual({
      kind: "code",
      email: EMAIL,
      matchingPhrase: "blue harbour",
      resendAvailableAt: NOW + 25_000,
    });
  });

  it("resumes at screen 3 when the door is known from the URL", () => {
    expect(
      resumedStepOf(
        { step: "details", email: EMAIL },
        "signup",
        "advertiser",
        NOW,
      ),
    ).toEqual({ kind: "details", email: EMAIL });
  });

  it("asks for the door first when the URL has none (sign-in page, door choice)", () => {
    for (const entry of ["signup", "signIn"] as const) {
      expect(
        resumedStepOf({ step: "details", email: EMAIL }, entry, null, NOW),
      ).toEqual({ kind: "door", detailsEmail: EMAIL });
    }
  });
});

describe("the resend countdown across a resume (RG50)", () => {
  it("starts a fresh code step with the full delay", () => {
    expect(codeStepOf(EMAIL, "blue harbour", NOW)).toMatchObject({
      resendAvailableAt: NOW + RESEND_DELAY_SECONDS * 1_000,
    });
  });

  it("counts whole seconds left, never below 0 nor above the delay", () => {
    expect(resendSecondsLeft(NOW + 40_000, NOW)).toBe(40);
    expect(resendSecondsLeft(NOW + 39_001, NOW)).toBe(40);
    expect(resendSecondsLeft(NOW - 1_000, NOW)).toBe(0);
    expect(resendSecondsLeft(NOW + 600_000, NOW)).toBe(RESEND_DELAY_SECONDS);
  });
});

describe("firstStepOf and languagePageOf (RG130)", () => {
  it("opens the choice of door only on the sign-up page without a door", () => {
    expect(firstStepOf("signup", null).kind).toBe("door");
    expect(firstStepOf("signup", "creator").kind).toBe("email");
    expect(firstStepOf("signIn", null).kind).toBe("email");
  });

  it("offers the other language at every step but the notices", () => {
    const code = codeStepOf(EMAIL, "blue harbour", NOW);
    expect(languagePageOf("signIn", null, code)).toBe("signIn");
    expect(languagePageOf("signup", "creator", code)).toBe("signupCreator");
    expect(
      languagePageOf("signup", "advertiser", { kind: "details", email: EMAIL }),
    ).toBe("signupAdvertiser");
    expect(
      languagePageOf("signIn", null, { kind: "door", detailsEmail: EMAIL }),
    ).toBe("signupDoors");
    expect(languagePageOf("signup", null, null)).toBe("signupDoors");
    expect(
      languagePageOf("signup", "creator", {
        kind: "notice",
        notice: { kind: "signedUp", role: "creator" },
      }),
    ).toBeNull();
  });
});

describe("journey-memory: a change of language (D66, RG111, RG130)", () => {
  // The module keeps a journey in the browser only (J9S-8): these cases run as a browser would.
  beforeEach(() => {
    vi.stubGlobal("window", {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps nothing on the server, where the module is shared by every visitor (J9S-8)", () => {
    vi.unstubAllGlobals();
    remember(snapshot());
    vi.stubGlobal("window", {});
    expect(takeForLocale("en")).toBeNull();
  });

  it("hands the journey over to the other language, once", () => {
    const left = snapshot();
    remember(left);
    expect(takeForLocale("en")).toEqual(left);
    expect(takeForLocale("en")).toBeNull();
  });

  it("hands nothing over to the same language (a remount reads the server)", () => {
    remember(snapshot());
    expect(takeForLocale("fr")).toBeNull();
  });

  it("keeps the last state only", () => {
    remember(snapshot({ email: "first@example.test" }));
    remember(snapshot({ email: "second@example.test" }));
    expect(takeForLocale("en")?.email).toBe("second@example.test");
  });

  it("hands nothing over once forgotten (notice, success, restart)", () => {
    remember(snapshot());
    forget();
    expect(takeForLocale("en")).toBeNull();
  });

  it("fits the page its language link led to, and no other", () => {
    const details = snapshot();
    expect(snapshotFits(details, "signupCreator")).toBe(true);
    expect(snapshotFits(details, "signupAdvertiser")).toBe(false);
    expect(snapshotFits(details, "signIn")).toBe(false);
    const signIn = snapshot({
      entry: "signIn",
      door: null,
      step: codeStepOf(EMAIL, "blue harbour", NOW),
    });
    expect(snapshotFits(signIn, "signIn")).toBe(true);
    expect(snapshotFits(signIn, "signupDoors")).toBe(false);
  });

  it("unticks the two boxes ticked under a wording, keeps every other answer", () => {
    const draft = {
      ...emptySignupDraft("fr"),
      countryCode: "FR",
      declaredStatus: "individual" as const,
      adultAttested: true,
      termsAccepted: true,
      marketingConsent: true,
      heardFrom: "event" as const,
    };
    expect(draftAfterLanguageChange(draft)).toEqual({
      ...draft,
      termsAccepted: false,
      marketingConsent: false,
    });
  });
});

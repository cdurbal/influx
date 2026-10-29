// The navigation rules of the backoffice shell (docs/mvp/18 §12.1 TD2.7, TD2.8; 17b §1.2, §1.7;
// 05 CA63): pure functions of src/components/bo-nav.ts, without a browser.
import { describe, expect, it } from "vitest";
import {
  activePlaceOf,
  navItemsOf,
  RAIL_ENTRIES,
  type RailEntry,
  type RailKey,
} from "../src/components/bo-nav";
import { messages } from "../src/messages/fr";

/** The seven entries of 17b §1.2, in its order. */
const ORDER: readonly RailKey[] = [
  "dashboard",
  "queues",
  "accounts",
  "creatorSearch",
  "deals",
  "alerts",
  "admin",
];

/** Every entry with a screen, the template's full case (17b §1.7: designed and tested for seven). */
const SEVEN: readonly RailEntry[] = ORDER.map((key, index) => ({
  key,
  sections: [
    {
      key: "home",
      href: `/entry-${String(index + 1)}`,
      adminOnly: key === "admin",
    },
  ],
}));

describe("TD2.7: the entries of a role (17b §1.2, CA63)", () => {
  it("declares the seven entries of 17b §1.2 in their fixed order", () => {
    expect(RAIL_ENTRIES.map((entry) => entry.key)).toEqual(ORDER);
  });

  it("gives an agent no administration entry, today and with every screen shipped", () => {
    expect(navItemsOf("agent").map((item) => item.key)).toEqual([
      "dashboard",
      "accounts",
    ]);
    expect(navItemsOf("agent", SEVEN).map((item) => item.key)).not.toContain(
      "admin",
    );
    expect(
      navItemsOf("agent").flatMap((item) => item.sections),
    ).not.toContainEqual(expect.objectContaining({ adminOnly: true }));
  });

  it("gives an admin every entry that holds a screen, in order: seven once all are shipped", () => {
    expect(navItemsOf("admin").map((item) => item.key)).toEqual([
      "dashboard",
      "accounts",
      "admin",
    ]);
    expect(navItemsOf("admin", SEVEN).map((item) => item.key)).toEqual(ORDER);
  });

  it("opens each entry on its first screen and keeps its screens in order", () => {
    const admin = navItemsOf("admin");
    expect(admin.map((item) => item.href)).toEqual([
      "/accueil",
      "/inscrits",
      "/double-validation",
    ]);
    expect(admin[2]?.sections.map((section) => section.key)).toEqual([
      "dualControl",
      "internalAccounts",
      "apollo",
      "health",
    ]);
  });

  it("labels every entry and every screen it can show", () => {
    for (const item of navItemsOf("admin")) {
      expect(messages.nav[item.key]).not.toBe("");
      for (const section of item.sections) {
        expect(messages.nav[section.key]).not.toBe("");
      }
    }
  });
});

describe("TD2.8: the active entry of each address (17b §1.7)", () => {
  const cases: readonly [string, RailKey, string][] = [
    ["/accueil", "dashboard", "home"],
    ["/inscrits", "accounts", "signups"],
    ["/inscrits/7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22", "accounts", "signups"],
    ["/invitations", "accounts", "memberInvitations"],
    ["/double-validation", "admin", "dualControl"],
    [
      "/double-validation/7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22",
      "admin",
      "dualControl",
    ],
    ["/comptes-internes", "admin", "internalAccounts"],
    ["/reglages/apollo", "admin", "apollo"],
    ["/sante-technique", "admin", "health"],
  ];

  for (const [pathname, entry, section] of cases) {
    it(`${pathname} → ${entry} › ${section}`, () => {
      expect(activePlaceOf(pathname)).toEqual({ entry, section });
    });
  }

  it("finds no entry for an unknown path nor for a mere prefix", () => {
    expect(activePlaceOf("/")).toBeNull();
    expect(activePlaceOf("/absente")).toBeNull();
    expect(activePlaceOf("/inscritsx")).toBeNull();
    expect(activePlaceOf("/reglages")).toBeNull();
  });
});

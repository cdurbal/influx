// The navigation rules of the backoffice shell (docs/mvp/18 §12.1 TD2.7, TD2.8; 17b §1.2, §1.7;
// 05 CA63; D74, sn-fiche TN3): pure functions of src/components/bo-nav.ts, without a browser.
import { describe, expect, it } from "vitest";
import {
  activePlaceOf,
  entryStateOf,
  navItemsOf,
  RAIL_ENTRIES,
  subEntriesOf,
  type NavItem,
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
      "queues",
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
      "queues",
      "accounts",
      "admin",
    ]);
    expect(navItemsOf("admin", SEVEN).map((item) => item.key)).toEqual(ORDER);
  });

  it("opens each entry on its first screen and keeps its screens in order", () => {
    const admin = navItemsOf("admin");
    expect(admin.map((item) => item.href)).toEqual([
      "/accueil",
      "/files/profils-marque",
      "/inscrits",
      "/double-validation",
    ]);
    expect(admin[3]?.sections.map((section) => section.key)).toEqual([
      "dualControl",
      "internalAccounts",
      "apollo",
      "registrySources",
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
    ["/files/profils-marque", "queues", "brandReviewQueue"],
    [
      "/files/profils-marque/7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22",
      "queues",
      "brandReviewQueue",
    ],
    ["/files/profils-createur", "queues", "creatorReviewQueue"],
    [
      "/files/profils-createur/7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22",
      "queues",
      "creatorReviewQueue",
    ],
    ["/files/visuels", "queues", "portfolioQueue"],
    [
      "/files/visuels/7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22",
      "queues",
      "portfolioQueue",
    ],
    ["/files/verifications-createurs", "queues", "verificationCreators"],
    [
      "/files/verifications-createurs/7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22",
      "queues",
      "verificationCreators",
    ],
    ["/files/verifications-marques", "queues", "verificationBrands"],
    ["/files/contestations", "queues", "verificationDisputes"],
    [
      "/files/contestations/7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22",
      "queues",
      "verificationDisputes",
    ],
    ["/files/identifiants-modifies", "queues", "identifierChanges"],
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
    ["/reglages/sources-registre", "admin", "registrySources"],
    ["/sante-technique", "admin", "health"],
  ];

  for (const [pathname, entry, section] of cases) {
    it(`${pathname} → ${entry} › ${section}`, () => {
      expect(activePlaceOf(pathname)).toEqual({ entry, section });
    });
  }

  it("finds no entry for an unknown path nor for a mere prefix", () => {
    expect(activePlaceOf("/files")).toBeNull();
    expect(activePlaceOf("/files/profils-marquex")).toBeNull();
    expect(activePlaceOf("/")).toBeNull();
    expect(activePlaceOf("/absente")).toBeNull();
    expect(activePlaceOf("/inscritsx")).toBeNull();
    expect(activePlaceOf("/reglages")).toBeNull();
  });
});

describe("TN3: the screens of an entry as its sub-entries in the rail (D74)", () => {
  function itemOf(key: RailKey): NavItem {
    const item = navItemsOf("admin").find((entry) => entry.key === key);
    if (item === undefined) {
      throw new Error(`no ${key} entry`);
    }
    return item;
  }

  it("exposes no sub-menu for an entry of a single screen", () => {
    expect(subEntriesOf(itemOf("dashboard"))).toEqual([]);
    for (const item of navItemsOf("admin", SEVEN)) {
      expect(subEntriesOf(item), item.key).toEqual([]);
    }
  });

  it("gives Files its screens in order, queues 1 to 3, the two views of queue 4, then queues 5 and 6, the entry opening the first (L2E-21, L2G-15, L2G-16)", () => {
    const queues = itemOf("queues");
    expect(subEntriesOf(queues).map((section) => section.key)).toEqual([
      "brandReviewQueue",
      "creatorReviewQueue",
      "portfolioQueue",
      "verificationCreators",
      "verificationBrands",
      "verificationDisputes",
      "identifierChanges",
    ]);
    expect(queues.href).toBe("/files/profils-marque");
    expect(subEntriesOf(queues).map((section) => section.href)).toEqual([
      "/files/profils-marque",
      "/files/profils-createur",
      "/files/visuels",
      "/files/verifications-createurs",
      "/files/verifications-marques",
      "/files/contestations",
      "/files/identifiants-modifies",
    ]);
  });

  it("gives Comptes and Administration their screens in order, the entry opening the first", () => {
    const accounts = itemOf("accounts");
    expect(subEntriesOf(accounts).map((section) => section.key)).toEqual([
      "signups",
      "memberInvitations",
    ]);
    expect(accounts.href).toBe(subEntriesOf(accounts)[0]?.href);
    const admin = itemOf("admin");
    expect(subEntriesOf(admin).map((section) => section.key)).toEqual([
      "dualControl",
      "internalAccounts",
      "apollo",
      "registrySources",
      "health",
    ]);
    expect(admin.href).toBe(subEntriesOf(admin)[0]?.href);
  });

  it("makes Inscrits the current sub-entry of a record, its entry an ancestor", () => {
    const place = activePlaceOf(
      "/inscrits/7f1c3c1e-2d0b-4a52-9c5e-0d3b8f7a1b22",
    );
    expect(place).toEqual({ entry: "accounts", section: "signups" });
    expect(entryStateOf(itemOf("accounts"), place)).toBe("ancestor");
    expect(entryStateOf(itemOf("admin"), place)).toBe("idle");
  });

  it("makes the entry of a single screen current on that screen, and nothing current elsewhere", () => {
    const home = activePlaceOf("/accueil");
    expect(entryStateOf(itemOf("dashboard"), home)).toBe("current");
    expect(entryStateOf(itemOf("accounts"), home)).toBe("idle");
    for (const item of navItemsOf("admin")) {
      expect(entryStateOf(item, null), item.key).toBe("idle");
    }
  });

  it("leaves an agent no Administration entry, hence none of its sub-entries (CA63)", () => {
    const agent = navItemsOf("agent");
    expect(agent.map((item) => item.key)).not.toContain("admin");
    expect(agent.flatMap(subEntriesOf).map((section) => section.key)).toEqual([
      "brandReviewQueue",
      "creatorReviewQueue",
      "portfolioQueue",
      "verificationCreators",
      "verificationBrands",
      "verificationDisputes",
      "identifierChanges",
      "signups",
      "memberInvitations",
    ]);
  });
});

// The rules of the member navigation (docs/mvp/18 §12.1 TD2.1 to TD2.6; 17 §2.1 to §2.5; 02 §21.5
// points 2 and 9): which entries a role sees and in which order, how long their labels are, where
// they lead, which one is active, which space a page demands and which pages the terms screen lets
// through. Pure functions of src/lib, read without a browser; the shell only draws them.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import enMember from "@/locales/en/member.json";
import frMember from "@/locales/fr/member.json";
import type { AppLocale } from "@/i18n/routing";
import {
  activeEntryOf,
  NAV_ENTRY_MAX,
  NAV_LABEL_MAX_LENGTH,
  navItemsOf,
  navLabelFits,
  SPACE_ENTRIES,
  type NavEntry,
} from "@/lib/member-nav";
import {
  ACCOUNT_PAGES,
  isTermsExempt,
  MEMBER_PAGE_SLUGS,
  memberPageHref,
  memberPageOfPath,
  spaceOf,
  spaceRedirectOf,
  TERMS_EXEMPT_PAGES,
  type MemberPage,
} from "@/lib/member-paths";

const SPACE_GROUP = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "app",
  "[locale]",
  "(member)",
  "(space)",
);
const LOCALES: readonly AppLocale[] = ["fr", "en"];
const ROLES = ["advertiser", "creator"] as const;
const PAGES = Object.keys(MEMBER_PAGE_SLUGS) as MemberPage[];
const LABELS: Record<AppLocale, Record<string, string>> = {
  fr: frMember.shell.nav.entries,
  en: enMember.shell.nav.entries,
};

describe("TD2.1: five entries at most per role, in a fixed order (17 §2.1)", () => {
  it("lists the five entries of each space in the order of 17 §2.1", () => {
    const order = (role: (typeof ROLES)[number]) =>
      SPACE_ENTRIES[role].map(({ entry }) => entry);
    expect(order("advertiser")).toEqual([
      "home",
      "campaigns",
      "creators",
      "relations",
      "account",
    ] satisfies NavEntry[]);
    expect(order("creator")).toEqual([
      "home",
      "campaigns",
      "applications",
      "relations",
      "account",
    ] satisfies NavEntry[]);
    for (const role of ROLES) {
      expect(SPACE_ENTRIES[role].length).toBeLessThanOrEqual(NAV_ENTRY_MAX);
      // What a role sees keeps that order.
      const seen = navItemsOf(role).map(({ entry }) =>
        order(role).indexOf(entry),
      );
      expect(seen).toEqual([...seen].sort((a, b) => a - b));
    }
  });

  it("shows the entries whose screen exists only: Accueil and Compte before Lot 2", () => {
    expect(navItemsOf("advertiser")).toEqual([
      { entry: "home", page: "advertiserHome" },
      { entry: "account", page: "accountDetails" },
    ]);
    expect(navItemsOf("creator")).toEqual([
      { entry: "home", page: "creatorHome" },
      { entry: "account", page: "accountDetails" },
    ]);
  });
});

describe("TD2.2: labels of 11 characters at most, FR and EN, read in the translation files", () => {
  it("keeps every label of member.json within the limit, in both languages", () => {
    expect(NAV_LABEL_MAX_LENGTH).toBe(11);
    for (const locale of LOCALES) {
      for (const [entry, label] of Object.entries(LABELS[locale])) {
        expect(navLabelFits(label), `${locale} ${entry}: « ${label} »`).toBe(
          true,
        );
      }
    }
  });

  it("refuses « Candidatures » (12) and counts characters, not UTF-16 units", () => {
    expect(navLabelFits("Candidatures")).toBe(false);
    expect(navLabelFits("Préférences")).toBe(true); // 11, accents count once
    expect(navLabelFits("Créateurs")).toBe(true);
    expect(navLabelFits("Relations😀😀")).toBe(true); // 11 code points, 13 UTF-16 units
    expect(navLabelFits("Relations😀😀😀")).toBe(false);
  });

  it("has a label for each visible entry and none for an entry without a screen (02 §21.5 point 9)", () => {
    const visible = [
      ...new Set(ROLES.flatMap((role) => navItemsOf(role).map((i) => i.entry))),
    ].sort();
    for (const locale of LOCALES) {
      expect(Object.keys(LABELS[locale]).sort(), locale).toEqual(visible);
    }
  });
});

describe("TD2.3: every visible entry leads to a page that exists", () => {
  it("leads each entry to its page, in French and in English: no dead link", () => {
    for (const role of ROLES) {
      for (const item of navItemsOf(role)) {
        for (const locale of LOCALES) {
          const slug = MEMBER_PAGE_SLUGS[item.page][locale];
          expect(
            existsSync(path.join(SPACE_GROUP, ...slug.split("/"), "page.tsx")),
            `${role} ${item.entry} → /${locale}/${slug}`,
          ).toBe(true);
          expect(
            memberPageOfPath(memberPageHref(item.page, locale), locale),
          ).toBe(item.page);
        }
      }
    }
  });
});

describe("TD2.4: the active entry of each page", () => {
  const EXPECTED: Record<MemberPage, NavEntry | null> = {
    signIn: null,
    signupDoors: null,
    signupAdvertiser: null,
    signupCreator: null,
    advertiserHome: "home",
    creatorHome: "home",
    accountDetails: "account",
    accountPreferences: "account",
    accountSessions: "account",
    accountData: "account",
  };

  it("marks the entry of every page in both languages, Compte on every page of mon compte", () => {
    for (const page of PAGES) {
      for (const locale of LOCALES) {
        const found = memberPageOfPath(
          `/${MEMBER_PAGE_SLUGS[page][locale]}`,
          locale,
        );
        expect(found, `/${locale}/${MEMBER_PAGE_SLUGS[page][locale]}`).toBe(
          page,
        );
        expect(activeEntryOf(found), page).toBe(EXPECTED[page]);
      }
    }
  });

  it("marks none on an unknown path, a slug of the other language or a deeper path", () => {
    expect(memberPageOfPath("/compte/", "fr")).toBe("accountDetails");
    for (const [pathname, locale] of [
      ["/", "fr"],
      ["/inconnue", "fr"],
      ["/compte", "en"],
      ["/account/data", "fr"],
      ["/compte/donnees/plus", "fr"],
    ] as const) {
      expect(memberPageOfPath(pathname, locale), pathname).toBeNull();
    }
    expect(activeEntryOf(null)).toBeNull();
  });
});

describe("TD2.5: the space a page demands (17 §2.5, 05 RG66)", () => {
  it("sends a creator from the brand space to their home, and an advertiser from the creator's", () => {
    expect(spaceRedirectOf("advertiserHome", "creator")).toBe("creatorHome");
    expect(spaceRedirectOf("creatorHome", "advertiser")).toBe("advertiserHome");
    expect(spaceRedirectOf("advertiserHome", "advertiser")).toBeNull();
    expect(spaceRedirectOf("creatorHome", "creator")).toBeNull();
  });

  it("lets both roles into mon compte, common to the two spaces", () => {
    for (const page of ACCOUNT_PAGES) {
      expect(spaceOf(page), page).toBeNull();
      for (const role of ROLES) {
        expect(spaceRedirectOf(page, role), `${role} ${page}`).toBeNull();
      }
    }
  });
});

describe("TD2.6: the pages the blocking terms screen lets through (05 RG28, J7 A3)", () => {
  it("exempts exactly TERMS_EXEMPT_PAGES, mes préférences and mes données", () => {
    expect([...TERMS_EXEMPT_PAGES].sort()).toEqual([
      "accountData",
      "accountPreferences",
    ]);
    for (const page of PAGES) {
      expect(isTermsExempt(page), page).toBe(
        (TERMS_EXEMPT_PAGES as readonly MemberPage[]).includes(page),
      );
    }
  });

  it("keeps the homes and mes informations behind the screen", () => {
    for (const page of [
      "advertiserHome",
      "creatorHome",
      "accountDetails",
      "accountSessions",
    ] as const) {
      expect(isTermsExempt(page), page).toBe(false);
    }
  });
});

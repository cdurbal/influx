// The member pages of apps/web and their localized paths (docs/mvp/17 §2.6; 21 EC-15): each page
// has one address per language, its segments translated (/fr/inscription/marque ·
// /en/signup/brand). A page reached under the other language's slug is sent to its own one, like
// the public documents (src/lib/legal-documents.ts). The landing is rewired to these paths at J9.
import type { SignupDoor } from "@influx/contracts/auth";
import type { AppLocale } from "@/i18n/routing";

export type MemberPage =
  | "signIn"
  | "signupDoors"
  | "signupAdvertiser"
  | "signupCreator"
  | "advertiserHome"
  | "creatorHome"
  | "accountHub"
  | "accountDetails"
  | "accountProfile"
  | "accountVerificationOwnership"
  | "accountVerificationAudience"
  | "accountPreferences"
  | "accountSessions"
  | "accountData";

export const MEMBER_PAGE_SLUGS: Readonly<
  Record<MemberPage, Readonly<Record<AppLocale, string>>>
> = {
  signIn: { fr: "connexion", en: "sign-in" },
  signupDoors: { fr: "inscription", en: "signup" },
  signupAdvertiser: { fr: "inscription/marque", en: "signup/brand" },
  signupCreator: { fr: "inscription/createur", en: "signup/creator" },
  advertiserHome: { fr: "marque", en: "brand" },
  creatorHome: { fr: "createur", en: "creator" },
  // "Mon compte" (17 §6.0 to §6.4), common to both spaces: /fr/compte/* · /en/account/* (EC-15);
  // its page-menu (D74) holds the bare address, each page of the rubric a sub-path.
  accountHub: { fr: "compte", en: "account" },
  accountDetails: { fr: "compte/informations", en: "account/details" },
  // "Mon profil de marque" (17 §4.2, M2; EC-L2B-7) for a brand, "Mon profil" (17 §5.2, C2; L2D) for a creator
  accountProfile: { fr: "compte/profil", en: "account/profile" },
  // "Faire vérifier mon compte" (17 §5.3, C3; L2E): the ownership journey of one network line, a child of
  // the profile (modele.md §6); the network is the `network` of the query, never a segment (J4S-7).
  accountVerificationOwnership: {
    fr: "compte/profil/verification/propriete",
    en: "account/profile/verification/ownership",
  },
  // "Faire vérifier mon audience" (17 §5.3, C3; L2E, commit 19): the same, for the audience of the line.
  accountVerificationAudience: {
    fr: "compte/profil/verification/audience",
    en: "account/profile/verification/audience",
  },
  accountPreferences: { fr: "compte/preferences", en: "account/preferences" },
  accountSessions: { fr: "compte/sessions", en: "account/sessions" },
  accountData: { fr: "compte/donnees", en: "account/data" },
};

/**
 * The pages of "mon compte", in the order of their navigation; its page-menu (accountHub, 17 §6.0)
 * is the page of the rubric, not one of them.
 */
export const ACCOUNT_PAGES = [
  "accountDetails",
  "accountPreferences",
  "accountSessions",
  "accountData",
] as const satisfies readonly MemberPage[];

export type AccountPage = (typeof ACCOUNT_PAGES)[number];

/**
 * The profile page of "mon compte", first of its rubric for both roles (L2B "Mon profil de marque",
 * M2; L2D "Mon profil", C2): the same address, the screen follows the real role (17 §2.6).
 */
export const PROFILE_ACCOUNT_PAGE =
  "accountProfile" as const satisfies MemberPage;

/** Every page of the rubric "mon compte" a member can have in its column. */
export type AccountSubPage = AccountPage | typeof PROFILE_ACCOUNT_PAGE;

/**
 * The pages that hang below another one in the column: the profile stays the active sub-entry while
 * a creator verifies a network line (L2E, commit 18). They are not entries of their own.
 */
export const PARENT_PAGES: Readonly<Partial<Record<MemberPage, MemberPage>>> = {
  accountVerificationOwnership: PROFILE_ACCOUNT_PAGE,
  accountVerificationAudience: PROFILE_ACCOUNT_PAGE,
};

/** The name of the query parameter that carries the network of a verification journey (a reference-list code, never an identifier of an account). */
export const NETWORK_QUERY_PARAMETER = "network";

/** A network code as the reference list writes it: snake_case, at most 63 characters (0201). */
export function isNetworkCode(value: string): boolean {
  return value.length <= 63 && /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(value);
}

/**
 * The path of the ownership journey of a network, in the CURRENT language and without the prefix
 * (for the localized `Link`): the page, then the network as a query parameter. The query never
 * reaches `ops`: the collector sends the pathname only (J4S-7).
 */
export function ownershipJourneyHref(
  networkCode: string,
  locale: AppLocale,
): string {
  return `${memberPageHref("accountVerificationOwnership", locale)}?${NETWORK_QUERY_PARAMETER}=${networkCode}`;
}

/**
 * The path of the audience journey of a network, as `ownershipJourneyHref` writes the ownership one
 * (L2E, commit 19): the page, then the network as a query parameter that never reaches `ops`.
 */
export function audienceJourneyHref(
  networkCode: string,
  locale: AppLocale,
): string {
  return `${memberPageHref("accountVerificationAudience", locale)}?${NETWORK_QUERY_PARAMETER}=${networkCode}`;
}

/**
 * The pages of "mon compte" a member reaches, in the order of the column and the page-menu: the
 * same for both roles since L2D (the role only decides which screen the profile page holds).
 */
export function accountPagesOf(): readonly AccountSubPage[] {
  return [PROFILE_ACCOUNT_PAGE, ...ACCOUNT_PAGES];
}

/**
 * The key of the label of a page of "mon compte" in the translation files (`account.nav.*`,
 * `account.hub.items.*`): the profile page is "Profil de marque" for a brand, "Mon profil" for a
 * creator, the others are the same for both.
 */
export function accountLabelKeyOf(
  page: AccountSubPage,
  role: SignupDoor,
): AccountSubPage | "accountProfileCreator" {
  return page === PROFILE_ACCOUNT_PAGE && role === "creator"
    ? "accountProfileCreator"
    : page;
}

/**
 * The pages a member reaches while a version of the terms waits for acceptance (05 RG28; 17 §6.7;
 * J7 A3): the rights of the person survive a refused version, so the blocking screen links to
 * them. apps/api exempts their routes from the terms gate; every other page shows the screen. The
 * page-menu of "mon compte" (D74) shows links only, so that a phone goes from one to the other.
 */
export const TERMS_EXEMPT_PAGES: readonly MemberPage[] = [
  "accountHub",
  "accountPreferences",
  "accountData",
];

/** Whether a page lets the member through while a version of the terms waits (05 RG28, J7 A3). */
export function isTermsExempt(page: MemberPage): boolean {
  return TERMS_EXEMPT_PAGES.includes(page);
}

/**
 * The space a page belongs to (17 §2.1): the brand space is the advertiser's, the creator space
 * the creator's; "mon compte" and the journey belong to none (null).
 */
const PAGE_SPACES: Readonly<Partial<Record<MemberPage, SignupDoor>>> = {
  advertiserHome: "advertiser",
  creatorHome: "creator",
};

export function spaceOf(page: MemberPage): SignupDoor | null {
  return PAGE_SPACES[page] ?? null;
}

/**
 * Where a member of `role` is sent from a page of the other space: the home of their own (17 §2.5,
 * 05 RG66, the space follows the real role, never the address typed); null when the page is theirs.
 */
export function spaceRedirectOf(
  page: MemberPage,
  role: SignupDoor,
): MemberPage | null {
  const space = spaceOf(page);
  return space === null || space === role ? null : homePageOf(role);
}

/**
 * The page a path of the CURRENT language leads to, without the locale prefix (the `usePathname`
 * of src/i18n/navigation.ts: "/compte/donnees"), or null for any other path.
 */
export function memberPageOfPath(
  pathname: string,
  locale: AppLocale,
): MemberPage | null {
  const slug = pathname.replace(/^\/+|\/+$/g, "");
  const pages = Object.keys(MEMBER_PAGE_SLUGS) as MemberPage[];
  return pages.find((page) => MEMBER_PAGE_SLUGS[page][locale] === slug) ?? null;
}

/** The path of a page in a language, with its locale prefix (redirects, plain links). */
export function memberPagePath(page: MemberPage, locale: AppLocale): string {
  return `/${locale}/${MEMBER_PAGE_SLUGS[page][locale]}`;
}

/**
 * The path of a page in the CURRENT language, without the prefix: for the localized `Link` and
 * `useRouter` of src/i18n/navigation.ts, which add it.
 */
export function memberPageHref(page: MemberPage, locale: AppLocale): string {
  return `/${MEMBER_PAGE_SLUGS[page][locale]}`;
}

/** The home of a role's space (17 §2.5): the space follows the real role, never the door. */
export function homePageOf(role: SignupDoor): MemberPage {
  return role === "advertiser" ? "advertiserHome" : "creatorHome";
}

/** The sign-up page of a door, or the choice of door when none is chosen yet (05 RG3). */
export function signupPageOf(door: SignupDoor | null): MemberPage {
  if (door === null) {
    return "signupDoors";
  }
  return door === "advertiser" ? "signupAdvertiser" : "signupCreator";
}

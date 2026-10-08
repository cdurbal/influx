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
  | "creatorHome";

export const MEMBER_PAGE_SLUGS: Readonly<
  Record<MemberPage, Readonly<Record<AppLocale, string>>>
> = {
  signIn: { fr: "connexion", en: "sign-in" },
  signupDoors: { fr: "inscription", en: "signup" },
  signupAdvertiser: { fr: "inscription/marque", en: "signup/brand" },
  signupCreator: { fr: "inscription/createur", en: "signup/creator" },
  advertiserHome: { fr: "marque", en: "brand" },
  creatorHome: { fr: "createur", en: "creator" },
};

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

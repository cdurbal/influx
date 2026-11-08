// Server side of the member pages: the journey, the homes and "mon compte" (docs/mvp/17 §2.6, §3,
// §6; 21 EC-15).
// One address per language (src/lib/member-paths.ts): a page reached under the other language's
// slug is sent to its own one. Every page is noindex (17 §2.6). Only the `auth` namespace reaches
// the browser on the journey; the pages of the spaces receive theirs from (space)/layout.tsx
// (`SpaceMessages`); the landing keeps sending none of its texts.
import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { MESSAGES } from "@/i18n/messages";
import { routing, type AppLocale } from "@/i18n/routing";
import {
  MEMBER_PAGE_SLUGS,
  memberPagePath,
  type MemberPage,
} from "@/lib/member-paths";

const PAGE_TITLES = {
  signIn: "auth.meta.signInTitle",
  signupDoors: "auth.meta.signupTitle",
  signupAdvertiser: "auth.meta.signupAdvertiserTitle",
  signupCreator: "auth.meta.signupCreatorTitle",
  advertiserHome: "auth.meta.homeTitle",
  creatorHome: "auth.meta.homeTitle",
  accountHub: "account.meta.hub",
  accountDetails: "account.meta.details",
  accountProfile: "account.meta.profile",
  accountVerificationOwnership: "verification.meta.ownership",
  accountPreferences: "account.meta.preferences",
  accountSessions: "account.meta.sessions",
  accountData: "account.meta.data",
} as const satisfies Record<MemberPage, string>;

/** Member pages are never indexed (17 §2.6). */
export async function memberPageMetadata(
  locale: string,
  page: MemberPage,
): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale });
  return {
    title: t(PAGE_TITLES[page]),
    robots: { index: false, follow: false },
  };
}

/**
 * The language of a member page, once checked: an unknown language is a 404, and `slug` (the
 * folder of the page) must be the page's slug in that language, else the visitor is sent there.
 */
export function memberPageLocale(
  locale: string,
  page: MemberPage,
  slug: string,
): AppLocale {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  if (MEMBER_PAGE_SLUGS[page][locale] !== slug) {
    redirect(memberPagePath(page, locale));
  }
  setRequestLocale(locale);
  return locale;
}

/** The texts of the journey, the one namespace its screens read. */
export function AuthMessages({
  locale,
  children,
}: {
  locale: AppLocale;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider messages={{ auth: MESSAGES[locale].auth }}>
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * The texts of the spaces, given once by (space)/layout.tsx: `auth` and `account` for the homes and
 * "mon compte" (the blocking terms screen, 17 §6.7, can show on any page), `member` for the shell,
 * `brandProfile` for the brand's profile (17 §4.2) and its labels of lists, `creatorProfile` for the
 * creator's (17 §5.2), `verification` for the badge of a creator's network line (L2E, 08 RG93).
 */
export function SpaceMessages({
  locale,
  children,
}: {
  locale: AppLocale;
  children: ReactNode;
}) {
  const { auth, account, member, brandProfile, creatorProfile, verification } =
    MESSAGES[locale];
  return (
    <NextIntlClientProvider
      messages={{
        auth,
        account,
        member,
        brandProfile,
        creatorProfile,
        verification,
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}

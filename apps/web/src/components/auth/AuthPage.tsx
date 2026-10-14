// Server side of the member pages: the journey, the homes and "mon compte" (docs/mvp/17 §2.6, §3,
// §6; 21 EC-15).
// One address per language (src/lib/member-paths.ts): a page reached under the other language's
// slug is sent to its own one. Every page is noindex (17 §2.6). Only the `auth` and `account`
// namespaces reach the browser; the landing keeps sending none of its texts.
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
  accountDetails: "account.meta.details",
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

/**
 * The texts the browser receives: `auth` on every member page; `account` too on the homes and
 * the pages of "mon compte" (the blocking terms screen, 17 §6.7, can show on any of them).
 */
export function AuthMessages({
  locale,
  withAccount = false,
  children,
}: {
  locale: AppLocale;
  withAccount?: boolean;
  children: ReactNode;
}) {
  const messages = MESSAGES[locale];
  return (
    <NextIntlClientProvider
      messages={
        withAccount
          ? { auth: messages.auth, account: messages.account }
          : { auth: messages.auth }
      }
    >
      {children}
    </NextIntlClientProvider>
  );
}

// Server side of the member pages: the journey and the homes (docs/mvp/17 §2.6, §3; 21 EC-15).
// One address per language (src/lib/member-paths.ts): a page reached under the other language's
// slug is sent to its own one. Every page is noindex (17 §2.6). Only the `auth` namespace reaches
// the browser; the landing keeps sending none of its texts.
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
  signIn: "signInTitle",
  signupDoors: "signupTitle",
  signupAdvertiser: "signupAdvertiserTitle",
  signupCreator: "signupCreatorTitle",
  advertiserHome: "homeTitle",
  creatorHome: "homeTitle",
} as const satisfies Record<MemberPage, string>;

/** Member pages are never indexed (17 §2.6). */
export async function memberPageMetadata(
  locale: string,
  page: MemberPage,
): Promise<Metadata> {
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: "auth.meta" });
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

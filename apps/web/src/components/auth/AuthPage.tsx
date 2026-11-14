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
  advertiserCampaigns: "campaign.meta.list",
  advertiserCampaign: "campaign.meta.form",
  advertiserCampaignPreview: "campaign.meta.preview",
  accountHub: "account.meta.hub",
  accountDetails: "account.meta.details",
  accountProfile: "account.meta.profile",
  accountProfilePreview: "account.meta.profilePreview",
  accountVerificationOwnership: "verification.meta.ownership",
  accountVerificationAudience: "verification.meta.audience",
  accountVerificationAppeal: "verification.meta.appeal",
  accountBrandVerification: "verification.meta.brand",
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

/** What an identifier of the dynamic segment may be: plain characters, never a separator (an opaque id). */
const SEGMENT_PATTERN = /^[A-Za-z0-9-]{1,64}$/;

/**
 * The language of a member page, once checked: an unknown language is a 404, and `slug` (the
 * folder of the page) must be the page's slug in that language, else the visitor is sent there.
 * `segment`: the identifier of a page with a dynamic segment, carried to the address it is sent to.
 */
export function memberPageLocale(
  locale: string,
  page: MemberPage,
  slug: string,
  segment?: string,
): AppLocale {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  if (segment !== undefined && !SEGMENT_PATTERN.test(segment)) {
    notFound();
  }
  if (MEMBER_PAGE_SLUGS[page][locale] !== slug) {
    redirect(memberPagePath(page, locale, segment));
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
 * creator's (17 §5.2), `verification` for the badge of a creator's network line (L2E, 08 RG93),
 * `campaign` for the campaigns of a brand (17 §4.3, L3B).
 */
export function SpaceMessages({
  locale,
  children,
}: {
  locale: AppLocale;
  children: ReactNode;
}) {
  const {
    auth,
    account,
    member,
    brandProfile,
    creatorProfile,
    verification,
    campaign,
  } = MESSAGES[locale];
  return (
    <NextIntlClientProvider
      messages={{
        auth,
        account,
        member,
        brandProfile,
        creatorProfile,
        verification,
        campaign,
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}

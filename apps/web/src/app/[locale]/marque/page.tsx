import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthMessages, authMetadata } from "@/components/auth/AuthPage";
import { MemberHome } from "@/components/auth/MemberHome";
import { routing } from "@/i18n/routing";

// Empty home of the brand space at J3 (docs/mvp/17 §3.7), behind the session (GET /v1/me).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/marque">): Promise<Metadata> {
  const { locale } = await params;
  return hasLocale(routing.locales, locale)
    ? authMetadata(locale, "homeTitle")
    : {};
}

export default async function BrandHomePage({
  params,
}: PageProps<"/[locale]/marque">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  return (
    <AuthMessages locale={locale}>
      <MemberHome space="advertiser" />
    </AuthMessages>
  );
}

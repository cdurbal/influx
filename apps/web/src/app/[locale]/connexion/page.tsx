import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthMessages, authMetadata } from "@/components/auth/AuthPage";
import { SignInFlow } from "@/components/auth/SignInFlow";
import { routing } from "@/i18n/routing";

// Member sign-in, minimal screen of the J3 (docs/mvp/17 §3.7). Local stack and closed staging only.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/connexion">): Promise<Metadata> {
  const { locale } = await params;
  return hasLocale(routing.locales, locale)
    ? authMetadata(locale, "signInTitle")
    : {};
}

export default async function SignInPage({
  params,
}: PageProps<"/[locale]/connexion">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  return (
    <AuthMessages locale={locale}>
      <SignInFlow />
    </AuthMessages>
  );
}

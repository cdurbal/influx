import type { Metadata } from "next";
import {
  AuthMessages,
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AccountPageView } from "@/components/account/AccountPageView";

// "Mes préférences de communication" (docs/mvp/17 §6; §2.6), French path, behind the session.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/compte/preferences">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountPreferences");
}

export default async function AccountPreferencesPage({
  params,
}: PageProps<"/[locale]/compte/preferences">) {
  const { locale } = await params;
  const pageLocale = memberPageLocale(
    locale,
    "accountPreferences",
    "compte/preferences",
  );
  return (
    <AuthMessages locale={pageLocale} withAccount>
      <AccountPageView page="accountPreferences" />
    </AuthMessages>
  );
}

import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AccountPageView } from "@/components/account/AccountPageView";

// "Mes préférences de communication" (docs/mvp/17 §6; §2.6), English path, behind the session.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account/preferences">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountPreferences");
}

export default async function AccountPreferencesPage({
  params,
}: PageProps<"/[locale]/account/preferences">) {
  const { locale } = await params;
  memberPageLocale(locale, "accountPreferences", "account/preferences");
  return <AccountPageView page="accountPreferences" />;
}

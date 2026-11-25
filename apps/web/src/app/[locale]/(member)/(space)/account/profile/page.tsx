import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AccountProfileScreen } from "@/components/account/AccountProfileScreen";

// "Mon profil de marque" (17 §4.2, M2) or "Mon profil" (17 §5.2, C2; §2.6), by role, English path, behind the session.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account/profile">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountProfile");
}

export default async function AccountProfilePage({
  params,
}: PageProps<"/[locale]/account/profile">) {
  const { locale } = await params;
  memberPageLocale(locale, "accountProfile", "account/profile");
  return <AccountProfileScreen />;
}

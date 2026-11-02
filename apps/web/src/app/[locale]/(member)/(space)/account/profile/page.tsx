import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { BrandProfileScreen } from "@/components/brand-profile/BrandProfileScreen";

// "Mon profil de marque" (docs/mvp/17 §4.2, M2; §2.6), English path, behind the session.
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
  return <BrandProfileScreen />;
}

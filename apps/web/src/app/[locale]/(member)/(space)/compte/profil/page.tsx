import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { BrandProfileScreen } from "@/components/brand-profile/BrandProfileScreen";

// "Mon profil de marque" (docs/mvp/17 §4.2, M2; §2.6), French path, behind the session.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/compte/profil">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountProfile");
}

export default async function AccountProfilePage({
  params,
}: PageProps<"/[locale]/compte/profil">) {
  const { locale } = await params;
  memberPageLocale(locale, "accountProfile", "compte/profil");
  return <BrandProfileScreen />;
}

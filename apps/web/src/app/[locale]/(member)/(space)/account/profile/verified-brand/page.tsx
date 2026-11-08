import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { BrandVerificationScreen } from "@/components/verification/BrandVerificationScreen";

// "Verify my brand" (17 §4.2, M2 block 4; 06 RG49 to RG52): the one request of a brand for the badge
// "Brand verified", English path, behind the session. The badge is the account's: no network, no query.
// Any other role finds no such page.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account/profile/verified-brand">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountBrandVerification");
}

export default async function BrandVerificationPage({
  params,
}: PageProps<"/[locale]/account/profile/verified-brand">) {
  const { locale } = await params;
  memberPageLocale(
    locale,
    "accountBrandVerification",
    "account/profile/verified-brand",
  );
  return <BrandVerificationScreen />;
}

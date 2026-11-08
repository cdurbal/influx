import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { BrandVerificationScreen } from "@/components/verification/BrandVerificationScreen";

// "Faire vérifier ma marque" (17 §4.2, M2 block 4; 06 RG49 to RG52): the one request of a brand for the
// badge « Marque vérifiée », French path, behind the session. The badge is the account's: no network, no
// query. Any other role finds no such page.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/compte/profil/marque-verifiee">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountBrandVerification");
}

export default async function BrandVerificationPage({
  params,
}: PageProps<"/[locale]/compte/profil/marque-verifiee">) {
  const { locale } = await params;
  memberPageLocale(
    locale,
    "accountBrandVerification",
    "compte/profil/marque-verifiee",
  );
  return <BrandVerificationScreen />;
}

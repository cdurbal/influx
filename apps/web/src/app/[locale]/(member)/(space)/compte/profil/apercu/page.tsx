import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { CreatorPreviewScreen } from "@/components/creator-profile/CreatorPreviewScreen";

// "Ce que voit une marque" (17 §5.2, C2; 07 RG104): the creator reads his own card as the platform serves
// it, before and after an introduction, French path, behind the session. Any other role finds no such page.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/compte/profil/apercu">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountProfilePreview");
}

export default async function ProfilePreviewPage({
  params,
}: PageProps<"/[locale]/compte/profil/apercu">) {
  const { locale } = await params;
  memberPageLocale(locale, "accountProfilePreview", "compte/profil/apercu");
  return <CreatorPreviewScreen />;
}

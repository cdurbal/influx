import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { CreatorPreviewScreen } from "@/components/creator-profile/CreatorPreviewScreen";

// "What a brand sees" (17 §5.2, C2; 07 RG104): the creator reads his own card as the platform serves it,
// before and after an introduction, English path, behind the session. Any other role finds no such page.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account/profile/preview">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountProfilePreview");
}

export default async function ProfilePreviewPage({
  params,
}: PageProps<"/[locale]/account/profile/preview">) {
  const { locale } = await params;
  memberPageLocale(locale, "accountProfilePreview", "account/profile/preview");
  return <CreatorPreviewScreen />;
}

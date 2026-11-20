import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { ShortlistsScreen } from "@/components/creator-search/ShortlistsScreen";

// "Mes sélections" (17 §4.9, 10 RG51; L3F, commit 11): French path, behind the session, the second page of "Créateurs".
// The page of a brand: any other role finds no such page.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/createurs/selections">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "advertiserShortlists");
}

export default async function ShortlistsPage({
  params,
}: PageProps<"/[locale]/createurs/selections">) {
  const { locale } = await params;
  memberPageLocale(locale, "advertiserShortlists", "createurs/selections");
  return <ShortlistsScreen />;
}

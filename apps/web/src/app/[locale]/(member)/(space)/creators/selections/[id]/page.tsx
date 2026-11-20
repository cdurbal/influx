import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { ShortlistScreen } from "@/components/creator-search/ShortlistScreen";

// One of the brand's private lists (17 §4.9, 10 RG51; L3F, commit 11): English path, behind the session, the child of
// "Mes sélections"; the opaque identifier of the list is the one segment. A list of another brand and an unknown
// one find no such page (T14). Any other role finds no such page.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/creators/selections/[id]">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "advertiserShortlist");
}

export default async function ShortlistPage({
  params,
}: PageProps<"/[locale]/creators/selections/[id]">) {
  const { locale, id } = await params;
  memberPageLocale(
    locale,
    "advertiserShortlist",
    "creators/selections/[id]",
    id,
  );
  return <ShortlistScreen id={id} />;
}

import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { CreatorSearchScreen } from "@/components/creator-search/CreatorSearchScreen";
import { addressOfParams } from "@/components/creator-search/creator-search-view";

// "Créateurs" (17 §4.4, M4; L3F): the brand's anonymous search, English path, behind the session. The criteria are
// the query of the address; any other role finds no such page.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/creators">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "advertiserCreators");
}

export default async function CreatorsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/creators">) {
  const { locale } = await params;
  memberPageLocale(locale, "advertiserCreators", "creators");
  const { query, page, listId } = addressOfParams(await searchParams);
  return (
    <CreatorSearchScreen query={query} page={page} listId={listId ?? null} />
  );
}

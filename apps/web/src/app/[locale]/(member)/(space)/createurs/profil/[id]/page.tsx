import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AnonymousProfileScreen } from "@/components/creator-search/AnonymousProfileScreen";
import { addressOfParams } from "@/components/creator-search/creator-search-view";

// The anonymous profile of a creator (17 §4.4, §7.1; 10 RG50; L3F, commit 11): French path, behind the session, a child of
// the search. The alias of the card is the one identifier of the path (RG65); the query is the search's own address
// (the way back). Any other role finds no such page; an unknown alias is answered as an excluded one (CA49).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/createurs/profil/[id]">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "advertiserCreatorProfile");
}

export default async function CreatorProfilePage({
  params,
  searchParams,
}: PageProps<"/[locale]/createurs/profil/[id]">) {
  const { locale, id } = await params;
  memberPageLocale(
    locale,
    "advertiserCreatorProfile",
    "createurs/profil/[id]",
    id,
  );
  const { query, page, listId } = addressOfParams(await searchParams);
  return (
    <AnonymousProfileScreen
      alias={id}
      query={query}
      page={page}
      listId={listId ?? null}
    />
  );
}

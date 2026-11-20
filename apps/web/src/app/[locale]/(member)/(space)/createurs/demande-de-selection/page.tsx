import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { addressOfParams } from "@/components/creator-search/creator-search-view";
import { SelectionRequestScreen } from "@/components/creator-search/SelectionRequestScreen";

// "Demander une sélection à l'équipe" (17 §4.4, 10 RG61; L3F): French path, behind the session, a child of the
// search; the criteria of the search are the query of the address (reprise). Any other role finds no such page.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/createurs/demande-de-selection">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "advertiserSelectionRequest");
}

export default async function SelectionRequestPage({
  params,
  searchParams,
}: PageProps<"/[locale]/createurs/demande-de-selection">) {
  const { locale } = await params;
  memberPageLocale(
    locale,
    "advertiserSelectionRequest",
    "createurs/demande-de-selection",
  );
  const { query, page, listId } = addressOfParams(await searchParams);
  return (
    <SelectionRequestScreen place={{ query, page, listId: listId ?? null }} />
  );
}

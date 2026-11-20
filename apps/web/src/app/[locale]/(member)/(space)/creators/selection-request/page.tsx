import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { addressOfParams } from "@/components/creator-search/creator-search-view";
import { SelectionRequestScreen } from "@/components/creator-search/SelectionRequestScreen";

// "Request a selection" (17 §4.4, 10 RG61; L3F): English path, behind the session, a child of the search; the
// criteria of the search are the query of the address (reprise). Any other role finds no such page.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/creators/selection-request">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "advertiserSelectionRequest");
}

export default async function SelectionRequestPage({
  params,
  searchParams,
}: PageProps<"/[locale]/creators/selection-request">) {
  const { locale } = await params;
  memberPageLocale(
    locale,
    "advertiserSelectionRequest",
    "creators/selection-request",
  );
  const { query } = addressOfParams(await searchParams);
  return <SelectionRequestScreen filters={query.filters} />;
}

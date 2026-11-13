import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { CampaignListScreen } from "@/components/campaign/CampaignListScreen";

// "Mes campagnes" (17 §2.6, §4.3; L3B): the campaigns of a brand, French path, behind the session. Any other
// role finds no such page.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/campagnes">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "advertiserCampaigns");
}

export default async function CampaignsPage({
  params,
}: PageProps<"/[locale]/campagnes">) {
  const { locale } = await params;
  memberPageLocale(locale, "advertiserCampaigns", "campagnes");
  return <CampaignListScreen />;
}

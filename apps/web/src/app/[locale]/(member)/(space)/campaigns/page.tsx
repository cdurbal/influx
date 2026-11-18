import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { CAMPAIGNS_PAGE } from "@/lib/member-paths";
import { CampaignsScreen } from "@/components/campaign/CampaignsScreen";

// "Campagnes" (17 §2.6, §4.3, §5.5; L3B, L3D): one English path for both roles, behind the session. The screen follows the real
// role: a brand's "Mes campagnes", a creator's feed of open campaigns.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/campaigns">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, CAMPAIGNS_PAGE);
}

export default async function CampaignsPage({
  params,
}: PageProps<"/[locale]/campaigns">) {
  const { locale } = await params;
  memberPageLocale(locale, CAMPAIGNS_PAGE, "campaigns");
  return <CampaignsScreen />;
}

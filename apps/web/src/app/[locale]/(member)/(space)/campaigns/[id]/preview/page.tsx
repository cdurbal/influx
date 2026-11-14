import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { CampaignPreviewScreen } from "@/components/campaign/CampaignPreviewScreen";

// "Ce que voit un créateur" (17 §4.3; 09 RG102, CA68; L3B): the brand reads its campaign as the platform serves
// it to a creator, English path, behind the session. A campaign of another brand, an unknown one and any other
// role find no such page (T14).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/campaigns/[id]/preview">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "advertiserCampaignPreview");
}

export default async function CampaignPreviewPage({
  params,
}: PageProps<"/[locale]/campaigns/[id]/preview">) {
  const { locale, id } = await params;
  memberPageLocale(
    locale,
    "advertiserCampaignPreview",
    "campaigns/[id]/preview",
    id,
  );
  return <CampaignPreviewScreen id={id} />;
}

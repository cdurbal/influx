import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { CampaignPageScreen } from "@/components/campaign/CampaignPageScreen";
import { stepOfParameter } from "@/components/campaign/campaign-view";

// The form of a brand's campaign, in five steps (17 §4.3, M3; L3B), or the record of an open campaign for a creator
// (17 §5.6; L3D): English path, behind the session, the screen follows the role. The campaign is the opaque
// identifier of the path, the step the query's; a campaign of another brand and an unknown one find no such page
// for a brand (T14), "no longer open" for a creator (RG24).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/campaigns/[id]">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "advertiserCampaign");
}

export default async function CampaignPage({
  params,
  searchParams,
}: PageProps<"/[locale]/campaigns/[id]">) {
  const { locale, id } = await params;
  memberPageLocale(locale, "advertiserCampaign", "campaigns/[id]", id);
  return (
    <CampaignPageScreen
      id={id}
      initialStep={stepOfParameter((await searchParams).step)}
    />
  );
}

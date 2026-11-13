import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { CampaignFormScreen } from "@/components/campaign/CampaignFormScreen";
import { stepOfParameter } from "@/components/campaign/campaign-view";

// The form of a campaign, in five steps (17 §4.3, M3; L3B): French path, behind the session. The campaign is
// the opaque identifier of the path, the step the query's; a campaign of another brand, an unknown one and any
// other role find no such page (T14).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/campagnes/[id]">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "advertiserCampaign");
}

export default async function CampaignPage({
  params,
  searchParams,
}: PageProps<"/[locale]/campagnes/[id]">) {
  const { locale, id } = await params;
  memberPageLocale(locale, "advertiserCampaign", "campagnes/[id]", id);
  return (
    <CampaignFormScreen
      id={id}
      initialStep={stepOfParameter((await searchParams).step)}
    />
  );
}

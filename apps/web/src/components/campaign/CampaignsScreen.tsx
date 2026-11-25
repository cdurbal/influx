"use client";

// The page "Campagnes" (docs/mvp/17 §2.6; jalons/l3d/modele.md §7): one address for both roles, the screen follows
// the real role, never the address (the pattern of AccountProfileScreen): "Mes campagnes" for a brand (L3B), the
// feed of open campaigns for a creator (L3D, C5). The API still answers "no such page" to the role it does not
// serve, for each of its routes (T14).
import { useMember } from "@/components/member/member-context";
import { CampaignFeedScreen } from "./CampaignFeedScreen";
import { CampaignListScreen } from "./CampaignListScreen";

export function CampaignsScreen() {
  const { me } = useMember();
  return me.role === "creator" ? (
    <CampaignFeedScreen />
  ) : (
    <CampaignListScreen />
  );
}

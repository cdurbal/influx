"use client";

// The page /campagnes/[id] (docs/mvp/17 §4.3, §5.6; jalons/l3d, commit 05): one address for both roles, the screen
// follows the real role, never the address (the pattern of CampaignsScreen): the form of a brand's campaign (L3B), the
// record of an open campaign for a creator (L3D, C6). The API answers "no such page" to the role it does not serve,
// for each of its routes (T14); the form still finds no page for a role that is neither.
import { useMember } from "@/components/member/member-context";
import type { CampaignStep } from "./campaign-domain";
import { CampaignFormScreen } from "./CampaignFormScreen";
import { CampaignRecordScreen } from "./CampaignRecordScreen";

export function CampaignPageScreen({
  id,
  initialStep,
}: {
  id: string;
  initialStep: CampaignStep;
}) {
  const { me } = useMember();
  return me.role === "creator" ? (
    <CampaignRecordScreen id={id} />
  ) : (
    <CampaignFormScreen id={id} initialStep={initialStep} />
  );
}

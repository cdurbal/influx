import { Suspense } from "react";
import { CampaignRecordScreen } from "@/components/CampaignRecordScreen";

// The record of a campaign for an agent, under the accounts (09 RG1, RG8, RG9, RG93, RG94; 17b §3.5 block 4, §3.8;
// L3C-09). The id is the campaign's, checked by apps/api; the client refuses to call with anything but a UUID.
// The screen is keyed by the campaign, so that a link from one record to another starts from a clean state.
export default async function CampaignRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <CampaignRecordScreen key={id} id={id} />
    </Suspense>
  );
}

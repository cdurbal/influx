import { Suspense } from "react";
import { CampaignReviewEntryScreen } from "@/components/CampaignReviewEntryScreen";

// One entry of queue 7, "Campagnes à valider": the decision screen (09 RG5, RG85, RG88 to RG95; 15 RG27 C1 to C8;
// 17b §3.8; L3C-08). Opening the page opens the entry, which takes it in charge. The id is checked by apps/api;
// the client refuses to call with anything but a UUID. The screen is keyed by the entry, so that the chain of
// 17b §2.6 starts the next one from a clean state.
export default async function CampaignReviewEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <CampaignReviewEntryScreen key={id} id={id} />
    </Suspense>
  );
}

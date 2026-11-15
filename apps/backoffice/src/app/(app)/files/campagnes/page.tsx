import { Suspense } from "react";
import { CampaignQueueScreen } from "@/components/CampaignQueueScreen";

// Queue 7, "Campagnes à valider" (09 RG5, RG85, RG87; 15 RG26 to RG28; 17b §2.7 line 6, §3.8; L3C-08).
export default function CampaignReviewQueuePage() {
  return (
    <Suspense>
      <CampaignQueueScreen />
    </Suspense>
  );
}

import { Suspense } from "react";
import { CreatorQueueScreen } from "@/components/CreatorQueueScreen";

// Queue 2, "Profils créateur à valider" (17b §2.7 line 2; 07 RG4 to RG10; jalons/l2g/modele.md §6; L2G-15).
export default function CreatorReviewQueuePage() {
  return (
    <Suspense>
      <CreatorQueueScreen />
    </Suspense>
  );
}

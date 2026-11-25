import { Suspense } from "react";
import { VerificationBrandsQueueScreen } from "@/components/VerificationQueueScreens";

// Queue 4, view "Vérifications des marques" (17b §3.7; 08 RG61 to RG66; jalons/l2e, commit 21).
export default function VerificationBrandsQueuePage() {
  return (
    <Suspense>
      <VerificationBrandsQueueScreen />
    </Suspense>
  );
}

import { Suspense } from "react";
import { VerificationCreatorsQueueScreen } from "@/components/VerificationQueueScreens";

// Queue 4, view "Vérifications des créateurs" (17b §3.7; 08 RG61 to RG66; jalons/l2e, commit 21).
export default function VerificationCreatorsQueuePage() {
  return (
    <Suspense>
      <VerificationCreatorsQueueScreen />
    </Suspense>
  );
}

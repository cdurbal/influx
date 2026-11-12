import { Suspense } from "react";
import { PortfolioQueueScreen } from "@/components/PortfolioQueueScreen";

// Queue 3, "Visuels de portfolio à modérer" (17b §2.7 line 3; 07 RG77 to RG85; jalons/l2g/modele.md §6; L2G-16).
export default function PortfolioQueuePage() {
  return (
    <Suspense>
      <PortfolioQueueScreen />
    </Suspense>
  );
}

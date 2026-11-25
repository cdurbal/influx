import { Suspense } from "react";
import { BrandReviewQueueScreen } from "@/components/BrandReviewQueueScreen";

// Queue 1, "Profils marque à valider" (17b §2.2; 06 RG63; jalons/l2c/file.md A10).
export default function BrandReviewQueuePage() {
  return (
    <Suspense>
      <BrandReviewQueueScreen />
    </Suspense>
  );
}

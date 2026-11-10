import { Suspense } from "react";
import { DisputeQueueScreen } from "@/components/DisputeQueueScreen";

// Queue 5, "Contestations de badge" (17b §2.7; 08 RG77; jalons/l2f, commit 19).
export default function DisputeQueuePage() {
  return (
    <Suspense>
      <DisputeQueueScreen />
    </Suspense>
  );
}

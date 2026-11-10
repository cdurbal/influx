import { Suspense } from "react";
import { IdentifierChangeQueueScreen } from "@/components/IdentifierChangeQueueScreen";

// Queue 6, "Identifiants modifiés à contrôler" (17b §2.7; 08 RG78; jalons/l2f, commit 19).
export default function IdentifierChangeQueuePage() {
  return (
    <Suspense>
      <IdentifierChangeQueueScreen />
    </Suspense>
  );
}

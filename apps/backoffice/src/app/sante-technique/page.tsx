import { Suspense } from "react";
import { HealthScreen } from "@/components/HealthScreen";
import { Shell } from "@/components/Shell";

// Technical health, admins only, workstation only (02 §20.5; 15 RG165; 21 §J9 commit 9).
export default function HealthPage() {
  return (
    <Suspense>
      <Shell current="health">
        <HealthScreen />
      </Shell>
    </Suspense>
  );
}

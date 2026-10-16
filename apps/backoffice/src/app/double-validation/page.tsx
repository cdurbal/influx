import { Suspense } from "react";
import { DualControlListScreen } from "@/components/DualControlScreens";
import { Shell } from "@/components/Shell";

// The actions awaiting a second validation, admin only (17b §2.7 queue 15; 03 PD1 to PD7).
export default function DualControlListPage() {
  return (
    <Suspense>
      <Shell current="dualControl">
        <DualControlListScreen />
      </Shell>
    </Suspense>
  );
}

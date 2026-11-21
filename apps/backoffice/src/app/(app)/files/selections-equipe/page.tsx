import { Suspense } from "react";
import { TeamSelectionQueueScreen } from "@/components/TeamSelectionQueueScreen";

// Queue 9, « Sélections par l'équipe INFLUX » (10 RG61, RG84; 15 RG26 to RG28, AL23; 17b §2.7, I13; L3G-13).
export default function TeamSelectionQueuePage() {
  return (
    <Suspense>
      <TeamSelectionQueueScreen />
    </Suspense>
  );
}

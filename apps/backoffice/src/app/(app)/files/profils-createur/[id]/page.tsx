import { Suspense } from "react";
import { CreatorReviewEntryScreen } from "@/components/CreatorReviewEntryScreen";

// One entry of queue 2, "Profils créateur à valider": the decision screen (17b §2.4 to §2.6; 07 RG5, RG10,
// RG96; jalons/l2g/modele.md §6; L2G-15). Opening the page opens the entry, which takes it in charge. The id
// is checked by apps/api; the client refuses to call with anything but a UUID. The screen is keyed by the
// entry, so that the chain of 17b §2.6 starts the next one from a clean state.
export default async function CreatorReviewEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <CreatorReviewEntryScreen key={id} id={id} />
    </Suspense>
  );
}

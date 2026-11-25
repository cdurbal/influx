import { Suspense } from "react";
import { TeamSelectionEntryScreen } from "@/components/TeamSelectionEntryScreen";

// One request of queue 9: the screen that takes it in charge and closes it (10 RG61; 15 C1 to C3; 17b I13; L3G-13).
// Opening the page opens the entry, which takes it in charge. The id is checked by apps/api; the client refuses to
// call with anything but a UUID. The screen is keyed by the entry, so that the chain of 17b §2.6 starts the next one
// from a clean state.
export default async function TeamSelectionEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <TeamSelectionEntryScreen key={id} id={id} />
    </Suspense>
  );
}

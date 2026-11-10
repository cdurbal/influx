import { Suspense } from "react";
import { DisputeEntryScreen } from "@/components/DisputeEntryScreen";

// One contest of queue 5: the decision screen (08 RG77, CA52, CA53; 15 RG27 C1 to C8). Opening the page
// opens the contest, which takes it in charge. The id is checked by apps/api; the client refuses to call
// with anything but a UUID. The screen is keyed by the contest, so that the chain of 17b §2.6 starts the
// next one from a clean state.
export default async function DisputeEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <DisputeEntryScreen key={id} id={id} />
    </Suspense>
  );
}

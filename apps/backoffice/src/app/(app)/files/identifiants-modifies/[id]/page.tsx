import { Suspense } from "react";
import { IdentifierChangeEntryScreen } from "@/components/IdentifierChangeEntryScreen";

// One entry of queue 6: the decision screen (08 RG78, CA54; 15 RG27 C1 to C8). Opening the page opens the
// entry, which takes it in charge. Keyed by the entry, as the other decision screens.
export default async function IdentifierChangeEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <IdentifierChangeEntryScreen key={id} id={id} />
    </Suspense>
  );
}

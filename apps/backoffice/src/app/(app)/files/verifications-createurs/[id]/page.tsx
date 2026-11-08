import { Suspense } from "react";
import { VerificationEntryScreen } from "@/components/VerificationEntryScreen";

// One request of queue 4, "Vérifications des créateurs": the decision screen (08 RG43 to RG59; 17b §3.7;
// jalons/l2e/modele.md §6; L2E-22). Opening the page opens the request, which takes it in charge. The id is
// checked by apps/api; the client refuses to call with anything but a UUID. The screen is keyed by the
// request, so that the chain of 17b §2.6 starts the next one from a clean state.
export default async function VerificationCreatorEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <VerificationEntryScreen key={id} id={id} view="creators" />
    </Suspense>
  );
}

import { Suspense } from "react";
import { BrandReviewEntryScreen } from "@/components/BrandReviewEntryScreen";

// One entry of queue 1, "Profils marque à valider": the decision screen (17b §2.4 to §2.6; 06 RG6;
// jalons/l2c/file.md A10). Opening the page opens the entry, which takes it in charge. The id is
// checked by apps/api; the client refuses to call with anything but a UUID. The screen is keyed by
// the entry, so that the chain of 17b §2.6 starts the next one from a clean state.
export default async function BrandReviewEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <BrandReviewEntryScreen key={id} id={id} />
    </Suspense>
  );
}

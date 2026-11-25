import { Suspense } from "react";
import { PortfolioReviewEntryScreen } from "@/components/PortfolioReviewEntryScreen";

// One entry of queue 3, "Visuels de portfolio à modérer": the decision screen of ONE visual (17b §2.4 to §2.6;
// 07 RG78, RG95, RG97; jalons/l2g/modele.md §6; L2G-16). Opening the page opens the entry, which takes it in
// charge. The id is checked by apps/api; the client refuses to call with anything but a UUID. The screen is
// keyed by the entry, so that the chain of 17b §2.6 starts the next one from a clean state.
export default async function PortfolioReviewEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <PortfolioReviewEntryScreen key={id} id={id} />
    </Suspense>
  );
}

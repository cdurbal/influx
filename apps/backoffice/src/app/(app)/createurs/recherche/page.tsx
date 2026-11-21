import { Suspense } from "react";
import { IdentifiedSearchScreen } from "@/components/IdentifiedSearchScreen";

// The identified creator search of the agents and the compatible creators of a campaign (10 §H, RG71, RG73;
// 17b §3.3; L3G-12). The server refuses a role that is not internal; the screen only draws.
export default function IdentifiedSearchPage() {
  return (
    <Suspense>
      <IdentifiedSearchScreen />
    </Suspense>
  );
}

import { Suspense } from "react";
import { SearchSettingsScreen } from "@/components/SearchSettingsScreen";

// The settings of the creator search, admin only, each change under a dual control (10 RG2; l3g/modele.md §7;
// 05 CA63; L3G-13).
export default function SearchSettingsPage() {
  return (
    <Suspense>
      <SearchSettingsScreen />
    </Suspense>
  );
}

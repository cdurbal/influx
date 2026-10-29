import { Suspense } from "react";
import { AccountsScreen } from "@/components/AccountsScreen";

// The registered members and their synchronisation (17b §3.11; 05 RG97 to RG103).
export default function AccountsPage() {
  return (
    <Suspense>
      <AccountsScreen />
    </Suspense>
  );
}

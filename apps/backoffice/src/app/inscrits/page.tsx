import { Suspense } from "react";
import { AccountsScreen } from "@/components/AccountsScreen";
import { Shell } from "@/components/Shell";

// The registered members and their synchronisation (17b §3.11; 05 RG97 to RG103).
export default function AccountsPage() {
  return (
    <Suspense>
      <Shell current="accounts">
        <AccountsScreen />
      </Shell>
    </Suspense>
  );
}

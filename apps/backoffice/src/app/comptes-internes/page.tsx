import { Suspense } from "react";
import { InternalAccountsScreen } from "@/components/InternalAccountsScreen";
import { Shell } from "@/components/Shell";

// Internal accounts and their invitations, admin only (17b §3.13.a, §3.13.b; 15 RG99).
export default function InternalAccountsPage() {
  return (
    <Suspense>
      <Shell current="internalAccounts">
        <InternalAccountsScreen />
      </Shell>
    </Suspense>
  );
}

import { Suspense } from "react";
import { ApolloSettingsScreen } from "@/components/ApolloSettingsScreen";

// The Apollo settings, admin only, each change under a dual control (05 RG81, CA63).
export default function ApolloSettingsPage() {
  return (
    <Suspense>
      <ApolloSettingsScreen />
    </Suspense>
  );
}

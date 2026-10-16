import { Suspense } from "react";
import { ApolloSettingsScreen } from "@/components/ApolloSettingsScreen";
import { Shell } from "@/components/Shell";

// The Apollo settings, admin only, each change under a dual control (05 RG81, CA63).
export default function ApolloSettingsPage() {
  return (
    <Suspense>
      <Shell current="apollo">
        <ApolloSettingsScreen />
      </Shell>
    </Suspense>
  );
}

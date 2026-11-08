import { Suspense } from "react";
import { RegistrySourcesScreen } from "@/components/RegistrySourcesScreen";

// The registry sources of the brand's registration (06 RG52, RG101; D79 (12); L2E-23): read by an agent,
// written by an administrator only. The role is the server's: the screen masks the buttons, the API refuses.
export default function RegistrySourcesPage() {
  return (
    <Suspense>
      <RegistrySourcesScreen />
    </Suspense>
  );
}

import { Suspense } from "react";
import { HomeScreen } from "@/components/HomeScreen";

// Home of the backoffice v0, behind the aal2 session (17b §3.11, §3.14.e; 05 RG104, RG105).
export default function HomePage() {
  return (
    <Suspense>
      <HomeScreen />
    </Suspense>
  );
}

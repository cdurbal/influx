import { Suspense } from "react";
import { BackofficeHome } from "@/components/BackofficeHome";

// Empty home of the backoffice at J3, behind the aal2 session (17b §3.14).
export default function HomePage() {
  return (
    <Suspense>
      <BackofficeHome />
    </Suspense>
  );
}

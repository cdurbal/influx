import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";

// Every screen behind the session, in one shell mounted once (docs/mvp/02 §21.5; 17b §1.7): the rail
// and the head band stay across navigations, the session and the banners are read at each path.
// The sign-in and the activation, in (auth), have no rail.
export default function AppLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}

import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Only the localized router is exposed: the mockup has no links (CA6).
export const { useRouter, usePathname } = createNavigation(routing);

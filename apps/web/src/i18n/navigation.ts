import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Localized navigation helpers. <Link> always keeps the locale prefix (00-cadrage.md §6).
export const { Link, useRouter, usePathname } = createNavigation(routing);

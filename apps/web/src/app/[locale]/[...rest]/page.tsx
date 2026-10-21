import { notFound } from "next/navigation";

// Any path under a locale that no page serves answers the localized 404 of ../not-found.tsx
// (18 T13; J9 commit 7): without this segment, Next.js would serve its own page.
export default function UnknownPage(): never {
  notFound();
}

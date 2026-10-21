// The 404 of the backoffice (18 T13; J9 commit 7): token classes only, under the root layout and
// its CSP, never Next.js's own page. Nothing of the request is shown.
import Link from "next/link";
import {
  BRAND_CLASSES,
  LEAD_CLASSES,
  SCREEN_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  TITLE_CLASSES,
} from "@/components/auth-classes";
import { messages } from "@/messages/fr";

export default function NotFound() {
  const t = messages.errorPages;
  return (
    <main id="main" className={SCREEN_CLASSES}>
      <p className={BRAND_CLASSES}>{messages.brand}</p>
      <h1 className={TITLE_CLASSES}>{t.notFoundTitle}</h1>
      <p className={LEAD_CLASSES}>{t.notFoundBody}</p>
      <Link href="/accueil" className={SECONDARY_BUTTON_CLASSES}>
        {t.home}
      </Link>
    </main>
  );
}

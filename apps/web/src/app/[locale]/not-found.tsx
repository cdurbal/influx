// The 404 of the localized pages (18 T13; J9 commit 7): token classes only, under the locale's
// layout and its CSP, never Next.js's own page (inline styles, light background). Nothing of the
// request is shown: neither the path nor a cause.
import { getTranslations } from "next-intl/server";
import {
  BRAND_CLASSES,
  LEAD_CLASSES,
  SCREEN_CLASSES,
  SECONDARY_BUTTON_CLASSES,
  TITLE_CLASSES,
} from "@/components/auth/auth-classes";
import { cn } from "@/components/ui/class-names";
import { Link } from "@/i18n/navigation";

export default async function LocaleNotFound() {
  const t = await getTranslations("errors");
  return (
    <main id="main" className={SCREEN_CLASSES}>
      <p className={BRAND_CLASSES}>{t("brand")}</p>
      <h1 className={TITLE_CLASSES}>{t("notFound.title")}</h1>
      <p className={LEAD_CLASSES}>{t("notFound.body")}</p>
      <Link href="/" className={cn(SECONDARY_BUTTON_CLASSES, "self-start")}>
        {t("notFound.home")}
      </Link>
    </main>
  );
}

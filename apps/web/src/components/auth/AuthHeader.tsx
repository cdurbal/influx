import { getLocale, getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { Link } from "@/i18n/navigation";

/**
 * Minimal header for the account creation and login pages (docs/landing-page/00-cadrage.md §6):
 * brand link back to the landing page and the FR/EN switcher, without the marketing nav or the
 * fictitious contact e-mail (out of reach here: only layout.tsx and page.tsx read CA15 content).
 */
export async function AuthHeader() {
  const t = await getTranslations("landing");
  const locale = await getLocale();

  return (
    <header className="sticky top-0 z-(--z-header) border-b-(length:--border-width-thin) border-border-subtle bg-surface-page">
      <div className="flex h-(--header-height) w-full items-center gap-3 bg-surface-page px-page-gutter">
        <Link
          href="/"
          className="rounded-md text-heading-3 font-extrabold tracking-display text-text-primary"
        >
          {t("common.brandName")}
        </Link>
        <div className="ml-auto">
          <LanguageSwitcher
            label={t("header.languageSwitcher.label")}
            currentLocale={locale}
            options={[
              {
                locale: "fr",
                shortLabel: t("header.languageSwitcher.fr"),
                name: t("header.languageSwitcher.frName"),
              },
              {
                locale: "en",
                shortLabel: t("header.languageSwitcher.en"),
                name: t("header.languageSwitcher.enName"),
              },
            ]}
          />
        </div>
      </div>
    </header>
  );
}

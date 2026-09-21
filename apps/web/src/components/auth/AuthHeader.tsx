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
  const isEn = locale === "en";

  return (
    <header className="sticky top-0 z-(--z-header) border-b-(length:--border-width-thin) border-border-subtle bg-surface-page">
      <div className="flex h-(--header-height) w-full items-center gap-4 bg-surface-page px-page-gutter">
        <Link
          href="/"
          className="rounded-md text-heading-3 font-extrabold tracking-display text-text-primary hover:opacity-90 transition-opacity"
        >
          {t("common.brandName")}
        </Link>

        {/* Navigation Membre */}
        <nav
          aria-label="Espace membre"
          className="flex items-center gap-2 ml-2"
        >
          <Link
            href="/space"
            className="flex items-center gap-1.5 rounded-lg border border-border-default bg-surface-raised px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-hover transition-colors shadow-xs"
          >
            <span aria-hidden="true">🏠</span>
            <span>{isEn ? "Member Space (Hub)" : "Mon Espace (Hub)"}</span>
          </Link>
          <Link
            href="/creator/campaigns"
            className="hidden sm:flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <span>{isEn ? "Opportunities" : "Opportunités"}</span>
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
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

import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { MailIcon } from "@/components/ui/icons";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import {
  SiteHeaderMobileMenu,
  type HeaderNavItem,
} from "./SiteHeaderMobileMenu";

type SiteHeaderProps = {
  contactEmail: string;
};

const NAV_IDS = ["method", "creators", "useCases", "pricing", "faq"] as const;

/** Sticky header (02 §3.2): brand, menu, contact email, FR/EN switcher and the two doors. */
export async function SiteHeader({ contactEmail }: SiteHeaderProps) {
  const t = await getTranslations("landing");
  const locale = await getLocale();
  const navItems: HeaderNavItem[] = NAV_IDS.map((id) => ({
    id,
    label: t(`header.nav.${id}`),
  }));

  return (
    <header className="sticky top-0 z-(--z-header) border-b-(length:--border-width-thin) border-border-subtle bg-surface-page">
      <div className="relative flex h-(--header-height) w-full items-center gap-3 bg-surface-page px-page-gutter">
        <p className="text-heading-3 font-extrabold tracking-display text-text-primary">
          {t("common.brandName")}
        </p>

        <nav aria-label={t("header.navLabel")} className="ml-4 hidden lg:block">
          <ul className="flex items-center gap-1">
            {navItems.map((item) => (
              <li key={item.id}>
                <Button variant="text">{item.label}</Button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <p className="hidden items-center gap-2 text-sm text-text-secondary 2xl:flex">
            <MailIcon
              aria-hidden="true"
              className="size-(--size-icon-md) shrink-0"
            />
            <span className="sr-only">{t("header.contactLabel")}</span>
            <span>{contactEmail}</span>
          </p>
          <LanguageSwitcher
            groupLabel={t("header.languageSwitcher.label")}
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
          <div className="hidden lg:block">
            <Button variant="primary" size="md">
              {t("common.cta.advertiser")}
            </Button>
          </div>
          <div className="hidden xl:block">
            <Button variant="secondary" size="md">
              {t("common.cta.creator")}
            </Button>
          </div>
          <SiteHeaderMobileMenu
            menuButtonLabel={t("header.menuButton")}
            navLabel={t("header.navLabel")}
            navItems={navItems}
            advertiserCta={t("common.cta.advertiser")}
            creatorCta={t("common.cta.creator")}
            contactLabel={t("header.contactLabel")}
            email={contactEmail}
          />
        </div>
      </div>
    </header>
  );
}

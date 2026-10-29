import { getLocale, getTranslations } from "next-intl/server";
import { BUTTON_BASE_CLASSES, VARIANT_CLASSES } from "@/components/ui/Button";
import { cn } from "@/components/ui/class-names";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { LinkButton } from "@/components/ui/LinkButton";
import { memberPageHref } from "@/lib/member-paths";
import {
  SiteHeaderMobileMenu,
  type HeaderNavItem,
} from "./SiteHeaderMobileMenu";
import { LANDING_NAV_IDS, LANDING_SECTION_ANCHORS } from "./landing-sections";

/**
 * Sticky header (Malt-style order, 2026-09-17): brand, menu, signup, login and a language menu
 * (globe + 2-letter code, scales past FR/EN). No contact e-mail: moved out of the header.
 */
export async function SiteHeader() {
  const t = await getTranslations("landing");
  const locale = await getLocale();
  const navItems: HeaderNavItem[] = LANDING_NAV_IDS.map((id) => ({
    id,
    anchor: LANDING_SECTION_ANCHORS[id],
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
                <a
                  href={`#${item.anchor}`}
                  className={cn(BUTTON_BASE_CLASSES, VARIANT_CLASSES.text)}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden lg:block">
            <LinkButton
              href={memberPageHref("signupDoors", locale)}
              variant="primary"
              size="md"
            >
              {t("common.cta.signup")}
            </LinkButton>
          </div>
          <div className="hidden lg:block">
            <LinkButton
              href={memberPageHref("signIn", locale)}
              variant="text"
              size="md"
            >
              {t("common.cta.login")}
            </LinkButton>
          </div>
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
          <SiteHeaderMobileMenu
            menuButtonLabel={t("header.menuButton")}
            navLabel={t("header.navLabel")}
            navItems={navItems}
            loginCta={t("common.cta.login")}
            loginHref={memberPageHref("signIn", locale)}
            signupCta={t("common.cta.signup")}
            signupHref={memberPageHref("signupDoors", locale)}
          />
        </div>
      </div>
    </header>
  );
}

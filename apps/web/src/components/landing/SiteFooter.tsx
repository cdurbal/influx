import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { FileCheckIcon, LockIcon, MailIcon } from "@/components/ui/icons";

type SiteFooterProps = {
  contactEmail: string;
};

const NAV_IDS = ["method", "creators", "useCases", "pricing", "faq"] as const;
const LEGAL_IDS = [
  "terms",
  "salesTerms",
  "privacy",
  "legalNotice",
  "cookies",
] as const;

/**
 * Footer (02 §3.19): brand, navigation, legal documents of Lot 1 and contact, as inactive
 * buttons or text. No company name, legal form, address or registration number (CA12, D25).
 */
export async function SiteFooter({ contactEmail }: SiteFooterProps) {
  const t = await getTranslations("landing");

  return (
    <footer className="bg-surface-muted text-text-primary">
      <div className="mx-auto flex max-w-(--container-max) flex-col gap-8 px-page-gutter py-section-block">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-12 lg:gap-grid-gap">
          <div className="flex flex-col gap-3 lg:col-span-4">
            <p className="text-heading-3 font-extrabold tracking-display">
              {t("common.brandName")}
            </p>
            <p className="max-w-(--measure-text) text-md text-text-secondary">
              {t("footer.tagline")}
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:col-span-2">
            <h2 className="text-md font-semibold">{t("footer.navTitle")}</h2>
            <nav aria-label={t("footer.navLabel")}>
              <ul className="-ml-3 flex flex-col">
                {NAV_IDS.map((id) => (
                  <li key={id}>
                    <Button variant="text" className="justify-start text-left">
                      {t(`header.nav.${id}`)}
                    </Button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="flex flex-col gap-3 lg:col-span-3">
            <h2 className="text-md font-semibold">{t("footer.legalTitle")}</h2>
            <ul className="-ml-3 flex flex-col">
              {LEGAL_IDS.map((id) => (
                <li key={id}>
                  <Button variant="text" className="justify-start text-left">
                    {t(`footer.legal.${id}`)}
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3 lg:col-span-3">
            <h2 className="text-md font-semibold">
              {t("footer.contactTitle")}
            </h2>
            <p className="flex items-center gap-2 text-md text-text-secondary">
              <MailIcon
                aria-hidden="true"
                className="size-(--size-icon-md) shrink-0"
              />
              <span className="break-all">{contactEmail}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t-(length:--border-width-thin) border-border-default pt-6 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-xs text-text-secondary">{t("footer.copyright")}</p>
          <ul className="flex flex-col gap-2 text-sm text-text-secondary sm:flex-row sm:flex-wrap sm:gap-x-6">
            <li className="flex items-center gap-2">
              <FileCheckIcon
                aria-hidden="true"
                className="size-(--size-icon-sm) shrink-0"
              />
              {t("footer.trust.validated")}
            </li>
            <li className="flex items-center gap-2">
              <LockIcon
                aria-hidden="true"
                className="size-(--size-icon-sm) shrink-0"
              />
              {t("footer.trust.privacy")}
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

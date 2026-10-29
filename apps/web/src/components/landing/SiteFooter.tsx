import type { PublicDocument } from "@influx/contracts/terms";
import { getLocale, getTranslations } from "next-intl/server";
import { BUTTON_BASE_CLASSES, VARIANT_CLASSES } from "@/components/ui/Button";
import { cn } from "@/components/ui/class-names";
import { FileCheckIcon, LockIcon } from "@/components/ui/icons";
import { LinkButton } from "@/components/ui/LinkButton";
import { legalDocumentHref } from "@/lib/legal-documents";
import { LANDING_NAV_IDS, LANDING_SECTION_ANCHORS } from "./landing-sections";

// The public documents served by apps/api (21 EC-62). The legal notice and the sales terms wait
// for the company's identity (D25): no entry until they exist.
const LEGAL_LINKS: readonly {
  id: "terms" | "privacy" | "cookies";
  document: PublicDocument;
}[] = [
  { id: "terms", document: "terms_of_service" },
  { id: "privacy", document: "privacy_policy" },
  { id: "cookies", document: "cookie_policy" },
];

/**
 * Footer (02 §3.19): brand, navigation and the legal documents, linked to their localized pages
 * (J9 commit 5). No company name, legal form, address or registration number (CA12, D25).
 */
export async function SiteFooter() {
  const t = await getTranslations("landing");
  const locale = await getLocale();

  return (
    <footer className="bg-surface-muted text-text-primary">
      <div className="mx-auto flex max-w-(--container-max) flex-col gap-8 px-page-gutter py-section-block">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-12 lg:gap-grid-gap">
          <div className="flex flex-col gap-3 lg:col-span-5">
            <p className="text-heading-3 font-extrabold tracking-display">
              {t("common.brandName")}
            </p>
            <p className="max-w-(--measure-text) text-md text-text-secondary">
              {t("footer.tagline")}
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:col-span-3">
            <h2 className="text-md font-semibold">{t("footer.navTitle")}</h2>
            <nav aria-label={t("footer.navLabel")}>
              <ul className="-ml-3 flex flex-col">
                {LANDING_NAV_IDS.map((id) => (
                  <li key={id}>
                    <a
                      href={`#${LANDING_SECTION_ANCHORS[id]}`}
                      className={cn(
                        BUTTON_BASE_CLASSES,
                        VARIANT_CLASSES.text,
                        "justify-start text-left",
                      )}
                    >
                      {t(`header.nav.${id}`)}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="flex flex-col gap-3 lg:col-span-4">
            <h2 className="text-md font-semibold">{t("footer.legalTitle")}</h2>
            <ul className="-ml-3 flex flex-col">
              {LEGAL_LINKS.map(({ id, document }) => (
                <li key={id}>
                  <LinkButton
                    href={legalDocumentHref(document, locale)}
                    variant="text"
                    className="justify-start text-left"
                  >
                    {t(`footer.legal.${id}`)}
                  </LinkButton>
                </li>
              ))}
            </ul>
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

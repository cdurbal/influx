import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CookieBanner } from "@/components/landing/CookieBanner";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Only the declared locales exist; any other segment is a 404.
export const dynamicParams = false;

// Every page is rendered per request: its scripts carry the nonce of that request's CSP, which
// a page rendered at build time could not know (03 §6.5, 18 T10).
export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    return {};
  }
  const t = await getTranslations({ locale, namespace: "landing.meta" });

  return {
    title: t("title"),
    description: t("description"),
    // No robots tag: indexing is a matter of environment, `X-Robots-Tag` outside production
    // (securityHeadersFor in next.config.ts, 18 §5 G6 b).
  };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const t = await getTranslations("landing.cookieBanner");

  return (
    <html lang={locale}>
      <body className="bg-surface-page font-base text-md text-text-primary">
        {/* Early in the DOM, before the header (11 §4.2): a keyboard user settles it on first Tab. */}
        <CookieBanner
          regionLabel={t("regionLabel")}
          title={t("title")}
          body={t("body")}
          acceptLabel={t("accept")}
          rejectLabel={t("reject")}
          privacyLinkLabel={t("privacyLink")}
        />
        {/* Client components receive their labels through props: no message is sent to the browser. */}
        <NextIntlClientProvider messages={null}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

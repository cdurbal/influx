import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/legal/LegalPage";

// Cookie policy, same path in both languages.
// Readable without an account (docs/mvp/21 EC-62; 05 RG27).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/cookies">): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata(locale, "cookie_policy");
}

export default async function CookiePolicyPage({
  params,
}: PageProps<"/[locale]/cookies">) {
  const { locale } = await params;
  return <LegalPage locale={locale} document="cookie_policy" slug="cookies" />;
}

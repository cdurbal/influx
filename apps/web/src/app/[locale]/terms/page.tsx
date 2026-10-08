import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/legal/LegalPage";

// Terms of service, English path; /fr/terms is sent to /fr/cgu.
// Readable without an account (docs/mvp/21 EC-62; 05 RG27).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/terms">): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata(locale, "terms_of_service");
}

export default async function TermsOfServiceEnPage({
  params,
}: PageProps<"/[locale]/terms">) {
  const { locale } = await params;
  return <LegalPage locale={locale} document="terms_of_service" slug="terms" />;
}

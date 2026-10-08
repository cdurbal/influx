import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/legal/LegalPage";

// Terms of service, French path; /en/cgu is sent to /en/terms.
// Readable without an account (docs/mvp/21 EC-62; 05 RG27).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/cgu">): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata(locale, "terms_of_service");
}

export default async function TermsOfServiceFrPage({
  params,
}: PageProps<"/[locale]/cgu">) {
  const { locale } = await params;
  return <LegalPage locale={locale} document="terms_of_service" slug="cgu" />;
}

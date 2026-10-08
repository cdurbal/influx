import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/legal/LegalPage";

// Privacy policy, English path; /fr/privacy is sent to /fr/confidentialite.
// Readable without an account (docs/mvp/21 EC-62; 05 RG27).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata(locale, "privacy_policy");
}

export default async function PrivacyPolicyEnPage({
  params,
}: PageProps<"/[locale]/privacy">) {
  const { locale } = await params;
  return <LegalPage locale={locale} document="privacy_policy" slug="privacy" />;
}

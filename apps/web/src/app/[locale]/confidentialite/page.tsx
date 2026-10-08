import type { Metadata } from "next";
import { LegalPage, legalMetadata } from "@/components/legal/LegalPage";

// Privacy policy, French path; /en/confidentialite is sent to /en/privacy.
// Readable without an account (docs/mvp/21 EC-62; 05 RG27).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/confidentialite">): Promise<Metadata> {
  const { locale } = await params;
  return legalMetadata(locale, "privacy_policy");
}

export default async function PrivacyPolicyFrPage({
  params,
}: PageProps<"/[locale]/confidentialite">) {
  const { locale } = await params;
  return (
    <LegalPage
      locale={locale}
      document="privacy_policy"
      slug="confidentialite"
    />
  );
}

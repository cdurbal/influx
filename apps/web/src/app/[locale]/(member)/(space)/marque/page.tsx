import type { Metadata } from "next";
import {
  AuthMessages,
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { MemberHome } from "@/components/auth/MemberHome";

// Home of the brand space, French path, behind the session (GET /v1/me; 05 RG71; 17 §2.6).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/marque">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "advertiserHome");
}

export default async function BrandHomePage({
  params,
}: PageProps<"/[locale]/marque">) {
  const { locale } = await params;
  const pageLocale = memberPageLocale(locale, "advertiserHome", "marque");
  return (
    <AuthMessages locale={pageLocale} withAccount>
      <MemberHome space="advertiser" />
    </AuthMessages>
  );
}

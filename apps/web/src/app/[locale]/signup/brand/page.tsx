import type { Metadata } from "next";
import {
  AuthMessages,
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AuthFlow } from "@/components/auth/AuthFlow";

// Brand door, English path; /fr/signup/brand is sent to /fr/inscription/marque (05 RG1; 21 EC-15).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/signup/brand">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "signupAdvertiser");
}

export default async function AdvertiserSignupPage({
  params,
}: PageProps<"/[locale]/signup/brand">) {
  const { locale } = await params;
  const pageLocale = memberPageLocale(
    locale,
    "signupAdvertiser",
    "signup/brand",
  );
  return (
    <AuthMessages locale={pageLocale}>
      <AuthFlow entry="signup" initialDoor="advertiser" />
    </AuthMessages>
  );
}

import type { Metadata } from "next";
import {
  AuthMessages,
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AuthFlow } from "@/components/auth/AuthFlow";

// Brand door, French path; /en/inscription/marque is sent to /en/signup/brand (05 RG1; 21 EC-15).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/inscription/marque">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "signupAdvertiser");
}

export default async function AdvertiserSignupPage({
  params,
}: PageProps<"/[locale]/inscription/marque">) {
  const { locale } = await params;
  const pageLocale = memberPageLocale(
    locale,
    "signupAdvertiser",
    "inscription/marque",
  );
  return (
    <AuthMessages locale={pageLocale}>
      <AuthFlow entry="signup" initialDoor="advertiser" />
    </AuthMessages>
  );
}

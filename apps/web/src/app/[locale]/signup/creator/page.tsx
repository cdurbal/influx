import type { Metadata } from "next";
import {
  AuthMessages,
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AuthFlow } from "@/components/auth/AuthFlow";

// Creator door, English path; /fr/signup/creator is sent to /fr/inscription/createur (05 RG1; 21 EC-15).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/signup/creator">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "signupCreator");
}

export default async function CreatorSignupPage({
  params,
}: PageProps<"/[locale]/signup/creator">) {
  const { locale } = await params;
  const pageLocale = memberPageLocale(
    locale,
    "signupCreator",
    "signup/creator",
  );
  return (
    <AuthMessages locale={pageLocale}>
      <AuthFlow entry="signup" initialDoor="creator" />
    </AuthMessages>
  );
}

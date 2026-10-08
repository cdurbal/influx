import type { Metadata } from "next";
import {
  AuthMessages,
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AuthFlow } from "@/components/auth/AuthFlow";

// Creator door, French path; /en/inscription/createur is sent to /en/signup/creator (05 RG1; 21 EC-15).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/inscription/createur">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "signupCreator");
}

export default async function CreatorSignupPage({
  params,
}: PageProps<"/[locale]/inscription/createur">) {
  const { locale } = await params;
  const pageLocale = memberPageLocale(
    locale,
    "signupCreator",
    "inscription/createur",
  );
  return (
    <AuthMessages locale={pageLocale}>
      <AuthFlow entry="signup" initialDoor="creator" />
    </AuthMessages>
  );
}

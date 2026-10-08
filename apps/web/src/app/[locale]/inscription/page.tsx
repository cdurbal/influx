import type { Metadata } from "next";
import {
  AuthMessages,
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AuthFlow } from "@/components/auth/AuthFlow";

// Choice of door, French path; /en/inscription is sent to /en/signup (05 RG3; 21 EC-15).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/inscription">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "signupDoors");
}

export default async function SignupDoorsPage({
  params,
}: PageProps<"/[locale]/inscription">) {
  const { locale } = await params;
  const pageLocale = memberPageLocale(locale, "signupDoors", "inscription");
  return (
    <AuthMessages locale={pageLocale}>
      <AuthFlow entry="signup" initialDoor={null} />
    </AuthMessages>
  );
}

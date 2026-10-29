import type { Metadata } from "next";
import {
  AuthMessages,
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AuthFlow } from "@/components/auth/AuthFlow";

// Sign-in, English path; /fr/sign-in is sent to /fr/connexion (docs/mvp/17 §2.6, §3).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-in">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "signIn");
}

export default async function SignInPage({
  params,
}: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  const pageLocale = memberPageLocale(locale, "signIn", "sign-in");
  return (
    <AuthMessages locale={pageLocale}>
      <AuthFlow entry="signIn" initialDoor={null} />
    </AuthMessages>
  );
}

import type { Metadata } from "next";
import {
  AuthMessages,
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AuthFlow } from "@/components/auth/AuthFlow";

// Sign-in, French path; /en/connexion is sent to /en/sign-in (docs/mvp/17 §2.6, §3).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/connexion">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "signIn");
}

export default async function SignInPage({
  params,
}: PageProps<"/[locale]/connexion">) {
  const { locale } = await params;
  const pageLocale = memberPageLocale(locale, "signIn", "connexion");
  return (
    <AuthMessages locale={pageLocale}>
      <AuthFlow entry="signIn" initialDoor={null} />
    </AuthMessages>
  );
}

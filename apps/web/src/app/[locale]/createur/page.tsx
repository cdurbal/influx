import type { Metadata } from "next";
import {
  AuthMessages,
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { MemberHome } from "@/components/auth/MemberHome";

// Home of the creator space, French path, behind the session (GET /v1/me; 05 RG71; 17 §2.6).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/createur">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "creatorHome");
}

export default async function CreatorHomePage({
  params,
}: PageProps<"/[locale]/createur">) {
  const { locale } = await params;
  const pageLocale = memberPageLocale(locale, "creatorHome", "createur");
  return (
    <AuthMessages locale={pageLocale}>
      <MemberHome space="creator" />
    </AuthMessages>
  );
}

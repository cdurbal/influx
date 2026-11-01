import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { MemberHome } from "@/components/auth/MemberHome";

// Home of the brand space, English path, behind the session (GET /v1/me; 05 RG71; 17 §2.6).
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/brand">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "advertiserHome");
}

export default async function BrandHomePage({
  params,
}: PageProps<"/[locale]/brand">) {
  const { locale } = await params;
  memberPageLocale(locale, "advertiserHome", "brand");
  return <MemberHome space="advertiser" />;
}

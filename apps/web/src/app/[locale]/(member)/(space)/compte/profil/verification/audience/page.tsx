import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { AudienceScreen } from "@/components/verification/AudienceScreen";
import { ownershipNetworkOf } from "@/components/verification/ownership-page";

// "Faire vérifier mon audience" (17 §5.3, C3; 08 §D): the deposit of the evidence of the audience of one
// network line of a creator, French path, behind the session; the network is the query's. Any other
// role finds no such page.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/compte/profil/verification/audience">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountVerificationAudience");
}

export default async function AudiencePage({
  params,
  searchParams,
}: PageProps<"/[locale]/compte/profil/verification/audience">) {
  const { locale } = await params;
  memberPageLocale(
    locale,
    "accountVerificationAudience",
    "compte/profil/verification/audience",
  );
  return (
    <AudienceScreen networkCode={ownershipNetworkOf(await searchParams)} />
  );
}

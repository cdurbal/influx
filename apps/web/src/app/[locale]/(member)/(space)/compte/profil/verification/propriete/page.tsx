import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { ownershipNetworkOf } from "@/components/verification/ownership-page";
import { OwnershipScreen } from "@/components/verification/OwnershipScreen";

// "Faire vérifier mon compte" (17 §5.3, C3; 08 §C): the three screens of the proof of ownership of one
// network line of a creator, French path, behind the session; the network is the query's. Any other
// role finds no such page.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/compte/profil/verification/propriete">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountVerificationOwnership");
}

export default async function OwnershipPage({
  params,
  searchParams,
}: PageProps<"/[locale]/compte/profil/verification/propriete">) {
  const { locale } = await params;
  memberPageLocale(
    locale,
    "accountVerificationOwnership",
    "compte/profil/verification/propriete",
  );
  return (
    <OwnershipScreen networkCode={ownershipNetworkOf(await searchParams)} />
  );
}

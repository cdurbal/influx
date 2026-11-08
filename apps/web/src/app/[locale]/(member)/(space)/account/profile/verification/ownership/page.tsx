import type { Metadata } from "next";
import {
  memberPageLocale,
  memberPageMetadata,
} from "@/components/auth/AuthPage";
import { ownershipNetworkOf } from "@/components/verification/ownership-page";
import { OwnershipScreen } from "@/components/verification/OwnershipScreen";

// "Verify my account" (17 §5.3, C3; 08 §C): the three screens of the proof of ownership of one network
// line of a creator, English path, behind the session; the network is the query's. Any other role
// finds no such page.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/account/profile/verification/ownership">): Promise<Metadata> {
  const { locale } = await params;
  return memberPageMetadata(locale, "accountVerificationOwnership");
}

export default async function OwnershipPage({
  params,
  searchParams,
}: PageProps<"/[locale]/account/profile/verification/ownership">) {
  const { locale } = await params;
  memberPageLocale(
    locale,
    "accountVerificationOwnership",
    "account/profile/verification/ownership",
  );
  return (
    <OwnershipScreen networkCode={ownershipNetworkOf(await searchParams)} />
  );
}

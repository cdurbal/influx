"use client";

// The profile page of "mon compte" (17 §2.6): one address for both roles, the screen follows the
// real role (never the address): "Mon profil de marque" for a brand (M2), "Mon profil" for a creator
// (C2, L2D). A creator used to find a page that does not exist here (18 T14.3); the API still answers
// that way for the route of the other role.
import { BrandProfileScreen } from "@/components/brand-profile/BrandProfileScreen";
import { CreatorProfileScreen } from "@/components/creator-profile/CreatorProfileScreen";
import { useMember } from "@/components/member/member-context";

export function AccountProfileScreen() {
  const { me } = useMember();
  return me.role === "creator" ? (
    <CreatorProfileScreen />
  ) : (
    <BrandProfileScreen />
  );
}

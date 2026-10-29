import { Suspense } from "react";
import { MemberInvitationsScreen } from "@/components/MemberInvitationsScreen";

// Member invitations, agent and admin (05 RG116 to RG119; 21 EC-J8-3).
export default function MemberInvitationsPage() {
  return (
    <Suspense>
      <MemberInvitationsScreen />
    </Suspense>
  );
}

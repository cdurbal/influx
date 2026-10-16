import { Suspense } from "react";
import { MemberInvitationsScreen } from "@/components/MemberInvitationsScreen";
import { Shell } from "@/components/Shell";

// Member invitations, agent and admin (05 RG116 to RG119; 21 EC-J8-3).
export default function MemberInvitationsPage() {
  return (
    <Suspense>
      <Shell current="memberInvitations">
        <MemberInvitationsScreen />
      </Shell>
    </Suspense>
  );
}

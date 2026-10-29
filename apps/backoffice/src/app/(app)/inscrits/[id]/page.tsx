import { Suspense } from "react";
import { AccountScreen } from "@/components/AccountScreen";

// The record of a member account (17b §3.11, §3.12; 15 RG40 to RG44). The id is checked by
// apps/api; the client refuses to call with anything but a UUID.
export default async function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <AccountScreen id={id} />
    </Suspense>
  );
}

import { Suspense } from "react";
import { DualControlScreen } from "@/components/DualControlScreens";

// The distinct confirmation screen of one dual control (03 PD2; 17b §3.13.c).
export default async function DualControlPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <DualControlScreen id={id} />
    </Suspense>
  );
}

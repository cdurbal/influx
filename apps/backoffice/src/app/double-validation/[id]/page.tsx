import { Suspense } from "react";
import { DualControlScreen } from "@/components/DualControlScreens";
import { Shell } from "@/components/Shell";

// The distinct confirmation screen of one dual control (03 PD2; 17b §3.13.c).
export default async function DualControlPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense>
      <Shell current="dualControl">
        <DualControlScreen id={id} />
      </Shell>
    </Suspense>
  );
}

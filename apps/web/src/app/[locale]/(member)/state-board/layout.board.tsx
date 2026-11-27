import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AnnouncerProvider } from "@/components/member/ui/Announcer";

// The frame of every page of the component state board (RUA-05; jalons/rub/modele-archi.md §4): the index and one
// page per family (RUB-fix-10a), each served and checked on its own so that a case opens its family alone. Like the
// pages, Next.js serves it only when the `board.tsx` page extension is on (src/config/state-board.ts): a deployed
// build holds none of it. It carries the mark the build test looks for and the region of the announcer.

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function StateBoardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main
      data-state-board=""
      className="mx-auto flex w-full max-w-(--container-narrow) flex-col gap-8 px-page-gutter py-section-header"
    >
      <AnnouncerProvider>{children}</AnnouncerProvider>
    </main>
  );
}

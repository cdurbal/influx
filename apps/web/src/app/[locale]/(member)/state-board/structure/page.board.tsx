import type { Metadata } from "next";
import { BoardHeader, boardTitle } from "../board-section.board";
import { StructureBoard } from "../structure.board";
import { AnnouncerBoard } from "../announcer.board";

// The family `structure` of the component state board (RUB-fix-10a; jalons/rub/modele-archi.md §4): its page alone,
// served like the index only when the `board.tsx` page extension is on (src/config/state-board.ts).

const INTRO =
  "Ligne 01 de RUB : le cadre, l'en-tête et la section (C01 à C03), puis l'annonceur (C29).";

export const metadata: Metadata = { title: boardTitle("structure") };

export default function StructureBoardPage() {
  return (
    <>
      <BoardHeader title={boardTitle("structure")} intro={INTRO} />
      <StructureBoard />
      <AnnouncerBoard />
    </>
  );
}

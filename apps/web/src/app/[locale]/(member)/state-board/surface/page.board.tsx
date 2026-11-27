import type { Metadata } from "next";
import { BoardHeader, boardTitle } from "../board-section.board";
import { ButtonBoard } from "../button.board";
import { SurfaceBoard } from "../surface.board";

// The family `surface` of the component state board (RUB-fix-10a; jalons/rub/modele-archi.md §4): its page alone,
// served like the index only when the `board.tsx` page extension is on (src/config/state-board.ts).

const INTRO =
  "Ligne 02 de RUB : les boutons et les liens d'action (C10, C11), puis les surfaces (C04, C05, C12).";

export const metadata: Metadata = { title: boardTitle("surface") };

export default function SurfaceBoardPage() {
  return (
    <>
      <BoardHeader title={boardTitle("surface")} intro={INTRO} />
      <ButtonBoard />
      <SurfaceBoard />
    </>
  );
}

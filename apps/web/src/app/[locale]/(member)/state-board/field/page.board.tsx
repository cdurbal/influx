import type { Metadata } from "next";
import { BoardHeader, boardTitle } from "../board-section.board";
import { FieldBoard } from "../field.board";

// The family `field` of the component state board (RUB-fix-10a; jalons/rub/modele-archi.md §4): its page alone,
// served like the index only when the `board.tsx` page extension is on (src/config/state-board.ts).

const INTRO =
  "Ligne 05 de RUB : le champ, son message, le résumé des erreurs et le groupe de choix (C18 à C21).";

export const metadata: Metadata = { title: boardTitle("field") };

export default function FieldBoardPage() {
  return (
    <>
      <BoardHeader title={boardTitle("field")} intro={INTRO} />
      <FieldBoard />
    </>
  );
}

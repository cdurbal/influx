import type { Metadata } from "next";
import { BoardHeader, boardTitle } from "../board-section.board";
import { ListBoard } from "../list.board";

// The family `list` of the component state board (RUB-fix-10a; archives/jalons/rub/modele-archi.md §4): its page alone,
// served like the index only when the `board.tsx` page extension is on (src/config/state-board.ts).

const INTRO =
  "Ligne 04 de RUB : la liste de lignes, la liste de propriétés, l'état vide et le squelette (C06 à C09).";

export const metadata: Metadata = { title: boardTitle("list") };

export default function ListBoardPage() {
  return (
    <>
      <BoardHeader title={boardTitle("list")} intro={INTRO} />
      <ListBoard />
    </>
  );
}

import type { Metadata } from "next";
import { BoardHeader, boardTitle } from "../board-section.board";
import { DialogBoard } from "../dialog.board";

// The family `dialog` of the component state board (RUB-fix-10a; archives/jalons/rub/modele-archi.md §4): its page alone,
// served like the index only when the `board.tsx` page extension is on (src/config/state-board.ts).

const INTRO =
  "Ligne 07 de RUB : le dialogue, celui des filtres, la barre de filtres et la pagination (C27, C28, C30, C32).";

export const metadata: Metadata = { title: boardTitle("dialog") };

export default function DialogBoardPage() {
  return (
    <>
      <BoardHeader title={boardTitle("dialog")} intro={INTRO} />
      <DialogBoard />
    </>
  );
}

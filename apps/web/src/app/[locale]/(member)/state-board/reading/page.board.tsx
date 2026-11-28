import type { Metadata } from "next";
import { BoardHeader, boardTitle } from "../board-section.board";
import { ReadingBoard } from "../reading.board";

// The family `reading` of the component state board (RUB-fix-10a; archives/jalons/rub/modele-archi.md §4): its page alone,
// served like the index only when the `board.tsx` page extension is on (src/config/state-board.ts).

const INTRO =
  "Ligne 09b de RUB : la galerie et les composants d'une page de lecture (C34 à C37, C39, C40, C66, C68).";

export const metadata: Metadata = { title: boardTitle("reading") };

export default function ReadingBoardPage() {
  return (
    <>
      <BoardHeader title={boardTitle("reading")} intro={INTRO} />
      <ReadingBoard />
    </>
  );
}

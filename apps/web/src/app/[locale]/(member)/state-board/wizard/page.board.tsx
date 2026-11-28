import type { Metadata } from "next";
import { BoardHeader, boardTitle } from "../board-section.board";
import { WizardBoard } from "../wizard.board";

// The family `wizard` of the component state board (RUB-fix-10a; archives/jalons/rub/modele-archi.md §4): its page alone,
// served like the index only when the `board.tsx` page extension is on (src/config/state-board.ts).

const INTRO =
  "Ligne 08 de RUB : l'assistant, le récapitulatif, le code et les étapes numérotées (C41, C42, C49, C51).";

export const metadata: Metadata = { title: boardTitle("wizard") };

export default function WizardBoardPage() {
  return (
    <>
      <BoardHeader title={boardTitle("wizard")} intro={INTRO} />
      <WizardBoard />
    </>
  );
}

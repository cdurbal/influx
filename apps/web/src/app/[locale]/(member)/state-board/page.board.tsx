import type { Metadata } from "next";
import { AnnouncerProvider } from "@/components/member/ui/Announcer";
import { PAGE_TITLE_CLASSES } from "@/components/member/ui/page-header-classes";
import { AnnouncerBoard } from "./announcer.board";
import { BadgeBoard } from "./badge.board";
import { ButtonBoard } from "./button.board";
import { CardBoard } from "./card.board";
import { ChoiceBoard } from "./choice.board";
import { DialogBoard } from "./dialog.board";
import { FieldBoard } from "./field.board";
import { ListBoard } from "./list.board";
import { NoticeBoard } from "./notice.board";
import { ReadingBoard } from "./reading.board";
import { StructureBoard } from "./structure.board";
import { SurfaceBoard } from "./surface.board";
import { WizardBoard } from "./wizard.board";

// The component state board (RUA-05; docs/mvp/jalons/rua/modele-archi.md §6). Not a page of the
// product: Next.js serves this file only when the `board.tsx` page extension is on
// (src/config/state-board.ts: INFLUX_ENV "development" and INFLUX_STATE_BOARD "on"), so a
// deployed build holds neither the route nor a byte of it. It stands inside the KEO container of
// the member group and outside its space: no shell, no session, no call to the API, no account
// data, no secret. French only, written here and not in `locales`: it is a workshop tool. One
// section per component, one cell per state, with stable `data-board-*` hooks for the screenshots
// of RUB and after.

const TEXTS = {
  title: "Planche des états des composants",
  intro:
    "Outil interne, absent des constructions de staging et de production. Chaque composant est " +
    "montré dans les états qu'il a aujourd'hui ; les composants de RUB s'ajoutent section par section.",
} as const;

export const metadata: Metadata = {
  title: TEXTS.title,
  robots: { index: false, follow: false },
};

export default function StateBoardPage() {
  return (
    <main
      data-state-board=""
      className="mx-auto flex w-full max-w-(--container-narrow) flex-col gap-8 px-page-gutter py-section-header"
    >
      <header className="flex flex-col gap-3">
        <h1 className={PAGE_TITLE_CLASSES}>{TEXTS.title}</h1>
        <p className="text-md text-text-secondary">{TEXTS.intro}</p>
      </header>
      <AnnouncerProvider>
        <StructureBoard />
        <AnnouncerBoard />
        <ButtonBoard />
        <SurfaceBoard />
        <NoticeBoard />
        <BadgeBoard />
        <FieldBoard />
        <ChoiceBoard />
        <DialogBoard />
        <WizardBoard />
        <ListBoard />
        <CardBoard />
        <ReadingBoard />
      </AnnouncerProvider>
    </main>
  );
}

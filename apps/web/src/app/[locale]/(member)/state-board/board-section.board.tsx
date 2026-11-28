import type { ReactNode } from "react";
import { cn } from "@/components/ui/class-names";
import { MEMBER_CARD_CLASSES } from "@/components/member/ui/card-classes";
import {
  OVERLINE,
  SECTION_TITLE,
} from "@/components/member/ui/heading-classes";
import { PAGE_TITLE_CLASSES } from "@/components/member/ui/page-header-classes";

/**
 * The families of the board (RUB-fix-10a; archives/jalons/rub/modele-archi.md §4), one page each at `state-board/<family>`,
 * in the order of the index: a family is the components of one line of RUB.
 */
export const BOARD_FAMILIES = {
  structure: "Cadre, en-tête, section et annonceur",
  surface: "Boutons, liens d'action et surfaces",
  badge: "Notices, badges et plaques",
  field: "Champs et messages",
  choice: "Choix, repli, enregistrement et date",
  dialog: "Dialogues, filtres et pagination",
  wizard: "Assistant, récapitulatif et code",
  list: "Listes et états",
  card: "Cartes",
  reading: "Composants de lecture",
} as const;

export type BoardFamily = keyof typeof BOARD_FAMILIES;

const BOARD_TITLE = "Planche des états des composants";

/** The page title of the board, or of one family of it. */
export function boardTitle(family?: BoardFamily): string {
  return family === undefined
    ? BOARD_TITLE
    : `${BOARD_TITLE} : ${BOARD_FAMILIES[family]}`;
}

/** The head of a page of the board: its only `h1` outside the page-header cells, and what it holds. */
export function BoardHeader({
  title,
  intro,
}: {
  title: string;
  intro: string;
}) {
  return (
    <header className="flex flex-col gap-3">
      <h1 className={PAGE_TITLE_CLASSES}>{title}</h1>
      <p className="text-md text-text-secondary">{intro}</p>
    </header>
  );
}

type BoardSectionProps = {
  /** The stable name of the component (`data-board-component`): the hook of the screenshots and tests. */
  component: string;
  title: string;
  /** What the section shows, and the states a still page cannot show (hover, focus, press). */
  note: string;
  children: ReactNode;
};

/** One component of the board: a title, its note, then one cell per state. */
export function BoardSection({
  component,
  title,
  note,
  children,
}: BoardSectionProps) {
  const headingId = `board-${component}`;
  return (
    <section
      data-board-component={component}
      aria-labelledby={headingId}
      className="flex flex-col gap-4"
    >
      <h2 id={headingId} className={SECTION_TITLE}>
        {title}
      </h2>
      <p className="text-sm text-text-secondary">{note}</p>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

type BoardStateProps = {
  /** The stable name of the state (`data-board-state`), unique within its component. */
  state: string;
  label: string;
  className?: string;
  /** No card under the cell: for a component that is itself a card, never put inside another one. */
  bare?: boolean;
  children: ReactNode;
};

/** One state of a component, on the surface of a card (or on the page when `bare`), its name above it. */
export function BoardState({
  state,
  label,
  className,
  bare = false,
  children,
}: BoardStateProps) {
  if (bare) {
    return (
      <div data-board-state={state} className="flex flex-col gap-4">
        <p className={OVERLINE}>{label}</p>
        <div className={cn("flex flex-col gap-3", className)}>{children}</div>
      </div>
    );
  }
  return (
    <div data-board-state={state} className={MEMBER_CARD_CLASSES}>
      <p className={OVERLINE}>{label}</p>
      <div className={cn("flex flex-wrap items-start gap-3", className)}>
        {children}
      </div>
    </div>
  );
}

import { PageFrame } from "@/components/member/ui/PageFrame";
import { PageHeader } from "@/components/member/ui/PageHeader";
import { Section } from "@/components/member/ui/Section";
import type { SectionVariant } from "@/components/member/ui/section-classes";
import { StatusBadge } from "@/components/member/ui/StatusBadge";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { BoardSection, BoardState } from "./board-section.board";

const SECTIONS: readonly {
  variant: SectionVariant;
  label: string;
  title: string;
}[] = [
  {
    variant: "page",
    label: "Section de page",
    title: "Titre de section de 20 px",
  },
  {
    variant: "reading",
    label: "Section de lecture",
    title: "Titre de lecture de 20 px",
  },
  {
    variant: "account",
    label: "Section de compte",
    title: "Titre de compte de 16 px",
  },
  {
    variant: "bo",
    label: "Section de backoffice",
    title: "Titre de backoffice de 16 px",
  },
  {
    variant: "overline",
    label: "Section à surtitre",
    title: "Surtitre en capitales",
  },
];

const TEXTS = {
  title: "Cadre, en-tête et section",
  note:
    "Le cadre porte le halo, la gouttière et l'écart ; l'en-tête, l'unique h1 de la page ; la section, un h2 " +
    "et son contenu, sans conteneur. Une cellule d'en-tête porte son propre h1 : la planche ne compte que ceux " +
    "qui sont hors d'une telle cellule.",
  frameWide: "Cadre large",
  frameNarrow: "Cadre étroit",
  frameText: "Le contenu de la page se place dans le cadre, sous son halo.",
  headerDefault: "En-tête, titre de page",
  headerFull: "En-tête, titre de section, chapeau, badges, action et méta",
  headerTitle: "Campagnes de la marque",
  headerLead: "Retrouvez ici vos campagnes et leur avancement.",
  headerMeta: "Mise à jour le 12 janvier 2027",
  headerBadge: "En cours",
  headerAction: "Nouvelle campagne",
  crumbHome: "Accueil",
  crumbCampaigns: "Campagnes",
  crumbHere: "Printemps 2027",
  sectionBody: "Le contenu de la section vient sous son titre.",
  sectionNext: "Une seconde section, sous un filet.",
  sectionCount: "(3)",
} as const;

/** The page frame, the page header and the section of the member spaces (C01, C02, C03). */
export function StructureBoard() {
  return (
    <BoardSection component="structure" title={TEXTS.title} note={TEXTS.note}>
      <BoardState state="page-frame-wide" label={TEXTS.frameWide}>
        <PageFrame variant="wide">
          <p className="text-md text-text-secondary">{TEXTS.frameText}</p>
        </PageFrame>
      </BoardState>
      <BoardState state="page-frame-narrow" label={TEXTS.frameNarrow}>
        <PageFrame variant="narrow">
          <p className="text-md text-text-secondary">{TEXTS.frameText}</p>
        </PageFrame>
      </BoardState>
      <BoardState state="page-header-default" label={TEXTS.headerDefault}>
        <PageHeader title={TEXTS.headerTitle} />
      </BoardState>
      <BoardState state="page-header-full" label={TEXTS.headerFull}>
        <PageHeader
          title={TEXTS.headerTitle}
          titleSize="section"
          crumbs={[
            { href: "#", label: TEXTS.crumbHome },
            { href: "#", label: TEXTS.crumbCampaigns },
            { label: TEXTS.crumbHere },
          ]}
          badges={<StatusBadge tone="info">{TEXTS.headerBadge}</StatusBadge>}
          lead={TEXTS.headerLead}
          actions={<MemberButton>{TEXTS.headerAction}</MemberButton>}
          meta={TEXTS.headerMeta}
        />
      </BoardState>
      {SECTIONS.map(({ variant, label, title }) => (
        <BoardState
          key={variant}
          state={`section-${variant}`}
          label={label}
          className="flex-col"
        >
          <div className="flex w-full flex-col">
            <Section variant={variant} title={title} count={TEXTS.sectionCount}>
              <p className="text-md text-text-secondary">{TEXTS.sectionBody}</p>
            </Section>
            <Section variant={variant} title={title}>
              <p className="text-md text-text-secondary">{TEXTS.sectionNext}</p>
            </Section>
          </div>
        </BoardState>
      ))}
    </BoardSection>
  );
}

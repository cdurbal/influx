"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/member/ui/Button";
import { ChipList } from "@/components/member/ui/ChipList";
import { CounterBadge } from "@/components/member/ui/CounterBadge";
import { LayerBadge } from "@/components/member/ui/LayerBadge";
import type { ProfileLayer } from "@/components/member/ui/layer-badge-classes";
import { LogoPlate } from "@/components/member/ui/LogoPlate";
import type { LogoPlateSize } from "@/components/member/ui/logo-plate-classes";
import { RoleBadge, type MemberRole } from "@/components/member/ui/RoleBadge";
import { StatusBadge } from "@/components/member/ui/StatusBadge";
import type { StatusTone } from "@/components/member/ui/status-badge-classes";
import { VerifiedBadge } from "@/components/member/ui/VerifiedBadge";
import {
  BadgeCheckIcon,
  CheckIcon,
  CircleAlertIcon,
  CircleCheckIcon,
  ClockIcon,
  FlagIcon,
  InfoIcon,
  TriangleAlertIcon,
} from "@/components/ui/icons";
import { BoardSection, BoardState } from "./board-section.board";

// The badges of the connected spaces (C13 to C16, C33, C38; jalon RUB, line 03). One section per component:
// `data-board-component` is `status-badge`, `layer-badge`, `role-badge`, `counter-badge`, `logo-plate` and
// `chip-list` (RUB-A §4). The file is a client one for the counter alone, whose change a still page cannot
// show: one button moves its value (useState only).

const STATUS: readonly {
  tone: StatusTone;
  label: string;
  icon: typeof ClockIcon;
}[] = [
  { tone: "neutral", label: "Brouillon", icon: ClockIcon },
  { tone: "success", label: "Publiée", icon: CircleCheckIcon },
  { tone: "warning", label: "À compléter", icon: TriangleAlertIcon },
  { tone: "error", label: "Refusée", icon: CircleAlertIcon },
  { tone: "info", label: "En relecture", icon: InfoIcon },
  { tone: "verified", label: "Vérifié", icon: BadgeCheckIcon },
];

const LAYERS: readonly { layer: ProfileLayer; label: string }[] = [
  { layer: "public", label: "Visible par tous" },
  { layer: "revealed", label: "Visible après la mise en relation" },
  { layer: "internal", label: "Visible par l'équipe INFLUX seulement" },
];

const ROLES: readonly { role: MemberRole; label: string }[] = [
  { role: "advertiser", label: "Marque" },
  { role: "creator", label: "Créateur" },
];

const PLATE_SIZES: readonly LogoPlateSize[] = [32, 40, 48, 56, 64, 120];

/** A picture of 8 px, drawn by the board itself: no network, no real person (the plate scales it). */
const SAMPLE_PICTURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAG0lEQVR4nGPIa1o1bdUlTJIBq2he0yqGQakDANprdYF8/8S5AAAAAElFTkSuQmCC";

/** A source that cannot be decoded: the plate must fall back to the initials, never show a broken image. */
const BROKEN_PICTURE = "data:image/png;base64,AAAA";

const TEXTS = {
  statusTitle: "Badge d'état",
  statusNote:
    "C13 : le badge d'état dans ses six tons (le vérifié compris), seul, avec son icône (écart de 8 px), puis sans pilule " +
    "(icône de 16 px et mot, écart de 4 px). Le mot est toujours écrit : le ton le renforce, jamais ne le remplace.",
  tones: "Cinq tons d'état et le ton vérifié",
  withIcon: "Avec icône",
  text: "Sans pilule : en retard, à jour, synchronisé",
  late: "En retard",
  onTime: "À jour",
  synced: "Synchronisé",
  verifiedPhrase: "Phrase du badge vérifié (jamais une coche seule)",
  verifiedLabel: "Vérifié",
  verifiedNetwork: "Instagram",
  verifiedDate: "12 novembre 2026",
  layerTitle: "Badge de couche",
  layerNote:
    "C14 : qui voit un champ, par une icône ET un texte. Seul, le texte sur une ligne ; à la ligne dans une boîte de 12 px " +
    "de rayon ; réduit à son icône, dont le texte reste le nom et s'affiche au survol, au focus et au toucher.",
  layers: "Les trois couches",
  layerWrap: "À la ligne (rayon 12)",
  layerWrapped:
    "Visible après la mise en relation entre la marque et le créateur",
  layerIconOnly: "Icône seule, texte pour nom",
  roleTitle: "Badge de rôle",
  roleNote:
    "C15 : une pastille de couleur, puis le rôle écrit. Sa graisse est la sienne : la même cellule sous un parent en 800 " +
    "ne la hérite pas (RU-15).",
  roles: "Marque et créateur",
  roleHeavy: "Sous un parent en graisse 800",
  counterTitle: "Compteur",
  counterNote:
    "C16 : le nombre jusqu'à neuf, « 9+ » au-delà, rien à zéro ; lu en toutes lettres. En retard : fond d'avertissement et " +
    "drapeau. Une valeur qui change fait un éclat de 320 ms sur son conteneur, jamais au premier dessin ; le bouton " +
    "l'incrémente.",
  pill: "Pastille",
  dot: "Disque de 20 px",
  lateCounter: "En retard : pastille avec le nombre, disque avec le drapeau",
  changed: "Valeur changée",
  increment: "Ajouter un élément",
  plateTitle: "Plaque de logo et avatar",
  plateNote:
    "C33 : le logo sur sa plaque claire dans six tailles (rayon 12, 16 pour le héros), les initiales quand l'image manque " +
    "ou échoue, l'avatar rond sur fond uni (RU-07), le carré en tirets d'un logo absent.",
  plateImage: "Plaque avec image, six tailles",
  plateInitials: "Plaque sans image : les initiales, six tailles",
  round: "Avatar rond, avec et sans image",
  dashed: "Logo absent : carré en tirets",
  failed: "Image qui échoue : les initiales",
  brandName: "Atelier Exemple",
  creatorName: "Camille Exemple",
  chipTitle: "Liste de pastilles",
  chipNote:
    "C38 : des mots en pastilles de 32 px, sans rôle de contrôle ni focus ; la liste est nommée et passe à la ligne.",
  chips: "Trois thématiques",
  chipsMany: "Beaucoup : passe à la ligne",
  chipsLabel: "Thématiques",
  chipItems: ["Cuisine et gastronomie", "Famille et parentalité", "Bien-être"],
  chipMany: [
    "Reel",
    "Publication",
    "Story",
    "Vidéo courte",
    "Contenu généré par les utilisateurs",
    "Direct",
    "Podcast",
  ],
} as const;

function CounterChangeCell(): ReactNode {
  const [count, setCount] = useState(3);
  return (
    <>
      <CounterBadge count={count} label={`${count} éléments`} />
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setCount((current) => current + 1)}
      >
        {TEXTS.increment}
      </Button>
    </>
  );
}

/** The badges of the connected spaces, one section each, a still page showing all they draw. */
export function BadgeBoard() {
  return (
    <>
      <BoardSection
        component="status-badge"
        title={TEXTS.statusTitle}
        note={TEXTS.statusNote}
      >
        <BoardState state="tones" label={TEXTS.tones}>
          {STATUS.map(({ tone, label }) => (
            <StatusBadge key={tone} tone={tone}>
              {label}
            </StatusBadge>
          ))}
        </BoardState>
        <BoardState state="with-icon" label={TEXTS.withIcon}>
          {STATUS.map(({ tone, label, icon }) => (
            <StatusBadge key={tone} tone={tone} icon={icon}>
              {label}
            </StatusBadge>
          ))}
        </BoardState>
        <BoardState state="text" label={TEXTS.text}>
          <StatusBadge tone="warning" variant="text" icon={FlagIcon}>
            {TEXTS.late}
          </StatusBadge>
          <StatusBadge tone="neutral" variant="text" icon={CheckIcon}>
            {TEXTS.onTime}
          </StatusBadge>
          <StatusBadge tone="info" variant="text" icon={CircleCheckIcon}>
            {TEXTS.synced}
          </StatusBadge>
        </BoardState>
        <BoardState state="verified-phrase" label={TEXTS.verifiedPhrase}>
          <VerifiedBadge
            label={TEXTS.verifiedLabel}
            network={TEXTS.verifiedNetwork}
            date={TEXTS.verifiedDate}
          />
        </BoardState>
      </BoardSection>

      <BoardSection
        component="layer-badge"
        title={TEXTS.layerTitle}
        note={TEXTS.layerNote}
      >
        <BoardState state="layers" label={TEXTS.layers}>
          {LAYERS.map(({ layer, label }) => (
            <LayerBadge key={layer} layer={layer} label={label} />
          ))}
        </BoardState>
        <BoardState state="wrap" label={TEXTS.layerWrap}>
          <div className="w-full max-w-(--size-layer-badge-message)">
            <LayerBadge layer="revealed" wrap label={TEXTS.layerWrapped} />
          </div>
        </BoardState>
        <BoardState state="icon-only" label={TEXTS.layerIconOnly}>
          {LAYERS.map(({ layer, label }) => (
            <LayerBadge key={layer} layer={layer} iconOnly label={label} />
          ))}
        </BoardState>
      </BoardSection>

      <BoardSection
        component="role-badge"
        title={TEXTS.roleTitle}
        note={TEXTS.roleNote}
      >
        <BoardState state="roles" label={TEXTS.roles}>
          {ROLES.map(({ role, label }) => (
            <RoleBadge key={role} role={role} label={label} />
          ))}
        </BoardState>
        <BoardState state="inherited-weight" label={TEXTS.roleHeavy}>
          <div className="flex gap-3 font-extrabold">
            {ROLES.map(({ role, label }) => (
              <RoleBadge key={role} role={role} label={label} />
            ))}
          </div>
        </BoardState>
      </BoardSection>

      <BoardSection
        component="counter-badge"
        title={TEXTS.counterTitle}
        note={TEXTS.counterNote}
      >
        <BoardState state="pill" label={TEXTS.pill}>
          <CounterBadge count={3} label="3 nouveaux éléments" />
          <CounterBadge count={12} label="12 nouveaux éléments" />
        </BoardState>
        <BoardState state="dot" label={TEXTS.dot}>
          <CounterBadge variant="dot" count={3} label="3 filtres actifs" />
          <CounterBadge variant="dot" count={12} label="12 filtres actifs" />
        </BoardState>
        <BoardState state="late" label={TEXTS.lateCounter}>
          <CounterBadge late count={4} label="4 hors délai" />
          <CounterBadge late variant="dot" count={4} label="4 hors délai" />
        </BoardState>
        <BoardState state="changed" label={TEXTS.changed}>
          <CounterChangeCell />
        </BoardState>
      </BoardSection>

      <BoardSection
        component="logo-plate"
        title={TEXTS.plateTitle}
        note={TEXTS.plateNote}
      >
        <BoardState
          state="plate-image"
          label={TEXTS.plateImage}
          className="items-center"
        >
          {PLATE_SIZES.map((size) => (
            <LogoPlate
              key={size}
              src={SAMPLE_PICTURE}
              name={TEXTS.brandName}
              size={size}
              shape="plate"
            />
          ))}
        </BoardState>
        <BoardState
          state="plate-initials"
          label={TEXTS.plateInitials}
          className="items-center"
        >
          {PLATE_SIZES.map((size) => (
            <LogoPlate
              key={size}
              name={TEXTS.brandName}
              size={size}
              shape="plate"
            />
          ))}
        </BoardState>
        <BoardState state="round" label={TEXTS.round} className="items-center">
          <LogoPlate
            src={SAMPLE_PICTURE}
            name={TEXTS.creatorName}
            size={48}
            shape="round"
          />
          <LogoPlate name={TEXTS.creatorName} size={48} shape="round" />
          <LogoPlate name={TEXTS.creatorName} size={40} shape="round" />
        </BoardState>
        <BoardState state="dashed" label={TEXTS.dashed}>
          <LogoPlate
            name={TEXTS.brandName}
            size={48}
            shape="plate"
            missing="dashed"
          />
        </BoardState>
        <BoardState state="failed" label={TEXTS.failed}>
          <LogoPlate
            src={BROKEN_PICTURE}
            name={TEXTS.brandName}
            size={48}
            shape="plate"
          />
        </BoardState>
      </BoardSection>

      <BoardSection
        component="chip-list"
        title={TEXTS.chipTitle}
        note={TEXTS.chipNote}
      >
        <BoardState state="chips" label={TEXTS.chips}>
          <ChipList items={[...TEXTS.chipItems]} label={TEXTS.chipsLabel} />
        </BoardState>
        <BoardState state="chips-many" label={TEXTS.chipsMany}>
          <ChipList items={[...TEXTS.chipMany]} label={TEXTS.chipsLabel} />
        </BoardState>
      </BoardSection>
    </>
  );
}

import { RoleBadge, type MemberRole } from "@/components/member/ui/RoleBadge";
import { StatusBadge } from "@/components/member/ui/StatusBadge";
import type { StatusTone } from "@/components/member/ui/status-badge-classes";
import { VerifiedBadge } from "@/components/member/ui/VerifiedBadge";
import { BoardSection, BoardState } from "./board-section.board";

const STATUS: readonly { tone: StatusTone; label: string }[] = [
  { tone: "neutral", label: "Brouillon" },
  { tone: "success", label: "Publiée" },
  { tone: "warning", label: "À compléter" },
  { tone: "error", label: "Refusée" },
  { tone: "info", label: "En relecture" },
];

const ROLES: readonly { role: MemberRole; label: string }[] = [
  { role: "advertiser", label: "Marque" },
  { role: "creator", label: "Créateur" },
];

const TEXTS = {
  title: "Badge",
  note:
    "Le badge d'état dans ses cinq tons, le badge de rôle (une pastille de couleur, puis le rôle écrit) " +
    "et le badge de vérification (la phrase, jamais une coche seule). Le badge de couche est montré avec son champ.",
  status: "État",
  role: "Rôle",
  verified: "Vérifié",
  verifiedLabel: "Vérifié",
  verifiedNetwork: "Instagram",
  verifiedDate: "12 novembre 2026",
} as const;

/** The badges of the connected spaces that a still page can show. */
export function BadgeBoard() {
  return (
    <BoardSection component="badge" title={TEXTS.title} note={TEXTS.note}>
      <BoardState state="status" label={TEXTS.status}>
        {STATUS.map(({ tone, label }) => (
          <StatusBadge key={tone} tone={tone}>
            {label}
          </StatusBadge>
        ))}
      </BoardState>
      <BoardState state="role" label={TEXTS.role}>
        {ROLES.map(({ role, label }) => (
          <RoleBadge key={role} role={role} label={label} />
        ))}
      </BoardState>
      <BoardState state="verified" label={TEXTS.verified}>
        <VerifiedBadge
          label={TEXTS.verifiedLabel}
          network={TEXTS.verifiedNetwork}
          date={TEXTS.verifiedDate}
        />
      </BoardState>
    </BoardSection>
  );
}

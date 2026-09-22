"use client";

import React from "react";
import {
  Sparkles,
  Laptop,
  Shirt,
  Gamepad2,
  Heart,
  Dumbbell,
  UtensilsCrossed,
  Plane,
  TrendingUp,
  Car,
  Compass,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { type CampaignFeedCard } from "@influx/contracts";

/**
 * Badge officiel d'audit marque par INFLUX style Revolut (100% sans bordure).
 */
export function BrandAuditBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#1c1e28] text-neutral-300 select-none shrink-0 ${className}`}
      title="Marque vérifiée & auditée par INFLUX"
    >
      <ShieldCheck className="w-3.5 h-3.5 text-[#00d68f] shrink-0" />
      <span>Auditée</span>
    </span>
  );
}

/**
 * Collection d'images Unsplash haute définition spécialement sélectionnées
 * pour illustrer les campagnes par secteur / thématique avec un rendu premium digne de Revolut.
 */
export const CAMPAIGN_THEME_IMAGES: Record<string, string> = {
  beaute:
    "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&auto=format&fit=crop&q=80", // Sérum cosmétique bio flacon ambré & soins botaniques
  tech: "https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=800&auto=format&fit=crop&q=80", // High-tech, chargeur GaN & hardware moderne
  gaming:
    "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80", // Setup gaming & esport pro
  mode: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800&auto=format&fit=crop&q=80", // Shooting mode & prêt-à-porter
  lifestyle:
    "https://images.unsplash.com/photo-1513151233558-d860c5398176?w=800&auto=format&fit=crop&q=80", // Lifestyle créatif épuré
  fitness:
    "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=800&auto=format&fit=crop&q=80", // Fitness & sport
  food: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=80", // Gastronomie gourmet
  voyage:
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&auto=format&fit=crop&q=80", // Voyage & aventure
  finance:
    "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop&q=80", // Business & finance
  automobile:
    "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&auto=format&fit=crop&q=80", // Automobile moderne
};

export function getSectorFallbackGradient(sector?: string): string {
  const s = (sector || "").toLowerCase();
  if (s.includes("beauté") || s.includes("cosmétique") || s.includes("beaute")) {
    return "from-[#28151f] via-[#1c141a] to-[#14151c]";
  }
  if (s.includes("tech") || s.includes("hardware")) {
    return "from-[#112331] via-[#131c26] to-[#14151c]";
  }
  if (s.includes("game") || s.includes("gaming")) {
    return "from-[#221331] via-[#1a1426] to-[#14151c]";
  }
  if (s.includes("mode") || s.includes("fashion")) {
    return "from-[#2b1f14] via-[#1d1814] to-[#14151c]";
  }
  return "from-[#122b20] via-[#131f1a] to-[#14151c]";
}

const DEFAULT_COVER_IMAGE =
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80";

/**
 * Résout la meilleure image de couverture pour une campagne selon son titre,
 * sa marque ou ses thématiques.
 */
export function getCampaignCoverImage(
  campaign: Pick<CampaignFeedCard, "title" | "targetTopics" | "brandSector">,
): string {
  const titleLower = campaign.title.toLowerCase();
  const sectorLower = (campaign.brandSector || "").toLowerCase();

  // Détections spécifiques par mots-clés prioritaires
  if (
    titleLower.includes("sérum") ||
    titleLower.includes("bio") ||
    titleLower.includes("cosmétique") ||
    sectorLower.includes("beauté") ||
    sectorLower.includes("cosmétique")
  ) {
    return CAMPAIGN_THEME_IMAGES.beaute!;
  }

  if (
    titleLower.includes("gan") ||
    titleLower.includes("chargeur") ||
    titleLower.includes("hardware") ||
    sectorLower.includes("tech")
  ) {
    return CAMPAIGN_THEME_IMAGES.tech!;
  }

  if (
    titleLower.includes("game") ||
    titleLower.includes("jeu") ||
    sectorLower.includes("gaming")
  ) {
    return CAMPAIGN_THEME_IMAGES.gaming!;
  }

  // Détection par première thématique connue
  for (const topic of campaign.targetTopics) {
    const key = topic.toLowerCase().trim();
    if (CAMPAIGN_THEME_IMAGES[key]) {
      return CAMPAIGN_THEME_IMAGES[key]!;
    }
  }

  return DEFAULT_COVER_IMAGE;
}

export interface TopicMeta {
  key: string;
  label: string;
  icon: LucideIcon;
}

export const TOPICS_META: Record<string, TopicMeta> = {
  beaute: { key: "beaute", label: "Beauté", icon: Sparkles },
  mode: { key: "mode", label: "Mode", icon: Shirt },
  tech: { key: "tech", label: "Tech", icon: Laptop },
  gaming: { key: "gaming", label: "Gaming", icon: Gamepad2 },
  lifestyle: { key: "lifestyle", label: "Lifestyle", icon: Heart },
  fitness: { key: "fitness", label: "Fitness", icon: Dumbbell },
  food: { key: "food", label: "Food", icon: UtensilsCrossed },
  voyage: { key: "voyage", label: "Voyage", icon: Plane },
  finance: { key: "finance", label: "Finance", icon: TrendingUp },
  automobile: { key: "automobile", label: "Automobile", icon: Car },
};

export function getTopicIcon(topic: string): LucideIcon {
  const key = topic.toLowerCase().trim();
  return TOPICS_META[key]?.icon || Compass;
}

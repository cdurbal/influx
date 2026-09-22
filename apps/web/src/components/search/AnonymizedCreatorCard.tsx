"use client";

import React from "react";
import { Eye, Star, MapPin, Coins, Send } from "lucide-react";
import {
  type AnonymizedCreatorCard as AnonymizedCreatorCardType,
  type IdentifiedCreatorCard,
} from "@influx/contracts";
import { getSearchLabels } from "./search-labels";
import { TwitterVerifiedBadge } from "./TwitterVerifiedBadge";

export interface AnonymizedCreatorCardProps {
  creator: AnonymizedCreatorCardType | IdentifiedCreatorCard;
  locale?: string;
  onViewDetail: (
    creator: AnonymizedCreatorCardType | IdentifiedCreatorCard,
  ) => void;
  onShortlist: (
    creator: AnonymizedCreatorCardType | IdentifiedCreatorCard,
  ) => void;
  onIntroduce: (
    creator: AnonymizedCreatorCardType | IdentifiedCreatorCard,
  ) => void;
}

const CREATOR_FIRST_NAMES = [
  "Stéphane",
  "Camille",
  "Thomas",
  "Sarah",
  "Alexandre",
  "Léa",
  "Maxime",
  "Chloé",
  "Nicolas",
  "Julie",
];

function getCreatorDisplayName(
  creator: AnonymizedCreatorCardType | IdentifiedCreatorCard,
): {
  firstName: string;
  alias: string;
} {
  const str = creator.alias || creator.creatorAccountId || "0";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % CREATOR_FIRST_NAMES.length;
  return {
    firstName: CREATOR_FIRST_NAMES[index] || "Créateur",
    alias: creator.alias,
  };
}

const CREATOR_PHOTOS = [
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80", // Homme pro tech souriant (style Stéphane Malt)
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80", // Femme créatrice mode/lifestyle
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=600&auto=format&fit=crop&q=80", // Homme créatif tech
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=600&auto=format&fit=crop&q=80", // Femme beauté/lifestyle
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80", // Femme créative
  "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&auto=format&fit=crop&q=80", // Homme créateur urbain/voyage
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=600&auto=format&fit=crop&q=80", // Femme mode & beauté
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&auto=format&fit=crop&q=80", // Homme expert hardware
  "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=600&auto=format&fit=crop&q=80", // Femme lifestyle/sport
  "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=600&auto=format&fit=crop&q=80", // Homme vidéo/gaming
];

function getCreatorPhoto(
  creator: AnonymizedCreatorCardType | IdentifiedCreatorCard,
): string {
  if (
    creator.portfolio &&
    creator.portfolio.length > 0 &&
    creator.portfolio[0]?.imageUrl &&
    !creator.portfolio[0].imageUrl.includes("storage.influx.dev")
  ) {
    return creator.portfolio[0].imageUrl;
  }
  const str = creator.alias || creator.creatorAccountId || "0";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % CREATOR_PHOTOS.length;
  return CREATOR_PHOTOS[index] || CREATOR_PHOTOS[0]!;
}

export function AnonymizedCreatorCard({
  creator,
  locale = "fr",
  onViewDetail,
  onShortlist,
  onIntroduce,
}: AnonymizedCreatorCardProps) {
  const t = getSearchLabels(locale);

  const primaryNetwork =
    creator.networks.find((n) => n.isPrimary) || creator.networks[0];

  const primaryOffer = creator.offers?.[0];

  // Calcul du badge vérifié
  const hasAudienceBadge = creator.networks.some(
    (n) => n.hasVerifiedAudienceBadge,
  );
  const hasAccountBadge = creator.networks.some(
    (n) => n.hasVerifiedAccountBadge,
  );

  const isVerified = hasAudienceBadge || hasAccountBadge;
  const displayName = getCreatorDisplayName(creator);
  const photoUrl = getCreatorPhoto(creator);

  return (
    <article className="group flex flex-col bg-surface-card border border-border-default hover:border-border-strong rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden relative">
      {/* 1. Grande photo portrait plein cadre façon Malt.fr */}
      <div className="relative h-60 sm:h-64 w-full overflow-hidden bg-neutral-900 select-none">
        <img
          src={photoUrl}
          alt={creator.alias}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
        />

        {/* Overlay haut gauche : Badge "Disponibilité confirmée" façon Malt exact */}
        <div className="absolute top-3 left-3 z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 dark:bg-neutral-950/90 text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-neutral-700/80 shadow-md backdrop-blur-md">
            <span className="w-3 h-3 rounded-full border-2 border-emerald-500 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </span>
            <span className="text-xs font-semibold">
              {"Disponibilité confirmée"}
            </span>
          </div>
        </div>

        {/* Overlay haut droit : Bouton favori */}
        <div className="absolute top-3 right-3 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onShortlist(creator);
            }}
            title={t.card.shortlistButton}
            aria-label={t.card.shortlistButton}
            className="w-8 h-8 rounded-full bg-white/90 dark:bg-neutral-950/80 backdrop-blur-md border border-neutral-200 dark:border-neutral-700/80 flex items-center justify-center text-neutral-600 dark:text-neutral-300 hover:text-amber-400 hover:scale-110 transition-all shadow-sm cursor-pointer"
          >
            <Star className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Zone d'informations sous la photo façon Malt.fr */}
      <div className="p-4 sm:p-5 flex flex-col flex-1 space-y-3">
        {/* Ligne 1 : Prénom en couleur d'accent + Rubans médailles + Badge Twitter vérifié + Super Influx */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg font-bold text-[#ff4d4d] tracking-tight">
            {displayName.firstName}
          </span>

          <span className="font-mono text-xs text-text-tertiary">
            {"("}
            {displayName.alias}
            {")"}
          </span>

          {/* Rubans médailles façon Malt */}
          <span
            className="inline-flex items-center gap-0.5 text-xs select-none"
            title="Performances certifiées INFLUX"
          >
            {"🎗️🎗️🎗️"}
          </span>

          {/* Badge officiel de vérification Twitter / X avec tooltip explicatif au survol */}
          {isVerified && (
            <TwitterVerifiedBadge
              type={hasAudienceBadge ? "audience" : "identity"}
              verifiedDate={creator.figuresUpdatedAt}
            />
          )}

          {/* Badge Super-créateur façon Supermalter */}
          <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/15 text-[#3b82f6] border border-blue-500/25">
            {"Super Influx"}
          </span>
        </div>

        {/* Ligne 2 : Titre professionnel en gras (exactement comme sur Malt) */}
        <h3 className="text-base font-bold text-text-primary line-clamp-2 leading-snug group-hover:text-text-brand transition-colors">
          {creator.shortTitle || "Créateur de contenu certifié"}
        </h3>

        {/* Ligne 3 : Métriques alignées (Tarif avec pièces + Pin ville + Étoile note) */}
        <div className="flex items-center gap-4 text-xs text-text-secondary flex-wrap pt-0.5">
          {/* Tarif avec icône pièces empilées */}
          <div className="flex items-center gap-1.5 font-medium">
            <Coins className="w-4 h-4 text-text-brand shrink-0" />
            <span className="font-bold text-text-primary text-xs">
              {primaryOffer
                ? `${t.facets.priceBandOptions[primaryOffer.priceBand] || primaryOffer.priceBand}/collab`
                : "Sur devis"}
            </span>
          </div>

          {/* Localisation avec pin */}
          <div className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
            <span>
              {t.facets.countries[creator.audience.primaryCountry] ||
                creator.audience.primaryCountry}
              {creator.region ? `, ${creator.region}` : ""}
            </span>
          </div>

          {/* Étoile avec note */}
          <div className="flex items-center gap-1 font-semibold text-text-primary">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
            <span>{"5.0"}</span>
            <span className="text-text-tertiary font-normal text-[11px]">
              {"(18)"}
            </span>
          </div>
        </div>

        {/* Ligne 4 : Tags de compétences façon Malt (Pills bleutés/doux) */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {primaryNetwork && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#132338] text-[#60a5fa] border border-[#1e3a5f] capitalize">
              {primaryNetwork.network}
            </span>
          )}
          {primaryOffer && (
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-surface-raised text-text-secondary border border-border-subtle">
              {t.facets.formatOptions[primaryOffer.format] ||
                primaryOffer.format}
            </span>
          )}
          {creator.secondaryTopics.slice(0, 3).map((topic, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 rounded-full text-xs font-medium bg-surface-raised text-text-secondary border border-border-subtle"
            >
              {t.facets.topics[topic] || topic}
            </span>
          ))}
        </div>

        {/* Ligne 5 : Boutons d'actions en pied de carte */}
        <div className="mt-auto pt-3 border-t border-border-subtle flex items-center gap-2">
          <button
            type="button"
            onClick={() => onViewDetail(creator)}
            className="flex-1 py-2 px-3 rounded-xl border border-border-default hover:border-border-strong hover:bg-surface-raised text-text-secondary hover:text-text-primary text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{t.card.detailsButton}</span>
          </button>

          <button
            type="button"
            disabled={creator.relationStatus === "request_pending"}
            onClick={() => onIntroduce(creator)}
            className="flex-1 py-2 px-3 rounded-xl bg-action-primary-bg hover:bg-action-primary-bg-hover text-text-on-action text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>
              {creator.relationStatus === "request_pending"
                ? t.card.introductionRequested
                : creator.relationStatus === "already_introduced"
                  ? t.card.relationActive
                  : t.card.introduceButton}
            </span>
          </button>
        </div>
      </div>
    </article>
  );
}

"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Eye,
  Send,
  Star,
  Calendar,
  MapPin,
  Lock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { type CampaignFeedCard as CampaignFeedCardType } from "@influx/contracts";
import { type CreatorCampaignLabels } from "./creator-campaign-labels";
import { TwitterVerifiedBadge } from "../search/TwitterVerifiedBadge";
import { NetworkIconBadge } from "../search/CreatorThemeVisuals";
import {
  getCampaignCoverImage,
  BrandAuditBadge,
  getSectorFallbackGradient,
} from "./CampaignVisuals";

interface CampaignFeedCardProps {
  campaign: CampaignFeedCardType;
  labels: CreatorCampaignLabels;
  locale: string;
}

export function CampaignFeedCard({
  campaign,
  labels,
  locale,
}: CampaignFeedCardProps) {
  const { card: t } = labels;
  const [isFavorite, setIsFavorite] = useState(false);
  const [imageError, setImageError] = useState(false);

  const isClosed = campaign.isClosed;
  const detailUrl = `/${locale}/creator/campaigns/${campaign.id}`;
  const coverUrl = getCampaignCoverImage(campaign);

  // Formatage du budget brut marque
  const formatCompensation = () => {
    if (campaign.compensationNature === "dotation_seule") {
      return t.nonMonetaryOnly;
    }
    if (
      campaign.minCompensationMinor != null &&
      campaign.maxCompensationMinor != null
    ) {
      const min = (campaign.minCompensationMinor / 100).toLocaleString(locale);
      const max = (campaign.maxCompensationMinor / 100).toLocaleString(locale);
      return `${min} – ${max} ${campaign.currency}`;
    }
    return "—";
  };

  return (
    <article
      className={`group flex flex-col justify-between rounded-3xl bg-[#14151c] hover:bg-[#181922] shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden relative ${
        isClosed ? "opacity-80 grayscale-[25%]" : ""
      }`}
    >
      {/* 1. Header visuel Revolut (170px) sans aucun contour blanc */}
      <div
        style={{ height: 170, minHeight: 170, maxHeight: 170 }}
        className="relative w-full overflow-hidden bg-[#101117] select-none shrink-0"
      >
        {!imageError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={campaign.title}
            onError={() => setImageError(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center",
            }}
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 ease-out"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${getSectorFallbackGradient(campaign.brandSector)} flex items-center justify-center relative overflow-hidden`}
          >
            <div className="flex flex-col items-center gap-1.5 z-0 text-white/30">
              <Sparkles className="w-8 h-8 stroke-[1.5]" />
              <span className="text-[11px] font-semibold tracking-wider uppercase text-white/40">
                {campaign.brandSector || "Campagne"}
              </span>
            </div>
          </div>
        )}

        {/* Dégradé doux progressif vers le fond de carte #14151c */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#14151c] via-[#14151c]/60 to-transparent pointer-events-none" />

        {/* Overlay haut gauche : Statut d'ouverture avec verre dépoli sans contour blanc */}
        <div className="absolute top-3.5 left-3.5 z-10">
          {isClosed ? (
            <div
              style={{ backdropFilter: "blur(16px)" }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/60 text-neutral-300 shadow-md text-xs font-medium"
            >
              <Lock
                style={{ width: 13, height: 13 }}
                className="text-neutral-400 shrink-0"
              />
              <span>
                {t.campaignClosed}
                {campaign.closedSinceDays != null &&
                campaign.closedSinceDays > 0
                  ? ` (${t.closedSince(campaign.closedSinceDays)})`
                  : ""}
              </span>
            </div>
          ) : campaign.hasApplied ? (
            <div
              style={{ backdropFilter: "blur(16px)" }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#00d68f]/20 text-[#00d68f] shadow-md text-xs font-semibold"
            >
              <CheckCircle2
                style={{ width: 13, height: 13 }}
                className="shrink-0"
              />
              <span>
                {campaign.appliedAt
                  ? t.alreadyApplied(
                      new Date(campaign.appliedAt).toLocaleDateString(locale),
                    )
                  : t.alreadyApplied("")}
              </span>
            </div>
          ) : (
            <div
              style={{ backdropFilter: "blur(16px)" }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 text-white shadow-md text-xs font-semibold"
            >
              <span
                style={{ width: 7, height: 7 }}
                className="rounded-full bg-[#00d68f] animate-pulse shrink-0"
              />
              <span>{t.openApplications}</span>
            </div>
          )}
        </div>

        {/* Overlay haut droit : Badge Audience vérifiée & Wishlist sans contour */}
        <div className="absolute top-3.5 right-3.5 z-10 flex items-center gap-2">
          {campaign.verifiedOnly && (
            <div
              style={{ backdropFilter: "blur(16px)" }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-semibold shadow-md"
            >
              <span>★</span>
              <span>{t.verifiedOnlyBadge}</span>
            </div>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsFavorite(!isFavorite);
            }}
            title={t.shortlistButton}
            aria-label={t.shortlistButton}
            style={{
              width: 34,
              height: 34,
              backdropFilter: "blur(16px)",
            }}
            className="rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-neutral-300 hover:text-amber-400 transition-colors shadow-md cursor-pointer"
          >
            <Star
              style={{ width: 15, height: 15 }}
              className={`transition-colors ${isFavorite ? "fill-amber-400 text-amber-400" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* 2. Corps de la carte : Aération totale & Surfaces Revolut sans contour */}
      <div className="p-6 flex flex-col flex-1 gap-4">
        {/* En-tête Marque : Avatar Squircle (46px) + Nom blanc pur + Badges discrets + Secteur */}
        <div className="flex items-center gap-3.5">
          <div
            style={{ width: 46, height: 46, minWidth: 46, minHeight: 46 }}
            className="rounded-2xl bg-[#1c1e28] shadow-sm flex items-center justify-center font-bold text-sm text-white overflow-hidden shrink-0"
          >
            {campaign.brandLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={campaign.brandLogoUrl}
                alt={campaign.brandName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span className="tracking-wider text-white">
                {campaign.brandName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base text-white tracking-tight leading-snug truncate hover:text-neutral-200 transition-colors">
                {campaign.brandName}
              </span>

              {campaign.brandVerified && (
                <TwitterVerifiedBadge
                  type="identity"
                  verifiedDate={
                    campaign.brandVerifiedAt
                      ? new Date(campaign.brandVerifiedAt).toLocaleDateString(
                          locale,
                        )
                      : undefined
                  }
                  className="shrink-0"
                />
              )}

              <BrandAuditBadge />
            </div>

            <p className="text-xs text-neutral-400 font-medium truncate mt-0.5">
              {campaign.brandSector}
              {campaign.brandCompanySize
                ? ` · ${campaign.brandCompanySize}`
                : ""}
            </p>
          </div>
        </div>

        {/* Titre percutant de la mission */}
        <Link
          href={detailUrl}
          className="group/title block text-white hover:text-neutral-200 transition-colors"
        >
          <h3 className="font-bold text-lg leading-snug line-clamp-2">
            {campaign.title}
          </h3>
        </Link>

        {/* Thématiques en soft pills Revolut (sans aucun contour) */}
        <div className="flex flex-wrap gap-1.5">
          {campaign.targetTopics.map((topic) => (
            <span
              key={topic}
              className="rounded-full bg-white/[0.05] hover:bg-white/[0.08] px-3 py-1 text-xs font-medium text-neutral-300 transition-colors"
            >
              #{topic}
            </span>
          ))}
        </div>

        {/* Livrables attendus : Cartouche Revolut teinté #1c1e28 sans contour */}
        <div className="rounded-2xl bg-[#1c1e28] p-4 space-y-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
            {t.deliverablesTitle}
          </span>
          <div className="flex flex-wrap gap-2">
            {campaign.deliverables.map((del, idx) => (
              <span
                key={`${del.network}-${del.format}-${idx}`}
                className="inline-flex items-center gap-2 rounded-xl bg-[#252836] px-3 py-1.5 text-xs text-neutral-200 shadow-xs"
              >
                <NetworkIconBadge
                  network={del.network}
                  size={14}
                  className="shrink-0"
                />
                <span className="text-white font-medium capitalize whitespace-nowrap">
                  {del.quantity}x {del.format.replace(/_/g, " ")}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* LE BLOC FINANCIER HÉROÏQUE REVOLUT (Signature Money Display - Sans aucun contour) */}
        <div className="rounded-2xl bg-[#1c1e28] p-5 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-semibold text-neutral-400 tracking-wider">
              {t.estimatedNetLabel}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#00d68f]/15 text-[#00d68f]">
              NET CRÉATEUR
            </span>
          </div>

          <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-sans">
            {campaign.estimatedNet
              ? campaign.estimatedNet.formattedLabel
              : formatCompensation()}
          </div>

          {campaign.estimatedNet && (
            <div className="text-xs text-neutral-400 pt-0.5">
              Budget marque :{" "}
              <span className="text-neutral-300 font-medium">
                {formatCompensation()}
              </span>
            </div>
          )}
        </div>

        {/* Ligne date limite & localisation avec icônes fines et aération */}
        <div className="flex items-center justify-between text-xs text-neutral-400 px-1 pt-1">
          <div className="flex items-center gap-2 shrink-0">
            <Calendar
              style={{ width: 14, height: 14 }}
              className="text-neutral-400 shrink-0"
            />
            <span>
              {t.deadlineLabel}{" "}
              <strong className="text-neutral-200 font-semibold">
                {new Date(campaign.applicationDeadline).toLocaleDateString(
                  locale,
                )}
              </strong>
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <MapPin
              style={{ width: 14, height: 14 }}
              className="text-neutral-400 shrink-0"
            />
            <span className="font-medium text-neutral-200">
              {campaign.targetCountries.join(", ") || "France"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Pied de carte & Boutons Revolut sans aucun contour blanc */}
      <div className="p-6 pt-0 mt-auto space-y-3.5">
        {/* Bannière d'avertissement aérée (rectangulaire doux, fond teinté sans bordure blanche) */}
        {campaign.ineligibilityReasons.length > 0 && !campaign.hasApplied && (
          <div className="rounded-2xl bg-amber-950/30 p-4 flex items-center gap-3 text-xs text-amber-300">
            <AlertCircle
              style={{ width: 16, height: 16, minWidth: 16 }}
              className="shrink-0 text-amber-400"
            />
            <span className="leading-relaxed font-medium">
              {campaign.ineligibilityReasons[0]}
            </span>
          </div>
        )}

        {/* Boutons d'Action pleins Revolut : Hauteur confortable (48px), padding généreux, zéro contour blanc */}
        <div className="flex items-center gap-3">
          <Link
            href={detailUrl}
            style={{ minHeight: 48 }}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#252836] hover:bg-[#2e3244] px-6 py-3.5 text-center text-sm font-semibold text-white transition-all active:scale-[0.98] cursor-pointer"
          >
            <Eye style={{ width: 16, height: 16 }} />
            <span>{t.viewBriefButton}</span>
          </Link>

          {campaign.canApply ? (
            <Link
              href={detailUrl}
              style={{ minHeight: 48 }}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#00d68f] hover:bg-[#00c080] active:bg-[#00ab72] px-6 py-3.5 text-center text-sm font-bold text-neutral-950 transition-all shadow-lg active:scale-[0.98] cursor-pointer"
            >
              <Send style={{ width: 16, height: 16 }} />
              <span>{t.applyButton}</span>
            </Link>
          ) : (
            <span
              style={{ minHeight: 48 }}
              className="flex-1 inline-flex items-center justify-center rounded-full bg-[#1c1e28] px-6 py-3.5 text-center text-sm font-medium text-neutral-500 cursor-not-allowed"
            >
              {t.cannotApply}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

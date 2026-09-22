"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Eye,
  Send,
  Star,
  Calendar,
  MapPin,
  Coins,
  Lock,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { type CampaignFeedCard as CampaignFeedCardType } from "@influx/contracts";
import { type CreatorCampaignLabels } from "./creator-campaign-labels";
import { TwitterVerifiedBadge } from "../search/TwitterVerifiedBadge";
import { NetworkIconBadge } from "../search/CreatorThemeVisuals";
import { getCampaignCoverImage } from "./CampaignVisuals";

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
      className={`group flex flex-col justify-between rounded-2xl border bg-surface-card shadow-sm hover:shadow-xl transition-all duration-200 overflow-hidden relative ${
        isClosed
          ? "border-border-subtle bg-surface-muted/40 opacity-80 grayscale-[20%]"
          : "border-border-default hover:border-border-strong"
      }`}
    >
      {/* 1. Photo de couverture normalisée avec hauteur fixe stricte (190px) */}
      <div
        style={{ height: 190, minHeight: 190, maxHeight: 190 }}
        className="relative w-full overflow-hidden bg-neutral-900 select-none shrink-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverUrl}
          alt={campaign.title}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center",
          }}
          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
        />

        {/* Gradient subtil pour la lisibilité des badges */}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/70 via-transparent to-neutral-950/40 pointer-events-none" />

        {/* Overlay haut gauche : Badge statut façon Malt exact */}
        <div className="absolute top-3 left-3 z-10">
          {isClosed ? (
            <div
              style={{ backdropFilter: "blur(8px)" }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-950/85 text-neutral-300 border border-neutral-700/80 shadow-md text-xs font-semibold"
            >
              <Lock
                style={{ width: 13, height: 13, minWidth: 13 }}
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
              style={{ backdropFilter: "blur(8px)" }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 shadow-md text-xs font-semibold"
            >
              <CheckCircle2
                style={{ width: 13, height: 13, minWidth: 13 }}
                className="text-emerald-400 shrink-0"
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
              style={{ backdropFilter: "blur(8px)" }}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-950/85 text-white border border-neutral-700/80 shadow-md text-xs font-semibold"
            >
              <span
                style={{ width: 8, height: 8, minWidth: 8, minHeight: 8 }}
                className="rounded-full bg-emerald-500 animate-pulse shrink-0"
              />
              <span>{t.openApplications}</span>
            </div>
          )}
        </div>

        {/* Overlay haut droit : Badge Audience vérifiée & Bouton favori */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          {campaign.verifiedOnly && (
            <div
              style={{ backdropFilter: "blur(8px)" }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/25 text-amber-300 border border-amber-500/40 text-[11px] font-semibold"
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
              width: 32,
              height: 32,
              minWidth: 32,
              minHeight: 32,
              backdropFilter: "blur(8px)",
            }}
            className="rounded-full bg-neutral-950/85 border border-neutral-700/80 flex items-center justify-center text-neutral-300 hover:text-amber-400 transition-colors shadow-sm cursor-pointer"
          >
            <Star
              style={{ width: 15, height: 15 }}
              className={isFavorite ? "fill-current text-amber-400" : ""}
            />
          </button>
        </div>
      </div>

      {/* 2. Corps de la carte : informations structurées sans superposition */}
      <div className="p-5 flex flex-col flex-1 gap-3.5">
        {/* En-tête marque : Logo (42px) + Nom marque + Badge Twitter + Rubans + Secteur */}
        <div className="flex items-center gap-3">
          <div
            style={{ width: 42, height: 42, minWidth: 42, minHeight: 42 }}
            className="rounded-xl border border-border-default bg-surface-raised shadow-xs flex items-center justify-center font-bold text-xs text-text-primary overflow-hidden shrink-0"
          >
            {campaign.brandLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={campaign.brandLogoUrl}
                alt={campaign.brandName}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span className="tracking-wider text-text-primary">
                {campaign.brandName.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm text-[#ff4d4d] tracking-tight truncate">
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

              <span
                className="text-xs select-none shrink-0"
                title="Marque auditée par INFLUX"
              >
                {"🎗️🎗️🎗️"}
              </span>
            </div>

            <p className="text-xs text-text-tertiary truncate mt-0.5">
              {campaign.brandSector}
              {campaign.brandCompanySize
                ? ` · ${campaign.brandCompanySize}`
                : ""}
            </p>
          </div>
        </div>

        {/* Titre de la campagne percutant */}
        <Link
          href={detailUrl}
          className="group/title block text-text-primary transition-colors hover:text-text-brand"
        >
          <h3 className="font-bold text-base leading-snug line-clamp-2">
            {campaign.title}
          </h3>
        </Link>

        {/* Thématiques hashtags */}
        <div className="flex flex-wrap gap-1.5">
          {campaign.targetTopics.map((topic) => (
            <span
              key={topic}
              className="rounded-full bg-surface-raised border border-border-subtle px-2.5 py-0.5 text-[11px] font-medium text-text-secondary"
            >
              #{topic}
            </span>
          ))}
        </div>

        {/* Livrables attendus en pills élégants */}
        <div className="rounded-xl bg-surface-raised/70 border border-border-subtle p-3">
          <span className="text-[11px] font-bold text-text-tertiary uppercase tracking-wider block mb-2">
            {t.deliverablesTitle}
          </span>
          <div className="flex flex-wrap gap-2">
            {campaign.deliverables.map((del, idx) => (
              <span
                key={`${del.network}-${del.format}-${idx}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-surface-card border border-border-subtle px-2.5 py-1 text-xs text-text-secondary"
              >
                <NetworkIconBadge
                  network={del.network}
                  size={15}
                  className="shrink-0"
                />
                <span className="text-text-primary font-semibold capitalize whitespace-nowrap">
                  {del.quantity}x {del.format.replace(/_/g, " ")}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Métriques financières & calendrier façon Malt */}
        <div className="space-y-2 pt-1">
          {/* Bloc Net créateur façon TJM Malt mis en avant */}
          <div className="rounded-xl bg-emerald-950/20 border border-emerald-500/20 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                style={{ width: 32, height: 32, minWidth: 32, minHeight: 32 }}
                className="rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0"
              >
                <Coins style={{ width: 16, height: 16 }} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                  {t.estimatedNetLabel}
                </span>
                <span className="font-extrabold text-sm text-[#00a884] dark:text-emerald-400 truncate block">
                  {campaign.estimatedNet
                    ? campaign.estimatedNet.formattedLabel
                    : formatCompensation()}
                </span>
              </div>
            </div>

            {campaign.estimatedNet && (
              <div className="text-right shrink-0">
                <span className="text-[10px] text-text-tertiary block">
                  Budget marque
                </span>
                <span className="text-xs font-semibold text-text-secondary block">
                  {formatCompensation()}
                </span>
              </div>
            )}
          </div>

          {/* Ligne date limite & localisation */}
          <div className="flex items-center justify-between text-xs text-text-tertiary px-1 pt-1">
            <div className="flex items-center gap-1.5 shrink-0">
              <Calendar
                style={{ width: 14, height: 14 }}
                className="text-text-tertiary shrink-0"
              />
              <span>
                {t.deadlineLabel}{" "}
                <strong className="text-text-secondary">
                  {new Date(campaign.applicationDeadline).toLocaleDateString(
                    locale,
                  )}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <MapPin
                style={{ width: 14, height: 14 }}
                className="text-text-tertiary shrink-0"
              />
              <span className="font-medium text-text-secondary">
                {campaign.targetCountries.join(", ") || "France"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Pied de carte & Boutons d'Action (RG46) */}
      <div className="p-5 pt-0 mt-auto space-y-3">
        {campaign.ineligibilityReasons.length > 0 && !campaign.hasApplied && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-300">
            <AlertCircle
              style={{ width: 15, height: 15, minWidth: 15 }}
              className="shrink-0 text-amber-400"
            />
            <span className="leading-snug">
              {campaign.ineligibilityReasons[0]}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Link
            href={detailUrl}
            style={{ minHeight: 38 }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border-default bg-surface-raised/40 hover:bg-surface-raised px-3 py-2 text-center text-xs font-semibold text-text-primary transition-all hover:border-border-strong shadow-xs"
          >
            <Eye style={{ width: 14, height: 14 }} />
            <span>{t.viewBriefButton}</span>
          </Link>

          {campaign.canApply ? (
            <Link
              href={detailUrl}
              style={{ minHeight: 38 }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#00a884] hover:bg-[#008f6f] px-3 py-2 text-center text-xs font-bold text-white transition-all shadow-sm hover:shadow-md cursor-pointer"
            >
              <Send style={{ width: 14, height: 14 }} />
              <span>{t.applyButton}</span>
            </Link>
          ) : (
            <span
              style={{ minHeight: 38 }}
              className="flex-1 inline-flex items-center justify-center rounded-xl bg-surface-raised/40 border border-border-subtle px-3 py-2 text-center text-xs font-medium text-text-disabled cursor-not-allowed"
            >
              {t.cannotApply}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

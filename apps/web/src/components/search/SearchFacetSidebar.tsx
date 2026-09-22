"use client";

import React, { useState } from "react";
import {
  SlidersHorizontal,
  RotateCcw,
  Compass,
  Share2,
  Users,
  TrendingUp,
  CreditCard,
  Globe,
  Layers,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import {
  type CreatorSearchFilters,
  type AudienceBand,
  type PriceBand,
  type SearchBadgeFilter,
  type CountryCode,
  type EngagementBand,
} from "@influx/contracts";
import { getSearchLabels } from "./search-labels";
import { NetworkIconBadge } from "./CreatorThemeVisuals";

export interface SearchFacetSidebarProps {
  filters: CreatorSearchFilters;
  onChange: (updatedFilters: CreatorSearchFilters) => void;
  onReset: () => void;
  onRequestTeamSelection: () => void;
  campaignId?: string;
  locale?: string;
}

export function SearchFacetSidebar({
  filters,
  onChange,
  onReset,
  onRequestTeamSelection,
  campaignId,
  locale = "fr",
}: SearchFacetSidebarProps) {
  const t = getSearchLabels(locale);
  const [bridging, setBridging] = useState(false);
  const [bridgeNotice, setBridgeNotice] = useState<string | null>(null);

  const handleTopicChange = (topic: string) => {
    onChange({
      ...filters,
      primaryTopic: topic || undefined,
    });
  };

  const handleNetworkToggle = (net: string) => {
    const current = filters.networks || [];
    const updated = current.includes(net)
      ? current.filter((n) => n !== net)
      : [...current, net];
    onChange({
      ...filters,
      networks: updated.length > 0 ? updated : undefined,
    });
  };

  const handleAudienceBandChange = (band: string) => {
    onChange({
      ...filters,
      audienceBand: (band || undefined) as AudienceBand | undefined,
    });
  };

  const handleEngagementBandChange = (band: string) => {
    onChange({
      ...filters,
      engagementBand: (band || undefined) as EngagementBand | undefined,
    });
  };

  const handleCountryChange = (country: string) => {
    onChange({
      ...filters,
      audienceCountry: (country || undefined) as CountryCode | undefined,
    });
  };

  const handleFormatToggle = (format: string) => {
    const current = filters.formats || [];
    const updated = current.includes(format)
      ? current.filter((f) => f !== format)
      : [...current, format];
    onChange({
      ...filters,
      formats: updated.length > 0 ? updated : undefined,
    });
  };

  const handlePriceBandChange = (band: string) => {
    onChange({
      ...filters,
      priceBand: (band || undefined) as PriceBand | undefined,
    });
  };

  const handleBadgeToggle = (badge: SearchBadgeFilter) => {
    const current = filters.badges || [];
    const updated = current.includes(badge)
      ? current.filter((b) => b !== badge)
      : [...current, badge];
    onChange({
      ...filters,
      badges: updated.length > 0 ? updated : undefined,
    });
  };

  // Pont Campagne (RG73, RG75)
  const handleApplyCampaignBridge = async () => {
    if (!campaignId) return;
    try {
      setBridging(true);
      const res = await fetch(`/api/search/campaign-bridge/${campaignId}`, {
        credentials: "include",
      });
      if (res.ok) {
        const bridgedFilters = await res.json();
        onChange({
          ...filters,
          ...bridgedFilters,
          campaignId,
        });
        setBridgeNotice(t.campaignBridgeApplied);
        setTimeout(() => setBridgeNotice(null), 3000);
      }
    } catch {
      // Silencieux
    } finally {
      setBridging(false);
    }
  };

  return (
    <aside
      aria-label={t.facets.title}
      className="bg-surface-card border border-border-default rounded-xl p-5 text-sm space-y-6 shadow-xs"
    >
      {/* En-tête des filtres avec icônes Lucide */}
      <div className="flex items-center justify-between pb-3.5 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-subtle-bg border border-brand-subtle-border flex items-center justify-center text-text-brand">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </div>
          <h3 className="font-bold text-text-primary text-sm tracking-tight">
            {t.facets.title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-text-tertiary hover:text-text-primary transition-colors flex items-center gap-1 cursor-pointer font-medium"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{t.resetFilters}</span>
        </button>
      </div>

      {/* Bouton Pont Campagne si campaignId est actif (RG73, RG75) */}
      {campaignId && (
        <div className="p-3.5 bg-brand-subtle-bg border border-brand-subtle-border rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-brand">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.filterByCampaign}</span>
          </div>
          <button
            type="button"
            disabled={bridging}
            onClick={handleApplyCampaignBridge}
            className="w-full py-2 px-3 bg-surface-card border border-border-selected rounded-lg text-xs font-semibold text-text-brand hover:bg-surface-raised transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span>
              {bridging ? "Chargement..." : "Pré-remplir depuis la campagne"}
            </span>
          </button>
          {bridgeNotice && (
            <p className="text-[11px] text-feedback-success-text font-medium">
              {"✓ "}
              {bridgeNotice}
            </p>
          )}
        </div>
      )}

      {/* 1. Thématique principale */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">
          <Compass className="w-3.5 h-3.5 text-text-tertiary" />
          <span>{t.facets.primaryTopic}</span>
        </label>
        <select
          value={filters.primaryTopic || ""}
          onChange={(e) => handleTopicChange(e.target.value)}
          className="w-full bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-text-primary text-xs focus:border-border-selected focus:outline-hidden transition-colors"
        >
          <option value="">{t.facets.allTopics}</option>
          {Object.entries(t.facets.topics).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Réseaux sociaux */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">
          <Share2 className="w-3.5 h-3.5 text-text-tertiary" />
          <span>{t.facets.networks}</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(t.facets.networkOptions).map(([key, label]) => {
            const isSelected = filters.networks?.includes(key);
            return (
              <button
                type="button"
                key={key}
                onClick={() => handleNetworkToggle(key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all border cursor-pointer ${
                  isSelected
                    ? "bg-action-primary-bg text-text-on-action font-semibold border-transparent shadow-xs"
                    : "bg-surface-raised text-text-secondary border-border-subtle hover:border-border-default hover:text-text-primary"
                }`}
              >
                <NetworkIconBadge
                  network={key}
                  className={`w-3 h-3 ${isSelected ? "text-text-on-action" : "text-text-tertiary"}`}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Taille d'audience */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">
          <Users className="w-3.5 h-3.5 text-text-tertiary" />
          <span>{t.facets.audienceBands}</span>
        </label>
        <select
          value={filters.audienceBand || ""}
          onChange={(e) => handleAudienceBandChange(e.target.value)}
          className="w-full bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-text-primary text-xs focus:border-border-selected focus:outline-hidden transition-colors"
        >
          <option value="">{t.facets.allAudienceBands}</option>
          {Object.entries(t.facets.audienceBandOptions).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* 4. Taux d'engagement certifié */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t.facets.engagementBands}</span>
        </label>
        <select
          value={filters.engagementBand || ""}
          onChange={(e) => handleEngagementBandChange(e.target.value)}
          className="w-full bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-text-primary text-xs focus:border-border-selected focus:outline-hidden transition-colors"
        >
          <option value="">{t.facets.allEngagementBands}</option>
          {Object.entries(t.facets.engagementBandOptions).map(
            ([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ),
          )}
        </select>
      </div>

      {/* 5. Fourchette budgétaire */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">
          <CreditCard className="w-3.5 h-3.5 text-text-tertiary" />
          <span>{t.facets.priceBands}</span>
        </label>
        <select
          value={filters.priceBand || ""}
          onChange={(e) => handlePriceBandChange(e.target.value)}
          className="w-full bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-text-primary text-xs focus:border-border-selected focus:outline-hidden transition-colors"
        >
          <option value="">{t.facets.allPriceBands}</option>
          {Object.entries(t.facets.priceBandOptions).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* 6. Pays principal d'audience */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">
          <Globe className="w-3.5 h-3.5 text-text-tertiary" />
          <span>{t.facets.audienceCountry}</span>
        </label>
        <select
          value={filters.audienceCountry || ""}
          onChange={(e) => handleCountryChange(e.target.value)}
          className="w-full bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-text-primary text-xs focus:border-border-selected focus:outline-hidden transition-colors"
        >
          <option value="">{t.facets.allCountries}</option>
          {Object.entries(t.facets.countries).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* 7. Formats de contenu */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">
          <Layers className="w-3.5 h-3.5 text-text-tertiary" />
          <span>{t.facets.formats}</span>
        </label>
        <div className="flex flex-col gap-2">
          {Object.entries(t.facets.formatOptions).map(([key, label]) => {
            const isSelected = filters.formats?.includes(key);
            return (
              <label
                key={key}
                className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer hover:text-text-primary transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isSelected || false}
                  onChange={() => handleFormatToggle(key)}
                  className="w-4 h-4 rounded border-border-default bg-surface-raised text-brand-primary focus:ring-0 cursor-pointer"
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 8. Badges de vérification */}
      <div className="space-y-2">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t.facets.badges}</span>
        </label>
        <div className="flex flex-col gap-2">
          {Object.entries(t.facets.badgeOptions).map(([key, label]) => {
            const isSelected = filters.badges?.includes(
              key as SearchBadgeFilter,
            );
            return (
              <label
                key={key}
                className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer hover:text-text-primary transition-colors"
              >
                <input
                  type="checkbox"
                  checked={isSelected || false}
                  onChange={() => handleBadgeToggle(key as SearchBadgeFilter)}
                  className="w-4 h-4 rounded border-border-default bg-surface-raised text-brand-primary focus:ring-0 cursor-pointer"
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 9. Carte d'assistance : Sélection personnalisée par l'équipe INFLUX (RG61) */}
      <div className="pt-4 border-t border-border-subtle">
        <div className="p-4 bg-gradient-to-br from-surface-raised to-surface-card border border-border-subtle rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-brand-subtle-bg border border-brand-subtle-border flex items-center justify-center text-text-brand">
              <Sparkles className="w-3 h-3" />
            </div>
            <span className="font-bold text-xs text-text-primary">
              {"Casting sur-mesure"}
            </span>
          </div>
          <p className="text-[11px] text-text-tertiary leading-relaxed">
            {
              "Besoin d'un profil très ciblé ? Nos agents INFLUX sélectionnent sous 24h les créateurs adaptés à votre brief."
            }
          </p>
          <button
            type="button"
            onClick={onRequestTeamSelection}
            className="w-full py-2 px-3 bg-surface-hover hover:bg-surface-raised border border-border-default hover:border-border-strong rounded-lg text-xs font-semibold text-text-primary transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <span>{"Confier ma recherche"}</span>
            <ArrowRight className="w-3 h-3 text-text-tertiary" />
          </button>
        </div>
      </div>
    </aside>
  );
}

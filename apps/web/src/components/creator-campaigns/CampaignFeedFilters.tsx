"use client";

import React from "react";
import {
  SlidersHorizontal,
  RotateCcw,
  Sparkles,
  Headphones,
  CheckCircle,
} from "lucide-react";
import { type CreatorCampaignLabels } from "./creator-campaign-labels";
import { TOPICS_META } from "./CampaignVisuals";
import { NetworkIconBadge } from "../search/CreatorThemeVisuals";

export interface FeedFilterState {
  topics: string[];
  networks: string[];
  formats: string[];
  targetCountries: string[];
  minCompensationMinor?: number;
  currency: string;
  compensationNatures: string[];
  onlyEligible: boolean;
  sortBy: "recent" | "deadline";
}

interface CampaignFeedFiltersProps {
  filters: FeedFilterState;
  onChange: (newFilters: FeedFilterState) => void;
  labels: CreatorCampaignLabels;
  totalResults: number;
  otherCurrencyCount: number;
}

const AVAILABLE_TOPICS = [
  "beaute",
  "mode",
  "tech",
  "gaming",
  "lifestyle",
  "fitness",
  "food",
  "voyage",
  "finance",
  "automobile",
];

const AVAILABLE_NETWORKS = ["instagram", "tiktok", "youtube", "linkedin"];

const AVAILABLE_FORMATS = [
  "reel",
  "story",
  "post",
  "video_dedicated",
  "video_integration",
  "carrousel",
];

const AVAILABLE_COUNTRIES = [
  { code: "FR", label: "France" },
  { code: "BE", label: "Belgique" },
  { code: "CH", label: "Suisse" },
  { code: "CA", label: "Canada" },
  { code: "US", label: "États-Unis" },
];

export function CampaignFeedFilters({
  filters,
  onChange,
  labels,
  totalResults: _totalResults,
  otherCurrencyCount,
}: CampaignFeedFiltersProps) {
  const { filters: t } = labels;

  const toggleArrayItem = (key: keyof FeedFilterState, value: string) => {
    const arr = (filters[key] as string[]) || [];
    const newArr = arr.includes(value)
      ? arr.filter((x) => x !== value)
      : [...arr, value];
    onChange({ ...filters, [key]: newArr });
  };

  const handleClearAll = () => {
    onChange({
      topics: [],
      networks: [],
      formats: [],
      targetCountries: [],
      minCompensationMinor: undefined,
      currency: "EUR",
      compensationNatures: [],
      onlyEligible: false,
      sortBy: "recent",
    });
  };

  const hasActiveFilters =
    filters.topics.length > 0 ||
    filters.networks.length > 0 ||
    filters.formats.length > 0 ||
    filters.targetCountries.length > 0 ||
    filters.minCompensationMinor != null ||
    filters.compensationNatures.length > 0 ||
    filters.onlyEligible;

  return (
    <aside className="bg-surface-card border border-border-default rounded-2xl p-5 space-y-6 shadow-sm">
      {/* 1. Entête filtres & Reset */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
          <SlidersHorizontal
            size={16}
            style={{ width: 16, height: 16 }}
            className="text-[#00a884] dark:text-emerald-400 shrink-0"
          />
          <span>{t.title}</span>
        </h3>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearAll}
            className="inline-flex items-center gap-1 text-xs text-text-brand hover:underline cursor-pointer font-medium"
          >
            <RotateCcw
              size={12}
              style={{ width: 12, height: 12 }}
              className="shrink-0"
            />
            <span>{t.clearAll}</span>
          </button>
        )}
      </div>

      {/* 2. Filtre C7 : Éligibilité directe (RG27) mis en vedette */}
      <div
        className={`rounded-xl border p-3.5 transition-all cursor-pointer ${
          filters.onlyEligible
            ? "border-emerald-500/40 bg-emerald-950/20 shadow-sm"
            : "border-border-default bg-surface-raised/40 hover:bg-surface-raised/70"
        }`}
        onClick={() =>
          onChange({ ...filters, onlyEligible: !filters.onlyEligible })
        }
      >
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.onlyEligible}
            onChange={(e) =>
              onChange({ ...filters, onlyEligible: e.target.checked })
            }
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 h-4 w-4 rounded border-border-default text-emerald-500 focus:ring-emerald-500 cursor-pointer"
          />
          <div>
            <span className="font-bold text-xs text-text-primary block flex items-center gap-1.5">
              <span>{t.onlyEligible}</span>
              {filters.onlyEligible && (
                <CheckCircle
                  size={14}
                  style={{ width: 14, height: 14 }}
                  className="text-emerald-400 shrink-0"
                />
              )}
            </span>
            <span className="text-[11px] text-text-tertiary block mt-1 leading-relaxed">
              {t.onlyEligibleHelp}
            </span>
          </div>
        </label>
      </div>

      {/* 3. Filtre C1 : Thématiques avec icônes graphiques */}
      <div className="space-y-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary block">
          {t.topic}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_TOPICS.map((topic) => {
            const active = filters.topics.includes(topic);
            const meta = TOPICS_META[topic];
            const Icon = meta?.icon || Sparkles;
            const label = meta?.label || topic;

            return (
              <button
                key={topic}
                type="button"
                onClick={() => toggleArrayItem("topics", topic)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer border ${
                  active
                    ? "bg-[#00a884] text-white border-transparent shadow-sm scale-102"
                    : "bg-surface-raised/70 text-text-secondary border-border-subtle hover:border-border-default hover:text-text-primary"
                }`}
              >
                <Icon
                  size={14}
                  style={{ width: 14, height: 14, minWidth: 14 }}
                  className={`shrink-0 ${active ? "text-white" : "text-text-tertiary"}`}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Filtre C2 : Réseaux sociaux avec icônes officielles */}
      <div className="space-y-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary block">
          {t.network}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_NETWORKS.map((net) => {
            const active = filters.networks.includes(net);
            return (
              <button
                key={net}
                type="button"
                onClick={() => toggleArrayItem("networks", net)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition-all cursor-pointer border ${
                  active
                    ? "bg-[#00a884] text-white border-transparent shadow-sm"
                    : "bg-surface-raised/70 text-text-secondary border-border-subtle hover:border-border-default hover:text-text-primary"
                }`}
              >
                <NetworkIconBadge
                  network={net}
                  className={`w-3.5 h-3.5 ${active ? "text-white" : "text-text-secondary"}`}
                />
                <span>{net}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Filtre C3 : Formats */}
      <div className="space-y-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary block">
          {t.format}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_FORMATS.map((fmt) => {
            const active = filters.formats.includes(fmt);
            return (
              <button
                key={fmt}
                type="button"
                onClick={() => toggleArrayItem("formats", fmt)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium capitalize transition-all cursor-pointer border ${
                  active
                    ? "bg-[#00a884] text-white border-transparent font-semibold shadow-sm"
                    : "bg-surface-raised/70 text-text-secondary border-border-subtle hover:border-border-default hover:text-text-primary"
                }`}
              >
                {fmt.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Filtre C4 : Pays d'audience */}
      <div className="space-y-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary block">
          {t.country}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {AVAILABLE_COUNTRIES.map((cnt) => {
            const active = filters.targetCountries.includes(cnt.code);
            return (
              <button
                key={cnt.code}
                type="button"
                onClick={() => toggleArrayItem("targetCountries", cnt.code)}
                className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all cursor-pointer border ${
                  active
                    ? "bg-[#00a884] text-white border-transparent font-semibold shadow-sm"
                    : "bg-surface-raised/70 text-text-secondary border-border-subtle hover:border-border-default hover:text-text-primary"
                }`}
              >
                {cnt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 7. Filtre C5 : Rémunération minimale & Devise (RG28) */}
      <div className="space-y-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary block">
          {t.minCompensation}
        </span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={50}
            placeholder="Ex : 500"
            value={
              filters.minCompensationMinor != null
                ? filters.minCompensationMinor / 100
                : ""
            }
            onChange={(e) => {
              const val = e.target.value
                ? Number.parseFloat(e.target.value) * 100
                : undefined;
              onChange({ ...filters, minCompensationMinor: val });
            }}
            className="w-full rounded-xl border border-border-default bg-surface-raised px-3 py-2 text-xs text-text-primary focus:border-[#00a884] focus:outline-hidden"
          />
          <select
            value={filters.currency}
            onChange={(e) => onChange({ ...filters, currency: e.target.value })}
            className="rounded-xl border border-border-default bg-surface-raised px-3 py-2 text-xs font-semibold text-text-primary focus:border-[#00a884] focus:outline-hidden cursor-pointer shrink-0"
          >
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($)</option>
            <option value="GBP">GBP (£)</option>
            <option value="CHF">CHF</option>
          </select>
        </div>
      </div>

      {/* 8. Filtre C6 : Nature de rémunération */}
      <div className="space-y-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary block">
          {t.compensationNature}
        </span>
        <div className="space-y-2">
          {Object.entries(t.natureOptions).map(([key, label]) => {
            const active = filters.compensationNatures.includes(key);
            return (
              <label
                key={key}
                className="flex items-center gap-2 cursor-pointer text-xs text-text-secondary hover:text-text-primary select-none"
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleArrayItem("compensationNatures", key)}
                  className="h-4 w-4 rounded border-border-default text-emerald-500 focus:ring-emerald-500"
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 9. Message campagnes dans une autre devise (RG28) */}
      {otherCurrencyCount > 0 && (
        <div className="rounded-xl border border-border-subtle bg-surface-raised p-3 text-xs text-text-tertiary">
          ℹ {t.otherCurrencyBanner(otherCurrencyCount)}
        </div>
      )}

      {/* 10. Encart d'assistance Influx façon Conciergerie Malt */}
      <div className="rounded-xl border border-border-default bg-surface-raised/50 p-4 space-y-2">
        <div className="flex items-center gap-2 text-emerald-400">
          <Headphones
            size={16}
            style={{ width: 16, height: 16 }}
            className="shrink-0"
          />
          <span className="font-bold text-xs text-text-primary">
            {t.assistanceTitle}
          </span>
        </div>
        <p className="text-[11px] text-text-tertiary leading-relaxed">
          {t.assistanceText}
        </p>
        <div className="pt-1 flex items-center justify-between text-[11px] text-emerald-400 font-semibold">
          <span>✓ Support 7j/7</span>
          <span className="text-text-tertiary font-normal">
            Réponse &lt; 2h
          </span>
        </div>
      </div>
    </aside>
  );
}

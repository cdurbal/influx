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
    <aside className="bg-[#14151c] rounded-3xl p-6 space-y-6 shadow-xl">
      {/* 1. Entête filtres & Reset sans bordure */}
      <div className="flex items-center justify-between pb-3">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <SlidersHorizontal
            size={16}
            style={{ width: 16, height: 16 }}
            className="text-[#00d68f] shrink-0"
          />
          <span>{t.title}</span>
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-[#00d68f] animate-pulse" />
          )}
        </h3>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearAll}
            className="inline-flex items-center gap-1.5 text-xs text-[#00d68f] hover:text-[#00c080] hover:underline cursor-pointer font-medium transition-colors"
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

      {/* 2. Filtre C7 : Éligibilité directe (RG27) mis en vedette façon Revolut */}
      <div
        className={`rounded-2xl p-4 transition-all cursor-pointer ${
          filters.onlyEligible ? "bg-[#00d68f]/15 shadow-md" : "bg-[#1c1e28] hover:bg-[#222532]"
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
            className="mt-0.5 h-4 w-4 rounded-md border-0 bg-white/[0.1] text-[#00d68f] focus:ring-[#00d68f] cursor-pointer"
          />
          <div>
            <span className="font-bold text-xs text-white block flex items-center gap-1.5">
              <span>{t.onlyEligible}</span>
              {filters.onlyEligible && (
                <CheckCircle
                  size={14}
                  style={{ width: 14, height: 14 }}
                  className="text-[#00d68f] shrink-0"
                />
              )}
            </span>
            <span className="text-[11px] text-neutral-400 block mt-1 leading-relaxed">
              {t.onlyEligibleHelp}
            </span>
          </div>
        </label>
      </div>

      {/* 3. Filtre C1 : Thématiques avec icônes graphiques */}
      <div className="space-y-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
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
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                  active
                    ? "bg-[#00d68f] text-neutral-950 font-bold shadow-md scale-102"
                    : "bg-[#1c1e28] hover:bg-[#242634] text-neutral-300 hover:text-white"
                }`}
              >
                <Icon
                  size={13}
                  style={{ width: 13, height: 13, minWidth: 13 }}
                  className={`shrink-0 ${active ? "text-neutral-950" : "text-neutral-400"}`}
                />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Filtre C2 : Réseaux sociaux avec icônes officielles */}
      <div className="space-y-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
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
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-all cursor-pointer ${
                  active
                    ? "bg-[#00d68f] text-neutral-950 font-bold shadow-md"
                    : "bg-[#1c1e28] hover:bg-[#242634] text-neutral-300 hover:text-white"
                }`}
              >
                <NetworkIconBadge
                  network={net}
                  className={`w-3.5 h-3.5 ${active ? "text-neutral-950" : "text-neutral-300"}`}
                />
                <span>{net}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Filtre C3 : Formats */}
      <div className="space-y-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
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
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium capitalize transition-all cursor-pointer ${
                  active
                    ? "bg-[#00d68f] text-neutral-950 font-bold shadow-md"
                    : "bg-[#1c1e28] hover:bg-[#242634] text-neutral-300 hover:text-white"
                }`}
              >
                {fmt.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Filtre C4 : Pays d'audience */}
      <div className="space-y-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
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
                className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                  active
                    ? "bg-[#00d68f] text-neutral-950 font-bold shadow-md"
                    : "bg-[#1c1e28] hover:bg-[#242634] text-neutral-300 hover:text-white"
                }`}
              >
                {cnt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 7. Filtre C5 : Rémunération minimale & Devise (RG28) */}
      <div className="space-y-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
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
            className="w-full rounded-2xl bg-[#1c1e28] px-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-hidden focus:ring-1 focus:ring-[#00d68f] transition-all border-0"
          />
          <select
            value={filters.currency}
            onChange={(e) => onChange({ ...filters, currency: e.target.value })}
            className="rounded-2xl bg-[#1c1e28] px-4 py-2.5 text-xs font-semibold text-white focus:outline-hidden focus:ring-1 focus:ring-[#00d68f] cursor-pointer shrink-0 border-0"
          >
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($)</option>
            <option value="GBP">GBP (£)</option>
            <option value="CHF">CHF</option>
          </select>
        </div>
      </div>

      {/* 8. Filtre C6 : Nature de rémunération */}
      <div className="space-y-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 block">
          {t.compensationNature}
        </span>
        <div className="space-y-2">
          {Object.entries(t.natureOptions).map(([key, label]) => {
            const active = filters.compensationNatures.includes(key);
            return (
              <label
                key={key}
                className="flex items-center gap-2.5 cursor-pointer text-xs text-neutral-300 hover:text-white select-none py-1"
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleArrayItem("compensationNatures", key)}
                  className="h-4 w-4 rounded-md border-0 bg-white/[0.1] text-[#00d68f] focus:ring-[#00d68f]"
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 9. Message campagnes dans une autre devise (RG28) */}
      {otherCurrencyCount > 0 && (
        <div className="rounded-2xl bg-[#1c1e28] p-3.5 text-xs text-neutral-400">
          ℹ {t.otherCurrencyBanner(otherCurrencyCount)}
        </div>
      )}

      {/* 10. Encart d'assistance Influx façon Revolut Concierge */}
      <div className="rounded-2xl bg-[#1c1e28] p-4 space-y-2">
        <div className="flex items-center gap-2 text-[#00d68f]">
          <Headphones
            size={16}
            style={{ width: 16, height: 16 }}
            className="shrink-0"
          />
          <span className="font-bold text-xs text-white">
            {t.assistanceTitle}
          </span>
        </div>
        <p className="text-[11px] text-neutral-400 leading-relaxed">
          {t.assistanceText}
        </p>
        <div className="pt-1 flex items-center justify-between text-[11px] text-[#00d68f] font-semibold">
          <span>✓ Support 7j/7</span>
          <span className="text-neutral-400 font-normal">
            Réponse &lt; 2h
          </span>
        </div>
      </div>
    </aside>
  );
}

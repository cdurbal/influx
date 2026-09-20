import React from "react";
import { type CreatorCampaignLabels } from "./creator-campaign-labels";

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
    <aside className="bg-surface-card border border-border-default rounded-xl p-5 space-y-6">
      {/* 1. Entête filtres & Reset */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <h3 className="font-bold text-text-primary text-sm flex items-center gap-2">
          <span>⚡</span>
          <span>{t.title}</span>
        </h3>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearAll}
            className="text-xs text-text-brand hover:underline cursor-pointer font-medium"
          >
            {t.clearAll}
          </button>
        )}
      </div>

      {/* 2. Filtre C7 : Éligibilité directe (RG27) */}
      <div className="rounded-lg border border-brand-subtle-border bg-brand-subtle-bg p-3">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.onlyEligible}
            onChange={(e) =>
              onChange({ ...filters, onlyEligible: e.target.checked })
            }
            className="mt-0.5 h-4 w-4 rounded border-border-default text-brand-primary focus:ring-brand-primary"
          />
          <div>
            <span className="font-semibold text-xs text-text-primary block">
              {t.onlyEligible}
            </span>
            <span className="text-xs text-text-tertiary block mt-0.5 leading-normal">
              {t.onlyEligibleHelp}
            </span>
          </div>
        </label>
      </div>

      {/* 3. Filtre C1 : Thématiques */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary block">
          {t.topic}
        </span>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_TOPICS.map((topic) => {
            const active = filters.topics.includes(topic);
            return (
              <button
                key={topic}
                type="button"
                onClick={() => toggleArrayItem("topics", topic)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer border ${
                  active
                    ? "bg-action-primary-bg text-text-on-action font-semibold border-transparent"
                    : "bg-surface-raised text-text-secondary border-border-subtle hover:border-border-default"
                }`}
              >
                {topic}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Filtre C2 : Réseaux */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary block">
          {t.network}
        </span>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_NETWORKS.map((net) => {
            const active = filters.networks.includes(net);
            return (
              <button
                key={net}
                type="button"
                onClick={() => toggleArrayItem("networks", net)}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors cursor-pointer border ${
                  active
                    ? "bg-action-primary-bg text-text-on-action font-semibold border-transparent"
                    : "bg-surface-raised text-text-secondary border-border-subtle hover:border-border-default"
                }`}
              >
                {net}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Filtre C3 : Formats */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary block">
          {t.format}
        </span>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_FORMATS.map((fmt) => {
            const active = filters.formats.includes(fmt);
            return (
              <button
                key={fmt}
                type="button"
                onClick={() => toggleArrayItem("formats", fmt)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer border ${
                  active
                    ? "bg-action-primary-bg text-text-on-action font-semibold border-transparent"
                    : "bg-surface-raised text-text-secondary border-border-subtle hover:border-border-default"
                }`}
              >
                {fmt}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6. Filtre C4 : Pays d'audience */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary block">
          {t.country}
        </span>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_COUNTRIES.map((cnt) => {
            const active = filters.targetCountries.includes(cnt.code);
            return (
              <button
                key={cnt.code}
                type="button"
                onClick={() => toggleArrayItem("targetCountries", cnt.code)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer border ${
                  active
                    ? "bg-action-primary-bg text-text-on-action font-semibold border-transparent"
                    : "bg-surface-raised text-text-secondary border-border-subtle hover:border-border-default"
                }`}
              >
                {cnt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 7. Filtre C5 : Rémunération minimale & Devise (RG28) */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary block">
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
            className="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-xs text-text-primary focus:border-border-selected focus:outline-hidden"
          />
          <select
            value={filters.currency}
            onChange={(e) => onChange({ ...filters, currency: e.target.value })}
            className="rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-xs font-medium text-text-primary focus:border-border-selected focus:outline-hidden cursor-pointer"
          >
            <option value="EUR">EUR (€)</option>
            <option value="USD">USD ($)</option>
            <option value="GBP">GBP (£)</option>
            <option value="CHF">CHF</option>
          </select>
        </div>
      </div>

      {/* 8. Filtre C6 : Nature de rémunération */}
      <div className="space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary block">
          {t.compensationNature}
        </span>
        <div className="space-y-2">
          {Object.entries(t.natureOptions).map(([key, label]) => {
            const active = filters.compensationNatures.includes(key);
            return (
              <label
                key={key}
                className="flex items-center gap-2 cursor-pointer text-xs text-text-secondary hover:text-text-primary"
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => toggleArrayItem("compensationNatures", key)}
                  className="h-4 w-4 rounded border-border-default text-brand-primary focus:ring-brand-primary"
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* 9. Message campagnes dans une autre devise (RG28) */}
      {otherCurrencyCount > 0 && (
        <div className="rounded-lg border border-border-subtle bg-surface-raised p-3 text-xs text-text-tertiary">
          ℹ {t.otherCurrencyBanner(otherCurrencyCount)}
        </div>
      )}
    </aside>
  );
}

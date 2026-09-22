"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpDown } from "lucide-react";
import { type CampaignFeedResponse } from "@influx/contracts";
import {
  getCreatorCampaignLabels,
  type CreatorCampaignLabels,
} from "./creator-campaign-labels";
import { CampaignFeedCard } from "./CampaignFeedCard";
import {
  CampaignFeedFilters,
  type FeedFilterState,
} from "./CampaignFeedFilters";

interface CampaignFeedProps {
  locale: string;
}

export function CampaignFeed({ locale }: CampaignFeedProps) {
  const labels: CreatorCampaignLabels = getCreatorCampaignLabels(locale);
  const { feed: t, sort: s } = labels;

  const searchParams = useSearchParams();

  const [filters, setFilters] = useState<FeedFilterState>({
    topics: searchParams.get("topics")
      ? searchParams.get("topics")!.split(",")
      : [],
    networks: searchParams.get("networks")
      ? searchParams.get("networks")!.split(",")
      : [],
    formats: searchParams.get("formats")
      ? searchParams.get("formats")!.split(",")
      : [],
    targetCountries: searchParams.get("countries")
      ? searchParams.get("countries")!.split(",")
      : [],
    minCompensationMinor: searchParams.get("minComp")
      ? Number.parseInt(searchParams.get("minComp")!, 10)
      : undefined,
    currency: searchParams.get("currency") || "EUR",
    compensationNatures: searchParams.get("natures")
      ? searchParams.get("natures")!.split(",")
      : [],
    onlyEligible: searchParams.get("onlyEligible") === "true",
    sortBy: (searchParams.get("sort") as "recent" | "deadline") || "recent",
  });

  const [page, setPage] = useState<number>(
    searchParams.get("page")
      ? Number.parseInt(searchParams.get("page")!, 10)
      : 1,
  );

  const [feedData, setFeedData] = useState<CampaignFeedResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [authNeeded, setAuthNeeded] = useState<boolean>(false);
  const [demoLoggingIn, setDemoLoggingIn] = useState<boolean>(false);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAuthNeeded(false);

    try {
      const q = new URLSearchParams();
      if (filters.topics.length > 0) q.set("topics", filters.topics.join(","));
      if (filters.networks.length > 0)
        q.set("networks", filters.networks.join(","));
      if (filters.formats.length > 0)
        q.set("formats", filters.formats.join(","));
      if (filters.targetCountries.length > 0)
        q.set("targetCountries", filters.targetCountries.join(","));
      if (filters.minCompensationMinor != null) {
        q.set("minCompensationMinor", String(filters.minCompensationMinor));
        q.set("currency", filters.currency);
      }
      if (filters.compensationNatures.length > 0)
        q.set("compensationNatures", filters.compensationNatures.join(","));
      if (filters.onlyEligible) q.set("onlyEligible", "true");
      if (filters.sortBy) q.set("sortBy", filters.sortBy);
      q.set("page", String(page));
      q.set("limit", "12");

      const res = await fetch(`/api/campaigns/feed?${q.toString()}`, {
        credentials: "include",
      });

      if (res.status === 401 || res.status === 403) {
        setAuthNeeded(true);
        setFeedData(null);
        return;
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Erreur serveur (${res.status})`);
      }

      const data: CampaignFeedResponse = await res.json();
      setFeedData(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur de chargement des campagnes",
      );
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  const handleDemoLogin = async () => {
    setDemoLoggingIn(true);
    try {
      // 1. Send OTP for Lucas
      await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "lucas@lucastech.fr",
          role: "creator",
        }),
      });

      // 2. Verify OTP
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: "lucas@lucastech.fr",
          code: "123456",
        }),
      });

      if (res.ok) {
        setAuthNeeded(false);
        fetchFeed();
      }
    } catch {
      // Silencieux
    } finally {
      setDemoLoggingIn(false);
    }
  };

  const handleFilterChange = (newFilters: FeedFilterState) => {
    setFilters(newFilters);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Bandeau d'authentification démo si nécessaire */}
      {authNeeded && (
        <div className="rounded-3xl bg-[#14151c] p-6 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-white text-md">
              Accès réservé aux créateurs (RG13)
            </h3>
            <p className="text-sm text-neutral-400 mt-1">{t.loginNotice}</p>
          </div>
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={demoLoggingIn}
            className="shrink-0 rounded-full bg-[#00d68f] hover:bg-[#00c080] px-5 py-2.5 text-xs font-bold text-neutral-950 transition-colors cursor-pointer"
          >
            {demoLoggingIn ? "Connexion..." : t.demoLoginButton}
          </button>
        </div>
      )}

      {/* Disposition principale : Filtres à gauche (1 col) + Grille de campagnes (3 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        {/* Colonne latérale de filtres */}
        <div className="lg:col-span-1">
          <CampaignFeedFilters
            filters={filters}
            onChange={handleFilterChange}
            labels={labels}
            totalResults={feedData?.total || 0}
            otherCurrencyCount={feedData?.otherCurrencyCampaignsCount || 0}
          />
        </div>

        {/* Colonne principale avec barre de tri et résultats */}
        <div className="lg:col-span-3 space-y-6">
          {/* Barre de contrôle supérieure : Décompte et Tri façon Revolut sans contour */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-[#14151c] rounded-3xl shadow-xl">
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-sm text-white">
                {feedData ? t.totalCount(feedData.total) : "—"}
              </span>
            </div>

            <div className="flex items-center gap-2.5 text-xs">
              <label
                htmlFor="feed-sort"
                className="font-medium text-neutral-400 flex items-center gap-1.5"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
                <span>{s.label}</span>
              </label>
              <select
                id="feed-sort"
                value={filters.sortBy}
                onChange={(e) =>
                  handleFilterChange({
                    ...filters,
                    sortBy: e.target.value as "recent" | "deadline",
                  })
                }
                className="rounded-2xl bg-[#1c1e28] px-4 py-2 text-xs font-semibold text-white focus:outline-hidden focus:ring-1 focus:ring-[#00d68f] cursor-pointer shadow-xs border-0"
              >
                <option value="recent">{s.recent}</option>
                <option value="deadline">{s.deadline}</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="rounded-3xl bg-[#14151c] p-14 text-center text-neutral-400 shadow-xl">
              <span className="text-2xl block mb-2">⏳</span>
              <p className="text-sm font-medium">{t.loadingText}</p>
            </div>
          ) : error ? (
            <div className="rounded-3xl bg-red-950/20 p-6 text-center text-red-300">
              <p className="text-sm font-medium">{error}</p>
              <button
                type="button"
                onClick={fetchFeed}
                className="mt-3 rounded-full bg-[#1c1e28] hover:bg-[#252836] px-4 py-2 text-xs font-semibold text-white cursor-pointer transition-colors"
              >
                Réessayer
              </button>
            </div>
          ) : feedData && feedData.items.length > 0 ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {feedData.items.map((campaign) => (
                  <CampaignFeedCard
                    key={campaign.id}
                    campaign={campaign}
                    labels={labels}
                    locale={locale}
                  />
                ))}
              </div>

              {/* Pagination explicite sans contour */}
              {feedData.totalPages > 1 && (
                <div className="flex items-center justify-between pt-6">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-full bg-[#14151c] hover:bg-[#1c1e28] px-5 py-2.5 text-xs font-semibold text-neutral-200 transition-colors disabled:opacity-40 cursor-pointer shadow-md"
                  >
                    ← Précédent
                  </button>
                  <span className="text-xs text-neutral-400 font-medium">
                    Page {feedData.page} sur {feedData.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= feedData.totalPages}
                    onClick={() =>
                      setPage((p) => Math.min(feedData.totalPages, p + 1))
                    }
                    className="rounded-full bg-[#14151c] hover:bg-[#1c1e28] px-5 py-2.5 text-xs font-semibold text-neutral-200 transition-colors disabled:opacity-40 cursor-pointer shadow-md"
                  >
                    Suivant →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-3xl bg-[#14151c] p-14 text-center shadow-xl">
              <span className="text-3xl block mb-3">🔍</span>
              <h4 className="font-bold text-white text-base">
                {t.emptyTitle}
              </h4>
              <p className="mt-1.5 text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
                {t.emptyMessage}
              </p>
              <button
                type="button"
                onClick={() =>
                  handleFilterChange({
                    topics: [],
                    networks: [],
                    formats: [],
                    targetCountries: [],
                    minCompensationMinor: undefined,
                    currency: "EUR",
                    compensationNatures: [],
                    onlyEligible: false,
                    sortBy: "recent",
                  })
                }
                className="mt-5 rounded-full bg-[#1c1e28] hover:bg-[#252836] px-5 py-2.5 text-xs font-bold text-white transition-all cursor-pointer shadow-md"
              >
                {t.clearFilters}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  DealKanbanBoard,
  type DealWithStats,
} from "@/components/deals/DealKanbanBoard";
import { DealDetailDrawer } from "@/components/deals/DealDetailDrawer";
import { authFetch } from "@/lib/api-client";

export default function DealsPage() {
  const [deals, setDeals] = useState<DealWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("ALL");
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  const fetchDeals = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const url =
        selectedCurrency && selectedCurrency !== "ALL"
          ? `/api/backoffice/deals?currency=${selectedCurrency}`
          : "/api/backoffice/deals";

      const res = await authFetch(url);
      if (!res.ok) {
        throw new Error("Impossible de charger les affaires");
      }
      const data = await res.json();
      setDeals(data.deals || []);
    } catch (err: any) {
      setError(err.message || "Erreur réseau");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCurrency]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-full">
      {/* En-tête de page Linear style */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[rgba(255,255,255,0.07)] gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.12)] text-[#4ade80] border border-[rgba(34,197,94,0.25)]">
              Pipeline Commercial
            </span>
            <span className="text-xs text-[#8a8f98]">· 7 Colonnes · Doc 14</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Pipeline des Affaires &amp; Encaissements
          </h1>
          <p className="text-xs text-[#8a8f98] mt-1 max-w-2xl">
            Suivi visuel des transactions issues des révélations d&apos;identité. Saisie manuelle stricte des commissions (règle A1) et rapprochement des paiements reçus.
          </p>
        </div>

        {/* Filtres rapides */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[rgba(255,255,255,0.03)] px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.08)]">
            <span className="text-xs text-[#8a8f98]">Devise :</span>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="bg-[#0b0c0f] border border-[rgba(255,255,255,0.1)] rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#22c55e]"
            >
              <option value="ALL">Toutes devises</option>
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="CAD">CAD ($)</option>
              <option value="GBP">GBP (£)</option>
              <option value="BRL">BRL (R$)</option>
            </select>
          </div>

          <button
            onClick={() => fetchDeals(true)}
            disabled={refreshing || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.12)] rounded-lg text-xs font-medium text-white transition-all cursor-pointer shadow-xs disabled:opacity-50"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={refreshing ? "animate-spin text-[#22c55e]" : ""}
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            <span>{refreshing ? "Chargement..." : "Actualiser"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[rgba(239,68,68,0.1)] text-[#fca5a5] border border-[rgba(239,68,68,0.25)] rounded-xl text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-[#8a8f98] text-xs flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-[rgba(255,255,255,0.2)] border-t-[#22c55e] rounded-full animate-spin" />
          <span>Chargement du pipeline commercial...</span>
        </div>
      ) : (
        <DealKanbanBoard
          deals={deals}
          onSelectDeal={(dealId) => setSelectedDealId(dealId)}
        />
      )}

      {/* Tiroir d'édition du deal */}
      <DealDetailDrawer
        dealId={selectedDealId}
        isOpen={Boolean(selectedDealId)}
        onClose={() => setSelectedDealId(null)}
        onDealUpdated={() => {
          fetchDeals();
        }}
      />
    </div>
  );
}

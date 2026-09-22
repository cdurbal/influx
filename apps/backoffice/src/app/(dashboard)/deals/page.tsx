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
  const [error, setError] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<string>("ALL");
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);

  const fetchDeals = useCallback(async () => {
    setLoading(true);
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
    }
  }, [selectedCurrency]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  return (
    <div className="p-6 space-y-6">
      {/* En-tête de page */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Pipeline Commercial des Affaires
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Suivi des affaires issues des révélations d'identité, montants
            négociés et encaissements réels (Doc 14).
          </p>
        </div>

        {/* Filtres rapides */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">Devise :</span>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="bg-surface-elevated border border-border-subtle rounded-md px-2.5 py-1 text-xs text-text-primary focus:outline-hidden"
            >
              <option value="ALL">Toutes les devises</option>
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="CAD">CAD ($)</option>
              <option value="GBP">GBP (£)</option>
              <option value="BRL">BRL (R$)</option>
            </select>
          </div>

          <button
            onClick={() => fetchDeals()}
            className="px-3 py-1 bg-surface-elevated hover:bg-surface-hover border border-border-subtle rounded-md text-xs font-medium text-text-primary transition-colors"
          >
            Actualiser
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-feedback-error-bg text-feedback-error-text border border-feedback-error-border rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-text-secondary text-sm">
          Chargement du pipeline commercial...
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

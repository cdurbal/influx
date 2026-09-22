"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { authFetch } from "@/lib/api-client";

export default function DashboardPage() {
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchKpis = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await authFetch("/api/backoffice/dashboard/kpis");
      if (!res.ok) {
        throw new Error(
          "Impossible de charger les métriques du tableau de bord",
        );
      }
      const data = await res.json();
      setKpis(data);
    } catch (err: any) {
      setError(err.message || "Erreur réseau");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  const formattedTime = kpis?.timestamp
    ? new Date(kpis.timestamp).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "";

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 relative">
      {/* Halo d'ambiance supérieur Linear */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-[rgba(94,106,210,0.12)] via-[rgba(34,197,94,0.05)] to-transparent blur-3xl -z-10"
      />

      {/* En-tête exécutif avec mention "Arrêté à {heure}" (CA1 & RG18) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-[rgba(255,255,255,0.07)] gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.12)] text-[#4ade80] border border-[rgba(34,197,94,0.25)]">
              Executive View
            </span>
            <span className="text-xs text-[#8a8f98]">
              · D37 &amp; AAL2 Conforme
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Tableau de Bord de Pilotage
          </h1>
          <p className="text-xs text-[#8a8f98] mt-1 max-w-2xl">
            Supervision opérationnelle en temps réel, encaissements des
            commissions réelles et monitoring strict des engagements SLA.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {formattedTime && (
            <div className="flex items-center gap-1.5 text-xs text-[#8a8f98] font-mono bg-[rgba(255,255,255,0.03)] px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.08)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
              <span>Arrêté à {formattedTime}</span>
            </div>
          )}

          <button
            onClick={() => fetchKpis(true)}
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
            <span>{refreshing ? "Actualisation..." : "Actualiser"}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-[rgba(239,68,68,0.1)] text-[#fca5a5] border border-[rgba(239,68,68,0.25)] rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>⚠</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchKpis()}
            className="underline hover:text-white cursor-pointer"
          >
            Réessayer
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-[#8a8f98] text-xs flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-[rgba(255,255,255,0.2)] border-t-[#22c55e] rounded-full animate-spin" />
          <span>
            Calcul et rapprochement cryptographique des métriques de pilotage...
          </span>
        </div>
      ) : kpis ? (
        <div className="space-y-8">
          {/* Cartes KPI & Volumes */}
          <KpiCards
            commissionsByCurrency={kpis.commissionsByCurrency || {}}
            activeDealsByAgent={kpis.activeDealsByAgent || []}
            summaryMetrics={kpis.summaryMetrics}
          />

          {/* Alertes SLA actives avec accès direct (CA2 & RG18) */}
          <div className="bg-[rgba(18,19,24,0.85)] border border-[rgba(255,255,255,0.08)] rounded-xl p-5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider">
                  Surveillance des Engagements SLA
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-[rgba(255,255,255,0.05)] text-[#8a8f98] border border-[rgba(255,255,255,0.08)]">
                  {kpis.slaAlerts?.length || 0} active(s)
                </span>
              </div>
              <span className="text-[11px] text-[#8a8f98]">
                Signalement textuel obligatoire (RG18)
              </span>
            </div>

            {kpis.slaAlerts && kpis.slaAlerts.length > 0 ? (
              <div className="space-y-2.5">
                {kpis.slaAlerts.map((alert: any) => {
                  let targetHref = "/queues/verification";
                  if (alert.type === "campaign")
                    targetHref = "/queues/campaigns";
                  if (alert.type === "introduction")
                    targetHref = "/queues/introductions";

                  return (
                    <div
                      key={alert.id}
                      className="bg-[rgba(245,158,11,0.06)] border border-[rgba(245,158,11,0.25)] p-3.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-[#fbbf24] bg-[rgba(245,158,11,0.15)] border border-[rgba(245,158,11,0.3)] px-2 py-0.5 rounded text-[11px] shrink-0">
                          ⚑ hors délai
                        </span>
                        <div>
                          <span className="font-medium text-white">
                            [{alert.type.toUpperCase()}] {alert.reference}
                          </span>
                          <span className="text-[#fbbf24] ml-2 font-mono text-[11px]">
                            (Retard : {alert.overdueHours}h au-delà du SLA)
                          </span>
                        </div>
                      </div>

                      <Link
                        href={targetHref}
                        className="self-end sm:self-center px-3 py-1 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.12)] border border-[rgba(255,255,255,0.12)] rounded-md text-[11px] font-medium text-white transition-colors flex items-center gap-1.5 shrink-0"
                      >
                        <span>Traiter la file</span>
                        <span>→</span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-[rgba(34,197,94,0.05)] border border-[rgba(34,197,94,0.2)] text-xs text-[#4ade80] flex items-center gap-2">
                <span className="text-base">✓</span>
                <span>
                  Tous les délais opérationnels sont scrupuleusement respectés.
                  Aucune alerte active dans les 16 files.
                </span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

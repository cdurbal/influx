"use client";

import React from "react";
import Link from "next/link";

export interface KpiCardsProps {
  commissionsByCurrency: Record<
    string,
    {
      totalMinor: number;
      formatted: string;
      receiptsCount: number;
    }
  >;
  activeDealsByAgent: Array<{
    agentId: string;
    agentName: string;
    activeDealsCount: number;
  }>;
  summaryMetrics: {
    activeDealsCount: number;
    pendingVerificationsCount: number;
    pendingCampaignsCount: number;
    pendingIntroductionsCount: number;
    totalSlaBreachesCount: number;
  };
}

export function KpiCards({
  commissionsByCurrency,
  activeDealsByAgent,
  summaryMetrics,
}: KpiCardsProps) {
  const currencyList = Object.entries(commissionsByCurrency);

  return (
    <div className="space-y-6">
      {/* 1. Commissions encaissées (strictement par devise - Invariant A1 & CA4) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider flex items-center gap-2">
            <span>Commissions Encaissées Réelles</span>
            <span className="text-[10px] lowercase text-[#52525b] font-normal">
              (isolées par devise · règle A1)
            </span>
          </h2>
          <span className="text-[11px] text-[#4ade80] font-medium bg-[rgba(34,197,94,0.1)] px-2 py-0.5 rounded-full border border-[rgba(34,197,94,0.25)]">
            Encaissé &amp; Rapproché
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {currencyList.length > 0 ? (
            currencyList.map(([curr, data]) => (
              <div
                key={curr}
                className="relative bg-[rgba(18,19,24,0.85)] border border-[rgba(255,255,255,0.08)] p-5 rounded-xl shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)] overflow-hidden group hover:border-[rgba(255,255,255,0.16)] transition-all"
              >
                {/* Ligne lumineuse supérieure */}
                <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-[rgba(34,197,94,0.4)] to-transparent" />

                <div className="flex items-center justify-between text-xs text-[#8a8f98]">
                  <span className="uppercase font-medium tracking-wide">
                    Total {curr}
                  </span>
                  <span className="w-2 h-2 rounded-full bg-[#22c55e] shadow-[0_0_6px_#22c55e]" />
                </div>

                <div className="text-2xl font-bold text-white tracking-tight mt-2 font-mono">
                  {data.formatted}
                </div>

                <div className="text-xs text-[#8a8f98] mt-2 flex items-center justify-between pt-2 border-t border-[rgba(255,255,255,0.06)]">
                  <span>{data.receiptsCount} encaissement(s)</span>
                  <span className="text-[#4ade80] font-mono font-medium">
                    100% rapproché
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full bg-[rgba(18,19,24,0.85)] border border-[rgba(255,255,255,0.08)] p-6 rounded-xl text-xs text-[#8a8f98] italic text-center">
              Aucun encaissement de commission enregistré pour le moment.
            </div>
          )}
        </div>
      </div>

      {/* 2. Vue Synthétique : Raccourcis opérationnels & Files */}
      <div>
        <h2 className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider mb-3">
          Opérations &amp; Volumes Actifs
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Affaires actives */}
          <Link
            href="/deals"
            className="group relative bg-[rgba(18,19,24,0.85)] hover:bg-[rgba(26,28,35,0.95)] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(34,197,94,0.4)] p-5 rounded-xl transition-all block shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center justify-between text-xs text-[#8a8f98] group-hover:text-white transition-colors">
              <span className="uppercase font-medium tracking-wider">
                Affaires en cours
              </span>
              <span className="text-xs group-hover:translate-x-0.5 transition-transform text-[#22c55e]">
                →
              </span>
            </div>
            <div className="text-3xl font-bold text-white mt-2 group-hover:text-[#4ade80] transition-colors">
              {summaryMetrics.activeDealsCount}
            </div>
            <div className="text-xs text-[#8a8f98] mt-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              <span>Pipeline Kanban actif</span>
            </div>
          </Link>

          {/* Campagnes à valider */}
          <Link
            href="/queues/campaigns"
            className="group relative bg-[rgba(18,19,24,0.85)] hover:bg-[rgba(26,28,35,0.95)] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(245,158,11,0.4)] p-5 rounded-xl transition-all block shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center justify-between text-xs text-[#8a8f98] group-hover:text-white transition-colors">
              <span className="uppercase font-medium tracking-wider">
                Campagnes à modérer
              </span>
              <span className="text-xs group-hover:translate-x-0.5 transition-transform text-[#fbbf24]">
                →
              </span>
            </div>
            <div className="text-3xl font-bold text-white mt-2 group-hover:text-[#fbbf24] transition-colors">
              {summaryMetrics.pendingCampaignsCount}
            </div>
            <div className="text-xs text-[#8a8f98] mt-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />
              <span>File 7 · Modération commerciale</span>
            </div>
          </Link>

          {/* Mises en relation */}
          <Link
            href="/queues/introductions"
            className="group relative bg-[rgba(18,19,24,0.85)] hover:bg-[rgba(26,28,35,0.95)] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(34,197,94,0.4)] p-5 rounded-xl transition-all block shadow-[0_4px_20px_rgba(0,0,0,0.5)]"
          >
            <div className="flex items-center justify-between text-xs text-[#8a8f98] group-hover:text-white transition-colors">
              <span className="uppercase font-medium tracking-wider">
                Mises en relation
              </span>
              <span className="text-xs group-hover:translate-x-0.5 transition-transform text-[#22c55e]">
                →
              </span>
            </div>
            <div className="text-3xl font-bold text-white mt-2 group-hover:text-[#4ade80] transition-colors">
              {summaryMetrics.pendingIntroductionsCount}
            </div>
            <div className="text-xs text-[#8a8f98] mt-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              <span>File 8 · Prioritaire CA</span>
            </div>
          </Link>

          {/* Dépassements SLA */}
          <div
            className={`relative p-5 rounded-xl border transition-all shadow-[0_4px_20px_rgba(0,0,0,0.5)] ${
              summaryMetrics.totalSlaBreachesCount > 0
                ? "bg-[rgba(245,158,11,0.08)] border-[rgba(245,158,11,0.3)] text-[#fbbf24]"
                : "bg-[rgba(18,19,24,0.85)] border-[rgba(255,255,255,0.08)] text-[#8a8f98]"
            }`}
          >
            <div className="flex items-center justify-between text-xs uppercase font-medium tracking-wider">
              <span>Dépassements SLA</span>
              {summaryMetrics.totalSlaBreachesCount > 0 ? (
                <span className="text-xs">⚑</span>
              ) : (
                <span className="text-[#4ade80]">✓</span>
              )}
            </div>
            <div className="text-3xl font-bold mt-2 text-white">
              {summaryMetrics.totalSlaBreachesCount}
            </div>
            <div className="text-xs mt-2 flex items-center gap-1.5">
              {summaryMetrics.totalSlaBreachesCount > 0 ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-ping" />
                  <span className="text-[#fbbf24] font-medium">
                    Attention requise immédiate
                  </span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                  <span className="text-[#4ade80]">
                    100% dans les délais impartis
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Répartition des affaires actives par commercial */}
      <div className="bg-[rgba(18,19,24,0.85)] border border-[rgba(255,255,255,0.08)] rounded-xl p-5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-[#8a8f98] uppercase tracking-wider">
            Portefeuille Commercial Actif (Attribution)
          </h3>
          <span className="text-[11px] text-[#8a8f98]">
            {activeDealsByAgent.length} collaborateur(s) actif(s)
          </span>
        </div>

        {activeDealsByAgent.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {activeDealsByAgent.map((agent) => (
              <div
                key={agent.agentId}
                className="bg-[rgba(255,255,255,0.03)] hover:bg-[rgba(255,255,255,0.06)] p-3.5 rounded-lg border border-[rgba(255,255,255,0.06)] flex justify-between items-center transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#059669] to-[#047857] text-white flex items-center justify-center font-bold text-xs shadow-xs border border-[rgba(255,255,255,0.1)]">
                    {agent.agentName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <span className="font-medium text-xs text-white block">
                      {agent.agentName}
                    </span>
                    <span className="text-[10px] text-[#8a8f98] font-mono">
                      ID: {agent.agentId.slice(0, 8)}
                    </span>
                  </div>
                </div>

                <span className="font-semibold text-xs text-[#22c55e] bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.25)] px-2.5 py-1 rounded-full">
                  {agent.activeDealsCount} deal
                  {agent.activeDealsCount > 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#8a8f98] italic text-center py-4">
            Aucun commercial n&apos;a d&apos;affaire active assignée
            actuellement.
          </p>
        )}
      </div>
    </div>
  );
}

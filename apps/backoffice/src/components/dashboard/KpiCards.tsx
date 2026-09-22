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
      {/* 1. Commissions encaissées (strictement par devise - CA4) */}
      <div>
        <h2 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">
          Commissions Encaissées (Par Devise)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {currencyList.length > 0 ? (
            currencyList.map(([curr, data]) => (
              <div
                key={curr}
                className="bg-surface-panel border border-border-subtle p-4 rounded-lg shadow-xs"
              >
                <div className="text-xs text-text-secondary uppercase font-semibold">
                  Total {curr}
                </div>
                <div className="text-xl font-bold text-feedback-success-text mt-1">
                  {data.formatted}
                </div>
                <div className="text-2xs text-text-secondary mt-1">
                  {data.receiptsCount} encaissement(s) réel(s)
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full bg-surface-panel border border-border-subtle p-4 rounded-lg text-xs text-text-secondary italic">
              Aucun encaissement enregistré.
            </div>
          )}
        </div>
      </div>

      {/* 2. Vue Synthétique : Affaires & Files */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Affaires actives */}
        <Link
          href="/deals"
          className="bg-surface-panel hover:bg-surface-hover border border-border-subtle hover:border-brand-primary p-4 rounded-lg transition-colors block"
        >
          <div className="text-xs text-text-secondary uppercase font-semibold">
            Affaires en cours
          </div>
          <div className="text-2xl font-bold text-brand-primary mt-1">
            {summaryMetrics.activeDealsCount}
          </div>
          <div className="text-2xs text-text-secondary mt-1">
            Pipeline actif →
          </div>
        </Link>

        {/* Campagnes à valider */}
        <Link
          href="/queues/campaigns"
          className="bg-surface-panel hover:bg-surface-hover border border-border-subtle hover:border-brand-primary p-4 rounded-lg transition-colors block"
        >
          <div className="text-xs text-text-secondary uppercase font-semibold">
            Campagnes à modérer
          </div>
          <div className="text-2xl font-bold text-text-primary mt-1">
            {summaryMetrics.pendingCampaignsCount}
          </div>
          <div className="text-2xs text-text-secondary mt-1">
            File 7 · Campagnes →
          </div>
        </Link>

        {/* Mises en relation */}
        <Link
          href="/queues/introductions"
          className="bg-surface-panel hover:bg-surface-hover border border-border-subtle hover:border-brand-primary p-4 rounded-lg transition-colors block"
        >
          <div className="text-xs text-text-secondary uppercase font-semibold">
            Mises en relation
          </div>
          <div className="text-2xl font-bold text-text-primary mt-1">
            {summaryMetrics.pendingIntroductionsCount}
          </div>
          <div className="text-2xs text-text-secondary mt-1">
            File 8 · Révélations →
          </div>
        </Link>

        {/* Alertes SLA */}
        <div
          className={`p-4 rounded-lg border ${
            summaryMetrics.totalSlaBreachesCount > 0
              ? "bg-feedback-warning-bg border-feedback-warning-border text-feedback-warning-text"
              : "bg-surface-panel border-border-subtle text-text-primary"
          }`}
        >
          <div className="text-xs uppercase font-semibold">
            Dépassements SLA
          </div>
          <div className="text-2xl font-bold mt-1">
            {summaryMetrics.totalSlaBreachesCount}
          </div>
          <div className="text-2xs mt-1">
            {summaryMetrics.totalSlaBreachesCount > 0
              ? "⚑ Attention requise immédiate"
              : "Aucun retard constaté"}
          </div>
        </div>
      </div>

      {/* 3. Répartition des affaires actives par commercial */}
      <div className="bg-surface-panel border border-border-subtle rounded-lg p-5">
        <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">
          Affaires Actives par Commercial
        </h3>

        {activeDealsByAgent.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {activeDealsByAgent.map((agent) => (
              <div
                key={agent.agentId}
                className="bg-surface-elevated p-3 rounded-md border border-border-subtle flex justify-between items-center text-xs"
              >
                <div>
                  <span className="font-semibold text-text-primary">
                    {agent.agentName}
                  </span>
                  <div className="text-2xs text-text-secondary mt-0.5 font-mono">
                    ID: {agent.agentId.slice(0, 8)}
                  </div>
                </div>
                <span className="font-bold text-brand-primary text-sm bg-brand-secondary/30 px-2 py-0.5 rounded-full">
                  {agent.activeDealsCount} deal(s)
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-secondary italic">
            Aucun commercial n'a d'affaire en cours pour le moment.
          </p>
        )}
      </div>
    </div>
  );
}

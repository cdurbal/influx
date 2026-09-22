"use client";

import React from "react";
import { type Deal, type DealStatus, DEAL_STATUSES } from "@influx/contracts";

export type DealWithStats = Deal & {
  totalReceivedMinor: number;
  remainingDueMinor: number | null;
  receiptsCount: number;
};

export interface DealKanbanBoardProps {
  deals: DealWithStats[];
  onSelectDeal: (dealId: string) => void;
}

const COLUMN_CONFIG: Record<
  DealStatus,
  { label: string; badgeBg: string; badgeText: string; dotColor: string }
> = {
  open: {
    label: "Ouvertes",
    badgeBg: "bg-[rgba(255,255,255,0.06)]",
    badgeText: "text-[#a1a1aa]",
    dotColor: "bg-[#717682]",
  },
  negotiating: {
    label: "En négociation",
    badgeBg: "bg-[rgba(94,106,210,0.15)]",
    badgeText: "text-[#818cf8]",
    dotColor: "bg-[#5e6ad2]",
  },
  contract_sent: {
    label: "Contrat envoyé",
    badgeBg: "bg-[rgba(245,158,11,0.15)]",
    badgeText: "text-[#fbbf24]",
    dotColor: "bg-[#f59e0b]",
  },
  signed: {
    label: "Signées",
    badgeBg: "bg-[rgba(34,197,94,0.15)]",
    badgeText: "text-[#4ade80]",
    dotColor: "bg-[#22c55e]",
  },
  paid: {
    label: "Soldées / Encaissées",
    badgeBg: "bg-[rgba(34,197,94,0.25)]",
    badgeText: "text-[#86efac]",
    dotColor: "bg-[#4ade80]",
  },
  lost: {
    label: "Perdues",
    badgeBg: "bg-[rgba(255,255,255,0.04)]",
    badgeText: "text-[#717682]",
    dotColor: "bg-[#52525b]",
  },
  cancelled: {
    label: "Annulées",
    badgeBg: "bg-[rgba(239,68,68,0.15)]",
    badgeText: "text-[#f87171]",
    dotColor: "bg-[#ef4444]",
  },
};

export function DealKanbanBoard({ deals, onSelectDeal }: DealKanbanBoardProps) {
  // Calcul des totaux par colonne et strictement par devise (CLAUDE.md §3)
  const getColumnTotals = (columnDeals: DealWithStats[]) => {
    const currencyTotals: Record<string, number> = {};
    for (const deal of columnDeals) {
      if (deal.negotiatedAmountMinor) {
        currencyTotals[deal.currency] =
          (currencyTotals[deal.currency] || 0) + deal.negotiatedAmountMinor;
      }
    }
    return Object.entries(currencyTotals).map(([curr, totalMinor]) => ({
      currency: curr,
      formatted: `${(totalMinor / 100).toLocaleString("fr-FR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })} ${curr}`,
    }));
  };

  return (
    <div className="flex gap-4 overflow-x-auto pb-6 pt-2">
      {DEAL_STATUSES.map((status) => {
        const columnDeals = deals.filter((d) => d.status === status);
        const totals = getColumnTotals(columnDeals);
        const config = COLUMN_CONFIG[status];

        return (
          <div
            key={status}
            className="shrink-0 w-80 bg-[rgba(13,14,18,0.8)] backdrop-blur-xl rounded-xl border border-[rgba(255,255,255,0.07)] flex flex-col max-h-[calc(100vh-12rem)] shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
          >
            {/* Entête de colonne */}
            <div className="p-3.5 border-b border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">
                    {config.label}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border border-[rgba(255,255,255,0.08)] ${config.badgeBg} ${config.badgeText}`}
                >
                  {columnDeals.length}
                </span>
              </div>

              {/* Totaux financiers par devise (Invariant A1 & CA4) */}
              <div className="mt-2 flex flex-wrap gap-1 text-[11px] font-mono text-[#8a8f98]">
                {totals.length > 0 ? (
                  totals.map((t) => (
                    <span
                      key={t.currency}
                      className="bg-[rgba(255,255,255,0.04)] px-2 py-0.5 rounded border border-[rgba(255,255,255,0.06)] text-white font-medium"
                    >
                      {t.formatted}
                    </span>
                  ))
                ) : (
                  <span className="text-[#52525b] text-[10px]">
                    0 montant engagé
                  </span>
                )}
              </div>
            </div>

            {/* Liste des cartes d'affaires */}
            <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
              {columnDeals.length === 0 ? (
                <div className="py-8 text-center text-[#52525b] text-xs italic">
                  Aucune affaire
                </div>
              ) : (
                columnDeals.map((deal) => {
                  const hasNegotiated =
                    deal.negotiatedAmountMinor !== null &&
                    deal.negotiatedAmountMinor !== undefined;
                  const hasCommission =
                    deal.agreedCommissionMinor !== null &&
                    deal.agreedCommissionMinor !== undefined;

                  return (
                    <div
                      key={deal.id}
                      onClick={() => onSelectDeal(deal.id)}
                      className="group bg-[rgba(18,19,24,0.9)] hover:bg-[rgba(26,28,35,0.95)] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.2)] rounded-lg p-3.5 cursor-pointer transition-all hover:-translate-y-0.5 shadow-sm"
                    >
                      {/* En-tête de carte */}
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[11px] font-mono text-[#8a8f98] group-hover:text-white transition-colors">
                          #{deal.id.slice(0, 8)}
                        </span>
                        {deal.contractSendingMode && (
                          <span className="text-[9px] uppercase font-bold tracking-wider bg-[rgba(255,255,255,0.04)] px-1.5 py-0.5 rounded text-[#a1a1aa] border border-[rgba(255,255,255,0.08)]">
                            {deal.contractSendingMode}
                          </span>
                        )}
                      </div>

                      {/* Montants */}
                      <div className="space-y-1.5 my-2">
                        <div className="text-xs flex justify-between items-center">
                          <span className="text-[#8a8f98]">
                            Montant contrat :
                          </span>
                          <span className="font-semibold text-white font-mono">
                            {hasNegotiated
                              ? `${(deal.negotiatedAmountMinor! / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} ${deal.currency}`
                              : "À négocier"}
                          </span>
                        </div>

                        <div className="text-xs flex justify-between items-center">
                          <span className="text-[#8a8f98]">Commission :</span>
                          <span className="font-semibold text-[#4ade80] font-mono">
                            {hasCommission
                              ? `${(deal.agreedCommissionMinor! / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} ${deal.currency}`
                              : "À convenir"}
                          </span>
                        </div>

                        {/* Encaissements reçus */}
                        <div className="text-xs flex justify-between items-center pt-1.5 border-t border-[rgba(255,255,255,0.06)] text-[11px]">
                          <span className="text-[#8a8f98]">Encaissé :</span>
                          <span className="font-medium text-[#4ade80] font-mono">
                            {(deal.totalReceivedMinor / 100).toLocaleString(
                              "fr-FR",
                              {
                                minimumFractionDigits: 0,
                              },
                            )}{" "}
                            {deal.currency} ({deal.receiptsCount})
                          </span>
                        </div>
                      </div>

                      {/* Reste dû éventuel */}
                      {deal.remainingDueMinor !== null &&
                        deal.remainingDueMinor > 0 && (
                          <div className="text-[10px] text-[#fbbf24] font-mono flex justify-between items-center bg-[rgba(245,158,11,0.08)] px-2 py-0.5 rounded border border-[rgba(245,158,11,0.2)] mt-1.5">
                            <span>Reste dû :</span>
                            <span>
                              {(deal.remainingDueMinor / 100).toLocaleString(
                                "fr-FR",
                                {
                                  minimumFractionDigits: 0,
                                },
                              )}{" "}
                              {deal.currency}
                            </span>
                          </div>
                        )}

                      {/* Motifs éventuels */}
                      {deal.lostReason && (
                        <div className="mt-2 text-[10px] text-[#f87171] bg-[rgba(239,68,68,0.08)] p-1.5 rounded border border-[rgba(239,68,68,0.2)] truncate italic">
                          Perte : {deal.lostReason}
                        </div>
                      )}
                      {deal.cancellationReason && (
                        <div className="mt-2 text-[10px] text-[#f87171] bg-[rgba(239,68,68,0.08)] p-1.5 rounded border border-[rgba(239,68,68,0.2)] truncate italic">
                          Annulation : {deal.cancellationReason}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
  { label: string; bgBadge: string; textBadge: string }
> = {
  open: {
    label: "Ouvertes",
    bgBadge: "bg-surface-elevated",
    textBadge: "text-text-secondary",
  },
  negotiating: {
    label: "En négociation",
    bgBadge: "bg-feedback-info-bg",
    textBadge: "text-feedback-info-text",
  },
  contract_sent: {
    label: "Contrat envoyé",
    bgBadge: "bg-feedback-warning-bg",
    textBadge: "text-feedback-warning-text",
  },
  signed: {
    label: "Signées",
    bgBadge: "bg-brand-secondary",
    textBadge: "text-brand-primary",
  },
  paid: {
    label: "Encaissées / Soldées",
    bgBadge: "bg-feedback-success-bg",
    textBadge: "text-feedback-success-text",
  },
  lost: {
    label: "Perdues",
    bgBadge: "bg-surface-elevated",
    textBadge: "text-text-muted",
  },
  cancelled: {
    label: "Annulées",
    bgBadge: "bg-feedback-error-bg",
    textBadge: "text-feedback-error-text",
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
    <div className="flex gap-4 overflow-x-auto pb-4 pt-2">
      {DEAL_STATUSES.map((status) => {
        const columnDeals = deals.filter((d) => d.status === status);
        const totals = getColumnTotals(columnDeals);
        const config = COLUMN_CONFIG[status];

        return (
          <div
            key={status}
            className="flex-shrink-0 w-72 bg-surface-panel rounded-lg border border-border-subtle flex flex-col max-h-[calc(100vh-14rem)]"
          >
            {/* Entête de colonne */}
            <div className="p-3 border-b border-border-subtle bg-surface-elevated rounded-t-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary uppercase tracking-wide">
                  {config.label}
                </span>
                <span
                  className={`text-2xs font-semibold px-2 py-0.5 rounded-full ${config.bgBadge} ${config.textBadge}`}
                >
                  {columnDeals.length}
                </span>
              </div>

              {/* Totaux financiers par devise */}
              <div className="mt-1.5 flex flex-wrap gap-1 text-2xs font-mono text-text-secondary">
                {totals.length > 0 ? (
                  totals.map((t) => (
                    <span
                      key={t.currency}
                      className="bg-surface-page px-1.5 py-0.5 rounded-sm border border-border-subtle"
                    >
                      {t.formatted}
                    </span>
                  ))
                ) : (
                  <span className="text-text-muted">0 montant</span>
                )}
              </div>
            </div>

            {/* Liste des cartes d'affaires */}
            <div className="p-2 space-y-2 overflow-y-auto flex-1">
              {columnDeals.length === 0 ? (
                <div className="py-6 text-center text-text-muted text-xs italic">
                  Aucune affaire
                </div>
              ) : (
                columnDeals.map((deal) => {
                  return (
                    <div
                      key={deal.id}
                      onClick={() => onSelectDeal(deal.id)}
                      className="bg-surface-elevated hover:bg-surface-hover border border-border-subtle rounded-md p-3 cursor-pointer transition-all hover:border-brand-primary shadow-xs"
                    >
                      {/* En-tête carte */}
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-2xs font-mono text-text-secondary">
                          #{deal.id.slice(0, 8)}
                        </span>
                        {deal.contractSendingMode && (
                          <span className="text-3xs uppercase font-semibold tracking-wider bg-surface-page px-1.5 py-0.5 rounded-sm text-text-secondary border border-border-subtle">
                            {deal.contractSendingMode}
                          </span>
                        )}
                      </div>

                      {/* Montants */}
                      <div className="space-y-1 my-2">
                        <div className="text-xs flex justify-between">
                          <span className="text-text-secondary">Contrat :</span>
                          <span className="font-semibold text-text-primary">
                            {deal.negotiatedAmountMinor !== null &&
                            deal.negotiatedAmountMinor !== undefined
                              ? `${(deal.negotiatedAmountMinor / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} ${deal.currency}`
                              : "À négocier"}
                          </span>
                        </div>
                        <div className="text-xs flex justify-between">
                          <span className="text-text-secondary">
                            Commission :
                          </span>
                          <span className="font-semibold text-text-brand">
                            {deal.agreedCommissionMinor !== null &&
                            deal.agreedCommissionMinor !== undefined
                              ? `${(deal.agreedCommissionMinor / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0 })} ${deal.currency}`
                              : "À convenir"}
                          </span>
                        </div>

                        {/* Encaissements reçus */}
                        <div className="text-xs flex justify-between pt-1 border-t border-border-subtle text-2xs">
                          <span className="text-text-secondary">
                            Encaissé :
                          </span>
                          <span className="font-medium text-feedback-success-text">
                            {(deal.totalReceivedMinor / 100).toLocaleString(
                              "fr-FR",
                              {
                                minimumFractionDigits: 0,
                              },
                            )}{" "}
                            {deal.currency} ({deal.receiptsCount} reçus)
                          </span>
                        </div>
                      </div>

                      {/* Motifs éventuels */}
                      {deal.lostReason && (
                        <div className="mt-1 text-2xs text-feedback-error-text truncate italic">
                          Perte : {deal.lostReason}
                        </div>
                      )}
                      {deal.cancellationReason && (
                        <div className="mt-1 text-2xs text-feedback-error-text truncate italic">
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

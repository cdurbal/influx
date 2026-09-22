"use client";

import React from "react";
import Link from "next/link";

export interface QueueItemInfo {
  id: string;
  number: number;
  code: string;
  title: string;
  description: string;
  pendingCount: number;
  oldestPendingAge: string;
  overdueCount: number;
  targetHref?: string;
  isActionable?: boolean;
}

export interface QueueGroupInfo {
  id: string;
  title: string;
  subtitle: string;
  isHighlight?: boolean;
  queues: QueueItemInfo[];
}

export interface UnifiedQueueTemplateProps {
  groups: QueueGroupInfo[];
}

export function UnifiedQueueTemplate({ groups }: UnifiedQueueTemplateProps) {
  return (
    <div className="space-y-6">
      {groups.map((group) => {
        const totalPending = group.queues.reduce(
          (sum, q) => sum + q.pendingCount,
          0,
        );

        return (
          <div
            key={group.id}
            className={`rounded-xl border transition-all ${
              group.isHighlight
                ? "bg-[rgba(34,197,94,0.03)] border-[rgba(34,197,94,0.35)] p-6 shadow-[0_0_30px_rgba(34,197,94,0.08)]"
                : "bg-[rgba(18,19,24,0.85)] border-[rgba(255,255,255,0.08)] p-5 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
            }`}
          >
            {/* Entête du groupe métier */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[rgba(255,255,255,0.06)] gap-2 mb-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-base font-semibold text-white tracking-tight">
                    {group.title}
                  </h2>
                  {group.isHighlight && (
                    <span className="bg-[#22c55e] text-black text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-full tracking-wider shadow-[0_0_10px_rgba(34,197,94,0.4)]">
                      Cœur de Métier · Chiffre d&apos;affaires
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#8a8f98] mt-1">{group.subtitle}</p>
              </div>

              <div className="text-xs text-[#8a8f98] font-mono bg-[rgba(255,255,255,0.03)] px-3 py-1 rounded-lg border border-[rgba(255,255,255,0.06)] self-start sm:self-auto">
                <span className="text-white font-bold">{totalPending}</span>{" "}
                demande(s) active(s)
              </div>
            </div>

            {/* Table des files d'attente */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[rgba(255,255,255,0.06)] text-[#717682] uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 px-3 font-semibold w-12">#</th>
                    <th className="py-2.5 px-3 font-semibold">
                      File d&apos;attente
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-center w-28">
                      En attente
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-center w-32">
                      Plus ancienne
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-center w-36">
                      Statut SLA
                    </th>
                    <th className="py-2.5 px-3 font-semibold text-right w-28">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(255,255,255,0.04)]">
                  {group.queues.map((q) => {
                    const isOverdue = q.overdueCount > 0;
                    return (
                      <tr
                        key={q.id}
                        className="hover:bg-[rgba(255,255,255,0.025)] transition-colors group"
                      >
                        <td className="py-3 px-3 font-mono text-[#8a8f98] font-medium text-[11px]">
                          {q.number}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-white group-hover:text-[#4ade80] transition-colors">
                            {q.title}
                          </div>
                          <div className="text-[11px] text-[#8a8f98] mt-0.5">
                            {q.description}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold ${
                              q.pendingCount > 0
                                ? "bg-[rgba(255,255,255,0.08)] text-white border border-[rgba(255,255,255,0.12)]"
                                : "text-[#52525b]"
                            }`}
                          >
                            {q.pendingCount}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-[11px] text-[#8a8f98]">
                          {q.oldestPendingAge}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {isOverdue ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-[rgba(245,158,11,0.12)] text-[#fbbf24] border border-[rgba(245,158,11,0.3)]">
                              <span>⚑</span>
                              <span>hors délai ({q.overdueCount})</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-[#4ade80] font-medium flex items-center justify-center gap-1">
                              <span>✓</span>
                              <span>Dans les délais</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {q.targetHref ? (
                            <Link
                              href={q.targetHref}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.12)] border border-[rgba(255,255,255,0.1)] hover:border-[rgba(255,255,255,0.25)] rounded-md text-[11px] font-medium text-white transition-all shadow-xs"
                            >
                              <span>Traiter</span>
                              <span>→</span>
                            </Link>
                          ) : (
                            <span className="text-[10px] text-[#52525b] uppercase font-mono tracking-wider">
                              Automatisé
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

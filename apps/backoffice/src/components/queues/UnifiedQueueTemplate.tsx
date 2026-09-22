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
    <div className="space-y-8">
      {groups.map((group) => {
        return (
          <div
            key={group.id}
            className={`rounded-xl border transition-all ${
              group.isHighlight
                ? "bg-brand-secondary/10 border-brand-primary p-6 shadow-md"
                : "bg-surface-panel border-border-subtle p-5 shadow-xs"
            }`}
          >
            {/* Entête du groupe métier */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border-subtle gap-2 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-text-primary tracking-tight">
                    {group.title}
                  </h2>
                  {group.isHighlight && (
                    <span className="bg-brand-primary text-white text-3xs uppercase font-extrabold px-2 py-0.5 rounded-full tracking-wider">
                      Cœur de Métier · Chiffre d'affaires
                    </span>
                  )}
                </div>
                <p className="text-xs text-text-secondary mt-0.5">
                  {group.subtitle}
                </p>
              </div>

              <div className="text-xs text-text-secondary font-mono">
                {group.queues.reduce((sum, q) => sum + q.pendingCount, 0)}{" "}
                demande(s) au total
              </div>
            </div>

            {/* Table des files d'attente du groupe */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border-subtle text-text-secondary uppercase tracking-wider text-2xs">
                    <th className="py-2 px-3 font-semibold w-12">#</th>
                    <th className="py-2 px-3 font-semibold">File d'attente</th>
                    <th className="py-2 px-3 font-semibold text-center w-28">
                      En attente
                    </th>
                    <th className="py-2 px-3 font-semibold text-center w-32">
                      Plus ancienne
                    </th>
                    <th className="py-2 px-3 font-semibold text-center w-36">
                      Statut SLA
                    </th>
                    <th className="py-2 px-3 font-semibold text-right w-28">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {group.queues.map((q) => {
                    const isOverdue = q.overdueCount > 0;
                    return (
                      <tr
                        key={q.id}
                        className="hover:bg-surface-hover/50 transition-colors"
                      >
                        <td className="py-2.5 px-3 font-mono text-text-secondary font-semibold">
                          {q.number}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-text-primary">
                            {q.title}
                          </div>
                          <div className="text-2xs text-text-secondary">
                            {q.description}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              q.pendingCount > 0
                                ? "bg-surface-elevated text-text-primary"
                                : "text-text-muted"
                            }`}
                          >
                            {q.pendingCount}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-text-secondary">
                          {q.oldestPendingAge}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isOverdue ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-2xs font-bold bg-feedback-warning-bg text-feedback-warning-text border border-feedback-warning-border">
                              <span>⚑</span>
                              <span>hors délai ({q.overdueCount})</span>
                            </span>
                          ) : (
                            <span className="text-2xs text-feedback-success-text font-medium">
                              ✓ Délais respectés
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {q.targetHref ? (
                            <Link
                              href={q.targetHref}
                              className="inline-block px-2.5 py-1 bg-surface-elevated hover:bg-surface-hover border border-border-subtle rounded-md text-2xs font-semibold text-text-primary transition-colors"
                            >
                              Traiter →
                            </Link>
                          ) : (
                            <span className="text-2xs text-text-muted italic">
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

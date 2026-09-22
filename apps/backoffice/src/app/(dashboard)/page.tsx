"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { authFetch } from "@/lib/api-client";

export default function DashboardPage() {
  const [kpis, setKpis] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchKpis = useCallback(async () => {
    setLoading(true);
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
    }
  }, []);

  useEffect(() => {
    fetchKpis();
  }, [fetchKpis]);

  const formattedTime = kpis?.timestamp
    ? new Date(kpis.timestamp).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="p-6 space-y-6">
      {/* En-tête avec mention "Arrêté à {heure}" (CA1) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border-subtle gap-4">
        <div>
          <h1 className="text-xl font-bold text-text-primary tracking-tight">
            Tableau de Bord de Pilotage
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Supervision opérationnelle, encaissements réels et suivi des
            engagements SLA.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {formattedTime && (
            <span className="text-xs text-text-secondary font-mono bg-surface-panel px-2.5 py-1 rounded-md border border-border-subtle">
              Arrêté à {formattedTime}
            </span>
          )}
          <button
            onClick={() => fetchKpis()}
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
          Calcul et chargement des métriques de pilotage...
        </div>
      ) : kpis ? (
        <div className="space-y-6">
          {/* Cartes KPI */}
          <KpiCards
            commissionsByCurrency={kpis.commissionsByCurrency || {}}
            activeDealsByAgent={kpis.activeDealsByAgent || []}
            summaryMetrics={kpis.summaryMetrics}
          />

          {/* Alertes SLA actives avec accès direct (CA2) */}
          <div className="bg-surface-panel border border-border-subtle rounded-lg p-5">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">
              Alertes de délais SLA ({kpis.slaAlerts?.length || 0})
            </h3>

            {kpis.slaAlerts && kpis.slaAlerts.length > 0 ? (
              <div className="space-y-2">
                {kpis.slaAlerts.map((alert: any) => {
                  let targetHref = "/queues/verification";
                  if (alert.type === "campaign")
                    targetHref = "/queues/campaigns";
                  if (alert.type === "introduction")
                    targetHref = "/queues/introductions";

                  return (
                    <div
                      key={alert.id}
                      className="bg-feedback-warning-bg/40 border border-feedback-warning-border p-3 rounded-md flex justify-between items-center text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-feedback-warning-text">
                          ⚑ hors délai
                        </span>
                        <div>
                          <span className="font-semibold text-text-primary">
                            [{alert.type.toUpperCase()}] {alert.reference}
                          </span>
                          <span className="text-text-secondary ml-2">
                            (Dépassement de {alert.overdueHours} heure(s))
                          </span>
                        </div>
                      </div>

                      <Link
                        href={targetHref}
                        className="px-3 py-1 bg-surface-elevated hover:bg-surface-hover border border-border-subtle rounded-md text-2xs font-medium text-text-primary transition-colors"
                      >
                        Ouvrir la file →
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-feedback-success-text italic">
                ✓ Aucune demande hors délai. Tous les engagements SLA sont
                respectés.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

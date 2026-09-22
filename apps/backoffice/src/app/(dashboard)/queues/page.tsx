"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  UnifiedQueueTemplate,
  type QueueGroupInfo,
} from "@/components/queues/UnifiedQueueTemplate";
import { authFetch } from "@/lib/api-client";

export default function QueuesOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queueGroups, setQueueGroups] = useState<QueueGroupInfo[]>([]);

  const loadQueuesData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Chargement des KPIs pour alimenter dynamiquement les compteurs
      const res = await authFetch("/api/backoffice/dashboard/kpis");
      const kpis = res.ok ? await res.json() : null;

      const verifBreaches =
        kpis?.slaAlerts?.filter((a: any) => a.type === "verification").length ||
        0;
      const campBreaches =
        kpis?.slaAlerts?.filter((a: any) => a.type === "campaign").length || 0;
      const introBreaches =
        kpis?.slaAlerts?.filter((a: any) => a.type === "introduction").length ||
        0;

      const groups: QueueGroupInfo[] = [
        {
          id: "group-1",
          title: "1. Faire entrer dans le produit",
          subtitle:
            "Stock en attente d'être publiable. Le retard y coûte de l'offre et de la demande.",
          queues: [
            {
              id: "q-1",
              number: 1,
              code: "profiles_advertiser",
              title: "Profils marque à valider",
              description:
                "Vérification SIRET et conformité de la raison sociale",
              pendingCount: 0,
              oldestPendingAge: "—",
              overdueCount: 0,
            },
            {
              id: "q-2",
              number: 2,
              code: "profiles_creator",
              title: "Profils créateur à valider",
              description: "Contrôle des thématiques et des réseaux déclarés",
              pendingCount: 0,
              oldestPendingAge: "—",
              overdueCount: 0,
            },
            {
              id: "q-3",
              number: 3,
              code: "portfolio_moderation",
              title: "Visuels de portfolio à modérer",
              description: "Modération des images et contenus importés",
              pendingCount: 0,
              oldestPendingAge: "—",
              overdueCount: 0,
            },
            {
              id: "q-4",
              number: 4,
              code: "verification",
              title: "Demandes de vérification et badge",
              description:
                "Attribution des badges Propriété et Audience (Niv. 1 & 2)",
              pendingCount:
                kpis?.summaryMetrics?.pendingVerificationsCount || 0,
              oldestPendingAge: "1 h 15",
              overdueCount: verifBreaches,
              targetHref: "/queues/verification",
            },
            {
              id: "q-6",
              number: 6,
              code: "identity_change_review",
              title: "Identifiants modifiés à contrôler",
              description: "Vérification des changements de RIB ou de nom",
              pendingCount: 0,
              oldestPendingAge: "—",
              overdueCount: 0,
            },
            {
              id: "q-7",
              number: 7,
              code: "campaigns",
              title: "Campagnes à modérer",
              description: "Validation des briefs annonceurs avant publication",
              pendingCount: kpis?.summaryMetrics?.pendingCampaignsCount || 0,
              oldestPendingAge: "3 h 30",
              overdueCount: campBreaches,
              targetHref: "/queues/campaigns",
            },
          ],
        },
        {
          id: "group-2",
          title: "2. Faire se rencontrer",
          subtitle:
            "Le groupe qui porte le chiffre d'affaires d'INFLUX. Traitement prioritaire.",
          isHighlight: true,
          queues: [
            {
              id: "q-8",
              number: 8,
              code: "introductions",
              title: "Demandes de contact et candidatures",
              description:
                "Validation des mises en relation et révélation d'identité à trois",
              pendingCount:
                kpis?.summaryMetrics?.pendingIntroductionsCount || 0,
              oldestPendingAge: "0 h 22",
              overdueCount: introBreaches,
              targetHref: "/queues/introductions",
            },
            {
              id: "q-9",
              number: 9,
              code: "team_selection",
              title: "Sélection par l'équipe INFLUX",
              description:
                "Demandes de casting sur mesure initiées par les marques",
              pendingCount: 0,
              oldestPendingAge: "—",
              overdueCount: 0,
            },
          ],
        },
        {
          id: "group-3",
          title: "3. Protéger",
          subtitle:
            "Décisions engageant la crédibilité et la sécurité juridique d'INFLUX.",
          queues: [
            {
              id: "q-5",
              number: 5,
              code: "verification_disputes",
              title: "Contestations de badge",
              description: "Recours créateurs suite à refus de certification",
              pendingCount: 0,
              oldestPendingAge: "—",
              overdueCount: 0,
            },
            {
              id: "q-10",
              number: 10,
              code: "reports",
              title: "Signalements de comportements",
              description: "Tentatives de contournement, harcèlement ou spam",
              pendingCount: 0,
              oldestPendingAge: "—",
              overdueCount: 0,
            },
            {
              id: "q-11",
              number: 11,
              code: "documents",
              title: "Documents à contrôler",
              description: "Factures, attestations d'assurance et Kbis",
              pendingCount: 0,
              oldestPendingAge: "—",
              overdueCount: 0,
            },
          ],
        },
        {
          id: "group-4",
          title: "4. Faire fonctionner la machine",
          subtitle:
            "Incidents et supervision technique (Brevo, Apollo, délivrabilité).",
          queues: [
            {
              id: "q-12",
              number: 12,
              code: "lead_sync_failures",
              title: "Échecs de synchronisation CRM",
              description: "Outbox en attente ou rejeux Brevo & Apollo",
              pendingCount: 0,
              oldestPendingAge: "—",
              overdueCount: 0,
            },
            {
              id: "q-13",
              number: 13,
              code: "email_delivery_incidents",
              title: "Incidents de délivrabilité e-mail",
              description: "Rebonds durs et plaintes pour spam",
              pendingCount: 0,
              oldestPendingAge: "—",
              overdueCount: 0,
            },
            {
              id: "q-16",
              number: 16,
              code: "email_send_failures",
              title: "Échecs d'envoi d'e-mails",
              description: "Erreurs API Brevo et tentatives épuisées",
              pendingCount: 0,
              oldestPendingAge: "—",
              overdueCount: 0,
            },
          ],
        },
        {
          id: "group-5",
          title: "5. Obligations et contrôles",
          subtitle:
            "Conformité RGPD stricte et principe de double validation par les pairs.",
          queues: [
            {
              id: "q-14",
              number: 14,
              code: "data_subject_requests",
              title: "Demandes de données personnelles RGPD",
              description: "Droits d'accès, de rectification et d'effacement",
              pendingCount: 0,
              oldestPendingAge: "—",
              overdueCount: 0,
            },
            {
              id: "q-15",
              number: 15,
              code: "dual_control_pending",
              title: "Actions en attente de double validation",
              description:
                "Validations de pairs requises pour actions sensibles (2V)",
              pendingCount: 0,
              oldestPendingAge: "—",
              overdueCount: 0,
            },
          ],
        },
      ];

      setQueueGroups(groups);
    } catch (err: any) {
      setError(err.message || "Erreur de chargement des files");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueuesData();
  }, [loadQueuesData]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* En-tête Linear */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[rgba(255,255,255,0.07)] gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-[rgba(34,197,94,0.12)] text-[#4ade80] border border-[rgba(34,197,94,0.25)]">
              Supervision des Opérations
            </span>
            <span className="text-xs text-[#8a8f98]">
              · 5 Groupes Métiers · Doc 17b §1.3
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Les 16 Files d&apos;Attente du Backoffice
          </h1>
          <p className="text-xs text-[#8a8f98] mt-1 max-w-2xl">
            Gabarit unifié de supervision opérationnelle réparti en 5 groupes
            métiers (Doc 17b §1.3). Traitement prioritaire du chiffre
            d&apos;affaires (File 8).
          </p>
        </div>

        <button
          onClick={() => loadQueuesData()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.1)] border border-[rgba(255,255,255,0.12)] rounded-lg text-xs font-medium text-white transition-all cursor-pointer shadow-xs"
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
            className={loading ? "animate-spin text-[#22c55e]" : ""}
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
          <span>{loading ? "Chargement..." : "Actualiser les files"}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-[rgba(239,68,68,0.1)] text-[#fca5a5] border border-[rgba(239,68,68,0.25)] rounded-xl text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-[#8a8f98] text-xs flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-[rgba(255,255,255,0.2)] border-t-[#22c55e] rounded-full animate-spin" />
          <span>Chargement du catalogue des files d&apos;attente...</span>
        </div>
      ) : (
        <UnifiedQueueTemplate groups={queueGroups} />
      )}
    </div>
  );
}

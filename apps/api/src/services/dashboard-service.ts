import { MockStore } from "../mocks/mock-store";
import { type CommissionReceipt, type Deal } from "@influx/contracts";

export interface DashboardKpis {
  timestamp: string;
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
  slaAlerts: Array<{
    id: string;
    type: "verification" | "campaign" | "introduction";
    reference: string;
    createdAt: string;
    slaDueAt: string;
    isOverdue: boolean;
    overdueHours: number;
  }>;
}

export class DashboardService {
  constructor(private store: MockStore = MockStore.getInstance()) {}

  public async getKpis(): Promise<DashboardKpis> {
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Commissions encaissées - STRICTEMENT groupées par devise (CA4, Invariant Métier)
    const receipts = Array.from(
      this.store.commissionReceipts.values(),
    ) as unknown as CommissionReceipt[];

    const commissionsByCurrency: Record<
      string,
      { totalMinor: number; formatted: string; receiptsCount: number }
    > = {};

    for (const r of receipts) {
      const curr = r.currency || "EUR";
      if (!commissionsByCurrency[curr]) {
        commissionsByCurrency[curr] = {
          totalMinor: 0,
          formatted: "",
          receiptsCount: 0,
        };
      }

      if (r.kind === "paiement") {
        commissionsByCurrency[curr].totalMinor += r.amountMinor;
        commissionsByCurrency[curr].receiptsCount += 1;
      } else if (r.kind === "remboursement") {
        commissionsByCurrency[curr].totalMinor -= r.amountMinor;
      }
    }

    for (const curr of Object.keys(commissionsByCurrency)) {
      const entry = commissionsByCurrency[curr];
      if (!entry) continue;
      const minor = entry.totalMinor;
      entry.formatted = `${(minor / 100).toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${curr}`;
    }

    // 2. Affaires actives par commercial
    const deals = Array.from(this.store.deals.values()) as unknown as Deal[];
    const activeStatuses = ["open", "negotiating", "contract_sent", "signed"];
    const activeDeals = deals.filter((d) => activeStatuses.includes(d.status));

    const agentDealsMap: Record<string, number> = {};
    for (const d of activeDeals) {
      const agentId = d.ownerAgentId || "unassigned";
      agentDealsMap[agentId] = (agentDealsMap[agentId] || 0) + 1;
    }

    const accounts = Array.from(this.store.accounts.values());
    const activeDealsByAgent = Object.entries(agentDealsMap).map(
      ([agentId, count]) => {
        const acc = accounts.find((a) => a.id === agentId);
        let name = "Non assigné";
        if (agentId !== "unassigned") {
          if (acc) {
            if (acc.email.startsWith("alexandre")) {
              name = "Alexandre Martin";
            } else if (acc.email.startsWith("sarah")) {
              name = "Sarah Connor";
            } else {
              const prefix = acc.email.split("@")[0] || "Agent";
              name = prefix
                .split(".")
                .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                .join(" ");
            }
          } else {
            name = `Agent #${agentId.slice(0, 6)}`;
          }
        }
        return {
          agentId,
          agentName: name,
          activeDealsCount: count,
        };
      },
    );

    // 3. Détection des alertes et dépassements SLA sur toutes les files
    const slaAlerts: DashboardKpis["slaAlerts"] = [];

    // a) File vérification
    const verifList = Array.from(this.store.verificationRequests.values());
    const pendingVerifs = verifList.filter(
      (v: any) => v.status === "submitted" || v.status === "pending",
    );
    for (const v of pendingVerifs as any[]) {
      const due = v.slaDueAt ? new Date(v.slaDueAt) : new Date(v.createdAt);
      const isOverdue = now > due;
      const overdueHours = isOverdue
        ? Math.max(
            1,
            Math.floor((now.getTime() - due.getTime()) / (1000 * 3600)),
          )
        : 0;

      if (isOverdue) {
        slaAlerts.push({
          id: v.id,
          type: "verification",
          reference: `VERIF-${v.id.slice(0, 8)}`,
          createdAt: v.createdAt,
          slaDueAt: v.slaDueAt || v.createdAt,
          isOverdue: true,
          overdueHours,
        });
      }
    }

    // b) File campagnes
    const campaigns = Array.from(this.store.campaigns.values());
    const pendingCampaigns = campaigns.filter(
      (c: any) => c.status === "en_attente_validation",
    );
    for (const c of pendingCampaigns as any[]) {
      const due = c.slaDueAt ? new Date(c.slaDueAt) : new Date(c.createdAt);
      const isOverdue = now > due;
      const overdueHours = isOverdue
        ? Math.max(
            1,
            Math.floor((now.getTime() - due.getTime()) / (1000 * 3600)),
          )
        : 0;

      if (isOverdue) {
        slaAlerts.push({
          id: c.id,
          type: "campaign",
          reference: c.title || `CAMP-${c.id.slice(0, 8)}`,
          createdAt: c.createdAt,
          slaDueAt: c.slaDueAt || c.createdAt,
          isOverdue: true,
          overdueHours,
        });
      }
    }

    // c) File introductions
    const intros = Array.from(this.store.introductions.values());
    const pendingIntros = intros.filter(
      (i: any) => i.status === "pending_review",
    );
    for (const i of pendingIntros as any[]) {
      const due = i.slaDueAt ? new Date(i.slaDueAt) : new Date(i.createdAt);
      const isOverdue = now > due;
      const overdueHours = isOverdue
        ? Math.max(
            1,
            Math.floor((now.getTime() - due.getTime()) / (1000 * 3600)),
          )
        : 0;

      if (isOverdue) {
        slaAlerts.push({
          id: i.id,
          type: "introduction",
          reference: i.reference || `MER-${i.id.slice(0, 8)}`,
          createdAt: i.createdAt,
          slaDueAt: i.slaDueAt,
          isOverdue: true,
          overdueHours,
        });
      }
    }

    return {
      timestamp: nowIso,
      commissionsByCurrency,
      activeDealsByAgent,
      summaryMetrics: {
        activeDealsCount: activeDeals.length,
        pendingVerificationsCount: pendingVerifs.length,
        pendingCampaignsCount: pendingCampaigns.length,
        pendingIntroductionsCount: pendingIntros.length,
        totalSlaBreachesCount: slaAlerts.length,
      },
      slaAlerts,
    };
  }
}

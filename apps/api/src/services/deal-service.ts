import { randomUUID } from "node:crypto";
import {
  type Deal,
  type CommissionReceipt,
  type UpdateDealInput,
  type CreateCommissionReceiptInput,
  type DealFilter,
  DealSchema,
  CommissionReceiptSchema,
} from "@influx/contracts";
import { MockStore } from "../mocks/mock-store";

export class DealService {
  constructor(private store: MockStore = MockStore.getInstance()) {}

  /**
   * Liste les affaires avec filtres optionnels
   */
  public async listDeals(filters?: DealFilter): Promise<
    (Deal & {
      totalReceivedMinor: number;
      remainingDueMinor: number | null;
      receiptsCount: number;
    })[]
  > {
    const deals = Array.from(this.store.deals.values()) as unknown as Deal[];

    const filtered = deals.filter((deal) => {
      if (filters?.status && deal.status !== filters.status) return false;
      if (filters?.ownerAgentId && deal.ownerAgentId !== filters.ownerAgentId)
        return false;
      if (filters?.currency && deal.currency !== filters.currency) return false;
      return true;
    });

    return filtered.map((deal) => {
      const receipts = this.getDealReceipts(deal.id);
      const totalReceivedMinor = receipts.reduce((sum, r) => {
        if (r.kind === "paiement") return sum + r.amountMinor;
        if (r.kind === "remboursement") return sum - r.amountMinor;
        return sum;
      }, 0);

      const remainingDueMinor =
        deal.agreedCommissionMinor !== null &&
        deal.agreedCommissionMinor !== undefined
          ? Math.max(0, deal.agreedCommissionMinor - totalReceivedMinor)
          : null;

      return {
        ...deal,
        totalReceivedMinor,
        remainingDueMinor,
        receiptsCount: receipts.length,
      };
    });
  }

  /**
   * Récupère une affaire par son identifiant avec ses encaissements
   */
  public async getDealById(id: string): Promise<{
    deal: Deal;
    receipts: CommissionReceipt[];
    totalReceivedMinor: number;
    remainingDueMinor: number | null;
  }> {
    const raw = this.store.deals.get(id);
    if (!raw) {
      throw new Error(`Affaire introuvable : ${id}`);
    }
    const deal = DealSchema.parse(raw);
    const receipts = this.getDealReceipts(id);

    const totalReceivedMinor = receipts.reduce((sum, r) => {
      if (r.kind === "paiement") return sum + r.amountMinor;
      if (r.kind === "remboursement") return sum - r.amountMinor;
      return sum;
    }, 0);

    const remainingDueMinor =
      deal.agreedCommissionMinor !== null &&
      deal.agreedCommissionMinor !== undefined
        ? Math.max(0, deal.agreedCommissionMinor - totalReceivedMinor)
        : null;

    return {
      deal,
      receipts,
      totalReceivedMinor,
      remainingDueMinor,
    };
  }

  /**
   * Récupère une affaire par l'ID de sa mise en relation
   */
  public async getDealByIntroductionId(
    introductionId: string,
  ): Promise<Deal | null> {
    const deals = Array.from(this.store.deals.values()) as unknown as Deal[];
    const match = deals.find((d) => d.introductionId === introductionId);
    return match ? DealSchema.parse(match) : null;
  }

  /**
   * Mise à jour manuelle des montants et statuts d'une affaire par un commercial
   * STRICTEMENT AUCUN calcul automatique de commission (CLAUDE.md §3 & Doc 14)
   */
  public async updateDeal(
    id: string,
    input: UpdateDealInput,
    agentId: string,
  ): Promise<Deal> {
    const { deal } = await this.getDealById(id);
    const now = new Date().toISOString();

    // Contrôles métiers sur les statuts
    if (input.status && input.status !== deal.status) {
      if (
        input.status === "contract_sent" &&
        !input.contractSendingMode &&
        !deal.contractSendingMode
      ) {
        throw new Error(
          "Le mode d'envoi du contrat (email, docusign, in_person) est obligatoire pour passer à l'état 'contract_sent'",
        );
      }
      if (input.status === "lost" && !input.lostReason && !deal.lostReason) {
        throw new Error(
          "Un motif d'échec commercial est obligatoire pour déclarer une affaire perdue",
        );
      }
      if (
        input.status === "cancelled" &&
        !input.cancellationReason &&
        !deal.cancellationReason
      ) {
        throw new Error(
          "Un motif d'annulation est obligatoire pour annuler l'affaire",
        );
      }
    }

    const updatedDeal: Deal = {
      ...deal,
      ...input,
      contractSentAt:
        input.status === "contract_sent" && !deal.contractSentAt
          ? now
          : (input.contractSentAt ?? deal.contractSentAt),
      signedAt:
        input.status === "signed" && !deal.signedAt
          ? now
          : (input.signedAt ?? deal.signedAt),
      updatedAt: now,
    };

    const validated = DealSchema.parse(updatedDeal);
    this.store.deals.set(
      validated.id,
      validated as unknown as Record<string, unknown>,
    );

    // Enregistrement d'audit
    this.store.recordAuditEvent("deal_updated", {
      dealId: validated.id,
      agentId,
      status: validated.status,
      negotiatedAmountMinor: validated.negotiatedAmountMinor,
      agreedCommissionMinor: validated.agreedCommissionMinor,
      currency: validated.currency,
    });

    return validated;
  }

  /**
   * Enregistre un encaissement réel sur une affaire (billing.commission_receipts - E1)
   */
  public async addReceipt(
    dealId: string,
    input: CreateCommissionReceiptInput,
    agentId: string,
  ): Promise<CommissionReceipt> {
    const { deal } = await this.getDealById(dealId);
    const now = new Date().toISOString();

    const receipt: CommissionReceipt = {
      id: randomUUID(),
      dealId: deal.id,
      kind: input.kind,
      amountMinor: input.amountMinor,
      currency: input.currency || deal.currency,
      receivedOn: input.receivedOn || (now.split("T")[0] as string),
      payerSide: input.payerSide,
      paymentMethod: input.paymentMethod || "virement",
      externalRef: input.externalRef ?? null,
      note: input.note ?? null,
      recordedByAccountId: agentId,
      recordedAt: now,
    };

    const validatedReceipt = CommissionReceiptSchema.parse(receipt);
    this.store.commissionReceipts.set(
      validatedReceipt.id,
      validatedReceipt as unknown as Record<string, unknown>,
    );

    // Calcul de la somme encaissée pour éventuel passage à 'paid'
    const allReceipts = this.getDealReceipts(deal.id);
    const totalPaid = allReceipts.reduce((sum, r) => {
      if (r.kind === "paiement") return sum + r.amountMinor;
      if (r.kind === "remboursement") return sum - r.amountMinor;
      return sum;
    }, 0);

    // Si la commission convenue est intégralement couverte et le deal était signé, on passe à 'paid'
    if (
      deal.agreedCommissionMinor !== null &&
      deal.agreedCommissionMinor !== undefined &&
      totalPaid >= deal.agreedCommissionMinor &&
      deal.status === "signed"
    ) {
      deal.status = "paid";
      deal.updatedAt = now;
      this.store.deals.set(deal.id, deal as unknown as Record<string, unknown>);
    }

    // Journalisation d'audit
    this.store.recordAuditEvent("deal_receipt_recorded", {
      receiptId: validatedReceipt.id,
      dealId: deal.id,
      amountMinor: validatedReceipt.amountMinor,
      currency: validatedReceipt.currency,
      payerSide: validatedReceipt.payerSide,
      agentId,
    });

    return validatedReceipt;
  }

  /**
   * Récupère tous les encaissements liés à une affaire
   */
  public getDealReceipts(dealId: string): CommissionReceipt[] {
    const receipts = Array.from(
      this.store.commissionReceipts.values(),
    ) as unknown as CommissionReceipt[];
    return receipts
      .filter((r) => r.dealId === dealId)
      .sort(
        (a, b) =>
          new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
      );
  }
}

"use client";

import React, { useState, useEffect } from "react";
import {
  type Deal,
  type CommissionReceipt,
  type DealStatus,
  type ContractSendingMode,
  type PayerSide,
  DEAL_STATUSES,
  CONTRACT_SENDING_MODES,
  PAYER_SIDES,
} from "@influx/contracts";
import { authFetch } from "@/lib/api-client";

export interface DealDetailDrawerProps {
  dealId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onDealUpdated: () => void;
}

export function DealDetailDrawer({
  dealId,
  isOpen,
  onClose,
  onDealUpdated,
}: DealDetailDrawerProps) {
  const [deal, setDeal] = useState<Deal | null>(null);
  const [receipts, setReceipts] = useState<CommissionReceipt[]>([]);
  const [totalReceivedMinor, setTotalReceivedMinor] = useState(0);
  const [remainingDueMinor, setRemainingDueMinor] = useState<number | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Formulaire d'édition Deal
  const [status, setStatus] = useState<DealStatus>("open");
  const [currency, setCurrency] = useState("EUR");
  const [negotiatedAmount, setNegotiatedAmount] = useState("");
  const [agreedCommission, setAgreedCommission] = useState("");
  const [contractSendingMode, setContractSendingMode] = useState<
    ContractSendingMode | ""
  >("");
  const [lostReason, setLostReason] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [notes, setNotes] = useState("");

  // Formulaire nouvel encaissement
  const [receiptAmount, setReceiptAmount] = useState("");
  const [payerSide, setPayerSide] = useState<PayerSide>("advertiser");
  const [paymentMethod, setPaymentMethod] = useState("virement");
  const [externalRef, setExternalRef] = useState("");
  const [receiptNote, setReceiptNote] = useState("");

  // Chargement des détails du deal
  useEffect(() => {
    if (!dealId || !isOpen) {
      setDeal(null);
      setError(null);
      setSuccessMsg(null);
      return;
    }

    setLoading(true);
    setError(null);
    authFetch(`/api/backoffice/deals/${dealId}`)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.message || "Erreur de chargement de l'affaire",
          );
        }
        return res.json();
      })
      .then((data) => {
        setDeal(data.deal);
        setReceipts(data.receipts || []);
        setTotalReceivedMinor(data.totalReceivedMinor || 0);
        setRemainingDueMinor(data.remainingDueMinor ?? null);

        // Remplissage du formulaire
        setStatus(data.deal.status);
        setCurrency(data.deal.currency || "EUR");
        setNegotiatedAmount(
          data.deal.negotiatedAmountMinor !== null &&
            data.deal.negotiatedAmountMinor !== undefined
            ? (data.deal.negotiatedAmountMinor / 100).toFixed(2)
            : "",
        );
        setAgreedCommission(
          data.deal.agreedCommissionMinor !== null &&
            data.deal.agreedCommissionMinor !== undefined
            ? (data.deal.agreedCommissionMinor / 100).toFixed(2)
            : "",
        );
        setContractSendingMode(data.deal.contractSendingMode || "");
        setLostReason(data.deal.lostReason || "");
        setCancellationReason(data.deal.cancellationReason || "");
        setNotes(data.deal.notes || "");
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [dealId, isOpen]);

  // Sauvegarde des modifications du Deal
  const handleSaveDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealId) return;

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    const payload: any = {
      status,
      currency,
      negotiatedAmountMinor: negotiatedAmount
        ? Math.round(parseFloat(negotiatedAmount) * 100)
        : null,
      agreedCommissionMinor: agreedCommission
        ? Math.round(parseFloat(agreedCommission) * 100)
        : null,
      contractSendingMode: contractSendingMode || null,
      lostReason: lostReason || null,
      cancellationReason: cancellationReason || null,
      notes: notes || null,
    };

    try {
      const res = await authFetch(`/api/backoffice/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Erreur de mise à jour");
      }

      setDeal(data.deal);
      setSuccessMsg("Affaire mise à jour avec succès.");
      onDealUpdated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Ajout d'un encaissement réel
  const handleAddReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealId || !receiptAmount) return;

    const parsedAmount = parseFloat(receiptAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Le montant de l'encaissement doit être strictement positif.");
      return;
    }

    setReceiptSaving(true);
    setError(null);
    setSuccessMsg(null);

    const payload = {
      kind: "paiement",
      amountMinor: Math.round(parsedAmount * 100),
      currency: deal?.currency || currency,
      payerSide,
      paymentMethod,
      externalRef: externalRef.trim() || undefined,
      note: receiptNote.trim() || undefined,
    };

    try {
      const res = await authFetch(`/api/backoffice/deals/${dealId}/receipts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Erreur lors de l'encaissement");
      }

      setDeal(data.deal);
      setReceipts((prev) => [...prev, data.receipt]);
      setTotalReceivedMinor(data.totalReceivedMinor);
      setRemainingDueMinor(data.remainingDueMinor);
      setReceiptAmount("");
      setExternalRef("");
      setReceiptNote("");
      setSuccessMsg("Encaissement enregistré avec succès.");
      onDealUpdated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setReceiptSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-surface-panel border-l border-border-subtle h-full overflow-y-auto p-6 shadow-2xl flex flex-col justify-between">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border-subtle mb-6">
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Affaire commerciale
              </h2>
              <p className="text-xs text-text-secondary mt-1 font-mono">
                ID : {dealId}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-text-secondary hover:text-text-primary p-2 rounded-md hover:bg-surface-elevated transition-colors text-sm"
            >
              Fermer ✕
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-feedback-error-bg text-feedback-error-text border border-feedback-error-border rounded-md text-sm">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 bg-feedback-success-bg text-feedback-success-text border border-feedback-success-border rounded-md text-sm">
              {successMsg}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-text-secondary text-sm">
              Chargement des détails de l'affaire...
            </div>
          ) : (
            <div className="space-y-6">
              {/* Synthèse financière */}
              <div className="bg-surface-elevated p-4 rounded-lg border border-border-subtle grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-xs text-text-secondary uppercase">
                    Montant contrat
                  </div>
                  <div className="text-base font-bold text-text-primary mt-1">
                    {deal?.negotiatedAmountMinor !== null &&
                    deal?.negotiatedAmountMinor !== undefined
                      ? `${(deal.negotiatedAmountMinor / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} ${deal.currency}`
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-text-secondary uppercase">
                    Commission convenue
                  </div>
                  <div className="text-base font-bold text-text-brand mt-1">
                    {deal?.agreedCommissionMinor !== null &&
                    deal?.agreedCommissionMinor !== undefined
                      ? `${(deal.agreedCommissionMinor / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} ${deal.currency}`
                      : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-text-secondary uppercase">
                    Total encaissé
                  </div>
                  <div className="text-base font-bold text-feedback-success-text mt-1">
                    {(totalReceivedMinor / 100).toLocaleString("fr-FR", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    {deal?.currency || currency}
                  </div>
                  {remainingDueMinor !== null && remainingDueMinor > 0 && (
                    <div className="text-xs text-feedback-warning-text mt-1 font-medium">
                      Reste dû :{" "}
                      {(remainingDueMinor / 100).toLocaleString("fr-FR", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      {deal?.currency}
                    </div>
                  )}
                </div>
              </div>

              {/* Formulaire d'édition du Deal */}
              <form onSubmit={handleSaveDeal} className="space-y-4">
                <h3 className="text-sm font-semibold text-text-primary border-b border-border-subtle pb-2">
                  Paramètres de négociation (Saisie manuelle)
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Statut de l'affaire
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as DealStatus)}
                      className="w-full bg-surface-page border border-border-subtle rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-hidden focus:border-brand-primary"
                    >
                      {DEAL_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Devise
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full bg-surface-page border border-border-subtle rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-hidden focus:border-brand-primary"
                    >
                      <option value="EUR">EUR (€)</option>
                      <option value="USD">USD ($)</option>
                      <option value="CAD">CAD ($)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="BRL">BRL (R$)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Montant négocié ({currency})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={negotiatedAmount}
                      onChange={(e) => setNegotiatedAmount(e.target.value)}
                      placeholder="ex: 5000.00"
                      className="w-full bg-surface-page border border-border-subtle rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-hidden focus:border-brand-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Commission convenue ({currency})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={agreedCommission}
                      onChange={(e) => setAgreedCommission(e.target.value)}
                      placeholder="ex: 1750.00"
                      className="w-full bg-surface-page border border-border-subtle rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-hidden focus:border-brand-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Mode d'envoi du contrat
                  </label>
                  <select
                    value={contractSendingMode}
                    onChange={(e) =>
                      setContractSendingMode(
                        e.target.value as ContractSendingMode,
                      )
                    }
                    className="w-full bg-surface-page border border-border-subtle rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-hidden focus:border-brand-primary"
                  >
                    <option value="">Non sélectionné</option>
                    {CONTRACT_SENDING_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </select>
                </div>

                {status === "lost" && (
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Motif d'échec commercial *
                    </label>
                    <input
                      type="text"
                      required
                      value={lostReason}
                      onChange={(e) => setLostReason(e.target.value)}
                      placeholder="Indiquer la raison de la perte du deal"
                      className="w-full bg-surface-page border border-border-subtle rounded-md px-3 py-1.5 text-sm text-text-primary"
                    />
                  </div>
                )}

                {status === "cancelled" && (
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">
                      Motif d'annulation *
                    </label>
                    <input
                      type="text"
                      required
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      placeholder="Indiquer la raison de l'annulation"
                      className="w-full bg-surface-page border border-border-subtle rounded-md px-3 py-1.5 text-sm text-text-primary"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Notes commerciales internes
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Commentaires et historique..."
                    className="w-full bg-surface-page border border-border-subtle rounded-md px-3 py-1.5 text-sm text-text-primary focus:outline-hidden"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50"
                  >
                    {saving ? "Enregistrement..." : "Enregistrer l'affaire"}
                  </button>
                </div>
              </form>

              {/* Section Encaissements réels (Doc 14 E1) */}
              <div className="space-y-4 pt-4 border-t border-border-subtle">
                <h3 className="text-sm font-semibold text-text-primary">
                  Encaissements réels ({receipts.length})
                </h3>

                {receipts.length > 0 ? (
                  <div className="space-y-2">
                    {receipts.map((r) => (
                      <div
                        key={r.id}
                        className="bg-surface-elevated p-3 rounded-md border border-border-subtle text-xs flex justify-between items-center"
                      >
                        <div>
                          <div className="font-semibold text-text-primary">
                            {(r.amountMinor / 100).toLocaleString("fr-FR", {
                              minimumFractionDigits: 2,
                            })}{" "}
                            {r.currency} · Payé par {r.payerSide}
                          </div>
                          <div className="text-text-secondary mt-0.5">
                            {r.receivedOn} · Mode : {r.paymentMethod}{" "}
                            {r.externalRef ? `· Réf : ${r.externalRef}` : ""}
                          </div>
                          {r.note && (
                            <div className="text-text-secondary italic mt-0.5">
                              « {r.note} »
                            </div>
                          )}
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-2xs uppercase font-medium bg-feedback-success-bg text-feedback-success-text">
                          Encaissé
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-secondary italic">
                    Aucun encaissement enregistré pour l'instant.
                  </p>
                )}

                {/* Formulaire ajout d'encaissement */}
                <form
                  onSubmit={handleAddReceipt}
                  className="bg-surface-elevated p-4 rounded-lg border border-border-subtle space-y-3"
                >
                  <div className="text-xs font-semibold text-text-primary">
                    + Enregistrer un encaissement
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs text-text-secondary mb-1">
                        Montant ({deal?.currency || currency}) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        value={receiptAmount}
                        onChange={(e) => setReceiptAmount(e.target.value)}
                        placeholder="ex: 1000.00"
                        className="w-full bg-surface-page border border-border-subtle rounded-md px-2.5 py-1 text-xs text-text-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-2xs text-text-secondary mb-1">
                        Payeur *
                      </label>
                      <select
                        value={payerSide}
                        onChange={(e) =>
                          setPayerSide(e.target.value as PayerSide)
                        }
                        className="w-full bg-surface-page border border-border-subtle rounded-md px-2.5 py-1 text-xs text-text-primary"
                      >
                        {PAYER_SIDES.map((p) => (
                          <option key={p} value={p}>
                            {p === "advertiser" ? "Annonceur" : "Créateur"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-2xs text-text-secondary mb-1">
                        Moyen de paiement
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full bg-surface-page border border-border-subtle rounded-md px-2.5 py-1 text-xs text-text-primary"
                      >
                        <option value="virement">Virement bancaire</option>
                        <option value="carte">Carte bancaire</option>
                        <option value="cheque">Chèque</option>
                        <option value="autre">Autre</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-2xs text-text-secondary mb-1">
                        Référence externe
                      </label>
                      <input
                        type="text"
                        value={externalRef}
                        onChange={(e) => setExternalRef(e.target.value)}
                        placeholder="ex: VIR-2026-99"
                        className="w-full bg-surface-page border border-border-subtle rounded-md px-2.5 py-1 text-xs text-text-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-2xs text-text-secondary mb-1">
                      Note interne
                    </label>
                    <input
                      type="text"
                      value={receiptNote}
                      onChange={(e) => setReceiptNote(e.target.value)}
                      placeholder="Commentaire sur cet encaissement..."
                      className="w-full bg-surface-page border border-border-subtle rounded-md px-2.5 py-1 text-xs text-text-primary"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={receiptSaving}
                      className="px-3 py-1 bg-feedback-success-text hover:opacity-90 text-white text-xs font-medium rounded-md transition-colors disabled:opacity-50"
                    >
                      {receiptSaving
                        ? "Enregistrement..."
                        : "Valider l'encaissement"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

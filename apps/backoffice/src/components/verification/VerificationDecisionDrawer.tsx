"use client";

import React, { useState } from "react";
import {
  type VerificationRequest,
  type VerificationRejectionReasonCode,
  VERIFICATION_REJECTION_REASONS,
  VERIFICATION_REJECTION_MESSAGES,
} from "@influx/contracts";

export interface VerificationDecisionDrawerProps {
  request: VerificationRequest | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentAgentId?: string;
}

export function VerificationDecisionDrawer({
  request,
  isOpen,
  onClose,
  onSuccess,
  currentAgentId,
}: VerificationDecisionDrawerProps) {
  const [activeTab, setActiveTab] = useState<
    "approve" | "reject" | "reexamine"
  >("approve");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Formulaire d'approbation propriété
  const [observedHandle, setObservedHandle] = useState("");
  const [observedPlatformAccountRef, setObservedPlatformAccountRef] =
    useState("");

  // Formulaire d'approbation audience
  const [observedFollowers, setObservedFollowers] = useState<string>("");
  const [observedPeriodStart, setObservedPeriodStart] = useState<string>("");
  const [observedPeriodEnd, setObservedPeriodEnd] = useState<string>("");
  const [observedEngagement, setObservedEngagement] = useState<string>("");

  // Formulaire de refus
  const [rejectionReasonCode, setRejectionReasonCode] =
    useState<VerificationRejectionReasonCode>("ownership_not_proven");
  const [agentComment, setAgentComment] = useState("");

  // Formulaire de réexamen
  const [reexamineReason, setReexamineReason] = useState("");

  if (!isOpen || !request) return null;

  const isClaimedByMe = Boolean(
    request.status === "in_review" &&
    request.claimedByAgentId === currentAgentId,
  );
  const isClaimedByOther = Boolean(
    request.status === "in_review" &&
    request.claimedByAgentId &&
    request.claimedByAgentId !== currentAgentId,
  );

  // Prise en charge de la demande (Verrou 30 min, RG43, RG64)
  const handleClaim = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch(
        `/api/backoffice/verification/${request.id}/claim`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Échec de la prise en charge");
      }
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  };

  // Soumission de la décision
  const handleDecide = async () => {
    setSubmitting(true);
    setErrorMessage(null);
    try {
      let payload: any = { decision: activeTab };

      if (activeTab === "approve") {
        if (request.requestedLevel === "account_ownership") {
          if (!observedHandle.trim()) {
            throw new Error("L'identifiant @ constaté est obligatoire (RG45)");
          }
          payload.observedHandle = observedHandle.trim();
          if (observedPlatformAccountRef.trim()) {
            payload.observedPlatformAccountRef =
              observedPlatformAccountRef.trim();
          }
        } else {
          // Audience vérifiée
          const followers = parseInt(observedFollowers, 10);
          if (isNaN(followers) || followers < 0) {
            throw new Error(
              "Le nombre d'abonnés constaté doit être un entier positif (RG38)",
            );
          }
          if (!observedPeriodStart || !observedPeriodEnd) {
            throw new Error(
              "La période de capture (début et fin) est obligatoire (RG37)",
            );
          }
          payload.observedFollowers = followers;
          payload.observedPeriodStart = observedPeriodStart;
          payload.observedPeriodEnd = observedPeriodEnd;

          if (observedEngagement.trim()) {
            const eng = parseFloat(observedEngagement);
            if (!isNaN(eng)) {
              payload.observedEngagement = eng;
            }
          }
        }
      } else if (activeTab === "reject") {
        payload.rejectionReasonCode = rejectionReasonCode;
        if (rejectionReasonCode === "other" && !agentComment.trim()) {
          throw new Error(
            "Un commentaire explicatif est obligatoire pour le motif 'Autre' (RG57)",
          );
        }
        if (agentComment.trim()) {
          payload.agentComment = agentComment.trim();
        }
      } else if (activeTab === "reexamine") {
        payload.reexamineReason =
          reexamineReason.trim() ||
          "Incident matériel ou registre externe temporairement indisponible";
      }

      const res = await fetch(
        `/api/backoffice/verification/${request.id}/decide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.message || "Échec de l'enregistrement de la décision",
        );
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur réseau");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-700 h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Entête du tiroir */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {request.id.slice(0, 8)}
              </span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  request.requestedLevel === "account_ownership"
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}
              >
                {request.requestedLevel === "account_ownership"
                  ? "Niveau 1 : Propriété Compte"
                  : "Niveau 2 : Audience Vérifiée"}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              Vérification {request.network.toUpperCase()}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Corps déroulant */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 text-sm text-slate-300">
          {/* Bandeau d'état du verrou (RG43, RG64) */}
          <div
            className={`p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              isClaimedByOther
                ? "bg-rose-950/40 border-rose-800 text-rose-300"
                : isClaimedByMe
                  ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                  : "bg-slate-800/80 border-slate-700 text-slate-300"
            }`}
          >
            <div>
              <p className="font-semibold text-white">
                {isClaimedByOther
                  ? "🔒 En cours de traitement par un autre agent"
                  : isClaimedByMe
                    ? "✓ Verrou actif posé par vous (30 min)"
                    : "○ Demande libre en attente de prise en charge"}
              </p>
              <p className="text-xs opacity-80 mt-0.5">
                {isClaimedByOther
                  ? "Les actions sont bloquées pour éviter tout double traitement (RG64)."
                  : isClaimedByMe
                    ? "Vous disposez de l'exclusivité sur cette entrée pour enregistrer la décision."
                    : "Prenez la demande en charge pour débuter l'examen nominatif (RG43)."}
              </p>
            </div>
            {!isClaimedByMe &&
              !isClaimedByOther &&
              request.status === "pending" && (
                <button
                  onClick={handleClaim}
                  disabled={submitting}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-xs transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                >
                  Prendre en charge
                </button>
              )}
          </div>

          {/* Erreur éventuelle */}
          {errorMessage && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-200 rounded-lg text-xs">
              {errorMessage}
            </div>
          )}

          {/* Rappel des pièces et preuves (RG31, RG46) */}
          <div className="bg-slate-850 p-4 rounded-xl border border-slate-800 flex flex-col gap-3">
            <h3 className="font-semibold text-white text-xs uppercase tracking-wider">
              1. Données de la demande & Preuves
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Compte créateur :</span>
                <span className="font-mono text-slate-200">
                  {request.accountId}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Réseau cible :</span>
                <span className="capitalize text-slate-200">
                  {request.network}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">
                  Date de soumission :
                </span>
                <span className="text-slate-200">
                  {new Date(request.createdAt).toLocaleString("fr-FR")}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">
                  Échéance SLA (1j ouvré) :
                </span>
                <span className="text-slate-200">
                  {new Date(request.slaDueAt).toLocaleString("fr-FR")}
                </span>
              </div>
            </div>

            {request.requestedLevel === "account_ownership" ? (
              <div className="mt-2 p-3 bg-slate-800/80 rounded-lg border border-slate-700 text-xs">
                <p className="font-semibold text-slate-200">
                  Procédure de constat en ligne (RG25, RG45) :
                </p>
                <p className="text-slate-400 mt-1">
                  1. Ouvrez le profil public du réseau {request.network}{" "}
                  <strong>sans être connecté</strong>.
                  <br />
                  2. Constatez la présence du code généré dans la biographie ou
                  description de chaîne.
                  <br />
                  3. Saisissez ci-dessous l&apos;identifiant exact du compte
                  observé en ligne.
                </p>
              </div>
            ) : (
              <div className="mt-2 flex flex-col gap-2">
                <span className="text-xs text-slate-400 font-semibold">
                  Captures d&apos;écran du tableau de bord (
                  {request.evidenceFileIds?.length || 0} fichier(s)) :
                </span>
                {request.evidenceFileIds &&
                request.evidenceFileIds.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {request.evidenceFileIds.map((fId) => (
                      <div
                        key={fId}
                        className="p-3 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-between text-xs"
                      >
                        <span className="font-mono text-slate-300 truncate">
                          Preuve: {fId.slice(0, 12)}...
                        </span>
                        <a
                          href={`/api/storage/files/${fId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-slate-200 text-xs transition-colors"
                        >
                          Ouvrir ▮
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-rose-400">
                    Aucune pièce jointe transmise.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Onglets de décision */}
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-white text-xs uppercase tracking-wider">
              2. Décision de l&apos;agent (RG47, RG49, RG56)
            </h3>

            <div className="flex border-b border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab("approve")}
                className={`px-4 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                  activeTab === "approve"
                    ? "border-emerald-500 text-emerald-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                ✓ Accorder le badge
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("reject")}
                className={`px-4 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                  activeTab === "reject"
                    ? "border-rose-500 text-rose-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                ✕ Refuser la demande
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("reexamine")}
                className={`px-4 py-2 text-xs font-semibold border-b-2 cursor-pointer transition-colors ${
                  activeTab === "reexamine"
                    ? "border-amber-500 text-amber-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                ○ À réexaminer
              </button>
            </div>

            {/* Contenu de l'onglet Approbation */}
            {activeTab === "approve" && (
              <div className="flex flex-col gap-4 bg-slate-850 p-4 rounded-xl border border-slate-800">
                {request.requestedLevel === "account_ownership" ? (
                  <div className="flex flex-col gap-3">
                    <label className="flex flex-col gap-1 text-xs">
                      <span className="font-semibold text-slate-200">
                        Identifiant @ constaté en ligne (RG45) *
                      </span>
                      <input
                        type="text"
                        value={observedHandle}
                        onChange={(e) => setObservedHandle(e.target.value)}
                        placeholder="ex. @LucasTechFR"
                        className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-xs">
                      <span className="font-semibold text-slate-200">
                        Identifiant interne de plateforme (optionnel)
                      </span>
                      <input
                        type="text"
                        value={observedPlatformAccountRef}
                        onChange={(e) =>
                          setObservedPlatformAccountRef(e.target.value)
                        }
                        placeholder="ex. UC123456789"
                        className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="font-semibold text-slate-200">
                        Nombre d&apos;abonnés constaté sur la pièce (RG38, RG47)
                        *
                      </span>
                      <input
                        type="number"
                        min="0"
                        value={observedFollowers}
                        onChange={(e) => setObservedFollowers(e.target.value)}
                        placeholder="ex. 85000"
                        className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="font-semibold text-slate-200">
                        Début de période affichée (YYYY-MM-DD) *
                      </span>
                      <input
                        type="date"
                        value={observedPeriodStart}
                        onChange={(e) => setObservedPeriodStart(e.target.value)}
                        className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="font-semibold text-slate-200">
                        Fin de période affichée (≤ 30j RG31) *
                      </span>
                      <input
                        type="date"
                        value={observedPeriodEnd}
                        onChange={(e) => setObservedPeriodEnd(e.target.value)}
                        className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </label>

                    <label className="flex flex-col gap-1 sm:col-span-2">
                      <span className="font-semibold text-slate-200">
                        Taux d&apos;engagement constaté en % (optionnel, RG38)
                      </span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={observedEngagement}
                        onChange={(e) => setObservedEngagement(e.target.value)}
                        placeholder="ex. 4.2"
                        className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-blue-500"
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Contenu de l'onglet Refus */}
            {activeTab === "reject" && (
              <div className="flex flex-col gap-3 bg-slate-850 p-4 rounded-xl border border-slate-800 text-xs">
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-200">
                    Motif de rejet typé (Liste fermée RG57) *
                  </span>
                  <select
                    value={rejectionReasonCode}
                    onChange={(e) =>
                      setRejectionReasonCode(
                        e.target.value as VerificationRejectionReasonCode,
                      )
                    }
                    className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-rose-500"
                  >
                    {VERIFICATION_REJECTION_REASONS.map((code) => (
                      <option key={code} value={code}>
                        {VERIFICATION_REJECTION_MESSAGES[code]?.label || code}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="p-3 bg-slate-900/80 rounded-lg border border-slate-800 text-slate-400">
                  <span className="text-slate-300 font-semibold block mb-1">
                    Message transmis au créateur :
                  </span>
                  «{" "}
                  {
                    VERIFICATION_REJECTION_MESSAGES[rejectionReasonCode]
                      ?.messageFr
                  }{" "}
                  »
                </div>

                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-200">
                    Commentaire complémentaire de l&apos;agent (obligatoire si
                    motif Autre)
                  </span>
                  <textarea
                    rows={3}
                    value={agentComment}
                    onChange={(e) => setAgentComment(e.target.value)}
                    placeholder="Précisions internes ou motifs..."
                    className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-rose-500"
                  />
                </label>
              </div>
            )}

            {/* Contenu de l'onglet Réexamen */}
            {activeTab === "reexamine" && (
              <div className="flex flex-col gap-3 bg-slate-850 p-4 rounded-xl border border-slate-800 text-xs">
                <p className="text-slate-400">
                  Le réexamen remet l&apos;entrée en file avec son ancienneté
                  courante (RG50), réservé aux blocages techniques indépendants
                  du créateur.
                </p>
                <label className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-200">
                    Motif interne de réexamen
                  </span>
                  <input
                    type="text"
                    value={reexamineReason}
                    onChange={(e) => setReexamineReason(e.target.value)}
                    placeholder="ex. Réseau YouTube en maintenance"
                    className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-amber-500"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Pied d'actions */}
        <div className="p-6 border-t border-slate-800 bg-slate-850 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            Fermer
          </button>

          <button
            type="button"
            disabled={submitting || isClaimedByOther}
            onClick={handleDecide}
            className={`px-6 py-2 rounded-lg text-xs font-semibold text-white transition-colors cursor-pointer disabled:opacity-50 ${
              activeTab === "approve"
                ? "bg-emerald-600 hover:bg-emerald-500"
                : activeTab === "reject"
                  ? "bg-rose-600 hover:bg-rose-500"
                  : "bg-amber-600 hover:bg-amber-500"
            }`}
          >
            {submitting
              ? "Enregistrement..."
              : activeTab === "approve"
                ? request.requestedLevel === "account_ownership"
                  ? "Valider Badge Niveau 1 (Propriété)"
                  : "Valider Badge Niveau 2 (90 jours)"
                : activeTab === "reject"
                  ? "Confirmer le Refus"
                  : "Remettre à réexaminer"}
          </button>
        </div>
      </div>
    </div>
  );
}

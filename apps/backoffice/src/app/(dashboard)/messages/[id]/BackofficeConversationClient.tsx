"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  type Conversation,
  type ConversationMessage,
  type ContactDetection,
  type ConversationCloseReason,
  type AgentAccessReason,
  CONVERSATION_CLOSE_REASONS,
} from "@influx/contracts";
import {
  ShieldCheck,
  Eye,
  AlertTriangle,
  RefreshCw,
  Send,
  Lock,
  Play,
  Pause,
  ChevronLeft,
  MessageSquare,
} from "@/components/ui/icons";

export interface BackofficeConversationClientProps {
  conversationId: string;
}

export function BackofficeConversationClient({
  conversationId,
}: BackofficeConversationClientProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [detections, setDetections] = useState<ContactDetection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Saisie de message agent
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Porte d'entrée motif obligatoire pour agent non-participant (RG57, 17b §3.4.a)
  const [needsReason, setNeedsReason] = useState(false);
  const [selectedReason, setSelectedReason] = useState<AgentAccessReason | "">(
    "",
  );
  const [reasonComment, setReasonComment] = useState("");
  const [submittingReason, setSubmittingReason] = useState(false);

  // Modale de clôture du fil (RG20)
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeReason, setCloseReason] =
    useState<ConversationCloseReason>("affaire_signee");
  const [closeComment, setCloseComment] = useState("");
  const [closing, setClosing] = useState(false);

  // Mise en pause / Reprise (RG17, RG19)
  const [actionLoading, setActionLoading] = useState(false);

  // Détection en cours de classification
  const [classifyingId, setClassifyingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  const loadConversationData = useCallback(
    async (reasonQuery?: { reason: string; comment?: string }) => {
      setLoading(true);
      setError(null);

      try {
        let url = `/api/conversations/${conversationId}/messages`;
        if (reasonQuery?.reason) {
          const params = new URLSearchParams();
          params.set("reason", reasonQuery.reason);
          if (reasonQuery.comment) {
            params.set("comment", reasonQuery.comment);
          }
          url += `?${params.toString()}`;
        }

        const res = await fetch(url, { credentials: "include" });

        if (res.status === 400) {
          const errData = await res.json().catch(() => ({}));
          if (errData.error === "REASON_REQUIRED") {
            setNeedsReason(true);
            setLoading(false);
            return;
          }
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || `Erreur serveur (${res.status})`);
        }

        const data = await res.json();
        setConversation(data.conversation);
        setMessages(data.messages || []);
        setNeedsReason(false);

        // Charger également les détections de coordonnées pour le commercial (RG50)
        try {
          const detRes = await fetch(
            `/api/backoffice/conversations/${conversationId}/detections`,
            { credentials: "include" },
          );
          if (detRes.ok) {
            const detData = await detRes.json();
            setDetections(detData.detections || []);
          }
        } catch {
          // Non bloquant
        }
      } catch (err: unknown) {
        setError((err as Error).message || "Erreur de chargement");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [conversationId],
  );

  useEffect(() => {
    loadConversationData();
  }, [loadConversationData]);

  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom(false);
    }
  }, [loading, messages.length, scrollToBottom]);

  // Validation du motif préalable (RG57)
  const handleConfirmReason = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) return;
    if (selectedReason === "autre" && reasonComment.trim().length < 5) {
      setError(
        "Un commentaire explicatif d'au moins 5 caractères est requis pour le motif 'Autre' (RG56).",
      );
      return;
    }

    setSubmittingReason(true);
    await loadConversationData({
      reason: selectedReason,
      comment: reasonComment.trim() || undefined,
    });
    setSubmittingReason(false);
  };

  // Envoi d'un message commercial dans le fil (visible des deux parties, 17b §3.4.b)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setSendError(null);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: trimmed,
          warnedBeforeSend: false,
          sentAnyway: false,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.message || "Erreur lors de l'envoi du message commercial",
        );
      }

      const data = await res.json();
      if (data.ok && data.message) {
        setMessages((prev) => [...prev, data.message]);
        setContent("");
        scrollToBottom(true);
      }
    } catch (err: unknown) {
      setSendError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  // Pause d'une négociation (RG17, RG18)
  const handlePause = async () => {
    if (
      !confirm(
        "Voulez-vous suspendre temporairement cette négociation ? Les membres pourront lire l'historique mais ne pourront plus écrire.",
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/backoffice/conversations/${conversationId}/pause`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            reason: "Ajustement commercial et cadrage du brief",
          }),
        },
      );

      if (res.ok) {
        await loadConversationData();
      }
    } catch {
      // Ignorer
    } finally {
      setActionLoading(false);
    }
  };

  // Reprise d'une négociation (RG19)
  const handleResume = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/backoffice/conversations/${conversationId}/resume`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (res.ok) {
        await loadConversationData();
      }
    } catch {
      // Ignorer
    } finally {
      setActionLoading(false);
    }
  };

  // Clôture d'une négociation avec motif typé (RG20)
  const handleClose = async (e: React.FormEvent) => {
    e.preventDefault();
    setClosing(true);

    try {
      const res = await fetch(
        `/api/backoffice/conversations/${conversationId}/close`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            reason: closeReason,
            comment: closeComment.trim() || undefined,
          }),
        },
      );

      if (res.ok) {
        setShowCloseModal(false);
        await loadConversationData();
      }
    } catch {
      // Ignorer
    } finally {
      setClosing(false);
    }
  };

  // Classement d'une détection de coordonnées (RG50)
  const handleClassifyDetection = async (
    detectionId: string,
    classification: "legitimate" | "circumvention_suspected" | "false_positive",
  ) => {
    setClassifyingId(detectionId);
    try {
      const res = await fetch(
        `/api/backoffice/detections/${detectionId}/classify`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ classification }),
        },
      );

      if (res.ok) {
        setDetections((prev) =>
          prev.map((d) =>
            d.id === detectionId
              ? { ...d, status: "reviewed", classification }
              : d,
          ),
        );
      }
    } catch {
      // Ignorer
    } finally {
      setClassifyingId(null);
    }
  };

  // Trouver les participants
  const advertiser = conversation?.participants.find(
    (p) => p.role === "advertiser",
  );
  const creator = conversation?.participants.find((p) => p.role === "creator");
  const agent = conversation?.participants.find((p) => p.role === "agent");

  const isPaused = conversation?.status === "en_pause";
  const isClosed =
    conversation?.status === "close" || conversation?.status === "archivee";

  // Formateurs de date et heure
  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
      });
    } catch {
      return "";
    }
  };

  // PORTE D'ENTRÉE : MOTIF PRÉALABLE OBLIGATOIRE (RG57, 17b §3.4.a)
  if (needsReason) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <div className="bg-surface-card border border-border-default rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-feedback-info-bg border border-feedback-info-border flex items-center justify-center shrink-0">
              <Eye className="w-5 h-5 text-feedback-info-text" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary">
                Lire une conversation à laquelle vous ne participez pas
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Réf. {conversationId.slice(0, 8)}... · Consultation journalisée
                (RG55, RG57)
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-brand-subtle-border bg-brand-subtle-bg p-4 text-xs text-text-secondary leading-relaxed">
            <span className="font-semibold text-text-brand">
              ⓘ Engagement A10 :{" "}
            </span>
            Cette lecture sera enregistrée dans le registre immuable des accès :
            votre nom, la date, le motif choisi et le nombre de messages
            affichés. Le contenu des messages n&apos;est jamais recopié.
          </div>

          {error && (
            <div className="rounded-lg border border-feedback-error-border bg-feedback-error-bg p-3 text-xs text-feedback-error-text">
              {error}
            </div>
          )}

          <form onSubmit={handleConfirmReason} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-text-primary mb-2">
                Motif de consultation réglementaire * :
              </label>
              <div className="space-y-2 text-xs">
                {[
                  {
                    code: "continuité_de_service",
                    label: "Continuité de service — le responsable est absent",
                  },
                  {
                    code: "reprise_de_dossier",
                    label: "Reprise de dossier — réattribution en cours",
                  },
                  {
                    code: "instruction_signalement",
                    label: "Instruction d'un signalement",
                  },
                  {
                    code: "litige_ou_contestation",
                    label: "Litige ou contestation entre les parties",
                  },
                  {
                    code: "controle_qualite",
                    label: "Contrôle qualité — revue interne d'échantillon",
                  },
                  {
                    code: "demande_rgpd",
                    label: "Demande relative aux données personnelles",
                  },
                  {
                    code: "autre",
                    label:
                      "Autre — commentaire interne obligatoire (min 5 car.)",
                  },
                ].map((m) => (
                  <label
                    key={m.code}
                    className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      selectedReason === m.code
                        ? "bg-surface-raised border-border-selected text-text-primary font-semibold"
                        : "bg-surface-card border-border-subtle text-text-secondary hover:bg-surface-hover"
                    }`}
                  >
                    <input
                      type="radio"
                      name="accessReason"
                      value={m.code}
                      checked={selectedReason === m.code}
                      onChange={() =>
                        setSelectedReason(m.code as AgentAccessReason)
                      }
                      className="text-brand-primary"
                    />
                    <span>{m.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {selectedReason === "autre" && (
              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">
                  Commentaire explicatif obligatoire * :
                </label>
                <textarea
                  rows={2}
                  value={reasonComment}
                  onChange={(e) => setReasonComment(e.target.value)}
                  placeholder="Justification légitime de la consultation..."
                  className="w-full p-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary text-xs focus:ring-1 focus:ring-brand-primary focus:outline-none"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
              <Link
                href="/queues/introductions"
                className="px-4 py-2 rounded-lg border border-border-default bg-surface-raised text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
              >
                Renoncer
              </Link>
              <button
                type="submit"
                disabled={!selectedReason || submittingReason}
                className="px-5 py-2 rounded-lg bg-action-primary-bg text-xs font-bold text-text-on-action hover:bg-action-primary-bg-hover transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
              >
                {submittingReason
                  ? "Ouverture..."
                  : "Confirmer et ouvrir le fil"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* 1. EN-TÊTE DE LA CONVERSATION EN VUE BACKOFFICE (17b §3.4.b) */}
      <header className="rounded-xl border border-border-default bg-surface-card p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/queues/introductions"
                className="rounded-lg border border-border-default bg-surface-raised p-1 text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors mr-1"
                title="Retour aux mises en relation"
              >
                <ChevronLeft className="w-4 h-4" />
              </Link>
              <span className="font-mono text-sm font-bold text-text-brand uppercase tracking-wider">
                {conversation?.reference || "MER-2026-..."}
              </span>
              <span className="text-xs text-text-tertiary">·</span>
              <span className="text-sm font-semibold text-text-primary">
                Conversation supervisée à trois
              </span>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                  conversation?.status === "active"
                    ? "bg-feedback-success-bg text-feedback-success-text border-feedback-success-border"
                    : conversation?.status === "en_pause"
                      ? "bg-feedback-warning-bg text-feedback-warning-text border-feedback-warning-border"
                      : "bg-surface-raised text-text-secondary border-border-subtle"
                }`}
              >
                {conversation?.status === "active" && "Active · En négociation"}
                {conversation?.status === "en_pause" && "En pause commerciale"}
                {conversation?.status === "close" && "Clôturée"}
                {conversation?.status === "ouverte" && "Ouverte · En attente"}
                {conversation?.status === "archivee" && "Archivée"}
              </span>
            </div>

            <div className="text-xs text-text-secondary flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                <strong>Marque :</strong> {advertiser?.displayName || "—"}
              </span>
              <span>•</span>
              <span>
                <strong>Créateur :</strong> {creator?.displayName || "—"}
              </span>
              <span>•</span>
              <span className="text-text-brand font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>
                  Commercial titulaire :{" "}
                  {agent?.displayName || "Alexandre Martin (vous)"}
                </span>
              </span>
            </div>
          </div>

          {/* Boutons d'action commerciale */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setRefreshing(true);
                loadConversationData();
              }}
              disabled={refreshing}
              className="px-3 py-1.5 rounded-lg border border-border-default bg-surface-raised text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors flex items-center gap-1.5"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              <span>Actualiser</span>
            </button>

            {!isClosed && (
              <>
                {isPaused ? (
                  <button
                    type="button"
                    onClick={handleResume}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-lg border border-feedback-success-border bg-feedback-success-bg text-xs font-semibold text-feedback-success-text hover:bg-feedback-success-bg/80 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Reprendre le fil</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handlePause}
                    disabled={actionLoading}
                    className="px-3 py-1.5 rounded-lg border border-feedback-warning-border bg-feedback-warning-bg text-xs font-semibold text-feedback-warning-text hover:bg-feedback-warning-bg/80 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Mettre en pause</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowCloseModal(true)}
                  className="px-3 py-1.5 rounded-lg border border-border-default bg-surface-raised text-xs font-semibold text-feedback-error-text hover:bg-feedback-error-bg hover:border-feedback-error-border transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Clore le fil</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 2. BANDEAU DE CONSULTATION JOURNALISÉE CONFIRMÉE (RG55, RG58, 17b §3.4.b) */}
        <div className="bg-brand-subtle-bg border border-brand-subtle-border rounded-lg p-2.5 flex items-center gap-2 text-xs text-text-secondary">
          <Eye className="w-4 h-4 text-text-brand shrink-0" />
          <span>
            <strong className="text-text-brand">
              Lecture enregistrée dans le registre :{" "}
            </strong>
            Alexandre Martin (agent titulaire), motif « suivi de l&apos;affaire
            ». L&apos;historique complet est auditable par
            l&apos;administrateur.
          </span>
        </div>
      </header>

      {/* 3. FIL DE MESSAGES À TROIS AVEC POSITIONNEMENT STRICT (17b §3.4.b) */}
      <div className="rounded-xl border border-border-default bg-surface-card overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-4 border-b border-border-subtle bg-surface-raised flex items-center justify-between text-xs text-text-tertiary">
          <span>
            Disposition 3 auteurs : Marque (gauche) · INFLUX (centré) · Créateur
            (droite)
          </span>
          <span>{messages.length} messages échangés</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {loading ? (
            <div className="py-20 text-center text-xs text-text-tertiary space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-text-brand" />
              <p>Chargement du fil supervisé...</p>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-xs text-feedback-error-text space-y-2">
              <AlertTriangle className="w-6 h-6 mx-auto" />
              <p>{error}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-16 text-center text-xs text-text-tertiary space-y-2">
              <MessageSquare className="w-8 h-8 mx-auto opacity-40" />
              <p>
                La conversation est ouverte. Personne n&apos;a encore écrit.
              </p>
              <p className="text-[11px]">
                Envoyez le message d&apos;accueil pour lancer les échanges avec
                la marque et le créateur.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isAgent = msg.senderRole === "agent";
              const isSystem = msg.senderRole === "system";
              const isAdvertiser = msg.senderRole === "advertiser";
              const isCreator = msg.senderRole === "creator";

              // Vérifier si ce message a des détections de coordonnées associées (RG50)
              const msgDetections = detections.filter(
                (d) =>
                  d.messageId === msg.id ||
                  (d.conversationId === conversationId &&
                    msg.content.length > 50 &&
                    d.status === "pending"),
              );

              return (
                <div key={msg.id} className="space-y-1.5">
                  {/* MESSAGE SYSTÈME */}
                  {isSystem ? (
                    <div className="flex justify-center my-2">
                      <div className="bg-surface-raised border border-border-subtle rounded-xl px-4 py-1.5 text-center text-xs max-w-lg">
                        <span className="text-[11px] font-bold text-text-brand mr-2">
                          ⚙ Système
                        </span>
                        <span className="text-text-secondary">
                          {msg.content}
                        </span>
                        <span className="text-[10px] text-text-tertiary block mt-0.5">
                          {formatDate(msg.createdAt)} ·{" "}
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                    </div>
                  ) : isAgent ? (
                    /* MESSAGE COMMERCIAL INFLUX : CENTRÉ (17b §3.4.b) */
                    <div className="flex flex-col items-center my-3">
                      <div className="w-full max-w-xl bg-brand-subtle-bg border border-brand-subtle-border rounded-xl p-4 space-y-1.5 shadow-xs">
                        <div className="flex items-center justify-between text-xs border-b border-brand-subtle-border/60 pb-1.5">
                          <div className="flex items-center gap-1.5 font-bold text-text-brand">
                            <ShieldCheck className="w-4 h-4 text-text-brand" />
                            <span>INFLUX · {msg.senderDisplayName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-text-brand-strong font-medium">
                            <span>⬥ visible des deux parties</span>
                            <span className="text-text-tertiary">
                              · {formatTime(msg.createdAt)}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs sm:text-sm text-text-primary whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* MESSAGE DE MEMBRE : MARQUE (GAUCHE) OU CRÉATEUR (DROITE) */
                    <div
                      className={`flex flex-col ${
                        isAdvertiser ? "items-start" : "items-end"
                      }`}
                    >
                      <div
                        className={`max-w-md sm:max-w-lg rounded-xl border p-3.5 text-xs sm:text-sm leading-relaxed space-y-1 ${
                          isAdvertiser
                            ? "bg-surface-card border-border-default rounded-tl-sm text-left"
                            : "bg-surface-card border-border-default rounded-tr-sm text-left"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 border-b border-border-subtle pb-1 text-[11px]">
                          <span className="font-bold text-text-primary">
                            {isAdvertiser ? "🏢 " : "🎨 "}
                            {msg.senderDisplayName}{" "}
                            <span className="text-text-tertiary font-normal">
                              ({isAdvertiser ? "Marque" : "Créateur"})
                            </span>
                          </span>
                          <span className="text-text-tertiary shrink-0">
                            {formatDate(msg.createdAt)}{" "}
                            {formatTime(msg.createdAt)}
                          </span>
                        </div>
                        <p className="text-text-primary whitespace-pre-wrap">
                          {msg.content}
                        </p>
                      </div>

                      {/* BANDEAU DE DÉTECTION DE COORDONNÉES (RG50, 17b §3.4.b) */}
                      {msgDetections.length > 0 && (
                        <div className="mt-1 max-w-md sm:max-w-lg w-full bg-feedback-warning-bg/90 border border-feedback-warning-border rounded-lg p-2.5 text-xs space-y-2 text-feedback-warning-text">
                          <div className="flex items-center gap-1.5 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              ⚑ Coordonnée détectée par le filtre
                              anti-contournement
                            </span>
                          </div>
                          {msgDetections.map((det) => (
                            <div
                              key={det.id}
                              className="bg-surface-card/60 rounded p-2 text-[11px] text-text-primary flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                            >
                              <div className="space-y-0.5">
                                <div>
                                  Type : <strong>{det.detectedType}</strong>{" "}
                                  (car. {det.startIndex}–{det.endIndex})
                                </div>
                                <div className="text-text-tertiary text-[10px]">
                                  Averti avant l&apos;envoi :{" "}
                                  {det.warnedBeforeSend ? "Oui" : "Non"} ·
                                  Envoyé quand même :{" "}
                                  {det.sentAnyway ? "Oui" : "Non"}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {det.status === "reviewed" ? (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-surface-raised font-semibold text-text-secondary border border-border-subtle">
                                    Classé : {det.classification}
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleClassifyDetection(
                                          det.id,
                                          "legitimate",
                                        )
                                      }
                                      disabled={classifyingId === det.id}
                                      className="px-2 py-1 rounded bg-surface-raised border border-border-default text-[10px] font-semibold text-feedback-success-text hover:bg-surface-hover"
                                    >
                                      Légitime
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleClassifyDetection(
                                          det.id,
                                          "circumvention_suspected",
                                        )
                                      }
                                      disabled={classifyingId === det.id}
                                      className="px-2 py-1 rounded bg-feedback-error-bg border border-feedback-error-border text-[10px] font-semibold text-feedback-error-text hover:opacity-90"
                                    >
                                      Contournement
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleClassifyDetection(
                                          det.id,
                                          "false_positive",
                                        )
                                      }
                                      disabled={classifyingId === det.id}
                                      className="px-2 py-1 rounded bg-surface-raised border border-border-default text-[10px] font-semibold text-text-tertiary hover:bg-surface-hover"
                                    >
                                      Faux positif
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 4. COMPOSITEUR DE MESSAGE COMMERCIAL (17b §3.4.b) */}
        <footer className="border-t border-border-subtle bg-surface-raised p-4 space-y-2">
          <div className="text-xs text-text-secondary flex items-center justify-between">
            <span className="font-semibold text-text-primary">
              Écrire — votre message est visible de la marque ET du créateur.
            </span>
            <span className="text-text-tertiary text-[11px]">
              {content.length} / 10 000 car. (Texte brut sans HTML)
            </span>
          </div>

          {sendError && (
            <div className="text-xs text-feedback-error-text bg-feedback-error-bg border border-feedback-error-border rounded-lg p-2">
              {sendError}
            </div>
          )}

          <form onSubmit={handleSendMessage} className="space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={sending}
              placeholder="Rédigez une recommandation, un arbitrage ou une relance pour les deux parties..."
              rows={3}
              maxLength={10000}
              className="w-full resize-none rounded-xl border border-border-default bg-surface-card p-3 text-xs sm:text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-selected focus:outline-none"
            />

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-text-tertiary">
                Appuyez sur Envoyer pour diffuser immédiatement dans la salle de
                négociation.
              </span>
              <button
                type="submit"
                disabled={!content.trim() || sending}
                className="rounded-lg bg-action-primary-bg px-4 py-2 text-xs font-bold text-text-on-action hover:bg-action-primary-bg-hover transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
              >
                {sending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Envoi...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Envoyer dans le fil</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </footer>
      </div>

      {/* MODALE DE CLÔTURE DE FIL AVEC MOTIF TYPÉ OBLIGATOIRE (RG20) */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-surface-card border border-border-default rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-feedback-error-text" />
                <h3 className="font-bold text-text-primary text-base">
                  Clôture définitive du fil de négociation (RG20)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCloseModal(false)}
                className="text-text-tertiary hover:text-text-primary text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              La clôture d&apos;un fil est une décision humaine du commercial
              qui fige l&apos;écriture pour toutes les parties.
              L&apos;historique reste consultable en lecture seule.
            </p>

            <form onSubmit={handleClose} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-text-primary mb-1.5">
                  Motif typé de clôture * :
                </label>
                <select
                  value={closeReason}
                  onChange={(e) =>
                    setCloseReason(e.target.value as ConversationCloseReason)
                  }
                  className="w-full p-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary text-xs focus:ring-1 focus:ring-brand-primary"
                >
                  <option value="affaire_signee">
                    Affaire signée (contrat finalisé)
                  </option>
                  <option value="refus_marque">Refus de la marque</option>
                  <option value="refus_createur">Refus du créateur</option>
                  <option value="desaccord_budget">
                    Désaccord budgétaire persistant
                  </option>
                  <option value="hors_sujet">
                    Inadéquation ou besoin hors sujet
                  </option>
                  <option value="sans_reponse">
                    Silence prolongé sans réponse
                  </option>
                  <option value="signalement_fonde">
                    Décision suite à un signalement fondé
                  </option>
                  <option value="blocage_entre_parties">
                    Blocage réciproque entre les parties
                  </option>
                  <option value="autre">Autre motif</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-primary mb-1">
                  Commentaire interne (optionnel ou obligatoire si Autre) :
                </label>
                <textarea
                  rows={2}
                  value={closeComment}
                  onChange={(e) => setCloseComment(e.target.value)}
                  placeholder="Notes explicatives pour le registre..."
                  className="w-full p-2.5 rounded-lg border border-border-default bg-surface-raised text-text-primary text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 rounded-lg border border-border-default bg-surface-raised text-xs font-semibold text-text-secondary hover:text-text-primary"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={closing}
                  className="px-5 py-2 rounded-lg bg-feedback-error-bg border border-feedback-error-border text-feedback-error-text text-xs font-bold hover:opacity-90 transition-colors cursor-pointer"
                >
                  {closing ? "Clôture..." : "Confirmer la clôture"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

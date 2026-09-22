"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  type Conversation,
  type ConversationMessage,
  type ConversationParticipant,
  type DetectedSpan,
  type CheckMessageResponse,
} from "@influx/contracts";
import {
  ShieldCheck,
  Eye,
  AlertTriangle,
  Send,
  RefreshCw,
  Clock,
  Info,
  FileText,
  MessageSquare,
  Lock,
  ExternalLink,
  ChevronLeft,
} from "lucide-react";

export interface ThreeWayChatWindowProps {
  conversationId: string;
  currentAccountId: string;
  currentRole: "advertiser" | "creator";
  locale?: string;
  onBack?: () => void;
  onStatusChanged?: (updated: Conversation) => void;
}

function WhatsAppCheckmarks({ read = true }: { read?: boolean }) {
  return (
    <span
      className={`inline-flex items-center ml-1 ${
        read ? "text-[#53bdeb]" : "text-[#8696a0]"
      }`}
      title={read ? "Lu" : "Délivré"}
    >
      <svg
        viewBox="0 0 16 11"
        className="w-3.5 h-2.5 fill-current"
        aria-hidden="true"
      >
        <path d="M11.05.79l-.78-.79-4.97 4.97-1.95-1.95-.78.78 2.73 2.73 5.75-5.74zm4.17 0l-.78-.79-7.1 7.1-1.95-1.95-.78.78 2.73 2.73 7.88-7.87z" />
      </svg>
    </span>
  );
}

export function ThreeWayChatWindow({
  conversationId,
  currentAccountId,
  currentRole,
  locale = "fr",
  onBack,
  onStatusChanged,
}: ThreeWayChatWindowProps) {
  const isEn = locale === "en";

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Saisie du message
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Pré-contrôle coordonnées (RG42, RG43)
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [detectedSpans, setDetectedSpans] = useState<DetectedSpan[]>([]);
  const [warningText, setWarningText] = useState<string | null>(null);

  // Modale déontologie supervision (RG103)
  const [showEthicsModal, setShowEthicsModal] = useState(false);

  // Onglets fil vs documents (RG65, §4.8 M8)
  const [activeTab, setActiveTab] = useState<"chat" | "documents">("chat");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
      });
    }
  }, []);

  const fetchConversationAndMessages = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      setError(null);

      try {
        const res = await fetch(
          `/api/conversations/${conversationId}/messages`,
          {
            credentials: "include",
          },
        );

        if (res.status === 401) {
          setError(
            isEn
              ? "You must be signed in to view this conversation."
              : "Vous devez être connecté pour accéder à cette conversation.",
          );
          return;
        }

        if (res.status === 403) {
          setError(
            isEn
              ? "Access denied. You are not a participant in this conversation."
              : "Accès refusé. Vous ne faites pas partie des participants autorisés.",
          );
          return;
        }

        if (res.status === 404) {
          setError(
            isEn ? "Conversation not found." : "Conversation introuvable.",
          );
          return;
        }

        if (!res.ok) {
          throw new Error(`Erreur API (${res.status})`);
        }

        const data = await res.json();
        if (data.ok) {
          setConversation(data.conversation);
          setMessages(data.messages || []);
          if (onStatusChanged && data.conversation) {
            onStatusChanged(data.conversation);
          }
        }
      } catch (err: unknown) {
        setError(
          (err as Error).message ||
            (isEn
              ? "Failed to load conversation."
              : "Impossible de charger les messages."),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [conversationId, isEn, onStatusChanged],
  );

  useEffect(() => {
    fetchConversationAndMessages();
  }, [fetchConversationAndMessages]);

  useEffect(() => {
    if (!loading && messages.length > 0) {
      scrollToBottom(false);
    }
  }, [loading, messages.length, scrollToBottom]);

  // Exécution de l'envoi effectif vers l'API
  const doSendMessage = async (
    warnedBeforeSend = false,
    sentAnyway = false,
  ) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    setSending(true);
    setSendError(null);

    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: trimmed,
          warnedBeforeSend,
          sentAnyway,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          errJson.message ||
            (isEn
              ? "Failed to send message"
              : "Erreur lors de l'envoi du message"),
        );
      }

      const data = await res.json();
      if (data.ok && data.message) {
        setMessages((prev) => [...prev, data.message]);
        setContent("");
        setShowWarningModal(false);
        setDetectedSpans([]);
        scrollToBottom(true);
      }
    } catch (err: unknown) {
      setSendError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  // Déclencheur du bouton Envoyer : pré-contrôle non bloquant RG42-RG44
  const handleInitiateSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setSendError(null);

    try {
      // 1. Pré-contrôle côté serveur
      const checkRes = await fetch(
        `/api/conversations/${conversationId}/messages/check`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ content: trimmed }),
        },
      );

      if (checkRes.ok) {
        const checkData: CheckMessageResponse & { ok: boolean } =
          await checkRes.json();

        if (checkData.hasDetections && checkData.detections.length > 0) {
          // Avertissement non bloquant (RG43)
          setDetectedSpans(checkData.detections);
          setWarningText(checkData.warningMessage || null);
          setShowWarningModal(true);
          setSending(false);
          return;
        }
      }

      // Si pas de détections, envoi direct
      await doSendMessage(false, false);
    } catch (err: unknown) {
      setSendError((err as Error).message);
      setSending(false);
    }
  };

  // Trouver les 3 participants typés
  const advertiser = conversation?.participants.find(
    (p) => p.role === "advertiser",
  );
  const creator = conversation?.participants.find((p) => p.role === "creator");
  const agent = conversation?.participants.find((p) => p.role === "agent");

  const isPaused = conversation?.status === "en_pause";
  const isClosed =
    conversation?.status === "close" || conversation?.status === "archivee";

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case "ouverte":
        return {
          label: isEn
            ? "Open · Waiting for first message"
            : "Ouverte · En attente",
          className:
            "bg-feedback-info-bg border border-feedback-info-border text-feedback-info-text",
        };
      case "active":
        return {
          label: isEn ? "Active · In negotiation" : "Active · En négociation",
          className:
            "bg-feedback-success-bg border border-feedback-success-border text-feedback-success-text",
        };
      case "en_pause":
        return {
          label: isEn
            ? "Paused by INFLUX advisor"
            : "En pause par le commercial",
          className:
            "bg-feedback-warning-bg border border-feedback-warning-border text-feedback-warning-text",
        };
      case "close":
        return {
          label: isEn ? "Closed" : "Clôturée",
          className:
            "bg-surface-raised border border-border-subtle text-text-tertiary",
        };
      case "archivee":
        return {
          label: isEn ? "Archived" : "Archivée",
          className:
            "bg-surface-raised border border-border-subtle text-text-tertiary",
        };
      default:
        return {
          label: status || "—",
          className:
            "bg-surface-raised border border-border-subtle text-text-secondary",
        };
    }
  };

  const statusBadge = getStatusBadge(conversation?.status);

  const formatMessageTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString(isEn ? "en-US" : "fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const formatMessageDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(isEn ? "en-US" : "fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  // Libellés conviviaux pour les types détectés
  const getDetectionTypeLabel = (type: string) => {
    switch (type) {
      case "email":
        return isEn ? "E-mail address" : "Adresse e-mail";
      case "phone":
        return isEn ? "Phone number" : "Numéro de téléphone";
      case "social_handle":
        return isEn
          ? "Social media handle (@)"
          : "Identifiant de réseau social (@)";
      case "messaging_link":
        return isEn
          ? "External messaging link (WhatsApp, Telegram)"
          : "Lien de messagerie externe (WhatsApp, Telegram)";
      case "iban":
        return isEn
          ? "Bank account number / IBAN"
          : "Coordonnées bancaires / IBAN";
      case "external_url":
        return isEn ? "External web link" : "Lien web externe";
      default:
        return type;
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-card border border-border-default rounded-xl shadow-sm overflow-hidden min-h-[640px]">
      {/* 1. EN-TÊTE PERMANENT DU FIL À TROIS (RG28) */}
      <header className="border-b border-border-subtle bg-surface-raised px-4 py-3 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="rounded-lg border border-border-default bg-surface-card p-1.5 text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
                aria-label={isEn ? "Back to list" : "Retour à la liste"}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold tracking-wider text-text-brand uppercase">
                  {conversation?.reference || "MER-2026-..."}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${statusBadge.className}`}
                >
                  {statusBadge.label}
                </span>
              </div>
              <h2 className="text-sm font-semibold text-text-primary mt-0.5">
                {isEn
                  ? "Three-Party Negotiation"
                  : "Négociation & Mise en Relation"}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchConversationAndMessages(true)}
              disabled={refreshing}
              className="rounded-lg border border-border-default bg-surface-card px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors flex items-center gap-1.5"
              title={isEn ? "Refresh messages" : "Actualiser les échanges"}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">
                {isEn ? "Refresh" : "Actualiser"}
              </span>
            </button>
          </div>
        </div>

        {/* CARTES DES 3 PARTICIPANTS NOMMÉS (RG2, RG3, RG4, RG5, RG7) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-border-subtle text-xs">
          {/* Annonceur / Marque */}
          <div
            className={`p-2 rounded-lg border flex items-center gap-2 ${
              currentRole === "advertiser"
                ? "bg-brand-subtle-bg border-brand-subtle-border"
                : "bg-surface-card border-border-subtle"
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-surface-raised flex items-center justify-center font-bold text-text-secondary shrink-0">
              🏢
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-text-primary truncate">
                  {advertiser?.displayName ||
                    (isEn ? "Advertiser" : "Annonceur")}
                </span>
                {currentRole === "advertiser" && (
                  <span className="text-[10px] text-text-brand font-medium">
                    ({isEn ? "You" : "Vous"})
                  </span>
                )}
              </div>
              <div className="text-[11px] text-text-tertiary">
                {isEn ? "Brand" : "Marque"}
              </div>
            </div>
          </div>

          {/* Créateur */}
          <div
            className={`p-2 rounded-lg border flex items-center gap-2 ${
              currentRole === "creator"
                ? "bg-brand-subtle-bg border-brand-subtle-border"
                : "bg-surface-card border-border-subtle"
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-surface-raised flex items-center justify-center font-bold text-text-secondary shrink-0">
              🎨
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-text-primary truncate">
                  {creator?.displayName || (isEn ? "Creator" : "Créateur")}
                </span>
                {currentRole === "creator" && (
                  <span className="text-[10px] text-text-brand font-medium">
                    ({isEn ? "You" : "Vous"})
                  </span>
                )}
              </div>
              <div className="text-[11px] text-text-tertiary">
                {isEn ? "Creator" : "Créateur"}
              </div>
            </div>
          </div>

          {/* Commercial INFLUX */}
          <div className="p-2 rounded-lg border bg-brand-subtle-bg border-brand-subtle-border flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-brand-subtle-bg border border-brand-subtle-border flex items-center justify-center shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-text-brand truncate">
                  {agent?.displayName || "Alexandre — INFLUX"}
                </span>
              </div>
              <div className="text-[11px] text-text-brand-strong font-medium">
                {isEn ? "INFLUX Commercial Advisor" : "Commercial INFLUX dédié"}
              </div>
            </div>
          </div>
        </div>

        {/* 2. BANDEAU DE SUPERVISION PERMANENT (RG31, RG102) */}
        <div className="mt-3 bg-brand-subtle-bg border border-brand-subtle-border rounded-lg p-2.5 flex items-start gap-2.5">
          <Eye className="w-4 h-4 text-text-brand shrink-0 mt-0.5" />
          <div className="text-xs text-text-secondary leading-relaxed flex-1">
            <span className="font-medium text-text-primary">
              {isEn ? "Supervised thread: " : "Fil supervisé par INFLUX : "}
            </span>
            {isEn
              ? "Alexandre participates in this negotiation and ensures quality of execution. All messages are delivered in real time without prior censorship. Every internal view is audited and timestamped."
              : "Alexandre suit vos échanges pour vous accompagner et garantir le cadre d'exécution. Vos messages partent en direct sans modération préalable. Chaque consultation interne fait l'objet d'un journal d'accès horodaté."}
          </div>
          <button
            type="button"
            onClick={() => setShowEthicsModal(true)}
            className="text-xs font-semibold text-text-brand hover:underline shrink-0 ml-1"
          >
            {isEn ? "Details" : "En savoir plus"}
          </button>
        </div>

        {/* SÉLECTEUR D'ONGLETS : FIL VS DOCUMENTS (RG65, §4.8 M8) */}
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === "chat"
                ? "bg-surface-card text-text-primary border border-border-default shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>
              {isEn ? "Discussion Thread" : "Fil de discussion"} (
              {messages.length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("documents")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === "documents"
                ? "bg-surface-card text-text-primary border border-border-default shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isEn ? "Controlled Documents" : "Canal Documents M8"}</span>
          </button>
        </div>
      </header>

      {/* 3. CONTENU PRINCIPAL : FIL DE DISCUSSION OU DOCUMENTS */}
      {activeTab === "documents" ? (
        // PANNEAU CANAL DE DOCUMENTS (docs/mvp/17-parcours-et-ecrans-espaces-membres.md §4.8 M8)
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="bg-surface-raised border border-border-default rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-text-brand" />
                <h3 className="font-bold text-text-primary text-sm">
                  {isEn
                    ? "Controlled Documents Channel"
                    : "Canal de Documents Contrôlés (M8)"}
                </h3>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">
                {isEn
                  ? "Images only (PNG, JPEG, WebP). Contracts, quotes and invoices do NOT pass through this channel (RG68, RG70). A message is sent immediately; a document is inspected by the INFLUX team before being made available to the other party."
                  : "Images uniquement (PNG, JPEG, WebP). Les contrats, devis et factures ne passent pas par ce canal (RG68, RG70). Contrairement à un message qui part immédiatement, un document partagé est contrôlé par l'équipe commerciale INFLUX avant mise à disposition de l'autre partie."}
              </p>
            </div>

            <div className="border border-dashed border-border-default rounded-xl p-8 text-center bg-surface-card space-y-2">
              <Clock className="w-8 h-8 mx-auto text-text-tertiary" />
              <h4 className="text-xs font-semibold text-text-primary">
                {isEn
                  ? "No documents currently shared"
                  : "Aucun document n'a encore été déposé sur ce fil"}
              </h4>
              <p className="text-[11px] text-text-tertiary max-w-md mx-auto">
                {isEn
                  ? "Moodboards, visual references or creative briefs can be uploaded here during negotiation."
                  : "Les moodboards, visuels de cadrage ou briefs détaillés partagés ici seront modérés par Alexandre avant diffusion bilatérale."}
              </p>
            </div>
          </div>
        </div>
      ) : (
        // FIL DE MESSAGES À TROIS EN STYLE WHATSAPP DARK
        <div className="flex-1 flex flex-col min-h-0 rounded-2xl border border-[#2a3942] bg-[#0b141a] overflow-hidden shadow-2xl relative">
          {/* Motif subtil doodle WhatsApp */}
          <svg
            className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
            width="100%"
            height="100%"
          >
            <defs>
              <pattern
                id="wa-member-chat-bg"
                width="80"
                height="80"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M15 10 L25 10 L20 20 Z M45 40 L55 40 L50 50 Z M40 15 A5 5 0 1 1 30 15 A5 5 0 1 1 40 15 Z"
                  fill="currentColor"
                  className="text-white"
                />
                <circle
                  cx="10"
                  cy="45"
                  r="3"
                  fill="currentColor"
                  className="text-white"
                />
                <circle
                  cx="65"
                  cy="25"
                  r="3"
                  fill="currentColor"
                  className="text-white"
                />
                <rect
                  x="50"
                  y="55"
                  width="8"
                  height="8"
                  rx="2"
                  fill="currentColor"
                  className="text-white"
                />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#wa-member-chat-bg)" />
          </svg>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 relative z-10">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16 space-y-3 text-[#8696a0]">
                <RefreshCw className="w-6 h-6 animate-spin text-[#00a884]" />
                <span className="text-xs">
                  {isEn
                    ? "Loading messages..."
                    : "Chargement des échanges WhatsApp..."}
                </span>
              </div>
            ) : error ? (
              <div className="rounded-xl border border-feedback-error-border bg-feedback-error-bg p-4 text-center space-y-2">
                <AlertTriangle className="w-5 h-5 mx-auto text-feedback-error-text" />
                <p className="text-xs text-feedback-error-text font-medium">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => fetchConversationAndMessages()}
                  className="px-3 py-1 bg-surface-card border border-border-default rounded text-xs font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
                >
                  {isEn ? "Retry" : "Réessayer"}
                </button>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 space-y-2 text-[#8696a0]">
                <MessageSquare className="w-8 h-8 mx-auto opacity-50 text-[#00a884]" />
                <p className="text-xs">
                  {isEn
                    ? "Conversation is open. Send the first message to start negotiation!"
                    : "La conversation est ouverte. Présentez-vous pour initier la négociation !"}
                </p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isMe = msg.senderAccountId === currentAccountId;
                const isAgent = msg.senderRole === "agent";
                const isSystem = msg.senderRole === "system";

                // Séparateur de date si premier message ou jour différent
                const prevMsg = index > 0 ? messages[index - 1] : undefined;
                const showDateSeparator =
                  index === 0 ||
                  (prevMsg !== undefined &&
                    formatMessageDate(msg.createdAt) !==
                      formatMessageDate(prevMsg.createdAt));

                return (
                  <React.Fragment key={msg.id}>
                    {showDateSeparator && (
                      <div className="flex items-center justify-center my-3">
                        <span className="bg-[#182229]/95 border border-[#222e35] rounded-lg px-3 py-0.5 text-[10px] font-semibold text-[#8696a0] shadow-xs">
                          {formatMessageDate(msg.createdAt)}
                        </span>
                      </div>
                    )}

                    {/* MESSAGE SYSTÈME (RG14) : PILULE CENTRÉE DISCRÈTE STYLE WHATSAPP */}
                    {isSystem ? (
                      <div className="flex justify-center my-2 px-4">
                        <div className="bg-[#182229]/90 border border-[#222e35] rounded-lg px-3.5 py-1 text-center max-w-md shadow-xs">
                          <p className="text-[11px] text-[#8696a0] leading-relaxed">
                            {msg.content}
                          </p>
                          <span className="text-[10px] text-[#8696a0]/60 block mt-0.5">
                            {formatMessageTime(msg.createdAt)}
                          </span>
                        </div>
                      </div>
                    ) : isAgent ? (
                      /* MESSAGE OFFICIEL DU COMMERCIAL INFLUX : BULLE CENTRÉE */
                      <div className="flex flex-col items-center my-3">
                        <div className="max-w-[92%] sm:max-w-xl w-full bg-[#182229] border border-[#00a884]/40 rounded-2xl p-4 shadow-lg text-left relative">
                          <div className="flex items-center justify-between text-xs border-b border-[#222e35] pb-2 mb-2">
                            <div className="flex items-center gap-1.5 font-bold text-[#00a884]">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] shrink-0 inline-block" />
                              <span>INFLUX · {msg.senderDisplayName}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                {isEn
                                  ? "visible to both parties"
                                  : "⬥ visible des deux parties"}
                              </span>
                              <span className="text-[10px] text-[#8696a0]">
                                {formatMessageTime(msg.createdAt)}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs sm:text-sm text-[#e9edef] whitespace-pre-wrap leading-relaxed">
                            {msg.content}
                          </p>
                          <div className="flex items-center justify-end gap-1 text-[10px] text-[#8696a0] mt-1.5">
                            <span>{formatMessageTime(msg.createdAt)}</span>
                            <WhatsAppCheckmarks read={true} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* BULLE DE MESSAGE : MOI (DROITE VERT WHATSAPP) OU AUTRE PARTIE (GAUCHE GRIS WHATSAPP) */
                      <div
                        className={`flex flex-col ${
                          isMe ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] sm:max-w-[70%] w-fit p-3 sm:p-3.5 shadow-md text-left relative space-y-1 ${
                            isMe
                              ? "bg-[#005c4b] border border-[#02735e]/60 rounded-2xl rounded-tr-xs"
                              : "bg-[#202c33] border border-[#2a3942]/60 rounded-2xl rounded-tl-xs"
                          }`}
                        >
                          {/* En-tête de bulle avec rôle */}
                          <div className="flex items-center justify-between gap-3 text-xs pb-0.5">
                            {isMe ? (
                              <span className="font-bold text-xs text-[#53bdeb]">
                                {isEn ? "You" : "Vous"}{" "}
                                <span className="text-emerald-200/70 font-normal text-[10px]">
                                  (
                                  {currentRole === "advertiser"
                                    ? isEn
                                      ? "Brand"
                                      : "Marque"
                                    : isEn
                                      ? "Creator"
                                      : "Créateur"}
                                  )
                                </span>
                              </span>
                            ) : (
                              <span className="font-bold text-xs text-[#f19e38]">
                                {msg.senderDisplayName}{" "}
                                <span className="text-[#8696a0] font-normal text-[10px]">
                                  (
                                  {msg.senderRole === "advertiser"
                                    ? isEn
                                      ? "Brand"
                                      : "Marque"
                                    : isEn
                                      ? "Creator"
                                      : "Créateur"}
                                  )
                                </span>
                              </span>
                            )}
                          </div>

                          {/* Corps du message */}
                          <p className="text-xs sm:text-sm text-[#e9edef] whitespace-pre-wrap leading-relaxed">
                            {msg.content}
                          </p>

                          {/* Horodatage & Doubles coches WhatsApp */}
                          <div
                            className={`flex items-center justify-end gap-1 text-[10px] mt-1 pt-0.5 ${
                              isMe ? "text-emerald-200/70" : "text-[#8696a0]"
                            }`}
                          >
                            <span>{formatMessageTime(msg.createdAt)}</span>
                            <WhatsAppCheckmarks read={true} />
                          </div>
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 4. COMPOSITEUR DE MESSAGE WHATSAPP (RG35, RG36, RG39, RG42-RG48) */}
          <footer className="border-t border-[#2a3942] bg-[#202c33] p-3 sm:p-4 relative z-10">
            {isPaused ? (
              <div className="rounded-xl border border-feedback-warning-border bg-feedback-warning-bg p-4 flex items-center gap-3">
                <Lock className="w-5 h-5 text-feedback-warning-text shrink-0" />
                <div className="text-xs text-feedback-warning-text leading-relaxed">
                  <span className="font-bold">
                    {isEn ? "Negotiation Paused: " : "Négociation suspendue : "}
                  </span>
                  {isEn
                    ? "This discussion is temporarily suspended by your INFLUX commercial advisor. You can read the history, but writing is currently reserved for the agent."
                    : "Cette négociation a été temporairement suspendue par votre commercial INFLUX. Vous pouvez consulter l'historique complet mais l'écriture est réservée à l'agent le temps d'ajuster le cadrage (RG18, RG39)."}
                </div>
              </div>
            ) : isClosed ? (
              <div className="rounded-xl border border-[#2a3942] bg-[#111b21] p-4 flex items-center gap-3">
                <Lock className="w-5 h-5 text-[#8696a0] shrink-0" />
                <div className="text-xs text-[#8696a0] leading-relaxed">
                  <span className="font-bold text-[#e9edef]">
                    {isEn
                      ? "Conversation Closed: "
                      : "Conversation clôturée : "}
                  </span>
                  {isEn
                    ? "This negotiation has ended. The full history remains available in read-only mode."
                    : "Cette négociation est terminée. L'historique complet reste consultable en lecture seule (RG20)."}
                </div>
              </div>
            ) : (
              <form onSubmit={handleInitiateSend} className="space-y-2">
                {sendError && (
                  <div className="text-xs text-feedback-error-text bg-feedback-error-bg border border-feedback-error-border rounded-xl p-2.5 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{sendError}</span>
                  </div>
                )}

                <div className="flex items-end gap-2.5">
                  <div className="flex-1 relative">
                    <textarea
                      ref={textareaRef}
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          handleInitiateSend(e);
                        }
                      }}
                      placeholder={
                        currentRole === "advertiser"
                          ? isEn
                            ? "Write to the creator and your INFLUX advisor (Ctrl+Enter to send)..."
                            : "Écrire un message au créateur et à votre commercial INFLUX (Ctrl+Entrée)..."
                          : isEn
                            ? "Write to the brand and your INFLUX advisor (Ctrl+Enter to send)..."
                            : "Écrire un message à la marque et à votre commercial INFLUX (Ctrl+Entrée)..."
                      }
                      rows={2}
                      maxLength={10000}
                      disabled={sending}
                      className="w-full resize-none rounded-2xl border border-[#2a3942] bg-[#2a3942] p-3 text-xs sm:text-sm text-[#e9edef] placeholder:text-[#8696a0] focus:border-[#00a884] focus:outline-none focus:ring-1 focus:ring-[#00a884] transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!content.trim() || sending}
                    title={isEn ? "Send" : "Envoyer"}
                    aria-label={isEn ? "Send" : "Envoyer"}
                    className="w-11 h-11 rounded-full bg-[#00a884] hover:bg-[#00c39a] text-white flex items-center justify-center shadow-lg transition-transform hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed shrink-0 cursor-pointer mb-0.5"
                  >
                    {sending ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5 ml-0.5" />
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#8696a0] px-1">
                  <span>
                    {content.length} / 10 000 {isEn ? "chars" : "caractères"}
                  </span>
                  <span className="hidden sm:inline">
                    {isEn
                      ? "• Text only · Moderated tripartite exchange"
                      : "• Échange supervisé à 3 · Conforme RG36"}
                  </span>
                </div>
              </form>
            )}
          </footer>
        </div>
      )}

      {/* 5. MODALE D'AVERTISSEMENT COORDONNÉES PRÉALABLE À L'ENVOI (RG43) */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-scrim p-4">
          <div className="bg-surface-card border border-feedback-warning-border rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-feedback-warning-bg flex items-center justify-center shrink-0 border border-feedback-warning-border">
                <AlertTriangle className="w-5 h-5 text-feedback-warning-text" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-text-primary text-sm sm:text-base">
                  {isEn
                    ? "⚠️ Before sending your message"
                    : "⚠️ Avant d'envoyer votre message"}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {isEn
                    ? "Your message contains elements that resemble direct contact coordinates (phone number, e-mail, external messaging or social handle)."
                    : "Votre message contient des éléments qui ressemblent à des coordonnées directes (numéro de téléphone, adresse e-mail, réseau social ou messagerie tierce)."}
                </p>
              </div>
            </div>

            {/* Éléments détectés */}
            <div className="bg-surface-raised border border-border-default rounded-xl p-3.5 space-y-2">
              <div className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
                {isEn ? "Detected elements:" : "Éléments détectés :"}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detectedSpans.map((span, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded bg-feedback-warning-bg border border-feedback-warning-border px-2 py-0.5 text-xs font-semibold text-feedback-warning-text"
                  >
                    <span>•</span>
                    <span>{getDetectionTypeLabel(span.detectedType)}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Avertissement bienveillant non menaçant (RG43) */}
            <p className="text-xs text-text-secondary leading-relaxed bg-brand-subtle-bg border border-brand-subtle-border rounded-lg p-3">
              {warningText ||
                (isEn
                  ? "All negotiation exchanges take place here. Outside of INFLUX, we can no longer assist you, guarantee deliverable tracking or intervene in case of dispute."
                  : "Les échanges se passent ici. En dehors, INFLUX ne peut plus vous accompagner, garantir la traçabilité des livrables ni intervenir en cas de problème.")}
            </p>

            {/* Boutons d'action : Modifier vs Envoyer quand même */}
            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => {
                  setShowWarningModal(false);
                  textareaRef.current?.focus();
                }}
                className="w-full sm:w-auto px-4 py-2 rounded-lg border border-border-default bg-surface-raised text-xs font-semibold text-text-primary hover:bg-surface-hover transition-colors cursor-pointer text-center"
              >
                {isEn ? "Edit my message" : "Modifier mon message"}
              </button>

              <button
                type="button"
                onClick={() => doSendMessage(true, true)}
                disabled={sending}
                className="w-full sm:w-auto px-4 py-2 rounded-lg bg-action-primary-bg text-xs font-bold text-text-on-action hover:bg-action-primary-bg-hover transition-colors shadow-sm disabled:opacity-50 cursor-pointer text-center"
              >
                {sending
                  ? isEn
                    ? "Sending..."
                    : "Envoi..."
                  : isEn
                    ? "Send anyway"
                    : "Envoyer quand même"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. MODALE DÉONTOLOGIE DE LA SUPERVISION (RG103) */}
      {showEthicsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay-scrim p-4">
          <div className="bg-surface-card border border-border-default rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-text-brand" />
                <h3 className="font-bold text-text-primary text-base">
                  {isEn
                    ? "INFLUX Supervision Commitments"
                    : "Engagements Déontologiques de Supervision"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEthicsModal(false)}
                className="text-text-tertiary hover:text-text-primary text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-text-secondary space-y-3 leading-relaxed">
              <div className="bg-surface-raised border border-border-subtle rounded-xl p-3.5 space-y-2">
                <div className="font-semibold text-text-primary flex items-center gap-1.5">
                  <span>1.</span>
                  <span>
                    {isEn
                      ? "Commercial Intermediation & Support"
                      : "Accompagnement commercial dédié"}
                  </span>
                </div>
                <p>
                  {isEn
                    ? "Your assigned INFLUX agent is a full participant in this negotiation. They assist you in scoping deliverables, ensuring fairness and establishing contract agreements."
                    : "Votre commercial INFLUX participe au fil pour sécuriser le partenariat, fluidifier le cadrage des livrables et acter les conditions financières sans commissions applicatives automatisées."}
                </p>
              </div>

              <div className="bg-surface-raised border border-border-subtle rounded-xl p-3.5 space-y-2">
                <div className="font-semibold text-text-primary flex items-center gap-1.5">
                  <span>2.</span>
                  <span>
                    {isEn
                      ? "Instant & Uncensored Delivery"
                      : "Instantanéité des échanges"}
                  </span>
                </div>
                <p>
                  {isEn
                    ? "Your messages are delivered directly and in real time without prior censorship or delays."
                    : "Chaque message part immédiatement vers vos interlocuteurs sans blocage préalable ni délai de modération artificielle."}
                </p>
              </div>

              <div className="bg-surface-raised border border-border-subtle rounded-xl p-3.5 space-y-2">
                <div className="font-semibold text-text-primary flex items-center gap-1.5">
                  <span>3.</span>
                  <span>
                    {isEn
                      ? "Protection against Circumvention"
                      : "Bienveillance anti-contournement"}
                  </span>
                </div>
                <p>
                  {isEn
                    ? "Direct coordinates (phone numbers, external chat links) trigger a gentle advisory warning to maintain full warranty and dispute resolution assistance."
                    : "Les coordonnées directes font l'objet d'un avertissement bienveillant afin d'éviter la sortie de plateforme et de garantir l'assistance juridique en cas de litige."}
                </p>
              </div>

              <div className="bg-surface-raised border border-border-subtle rounded-xl p-3.5 space-y-2">
                <div className="font-semibold text-text-primary flex items-center gap-1.5">
                  <span>4.</span>
                  <span>
                    {isEn
                      ? "Strict Read Audit Log (RG55-RG58)"
                      : "Traçabilité intégrale des lectures"}
                  </span>
                </div>
                <p>
                  {isEn
                    ? "Every internal view by an agent or administrator is recorded in an immutable access log with mandatory regulatory justification."
                    : "Toute consultation de ce fil par un agent INFLUX est obligatoirement consignée dans un registre immuable avec motif légitime. Le contenu des messages n'est jamais stocké dans ce registre."}
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={() => setShowEthicsModal(false)}
                className="px-4 py-2 rounded-lg bg-action-primary-bg text-xs font-bold text-text-on-action hover:bg-action-primary-bg-hover transition-colors shadow-sm cursor-pointer"
              >
                {isEn ? "I Understand" : "J'ai compris"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { type Conversation } from "@influx/contracts";
import { ThreeWayChatWindow } from "./ThreeWayChatWindow";
import {
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronRight,
} from "lucide-react";

export interface MemberMessagingHubProps {
  role: "advertiser" | "creator";
  locale?: string;
  initialConversationId?: string;
}

function WhatsAppCheckmarks({ read = true }: { read?: boolean }) {
  return (
    <span
      className={`inline-flex items-center shrink-0 mr-1 ${
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

function formatWhatsAppListItemTime(isoString?: string | null): string {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return "Hier";
    }

    const diffDays = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays < 7) {
      return date.toLocaleDateString("fr-FR", { weekday: "short" });
    }

    return date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return "";
  }
}

export function MemberMessagingHub({
  role,
  locale = "fr",
  initialConversationId,
}: MemberMessagingHubProps) {
  const isEn = locale === "en";

  const [currentAccountId, setCurrentAccountId] = useState<string>("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(initialConversationId || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "active" | "closed">(
    "all",
  );

  // 1. Récupération du compte connecté
  const fetchAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const account = data.account || data.user;
        if (account?.id) {
          setCurrentAccountId(account.id);
        }
      }
    } catch {
      // Ignorer
    }
  }, []);

  // 2. Récupération de la liste des conversations du membre
  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/conversations/my", {
        credentials: "include",
      });

      if (res.status === 401) {
        setError(
          isEn
            ? "Please sign in to access your supervised conversations."
            : "Veuillez vous connecter pour accéder à vos négociations supervisées.",
        );
        return;
      }

      if (!res.ok) {
        throw new Error(`Erreur API (${res.status})`);
      }

      const data = await res.json();
      const list: Conversation[] = data.conversations || [];
      setConversations(list);

      // Si aucune conversation sélectionnée mais qu'il y en a, sélectionner la première
      if (list.length > 0) {
        setSelectedConversationId((prev) => {
          if (prev && list.some((c) => c.id === prev)) return prev;
          return list[0]?.id || null;
        });
      }
    } catch (err: unknown) {
      setError(
        (err as Error).message ||
          (isEn
            ? "Failed to load conversations."
            : "Impossible de charger la liste des conversations."),
      );
    } finally {
      setLoading(false);
    }
  }, [isEn]);

  useEffect(() => {
    fetchAuth();
    fetchConversations();
  }, [fetchAuth, fetchConversations]);

  // 3. Déclencheur du seed démo 1-clic pour le prototype
  const handleSeedDemoConversation = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/dev/seed-conversations", {
        method: "POST",
      });
      if (res.ok) {
        setSeedSuccess(true);
        await fetchConversations();
        setSelectedConversationId("e1111111-e111-4111-8111-111111111111");
        setTimeout(() => setSeedSuccess(false), 4000);
      }
    } catch {
      // Ignorer
    } finally {
      setSeeding(false);
    }
  };

  // Filtrage des conversations (recherche textuelle + onglet d'état)
  const filteredConversations = conversations.filter((conv) => {
    if (
      filterTab === "active" &&
      conv.status !== "active" &&
      conv.status !== "ouverte"
    ) {
      return false;
    }
    if (
      filterTab === "closed" &&
      conv.status !== "close" &&
      conv.status !== "archivee"
    ) {
      return false;
    }
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase().trim();
    const otherParty = conv.participants.find(
      (p) =>
        p.role !== "agent" &&
        (role === "advertiser"
          ? p.role === "creator"
          : p.role === "advertiser"),
    );
    const nameMatch = otherParty?.displayName.toLowerCase().includes(query);
    const refMatch = conv.reference.toLowerCase().includes(query);
    const lastMsgMatch = conv.lastMessage?.content
      .toLowerCase()
      .includes(query);
    return nameMatch || refMatch || lastMsgMatch;
  });

  return (
    <div className="space-y-6">
      {/* BANNIÈRE DE CONNEXION RAPIDE OU NOTIFICATION SEED */}
      {seedSuccess && (
        <div className="rounded-xl border border-feedback-success-border bg-feedback-success-bg p-4 flex items-center gap-3 text-xs text-feedback-success-text shadow-sm">
          <Sparkles className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>
            {isEn
              ? "Demo conversation loaded successfully! You can now test three-way messaging between Maison Solène and Lucas Tech."
              : "Négociation démo chargée avec succès ! Vous pouvez à présent tester les échanges supervisés entre Maison Solène et Lucas Tech."}
          </span>
        </div>
      )}

      {/* DISPOSITION EN 2 COLONNES (DESKTOP) OU ÉCRAN UNIQUE (MOBILE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
        {/* COLONNE GAUCHE : LISTE DES NÉGOCIATIONS & CONVERSATIONS (STYLE WHATSAPP WEB DARK) */}
        <aside
          className={`lg:col-span-4 flex flex-col bg-[#111b21] border border-[#222e35] rounded-2xl overflow-hidden shadow-xl ${
            selectedConversationId ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* 1. EN-TÊTE WHATSAPP WEB */}
          <div className="px-4 py-3 bg-[#202c33] border-b border-[#2a3942] flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Avatar profil connecté */}
              <div className="w-9 h-9 rounded-full bg-[#111b21] border border-[#00a884]/40 flex items-center justify-center font-bold text-xs text-[#00a884] shadow-xs">
                {role === "advertiser" ? "MS" : "LT"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-[#e9edef] text-sm">
                    {isEn ? "Chats" : "Discussions"}
                  </h3>
                  <span className="text-[10px] font-mono text-[#8696a0] bg-[#111b21] border border-[#2a3942] px-2 py-0.5 rounded-full">
                    {conversations.length}
                  </span>
                </div>
                <p className="text-[10px] text-[#8696a0]">
                  {role === "advertiser"
                    ? "Espace Annonceur"
                    : "Espace Créateur"}{" "}
                  · Fil supervisé
                </p>
              </div>
            </div>

            {/* Actions header WhatsApp */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={fetchConversations}
                disabled={loading}
                className="w-8 h-8 rounded-full hover:bg-[#2a3942] flex items-center justify-center text-[#8696a0] hover:text-[#e9edef] transition-colors cursor-pointer"
                title={isEn ? "Refresh list" : "Actualiser la liste"}
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
              </button>
              <button
                type="button"
                onClick={handleSeedDemoConversation}
                disabled={seeding}
                className="w-8 h-8 rounded-full hover:bg-[#2a3942] flex items-center justify-center text-[#8696a0] hover:text-[#00a884] transition-colors cursor-pointer"
                title={isEn ? "Re-seed demo conversation" : "Recharger la démo"}
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2. BARRE DE RECHERCHE WHATSAPP WEB */}
          <div className="p-2.5 bg-[#111b21] border-b border-[#222e35]/80 space-y-2">
            <div className="bg-[#202c33] rounded-xl px-3 py-1.5 flex items-center gap-2 border border-transparent focus-within:border-[#00a884]/60 transition-all">
              <svg
                className="w-4 h-4 text-[#8696a0] shrink-0 fill-none stroke-current"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isEn
                    ? "Search or start a new chat"
                    : "Rechercher une négociation..."
                }
                className="w-full bg-transparent border-none outline-none text-xs text-[#e9edef] placeholder:text-[#8696a0]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-[#8696a0] hover:text-[#e9edef] text-xs px-1 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filtres pills discrets WhatsApp */}
            <div className="flex items-center gap-1.5 px-1">
              <button
                type="button"
                onClick={() => setFilterTab("all")}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                  filterTab === "all"
                    ? "bg-[#00a884] text-black font-semibold shadow-xs"
                    : "bg-[#202c33] text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]"
                }`}
              >
                {isEn ? "All" : "Toutes"}
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("active")}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                  filterTab === "active"
                    ? "bg-[#00a884] text-black font-semibold shadow-xs"
                    : "bg-[#202c33] text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]"
                }`}
              >
                {isEn ? "Active" : "En cours"}
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("closed")}
                className={`px-3 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                  filterTab === "closed"
                    ? "bg-[#00a884] text-black font-semibold shadow-xs"
                    : "bg-[#202c33] text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]"
                }`}
              >
                {isEn ? "Closed" : "Clôturées"}
              </button>
            </div>
          </div>

          {/* 3. LISTE DES CONVERSATIONS WHATSAPP */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#222e35]/40 bg-[#111b21]">
            {loading ? (
              <div className="p-8 text-center text-xs text-[#8696a0] space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#00a884]" />
                <p>
                  {isEn ? "Loading chats..." : "Chargement des discussions..."}
                </p>
              </div>
            ) : error ? (
              <div className="p-4 m-3 rounded-xl bg-feedback-error-bg/80 border border-feedback-error-border text-center text-xs text-feedback-error-text space-y-2">
                <AlertCircle className="w-4 h-4 mx-auto" />
                <p>{error}</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center space-y-4 text-[#8696a0]">
                <div className="w-12 h-12 rounded-full bg-[#202c33] mx-auto flex items-center justify-center text-[#8696a0]">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-[#e9edef]">
                    {searchQuery
                      ? isEn
                        ? "No chat matches your search"
                        : "Aucune négociation ne correspond"
                      : isEn
                        ? "No conversations yet"
                        : "Aucune négociation ouverte"}
                  </p>
                  <p className="text-[11px] text-[#8696a0] leading-relaxed max-w-xs mx-auto">
                    {searchQuery
                      ? isEn
                        ? "Try adjusting your search terms"
                        : "Vérifiez vos termes de recherche"
                      : isEn
                        ? "A chat opens automatically as soon as an introduction is validated."
                        : "Une négociation s'ouvre automatiquement dès qu'une mise en relation est acceptée et validée par Alexandre."}
                  </p>
                </div>

                {/* Bouton de seed Démo */}
                {!searchQuery && (
                  <button
                    type="button"
                    onClick={handleSeedDemoConversation}
                    disabled={seeding}
                    className="rounded-xl bg-[#00a884] px-4 py-2 text-xs font-bold text-black hover:bg-[#00c39a] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 mx-auto shadow-md"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>
                      {seeding
                        ? isEn
                          ? "Generating..."
                          : "Génération..."
                        : isEn
                          ? "Load Demo Conversation"
                          : "Charger la conversation démo"}
                    </span>
                  </button>
                )}
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === selectedConversationId;
                const otherParty = conv.participants.find(
                  (p) =>
                    p.role !== "agent" &&
                    (role === "advertiser"
                      ? p.role === "creator"
                      : p.role === "advertiser"),
                );
                const agent = conv.participants.find((p) => p.role === "agent");

                const displayName =
                  otherParty?.displayName ||
                  (isEn ? "Negotiation" : "Négociation");

                // Photo ou initiales
                const isCreator = role === "advertiser";
                const avatarPhoto = isCreator
                  ? "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80"
                  : null;

                const initials =
                  displayName
                    .split(" ")
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase() || (isCreator ? "LT" : "MS");

                // Horodatage & aperçu du dernier message
                const lastMsgDate =
                  conv.lastMessage?.createdAt || conv.updatedAt;
                const timeStr = formatWhatsAppListItemTime(lastMsgDate);
                const lastMsgPreview = conv.lastMessage
                  ? conv.lastMessage.content
                  : isEn
                    ? "Negotiation thread opened · Supervised by INFLUX"
                    : "Négociation ouverte · Supervisée par INFLUX";

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelectedConversationId(conv.id)}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors cursor-pointer border-none outline-none relative group ${
                      isSelected
                        ? "bg-[#2a3942]"
                        : "bg-transparent hover:bg-[#202c33]/70"
                    }`}
                  >
                    {/* Avatar rond WhatsApp discret 36px */}
                    <div className="relative shrink-0">
                      <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs shadow-xs border border-[#2a3942] bg-[#202c33]">
                        {avatarPhoto ? (
                          <img
                            src={avatarPhoto}
                            alt={displayName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span
                            className={
                              isCreator ? "text-emerald-300" : "text-amber-300"
                            }
                          >
                            {initials}
                          </span>
                        )}
                      </div>
                      {/* Puce d'état WhatsApp verte en bas à droite */}
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00a884] border border-[#111b21]" />
                    </div>

                    {/* Zone texte et aperçu façon WhatsApp Web */}
                    <div className="flex-1 min-w-0">
                      {/* Ligne 1 : Nom du contact + Heure */}
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-sm text-[#e9edef] truncate group-hover:text-white">
                          {displayName}
                        </span>
                        <span
                          className={`text-[11px] shrink-0 font-normal ${
                            isSelected
                              ? "text-[#00a884] font-medium"
                              : "text-[#8696a0]"
                          }`}
                        >
                          {timeStr}
                        </span>
                      </div>

                      {/* Ligne 2 : Double-coche WhatsApp + Aperçu du dernier message */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center min-w-0 text-xs text-[#8696a0] truncate">
                          <WhatsAppCheckmarks read={true} />
                          <span className="truncate">{lastMsgPreview}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="font-mono text-[9px] text-[#8696a0] bg-[#182229] border border-[#222e35] px-1.5 py-0.5 rounded">
                            {conv.reference}
                          </span>
                        </div>
                      </div>

                      {/* Ligne 3 : Commercial titulaire INFLUX discret */}
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-[#8696a0]/80">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] shrink-0" />
                        <span className="truncate">
                          {agent?.displayName || "Alexandre — INFLUX"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Bouton de seed Démo en bas de colonne */}
          {conversations.length > 0 && (
            <div className="p-3 border-t border-border-subtle bg-surface-raised/40">
              <button
                type="button"
                onClick={handleSeedDemoConversation}
                disabled={seeding}
                className="w-full text-center text-[11px] text-text-tertiary hover:text-text-brand transition-colors cursor-pointer py-1"
              >
                {seeding
                  ? isEn
                    ? "Resetting demo..."
                    : "Réinitialisation démo..."
                  : isEn
                    ? "⚡ Re-seed demo negotiation"
                    : "⚡ Réinitialiser la négociation démo"}
              </button>
            </div>
          )}
        </aside>

        {/* COLONNE DROITE : FENÊTRE DE MESSAGERIE À TROIS */}
        <main
          className={`lg:col-span-8 flex flex-col ${
            !selectedConversationId ? "hidden lg:flex" : "flex"
          }`}
        >
          {selectedConversationId ? (
            <ThreeWayChatWindow
              conversationId={selectedConversationId}
              currentAccountId={currentAccountId}
              currentRole={role}
              locale={locale}
              onBack={() => setSelectedConversationId(null)}
              onStatusChanged={(updated) => {
                setConversations((prev) =>
                  prev.map((c) => (c.id === updated.id ? updated : c)),
                );
              }}
            />
          ) : (
            <div className="h-full bg-surface-card border border-border-default rounded-xl p-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-surface-raised flex items-center justify-center text-text-tertiary">
                <MessageSquare className="w-8 h-8" />
              </div>
              <div className="max-w-md space-y-1">
                <h3 className="font-bold text-text-primary text-sm sm:text-base">
                  {isEn
                    ? "Select a conversation"
                    : "Sélectionnez une négociation"}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {isEn
                    ? "Choose a negotiation thread on the left to access the supervised three-way messaging space."
                    : "Choisissez une discussion dans le panneau de gauche pour accéder à la salle d'échange supervisée par votre commercial INFLUX."}
                </p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

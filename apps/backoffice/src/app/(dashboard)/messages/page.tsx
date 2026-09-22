"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { type Conversation } from "@influx/contracts";
import {
  MessageSquare,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Search,
} from "@/components/ui/icons";

function WhatsAppCheckmarks({ read = true }: { read?: boolean }) {
  return (
    <span
      className={`inline-flex items-center shrink-0 mr-1 ${
        read ? "text-[#53bdeb]" : "text-[#8696a0]"
      }`}
      title={read ? "Lu par les membres" : "Délivré"}
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

function formatWhatsAppTime(isoString?: string | null): string {
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

export default function BackofficeMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<
    "all" | "active" | "paused" | "closed"
  >("all");

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/conversations/my", {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Erreur serveur (${res.status})`);
      }

      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (err: unknown) {
      setError((err as Error).message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/dev/seed-conversations", {
        method: "POST",
      });
      if (res.ok) {
        await fetchConversations();
      }
    } catch {
      // Ignorer
    } finally {
      setSeeding(false);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    if (
      filterTab === "active" &&
      conv.status !== "active" &&
      conv.status !== "ouverte"
    ) {
      return false;
    }
    if (filterTab === "paused" && conv.status !== "en_pause") {
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

    const q = searchQuery.toLowerCase().trim();
    const brand = conv.participants.find((p) => p.role === "advertiser");
    const creator = conv.participants.find((p) => p.role === "creator");
    const agent = conv.participants.find((p) => p.role === "agent");

    return (
      conv.reference.toLowerCase().includes(q) ||
      brand?.displayName.toLowerCase().includes(q) ||
      creator?.displayName.toLowerCase().includes(q) ||
      agent?.displayName.toLowerCase().includes(q) ||
      conv.lastMessage?.content.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* 1. HEADER DU MODULE DE NÉGOCIATION */}
      <header className="rounded-2xl border border-[#2a3942] bg-[#202c33] p-5 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#111b21] border border-[#00a884]/40 flex items-center justify-center text-[#00a884]">
              <MessageSquare className="w-4 h-4" size={16} />
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-[#e9edef] tracking-tight">
              Négociations supervisées &amp; Fils à trois (17b §3.4)
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              WhatsApp Web
            </span>
          </div>
          <p className="text-xs text-[#8696a0] leading-relaxed">
            Intervenez en temps réel pour orienter, arbitrer ou cadrer les
            échanges tripartites sous mandat commercial INFLUX.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchConversations}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg border border-[#2a3942] bg-[#111b21] text-xs font-semibold text-[#8696a0] hover:text-[#e9edef] hover:bg-[#202c33] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            <span>Actualiser</span>
          </button>

          <button
            type="button"
            onClick={handleSeed}
            disabled={seeding}
            className="px-3 py-1.5 rounded-lg bg-[#00a884] text-black text-xs font-bold hover:bg-[#00c39a] transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {seeding ? "Génération..." : "⚡ Re-seed Démo MER-2026-000001"}
            </span>
          </button>
        </div>
      </header>

      {/* 2. HUBS DE CONVERSATIONS EN STYLE WHATSAPP DARK */}
      <div className="rounded-2xl border border-[#2a3942] bg-[#111b21] overflow-hidden shadow-2xl">
        {/* Barre de recherche et filtres rapides */}
        <div className="p-3 sm:p-4 bg-[#202c33] border-b border-[#2a3942] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <div className="bg-[#111b21] rounded-xl px-3 py-2 flex items-center gap-2 border border-transparent focus-within:border-[#00a884]/60 transition-all">
              <Search className="w-4 h-4 text-[#8696a0] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une négociation, marque, créateur..."
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
          </div>

          {/* Filtres d'état */}
          <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
            <button
              type="button"
              onClick={() => setFilterTab("all")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                filterTab === "all"
                  ? "bg-[#00a884] text-black font-bold shadow-xs"
                  : "bg-[#111b21] text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]"
              }`}
            >
              Toutes ({conversations.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("active")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                filterTab === "active"
                  ? "bg-[#00a884] text-black font-bold shadow-xs"
                  : "bg-[#111b21] text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]"
              }`}
            >
              En cours
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("paused")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                filterTab === "paused"
                  ? "bg-[#00a884] text-black font-bold shadow-xs"
                  : "bg-[#111b21] text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]"
              }`}
            >
              En pause
            </button>
            <button
              type="button"
              onClick={() => setFilterTab("closed")}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                filterTab === "closed"
                  ? "bg-[#00a884] text-black font-bold shadow-xs"
                  : "bg-[#111b21] text-[#8696a0] hover:text-[#e9edef] hover:bg-[#2a3942]"
              }`}
            >
              Clôturées
            </button>
          </div>
        </div>

        {/* 3. LISTE DES DISCUSSIONS STYLE WHATSAPP */}
        {loading ? (
          <div className="py-20 text-center text-xs text-[#8696a0] space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#00a884]" />
            <p>Chargement des négociations WhatsApp...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-feedback-error-text">
            {error}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="py-20 text-center text-xs text-[#8696a0] space-y-3">
            <MessageSquare className="w-10 h-10 mx-auto opacity-30 text-[#00a884]" />
            <p className="font-semibold text-sm text-[#e9edef]">
              {searchQuery
                ? "Aucune négociation ne correspond à votre recherche"
                : "Aucun fil de négociation actif"}
            </p>
            <p className="text-[11px] max-w-sm mx-auto text-[#8696a0]">
              Une conversation s&apos;ouvre automatiquement dès la validation
              d&apos;une mise en relation et la révélation bilatérale
              d&apos;identité.
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={handleSeed}
                className="mt-2 px-4 py-2 rounded-xl bg-[#00a884] text-black text-xs font-bold hover:bg-[#00c39a] transition-all shadow-md cursor-pointer inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Générer la conversation de démonstration</span>
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#222e35]/60">
            {filteredConversations.map((conv) => {
              const brand = conv.participants.find(
                (p) => p.role === "advertiser",
              );
              const creator = conv.participants.find(
                (p) => p.role === "creator",
              );
              const agent = conv.participants.find((p) => p.role === "agent");

              // Données d'aperçu
              const lastMsg = conv.lastMessage;
              const lastMsgDate = lastMsg?.createdAt || conv.updatedAt;
              const timeStr = formatWhatsAppTime(lastMsgDate);
              const previewText = lastMsg
                ? `${lastMsg.senderDisplayName.split(" ")[0]} : ${lastMsg.content}`
                : "Négociation ouverte · En attente d'échanges";

              const creatorPhoto =
                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80";

              return (
                <Link
                  key={conv.id}
                  href={`/messages/${conv.id}`}
                  className="px-3.5 py-2.5 flex items-center gap-3 hover:bg-[#202c33]/70 transition-colors group cursor-pointer block"
                >
                  {/* Double avatar WhatsApp : Créateur (principal 36px) + Marque (mini-badge) */}
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs shadow-xs border border-[#2a3942] bg-[#202c33]">
                      <img
                        src={creatorPhoto}
                        alt={creator?.displayName || "Créateur"}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* Badge marque superposé en haut à droite */}
                    <div
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#1e293b] border border-[#334155] flex items-center justify-center text-[8px] font-bold text-amber-300 shadow-xs"
                      title={brand?.displayName || "Marque"}
                    >
                      🏢
                    </div>
                    {/* Puce d'état WhatsApp verte en bas à droite */}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#00a884] border border-[#111b21]" />
                  </div>

                  {/* Corps de l'item de négociation */}
                  <div className="flex-1 min-w-0">
                    {/* Ligne 1 : Noms des deux parties + Horodatage */}
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-sm text-[#e9edef] truncate group-hover:text-white">
                          {creator?.displayName || "Créateur"}
                        </span>
                        <span className="text-xs text-[#8696a0]">⟷</span>
                        <span className="font-medium text-xs text-[#d1d7db] truncate">
                          {brand?.displayName || "Marque"}
                        </span>
                      </div>
                      <span className="text-[11px] font-normal text-[#8696a0] shrink-0 group-hover:text-[#00a884] transition-colors">
                        {timeStr}
                      </span>
                    </div>

                    {/* Ligne 2 : Double coche + Extrait du dernier message */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center min-w-0 text-xs text-[#8696a0] truncate">
                        <WhatsAppCheckmarks read={true} />
                        <span className="truncate">{previewText}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono text-[9px] text-[#8696a0] bg-[#182229] border border-[#222e35] px-1.5 py-0.5 rounded">
                          {conv.reference}
                        </span>
                        <span
                          className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
                            conv.status === "active" ||
                            conv.status === "ouverte"
                              ? "bg-emerald-950/80 text-emerald-300 border-emerald-500/30"
                              : conv.status === "en_pause"
                                ? "bg-amber-950/80 text-amber-300 border-amber-500/30"
                                : "bg-[#182229] text-[#8696a0] border-[#222e35]"
                          }`}
                        >
                          {conv.status === "active" || conv.status === "ouverte"
                            ? "En direct"
                            : conv.status === "en_pause"
                              ? "En pause"
                              : "Clôturée"}
                        </span>
                      </div>
                    </div>

                    {/* Ligne 3 : Commercial responsable INFLUX */}
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[#8696a0]/80">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] shrink-0" />
                        <span>
                          Commercial titulaire :{" "}
                          <strong className="text-[#00a884] font-medium">
                            {agent?.displayName || "Alexandre Martin"}
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-[#8696a0] group-hover:text-[#e9edef] transition-colors font-medium">
                        <span>Rejoindre le fil</span>
                        <ChevronRight className="w-3.5 h-3.5" size={14} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

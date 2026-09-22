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

  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId,
  );

  return (
    <div className="space-y-6">
      {/* BANNIÈRE DE CONNEXION RAPIDE OU NOTIFICATION SEED */}
      {seedSuccess && (
        <div className="rounded-xl border border-feedback-success-border bg-feedback-success-bg p-4 flex items-center gap-3 text-xs text-feedback-success-text">
          <Sparkles className="w-5 h-5 shrink-0" />
          <span>
            {isEn
              ? "Demo conversation loaded successfully! You can now test three-way messaging between Maison Solène and Lucas Tech."
              : "Négociation démo chargée avec succès ! Vous pouvez à présent tester les échanges supervisés entre Maison Solène et Lucas Tech."}
          </span>
        </div>
      )}

      {/* DISPOSITION EN 2 COLONNES (DESKTOP) OU ÉCRAN UNIQUE (MOBILE) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
        {/* COLONNE GAUCHE : LISTE DES NÉGOCIATIONS & CONVERSATIONS */}
        <aside
          className={`lg:col-span-4 flex flex-col bg-surface-card border border-border-default rounded-xl overflow-hidden ${
            selectedConversationId ? "hidden lg:flex" : "flex"
          }`}
        >
          <div className="p-4 border-b border-border-subtle bg-surface-raised flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-text-brand" />
              <h3 className="font-bold text-text-primary text-xs sm:text-sm">
                {isEn ? "My Conversations" : "Mes Négociations"} (
                {conversations.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={fetchConversations}
              disabled={loading}
              className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
              title={isEn ? "Refresh list" : "Actualiser la liste"}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {loading ? (
              <div className="p-6 text-center text-xs text-text-tertiary">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-text-brand" />
                {isEn ? "Loading conversations..." : "Chargement..."}
              </div>
            ) : error ? (
              <div className="p-4 rounded-lg bg-feedback-error-bg border border-feedback-error-border text-center text-xs text-feedback-error-text space-y-2">
                <AlertCircle className="w-4 h-4 mx-auto" />
                <p>{error}</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-surface-raised mx-auto flex items-center justify-center text-text-tertiary">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-text-primary">
                    {isEn
                      ? "No conversations yet"
                      : "Aucune négociation ouverte"}
                  </p>
                  <p className="text-[11px] text-text-tertiary leading-relaxed">
                    {isEn
                      ? "A conversation opens automatically as soon as an introduction is validated and identities are revealed."
                      : "Une salle de négociation à trois s'ouvre automatiquement dès qu'une mise en relation est acceptée et validée par un commercial INFLUX."}
                  </p>
                </div>

                {/* Bouton de seed Démo */}
                <button
                  type="button"
                  onClick={handleSeedDemoConversation}
                  disabled={seeding}
                  className="w-full rounded-lg bg-brand-subtle-bg border border-brand-subtle-border px-3 py-2 text-xs font-semibold text-text-brand hover:bg-brand-subtle-bg/80 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
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
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = conv.id === selectedConversationId;
                const otherParty = conv.participants.find(
                  (p) =>
                    p.role !== "agent" &&
                    (role === "advertiser"
                      ? p.role === "creator"
                      : p.role === "advertiser"),
                );
                const agent = conv.participants.find((p) => p.role === "agent");

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelectedConversationId(conv.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? "bg-surface-raised border-border-selected shadow-xs"
                        : "bg-surface-card border-border-subtle hover:border-border-default hover:bg-surface-hover"
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-text-brand">
                          {conv.reference}
                        </span>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-surface-raised text-text-secondary border border-border-subtle">
                          {conv.status}
                        </span>
                      </div>

                      <div className="font-semibold text-text-primary text-xs truncate">
                        {otherParty?.displayName ||
                          (isEn ? "Interlocutor" : "Interlocuteur")}
                      </div>

                      <div className="text-[11px] text-text-tertiary truncate flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-text-brand" />
                        <span>
                          {agent?.displayName || "Alexandre — INFLUX"}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
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

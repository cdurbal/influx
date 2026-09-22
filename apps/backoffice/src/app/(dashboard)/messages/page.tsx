"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { type Conversation } from "@influx/contracts";
function MessageSquare({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function ShieldCheck({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

function RefreshCw({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function Sparkles({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.286L13 21l-2.286-6.857L5 12l5.714-2.286L13 3z"
      />
    </svg>
  );
}

function ChevronRight({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function BackofficeMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

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

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <header className="rounded-xl border border-border-default bg-surface-card p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-text-brand" />
            <h1 className="text-base font-bold text-text-primary">
              Négociations supervisées & Fils à trois (17b §3.4)
            </h1>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Consultez et arbitrez les conversations actives entre marques et
            créateurs sous mandat commercial INFLUX.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchConversations}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg border border-border-default bg-surface-raised text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5"
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
            className="px-3 py-1.5 rounded-lg bg-brand-subtle-bg border border-brand-subtle-border text-xs font-semibold text-text-brand hover:bg-brand-subtle-bg/80 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {seeding ? "Génération..." : "⚡ Re-seed Démo MER-2026-000001"}
            </span>
          </button>
        </div>
      </header>

      {/* LISTE DES FILS */}
      <div className="rounded-xl border border-border-default bg-surface-card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-xs text-text-tertiary space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-text-brand" />
            <p>Chargement des conversations...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-xs text-feedback-error-text">
            {error}
          </div>
        ) : conversations.length === 0 ? (
          <div className="py-16 text-center text-xs text-text-tertiary space-y-3">
            <MessageSquare className="w-8 h-8 mx-auto opacity-40" />
            <p className="font-semibold text-text-primary">
              Aucun fil de négociation actif
            </p>
            <p className="text-[11px] max-w-sm mx-auto">
              Une conversation s&apos;ouvre automatiquement dès la validation
              d&apos;une mise en relation et la révélation bilatérale
              d&apos;identité.
            </p>
            <button
              type="button"
              onClick={handleSeed}
              className="mt-2 px-4 py-2 rounded-lg bg-action-primary-bg text-xs font-bold text-text-on-action hover:bg-action-primary-bg-hover transition-colors shadow-sm"
            >
              Générer la conversation de démonstration
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {conversations.map((conv) => {
              const brand = conv.participants.find(
                (p) => p.role === "advertiser",
              );
              const creator = conv.participants.find(
                (p) => p.role === "creator",
              );
              const agent = conv.participants.find((p) => p.role === "agent");

              return (
                <div
                  key={conv.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-surface-hover transition-colors"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-text-brand">
                        {conv.reference}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.2 rounded border ${
                          conv.status === "active"
                            ? "bg-feedback-success-bg text-feedback-success-text border-feedback-success-border"
                            : conv.status === "en_pause"
                              ? "bg-feedback-warning-bg text-feedback-warning-text border-feedback-warning-border"
                              : "bg-surface-raised text-text-secondary border-border-subtle"
                        }`}
                      >
                        {conv.status}
                      </span>
                    </div>

                    <div className="text-xs text-text-primary font-semibold flex items-center gap-2">
                      <span>🏢 {brand?.displayName || "Marque"}</span>
                      <span className="text-text-tertiary">⟷</span>
                      <span>🎨 {creator?.displayName || "Créateur"}</span>
                    </div>

                    <div className="text-[11px] text-text-tertiary flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-text-brand" />
                      <span>
                        Commercial responsable :{" "}
                        {agent?.displayName || "Alexandre Martin"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Link
                      href={`/messages/${conv.id}`}
                      className="px-3.5 py-2 rounded-lg bg-surface-raised border border-border-default text-xs font-semibold text-text-primary hover:border-border-selected hover:text-text-brand transition-all flex items-center gap-1.5 shadow-xs"
                    >
                      <span>Ouvrir le fil à trois</span>
                      <ChevronRight className="w-3.5 h-3.5 text-text-tertiary" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

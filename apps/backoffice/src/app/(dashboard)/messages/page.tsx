"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { type Conversation } from "@influx/contracts";
import {
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ChevronRight,
} from "@/components/ui/icons";

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
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <header className="rounded-xl border border-border-default bg-surface-card p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-text-brand" />
            <h1 className="text-xl font-bold text-text-primary tracking-tight">
              Négociations supervisées &amp; Fils à trois (17b §3.4)
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
            className="px-3 py-1.5 rounded-lg bg-brand-subtle-bg border border-brand-subtle-border text-xs font-semibold text-text-brand hover:bg-brand-subtle-border transition-colors flex items-center gap-1.5 cursor-pointer"
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
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
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

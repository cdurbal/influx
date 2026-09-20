"use client";

import React, { useState, useEffect } from "react";
import {
  type AnonymizedCreatorCard,
  type IdentifiedCreatorCard,
  type Shortlist,
} from "@influx/contracts";
import { getSearchLabels } from "./search-labels";

export interface ShortlistModalProps {
  creator: AnonymizedCreatorCard | IdentifiedCreatorCard;
  locale?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ShortlistModal({
  creator,
  locale = "fr",
  onClose,
  onSuccess,
}: ShortlistModalProps) {
  const t = getSearchLabels(locale);

  const [shortlists, setShortlists] = useState<Shortlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [newListName, setNewListName] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadShortlists() {
      try {
        setLoading(true);
        const res = await fetch("/api/search/shortlists", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setShortlists(data || []);
          if (data && data.length > 0) {
            setSelectedListId(data[0].id);
          }
        }
      } catch {
        // Silencieux
      } finally {
        setLoading(false);
      }
    }
    loadShortlists();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      let targetListId = selectedListId;

      // Création d'une nouvelle liste si saisie
      if (newListName.trim()) {
        const createRes = await fetch("/api/search/shortlists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newListName.trim() }),
          credentials: "include",
        });
        if (!createRes.ok) {
          throw new Error("Impossible de créer la sélection.");
        }
        const created = await createRes.json();
        targetListId = created.id;
      }

      if (!targetListId) {
        throw new Error(
          "Veuillez choisir une liste existante ou nommer une nouvelle sélection.",
        );
      }

      // Ajout du créateur à la liste
      const itemRes = await fetch(
        `/api/search/shortlists/${targetListId}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creatorAccountId: creator.creatorAccountId,
            note: note.trim() || undefined,
          }),
          credentials: "include",
        },
      );

      if (!itemRes.ok) {
        throw new Error("Ce créateur figure peut-être déjà dans cette liste.");
      }

      setSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-shortlist-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-overlay-scrim backdrop-blur-xs"
    >
      <div className="relative w-full max-w-md bg-surface-card border border-border-default rounded-xl shadow-2xl p-6 text-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2
              id="modal-shortlist-title"
              className="text-base font-bold text-text-primary"
            >
              {t.shortlistModal.title}
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              {creator.alias} — {creator.primaryTopic}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary p-1 rounded hover:bg-surface-raised"
          >
            ✕
          </button>
        </div>

        {success ? (
          <div className="py-6 text-center space-y-2">
            <span className="text-3xl">✓</span>
            <p className="text-sm font-semibold text-feedback-success-text">
              {t.shortlistModal.savedSuccess}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <p className="text-xs text-text-tertiary">
              {t.shortlistModal.subtitle}
            </p>

            {error && (
              <div className="p-3 text-xs bg-feedback-error-bg text-feedback-error-text border border-feedback-error-border rounded-lg">
                {error}
              </div>
            )}

            {/* Listes existantes */}
            {shortlists.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-text-secondary">
                  {t.shortlistModal.selectExisting}
                </label>
                <select
                  value={selectedListId}
                  onChange={(e) => {
                    setSelectedListId(e.target.value);
                    setNewListName("");
                  }}
                  className="w-full bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-text-primary text-xs focus:border-border-selected focus:outline-hidden"
                >
                  {shortlists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name} ({list.itemsCount} profils)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Créer nouvelle liste */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-text-secondary">
                {shortlists.length > 0
                  ? t.shortlistModal.createNew
                  : "Nom de la sélection :"}
              </label>
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder={t.shortlistModal.namePlaceholder}
                className="w-full bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-text-primary text-xs focus:border-border-selected focus:outline-hidden"
              />
            </div>

            {/* Note personnelle */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-text-secondary">
                {t.shortlistModal.optionalNote}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t.shortlistModal.notePlaceholder}
                rows={2}
                className="w-full bg-surface-raised border border-border-default rounded-lg px-3 py-2 text-text-primary text-xs focus:border-border-selected focus:outline-hidden resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg border border-border-default text-text-secondary hover:bg-surface-raised text-xs"
              >
                {t.shortlistModal.cancel}
              </button>
              <button
                type="submit"
                disabled={saving || loading}
                className="px-4 py-1.5 rounded-lg bg-action-primary-bg hover:bg-action-primary-bg-hover text-text-on-action text-xs font-semibold disabled:opacity-50"
              >
                {saving ? "Enregistrement..." : t.shortlistModal.save}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

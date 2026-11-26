"use client";

// « Ajouter à ma sélection » (docs/mvp/10 RG51, RG55; 17 §4.4, §7.1; D45; jalons/l3f, commit 11): the one action of a
// card and of a profile besides the request to the team. It adds the creator to the active list (the brand's first
// list is made on the spot, named « Ma sélection »), or takes it out again; nothing reaches the creator (RG51, D45).
// The brand is told what happened in words; a refusal of the base (a full list, the bound of the lists, a creator who
// is no longer visible, the bucket) is told, never swallowed. Nothing is decided here (CLAUDE.md §5).
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/member/ui/Button";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { CheckIcon, PlusIcon } from "@/components/ui/icons";
import { CARD_ACTION_ROW_CLASSES } from "./creator-search-classes";
import type { Selection } from "./use-shortlists";
import type { SelectionFailure } from "./shortlists-view";

export function AddToSelectionButton({
  selection,
  alias,
}: {
  selection: Selection;
  alias: string;
}) {
  const t = useTranslations("creatorSearch");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<SelectionFailure | null>(null);
  if (selection.state.phase !== "ready") {
    return null;
  }
  const held = selection.aliases?.includes(alias) ?? false;
  // the list is read once before a gesture is allowed: adding to a list not yet known would be blind
  const waiting = selection.activeId !== null && selection.aliases === null;

  async function press() {
    if (busy || waiting) {
      return;
    }
    setBusy(true);
    setFailure(null);
    const outcome = held
      ? await selection.drop(alias)
      : await selection.add(alias, t("shortlist.defaultName"));
    setBusy(false);
    if (outcome.kind === "refused") {
      setFailure(outcome.failure);
    }
  }

  return (
    <div className="flex flex-col gap-2" data-selection-action={alias}>
      <div className={CARD_ACTION_ROW_CLASSES}>
        <Button
          variant="secondary"
          aria-disabled={busy || waiting}
          data-add-to-selection={alias}
          data-held={held ? "yes" : "no"}
          onClick={() => void press()}
        >
          {held ? (
            <CheckIcon aria-hidden="true" className="size-(--size-icon-md)" />
          ) : (
            <PlusIcon aria-hidden="true" className="size-(--size-icon-md)" />
          )}
          {held ? t("shortlist.remove") : t("shortlist.add")}
        </Button>
        {held && selection.active !== null ? (
          <p className="text-sm text-text-secondary">
            {t("shortlist.inList", { name: selection.active.name })}
          </p>
        ) : null}
      </div>
      {failure === null ? null : (
        <ErrorNotice>
          <span data-selection-failure={failure}>
            {t(`shortlist.refusal.${failure}`)}
          </span>
        </ErrorNotice>
      )}
    </div>
  );
}

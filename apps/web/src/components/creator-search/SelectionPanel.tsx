"use client";

// The panel « Ma sélection » of M4 (docs/mvp/10 RG51, RG63; 17 §4.4; D45; jalons/l3f, commit 11): persistent, said
// « privée » (no creator is told), it shows the active list of the brand, its creators by alias, the way to the others
// and a way to make a new one. A sticky bar above the bottom navigation below lg (opened with its button), a card at
// the end of the results from lg. There is no « tout sélectionner » and no export (RG63, TM12.3): a creator enters a
// list one by one, from its card or its profile. The list, its count and its bounds are the base's; a refusal is told.
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";
import { TEXT_LINK_CLASSES } from "@/components/auth/auth-classes";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { TextField } from "@/components/member/ui/TextField";
import {
  MEMBER_FIELD_LABEL_CLASSES,
  memberControlClasses,
} from "@/components/member/ui/field-classes";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { cn } from "@/components/ui/class-names";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { ChevronDownIcon } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { memberPageHref } from "@/lib/member-paths";
import {
  SELECTION_ALIASES_CLASSES,
  SELECTION_PANEL_BODY_CLASSES,
  SELECTION_PANEL_CLASSES,
} from "./creator-search-classes";
import {
  nameProblemOf,
  profileHref,
  SHORTLIST_NAME_MAX,
  type SearchPlace,
  type SelectionFailure,
} from "./shortlists-view";
import type { Selection } from "./use-shortlists";

export function SelectionPanel({
  selection,
  place,
  onSelect,
  className,
}: {
  selection: Selection;
  place: SearchPlace;
  /** The list the brand chose or made: the address carries it from now on. */
  onSelect: (listId: string) => void;
  /** The place of the panel in the grid of the page: a sticky bar is a cell, never the child of a cell. */
  className?: string;
}) {
  const t = useTranslations("creatorSearch");
  const tCard = useTranslations("creatorProfile");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [failure, setFailure] = useState<SelectionFailure | null>(null);
  const [problem, setProblem] = useState<"empty" | "too_long" | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const chooseId = useId();
  const { state } = selection;

  if (state.phase === "failed") {
    return (
      <section
        data-selection-panel="failed"
        className={cn(SELECTION_PANEL_CLASSES, className)}
      >
        <p className="text-sm text-text-secondary">{t("panel.failed")}</p>
        <MemberButton variant="secondary" onClick={selection.reload}>
          {t("panel.retry")}
        </MemberButton>
      </section>
    );
  }
  if (state.phase !== "ready") {
    return null;
  }
  const count = selection.active?.count ?? 0;
  const aliases = selection.aliases ?? [];

  async function create(event: FormEvent) {
    event.preventDefault();
    if (creating) {
      return;
    }
    const found = nameProblemOf(name);
    setProblem(found);
    if (found !== null) {
      return;
    }
    setCreating(true);
    setFailure(null);
    const outcome = await selection.create(name.trim(), place.query.campaignId);
    setCreating(false);
    if (outcome.kind === "refused") {
      setFailure(outcome.failure);
    } else if (outcome.listId !== null) {
      setName("");
      onSelect(outcome.listId);
    }
  }

  return (
    <section
      data-action-bar=""
      data-selection-panel="ready"
      aria-labelledby={titleId}
      className={cn(SELECTION_PANEL_CLASSES, className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id={titleId} className={CARD_TITLE}>
          {t("panel.title", { count })}
        </h2>
        <MemberButton
          variant="text"
          className="lg:hidden"
          aria-expanded={open}
          aria-controls={bodyId}
          data-selection-toggle=""
          onClick={() => setOpen((was) => !was)}
        >
          {open ? t("panel.close") : t("panel.open")}
          <ChevronDownIcon
            aria-hidden="true"
            className={cn(
              "size-(--size-icon-md) transition-transform",
              open && "rotate-180",
            )}
          />
        </MemberButton>
      </div>
      <div
        id={bodyId}
        className={cn(SELECTION_PANEL_BODY_CLASSES, !open && "max-lg:hidden")}
      >
        <p className="text-sm text-text-secondary">{t("panel.private")}</p>
        {state.lists.length > 1 ? (
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor={chooseId} className={MEMBER_FIELD_LABEL_CLASSES}>
              {t("panel.choose")}
            </label>
            <select
              id={chooseId}
              value={selection.activeId ?? ""}
              onChange={(event) => onSelect(event.target.value)}
              className={memberControlClasses(false)}
            >
              {state.lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </div>
        ) : selection.active === null ? null : (
          <p data-selection-name="" className="text-md text-text-primary">
            {selection.active.name}
          </p>
        )}
        {aliases.length === 0 ? (
          <p className="text-md text-text-secondary">{t("panel.empty")}</p>
        ) : (
          <ul
            aria-label={t("panel.members")}
            className={SELECTION_ALIASES_CLASSES}
          >
            {aliases.map((alias) => (
              <li key={alias} data-selection-member={alias}>
                <Link
                  href={profileHref(alias, locale, place)}
                  className={TEXT_LINK_CLASSES}
                >
                  {tCard("alias.name", { alias })}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <form
          onSubmit={(event) => void create(event)}
          className="flex flex-col gap-2"
        >
          <TextField
            name="selection-name"
            label={t("panel.createName")}
            value={name}
            maxLength={SHORTLIST_NAME_MAX}
            onChange={setName}
            error={
              problem === null
                ? failure === "invalid_name"
                  ? t("shortlist.refusal.invalid_name")
                  : null
                : t(`lists.problem.${problem}`)
            }
          />
          <MemberButton
            type="submit"
            variant="secondary"
            aria-disabled={creating}
            data-create-selection=""
          >
            {t("panel.create")}
          </MemberButton>
        </form>
        {failure === null || failure === "invalid_name" ? null : (
          <ErrorNotice>
            <span data-selection-failure={failure}>
              {t(`shortlist.refusal.${failure}`)}
            </span>
          </ErrorNotice>
        )}
        <Link
          href={memberPageHref("advertiserShortlists", locale)}
          className={TEXT_LINK_CLASSES}
        >
          {t("panel.all")}
        </Link>
      </div>
    </section>
  );
}

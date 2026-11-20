"use client";

// One of the brand's private lists (docs/mvp/10 RG51, RG63, RG65; 17 §4.9; D38, D45; jalons/l3f, commit 11): its name and
// its campaign (RG51: the brand renames it and attaches it, or detaches it), its creators as the cards of the search
// (the same card, one visual), and for each one the brand's own note (read by nobody else), the way to its profile and
// « Retirer ». The list can be deleted, after a confirmation that says nothing reaches a creator. There is no
// « tout sélectionner », no export and no action of introduction (RG55, RG63). A list of another brand, and an unknown
// one, are one answer: « cette sélection n'existe pas » (CA49). The page of a brand: any other role finds no such page.
import type { ShortlistItem } from "@influx/contracts/shortlists";
import { notFound } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import {
  BACK_ICON_CLASSES,
  BACK_LINK_CLASSES,
} from "@/components/account/account-classes";
import { TEXT_LINK_CLASSES } from "@/components/auth/auth-classes";
import { useOnline } from "@/components/auth/use-online";
import { CreatorCardView } from "@/components/creator-profile/CreatorCardView";
import { cardOfProjection } from "@/components/creator-profile/creator-preview-view";
import { useMember } from "@/components/member/member-context";
import { Card } from "@/components/member/ui/Card";
import { MemberButton } from "@/components/member/ui/MemberButton";
import { Notice } from "@/components/member/ui/Notice";
import { PageBackContext, PageHeader } from "@/components/member/ui/PageHeader";
import { TextAreaField } from "@/components/member/ui/TextAreaField";
import { memberButtonClasses } from "@/components/member/ui/button-classes";
import { CARD_TITLE } from "@/components/member/ui/heading-classes";
import { ErrorNotice } from "@/components/ui/ErrorNotice";
import { ChevronLeftIcon, Trash2Icon } from "@/components/ui/icons";
import { Link, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { memberPageHref } from "@/lib/member-paths";
import {
  CARD_ACTION_ROW_CLASSES,
  CARD_ACTIONS_CLASSES,
  LIST_ITEMS_CLASSES,
  SEARCH_PAGE_CLASSES,
} from "./creator-search-classes";
import { CARD_VISUALS_SHOWN, EMPTY_QUERY } from "./creator-search-view";
import { ShortlistForm } from "./ShortlistForm";
import {
  noteOf,
  noteProblemOf,
  profileHref,
  SHORTLIST_NOTE_MAX,
  type SelectionFailure,
} from "./shortlists-view";
import { useCardVisuals } from "./use-card-visuals";
import { useSearchLabels } from "./use-search-labels";
import { useOriginCampaigns } from "./use-search-sources";
import {
  useShortlistDetail,
  type ShortlistDetail,
} from "./use-shortlist-detail";
import type { SelectionOutcome } from "./use-shortlists";

/** The page of a brand; any other role finds a page that does not exist (18 T14.3, T14.4). */
export function ShortlistScreen({ id }: { id: string }) {
  const { me } = useMember();
  if (me.role !== "advertiser") {
    notFound();
  }
  return <ShortlistView id={id} />;
}

function ShortlistView({ id }: { id: string }) {
  const t = useTranslations("creatorSearch");
  const tAccount = useTranslations("account");
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const online = useOnline();
  const { signedOut } = useMember();
  const onSignedOut = () => signedOut(null);
  const detail = useShortlistDetail({ id, onSignedOut });
  const campaigns = useOriginCampaigns();
  const { state } = detail;
  const back = (
    <Link
      href={memberPageHref("advertiserShortlists", locale)}
      className={BACK_LINK_CLASSES}
    >
      <span className="sr-only">{tAccount("hub.backPrefix")} </span>
      <ChevronLeftIcon aria-hidden="true" className={BACK_ICON_CLASSES} />
      {t("list.back")}
    </Link>
  );
  return (
    <PageBackContext value={back}>
      <div className={SEARCH_PAGE_CLASSES}>
        {online ? null : <Notice tone="warning">{tAccount("offline")}</Notice>}
        <PageHeader
          title={state.phase === "ready" ? state.list.name : t("list.title")}
        />
        {state.phase === "loading" ? (
          <p role="status" className="text-sm text-text-secondary">
            {t("lists.loading")}
          </p>
        ) : null}
        {state.phase === "failed" ? (
          <ErrorNotice>
            <span data-state="failed">{t("lists.failed")}</span>
          </ErrorNotice>
        ) : null}
        {state.phase === "gone" ? (
          <Card>
            <p data-state="gone" className="text-md text-text-secondary">
              {t("list.gone")}
            </p>
            <Link
              href={memberPageHref("advertiserShortlists", locale)}
              className={memberButtonClasses("secondary")}
            >
              {t("list.back")}
            </Link>
          </Card>
        ) : null}
        {state.phase === "closed" ? (
          <Card>
            <h2 className={CARD_TITLE}>{t("closed.title")}</h2>
            <p data-state="closed" className="text-md text-text-secondary">
              {t("lists.closed")}
            </p>
          </Card>
        ) : null}
        {state.phase === "brand_not_published" ? (
          <Card>
            <p
              data-state="brand_not_published"
              className="text-md text-text-secondary"
            >
              {t("lists.notPublished")}
            </p>
            <Link
              href={memberPageHref("accountProfile", locale)}
              className={TEXT_LINK_CLASSES}
            >
              {t("notPublished.action")}
            </Link>
          </Card>
        ) : null}
        {state.phase === "ready" ? (
          <>
            <p className="text-md text-text-secondary">{t("list.explain")}</p>
            <Card>
              <h2 className={CARD_TITLE}>{t("list.edit.title")}</h2>
              <ShortlistForm
                initialName={state.list.name}
                initialCampaignId={state.list.campaignId}
                campaigns={campaigns.state}
                submitLabel={t("list.edit.save")}
                savedText={t("list.edit.saved")}
                clearOnSuccess={false}
                onSubmit={detail.rename}
              />
            </Card>
            <Items
              items={state.items}
              listId={id}
              detail={detail}
              onSignedOut={onSignedOut}
            />
            <DeleteList
              onDelete={async () => {
                const outcome = await detail.deleteList();
                if (outcome.kind === "ok") {
                  router.push(memberPageHref("advertiserShortlists", locale));
                }
                return outcome;
              }}
            />
          </>
        ) : null}
      </div>
    </PageBackContext>
  );
}

function Items({
  items,
  listId,
  detail,
  onSignedOut,
}: {
  items: readonly ShortlistItem[];
  listId: string;
  detail: ShortlistDetail;
  onSignedOut: () => void;
}) {
  const t = useTranslations("creatorSearch");
  const labels = useSearchLabels();
  const cards = useMemo(
    () => items.map((item) => ({ creator: item.creator })),
    [items],
  );
  const visuals = useCardVisuals(cards, onSignedOut);
  if (items.length === 0) {
    return (
      <Card>
        <p data-state="no_items" className="text-md text-text-secondary">
          {t("list.empty")}
        </p>
      </Card>
    );
  }
  return (
    <ul aria-label={t("list.members")} className={LIST_ITEMS_CLASSES}>
      {items.map((item) => {
        const drawn = cardOfProjection(
          item.creator,
          labels.card,
          CARD_VISUALS_SHOWN,
        );
        const card = {
          ...drawn,
          visuals: drawn.visuals.filter(
            (visual) => !visuals.failed.has(visual.id),
          ),
        };
        return (
          <li key={item.creator.alias} data-shortlist-item={item.creator.alias}>
            <CreatorCardView
              card={card}
              images={visuals.images}
              noVisualText={null}
              footer={
                <ItemActions item={item} listId={listId} detail={detail} />
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

/** The brand's note on a creator, the way to its profile, and « Retirer de la sélection » (nothing reaches the creator, D45). */
function ItemActions({
  item,
  listId,
  detail,
}: {
  item: ShortlistItem;
  listId: string;
  detail: ShortlistDetail;
}) {
  const t = useTranslations("creatorSearch");
  const locale = useLocale() as AppLocale;
  const alias = item.creator.alias;
  const [text, setText] = useState(item.note ?? "");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<SelectionFailure | null>(null);
  const [saved, setSaved] = useState(false);
  const problem = noteProblemOf(text);

  async function run(
    work: () => Promise<SelectionOutcome>,
    onDone?: () => void,
  ) {
    if (busy) {
      return;
    }
    setBusy(true);
    setFailure(null);
    setSaved(false);
    const outcome = await work();
    setBusy(false);
    if (outcome.kind === "refused") {
      setFailure(outcome.failure);
    } else {
      onDone?.();
    }
  }

  return (
    <div className={CARD_ACTIONS_CLASSES}>
      <TextAreaField
        name={`note-${alias}`}
        label={t("list.note.label")}
        help={t("list.note.help")}
        value={text}
        onChange={(value) => {
          setText(value);
          setSaved(false);
        }}
        maxLength={SHORTLIST_NOTE_MAX}
        counterText={(count, max) => t("list.note.counter", { count, max })}
        rows={3}
        error={
          problem !== null || failure === "invalid_note"
            ? t("shortlist.refusal.invalid_note")
            : null
        }
      />
      <div className={CARD_ACTION_ROW_CLASSES}>
        <MemberButton
          variant="secondary"
          aria-disabled={busy || problem !== null}
          data-save-note={alias}
          onClick={() =>
            void run(
              () => detail.note(alias, noteOf(text)),
              () => setSaved(true),
            )
          }
        >
          {t("list.note.save")}
        </MemberButton>
        <MemberButton
          variant="text"
          aria-disabled={busy}
          data-remove-item={alias}
          onClick={() => void run(() => detail.remove(alias))}
        >
          <Trash2Icon aria-hidden="true" className="size-(--size-icon-md)" />
          {t("list.remove")}
        </MemberButton>
        <Link
          href={profileHref(alias, locale, {
            query: EMPTY_QUERY,
            page: 1,
            listId,
          })}
          className={TEXT_LINK_CLASSES}
        >
          {t("profile.open")}
          <span className="sr-only"> {alias}</span>
        </Link>
      </div>
      {saved ? (
        <Notice tone="success">
          <span data-note-saved="">{t("list.note.saved")}</span>
        </Notice>
      ) : null}
      {failure === null || failure === "invalid_note" ? null : (
        <ErrorNotice>
          <span data-selection-failure={failure}>
            {t(`shortlist.refusal.${failure}`)}
          </span>
        </ErrorNotice>
      )}
    </div>
  );
}

/** Deleting a list asks to be sure: it is not undone, and no creator is told (D45). */
function DeleteList({
  onDelete,
}: {
  onDelete: () => Promise<SelectionOutcome>;
}) {
  const t = useTranslations("creatorSearch");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<SelectionFailure | null>(null);

  async function confirm() {
    if (busy) {
      return;
    }
    setBusy(true);
    setFailure(null);
    const outcome = await onDelete();
    setBusy(false);
    if (outcome.kind === "refused") {
      setFailure(outcome.failure);
    }
  }

  return (
    <Card>
      <h2 className={CARD_TITLE}>{t("list.delete.title")}</h2>
      {asking ? (
        <>
          <p data-delete-confirm="" className="text-md text-text-primary">
            {t("list.delete.confirm")}
          </p>
          <div className={CARD_ACTION_ROW_CLASSES}>
            <MemberButton
              variant="danger"
              aria-disabled={busy}
              data-delete-confirmed=""
              onClick={() => void confirm()}
            >
              {t("list.delete.yes")}
            </MemberButton>
            <MemberButton variant="secondary" onClick={() => setAsking(false)}>
              {t("list.delete.cancel")}
            </MemberButton>
          </div>
        </>
      ) : (
        <div>
          <MemberButton
            variant="secondary"
            data-delete-list=""
            onClick={() => setAsking(true)}
          >
            {t("list.delete.action")}
          </MemberButton>
        </div>
      )}
      {failure === null ? null : (
        <ErrorNotice>
          <span data-selection-failure={failure}>
            {t(`shortlist.refusal.${failure}`)}
          </span>
        </ErrorNotice>
      )}
    </Card>
  );
}

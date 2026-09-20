"use client";

import {
  PriceBandSchema,
  calculatePriceBandFromAmount,
  getEstimatedNetForPriceBand,
  type CreatorOfferInternal,
  type PriceBand,
  type AvailabilityBand,
  type ExclusivityBand,
  type DeliveryLeadBand,
  type Currency,
} from "@influx/contracts";
import { inputClassName } from "@/components/ui/form-controls";
import {
  BriefcaseIcon,
  CircleAlertIcon,
  InfoIcon,
} from "@/components/ui/icons";
import type { CreatorProfileLabels } from "./creator-profile-labels";

export interface RateCardEditorProps {
  offers: CreatorOfferInternal[];
  availability: AvailabilityBand;
  acceptsNonMonetaryCounterpart: boolean;
  onChangeOffers: (offers: CreatorOfferInternal[]) => void;
  onChangeAvailability: (val: AvailabilityBand) => void;
  onChangeAcceptsGifts: (val: boolean) => void;
  labels: CreatorProfileLabels;
  locale?: string;
}

const FORMAT_OPTIONS = [
  { value: "post", label: "Post image dédié" },
  { value: "story", label: "Séquence de stories" },
  { value: "reel", label: "Reel / Vidéo courte (TikTok, Reels, Shorts)" },
  { value: "video_longue", label: "Vidéo longue dédiée (YouTube)" },
  {
    value: "integration_sponsorisee",
    label: "Intégration sponsorisée (60-90s)",
  },
  { value: "short", label: "YouTube Short" },
  { value: "newsletter", label: "Encart Newsletter dédiée" },
  { value: "podcast_ad", label: "Message audio sponsorisé Podcast" },
  { value: "pack_multi_format", label: "Pack multi-formats" },
] as const;

const NETWORK_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "x", label: "X (Twitter)" },
  { value: "twitch", label: "Twitch" },
  { value: "pinterest", label: "Pinterest" },
] as const;

const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
  { value: "EUR", label: "EUR (€)" },
  { value: "USD", label: "USD ($)" },
  { value: "GBP", label: "GBP (£)" },
  { value: "CAD", label: "CAD ($)" },
  { value: "BRL", label: "BRL (R$)" },
];

const DELIVERY_LEAD_OPTIONS: { value: DeliveryLeadBand; label: string }[] = [
  { value: "lt_7d", label: "Moins de 7 jours (Rapide)" },
  { value: "7_14d", label: "7 à 14 jours (Standard)" },
  { value: "15_30d", label: "15 à 30 jours (Production soignée)" },
  { value: "gt_30d", label: "Plus de 30 jours (Campagne lourde)" },
];

const EXCLUSIVITY_OPTIONS: { value: ExclusivityBand; label: string }[] = [
  { value: "none", label: "Aucune exclusivité" },
  { value: "1_month", label: "1 mois d'exclusivité" },
  { value: "3_months", label: "3 mois d'exclusivité" },
  { value: "negotiable", label: "À négocier" },
];

const USAGE_RIGHTS_AVAILABLE = [
  { id: "digital_organic", label: "Diffusion réseaux sociaux organique" },
  {
    id: "digital_paid_ads",
    label: "Sponsoring / Amplification Paid Ads (30j)",
  },
  { id: "website_embed", label: "Intégration site web de la marque" },
  { id: "print_pos", label: "Affichage print / PLV boutique" },
] as const;

const AVAILABILITY_2W_LABEL = "Disponible sous 2 semaines";
const AVAILABILITY_1M_LABEL = "Disponible sous 1 mois";
const AVAILABILITY_FULL_LABEL = "Complet / Indisponible actuellement";

function formatCurrencyAmount(
  amount: number,
  currency: string = "EUR",
  locale: string = "fr-FR",
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function getPriceBandDisplay(
  band: PriceBand,
  currency: string = "EUR",
  locale: string = "fr-FR",
): string {
  switch (band) {
    case "lt_250":
      return `Moins de ${formatCurrencyAmount(250, currency, locale)}`;
    case "250_500":
      return `${formatCurrencyAmount(250, currency, locale)} – ${formatCurrencyAmount(500, currency, locale)}`;
    case "500_1000":
      return `${formatCurrencyAmount(500, currency, locale)} – ${formatCurrencyAmount(1000, currency, locale)}`;
    case "1000_2000":
      return `${formatCurrencyAmount(1000, currency, locale)} – ${formatCurrencyAmount(2000, currency, locale)}`;
    case "2000_5000":
      return `${formatCurrencyAmount(2000, currency, locale)} – ${formatCurrencyAmount(5000, currency, locale)}`;
    case "5000_10000":
      return `${formatCurrencyAmount(5000, currency, locale)} – ${formatCurrencyAmount(10000, currency, locale)}`;
    case "plus_10000":
      return `Plus de ${formatCurrencyAmount(10000, currency, locale)}`;
    default:
      return band;
  }
}

export function RateCardEditor({
  offers,
  availability,
  acceptsNonMonetaryCounterpart,
  onChangeOffers,
  onChangeAvailability,
  onChangeAcceptsGifts,
  labels,
  locale = "fr-FR",
}: RateCardEditorProps) {
  const l = labels.rates;
  const layers = labels.layers;

  function handleAddOffer() {
    const defaultAmountMinor = 75000;
    const defaultCurrency = "EUR";
    const derivedBand = calculatePriceBandFromAmount(
      defaultAmountMinor,
      defaultCurrency,
    );
    const netInfo = getEstimatedNetForPriceBand(derivedBand, defaultCurrency);

    const newOffer: CreatorOfferInternal = {
      format: "post",
      network: "instagram",
      priceBand: derivedBand,
      currency: defaultCurrency,
      deliveryLeadBand: "7_14d",
      includedUsageRights: ["digital_organic"],
      optionalUsageRights: ["digital_paid_ads"],
      exclusivity: "none",
      exactAmountMinor: defaultAmountMinor,
      estimatedNetMinMinor: netInfo.minNetMinor,
      estimatedNetMaxMinor: netInfo.maxNetMinor,
    };
    onChangeOffers([...offers, newOffer]);
  }

  function handleRemoveOffer(index: number) {
    const updated = offers.filter((_, i) => i !== index);
    onChangeOffers(updated);
  }

  function handleUpdateExactAmount(index: number, exactAmountMajor: number) {
    const updated = [...offers];
    const current = { ...updated[index] };
    const amountMinor = Math.max(100, Math.round(exactAmountMajor * 100));
    const currency = current.currency || "EUR";
    const derivedBand = calculatePriceBandFromAmount(amountMinor, currency);
    const netInfo = getEstimatedNetForPriceBand(derivedBand, currency);

    current.exactAmountMinor = amountMinor;
    current.priceBand = derivedBand;
    current.estimatedNetMinMinor = netInfo.minNetMinor;
    current.estimatedNetMaxMinor = netInfo.maxNetMinor;

    updated[index] = current as CreatorOfferInternal;
    onChangeOffers(updated);
  }

  function handleUpdateCurrency(index: number, currency: Currency) {
    const updated = [...offers];
    const current = { ...updated[index] };
    const amountMinor = current.exactAmountMinor || 75000;
    const derivedBand = calculatePriceBandFromAmount(amountMinor, currency);
    const netInfo = getEstimatedNetForPriceBand(derivedBand, currency);

    current.currency = currency;
    current.priceBand = derivedBand;
    current.estimatedNetMinMinor = netInfo.minNetMinor;
    current.estimatedNetMaxMinor = netInfo.maxNetMinor;

    updated[index] = current as CreatorOfferInternal;
    onChangeOffers(updated);
  }

  function handleUpdateOfferField(
    index: number,
    field: keyof CreatorOfferInternal,
    value: unknown,
  ) {
    const updated = [...offers];
    const current = { ...updated[index] };
    (current as Record<string, unknown>)[field] = value;
    updated[index] = current as CreatorOfferInternal;
    onChangeOffers(updated);
  }

  function handleToggleIncludedRight(index: number, rightId: string) {
    const offer = offers[index];
    if (!offer) return;
    const exists = offer.includedUsageRights.includes(rightId);
    const updatedRights = exists
      ? offer.includedUsageRights.filter((r) => r !== rightId)
      : [...offer.includedUsageRights, rightId];

    handleUpdateOfferField(index, "includedUsageRights", updatedRights);
  }

  function handleToggleOptionalRight(index: number, rightId: string) {
    const offer = offers[index];
    if (!offer) return;
    const exists = offer.optionalUsageRights.includes(rightId);
    const updatedRights = exists
      ? offer.optionalUsageRights.filter((r) => r !== rightId)
      : [...offer.optionalUsageRights, rightId];

    handleUpdateOfferField(index, "optionalUsageRights", updatedRights);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Alerte primordiale RG65 : Coût marque total vs Net perçu */}
      <div className="flex items-start gap-3 rounded-md border-(length:--border-width-thin) border-border-selected bg-surface-card p-4 text-text-primary">
        <InfoIcon
          className="size-(--size-icon-md) shrink-0 text-text-brand mt-0.5"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-1 text-xs">
          <span className="font-semibold text-text-brand">
            {l.rateHintNotice}
          </span>
          <span className="text-text-secondary">{l.legalNotice}</span>
        </div>
      </div>

      {/* Global Availability Settings */}
      <div className="flex flex-col gap-4 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BriefcaseIcon
              className="size-(--size-icon-sm) text-text-tertiary"
              aria-hidden="true"
            />
            <span className="text-sm font-semibold text-text-primary">
              {l.availabilityLabel}
            </span>
          </div>
          <span className="rounded-pill bg-surface-raised px-3 py-1 text-xs text-text-secondary border-(length:--border-width-thin) border-border-subtle">
            {layers.publicBadge}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs text-text-secondary">
            <span>{l.availabilityLabel}</span>
            <select
              value={availability}
              onChange={(e) =>
                onChangeAvailability(e.target.value as AvailabilityBand)
              }
              className={inputClassName(false)}
            >
              <option value="lt_2w">{AVAILABILITY_2W_LABEL}</option>
              <option value="lt_1m">{AVAILABILITY_1M_LABEL}</option>
              <option value="full">{AVAILABILITY_FULL_LABEL}</option>
            </select>
          </label>

          <label className="flex items-center gap-3 pt-5 text-xs text-text-primary">
            <input
              type="checkbox"
              checked={acceptsNonMonetaryCounterpart}
              onChange={(e) => onChangeAcceptsGifts(e.target.checked)}
              className="size-4 rounded border-border-strong text-text-brand focus:ring-focus-ring"
            />
            <div className="flex flex-col">
              <span className="font-semibold">{l.acceptsGiftsLabel}</span>
              <span className="text-text-tertiary">
                Produits offerts ou dotations acceptés en complément ou alternative
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Rate card list */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-text-primary">
              {l.title}
            </span>
            <span className="text-xs text-text-tertiary">{l.subtitle}</span>
          </div>
          <button
            type="button"
            onClick={handleAddOffer}
            className="rounded-md border-(length:--border-width-thin) border-border-strong bg-surface-raised px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-hover"
          >
            {l.addOfferBtn}
          </button>
        </div>

        {offers.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-md border-(length:--border-width-thin) border-border-subtle p-6 text-center text-text-tertiary">
            <CircleAlertIcon
              className="size-(--size-icon-md) text-text-tertiary"
              aria-hidden="true"
            />
            <span className="pt-2 text-xs">{l.subtitle}</span>
            <button
              type="button"
              onClick={handleAddOffer}
              className="mt-4 rounded-md bg-action-primary-bg px-4 py-2 text-xs font-semibold text-text-on-action"
            >
              {l.addOfferBtn}
            </button>
          </div>
        ) : (
          offers.map((offer, idx) => {
            const currency = offer.currency || "EUR";
            const pb = PriceBandSchema.safeParse(offer.priceBand).success
              ? (offer.priceBand as PriceBand)
              : calculatePriceBandFromAmount(offer.exactAmountMinor || 75000, currency);

            const netInfo = getEstimatedNetForPriceBand(pb, currency);
            const minNetEur = Math.round(netInfo.minNetMinor / 100);
            const maxNetEur = Math.round(netInfo.maxNetMinor / 100);

            const indexBadge = `#${idx + 1}`;
            const formatOptionLabel =
              FORMAT_OPTIONS.find((f) => f.value === offer.format)?.label ||
              offer.format;
            const priceBandLabel = getPriceBandDisplay(pb, currency, locale);
            const netRangeDisplay = `≈ ${formatCurrencyAmount(minNetEur, currency, locale)} – ${formatCurrencyAmount(maxNetEur, currency, locale)}`;
            const currentExactMajor = (offer.exactAmountMinor || 75000) / 100;

            return (
              <div
                key={`offer-${idx}`}
                className="flex flex-col gap-4 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-card p-4"
              >
                {/* Header row of offer */}
                <div className="flex items-center justify-between border-b-(length:--border-width-thin) border-border-subtle pb-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-pill bg-surface-raised px-2 py-1 text-xs font-semibold text-text-primary">
                      {indexBadge}
                    </span>
                    <span className="text-sm font-semibold text-text-primary">
                      {formatOptionLabel}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveOffer(idx)}
                    className="text-xs font-medium text-feedback-error-text hover:underline"
                  >
                    {l.removeOfferBtn}
                  </button>
                </div>

                {/* Primary offer fields : Format, Réseau, Montant exact & Devise */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="flex flex-col gap-1 text-xs text-text-secondary">
                    <span>{l.formatLabel}</span>
                    <select
                      value={offer.format}
                      onChange={(e) =>
                        handleUpdateOfferField(idx, "format", e.target.value)
                      }
                      className={inputClassName(false)}
                    >
                      {FORMAT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-xs text-text-secondary">
                    <span>{l.networkLabel}</span>
                    <select
                      value={offer.network}
                      onChange={(e) =>
                        handleUpdateOfferField(idx, "network", e.target.value)
                      }
                      className={inputClassName(false)}
                    >
                      {NETWORK_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* M1 : Saisie en valeur exacte (Couche N) + dérivation automatique */}
                  <div className="flex flex-col gap-1 text-xs text-text-secondary">
                    <span>{l.priceBandLabel} (Montant exact indicatif)</span>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        step="10"
                        value={currentExactMajor}
                        onChange={(e) =>
                          handleUpdateExactAmount(idx, Number(e.target.value))
                        }
                        className={`${inputClassName(false)} flex-1`}
                        placeholder="Ex: 750"
                      />
                      <select
                        value={currency}
                        onChange={(e) =>
                          handleUpdateCurrency(idx, e.target.value as Currency)
                        }
                        className={`${inputClassName(false)} w-24`}
                      >
                        {CURRENCY_OPTIONS.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className="text-xs text-text-tertiary">
                      Tranche dérivée pour les marques : <strong className="text-text-primary">{priceBandLabel}</strong>
                    </span>
                  </div>
                </div>

                {/* 3 Notions Panel (07 RG69, 17 §5.4) — Aucun calcul applicatif de taux (A1, M4) */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-page p-3">
                    <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                      {l.notions.totalCostLabel}
                    </span>
                    <span className="text-xs text-text-tertiary">
                      {l.notions.totalCostDesc}
                    </span>
                    <span className="pt-1 text-sm font-bold text-text-primary">
                      {priceBandLabel}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-page p-3">
                    <span className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                      {l.notions.influxCommissionLabel}
                    </span>
                    <span className="text-xs text-text-tertiary">
                      {l.notions.influxCommissionDesc}
                    </span>
                    <span className="pt-1 text-xs font-medium text-text-secondary">
                      20 % à la charge de la marque, 15 % à votre charge
                    </span>
                  </div>

                  {/* M6 : Montant net neutre, sans flèche montante ni tokens de succès */}
                  <div className="flex flex-col gap-1 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-page p-3">
                    <span className="text-xs font-medium text-text-brand uppercase tracking-wider">
                      {l.notions.netEstimatedLabel}
                    </span>
                    <span className="text-xs text-text-tertiary">
                      {l.notions.netEstimatedDesc}
                    </span>
                    <span className="pt-1 text-sm font-bold text-text-primary">
                      {netRangeDisplay}
                    </span>
                  </div>
                </div>

                {/* Mention légale obligatoire fixe (17 §5.4) */}
                <p className="text-xs text-text-tertiary italic">
                  Estimation indicative, aux taux par défaut de la plateforme. Elle ne vaut pas engagement : les taux applicables sont figés à la signature du contrat.
                </p>

                {/* Logistics & Conditions */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-text-secondary">
                    <span>{l.deliveryLeadLabel}</span>
                    <select
                      value={offer.deliveryLeadBand || "7_14d"}
                      onChange={(e) =>
                        handleUpdateOfferField(
                          idx,
                          "deliveryLeadBand",
                          e.target.value as DeliveryLeadBand,
                        )
                      }
                      className={inputClassName(false)}
                    >
                      {DELIVERY_LEAD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-1 text-xs text-text-secondary">
                    <span>{l.exclusivityLabel}</span>
                    <select
                      value={offer.exclusivity || "none"}
                      onChange={(e) =>
                        handleUpdateOfferField(
                          idx,
                          "exclusivity",
                          e.target.value as ExclusivityBand,
                        )
                      }
                      className={inputClassName(false)}
                    >
                      {EXCLUSIVITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Usage Rights (Included vs Optional) */}
                <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t-(length:--border-width-thin) border-border-subtle">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-text-primary">
                      {l.includedRightsLabel}
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {USAGE_RIGHTS_AVAILABLE.map((right) => (
                        <label
                          key={`inc-${right.id}`}
                          className="flex items-center gap-2 text-xs text-text-secondary"
                        >
                          <input
                            type="checkbox"
                            checked={offer.includedUsageRights.includes(right.id)}
                            onChange={() =>
                              handleToggleIncludedRight(idx, right.id)
                            }
                            className="size-3.5 rounded border-border-strong text-text-brand focus:ring-focus-ring"
                          />
                          <span>{right.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-text-primary">
                      {l.optionalRightsLabel}
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {USAGE_RIGHTS_AVAILABLE.map((right) => (
                        <label
                          key={`opt-${right.id}`}
                          className="flex items-center gap-2 text-xs text-text-secondary"
                        >
                          <input
                            type="checkbox"
                            checked={offer.optionalUsageRights.includes(right.id)}
                            onChange={() =>
                              handleToggleOptionalRight(idx, right.id)
                            }
                            className="size-3.5 rounded border-border-strong text-text-brand focus:ring-focus-ring"
                          />
                          <span>{right.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

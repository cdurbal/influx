"use client";

import {
  PriceBandSchema,
  getEstimatedNetForPriceBand,
  type CreatorOfferInternal,
  type PriceBand,
  type AvailabilityBand,
  type ExclusivityBand,
  type DeliveryLeadBand,
} from "@influx/contracts";
import { inputClassName } from "@/components/ui/form-controls";
import {
  BriefcaseIcon,
  CircleAlertIcon,
  InfoIcon,
  TrendingUpIcon,
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

const PRICE_BAND_OPTIONS: { value: PriceBand; label: string }[] = [
  { value: "lt_250", label: "Moins de 250 € (Micro-format)" },
  { value: "250_500", label: "250 € à 500 €" },
  { value: "500_1000", label: "500 € à 1 000 €" },
  { value: "1000_2000", label: "1 000 € à 2 000 €" },
  { value: "2000_5000", label: "2 000 € à 5 000 €" },
  { value: "5000_10000", label: "5 000 € à 10 000 €" },
  { value: "plus_10000", label: "Plus de 10 000 € (Grand projet)" },
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

const STANDARD_COMMISSION_DISPLAY = "35 % (Barème standard)";
const AVAILABILITY_2W_LABEL = "Disponible sous 2 semaines";
const AVAILABILITY_1M_LABEL = "Disponible sous 1 mois";
const AVAILABILITY_FULL_LABEL = "Complet / Indisponible actuellement";

export function RateCardEditor({
  offers,
  availability,
  acceptsNonMonetaryCounterpart,
  onChangeOffers,
  onChangeAvailability,
  onChangeAcceptsGifts,
  labels,
}: RateCardEditorProps) {
  const l = labels.rates;
  const layers = labels.layers;

  function handleAddOffer() {
    const newOffer: CreatorOfferInternal = {
      format: "post",
      network: "instagram",
      priceBand: "500_1000",
      currency: "EUR",
      deliveryLeadBand: "7_14d",
      includedUsageRights: ["digital_organic"],
      optionalUsageRights: ["digital_paid_ads"],
      exclusivity: "none",
      exactAmountMinor: 75000,
      estimatedNetMinMinor: 32500,
      estimatedNetMaxMinor: 65000,
    };
    onChangeOffers([...offers, newOffer]);
  }

  function handleRemoveOffer(index: number) {
    const updated = offers.filter((_, i) => i !== index);
    onChangeOffers(updated);
  }

  function handleUpdateOffer(
    index: number,
    field: keyof CreatorOfferInternal,
    value: unknown,
  ) {
    const updated = [...offers];
    const current = { ...updated[index] };

    if (field === "priceBand") {
      const pb = value as PriceBand;
      const netInfo = getEstimatedNetForPriceBand(
        pb,
        current.currency || "EUR",
      );
      current.priceBand = pb;
      current.estimatedNetMinMinor = netInfo.minNetMinor;
      current.estimatedNetMaxMinor = netInfo.maxNetMinor;
    } else {
      (current as Record<string, unknown>)[field] = value;
    }

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

    handleUpdateOffer(index, "includedUsageRights", updatedRights);
  }

  function handleToggleOptionalRight(index: number, rightId: string) {
    const offer = offers[index];
    if (!offer) return;
    const exists = offer.optionalUsageRights.includes(rightId);
    const updatedRights = exists
      ? offer.optionalUsageRights.filter((r) => r !== rightId)
      : [...offer.optionalUsageRights, rightId];

    handleUpdateOffer(index, "optionalUsageRights", updatedRights);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Alerte primordiale RG65 : Coût marque total vs Net perçu */}
      <div className="flex items-start gap-3 rounded-md border-(length:--border-width-thin) border-border-selected bg-surface-card p-4 text-text-primary">
        <InfoIcon
          className="size-(--size-icon-md) shrink-0 text-text-brand"
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

          <label className="flex items-center gap-3 pt-4 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={acceptsNonMonetaryCounterpart}
              onChange={(e) => onChangeAcceptsGifts(e.target.checked)}
              className="size-(--size-icon-sm) rounded-sm border-(length:--border-width-thin) border-border-subtle bg-surface-page"
            />
            <span className="text-xs text-text-secondary">
              {l.acceptsGiftsLabel}
            </span>
          </label>
        </div>
      </div>

      {/* Offers List */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-heading-3 font-semibold text-text-primary">
            {l.title}
          </span>
          <button
            type="button"
            onClick={handleAddOffer}
            className="rounded-md border-(length:--border-width-thin) border-border-selected px-3 py-2 text-xs font-medium text-text-brand hover:bg-surface-raised"
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
            const pb = PriceBandSchema.safeParse(offer.priceBand).success
              ? (offer.priceBand as PriceBand)
              : "500_1000";
            const netInfo = getEstimatedNetForPriceBand(
              pb,
              offer.currency || "EUR",
            );

            const minNetEur = Math.round(netInfo.minNetMinor / 100);
            const maxNetEur = Math.round(netInfo.maxNetMinor / 100);

            const indexBadge = `#${idx + 1}`;
            const formatOptionLabel =
              FORMAT_OPTIONS.find((f) => f.value === offer.format)?.label ||
              offer.format;
            const priceBandLabel =
              PRICE_BAND_OPTIONS.find((p) => p.value === offer.priceBand)
                ?.label || offer.priceBand;
            const netRangeDisplay = `${minNetEur} € – ${maxNetEur} €`;

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

                {/* Primary offer fields */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <label className="flex flex-col gap-1 text-xs text-text-secondary">
                    <span>{l.formatLabel}</span>
                    <select
                      value={offer.format}
                      onChange={(e) =>
                        handleUpdateOffer(idx, "format", e.target.value)
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
                        handleUpdateOffer(idx, "network", e.target.value)
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

                  <label className="flex flex-col gap-1 text-xs text-text-secondary">
                    <span>{l.priceBandLabel}</span>
                    <select
                      value={offer.priceBand}
                      onChange={(e) =>
                        handleUpdateOffer(idx, "priceBand", e.target.value)
                      }
                      className={inputClassName(false)}
                    >
                      {PRICE_BAND_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* 3 Notions Panel (RG69) */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-page p-3">
                    <span className="text-xs font-medium text-text-secondary">
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
                    <span className="text-xs font-medium text-text-secondary">
                      {l.notions.influxCommissionLabel}
                    </span>
                    <span className="text-xs text-text-tertiary">
                      {l.notions.influxCommissionDesc}
                    </span>
                    <span className="pt-1 text-xs font-semibold text-text-tertiary">
                      {STANDARD_COMMISSION_DISPLAY}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-page p-3">
                    <span className="text-xs font-medium text-text-brand">
                      {l.notions.netEstimatedLabel}
                    </span>
                    <span className="text-xs text-text-tertiary">
                      {l.notions.netEstimatedDesc}
                    </span>
                    <div className="flex items-center gap-2 pt-1">
                      <TrendingUpIcon
                        className="size-(--size-icon-sm) text-feedback-success-icon"
                        aria-hidden="true"
                      />
                      <span className="text-sm font-bold text-feedback-success-text">
                        {netRangeDisplay}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Logistics & Conditions */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-xs text-text-secondary">
                    <span>{l.deliveryLeadLabel}</span>
                    <select
                      value={offer.deliveryLeadBand || "7_14d"}
                      onChange={(e) =>
                        handleUpdateOffer(
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
                        handleUpdateOffer(
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

                {/* Usage Rights (RG73) */}
                <div className="flex flex-col gap-2 pt-2">
                  <span className="text-xs font-semibold text-text-primary">
                    {l.usageRightsTitle}
                  </span>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Inclus */}
                    <div className="flex flex-col gap-2 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-page p-3">
                      <span className="text-xs font-medium text-text-primary">
                        {l.includedRightsLabel}
                      </span>
                      {USAGE_RIGHTS_AVAILABLE.map((right) => (
                        <label
                          key={`inc-${idx}-${right.id}`}
                          className="flex items-center gap-2 text-xs text-text-secondary"
                        >
                          <input
                            type="checkbox"
                            checked={offer.includedUsageRights.includes(
                              right.id,
                            )}
                            onChange={() =>
                              handleToggleIncludedRight(idx, right.id)
                            }
                            className="size-(--size-icon-sm) rounded-sm border-(length:--border-width-thin) border-border-subtle"
                          />
                          <span>{right.label}</span>
                        </label>
                      ))}
                    </div>

                    {/* En option */}
                    <div className="flex flex-col gap-2 rounded-md border-(length:--border-width-thin) border-border-subtle bg-surface-page p-3">
                      <span className="text-xs font-medium text-text-primary">
                        {l.optionalRightsLabel}
                      </span>
                      {USAGE_RIGHTS_AVAILABLE.map((right) => (
                        <label
                          key={`opt-${idx}-${right.id}`}
                          className="flex items-center gap-2 text-xs text-text-secondary"
                        >
                          <input
                            type="checkbox"
                            checked={offer.optionalUsageRights.includes(
                              right.id,
                            )}
                            onChange={() =>
                              handleToggleOptionalRight(idx, right.id)
                            }
                            className="size-(--size-icon-sm) rounded-sm border-(length:--border-width-thin) border-border-subtle"
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

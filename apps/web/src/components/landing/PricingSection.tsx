import { getTranslations } from "next-intl/server";
import { cn } from "@/components/ui/class-names";
import { CheckIcon, InfoIcon } from "@/components/ui/icons";
import { mutedTitleTags } from "@/components/ui/rich-text";
import { SectionHeader } from "@/components/ui/SectionHeader";

/*
 * Section 12 (02 §3.14): transparent pricing, CA19 to CA21.
 * STATIC TEXT ONLY: every rate and amount below is a translated string written in landing.json,
 * already formatted for the language. No arithmetic, no rate, no simulator in this component:
 * the commission is only ever computed by the future `billing` domain (CLAUDE.md §3 and §6).
 */

const LEGEND_ITEMS = [
  { id: "advertiserShare", swatchClassName: cn("bg-data-advertiser-share") },
  { id: "creatorShare", swatchClassName: cn("bg-data-creator-share") },
  { id: "netCreator", swatchClassName: cn("bg-data-net-creator") },
] as const;

export async function PricingSection() {
  const t = await getTranslations("landing.pricing");
  const cellClassName = cn("py-3 align-top");
  const amountClassName = cn(
    "py-3 pl-4 text-right align-top whitespace-nowrap tabular-nums",
  );

  return (
    <section aria-labelledby="pricing-title" className="bg-surface-muted">
      <div className="mx-auto grid max-w-(--container-max) grid-cols-1 gap-8 px-page-gutter py-section-block lg:grid-cols-12 lg:gap-grid-gap">
        <div className="flex flex-col gap-section-header lg:col-span-8">
          <SectionHeader
            titleId="pricing-title"
            overline={t("overline")}
            title={t.rich("title", mutedTitleTags)}
            lead={t("lead")}
          />

          <div className="flex flex-col gap-6 rounded-xl border-(length:--border-width-thin) border-border-default bg-metal-card p-inset-card shadow-metal-card">
            <div className="flex flex-col gap-4">
              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-heading-3 font-semibold text-text-primary">
                  {t("rate.label")}
                </span>
                <span className="text-amount-lg font-bold whitespace-nowrap text-text-brand tabular-nums">
                  {t("rate.total")}
                </span>
                <span className="text-md text-text-secondary">
                  {t("rate.included")}
                </span>
              </p>

              {/* Decorative bar: the legend below carries the same information in text. */}
              <div
                aria-hidden="true"
                className="flex h-8 w-full overflow-hidden rounded-pill border-(length:--border-width-thin) border-border-strong text-sm font-semibold tabular-nums"
              >
                <span className="flex w-1/5 items-center justify-center bg-data-advertiser-share text-text-inverse">
                  <span className="hidden sm:inline">
                    {t("rate.legend.advertiserShare.value")}
                  </span>
                </span>
                <span className="flex w-3/20 items-center justify-center bg-data-creator-share text-text-on-action">
                  <span className="hidden sm:inline">
                    {t("rate.legend.creatorShare.value")}
                  </span>
                </span>
                <span className="flex w-13/20 items-center justify-center bg-data-net-creator text-text-primary">
                  <span className="hidden sm:inline">
                    {t("rate.legend.netCreator.value")}
                  </span>
                </span>
              </div>

              <ul className="flex flex-col gap-2 text-md text-text-primary sm:flex-row sm:flex-wrap sm:gap-x-6">
                {LEGEND_ITEMS.map((item) => (
                  <li key={item.id} className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-(--size-icon-sm) shrink-0 rounded-sm border-(length:--border-width-thin) border-border-strong",
                        item.swatchClassName,
                      )}
                    />
                    <span>{t(`rate.legend.${item.id}.label`)}</span>
                    <span className="font-semibold whitespace-nowrap tabular-nums">
                      {t(`rate.legend.${item.id}.value`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <table className="w-full border-collapse text-left text-md text-text-primary">
              <caption className="pb-3 text-left text-heading-3 font-semibold text-text-primary">
                {t("example.caption")}
              </caption>
              <thead>
                <tr className="border-b-(length:--border-width-thin) border-border-subtle text-sm text-text-tertiary">
                  <th
                    scope="col"
                    className="sr-only pb-2 font-semibold md:not-sr-only"
                  >
                    {t("example.columnItem")}
                  </th>
                  <th
                    scope="col"
                    className="sr-only pb-2 text-right font-semibold md:not-sr-only"
                  >
                    {t("example.columnAmount")}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b-(length:--border-width-thin) border-border-subtle">
                  <th scope="row" className={cn(cellClassName, "font-regular")}>
                    {t("example.contractAmount.label")}
                  </th>
                  <td className={cn(amountClassName, "font-semibold")}>
                    {t("example.contractAmount.value")}
                  </td>
                </tr>
                <tr className="border-b-(length:--border-width-thin) border-border-subtle">
                  <th scope="row" className={cn(cellClassName, "font-regular")}>
                    {t("example.commissionTotal.label")}
                  </th>
                  <td className={cn(amountClassName, "font-semibold")}>
                    {t("example.commissionTotal.value")}
                  </td>
                </tr>
                <tr className="border-b-(length:--border-width-thin) border-border-subtle text-text-secondary">
                  <th
                    scope="row"
                    className={cn(cellClassName, "pl-5 font-regular")}
                  >
                    {t("example.advertiserShare.label")}
                  </th>
                  <td className={amountClassName}>
                    {t("example.advertiserShare.value")}
                  </td>
                </tr>
                <tr className="text-text-secondary">
                  <th
                    scope="row"
                    className={cn(cellClassName, "pl-5 font-regular")}
                  >
                    {t("example.creatorShare.label")}
                  </th>
                  <td className={amountClassName}>
                    {t("example.creatorShare.value")}
                  </td>
                </tr>
                <tr className="border-t-(length:--border-width-thick) border-border-strong bg-data-net-creator">
                  <th
                    scope="row"
                    className="px-3 py-4 align-middle font-semibold text-text-brand-strong"
                  >
                    {t("example.netCreator.label")}
                  </th>
                  <td className="px-3 py-4 text-right align-middle text-amount-lg font-bold whitespace-nowrap text-text-primary tabular-nums">
                    {t("example.netCreator.value")}
                  </td>
                </tr>
              </tbody>
            </table>

            <p className="flex items-start gap-2 text-sm text-text-secondary">
              <CheckIcon
                aria-hidden="true"
                className="mt-1 size-(--size-icon-sm) shrink-0"
              />
              {t("example.check")}
            </p>

            <div className="flex flex-col gap-2 text-md text-text-primary">
              <p>{t("audience.advertiser")}</p>
              <p>{t("audience.creator")}</p>
            </div>

            <ul className="flex flex-col gap-2 text-sm text-text-tertiary">
              <li className="flex items-start gap-2">
                <InfoIcon
                  aria-hidden="true"
                  className="mt-1 size-(--size-icon-sm) shrink-0"
                />
                {t("notes.currency")}
              </li>
              <li className="flex items-start gap-2">
                <InfoIcon
                  aria-hidden="true"
                  className="mt-1 size-(--size-icon-sm) shrink-0"
                />
                {t("notes.taxes")}
              </li>
            </ul>
          </div>
        </div>

        <figure className="mx-auto flex w-full max-w-(--size-phone-mockup) flex-col gap-3 lg:col-span-4 lg:self-center">
          {/* Phone screen: repeats the example already read in the table, hidden from assistive technologies. */}
          <div
            aria-hidden="true"
            className="rounded-xl bg-surface-inverse p-3 shadow-lg"
          >
            <div className="flex flex-col gap-3 rounded-lg bg-surface-page p-5">
              <p className="text-sm font-semibold text-text-secondary">
                {t("phone.screenTitle")}
              </p>
              <div className="flex flex-col gap-1 rounded-md bg-brand-subtle-bg p-4">
                <span className="text-sm font-semibold text-text-brand-strong">
                  {t("phone.netLabel")}
                </span>
                <span className="text-amount-lg font-bold whitespace-nowrap text-text-primary tabular-nums">
                  {t("phone.netValue")}
                </span>
              </div>
              <p className="text-sm text-text-primary">
                {t("phone.contractLine")}
              </p>
              <p className="text-sm text-text-secondary tabular-nums">
                {t("phone.commissionLine")}
              </p>
              <p className="text-sm text-text-secondary tabular-nums">
                {t("phone.sharesLine")}
              </p>
              <span className="mt-2 inline-flex min-h-(--size-button-md) items-center justify-center rounded-pill bg-action-primary-bg px-inset-button-x text-center font-medium text-text-on-action">
                {t("phone.fakeButton")}
              </span>
            </div>
          </div>
          <figcaption className="text-sm text-text-secondary">
            {t("phone.caption")}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

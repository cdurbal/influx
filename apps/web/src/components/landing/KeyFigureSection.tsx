import { getTranslations } from "next-intl/server";
import { mutedTitleTags } from "@/components/ui/rich-text";
import type { KeyFigure } from "@/content/landing-content";

type KeyFigureSectionProps = {
  figure: KeyFigure;
};

/** Section 2 (02 §3.4): one key figure with its source note. Figure and label share one <p>. */
export async function KeyFigureSection({ figure }: KeyFigureSectionProps) {
  const t = await getTranslations("landing.keyFigure");

  return (
    <section aria-labelledby="key-figure-title" className="bg-surface-muted">
      <h2 id="key-figure-title" className="sr-only">
        {t("srTitle")}
      </h2>
      <div className="mx-auto px-page-gutter py-section-block">
        <div className="mx-auto flex max-w-(--container-max) flex-col gap-2 rounded-xl border-(length:--border-width-thin) border-border-default bg-metal-card p-inset-card text-center shadow-metal-card lg:text-left">
          <p className="flex flex-col items-center gap-2 text-heading-3 font-semibold text-text-primary lg:flex-row lg:gap-grid-gap">
            {t.rich("statement", {
              value: figure.value,
              highlight: (chunks) => (
                <span className="text-figure-xl font-extrabold tracking-display text-text-brand-strong tabular-nums lg:w-5/12 lg:shrink-0">
                  {chunks}
                </span>
              ),
              muted: mutedTitleTags.muted,
            })}
          </p>
          <p className="text-sm text-text-secondary lg:ml-auto lg:w-7/12">
            {figure.sourceNote}
          </p>
        </div>
      </div>
    </section>
  );
}

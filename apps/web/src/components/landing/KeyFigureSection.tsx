import { getTranslations } from "next-intl/server";
import type { KeyFigure } from "@/content/landing-content";

type KeyFigureSectionProps = {
  figure: KeyFigure;
};

/** Section 2 (02 §3.4): one key figure with its source note. Figure and label share one <p>. */
export async function KeyFigureSection({ figure }: KeyFigureSectionProps) {
  const t = await getTranslations("landing.keyFigure");

  return (
    <section
      aria-labelledby="key-figure-title"
      className="bg-surface-accent text-text-on-accent"
    >
      <h2 id="key-figure-title" className="sr-only">
        {t("srTitle")}
      </h2>
      <div className="mx-auto flex max-w-(--container-max) flex-col gap-2 px-page-gutter py-8 text-center lg:py-10 lg:text-left">
        <p className="flex flex-col items-center gap-2 text-heading-3 font-semibold lg:flex-row lg:gap-grid-gap">
          {t.rich("statement", {
            value: figure.value,
            highlight: (chunks) => (
              <span className="text-figure-xl font-extrabold tracking-display tabular-nums lg:w-5/12 lg:shrink-0">
                {chunks}
              </span>
            ),
          })}
        </p>
        <p className="text-sm text-text-secondary lg:ml-auto lg:w-7/12">
          {figure.sourceNote}
        </p>
      </div>
    </section>
  );
}

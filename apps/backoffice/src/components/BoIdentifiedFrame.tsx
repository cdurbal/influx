// The marker of the identified view (docs/mvp/17b §3.3, §4.9 `BoIdentifiedFrame`; 10 RG80; 15 RG119): a full bar of 4 px
// on the left of the content, `color-bo-identified-accent`, and a written heading. Three carriers for one fact, a
// shape, a text and a hue, because it is the costliest one to miss: a commercial who shares a screen with a brand
// must never leave real names, handles or exact figures on it. The bar survives a cropped capture and a print in
// black and white, a tinted ground does not. The hue is never an action, a success or an alert, and never in
// apps/web.
import type { ReactNode } from "react";
import { messages } from "@/messages/fr";
import { DiamondIcon } from "./icons";

const t = messages.identifiedSearch.frame;

export function BoIdentifiedFrame({ children }: { children: ReactNode }) {
  return (
    <section
      aria-label={t.label}
      data-identified-frame
      className="flex min-w-0 gap-4"
    >
      <div
        aria-hidden="true"
        data-identified-bar
        className="w-(--spacing-bo-identified-bar) shrink-0 self-stretch bg-bo-identified-accent"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-col gap-1 rounded-md bg-bo-identified-bg px-4 py-3 text-sm">
          <p className="flex items-center gap-2 font-display font-bold text-bo-identified-accent">
            <DiamondIcon
              aria-hidden="true"
              className="size-(--size-icon-sm) shrink-0"
            />
            <span>{t.mark}</span>
            <span className="font-regular text-text-primary">{t.lead}</span>
          </p>
          <p className="text-text-secondary">{t.warning}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

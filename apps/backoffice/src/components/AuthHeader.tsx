import type { ReactNode, Ref } from "react";
import { messages } from "@/messages/fr";
import {
  AUTH_GLOW_CLASSES,
  AUTH_HEAD_CLASSES,
  BRAND_CLASSES,
  HELP_CLASSES,
  TITLE_CLASSES,
} from "./auth-classes";

type AuthHeaderProps = {
  /** The one `h1` of the page; focused on arrival and at each step (17b §3.14). */
  title: ReactNode;
  titleRef?: Ref<HTMLHeadingElement>;
  /** "Step 2 of 3", above the title. */
  step?: ReactNode;
};

/** The head of a standalone page (20 §11.8): INFLUX, the glow of F6, the single `h1`. No navigation. */
export function AuthHeader({ title, titleRef, step }: AuthHeaderProps) {
  return (
    <header className={AUTH_HEAD_CLASSES}>
      <div aria-hidden="true" className={AUTH_GLOW_CLASSES} />
      <p className={BRAND_CLASSES}>{messages.brand}</p>
      {step === undefined ? null : <p className={HELP_CLASSES}>{step}</p>}
      <h1 ref={titleRef} tabIndex={-1} className={TITLE_CLASSES}>
        {title}
      </h1>
    </header>
  );
}

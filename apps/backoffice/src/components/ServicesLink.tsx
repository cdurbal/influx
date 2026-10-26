"use client";

// The link "état des services" of the queues to the "Santé technique" screen (docs/mvp/15 §C, "file
// vide contre file bloquée"; 02 §20.5; 21 §J9 commit 9). Admins only: the screen is theirs, and an
// agent does not see a link that apps/api would refuse (and journal). Never the control: the
// server refuses the read of an agent either way.
import Link from "next/link";
import { messages } from "@/messages/fr";
import { HELP_CLASSES } from "./auth-classes";
import { LINK_CLASSES } from "./bo-classes";
import { useMe } from "./Shell";

export function ServicesLink() {
  const me = useMe();
  if (me.role !== "admin") {
    return null;
  }
  return (
    <Link href="/sante-technique" className={LINK_CLASSES}>
      {messages.servicesLink.label}
    </Link>
  );
}

/** A line of help that ends on the link: shown to an admin only, never a sentence cut short. */
export function ServicesHint({ text }: { text: string }) {
  const me = useMe();
  if (me.role !== "admin") {
    return null;
  }
  return (
    <p className={HELP_CLASSES}>
      {text} <ServicesLink />
    </p>
  );
}

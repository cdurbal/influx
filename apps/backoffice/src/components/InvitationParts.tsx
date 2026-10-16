"use client";

// Pieces shared by the two invitation screens (docs/mvp/15 RG99, RG101; 05 RG116 to RG119; 17b
// §3.13.a; EC-J8-2: the two objects are never merged, only their pieces of screen are). The link is
// shown ONCE, at creation, and copied by the person (EC-J8-3: INFLUX sends no invitation e-mail
// before Lot 5); a revocation carries a typed reason.
import { INVITATION_REVOKE_REASONS } from "@influx/contracts/backoffice-invitations";
import { useId, useState } from "react";
import { messages } from "@/messages/fr";
import { HELP_CLASSES, WARNING_CLASSES } from "./auth-classes";
import { ActionFeedback } from "./ActionFeedback";
import { revokeInvitation } from "./backoffice-api";
import {
  FIELD_CLASSES,
  MONO_CLASSES,
  SELECT_CLASSES,
  SMALL_LABEL_CLASSES,
  SMALL_SECONDARY_CLASSES,
} from "./bo-classes";
import { useAction } from "./use-action";
import { formatDateTime } from "./view-model";

const t = messages.invitations;

export function LinkOnce({
  link,
  expiresAt,
}: {
  link: string;
  expiresAt: string;
}) {
  const id = useId();
  const [copied, setCopied] = useState(false);
  return (
    <div className={`${WARNING_CLASSES} flex flex-col gap-2`}>
      <p>{t.linkOnce}</p>
      <p id={id} className="sr-only">
        {t.linkLabel}
      </p>
      <p aria-labelledby={id} className={MONO_CLASSES}>
        {link}
      </p>
      <p>{t.expires(formatDateTime(expiresAt))}</p>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(link).then(() => setCopied(true));
        }}
        className={`${SMALL_SECONDARY_CLASSES} self-start`}
      >
        {messages.common.copy}
      </button>
      {copied ? (
        <p role="status" className={HELP_CLASSES}>
          {messages.common.copied}
        </p>
      ) : null}
    </div>
  );
}

type RevokeReason = (typeof INVITATION_REVOKE_REASONS)[number];

/** Revocation of one invitation, with its typed reason (0131). */
export function RevokeControl({
  kind,
  id,
  email,
  onRevoked,
}: {
  kind: "internal" | "member";
  id: string;
  email: string;
  onRevoked: () => void;
}) {
  const selectId = useId();
  const action = useAction();
  const [reason, setReason] = useState<RevokeReason | "">("");
  return (
    <div className="flex flex-col gap-2">
      <div className={FIELD_CLASSES}>
        <label htmlFor={selectId} className={SMALL_LABEL_CLASSES}>
          {t.revokeReason(email)}
        </label>
        <select
          id={selectId}
          value={reason}
          onChange={(event) => setReason(event.target.value as RevokeReason)}
          className={SELECT_CLASSES}
        >
          <option value="">{messages.common.reasonPlaceholder}</option>
          {INVITATION_REVOKE_REASONS.map((code) => (
            <option key={code} value={code}>
              {t.revokeReasons[code]}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        aria-disabled={reason === "" || action.busy || undefined}
        onClick={() => {
          if (reason !== "" && !action.busy) {
            void action.run(
              () => revokeInvitation(kind, id, reason),
              onRevoked,
            );
          }
        }}
        className={`${SMALL_SECONDARY_CLASSES} self-start`}
      >
        {t.revoke}
      </button>
      <ActionFeedback action={action} />
    </div>
  );
}

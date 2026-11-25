// What blocks 2 and 3 of the record of a brand show, out of the answer of apps/api (docs/mvp/15
// RG41, RG123; 17b §3.5; jalons/l2c/file.md A4; L2C-18): the contact person, the state of the
// profile, the moderated fields that wait for a decision, and the decisions taken so far in words.
// Pure functions, outside the components. No rule is decided here: apps/api and the database say
// what is on the profile and what was decided; this module only words. The words of a field, a
// refusal reason and a profile state are those of the queue screens (queue-review-facts.ts).
import type { AccountBrand } from "@influx/contracts/backoffice-accounts";
import type { RejectionReasonCode } from "@influx/contracts/brand-profile";
import { messages } from "@/messages/fr";
import { contactFacts, fieldLabel, humanCode } from "./queue-review-facts";
import { formatDateTime } from "./view-model";

const t = messages.accountBrand;
const q = messages.queueReview;

export type BrandLine = { key: string; label: string; value: string };

/** Block 2: the contact person, the role first (a code of a closed list, humanised). */
export function brandContactLines(
  contact: AccountBrand["contact"],
): BrandLine[] {
  const [first, ...rest] = contactFacts(contact);
  return [
    ...(first === undefined ? [] : [first]),
    {
      key: "role",
      label: t.role,
      value: contact.role === null ? q.unset : humanCode(contact.role),
    },
    ...rest,
  ];
}

/** Block 3, head: the state, the completeness, and the fields that wait for a decision (06 RG9). */
export function brandProfileLines(
  profile: AccountBrand["profile"],
): BrandLine[] {
  const statuses = q.statuses as Readonly<Record<string, string>>;
  return [
    {
      key: "status",
      label: t.status,
      value: statuses[profile.status] ?? profile.status,
    },
    {
      key: "completeness",
      label: t.completeness,
      value:
        profile.completenessPercent === null
          ? q.unset
          : `${profile.completenessPercent} %`,
    },
    {
      key: "changed",
      label: t.changed,
      value:
        profile.changedFields.length === 0
          ? t.changedNone
          : profile.changedFields.map(fieldLabel).join(", "),
    },
  ];
}

function reasonWords(code: RejectionReasonCode): string {
  return q.decision.reasonLabels[code];
}

/** The decisions, the most recent first as the server sends them, one sentence each. */
export function decisionLines(
  decisions: AccountBrand["profile"]["decisions"],
): { key: string; line: string }[] {
  return decisions.map((decision, at) => {
    const when = formatDateTime(decision.decidedAt);
    const who = decision.decidedBy?.displayName ?? t.decision.unknownAgent;
    const base =
      decision.outcome === "published"
        ? t.decision.published(when, who)
        : t.decision.rejected(
            when,
            who,
            decision.reasonCode === null
              ? q.unset
              : reasonWords(decision.reasonCode),
          );
    return {
      key: `${decision.decidedAt}-${at}`,
      line: decision.late ? `${base}${t.decision.late}` : base,
    };
  });
}

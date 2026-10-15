// The emergency switch of the e-mails (docs/mvp/16 RG121, RG122; 04 §5.10 "L'interrupteur
// d'urgence"). What it holds is read on the CLASS of a send (leads.send_priority, a mandatory column
// of the journal), never on its template: all_paused holds P1 and P2, nothing ever holds P0 (the
// sign-in code and the internal critical alerts, RG122). marketing_paused holds no transactional
// send. A synchronous send that the switch holds cannot wait: its route answers 503 before it
// writes or consumes anything.
//
// The switch is stored from Lot 5 on (key email_kill_switch of backoffice.operational_settings,
// migration 0503); until then it is never set and reads "off".

export type EmailSwitchLevel = "off" | "marketing_paused" | "all_paused";

/** leads.send_priority (0015). */
export type SendPriority = "p0" | "p1" | "p2";

export type EmailSwitch = {
  level(): Promise<EmailSwitchLevel>;
};

/** Until Lot 5: nothing stores the switch, it is off. */
export const EMAIL_SWITCH_NOT_STORED: EmailSwitch = {
  level: () => Promise.resolve("off"),
};

/** True when the switch at `level` holds a transactional send of class `priority` (RG121, RG122). */
export function holdsTransactionalSend(
  level: EmailSwitchLevel,
  priority: SendPriority,
): boolean {
  return level === "all_paused" && priority !== "p0";
}

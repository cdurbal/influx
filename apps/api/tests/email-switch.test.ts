// The emergency switch of the e-mails, read on the class of a send (16 RG121, RG122; 04 §5.10):
// all_paused holds P1 and P2, nothing ever holds P0, marketing_paused no transactional send. The
// route that refuses a held synchronous send is tm1-email-change-route.
import { describe, expect, it } from "vitest";
import {
  EMAIL_SWITCH_NOT_STORED,
  holdsTransactionalSend,
  type EmailSwitchLevel,
  type SendPriority,
} from "../src/platform/email-switch.ts";

const LEVELS: readonly EmailSwitchLevel[] = [
  "off",
  "marketing_paused",
  "all_paused",
];
const PRIORITIES: readonly SendPriority[] = ["p0", "p1", "p2"];

describe("16 RG121, RG122: what the switch holds", () => {
  it.each(LEVELS)(
    "never holds P0 (the sign-in code, the critical alerts) at %s",
    (level) => {
      expect(holdsTransactionalSend(level, "p0")).toBe(false);
    },
  );

  it("holds P1 and P2 at all_paused only", () => {
    const held = LEVELS.flatMap((level) =>
      PRIORITIES.filter((priority) =>
        holdsTransactionalSend(level, priority),
      ).map((priority) => `${level}:${priority}`),
    );
    expect(held).toEqual(["all_paused:p1", "all_paused:p2"]);
  });

  it("reads off until Lot 5 stores it", async () => {
    expect(await EMAIL_SWITCH_NOT_STORED.level()).toBe("off");
  });
});

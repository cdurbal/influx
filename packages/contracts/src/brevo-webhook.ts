// POST /v1/webhooks/brevo/:pathToken, the Brevo webhook (docs/mvp/16 §M6 RG146, RG147; 21 EC-12;
// decisions 1 and 2 of the J7 start). One transactional or marketing e-mail event per request
// (Brevo's batched webhooks are disabled: a list is not an event). Only the fields the raw line keeps
// are declared; every other one (subject, link, IP, user agent, tags, campaign name…) is dropped by
// the parse and never reaches the database nor a log line (D60). Field names are Brevo's, checked
// on developers.brevo.com (transactional-webhooks, marketing-webhooks) on 2026-10-13.
import { z } from "./zod.ts";

/** Custom header carrying the shared token (RG146-1), forwarded by the relay (03 PP-5). */
export const BREVO_WEBHOOK_TOKEN_HEADER = "brevo-webhook-token";

/** RG146-4: an event more than 15 minutes away from the current time is not recorded. */
export const BREVO_WEBHOOK_WINDOW_SECONDS = 15 * 60;

/** Decision 1: 64 KiB, far above one event. */
export const BREVO_WEBHOOK_BODY_LIMIT_BYTES = 65_536;

/** A Brevo identifier; 0 (no campaign, no template) is read as absent. */
const brevoId = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);

export const brevoWebhookEventSchema = z.object({
  // A normalised name; unknown names are recorded, then journaled and ignored by the worker (RG105).
  event: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
  // Seconds since the epoch, UTC: the instant of the window (RG146-4) and of the dedup key.
  ts_event: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  "message-id": z
    .string()
    .regex(/^[\x21-\x7E]{1,200}$/)
    .optional(),
  email: z
    .string()
    .max(320)
    .regex(/^[^\s@]+@[^\s]+$/)
    .optional(),
  template_id: brevoId.optional(),
  camp_id: brevoId.optional(),
  // Cleaned again by the database: one line, 200 characters, addresses replaced (D60).
  reason: z.string().max(2000).optional(),
});

export type BrevoWebhookEvent = z.infer<typeof brevoWebhookEventSchema>;

/** The only body of a 200 (RG147): received, whatever became of the event. */
export const brevoWebhookReceiptSchema = z.strictObject({
  received: z.literal(true),
});

export type BrevoWebhookReceipt = z.infer<typeof brevoWebhookReceiptSchema>;

/**
 * J7 decision 2, 16 RG106: the webhook subscribes to the events that withdraw a right ONLY, by the
 * names of Brevo's `POST /v3/webhooks` (`events`, read on 2026-10-13); batches disabled. Applied at
 * Brevo by the configuration gesture of J7 commit 10, never by the code. The names they arrive
 * under in the body are WITHDRAWING_EVENTS; anything else that still arrives is processed as
 * informative or unknown (RG105).
 */
export const BREVO_WEBHOOK_SUBSCRIPTION = {
  transactional: ["hardBounce", "invalid", "blocked", "spam", "unsubscribed"],
  marketing: ["hardBounce", "spam", "unsubscribed"],
} as const;

/** 16 RG106, first family: the event names of the body that withdraw a right (0116). */
export const WITHDRAWING_EVENTS = [
  "unsubscribed",
  "spam",
  "hard_bounce",
  "invalid_email",
  "blocked",
] as const;

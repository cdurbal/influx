// Contract of the rescue channel without sign-in, "je ne reçois pas mon code" (docs/mvp/05 RG65,
// CA26; J7 decision 6, commit 8). Shared by apps/api and apps/web. The answer is ONE value,
// whatever the addresses: it says nothing about an account, and never carries a code nor opens a
// session (RG65). Over the rate of the network: 429 rate_limited (18 T15).
import { z } from "./zod.ts";
import { MAX_EMAIL_LENGTH, normalizeEmail, uiLocaleSchema } from "./auth.ts";

/** The free text of a report (0120: at most 500 characters, control characters replaced). */
export const MAX_DELIVERY_REPORT_MESSAGE_LENGTH = 500;

const emailSchema = z
  .string()
  .max(MAX_EMAIL_LENGTH * 2)
  .transform(normalizeEmail)
  .pipe(z.email().max(MAX_EMAIL_LENGTH));

/** POST /v1/support/code-not-received. */
export const codeNotReceivedBodySchema = z.strictObject({
  /** The address the person signs in with (never looked up: RG65). */
  loginEmail: emailSchema,
  /** Another address, where INFLUX may answer. */
  contactEmail: emailSchema,
  message: z.string().max(MAX_DELIVERY_REPORT_MESSAGE_LENGTH).optional(),
  /** Language of the page (the answer of the support speaks it). */
  locale: uiLocaleSchema,
});
export type CodeNotReceivedBody = z.infer<typeof codeNotReceivedBodySchema>;

export const codeNotReceivedResponseSchema = z.strictObject({
  outcome: z.literal("received"),
});
export type CodeNotReceivedResponse = z.infer<
  typeof codeNotReceivedResponseSchema
>;

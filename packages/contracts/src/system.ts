// Responses of the technical routes GET /health and GET /v1/status
// (docs/mvp/21-plan-de-developpement.md §4, J1-G). No detail: no version, no host, no dependency.
import * as z from "zod";

export const systemStatusSchema = z.object({
  status: z.literal("ok"),
});

export type SystemStatus = z.infer<typeof systemStatusSchema>;

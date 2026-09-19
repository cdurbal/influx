import { FastifyInstance, FastifyPluginAsync } from "fastify";
import {
  leadOutboxService,
  LeadOutboxService,
} from "../services/lead-outbox-service";

export const leadRoutes: FastifyPluginAsync<{
  service?: LeadOutboxService;
}> = async (fastify: FastifyInstance, opts) => {
  const service = opts.service || leadOutboxService;

  const isPrefixed =
    fastify.prefix.includes("/leads") || fastify.prefix.includes("/backoffice");
  const p = isPrefixed ? "" : "/api/backoffice";

  /**
   * GET /api/backoffice/leads
   * Supervision des leads et de leur état de synchronisation (Brevo / Apollo)
   */
  fastify.get(`${p}/leads`, async (_request, reply) => {
    const leads = service.getLeads();
    return reply.status(200).send({
      leads,
      total: leads.length,
      synced: leads.filter((l) => l.status === "synced").length,
      failed: leads.filter((l) => l.status === "failed").length,
      pending: leads.filter((l) => l.status === "pending").length,
    });
  });

  /**
   * POST /api/backoffice/leads
   * Enregistrement d'un nouveau lead (déclenché à l'inscription ou en dev)
   */
  fastify.post(`${p}/leads`, async (request, reply) => {
    const body = (request.body as any) || {};
    const { email, role } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Adresse e-mail invalide",
      });
    }

    if (!role || (role !== "advertiser" && role !== "creator")) {
      return reply.status(400).send({
        error: "ValidationError",
        message: "Rôle invalide pour un lead (advertiser ou creator requis)",
      });
    }

    const lead = await service.recordLead({
      email,
      role,
      language: body.language,
      countryCode: body.countryCode,
      marketingConsent: body.marketingConsent,
      simulateFailure: body.simulateFailure,
    });

    return reply.status(201).send({
      success: true,
      lead,
    });
  });

  /**
   * POST /api/backoffice/leads/:id/replay
   * Rejeu unitaire d'un lead en échec
   */
  fastify.post<{ Params: { id: string } }>(
    `${p}/leads/:id/replay`,
    async (request, reply) => {
      const { id } = request.params;

      try {
        const lead = await service.replayLead(id);
        return reply.status(200).send({
          success: lead.status === "synced",
          lead,
        });
      } catch (err: any) {
        if (err.message && err.message.includes("introuvable")) {
          return reply.status(404).send({
            error: "NotFound",
            message: err.message,
          });
        }
        return reply.status(400).send({
          error: "ReplayError",
          message: err.message || "Échec du rejeu du lead",
        });
      }
    },
  );
};

export default leadRoutes;

// Routes of the record of a campaign and of the acts of an agent on it (docs/mvp/09 RG1, RG8, RG9, RG93,
// RG94; 03 C(7); 17b §3.8; jalons/l3c/modele.md §5, §6; l3c-fiche invariants 6, 7, 11, 12; 18 T14).
// Backoffice surface; the aal2 guard of server.ts runs first, then each handler reads and writes through
// withBackofficeSession() (agent and admin).
//   GET  /v1/bo/campaigns/:id: the record of a campaign for an agent. A GET with an effect: the read is
//        opened by the journaled door of the database (`campaign.record_read`, modele §6), then the agent
//        reads with his own grants. The budget is read by the key of its band label (D78); the old and new
//        values of a figure are not served.
//   POST /v1/bo/campaigns: a draft opened for a brand that called (RG1, Q2): the brand completes and
//        submits it, never INFLUX.
//   POST /v1/bo/campaigns/:id/corrections: ONE field, a typed reason (RG94); old and new value kept by the
//        database, the brand told by e-mail. A pending campaign only under the caller's live claim, without
//        an opinion yet.
//   POST /v1/bo/campaigns/:id/{pause|resume|close}: the passages of an agent with authority (RG8, RG9): a
//        pause of INFLUX is not resumed by the brand, a closing is irreversible.
// - An unknown campaign and the one of the caller's own account answer exactly alike (404, T14.3, T14.4). The
//   passages admit an account the caller holds (modele §5); the correction of a pending campaign of an
//   account he holds answers 403 `conflict_of_interest` after the trace of the attempt (RG36, CA19).
// - Every answer is `Cache-Control: no-store`.
import {
  campaignPassageRequestSchema,
  campaignPassageResponseSchema,
  campaignRecordParamsSchema,
  campaignRecordResponseSchema,
  correctCampaignFieldRequestSchema,
  correctCampaignFieldResponseSchema,
  createCampaignForBrandRequestSchema,
  createCampaignForBrandResponseSchema,
  type CampaignPassageRequest,
  type CampaignPassageResponse,
  type CampaignRecordParams,
  type CampaignRecordResponse,
  type CorrectCampaignFieldRequest,
  type CorrectCampaignFieldResponse,
  type CreateCampaignForBrandRequest,
  type CreateCampaignForBrandResponse,
} from "@influx/contracts/campaign-review";
import { ApiError } from "../../platform/errors.ts";
import type { IdentityApp } from "../identity/routes.ts";
import { unlessConflict } from "./action-guards.ts";
import {
  correctCampaignField,
  createCampaignForBrand,
  openCampaignRecord,
  passCampaign,
} from "./campaign-queue/acts/repository.ts";
import { textAlertsOf } from "./campaign-queue/alerts.ts";
import {
  CAMPAIGNS,
  campaignActsOf,
  type CampaignQueueDependencies,
} from "./campaign-queue/guards.ts";
import {
  readCampaignBrand,
  readCampaignEntryHistory,
  readCampaignInterventions,
  readCampaignView,
  readDuplicateOf,
  readLatestDuplicateId,
} from "./campaign-queue/views/repository.ts";

export function registerCampaignRecordRoutes(
  app: IdentityApp,
  dependencies: CampaignQueueDependencies,
): void {
  const acts = campaignActsOf(dependencies.database);

  app.get(
    `${CAMPAIGNS}/:id`,
    {
      schema: {
        params: campaignRecordParamsSchema,
        response: { 200: campaignRecordResponseSchema },
      },
    },
    async (request, reply): Promise<CampaignRecordResponse> => {
      const campaignId = (
        request.params as CampaignRecordParams
      ).id.toLowerCase();
      return acts.inSession(request, reply, async (tx, context) => {
        // the journaled door first (modele §6): 42501 for an unknown campaign or the caller's own account
        await acts.onCampaign(
          tx,
          context,
          campaignId,
          () => false,
          (savepoint) => openCampaignRecord(savepoint, campaignId),
        );
        const campaign = await readCampaignView(tx, campaignId);
        if (campaign === null) {
          throw new ApiError("not_found");
        }
        const brand = await readCampaignBrand(tx, campaign.advertiserAccountId);
        if (brand === null) {
          throw new ApiError("not_found");
        }
        const duplicateId = await readLatestDuplicateId(tx, campaignId);
        const duplicate =
          duplicateId === null ? null : await readDuplicateOf(tx, duplicateId);
        return {
          asOf: new Date().toISOString(),
          id: campaignId,
          brand: {
            ...brand,
            countryCode:
              brand.countryCode as CampaignRecordResponse["brand"]["countryCode"],
          },
          cycle: campaign.cycle,
          fields: campaign.fields,
          alerts: textAlertsOf(campaign.fields),
          duplicateOf:
            duplicate === null
              ? null
              : {
                  ...duplicate,
                  status: duplicate.status as NonNullable<
                    CampaignRecordResponse["duplicateOf"]
                  >["status"],
                },
          entries: await readCampaignEntryHistory(tx, campaignId),
          interventions: await readCampaignInterventions(tx, campaignId),
        };
      });
    },
  );

  app.post(
    CAMPAIGNS,
    {
      schema: {
        body: createCampaignForBrandRequestSchema,
        response: { 200: createCampaignForBrandResponseSchema },
      },
    },
    async (request, reply): Promise<CreateCampaignForBrandResponse> => {
      const body = request.body as CreateCampaignForBrandRequest;
      return acts.inSession(request, reply, (tx, context) =>
        acts.run(tx, context, "campaign", null, (savepoint) =>
          createCampaignForBrand(
            savepoint,
            body.advertiserAccountId.toLowerCase(),
            body.title,
            body.campaignType,
          ),
        ),
      );
    },
  );

  app.post(
    `${CAMPAIGNS}/:id/corrections`,
    {
      schema: {
        params: campaignRecordParamsSchema,
        body: correctCampaignFieldRequestSchema,
        response: { 200: correctCampaignFieldResponseSchema },
      },
    },
    async (request, reply): Promise<CorrectCampaignFieldResponse> => {
      const campaignId = (
        request.params as CampaignRecordParams
      ).id.toLowerCase();
      const body = request.body as CorrectCampaignFieldRequest;
      return unlessConflict(
        await acts.inSession(request, reply, (tx, context) =>
          acts.onCampaign(
            tx,
            context,
            campaignId,
            // modele §6: a pending campaign of an account he holds is not his to correct
            (status) => status === "pending_review",
            (savepoint) =>
              correctCampaignField(
                savepoint,
                campaignId,
                body.fieldCode,
                body.value,
                body.reasonCode,
                body.internalComment ?? null,
              ),
          ),
        ),
      );
    },
  );

  for (const passage of ["pause", "resume", "close"] as const) {
    app.post(
      `${CAMPAIGNS}/:id/${passage}`,
      {
        schema: {
          params: campaignRecordParamsSchema,
          body: campaignPassageRequestSchema,
          response: { 200: campaignPassageResponseSchema },
        },
      },
      async (request, reply): Promise<CampaignPassageResponse> => {
        const campaignId = (
          request.params as CampaignRecordParams
        ).id.toLowerCase();
        const body = request.body as CampaignPassageRequest;
        const passed = unlessConflict(
          await acts.inSession(request, reply, (tx, context) =>
            acts.onCampaign(
              tx,
              context,
              campaignId,
              // modele §5: a held account is admitted
              () => false,
              (savepoint) =>
                passCampaign(
                  savepoint,
                  passage,
                  campaignId,
                  body.reasonCode,
                  body.internalComment ?? null,
                ),
            ),
          ),
        );
        return {
          status: passed.status as CampaignPassageResponse["status"],
          interventionId: passed.interventionId,
        };
      },
    );
  }
}

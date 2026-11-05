// Route of the logo of an entry of queue 1, "profils marque à valider" (docs/mvp/06 RG9, RG15, RG18;
// 15 RG36, C2, RG121; jalons/archives/l2b/stockage.md §4; founder's decision of 2026-11-05; 0213;
// l2c-fiche invariants 7, 11, 13; 18 T14, T9.2). Backoffice surface; the aal2 guard of server.ts runs
// first, then the handler reads through withBackofficeSession() (agent and admin alike).
// - GET /v1/bo/queues/profiles-advertiser/entries/:id/logo?logo=<id>: the image the decision view
//   showed the characteristics of, relayed as JSON (type, sides, base64 bounded) like
//   GET /v1/me/brand-profile/logo, for the screen to draw it from a `blob:`. The logo is named by the
//   id the view served (`profile.logos`), the entry by the path.
// - It goes through profiles.read_advertiser_review_logo() (0213): the database checks the reader, the
//   entry and the logo and writes ONE `queue.logo_read` line {queue_code, logo_id, state} per read,
//   in the transaction. The object is then read by this process with its own relay of Storage, under
//   the key the function gave, which is never written to a response or a log.
// - An unknown entry, the one of the caller's own account, an unknown logo or the logo of another
//   account answer exactly alike (404, T14.3, T14.4); an entry of an account the caller HOLDS answers
//   403 with the issue `conflict_of_interest` (RG36), before any read: its only line is the refused
//   attempt on the caller's own account (CA19, backoffice.action_refused, 0215).
// - A holder of the claim or not: a colleague's read-only view must see the image (15 C2).
// - The answer carries no address of Storage and no token (T9.2 as D80 amends it), and is
//   `Cache-Control: no-store`: it is an internal read of a brand's file.
import {
  entryLogoQuerySchema,
  entryLogoResponseSchema,
  entryParamsSchema,
  type EntryLogoQuery,
  type EntryLogoResponse,
  type EntryParams,
} from "@influx/contracts/backoffice-queues";
import type { ApiDatabase } from "../../db/index.ts";
import { ApiError } from "../../platform/errors.ts";
import type { ObjectStore } from "../../platform/storage.ts";
import { withBackofficeSession } from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import { BRAND_LOGO_BUCKET, brandLogoOf } from "../profiles/brand-logo.ts";
import {
  conflictOfInterest,
  isForbidden,
  unlessConflict,
} from "./action-guards.ts";
import { entryAccountOf, readReviewLogo } from "./queues/repository.ts";

export type BackofficeQueueLogoDependencies = {
  database: ApiDatabase;
  store: ObjectStore;
};

export const ENTRY_LOGO_ROUTE =
  "/v1/bo/queues/profiles-advertiser/entries/:id/logo";

export function registerBackofficeQueueLogoRoutes(
  app: IdentityApp,
  dependencies: BackofficeQueueLogoDependencies,
): void {
  const { database, store } = dependencies;

  app.get(
    ENTRY_LOGO_ROUTE,
    {
      schema: {
        params: entryParamsSchema,
        querystring: entryLogoQuerySchema,
        response: { 200: entryLogoResponseSchema },
      },
    },
    async (request, reply): Promise<EntryLogoResponse> => {
      void reply.header("cache-control", "no-store");
      const entryId = (request.params as EntryParams).id.toLowerCase();
      const logoId = (request.query as EntryLogoQuery).logo.toLowerCase();
      // (a) the door of the database, its register line in the same transaction
      let object: Awaited<ReturnType<typeof readReviewLogo>>;
      try {
        object = unlessConflict(
          await withBackofficeSession(
            database,
            request,
            reply,
            async (tx, context) => {
              const target = await entryAccountOf(tx, entryId);
              if (target === null) {
                throw new ApiError("not_found");
              }
              // 15 RG36, 13 RG35: the account is the caller's to hold, not to examine; the refusal
              // is journaled (CA19) and the database refuses it too (0215)
              if (target.ownerAgentId === context.accountId) {
                return conflictOfInterest(tx, context);
              }
              return readReviewLogo(tx, entryId, logoId);
            },
          ),
        );
      } catch (error) {
        // 42501: unknown entry, own account, unknown logo or another account's: one answer
        if (isForbidden(error)) {
          throw new ApiError("not_found");
        }
        throw error;
      }
      if (
        object === null ||
        object.width === null ||
        object.height === null ||
        object.byteSize === null
      ) {
        // a logo row without its description is no logo to show (06: stored whole or not at all)
        request.log.error({}, "queue.logo.row_incomplete");
        throw new ApiError("not_found");
      }

      // (b) the object, by the key of the database: never named by the client (T9.3)
      const read = await store.read(BRAND_LOGO_BUCKET, object.objectKey);
      if (!read.ok) {
        request.log.error(
          {
            reason: read.reason,
            status: read.status,
            errorCode: read.errorCode,
          },
          "queue.logo.read_failed",
        );
        throw new ApiError("service_unavailable");
      }
      if (read.value === null) {
        // a row without its object: a person looks (D60 error line), the screen says it is unreadable
        request.log.error({}, "queue.logo.object_missing");
        throw new ApiError("not_found");
      }
      return {
        state: object.state,
        logo: brandLogoOf(read.value, {
          width: object.width,
          height: object.height,
          updatedAt: object.updatedAt,
        }),
      };
    },
  );
}

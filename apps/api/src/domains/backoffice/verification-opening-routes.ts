// Route of the opening of a verification by an agent (docs/mvp/06 RG51; 15 RG36; jalons/l2f/modele.md §5,
// §6; l2f-fiche invariants 9, 12, 13; D83 A; 0234; 18 T14; l2f commit 15). Backoffice surface; the aal2
// guard of server.ts runs first, then the handler writes through withBackofficeSession() (agent and admin
// alike).
//   POST /v1/bo/accounts/:id/verification-requests   a commercial starts the verification of a member he
//                                                    knows: « Compte vérifié » of a line, or « Marque
//                                                    vérifiée » (the internal block of the company when
//                                                    the brand holds none)
// The same request, the same queue 4, the same unicity and the same decisions as a member's: the origin
// (`agent`) and the reason of the closed list are carried by the request, the member is told by e-mail
// (never a code in it). The request the member already has open is taken over, never doubled.
// - « Audience vérifiée » is never opened this way (D83 (3)): the body names two levels only, and the
//   database refuses the third (22023 `level`). No lot, no import: one account, one line, one level.
// - The reason is a code of the closed list, its comment is internal, 1 to 1 000 characters, required for
//   `other`; neither is ever served to the member (the dossier of queue 4 shows them to agents).
// - An unknown account, an internal one, the caller's own, a line that is not the account's, an account
//   of the other population: the same 404 as an unknown address (T14.3, T14.4). An account the caller
//   HOLDS is not refused: the responsible commercial opens his own client's verification (D83).
// - Every answer is `Cache-Control: no-store`. Nothing typed by an agent is logged here.
import {
  openVerificationForMemberBodySchema,
  openVerificationForMemberResponseSchema,
  type OpenVerificationForMemberBody,
  type OpenVerificationForMemberResponse,
} from "@influx/contracts/verification";
import { accountActionParamsSchema } from "@influx/contracts/backoffice-actions";
import type { AccountActionParams } from "@influx/contracts/backoffice-actions";
import type { ApiDatabase } from "../../db/index.ts";
import { ApiError } from "../../platform/errors.ts";
import { withBackofficeSession } from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import { isMemberAccount } from "./verification-badges/repository.ts";
import { openVerificationForMember } from "./verification-opening/repository.ts";
import { openingRefusalOf } from "./verification-queues/refusals.ts";

export type VerificationOpeningRoutesDependencies = { database: ApiDatabase };

export function registerVerificationOpeningRoutes(
  app: IdentityApp,
  dependencies: VerificationOpeningRoutesDependencies,
): void {
  const { database } = dependencies;

  app.post(
    "/v1/bo/accounts/:id/verification-requests",
    {
      schema: {
        params: accountActionParamsSchema,
        body: openVerificationForMemberBodySchema,
        response: { 200: openVerificationForMemberResponseSchema },
      },
    },
    async (request, reply): Promise<OpenVerificationForMemberResponse> => {
      void reply.header("cache-control", "no-store");
      const accountId = (
        request.params as AccountActionParams
      ).id.toLowerCase();
      const body = request.body as OpenVerificationForMemberBody;
      return withBackofficeSession(database, request, reply, async (tx) => {
        if (!(await isMemberAccount(tx, accountId))) {
          throw new ApiError("not_found");
        }
        try {
          // a savepoint: the refusal of the door leaves the transaction in a state it can answer from
          const opened = await tx.transaction((savepoint) =>
            openVerificationForMember(savepoint, {
              accountId,
              socialAccountId: body.socialAccountId?.toLowerCase() ?? null,
              level: body.level,
              reasonCode: body.openingReasonCode,
              comment: body.openingComment ?? null,
              legalName: body.legalName ?? null,
              registrationCountryCode: body.registrationCountryCode ?? null,
              registrationNumber: body.registrationNumber ?? null,
            }),
          );
          return openVerificationForMemberResponseSchema.parse({
            requestId: opened.requestId,
            status: opened.status,
            created: opened.created,
          });
        } catch (error) {
          throw openingRefusalOf(error);
        }
      });
    },
  );
}

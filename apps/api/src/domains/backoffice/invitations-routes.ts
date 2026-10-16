// Invitation routes of the backoffice (docs/mvp/15 RG99, RG101; 05 RG116 to RG119, D54; 03 §3.1,
// MFA-1, B-8; 17b §3.13; 21 §J8 commit 7, EC-45, EC-J8-2, EC-J8-3). Backoffice surface; the aal2
// guard of server.ts runs first. The rules are the database's (0131): these handlers draw the
// secret, choose the transaction, read the refusal and say it. TWO OBJECTS, NEVER MERGED:
// - Internal invitation, admin only (an agent's attempt refused AND journaled, CA63):
//   POST /v1/bo/internal-invitations (B-5: R in the transaction; an invitation proposing admin
//   requests its dual control identity.invite_admin in the same transaction, EC-J8-12; any refusal
//   of the database, an address already known included, is the uniform 403 of 0131);
//   GET /v1/bo/internal-invitations; POST /v1/bo/internal-invitations/:id/revoke.
// - Member invitation, agent and admin: POST /v1/bo/member-invitations (an address already held
//   by an account or a live invitation: 409); GET /v1/bo/member-invitations (an agent's own,
//   every one for an admin, EC-J8-31); POST /v1/bo/member-invitations/:id/revoke (its author or an
//   admin). The link is copied by the agent: no e-mail from INFLUX (EC-J8-3, D35).
// The link is in the creation answer only: the secret is never stored (SHA-256) nor logged.
// `Cache-Control: no-store` everywhere. Unknown and ended targets answer 404.
import {
  INVITATION_LIST_CAP,
  internalInvitationCreatedSchema,
  internalInvitationRequestSchema,
  internalInvitationsResponseSchema,
  invitationParamsSchema,
  invitationRevokeRequestSchema,
  invitationRevokeResponseSchema,
  memberInvitationCreatedSchema,
  memberInvitationRequestSchema,
  memberInvitationsResponseSchema,
  type InternalInvitationCreated,
  type InternalInvitationRequest,
  type InternalInvitationsResponse,
  type InvitationParams,
  type InvitationRevokeRequest,
  type MemberInvitationCreated,
  type MemberInvitationRequest,
  type MemberInvitationsResponse,
} from "@influx/contracts/backoffice-invitations";
import type { PublicOrigins } from "../../config/schema.ts";
import type { ApiDatabase } from "../../db/index.ts";
import { sqlStateOf } from "../../db/sql-state.ts";
import { ApiError, RequestValidationError } from "../../platform/errors.ts";
import {
  withBackofficeSession,
  withSensitiveAction,
} from "../identity/backoffice-session.ts";
import type { IdentityApp } from "../identity/routes.ts";
import { adminOnly, isForbidden, unlessRefused } from "./actions-routes.ts";
import { requestDualControl } from "./dual-control.ts";
import {
  internalActivationLink,
  memberSignupLink,
  newInvitationSecret,
} from "./invitation-links.ts";
import {
  createInternalInvitation,
  createMemberInvitation,
  internalInvitations,
  memberInvitations,
  revokeInternalInvitation,
  revokeMemberInvitation,
} from "./repository.ts";

export type BackofficeInvitationDependencies = {
  database: ApiDatabase;
  /** The links: the backoffice's activation page, the sign-up doors of web. */
  publicOrigins: PublicOrigins;
};

const REVOKED = { revoked: true } as const;

export function registerBackofficeInvitationRoutes(
  app: IdentityApp,
  dependencies: BackofficeInvitationDependencies,
): void {
  const { database, publicOrigins } = dependencies;

  // -------------------------------------------------------------------------------------------
  // Internal invitations (15 RG99, RG101)
  // -------------------------------------------------------------------------------------------

  app.post(
    "/v1/bo/internal-invitations",
    {
      schema: {
        body: internalInvitationRequestSchema,
        response: { 200: internalInvitationCreatedSchema },
      },
    },
    async (request, reply): Promise<InternalInvitationCreated> => {
      void reply.header("cache-control", "no-store");
      const body = request.body as InternalInvitationRequest;
      const secret = newInvitationSecret();
      const created = unlessRefused(
        await withSensitiveAction(database, request, reply, (tx, context) =>
          adminOnly(tx, context, "identity.internal_invitation", async () => {
            const invitation = await createInternalInvitation(
              tx,
              context.sessionId,
              {
                email: body.email,
                role: body.role,
                tokenHash: secret.hash,
                reasonCode: body.reasonCode,
              },
            );
            // EC-J8-12: an admin invitation is usable once its 2V is confirmed (same reason)
            const dualControlRequestId = invitation.requiresDualControl
              ? await requestDualControl(tx, {
                  action: {
                    code: "identity.invite_admin",
                    invitationId: invitation.invitationId,
                  },
                  reasonCode: body.reasonCode,
                  reasonNote: null,
                })
              : null;
            return { ...invitation, dualControlRequestId };
          }),
        ),
      );
      request.log.info(
        { role: body.role, dualControl: created.dualControlRequestId !== null },
        "internal invitation created",
      );
      return {
        invitationId: created.invitationId,
        expiresAt: created.expiresAt,
        link: internalActivationLink(publicOrigins.backoffice, secret.token),
        dualControlRequestId: created.dualControlRequestId,
      };
    },
  );

  app.get(
    "/v1/bo/internal-invitations",
    { schema: { response: { 200: internalInvitationsResponseSchema } } },
    async (request, reply): Promise<InternalInvitationsResponse> => {
      void reply.header("cache-control", "no-store");
      const rows = unlessRefused(
        await withBackofficeSession(database, request, reply, (tx, context) =>
          adminOnly(tx, context, "identity.internal_invitation", () =>
            internalInvitations(tx, INVITATION_LIST_CAP),
          ),
        ),
      );
      return { invitations: rows };
    },
  );

  app.post(
    "/v1/bo/internal-invitations/:id/revoke",
    {
      schema: {
        params: invitationParamsSchema,
        body: invitationRevokeRequestSchema,
        response: { 200: invitationRevokeResponseSchema },
      },
    },
    async (request, reply) => {
      void reply.header("cache-control", "no-store");
      const invitationId = (
        request.params as InvitationParams
      ).id.toLowerCase();
      const body = request.body as InvitationRevokeRequest;
      try {
        unlessRefused(
          await withBackofficeSession(database, request, reply, (tx, context) =>
            adminOnly(tx, context, "identity.internal_invitation", () =>
              revokeInternalInvitation(tx, invitationId, body.reasonCode),
            ),
          ),
        );
      } catch (error) {
        if (isForbidden(error)) {
          // unknown, accepted or already revoked
          throw new ApiError("not_found");
        }
        throw error;
      }
      return REVOKED;
    },
  );

  // -------------------------------------------------------------------------------------------
  // Member invitations (05 RG116 to RG119, D54)
  // -------------------------------------------------------------------------------------------

  app.post(
    "/v1/bo/member-invitations",
    {
      schema: {
        body: memberInvitationRequestSchema,
        response: { 200: memberInvitationCreatedSchema },
      },
    },
    async (request, reply): Promise<MemberInvitationCreated> => {
      void reply.header("cache-control", "no-store");
      const body = request.body as MemberInvitationRequest;
      const secret = newInvitationSecret();
      let created: { invitationId: string; expiresAt: string };
      try {
        created = await withBackofficeSession(database, request, reply, (tx) =>
          createMemberInvitation(tx, {
            email: body.email,
            proposedRole: body.proposedRole,
            preferredLanguage: body.preferredLanguage,
            codeHash: secret.hash,
          }),
        );
      } catch (error) {
        switch (sqlStateOf(error)) {
          case "23505":
            // EC-J8-15: an account or a live invitation already holds the address
            throw new ApiError("conflict");
          case "22023":
          case "23503":
            throw new RequestValidationError([
              { path: "", issue: "refused_value" },
            ]);
          default:
            throw error;
        }
      }
      request.log.info(
        { proposedRole: body.proposedRole, language: body.preferredLanguage },
        "member invitation created",
      );
      return {
        ...created,
        link: memberSignupLink(
          publicOrigins.web,
          body.preferredLanguage,
          body.proposedRole,
          secret.token,
        ),
      };
    },
  );

  app.get(
    "/v1/bo/member-invitations",
    { schema: { response: { 200: memberInvitationsResponseSchema } } },
    async (request, reply): Promise<MemberInvitationsResponse> => {
      void reply.header("cache-control", "no-store");
      const rows = await withBackofficeSession(
        database,
        request,
        reply,
        (tx, context) =>
          memberInvitations(
            tx,
            context.role === "admin" ? null : context.accountId,
            INVITATION_LIST_CAP,
          ),
      );
      return { invitations: rows };
    },
  );

  app.post(
    "/v1/bo/member-invitations/:id/revoke",
    {
      schema: {
        params: invitationParamsSchema,
        body: invitationRevokeRequestSchema,
        response: { 200: invitationRevokeResponseSchema },
      },
    },
    async (request, reply) => {
      void reply.header("cache-control", "no-store");
      const invitationId = (
        request.params as InvitationParams
      ).id.toLowerCase();
      const body = request.body as InvitationRevokeRequest;
      try {
        await withBackofficeSession(database, request, reply, (tx) =>
          revokeMemberInvitation(tx, invitationId, body.reasonCode),
        );
      } catch (error) {
        if (isForbidden(error)) {
          // unknown, another agent's, redeemed or already revoked
          throw new ApiError("not_found");
        }
        throw error;
      }
      return REVOKED;
    },
  );
}

// Contract of the invitation routes of the backoffice (docs/mvp/15 RG99, RG101; 05 RG116 to RG119,
// D54; 03 §3.1, MFA-1, B-8; 17b §3.13, §3.14.b; 21 §J8 commit 7; migration 0131). Shared by
// apps/api and apps/backoffice. TWO OBJECTS, NEVER MERGED (EC-J8-2):
// - Internal invitation (admin only, with a fresh second factor): an address, agent or admin, a
//   typed reason; 72 hours, single use, bound to the address. The link is shown ONCE, at creation
//   (only its SHA-256 is stored). An invitation proposing admin is usable only once its dual control
//   identity.invite_admin is confirmed (EC-J8-12): the creation requests it in the same transaction.
//   Its acceptance is POST /v1/bo/auth/invitation/accept (backoffice-auth.ts).
// - Member invitation (agent, admin): an address, advertiser or creator, a language; valid for the
//   days of the setting signup_invitation_validity_days. The link is shown ONCE and copied by the
//   agent: INFLUX sends no invitation e-mail before Lot 5 (EC-J8-3, D35 open, RG118).
// Never a token, a code nor a digest in a list (RG107).
import * as z from "zod";
import { MAX_EMAIL_LENGTH, normalizeEmail, uiLocaleSchema } from "./auth.ts";
import { internalRoleSchema } from "./backoffice-auth.ts";

const emailSchema = z
  .string()
  .max(MAX_EMAIL_LENGTH * 2)
  .transform(normalizeEmail)
  .pipe(z.email().max(MAX_EMAIL_LENGTH));

/** The newest invitations a list returns, at most. */
export const INVITATION_LIST_CAP = 200;

/** The reasons of an internal invitation (0131 identity.create_internal_invitation()). */
export const INTERNAL_INVITATION_REASONS = [
  "new_team_member",
  "team_replacement",
] as const;

/** The reasons of a revocation, both objects (0131). */
export const INVITATION_REVOKE_REASONS = [
  "sent_to_wrong_address",
  "no_longer_needed",
  "suspected_compromise",
  "replaced_by_new_invitation",
] as const;

export const invitationParamsSchema = z.strictObject({ id: z.uuid() });
export type InvitationParams = z.infer<typeof invitationParamsSchema>;

export const invitationRevokeRequestSchema = z.strictObject({
  reasonCode: z.enum(INVITATION_REVOKE_REASONS),
});
export type InvitationRevokeRequest = z.infer<
  typeof invitationRevokeRequestSchema
>;

export const invitationRevokeResponseSchema = z.strictObject({
  revoked: z.literal(true),
});

// ---------------------------------------------------------------------------------------------
// Internal invitation (15 RG99, RG101; 03 §3.1 J · R)
// ---------------------------------------------------------------------------------------------

export const internalInvitationRequestSchema = z.strictObject({
  email: emailSchema,
  role: internalRoleSchema,
  reasonCode: z.enum(INTERNAL_INVITATION_REASONS),
});
export type InternalInvitationRequest = z.infer<
  typeof internalInvitationRequestSchema
>;

export const internalInvitationCreatedSchema = z.strictObject({
  invitationId: z.uuid(),
  expiresAt: z.iso.datetime(),
  /** The activation link, shown once: `<backoffice>/activation#<token>` (G-1 point 2). */
  link: z.url(),
  /** EC-J8-12: the dual control requested for an admin invitation; null for an agent. */
  dualControlRequestId: z.uuid().nullable(),
});
export type InternalInvitationCreated = z.infer<
  typeof internalInvitationCreatedSchema
>;

/**
 * awaiting_dual_control: an admin invitation not yet confirmed (unusable); pending: usable;
 * accepted, revoked; expired: past its 72 hours unused.
 */
export const INTERNAL_INVITATION_STATES = [
  "awaiting_dual_control",
  "pending",
  "accepted",
  "revoked",
  "expired",
] as const;

export const internalInvitationsResponseSchema = z.strictObject({
  invitations: z
    .array(
      z.strictObject({
        id: z.uuid(),
        email: z.email(),
        role: internalRoleSchema,
        reasonCode: z.enum(INTERNAL_INVITATION_REASONS),
        createdBy: z.uuid(),
        createdAt: z.iso.datetime(),
        expiresAt: z.iso.datetime(),
        state: z.enum(INTERNAL_INVITATION_STATES),
        dualControlRequestId: z.uuid().nullable(),
        /** The internal account created by the acceptance. */
        accountId: z.uuid().nullable(),
        revokeReasonCode: z.enum(INVITATION_REVOKE_REASONS).nullable(),
      }),
    )
    .max(INVITATION_LIST_CAP),
});
export type InternalInvitationsResponse = z.infer<
  typeof internalInvitationsResponseSchema
>;

// ---------------------------------------------------------------------------------------------
// Member invitation (05 RG116 to RG119, D54)
// ---------------------------------------------------------------------------------------------

export const MEMBER_INVITATION_ROLES = ["advertiser", "creator"] as const;

export const memberInvitationRequestSchema = z.strictObject({
  email: emailSchema,
  /** RG116: proposed only; the person chooses the final role at sign-up (RG117). */
  proposedRole: z.enum(MEMBER_INVITATION_ROLES),
  /** The language of the sign-up page the link opens. */
  preferredLanguage: uiLocaleSchema,
});
export type MemberInvitationRequest = z.infer<
  typeof memberInvitationRequestSchema
>;

export const memberInvitationCreatedSchema = z.strictObject({
  invitationId: z.uuid(),
  expiresAt: z.iso.datetime(),
  /** The sign-up link, shown once, copied by the agent (EC-J8-3): the code is in its fragment. */
  link: z.url(),
});
export type MemberInvitationCreated = z.infer<
  typeof memberInvitationCreatedSchema
>;

/** pending: usable; redeemed: an account was created with it (RG119); revoked; expired. */
export const MEMBER_INVITATION_STATES = [
  "pending",
  "redeemed",
  "revoked",
  "expired",
] as const;

export const memberInvitationsResponseSchema = z.strictObject({
  invitations: z
    .array(
      z.strictObject({
        id: z.uuid(),
        email: z.email(),
        proposedRole: z.enum(MEMBER_INVITATION_ROLES),
        preferredLanguage: uiLocaleSchema,
        createdBy: z.uuid(),
        createdAt: z.iso.datetime(),
        expiresAt: z.iso.datetime(),
        state: z.enum(MEMBER_INVITATION_STATES),
        /** The member account whose sign-up redeemed the code. */
        accountId: z.uuid().nullable(),
      }),
    )
    .max(INVITATION_LIST_CAP),
});
export type MemberInvitationsResponse = z.infer<
  typeof memberInvitationsResponseSchema
>;

// ---------------------------------------------------------------------------------------------
// Internal accounts (17b §3.13.a; 15 RG99, RG103, RG106; J8 commit 9): the list of the admin
// ---------------------------------------------------------------------------------------------

/** The internal accounts a list returns, at most (a team, never a directory). */
export const INTERNAL_ACCOUNT_LIST_CAP = 200;

/**
 * GET /v1/bo/internal-accounts (admin): one line per person (15 RG99: a named person, never a
 * shared account). The break-glass account is listed, never hidden (17b §3.13.b). `ownedAccounts`
 * counts the member accounts it is responsible for (D54; the introductions and deals come with
 * Lots 4 and 5). The last sign-in is not read at J8 (sessions are readable by their holder only).
 */
export const internalAccountsResponseSchema = z.strictObject({
  accounts: z
    .array(
      z.strictObject({
        id: z.uuid(),
        firstName: z.string().nullable(),
        email: z.email(),
        role: internalRoleSchema,
        secondFactorActive: z.boolean(),
        active: z.boolean(),
        breakGlass: z.boolean(),
        absence: z
          .strictObject({ from: z.iso.date(), to: z.iso.date() })
          .nullable(),
        ownedAccounts: z.number().int().nonnegative(),
      }),
    )
    .max(INTERNAL_ACCOUNT_LIST_CAP),
});
export type InternalAccountsResponse = z.infer<
  typeof internalAccountsResponseSchema
>;

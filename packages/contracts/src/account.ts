import { z } from "zod";
import { CountryCodeSchema, LanguageSchema } from "./common";

export const AccountRoleSchema = z.enum([
  "advertiser",
  "creator",
  "agent",
  "admin",
]);
export type AccountRole = z.infer<typeof AccountRoleSchema>;

export const AccountStatusSchema = z.enum([
  "active",
  "suspended",
  "pending_verification",
  "closed",
]);
export type AccountStatus = z.infer<typeof AccountStatusSchema>;

export const DeclaredStatusSchema = z.enum([
  "company",
  "individual",
  "freelancer",
  "internal",
]);
export type DeclaredStatus = z.infer<typeof DeclaredStatusSchema>;

export const EmailStatusSchema = z.enum(["unverified", "verified", "bounced"]);
export type EmailStatus = z.infer<typeof EmailStatusSchema>;

export const AccountSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().toLowerCase(),
  role: AccountRoleSchema,
  status: AccountStatusSchema.default("active"),
  preferredLanguage: LanguageSchema.default("fr"),
  countryCode: CountryCodeSchema.default("FR"),
  declaredStatus: DeclaredStatusSchema.optional(),
  emailStatus: EmailStatusSchema.default("unverified"),
  ownerAgentId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Account = z.infer<typeof AccountSchema>;

export const TermsAcceptanceSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  termsVersion: z.string().min(1),
  acceptedAt: z.string().datetime(),
  hasNonCircumventionAcknowledged: z.boolean().default(true),
  ipAddress: z.string().optional(),
});
export type TermsAcceptance = z.infer<typeof TermsAcceptanceSchema>;

export const ConsentEventSchema = z.object({
  id: z.string().uuid(),
  accountId: z.string().uuid(),
  marketingConsent: z.boolean(),
  recordedAt: z.string().datetime(),
});
export type ConsentEvent = z.infer<typeof ConsentEventSchema>;

export const UserSessionSchema = z.object({
  accountId: z.string().uuid(),
  email: z.string().email(),
  role: AccountRoleSchema,
  preferredLanguage: LanguageSchema,
  displayName: z.string().min(1),
});
export type UserSession = z.infer<typeof UserSessionSchema>;

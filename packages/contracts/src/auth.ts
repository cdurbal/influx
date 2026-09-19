import { z } from "zod";
import {
  AccountRoleSchema,
  UserSessionSchema,
  TermsAcceptanceSchema,
  type AccountRole,
  type UserSession,
  type TermsAcceptance,
  type Account,
} from "./account";

export const MemberRoleSchema = z.enum(["advertiser", "creator"]);
export type MemberRole = z.infer<typeof MemberRoleSchema>;

export const SendOtpRequestSchema = z.object({
  email: z.string().email().toLowerCase(),
  role: MemberRoleSchema,
});
export type SendOtpRequest = z.infer<typeof SendOtpRequestSchema>;

export const SendOtpResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  expiresInSeconds: z.number(),
});
export type SendOtpResponse = z.infer<typeof SendOtpResponseSchema>;

export const VerifyOtpRequestSchema = z.object({
  email: z.string().email().toLowerCase(),
  code: z.string().length(6),
  termsVersion: z.string().optional().default("2026-09-v1"),
  hasNonCircumventionAcknowledged: z.boolean().optional().default(true),
  marketingConsent: z.boolean().optional().default(false),
});
export type VerifyOtpRequest = z.input<typeof VerifyOtpRequestSchema>;

export const VerifyOtpResponseSchema = z.object({
  success: z.boolean(),
  token: z.string(),
  user: UserSessionSchema,
  account: z.any().optional(),
});
export type VerifyOtpResponse = z.infer<typeof VerifyOtpResponseSchema>;

export const CurrentUserResponseSchema = z.object({
  user: UserSessionSchema,
  account: z.any().optional(),
});
export type CurrentUserResponse = z.infer<typeof CurrentUserResponseSchema>;

export const SESSION_COOKIE_NAME = "influx_session";
export const OTP_DEFAULT_CODE = "123456";
export const OTP_EXPIRATION_SECONDS = 10 * 60; // 10 minutes (D37)
export const OTP_MAX_ATTEMPTS = 5; // 5 tentatives (D37)

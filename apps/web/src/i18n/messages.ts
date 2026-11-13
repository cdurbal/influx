import enAccount from "@/locales/en/account.json";
import enAuth from "@/locales/en/auth.json";
import enBrandProfile from "@/locales/en/brand-profile.json";
import enCampaign from "@/locales/en/campaign.json";
import enCreatorProfile from "@/locales/en/creator-profile.json";
import enErrors from "@/locales/en/errors.json";
import enLanding from "@/locales/en/landing.json";
import enLegal from "@/locales/en/legal.json";
import enMember from "@/locales/en/member.json";
import enVerification from "@/locales/en/verification.json";
import frAccount from "@/locales/fr/account.json";
import frAuth from "@/locales/fr/auth.json";
import frBrandProfile from "@/locales/fr/brand-profile.json";
import frCampaign from "@/locales/fr/campaign.json";
import frCreatorProfile from "@/locales/fr/creator-profile.json";
import frErrors from "@/locales/fr/errors.json";
import frLanding from "@/locales/fr/landing.json";
import frLegal from "@/locales/fr/legal.json";
import frMember from "@/locales/fr/member.json";
import frVerification from "@/locales/fr/verification.json";
import type { AppLocale } from "./routing";

type FrLanding = typeof frLanding;
type EnLanding = typeof enLanding;
type FrAuth = typeof frAuth;
type EnAuth = typeof enAuth;
type FrLegal = typeof frLegal;
type FrAccount = typeof frAccount;
type EnAccount = typeof enAccount;
type EnLegal = typeof enLegal;
type FrErrors = typeof frErrors;
type EnErrors = typeof enErrors;
type FrMember = typeof frMember;
type EnMember = typeof enMember;
type FrBrandProfile = typeof frBrandProfile;
type EnBrandProfile = typeof enBrandProfile;
type FrCreatorProfile = typeof frCreatorProfile;
type EnCreatorProfile = typeof enCreatorProfile;
type FrVerification = typeof frVerification;
type EnVerification = typeof enVerification;
type FrCampaign = typeof frCampaign;
type EnCampaign = typeof enCampaign;

// Compile-time parity check (CA23): each file must be assignable to the type of the other one.
// A key missing or added on either side makes `pnpm typecheck` fail.
const enMatchesFr: FrLanding = enLanding;
const frMatchesEn: EnLanding = frLanding;
const enAuthMatchesFr: FrAuth = enAuth;
const frAuthMatchesEn: EnAuth = frAuth;
const enLegalMatchesFr: FrLegal = enLegal;
const frLegalMatchesEn: EnLegal = frLegal;
const enAccountMatchesFr: FrAccount = enAccount;
const frAccountMatchesEn: EnAccount = frAccount;
const enErrorsMatchesFr: FrErrors = enErrors;
const frErrorsMatchesEn: EnErrors = frErrors;
const enMemberMatchesFr: FrMember = enMember;
const frMemberMatchesEn: EnMember = frMember;
const enBrandProfileMatchesFr: FrBrandProfile = enBrandProfile;
const frBrandProfileMatchesEn: EnBrandProfile = frBrandProfile;
const enCreatorProfileMatchesFr: FrCreatorProfile = enCreatorProfile;
const frCreatorProfileMatchesEn: EnCreatorProfile = frCreatorProfile;
const enVerificationMatchesFr: FrVerification = enVerification;
const frVerificationMatchesEn: EnVerification = frVerification;
const enCampaignMatchesFr: FrCampaign = enCampaign;
const frCampaignMatchesEn: EnCampaign = frCampaign;

export type Messages = {
  landing: FrLanding;
  auth: FrAuth;
  legal: FrLegal;
  account: FrAccount;
  errors: FrErrors;
  member: FrMember;
  brandProfile: FrBrandProfile;
  creatorProfile: FrCreatorProfile;
  verification: FrVerification;
  campaign: FrCampaign;
};

export const MESSAGES: Record<AppLocale, Messages> = {
  fr: {
    landing: frMatchesEn,
    auth: frAuthMatchesEn,
    legal: frLegalMatchesEn,
    account: frAccountMatchesEn,
    errors: frErrorsMatchesEn,
    member: frMemberMatchesEn,
    brandProfile: frBrandProfileMatchesEn,
    creatorProfile: frCreatorProfileMatchesEn,
    verification: frVerificationMatchesEn,
    campaign: frCampaignMatchesEn,
  },
  en: {
    landing: enMatchesFr,
    auth: enAuthMatchesFr,
    legal: enLegalMatchesFr,
    account: enAccountMatchesFr,
    errors: enErrorsMatchesFr,
    member: enMemberMatchesFr,
    brandProfile: enBrandProfileMatchesFr,
    creatorProfile: enCreatorProfileMatchesFr,
    verification: enVerificationMatchesFr,
    campaign: enCampaignMatchesFr,
  },
};

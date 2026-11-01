import enAccount from "@/locales/en/account.json";
import enAuth from "@/locales/en/auth.json";
import enErrors from "@/locales/en/errors.json";
import enLanding from "@/locales/en/landing.json";
import enLegal from "@/locales/en/legal.json";
import enMember from "@/locales/en/member.json";
import frAccount from "@/locales/fr/account.json";
import frAuth from "@/locales/fr/auth.json";
import frErrors from "@/locales/fr/errors.json";
import frLanding from "@/locales/fr/landing.json";
import frLegal from "@/locales/fr/legal.json";
import frMember from "@/locales/fr/member.json";
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

export type Messages = {
  landing: FrLanding;
  auth: FrAuth;
  legal: FrLegal;
  account: FrAccount;
  errors: FrErrors;
  member: FrMember;
};

export const MESSAGES: Record<AppLocale, Messages> = {
  fr: {
    landing: frMatchesEn,
    auth: frAuthMatchesEn,
    legal: frLegalMatchesEn,
    account: frAccountMatchesEn,
    errors: frErrorsMatchesEn,
    member: frMemberMatchesEn,
  },
  en: {
    landing: enMatchesFr,
    auth: enAuthMatchesFr,
    legal: enLegalMatchesFr,
    account: enAccountMatchesFr,
    errors: enErrorsMatchesFr,
    member: enMemberMatchesFr,
  },
};

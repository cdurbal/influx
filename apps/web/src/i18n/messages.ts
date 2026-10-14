import enAccount from "@/locales/en/account.json";
import enAuth from "@/locales/en/auth.json";
import enLanding from "@/locales/en/landing.json";
import enLegal from "@/locales/en/legal.json";
import frAccount from "@/locales/fr/account.json";
import frAuth from "@/locales/fr/auth.json";
import frLanding from "@/locales/fr/landing.json";
import frLegal from "@/locales/fr/legal.json";
import type { AppLocale } from "./routing";

type FrLanding = typeof frLanding;
type EnLanding = typeof enLanding;
type FrAuth = typeof frAuth;
type EnAuth = typeof enAuth;
type FrLegal = typeof frLegal;
type FrAccount = typeof frAccount;
type EnAccount = typeof enAccount;
type EnLegal = typeof enLegal;

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

export type Messages = {
  landing: FrLanding;
  auth: FrAuth;
  legal: FrLegal;
  account: FrAccount;
};

export const MESSAGES: Record<AppLocale, Messages> = {
  fr: {
    landing: frMatchesEn,
    auth: frAuthMatchesEn,
    legal: frLegalMatchesEn,
    account: frAccountMatchesEn,
  },
  en: {
    landing: enMatchesFr,
    auth: enAuthMatchesFr,
    legal: enLegalMatchesFr,
    account: enAccountMatchesFr,
  },
};
